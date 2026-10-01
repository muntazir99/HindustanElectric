from decimal import Decimal

from rest_framework import serializers

from core.fields import GstRateField

from .display import format_quantity
from .models import BaseUnit, Brand, Category, Item, ItemUnit, Product


def is_owner(context):
    request = context.get("request")
    return bool(request and request.user.is_authenticated and request.user.is_owner)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "parent"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name"]


class ItemUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemUnit
        fields = ["id", "name", "factor", "barcode", "mrp", "selling_price", "is_base"]
        read_only_fields = ["is_base"]


class ItemSerializer(serializers.ModelSerializer):
    """Read view of an item. Cost is only included for owners."""

    name = serializers.CharField(read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    brand = serializers.CharField(source="product.brand.name", read_only=True, default="")
    category = serializers.CharField(source="product.category.name", read_only=True, default="")
    category_id = serializers.IntegerField(source="product.category_id", read_only=True)
    hsn_code = serializers.CharField(source="product.hsn_code", read_only=True)
    gst_rate = serializers.DecimalField(source="product.gst_rate", max_digits=4, decimal_places=2, read_only=True)
    units = ItemUnitSerializer(many=True, read_only=True)
    stock_display = serializers.SerializerMethodField()
    is_low = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            "id", "code", "name", "product", "product_name", "brand", "category", "category_id", "variant",
            "hsn_code", "gst_rate", "base_unit", "mrp", "selling_price", "cost_price",
            "stock_qty", "stock_display", "min_stock", "is_low", "rack", "aliases",
            "is_active", "counted_at", "needs_recount", "units",
        ]

    def get_stock_display(self, item):
        return format_quantity(item.stock_qty, item.base_unit, item.units.all())

    def get_is_low(self, item):
        # Uncounted items read 0, which says nothing about the shelf.
        return item.counted_at is not None and item.min_stock > 0 and item.stock_qty <= item.min_stock

    def to_representation(self, item):
        data = super().to_representation(item)
        if not is_owner(self.context):
            data.pop("cost_price")
        return data


class ItemUpdateSerializer(serializers.ModelSerializer):
    """Fields that can be edited on an existing item. Prices and deactivation are owner-only."""

    OWNER_ONLY = {"mrp", "selling_price", "is_active"}

    class Meta:
        model = Item
        fields = ["variant", "base_unit", "mrp", "selling_price", "min_stock", "rack", "aliases", "is_active"]

    def validate(self, attrs):
        if not is_owner(self.context):
            blocked = self.OWNER_ONLY & set(attrs)
            if blocked:
                raise serializers.ValidationError(
                    {field: "Only the owner can change this." for field in blocked}
                )
        return attrs


class PackSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=20)
    factor = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))


class VariantSerializer(serializers.Serializer):
    variant = serializers.CharField(max_length=120, allow_blank=True, default="")
    mrp = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    selling_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    barcode = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    pack_barcode = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    pack_mrp = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    pack_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    rack = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    min_stock = serializers.DecimalField(max_digits=12, decimal_places=3, required=False, default=Decimal("0"))
    aliases = serializers.CharField(max_length=250, required=False, allow_blank=True, default="")


class VariantsSerializer(serializers.Serializer):
    """Variants to add to a product, all sharing one base unit and (optionally) one pack size."""

    base_unit = serializers.ChoiceField(choices=BaseUnit.choices)
    pack = PackSerializer(required=False, allow_null=True)
    variants = VariantSerializer(many=True, allow_empty=False)

    def validate_variants(self, variants):
        names = [v["variant"].strip().lower() for v in variants]
        if len(names) != len(set(names)):
            raise serializers.ValidationError("The same variant is listed twice.")
        return variants


class ProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True, default="")
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    gst_rate = GstRateField(required=False)

    class Meta:
        model = Product
        fields = ["id", "name", "brand", "brand_name", "category", "category_name", "hsn_code", "gst_rate", "description"]


class ProductCreateSerializer(VariantsSerializer):
    """A new product with its variants in one request. Brand is given by name and created if new."""

    name = serializers.CharField(max_length=150)
    brand = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)
    hsn_code = serializers.RegexField(r"^(\d{4}|\d{6}|\d{8})?$", required=False, allow_blank=True, default="")
    gst_rate = GstRateField(default=Decimal("18"))
    description = serializers.CharField(required=False, allow_blank=True, default="")


class MovementSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    kind = serializers.CharField()
    kind_display = serializers.CharField(source="get_kind_display")
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    balance_after = serializers.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=4, allow_null=True)
    note = serializers.CharField()
    created_by = serializers.CharField(source="created_by.username")

    def to_representation(self, movement):
        data = super().to_representation(movement)
        if not is_owner(self.context):
            data.pop("unit_cost")
        return data
