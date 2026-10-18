"""
The public website's data (plan §21.4): read-only, no login, rate-limited, and only these fields:
the product's name, brand, category and website description; each variant's MRP, "in stock" yes/no and
pictures; the shop's public details. Never costs, selling prices, stock quantities, barcodes, customers,
bills or staff. Only products ticked "Show on website" exist here.
"""

import re
from datetime import timedelta

from django.db.models import OuterRef, Prefetch, Q, Subquery
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from catalog.models import Item, Product
from core.pagination import StandardPagination
from purchases.models import PurchaseBill, PurchaseLine
from shop.models import ShopSettings

NEW_FOR_DAYS = 30
NEW_LIMIT = 24
IMAGE_NAME = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")
IMAGE_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


class Pages(StandardPagination):
    page_size = 24
    max_page_size = 48


class PublicView(GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # a stray login token is ignored, never checked
    throttle_scope = "public"


def plain(value):
    return format(value.normalize(), "f")


def image_url(field):
    return f"/api/public/images/{field.name.rsplit('/', 1)[-1]}" if field else None


def visible():
    """Products on the website with at least one variant still sold, each with those variants in `live`."""
    live = Item.objects.filter(is_active=True).prefetch_related("units")
    return (
        Product.objects.filter(on_website=True, items__is_active=True)
        .distinct()
        .select_related("brand", "category")
        .prefetch_related(Prefetch("items", queryset=live, to_attr="live"))
    )


def lowest_mrp(product):
    """(MRP, per what) for the card: the lowest loose MRP, or for things sold only in packs (wire coils), the lowest pack MRP."""
    loose = [(item.mrp, item.base_unit) for item in product.live if item.mrp is not None]
    packs = [(unit.mrp, unit.name) for item in product.live for unit in item.units.all() if not unit.is_base and unit.mrp is not None]
    prices = loose or packs
    return min(prices, key=lambda price: price[0]) if prices else (None, None)


def card(product):
    mrp, per = lowest_mrp(product)
    photo = next((item.web_photo for item in product.live if item.web_photo), None)
    return {
        "id": product.pk,
        "name": str(product),
        "brand": product.brand.name if product.brand_id else "",
        "category": product.category.name if product.category_id else "",
        "from_mrp": str(mrp) if mrp is not None else None,
        "mrp_per": per,
        "photo": image_url(photo),
        "tryon": product.tryon_surface or None,
        "variants": len(product.live),
    }


def variant(item, tryon):
    return {
        "id": item.pk,
        "name": item.variant or "Standard",
        "mrp": str(item.mrp) if item.mrp is not None else None,
        "unit": item.base_unit,
        "in_stock": item.stock_qty > 0,
        "photo": image_url(item.web_photo),
        "tryon_image": image_url(item.tryon_image) if tryon else None,
        "packs": [
            {"name": unit.name, "size": plain(unit.factor), "mrp": str(unit.mrp)}
            for unit in item.units.all()
            if not unit.is_base and unit.mrp is not None
        ],
    }


class ShopInfo(PublicView):
    def get(self, request):
        shop = ShopSettings.load()
        return Response({
            "name": shop.name, "phone": shop.phone, "address": shop.address,
            "opening_hours": shop.opening_hours, "gstin": shop.gstin,
        })


class Categories(PublicView):
    def get(self, request):
        counts = {}
        for product in visible():
            if product.category_id:
                key = (product.category_id, product.category.name)
                counts[key] = counts.get(key, 0) + 1
        return Response([{"id": pk, "name": name, "products": n} for (pk, name), n in sorted(counts.items(), key=lambda kv: kv[0][1])])


class Products(PublicView):
    """?category=<id>&brand=<name>&q=<words>, newest first, 24 a page."""

    pagination_class = Pages

    def get(self, request):
        params = request.query_params
        products = visible().order_by("-created_at")
        if params.get("category", "").isdigit():
            products = products.filter(category_id=params["category"])
        if params.get("brand"):
            products = products.filter(brand__name__iexact=params["brand"].strip())
        for word in params.get("q", "").split()[:6]:
            products = products.filter(Q(name__icontains=word) | Q(brand__name__icontains=word) | Q(items__variant__icontains=word))
        page = self.paginate_queryset(products.distinct())
        return self.get_paginated_response([card(product) for product in page])


class ProductDetail(PublicView):
    def get(self, request, pk):
        product = get_object_or_404(visible(), pk=pk)
        tryon = bool(product.tryon_surface)
        return Response({**card(product), "description": product.web_description,
                         "variants": [variant(item, tryon) for item in product.live]})


class NewInStore(PublicView):
    """Products pinned as always new, and those with a Goods Arrived bill in the last 30 days (newest first)."""

    def get(self, request):
        arrived = Subquery(
            PurchaseLine.objects.filter(item__product=OuterRef("pk"), bill__status=PurchaseBill.Status.POSTED)
            .order_by("-bill__posted_at")
            .values("bill__posted_at")[:1]
        )
        since = timezone.now() - timedelta(days=NEW_FOR_DAYS)
        products = (
            visible()
            .exclude(web_new=Product.WebNew.NEVER)
            .annotate(arrived=arrived)
            .filter(Q(web_new=Product.WebNew.ALWAYS) | Q(arrived__gte=since))
            .order_by("-arrived", "-created_at")[:NEW_LIMIT]
        )
        return Response([card(product) for product in products])


class Image(PublicView):
    """A website picture, only while its product is on the website. Names are random and never reused."""

    def get(self, request, name):
        if not IMAGE_NAME.match(name):
            raise Http404
        stored = f"website/{name}"
        item = (
            Item.objects.filter(Q(web_photo=stored) | Q(tryon_image=stored), is_active=True, product__on_website=True)
            .first()
        )
        if item is None:
            raise Http404
        field = item.web_photo if item.web_photo.name == stored else item.tryon_image
        response = FileResponse(field.open("rb"), content_type=IMAGE_TYPES[name.rsplit(".", 1)[-1]])
        response["Cache-Control"] = "public, max-age=2592000, immutable"
        response["X-Content-Type-Options"] = "nosniff"
        return response
