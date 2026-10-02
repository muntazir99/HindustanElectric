from decimal import Decimal

from django.db.models import Count, F, Sum
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.access import COUNT_STOCK, FIX_STOCK, SEE_COSTS
from accounts.permissions import OPEN, can
from catalog.models import Item

from . import services
from .models import Adjustment, StockCount, StockCountLine
from .serializers import (
    AdjustmentCreateSerializer,
    AdjustmentSerializer,
    CountLineInputSerializer,
    StockCountLineSerializer,
    StockCountSerializer,
)


class AdjustmentViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Manual stock corrections: "Fix stock"."""

    access = {"list": FIX_STOCK, "create": FIX_STOCK}
    queryset = Adjustment.objects.select_related("item__product__brand", "created_by")
    serializer_class = AdjustmentSerializer

    def create(self, request):
        serializer = AdjustmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        adjustment = services.create_adjustment(
            data["item"].pk, data["base_quantity"], data["reason"], request.user, note=data["note"]
        )
        return Response(AdjustmentSerializer(adjustment).data, status=status.HTTP_201_CREATED)


COUNT_LINES = StockCountLine.objects.select_related("item__product__brand", "counted_by").prefetch_related(
    "item__units"
)


class StockCountViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Counters count; "Fix stock" sees the differences and saves or cancels a count."""

    access = {
        **{action: (COUNT_STOCK, FIX_STOCK) for action in ("list", "retrieve", "create", "lines", "remove_line")},
        "post_count": FIX_STOCK,
        "cancel": FIX_STOCK,
    }

    queryset = StockCount.objects.select_related("created_by", "posted_by").annotate(line_count=Count("lines")).order_by("-created_at")
    serializer_class = StockCountSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def retrieve(self, request, pk=None):
        count = self.get_object()
        lines = COUNT_LINES.filter(count=count)
        return Response(
            {
                **StockCountSerializer(count).data,
                "lines": StockCountLineSerializer(lines, many=True, context={"request": request}).data,
            }
        )

    @action(detail=True, methods=["post"])
    def lines(self, request, pk=None):
        """Record a counted quantity: {item, unit?, quantity, mode: "add" | "set"}."""
        count = self.get_object()
        serializer = CountLineInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        line = services.count_item(
            count, data["item"].pk, data["base_quantity"], request.user, add=data["mode"] == "add"
        )
        return Response(StockCountLineSerializer(COUNT_LINES.get(pk=line.pk), context={"request": request}).data)

    @action(detail=True, methods=["delete"], url_path=r"lines/(?P<line_id>\d+)")
    def remove_line(self, request, pk=None, line_id=None):
        count = self.get_object()
        if count.status != StockCount.Status.OPEN:
            raise services.StockError("This count is already closed.")
        get_object_or_404(StockCountLine, pk=line_id, count=count).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="post")
    def post_count(self, request, pk=None):
        services.post_count(self.get_object(), request.user)
        return self.retrieve(request, pk)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        services.cancel_count(self.get_object())
        return self.retrieve(request, pk)


class StockSummary(APIView):
    """Numbers for the home screen."""

    access = {"get": OPEN}

    def get(self, request):
        from purchases.models import PurchaseBill

        active = Item.objects.filter(is_active=True)
        data = {
            "active_items": active.count(),
            "not_counted": active.filter(counted_at__isnull=True).count(),
            "needs_recount": active.filter(needs_recount=True).count(),
            "low_stock": active.filter(
                counted_at__isnull=False, min_stock__gt=0, stock_qty__lte=F("min_stock")
            ).count(),
            "open_counts": StockCount.objects.filter(status=StockCount.Status.OPEN).count(),
            "draft_bills": PurchaseBill.objects.filter(status=PurchaseBill.Status.DRAFT).count(),
        }
        if can(request, SEE_COSTS):
            value = active.filter(stock_qty__gt=0, cost_price__isnull=False).aggregate(
                total=Sum(F("stock_qty") * F("cost_price"))
            )["total"]
            data["stock_value"] = str((value or Decimal("0")).quantize(Decimal("0.01")))
        return Response(data)
