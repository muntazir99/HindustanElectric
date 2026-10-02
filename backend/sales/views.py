from decimal import Decimal

from django.db.models import Count, DecimalField, Prefetch, Q, Sum, Value
from django.utils import timezone
from django.db.models.functions import Coalesce
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.access import BILLING, KHATA_CONTROL, PAYMENTS, RETURNS, VIEW_BILLS, VIEW_KHATA, VIEW_SALES
from accounts.permissions import OPEN, can
from catalog.models import ItemUnit
from core.params import id_param

from . import services
from .models import CreditNote, Customer, Invoice, InvoiceLine, Payment
from .serializers import (
    AmountSerializer,
    CreditNoteSerializer,
    ReturnInputSerializer,
    CustomerSerializer,
    LedgerLineSerializer,
    ReceiptSerializer,
    ReceivePaymentSerializer,
    FinaliseSerializer,
    InvoiceInputSerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
)

MONEY = DecimalField(max_digits=12, decimal_places=2)
ZERO = Decimal("0")


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
    # Billing picks a customer; payments and khata look them up. Limits and corrections: udhaar control.
    access = {
        "list": (BILLING, PAYMENTS, VIEW_KHATA),
        "retrieve": (BILLING, PAYMENTS, VIEW_KHATA),
        "create": (BILLING, PAYMENTS, VIEW_KHATA),
        "partial_update": (VIEW_KHATA, KHATA_CONTROL),
        "ledger": (PAYMENTS, VIEW_KHATA),
        "payments": PAYMENTS,
        "opening": KHATA_CONTROL,
        "adjust": KHATA_CONTROL,
    }

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

    def _customer_response(self, customer):
        return CustomerSerializer(customers_with_balance().get(pk=customer.pk), context={"request": self.request}).data

    @action(detail=True)
    def ledger(self, request, pk=None):
        """Khata statement with running balance; ?date_from=&date_to= carry earlier entries forward."""
        customer = self.get_object()
        params = request.query_params
        brought_forward, lines, closing = services.statement(customer, params.get("date_from"), params.get("date_to"))
        return Response(
            {
                "customer": self._customer_response(customer),
                "brought_forward": str(brought_forward),
                "closing_balance": str(closing),
                "lines": LedgerLineSerializer(
                    [{"entry": entry, "balance": balance} for entry, balance in lines], many=True
                ).data,
            }
        )

    @action(detail=True, methods=["post"])
    def payments(self, request, pk=None):
        """Receive money against khata: {amount, mode, reference?, note?}. Returns the receipt."""
        customer = self.get_object()
        serializer = ReceivePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payment = services.receive_payment(
            customer, data["amount"], mode=data["mode"], user=request.user, reference=data["reference"], note=data["note"]
        )
        return Response(ReceiptSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def opening(self, request, pk=None):
        """Udhaar control: what they already owed from the paper khata (negative = advance)."""
        customer = self.get_object()
        serializer = AmountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.set_opening_balance(customer, serializer.validated_data["amount"], user=request.user, note=serializer.validated_data["note"])
        return Response(self._customer_response(customer), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        """Udhaar control: correct the khata (+ owes more, − owes less), with a reason."""
        customer = self.get_object()
        serializer = AmountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.adjust_khata(customer, serializer.validated_data["amount"], user=request.user, note=serializer.validated_data["note"])
        return Response(self._customer_response(customer), status=status.HTTP_201_CREATED)


class ReceiptViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Khata payment receipts, for printing; the owner can cancel one entered by mistake."""

    queryset = Payment.objects.filter(kind=Payment.Kind.KHATA).select_related("customer", "created_by")
    serializer_class = ReceiptSerializer
    access = {"retrieve": (PAYMENTS, VIEW_KHATA), "cancel": RETURNS}

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        payment = services.cancel_receipt(self.get_object(), reason=request.data.get("reason", ""), user=request.user)
        return Response(ReceiptSerializer(payment).data)


INVOICE_DETAIL = Invoice.objects.select_related("customer", "created_by", "finalised_by", "cancelled_by").prefetch_related(
    Prefetch(
        "lines",
        queryset=InvoiceLine.objects.select_related("item__product").prefetch_related(
            Prefetch("item__units", queryset=ItemUnit.objects.order_by("factor"))
        ),
    ),
    "payments",
    "credit_notes",
    "lines__returns",
)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Bills. Drafts (and held bills) are saved as the counter works; finalise makes it a numbered bill.
    PUT/PATCH replaces a draft's header and lines.
    """

    http_method_names = ["get", "post", "put", "patch", "delete"]
    access = {
        # Making bills needs the kept-for-later list; finding a bill to return or cancel needs the rest.
        "list": lambda request, view: (
            (BILLING, VIEW_BILLS) if request.query_params.get("status") == "held" else (VIEW_BILLS, RETURNS)
        ),
        "retrieve": (BILLING, VIEW_BILLS, RETURNS),
        **{
            action: BILLING
            for action in ("create", "update", "partial_update", "destroy", "current", "finalise", "quotation", "convert")
        },
        "cancel": RETURNS,
        "returns": RETURNS,
    }

    def get_queryset(self):
        if self.action != "list":
            return INVOICE_DETAIL
        params = self.request.query_params
        queryset = Invoice.objects.select_related("created_by").annotate(line_count=Count("lines"))
        state = params.get("status", "final")
        if state == "quotation":
            queryset = queryset.filter(kind=Invoice.Kind.QUOTATION).order_by("-invoice_date", "-id")
        elif state == "held":
            queryset = queryset.filter(kind=Invoice.Kind.INVOICE, status=Invoice.Status.DRAFT, held=True).order_by("-updated_at")
        elif state in Invoice.Status.values:
            queryset = queryset.filter(kind=Invoice.Kind.INVOICE, status=state).order_by("-finalised_at", "-id")
        else:
            queryset = queryset.exclude(status=Invoice.Status.DRAFT).order_by("-finalised_at", "-id")
        if params.get("date_from"):
            queryset = queryset.filter(invoice_date__gte=params["date_from"])
        if params.get("date_to"):
            queryset = queryset.filter(invoice_date__lte=params["date_to"])
        customer = id_param(params, "customer")
        if customer:
            queryset = queryset.filter(customer_id=customer)
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
        if not request.user.is_owner and invoice.created_by_id != request.user.pk:
            raise PermissionDenied("Only the owner or the person who started it can delete this bill.")
        invoice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False)
    def current(self, request):
        """The bill this user was working on at the counter (not held), to resume after a refresh."""
        invoice = (
            Invoice.objects.filter(
                kind=Invoice.Kind.INVOICE, status=Invoice.Status.DRAFT, held=False, created_by=request.user
            )
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
        invoice = services.cancel(self.get_object(), reason=request.data.get("reason", ""), user=request.user)
        return self._respond(invoice)

    @action(detail=True, methods=["post"])
    def returns(self, request, pk=None):
        """Returns: goods returned against this bill -> credit note. {lines: [{line, quantity}], refund_mode, reason}"""
        serializer = ReturnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        note = services.create_return(
            self.get_object(),
            lines=[(line["line"], line["quantity"]) for line in data["lines"]],
            refund_mode=data["refund_mode"],
            reason=data["reason"],
            user=request.user,
        )
        return Response(CreditNoteSerializer(CREDIT_NOTES.get(pk=note.pk)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def quotation(self, request, pk=None):
        """Save this draft as a numbered quotation."""
        invoice = services.save_as_quotation(self.get_object(), user=request.user)
        return self._respond(invoice)

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        """Start a bill from this quotation; returns the new draft bill."""
        bill = services.quotation_to_bill(self.get_object(), user=request.user)
        return self._respond(bill, status.HTTP_201_CREATED)


CREDIT_NOTES = CreditNote.objects.select_related("invoice", "created_by").prefetch_related("lines__invoice_line")


class CreditNoteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    access = {"list": (RETURNS, VIEW_BILLS), "retrieve": (RETURNS, VIEW_BILLS)}
    queryset = CREDIT_NOTES
    serializer_class = CreditNoteSerializer



class TodaySummary(APIView):
    """
    Today's counter numbers for the home screen and the end-of-day cash handover. Each part is only for
    those allowed to see it: money for "See today's sales and cash", udhaar for "See khata", the
    kept-for-later count for "Make bills".
    """

    access = {"get": OPEN}

    def get(self, request):
        today = timezone.localdate()
        data = {"date": today}
        if can(request, VIEW_SALES):
            bills = Invoice.objects.filter(kind=Invoice.Kind.INVOICE, status=Invoice.Status.FINAL, invoice_date=today)
            totals = bills.aggregate(count=Count("id"), total=Sum("total"))
            money_in = Payment.objects.filter(
                date=today, kind__in=[Payment.Kind.SALE, Payment.Kind.KHATA], cancelled_at__isnull=True
            )
            refunds = Payment.objects.filter(date=today, kind=Payment.Kind.REFUND)
            by_mode = {}
            for mode, label in Payment.Mode.choices:
                received = money_in.filter(mode=mode).aggregate(total=Sum("amount"))["total"] or ZERO
                refunded = refunds.filter(mode=mode).aggregate(total=Sum("amount"))["total"] or ZERO
                if received or refunded:
                    by_mode[mode] = {"label": label, "received": str(received), "refunded": str(refunded), "net": str(received - refunded)}
            data.update(
                bills=totals["count"],
                sales=str(totals["total"] or ZERO),
                returns=str(CreditNote.objects.filter(date=today).aggregate(total=Sum("total"))["total"] or ZERO),
                by_mode=by_mode,
            )
        if can(request, VIEW_KHATA):
            today_bills = Invoice.objects.filter(kind=Invoice.Kind.INVOICE, status=Invoice.Status.FINAL, invoice_date=today)
            khata_in = Payment.objects.filter(date=today, kind=Payment.Kind.KHATA, cancelled_at__isnull=True)
            owing = customers_with_balance().filter(balance_value__gt=0)
            data.update(
                on_khata=str(today_bills.aggregate(total=Sum("credit_amount"))["total"] or ZERO),
                khata_collected=str(khata_in.aggregate(total=Sum("amount"))["total"] or ZERO),
                udhaar_outstanding=str(owing.aggregate(total=Sum("balance_value"))["total"] or ZERO),
                customers_owing=owing.count(),
            )
        if can(request, BILLING):
            data["held_bills"] = Invoice.objects.filter(
                kind=Invoice.Kind.INVOICE, status=Invoice.Status.DRAFT, held=True
            ).count()
        return Response(data)
