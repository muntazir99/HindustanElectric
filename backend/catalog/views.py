from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Brand, Category, Item, ItemUnit, Product
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ItemSerializer,
    ItemUnitSerializer,
    ItemUpdateSerializer,
    MovementSerializer,
    PackSerializer,
    ProductCreateSerializer,
    ProductSerializer,
    VariantsSerializer,
    is_owner,
)

ITEMS = Item.objects.select_related("product__brand", "product__category").prefetch_related("units")


class CategoryList(generics.ListCreateAPIView):
    queryset = Category.objects.select_related("parent")
    serializer_class = CategorySerializer
    pagination_class = None


class BrandList(generics.ListCreateAPIView):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    pagination_class = None


def filter_items(queryset, params):
    status_filter = params.get("status", "")
    if status_filter == "inactive":
        queryset = queryset.filter(is_active=False)
    elif params.get("include_inactive") != "1":
        queryset = queryset.filter(is_active=True)
    if status_filter == "low":
        queryset = queryset.filter(min_stock__gt=0, stock_qty__lte=F("min_stock"))
    elif status_filter == "not_counted":
        queryset = queryset.filter(counted_at__isnull=True)
    elif status_filter == "needs_recount":
        queryset = queryset.filter(needs_recount=True)
    for word in params.get("search", "").lower().split():
        queryset = queryset.filter(search_text__contains=word)
    if params.get("category"):
        category = params["category"]
        queryset = queryset.filter(Q(product__category_id=category) | Q(product__category__parent_id=category))
    if params.get("brand"):
        queryset = queryset.filter(product__brand_id=params["brand"])
    if params.get("rack"):
        queryset = queryset.filter(rack__iexact=params["rack"])
    ordering = {
        "name": ["product__name", "variant"],
        "rack": ["rack", "product__name", "variant"],
        "stock": ["stock_qty", "product__name"],
        "updated": ["-updated_at"],
    }.get(params.get("ordering", "name"), ["product__name", "variant"])
    return queryset.order_by(*ordering)


def create_variants(product, data):
    pack = data.get("pack")
    items = []
    for variant in data["variants"]:
        items.append(
            services.create_item(
                product,
                variant["variant"],
                data["base_unit"],
                barcode=variant.get("barcode"),
                pack={
                    **pack,
                    "barcode": variant.get("pack_barcode"),
                    "mrp": variant.get("pack_mrp"),
                    "selling_price": variant.get("pack_price"),
                }
                if pack
                else None,
                mrp=variant.get("mrp"),
                selling_price=variant.get("selling_price"),
                rack=variant.get("rack", ""),
                min_stock=variant.get("min_stock"),
                aliases=variant.get("aliases", ""),
            )
        )
    return items


class ItemViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ItemSerializer

    def get_queryset(self):
        if self.action == "list":
            return filter_items(ITEMS, self.request.query_params)
        return ITEMS

    def partial_update(self, request, pk=None):
        item = self.get_object()
        serializer = ItemUpdateSerializer(item, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            if "base_unit" in data:
                services.set_base_unit(item, data.pop("base_unit"))
            if "variant" in data:
                data["variant"] = data["variant"].strip()
                if item.product.items.exclude(pk=item.pk).filter(variant__iexact=data["variant"]).exists():
                    raise services.CatalogError("Another variant of this product already has that name.")
            for field, value in data.items():
                setattr(item, field, value)
            item.save()
        return Response(ItemSerializer(ITEMS.get(pk=item.pk), context={"request": request}).data)

    @action(detail=True)
    def movements(self, request, pk=None):
        item = self.get_object()
        page = self.paginate_queryset(item.movements.select_related("created_by"))
        return self.get_paginated_response(MovementSerializer(page, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def units(self, request, pk=None):
        """Add a pack unit, e.g. {"name": "coil", "factor": 90, "barcode": "...", "selling_price": ...}."""
        item = self.get_object()
        pack = PackSerializer(data=request.data)
        pack.is_valid(raise_exception=True)
        if item.units.filter(name__iexact=pack.validated_data["name"]).exists():
            raise services.CatalogError(f"{item} already has a unit called {pack.validated_data['name']}.")
        prices = {key: request.data.get(key) for key in ("mrp", "selling_price") if request.data.get(key) not in (None, "")}
        if prices and not is_owner({"request": request}):
            raise PermissionDenied("Only the owner can set prices.")
        services.set_pack(
            item,
            pack.validated_data["name"],
            pack.validated_data["factor"],
            barcode=request.data.get("barcode"),
            **prices,
        )
        return Response(ItemSerializer(ITEMS.get(pk=item.pk), context={"request": request}).data, status=201)


class UnitDetail(APIView):
    """Edit or remove one unit. Base units only take a barcode; their prices live on the item."""

    def patch(self, request, pk):
        unit = get_object_or_404(ItemUnit.objects.select_related("item"), pk=pk)
        data = request.data
        if not is_owner({"request": request}) and ({"mrp", "selling_price"} & set(data)):
            raise PermissionDenied("Only the owner can change prices.")
        if unit.is_base and (set(data) - {"barcode"}):
            raise services.CatalogError("For the base unit only the barcode can be changed here.")
        with transaction.atomic():
            if "barcode" in data:
                unit.barcode = services.check_barcode_free(data["barcode"], unit)
            if not unit.is_base:
                serializer = ItemUnitSerializer(unit, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                new_factor = serializer.validated_data.get("factor", unit.factor)
                if new_factor != unit.factor and services.unit_is_used(unit):
                    raise services.CatalogError("Pack size can't change after it has been used on a bill.")
                for field in ("name", "factor", "mrp", "selling_price"):
                    if field in serializer.validated_data:
                        setattr(unit, field, serializer.validated_data[field])
            unit.save()
        return Response(ItemSerializer(ITEMS.get(pk=unit.item_id), context={"request": request}).data)

    def delete(self, request, pk):
        unit = get_object_or_404(ItemUnit, pk=pk)
        if unit.is_base:
            raise services.CatalogError("The base unit can't be removed.")
        if services.unit_is_used(unit):
            raise services.CatalogError("This unit is used on a bill and can't be removed.")
        unit.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemLookup(APIView):
    """Find an item by scanned barcode or typed item code: GET /lookup?code=..."""

    def get(self, request):
        code = request.query_params.get("code", "").strip()
        unit = ItemUnit.objects.filter(barcode=code).first() if code else None
        if unit is None and code:
            item = Item.objects.filter(code__iexact=code).first()
            unit = item.units.get(is_base=True) if item else None
        if unit is None:
            return Response({"detail": f"No item with barcode or code {code}."}, status=404)
        item = ITEMS.get(pk=unit.item_id)
        return Response({"item": ItemSerializer(item, context={"request": request}).data, "unit_id": unit.pk})


class ProductViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Product.objects.select_related("brand", "category")
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        for word in self.request.query_params.get("search", "").split():
            queryset = queryset.filter(Q(name__icontains=word) | Q(brand__name__icontains=word))
        return queryset

    def retrieve(self, request, pk=None):
        product = self.get_object()
        items = ITEMS.filter(product=product)
        return Response(
            {
                **ProductSerializer(product).data,
                "items": ItemSerializer(items, many=True, context={"request": request}).data,
            }
        )

    def create(self, request):
        """A new product and its variants in one go."""
        serializer = ProductCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            brand = services.brand_named(data["brand"])
            existing = services.find_product(data["name"], brand)
            if existing:
                return Response(
                    {"detail": f'"{existing}" already exists. Add the variants to it instead.', "product_id": existing.pk},
                    status=400,
                )
            product = Product(
                name=data["name"].strip(),
                brand=brand,
                category=data.get("category"),
                hsn_code=data["hsn_code"],
                gst_rate=data["gst_rate"],
                description=data["description"],
            )
            product.full_clean()
            product.save()
            items = create_variants(product, data)
        return Response(
            {
                "product": ProductSerializer(product).data,
                "items": ItemSerializer(items, many=True, context={"request": request}).data,
            },
            status=201,
        )

    def partial_update(self, request, pk=None):
        if not is_owner({"request": request}):
            raise PermissionDenied("Only the owner can change product details like HSN and GST.")
        product = self.get_object()
        serializer = ProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def variants(self, request, pk=None):
        product = self.get_object()
        serializer = VariantsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            items = create_variants(product, serializer.validated_data)
        return Response(ItemSerializer(items, many=True, context={"request": request}).data, status=201)
