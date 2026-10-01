from decimal import Decimal

from rest_framework import serializers

from catalog.display import format_quantity
from catalog.models import Item, ItemUnit
from catalog.serializers import is_owner

from .models import Adjustment, StockCount, StockCountLine


class QuantityInUnitSerializer(serializers.Serializer):
    """An item quantity entered in any of its units; converted to base units."""

    item = serializers.PrimaryKeyRelatedField(queryset=Item.objects.all())
    unit = serializers.PrimaryKeyRelatedField(queryset=ItemUnit.objects.all(), required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)

    def validate(self, attrs):
        unit = attrs.get("unit")
        if unit is not None and unit.item_id != attrs["item"].pk:
            raise serializers.ValidationError({"unit": "This unit belongs to a different item."})
        attrs["base_quantity"] = attrs["quantity"] * (unit.factor if unit else Decimal("1"))
        return attrs


class AdjustmentCreateSerializer(QuantityInUnitSerializer):
    reason = serializers.ChoiceField(choices=Adjustment.Reason.choices)
    note = serializers.CharField(max_length=250, required=False, allow_blank=True, default="")


class AdjustmentSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name")
    item_code = serializers.CharField(source="item.code")
    base_unit = serializers.CharField(source="item.base_unit")
    reason_display = serializers.CharField(source="get_reason_display")
    created_by = serializers.CharField(source="created_by.username")

    class Meta:
        model = Adjustment
        fields = [
            "id", "item", "item_name", "item_code", "base_unit", "quantity",
            "reason", "reason_display", "note", "created_by", "created_at",
        ]


class CountLineInputSerializer(QuantityInUnitSerializer):
    mode = serializers.ChoiceField(choices=["add", "set"], default="set")


class StockCountLineSerializer(serializers.ModelSerializer):
    """Staff see only what they counted (a blind count); owners also see the difference."""

    item_name = serializers.CharField(source="item.name")
    item_code = serializers.CharField(source="item.code")
    base_unit = serializers.CharField(source="item.base_unit")
    rack = serializers.CharField(source="item.rack")
    counted_display = serializers.SerializerMethodField()
    difference = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)
    counted_by = serializers.CharField(source="counted_by.username")

    class Meta:
        model = StockCountLine
        fields = [
            "id", "item", "item_name", "item_code", "base_unit", "rack",
            "counted_qty", "counted_display", "system_qty", "difference", "counted_by", "counted_at",
        ]

    def get_counted_display(self, line):
        return format_quantity(line.counted_qty, line.item.base_unit, line.item.units.all())

    def to_representation(self, line):
        data = super().to_representation(line)
        if not is_owner(self.context):
            data.pop("system_qty")
            data.pop("difference")
        return data


class StockCountSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    posted_by = serializers.CharField(source="posted_by.username", read_only=True, default=None)
    line_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockCount
        fields = [
            "id", "title", "note", "status", "status_display", "created_by", "created_at",
            "posted_by", "posted_at", "line_count",
        ]
        read_only_fields = ["status", "created_at", "posted_at"]
