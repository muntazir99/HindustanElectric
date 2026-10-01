from decimal import Decimal

from django.db.models import Count, DecimalField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from catalog.models import ItemUnit
from catalog.serializers import is_owner

from . import services
from .models import Customer, Invoice, InvoiceLine
from .serializers import (
    CustomerSerializer,
    FinaliseSerializer,
    InvoiceInputSerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
)

MONEY = DecimalField(max_digits=12, decimal_places=2)


def customers_with_balance():
    return Customer.objects.annotate(
        balance_value=Coalesce(Sum("ledger__debit"), Value(Decimal("0")), output_field=MONEY)
        - Coalesce(Sum("ledger__credit"), Value(Decimal("0")), output_field=MONEY)
    )


class CustomerViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CustomerSerializer
    http_method_names = ["get", "post", "patch"]

    def get_queryset(self):
        queryset = customers_with_balance().order_by("name")
        params = self.request.query_params
        for word in params.get("search", "").split():
            queryset = queryset.filter(Q(name__icontains=word) | Q(phone__contains=word) | Q(gstin__icontains=word))
        if params.get("include_inactive") != "1":
            queryset = queryset.filter(is_active=True)
        if params.get("owing") == "1":
            queryset = queryset.filter(balance_value__gt=0)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


INVOICE_DETAIL = Invoice.objects.select_related("customer", "created_by", "finalised_by", "cancelled_by").prefetch_related(
    Prefetch(
        "lines",
        queryset=InvoiceLine.objects.select_related("item__product").prefetch_related(
            Prefetch("item__units", queryset=ItemUnit.objects.order_by("factor"))
        ),
    ),
    "payments",
)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Bills. Drafts (and held bills) are saved as the counter works; finalise makes it a numbered bill.
    PUT/PATCH replaces a draft's header and lines.
    """

    http_method_names = ["get", "post", "put", "patch", "delete"]

    def get_queryset(self):
        if self.action != "list":
            return INVOICE_DETAIL
        params = self.request.query_params
        queryset = Invoice.objects.select_related("created_by").annotate(line_count=Count("lines"))
        state = params.get("status", "final")
        if state == "held":
            queryset = queryset.filter(status=Invoice.Status.DRAFT, held=True).order_by("-updated_at")
        elif state in Invoice.Status.values:
            queryset = queryset.filter(status=state).order_by("-finalised_at", "-id")
        else:
            queryset = queryset.exclude(status=Invoice.Status.DRAFT).order_by("-finalised_at", "-id")
        if params.get("date_from"):
            queryset = queryset.filter(invoice_date__gte=params["date_from"])
        if params.get("date_to"):
            queryset = queryset.filter(invoice_date__lte=params["date_to"])
        if params.get("customer"):
            queryset = queryset.filter(customer_id=params["customer"])
        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(number__icontains=search) | Q(buyer_name__icontains=search) | Q(buyer_phone__contains=search)
            )
        return queryset

    def get_serializer_class(self):
        return InvoiceListSerializer if self.action == "list" else InvoiceSerializer

    def _respond(self, invoice, code=status.HTTP_200_OK, **extra):
        data = InvoiceSerializer(INVOICE_DETAIL.get(pk=invoice.pk), context={"request": self.request}).data
        return Response({**data, **extra}, status=code)

    def _save(self, invoice):
        serializer = InvoiceInputSerializer(data=self.request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        lines = data.pop("lines")
        return services.save_draft(invoice, lines=lines, user=self.request.user, **data)

    def create(self, request):
        return self._respond(self._save(Invoice()), status.HTTP_201_CREATED)

    def update(self, request, pk=None, partial=False):
        return self._respond(self._save(self.get_object()))

    def destroy(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Only a draft or held bill can be deleted. Cancel a finalised bill instead.")
        if not is_owner({"request": request}) and invoice.created_by_id != request.user.pk:
            raise PermissionDenied("Only the owner or the person who started it can delete this bill.")
        invoice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False)
    def current(self, request):
        """The bill this user was working on at the counter (not held), to resume after a refresh."""
        invoice = (
            Invoice.objects.filter(status=Invoice.Status.DRAFT, held=False, created_by=request.user)
            .order_by("-updated_at")
            .first()
        )
        if invoice is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return self._respond(invoice)

    @action(detail=True, methods=["post"])
    def finalise(self, request, pk=None):
        serializer = FinaliseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payments = [(p["mode"], p["amount"]) for p in serializer.validated_data["payments"]]
        invoice, warnings = services.finalise(self.get_object(), payments=payments, user=request.user)
        return self._respond(invoice, warnings=warnings)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        if not is_owner({"request": request}):
            raise PermissionDenied("Only the owner can cancel a bill.")
        invoice = services.cancel(self.get_object(), reason=request.data.get("reason", ""), user=request.user)
        return self._respond(invoice)

