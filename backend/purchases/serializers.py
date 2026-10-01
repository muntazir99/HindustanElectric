from django.db import transaction
from rest_framework import serializers

from catalog.models import Item, ItemUnit
from core.fields import GstRateField

from .models import PurchaseBill, PurchaseLine, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "gstin", "address", "is_active"]

    def validate_name(self, name):
        name = name.strip()
        clash = Supplier.objects.filter(name__iexact=name)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("A supplier with this name already exists.")
        return name


class PurchaseLineSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(queryset=Item.objects.select_related("product"))
    unit = serializers.PrimaryKeyRelatedField(queryset=ItemUnit.objects.all())
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    base_unit = serializers.CharField(source="item.base_unit", read_only=True)
    unit_name = serializers.CharField(source="unit.name", read_only=True)
    unit_factor = serializers.DecimalField(source="unit.factor", max_digits=12, decimal_places=3, read_only=True)
    item_units = serializers.SerializerMethodField()
    gst_rate = GstRateField(required=False)

    class Meta:
        model = PurchaseLine
        fields = [
            "id", "item", "item_name", "item_code", "base_unit", "item_units", "unit", "unit_name", "unit_factor",
            "quantity", "rate", "discount_percent", "gst_rate", "taxable_amount", "tax_amount",
        ]

    def get_item_units(self, line):
        """The item's units, so a draft can be edited without fetching each item."""
        return [
            {"id": unit.id, "name": unit.name, "factor": str(unit.factor), "is_base": unit.is_base}
            for unit in line.item.units.all()
        ]
        read_only_fields = ["taxable_amount", "tax_amount"]

    def validate(self, attrs):
        if attrs["unit"].item_id != attrs["item"].pk:
            raise serializers.ValidationError({"unit": "This unit belongs to a different item."})
        attrs.setdefault("gst_rate", attrs["item"].product.gst_rate)
        return attrs


class PurchaseBillSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    posted_by = serializers.CharField(source="posted_by.username", read_only=True, default=None)
    lines = PurchaseLineSerializer(many=True, required=False)
    # Only whether there is one: the file itself comes from GET .../attachment, for logged-in users.
    has_attachment = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseBill
        fields = [
            "id", "supplier", "supplier_name", "bill_number", "bill_date", "status", "status_display",
            "has_attachment", "notes", "round_off", "taxable_total", "tax_total", "total",
            "created_by", "created_at", "posted_by", "posted_at", "lines",
        ]
        read_only_fields = ["status", "taxable_total", "tax_total", "total", "created_at", "posted_at"]

    def get_has_attachment(self, bill):
        return bool(bill.attachment)

    def validate(self, attrs):
        if self.instance and self.instance.status != PurchaseBill.Status.DRAFT:
            raise serializers.ValidationError("A posted bill can't be changed.")
        supplier = attrs.get("supplier", getattr(self.instance, "supplier", None))
        number = attrs.get("bill_number", getattr(self.instance, "bill_number", "")).strip()
        attrs["bill_number"] = number
        existing = PurchaseBill.objects.filter(supplier=supplier, bill_number__iexact=number)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        existing = existing.first()
        if existing:
            raise serializers.ValidationError(
                {
                    "bill_number": f"Bill {number} from {supplier} was already entered "
                    f"(dated {existing.bill_date:%d %b %Y}, {existing.get_status_display().lower()})."
                }
            )
        return attrs

    def _save_lines(self, bill, lines):
        bill.lines.all().delete()
        for line in lines:
            PurchaseLine.objects.create(bill=bill, **line)
        bill.recalculate()
        bill.save()

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        bill = PurchaseBill.objects.create(**validated_data)
        self._save_lines(bill, lines)
        return bill

    @transaction.atomic
    def update(self, bill, validated_data):
        lines = validated_data.pop("lines", None)
        for field, value in validated_data.items():
            setattr(bill, field, value)
        bill.save()
        if lines is not None:
            self._save_lines(bill, lines)
        else:
            bill.recalculate()
            bill.save()
        return bill


class PurchaseBillListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name")
    status_display = serializers.CharField(source="get_status_display")
    line_count = serializers.IntegerField()
    has_attachment = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseBill
        fields = [
            "id", "supplier", "supplier_name", "bill_number", "bill_date", "status", "status_display",
            "total", "line_count", "has_attachment", "created_at",
        ]

    def get_has_attachment(self, bill):
        return bool(bill.attachment)
