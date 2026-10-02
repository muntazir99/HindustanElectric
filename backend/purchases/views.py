import uuid
from pathlib import Path

from django.db.models import Count, Q
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from accounts.access import PURCHASES
from core.params import id_param

from .models import PurchaseBill, Supplier
from .serializers import PurchaseBillListSerializer, PurchaseBillSerializer, SupplierSerializer
from .services import post_bill

ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
# What each kind of file is served as. Anything else is offered as a download, never shown in the browser.
ATTACHMENT_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",  # older uploads kept their own names
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
}
HEIC_BRANDS = {b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"}


def attachment_kind(upload):
    """The file's real type from its first bytes (".pdf", ".jpg"...), or None. The browser's label is not trusted."""
    head = upload.read(16)
    upload.seek(0)
    if head.startswith(b"%PDF-"):
        return ".pdf"
    if head.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp"
    if head[4:8] == b"ftyp" and head[8:12] in HEIC_BRANDS:
        return ".heic"
    return None


ALL_PURCHASE_ACTIONS = ("list", "retrieve", "create", "partial_update", "destroy", "post_bill", "attachment")


class SupplierViewSet(viewsets.ModelViewSet):
    access = {action: PURCHASES for action in ALL_PURCHASE_ACTIONS}
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
    access = {action: PURCHASES for action in ALL_PURCHASE_ACTIONS}
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        queryset = PurchaseBill.objects.select_related("supplier", "created_by", "posted_by")
        if self.action == "list":
            params = self.request.query_params
            queryset = queryset.annotate(line_count=Count("lines")).order_by("-bill_date", "-id")
            if params.get("status"):
                queryset = queryset.filter(status=params["status"])
            supplier = id_param(params, "supplier")
            if supplier:
                queryset = queryset.filter(supplier_id=supplier)
            if params.get("search"):
                queryset = queryset.filter(
                    Q(bill_number__icontains=params["search"]) | Q(supplier__name__icontains=params["search"])
                )
            if params.get("date_from"):
                queryset = queryset.filter(bill_date__gte=params["date_from"])
            if params.get("date_to"):
                queryset = queryset.filter(bill_date__lte=params["date_to"])
        else:
            queryset = queryset.prefetch_related("lines__item__product__brand", "lines__item__units", "lines__unit")
        return queryset

    def get_serializer_class(self):
        return PurchaseBillListSerializer if self.action == "list" else PurchaseBillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, pk=None):
        bill = self.get_object()
        if bill.status != PurchaseBill.Status.DRAFT:
            raise ValidationError("A posted bill can't be deleted.")
        if not request.user.is_owner and bill.created_by_id != request.user.pk:
            raise PermissionDenied("Only the owner or the person who entered it can delete a draft.")
        bill.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="post")
    def post_bill(self, request, pk=None):
        """Add the bill's goods to stock."""
        post_bill(self.get_object(), request.user)
        return Response(PurchaseBillSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser])
    def attachment(self, request, pk=None):
        """
        GET: the photo or PDF of the paper bill, for logged-in users only.
        POST: attach one (field name: file). It is checked by its contents and stored under a random name.
        """
        bill = self.get_object()
        if request.method == "GET":
            if not bill.attachment:
                raise NotFound("No photo is attached to this bill.")
            ext = Path(bill.attachment.name).suffix.lower()
            content_type = ATTACHMENT_CONTENT_TYPES.get(ext)
            return FileResponse(
                bill.attachment.open("rb"),
                content_type=content_type or "application/octet-stream",
                as_attachment=content_type is None,
                filename=f"bill-{bill.pk}{ext}",
            )
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a photo or PDF of the bill."})
        if upload.size > ATTACHMENT_MAX_BYTES:
            raise ValidationError({"file": "File is larger than 10 MB."})
        kind = attachment_kind(upload)
        if kind is None:
            raise ValidationError({"file": "Only PDF or photo (JPG, PNG, WebP, HEIC) files."})
        if bill.attachment:
            bill.attachment.delete(save=False)  # replacing the photo: don't leave the old file behind
        bill.attachment.save(f"{uuid.uuid4().hex}{kind}", upload, save=True)
        return Response(PurchaseBillSerializer(self.get_queryset().get(pk=pk), context={"request": request}).data)
