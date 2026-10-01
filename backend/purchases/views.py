from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from catalog.serializers import is_owner

from .models import PurchaseBill, Supplier
from .serializers import PurchaseBillListSerializer, PurchaseBillSerializer, SupplierSerializer
from .services import post_bill

ATTACHMENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"}
ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch"]

    def get_queryset(self):
        queryset = Supplier.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(gstin__icontains=search) | Q(phone__icontains=search))
        if self.request.query_params.get("include_inactive") != "1":
            queryset = queryset.filter(is_active=True)
        return queryset


class PurchaseBillViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        queryset = PurchaseBill.objects.select_related("supplier", "created_by", "posted_by")
        if self.action == "list":
            params = self.request.query_params
            queryset = queryset.annotate(line_count=Count("lines")).order_by("-bill_date", "-id")
            if params.get("status"):
                queryset = queryset.filter(status=params["status"])
            if params.get("supplier"):
                queryset = queryset.filter(supplier_id=params["supplier"])
            if params.get("search"):
                queryset = queryset.filter(
                    Q(bill_number__icontains=params["search"]) | Q(supplier__name__icontains=params["search"])
                )
            if params.get("date_from"):
                queryset = queryset.filter(bill_date__gte=params["date_from"])
            if params.get("date_to"):
                queryset = queryset.filter(bill_date__lte=params["date_to"])
        else:
            queryset = queryset.prefetch_related("lines__item__product__brand", "lines__unit")
        return queryset

    def get_serializer_class(self):
        return PurchaseBillListSerializer if self.action == "list" else PurchaseBillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, pk=None):
        bill = self.get_object()
        if bill.status != PurchaseBill.Status.DRAFT:
            raise ValidationError("A posted bill can't be deleted.")
        if not is_owner({"request": request}) and bill.created_by_id != request.user.pk:
            raise PermissionDenied("Only the owner or the person who entered it can delete a draft.")
        bill.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="post")
    def post_bill(self, request, pk=None):
        """Add the bill's goods to stock."""
        post_bill(self.get_object(), request.user)
        return Response(PurchaseBillSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser])
    def attachment(self, request, pk=None):
        """Attach a photo or PDF of the paper bill (field name: file)."""
        bill = self.get_object()
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a photo or PDF of the bill."})
        if upload.content_type not in ATTACHMENT_TYPES:
            raise ValidationError({"file": "Only PDF or photo (JPG, PNG, WebP, HEIC) files."})
        if upload.size > ATTACHMENT_MAX_BYTES:
            raise ValidationError({"file": "File is larger than 10 MB."})
        bill.attachment.save(upload.name, upload, save=True)
        return Response(PurchaseBillSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data)
