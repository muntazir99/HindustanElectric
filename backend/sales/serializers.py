from collections import defaultdict
from decimal import Decimal

from django.db import models
from rest_framework import serializers

from catalog.display import format_quantity
from catalog.models import Item, ItemUnit
from catalog.serializers import is_owner
from core.fields import GstRateField

from .models import CreditNote, CreditNoteLine, Customer, Invoice, InvoiceLine, Payment
from .states import STATES, state_label
from .words import rupees_in_words

ZERO = Decimal("0")


class CustomerSerializer(serializers.ModelSerializer):
    """Staff can add and edit customers; credit limit and discount are the owner's call."""

    OWNER_ONLY = {"credit_limit", "default_discount_percent"}
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id", "name", "phone", "gstin", "state_code", "address", "kind",
            "credit_limit", "default_discount_percent", "notes", "is_active", "balance",
        ]

    def get_balance(self, customer):
        value = getattr(customer, "balance_value", None)
        return str(value if value is not None else customer.balance())

    def validate(self, attrs):
        if not is_owner(self.context):
            blocked = self.OWNER_ONLY & set(self.initial_data)
            if blocked:
                raise serializers.ValidationError({field: "Only the owner can set this." for field in blocked})
        return attrs


class CustomerBriefSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "gstin", "kind", "credit_limit", "default_discount_percent", "balance"]

    def get_balance(self, customer):
        return str(customer.balance())


class LineInputSerializer(serializers.Serializer):
    """A bill line as the counter sends it. Blank rate/discount/GST = use the item's defaults."""

    item = serializers.PrimaryKeyRelatedField(queryset=Item.objects.select_related("product__brand"))
    unit = serializers.PrimaryKeyRelatedField(queryset=ItemUnit.objects.all())
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    rate = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=ZERO, required=False, allow_null=True)
    discount_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=ZERO, max_value=Decimal("100"), required=False, allow_null=True
    )
    gst_rate = GstRateField(required=False, allow_null=True)


class InvoiceInputSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), required=False, allow_null=True)
    buyer_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    buyer_phone = serializers.CharField(max_length=15, required=False, allow_blank=True, default="")
    buyer_gstin = serializers.CharField(max_length=15, required=False, allow_blank=True, default="")
    buyer_address = serializers.CharField(required=False, allow_blank=True, default="")
    place_of_supply = serializers.ChoiceField(choices=sorted(STATES), required=False, default="10")
    rates_include_tax = serializers.BooleanField(required=False, default=True)
    bill_discount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=ZERO, required=False, default=ZERO)
    note = serializers.CharField(max_length=250, required=False, allow_blank=True, default="")
    held = serializers.BooleanField(required=False, default=False)
    lines = LineInputSerializer(many=True, required=False, default=list)


class PaymentInputSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=Payment.Mode.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))


class FinaliseSerializer(serializers.Serializer):
    payments = PaymentInputSerializer(many=True, required=False, default=list)


class InvoiceLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    base_unit = serializers.CharField(source="item.base_unit", read_only=True)
    item_units = serializers.SerializerMethodField()
    item_stock = serializers.SerializerMethodField()
    below_cost = serializers.SerializerMethodField()
    returned_quantity = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceLine
        fields = [
            "id", "position", "item", "item_code", "unit", "description", "unit_name", "hsn_code", "base_unit",
            "item_units", "item_stock", "quantity", "base_quantity", "rate", "discount_percent", "gst_rate",
            "gross", "discount", "taxable_value", "cgst", "sgst", "igst", "total", "below_cost", "returned_quantity",
        ]

    def get_returned_quantity(self, line):
        if line.invoice.status == Invoice.Status.DRAFT:
            return "0"
        return str(sum((r.quantity for r in line.returns.all()), ZERO))

    def get_item_units(self, line):
        return [
            {"id": unit.id, "name": unit.name, "factor": str(unit.factor), "is_base": unit.is_base}
            for unit in line.item.units.all()
        ]

    def get_item_stock(self, line):
        item = line.item
        return {
            "qty": str(item.stock_qty),
            "display": format_quantity(item.stock_qty, item.base_unit, item.units.all()),
            "counted": item.counted_at is not None,
        }

    def get_below_cost(self, line):
        """Flag (never the cost itself) so the counter can warn before finalising."""
        cost = line.item.cost_price
        if line.invoice.status != Invoice.Status.DRAFT or cost is None or line.base_quantity <= 0:
            return False
        return line.taxable_value / line.base_quantity < cost


class PaymentSerializer(serializers.ModelSerializer):
    mode_display = serializers.CharField(source="get_mode_display")
    kind_display = serializers.CharField(source="get_kind_display")

    class Meta:
        model = Payment
        fields = ["id", "kind", "kind_display", "mode", "mode_display", "amount", "date", "receipt_number", "reference"]


def tax_summary(lines):
    """GST by rate, summed from the saved lines (never recalculated)."""
    by_rate = defaultdict(lambda: {"taxable": ZERO, "cgst": ZERO, "sgst": ZERO, "igst": ZERO})
    for line in lines:
        row = by_rate[line.gst_rate]
        row["taxable"] += line.taxable_value
        row["cgst"] += line.cgst
        row["sgst"] += line.sgst
        row["igst"] += line.igst
    return [
        {"rate": str(rate), **{key: str(value) for key, value in row.items()},
         "tax": str(row["cgst"] + row["sgst"] + row["igst"])}
        for rate, row in sorted(by_rate.items())
    ]


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_detail = serializers.SerializerMethodField()
    tax_summary = serializers.SerializerMethodField()
    amount_in_words = serializers.SerializerMethodField()
    place_of_supply_label = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    finalised_by = serializers.CharField(source="finalised_by.username", read_only=True, default=None)
    cancelled_by = serializers.CharField(source="cancelled_by.username", read_only=True, default=None)
    converted_to_number = serializers.CharField(source="converted_to.number", read_only=True, default=None)
    credit_notes = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "number", "kind", "valid_until", "converted_to", "converted_to_number", "credit_notes",
            "status", "status_display", "invoice_date", "held",
            "customer", "customer_detail", "buyer_name", "buyer_phone", "buyer_gstin", "buyer_address",
            "place_of_supply", "place_of_supply_label", "rates_include_tax", "bill_discount",
            "gross_total", "discount_total", "taxable_total", "cgst_total", "sgst_total", "igst_total",
            "round_off", "total", "paid_amount", "credit_amount", "note",
            "lines", "payments", "tax_summary", "amount_in_words",
            "created_by", "created_at", "updated_at", "finalised_by", "finalised_at",
            "cancelled_by", "cancelled_at", "cancel_reason",
        ]

    def get_customer_detail(self, invoice):
        return CustomerBriefSerializer(invoice.customer).data if invoice.customer else None

    def get_credit_notes(self, invoice):
        return [
            {"id": note.id, "number": note.number, "date": note.date, "total": str(note.total)}
            for note in invoice.credit_notes.all()
        ]

    def get_tax_summary(self, invoice):
        return tax_summary(invoice.lines.all())

    def get_amount_in_words(self, invoice):
        return rupees_in_words(invoice.total)

    def get_place_of_supply_label(self, invoice):
        return state_label(invoice.place_of_supply)


class InvoiceListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display")
    line_count = serializers.IntegerField()
    created_by = serializers.CharField(source="created_by.username")

    class Meta:
        model = Invoice
        fields = [
            "id", "number", "kind", "valid_until", "converted_to", "status", "status_display", "held", "invoice_date",
            "buyer_name", "buyer_phone", "customer", "total", "paid_amount", "credit_amount", "line_count",
            "created_by", "created_at", "updated_at", "finalised_at",
        ]


class LedgerLineSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="entry.id")
    date = serializers.DateField(source="entry.date")
    kind = serializers.CharField(source="entry.kind")
    kind_display = serializers.CharField(source="entry.get_kind_display")
    debit = serializers.DecimalField(source="entry.debit", max_digits=12, decimal_places=2)
    credit = serializers.DecimalField(source="entry.credit", max_digits=12, decimal_places=2)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(source="entry.note")
    invoice = serializers.IntegerField(source="entry.invoice_id", allow_null=True)
    invoice_number = serializers.CharField(source="entry.invoice.number", default=None)
    payment = serializers.IntegerField(source="entry.payment_id", allow_null=True)
    receipt_number = serializers.CharField(source="entry.payment.receipt_number", default=None)
    receipt_cancelled = serializers.SerializerMethodField()

    def get_receipt_cancelled(self, line):
        payment = line["entry"].payment
        return bool(payment and payment.cancelled_at)


class AmountSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(max_length=250, required=False, allow_blank=True, default="")


class ReceivePaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    mode = serializers.ChoiceField(choices=Payment.Mode.choices, default=Payment.Mode.CASH)
    reference = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    note = serializers.CharField(max_length=250, required=False, allow_blank=True, default="")


class ReceiptSerializer(serializers.ModelSerializer):
    """A khata payment, for printing a receipt."""

    mode_display = serializers.CharField(source="get_mode_display")
    customer_detail = serializers.SerializerMethodField()
    amount_in_words = serializers.SerializerMethodField()
    balance_after = serializers.SerializerMethodField()
    created_by = serializers.CharField(source="created_by.username")

    class Meta:
        model = Payment
        fields = [
            "id", "kind", "receipt_number", "date", "amount", "mode", "mode_display", "reference", "note",
            "customer", "customer_detail", "amount_in_words", "balance_after", "created_by", "created_at",
            "cancelled_at", "cancel_reason",
        ]

    def get_customer_detail(self, payment):
        customer = payment.customer
        if customer is None:
            return None
        return {"id": customer.id, "name": customer.name, "phone": customer.phone, "address": customer.address}

    def get_amount_in_words(self, payment):
        return rupees_in_words(payment.amount)

    def get_balance_after(self, payment):
        """What the customer still owed right after this payment."""
        if payment.customer is None:
            return None
        entry = payment.customer.ledger.filter(payment=payment).first()
        if entry is None:
            return None
        totals = payment.customer.ledger.filter(id__lte=entry.id).aggregate(
            debit=models.Sum("debit"), credit=models.Sum("credit")
        )
        return str((totals["debit"] or ZERO) - (totals["credit"] or ZERO))


class ReturnLineInputSerializer(serializers.Serializer):
    line = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=ZERO)


class ReturnInputSerializer(serializers.Serializer):
    lines = ReturnLineInputSerializer(many=True)
    refund_mode = serializers.ChoiceField(choices=CreditNote.Refund.choices)
    reason = serializers.CharField(max_length=250)


class CreditNoteLineSerializer(serializers.ModelSerializer):
    description = serializers.CharField(source="invoice_line.description")
    hsn_code = serializers.CharField(source="invoice_line.hsn_code")
    unit_name = serializers.CharField(source="invoice_line.unit_name")
    rate = serializers.DecimalField(source="invoice_line.rate", max_digits=12, decimal_places=2)
    gst_rate = serializers.DecimalField(source="invoice_line.gst_rate", max_digits=4, decimal_places=2)
    item = serializers.IntegerField(source="invoice_line.item_id")

    class Meta:
        model = CreditNoteLine
        fields = [
            "id", "item", "description", "hsn_code", "unit_name", "quantity", "rate", "gst_rate",
            "taxable_value", "cgst", "sgst", "igst", "total",
        ]


class CreditNoteSerializer(serializers.ModelSerializer):
    lines = CreditNoteLineSerializer(many=True)
    invoice_number = serializers.CharField(source="invoice.number")
    invoice_date = serializers.DateField(source="invoice.invoice_date")
    buyer_name = serializers.CharField(source="invoice.buyer_name")
    buyer_phone = serializers.CharField(source="invoice.buyer_phone")
    buyer_gstin = serializers.CharField(source="invoice.buyer_gstin")
    buyer_address = serializers.CharField(source="invoice.buyer_address")
    place_of_supply_label = serializers.SerializerMethodField()
    refund_mode_display = serializers.CharField(source="get_refund_mode_display")
    tax_summary = serializers.SerializerMethodField()
    amount_in_words = serializers.SerializerMethodField()
    created_by = serializers.CharField(source="created_by.username")

    class Meta:
        model = CreditNote
        fields = [
            "id", "number", "date", "invoice", "invoice_number", "invoice_date", "customer",
            "buyer_name", "buyer_phone", "buyer_gstin", "buyer_address", "place_of_supply_label",
            "reason", "refund_mode", "refund_mode_display", "taxable_total", "cgst_total", "sgst_total",
            "igst_total", "round_off", "total", "lines", "tax_summary", "amount_in_words", "created_by", "created_at",
        ]

    def get_place_of_supply_label(self, note):
        return state_label(note.invoice.place_of_supply)

    def get_tax_summary(self, note):
        rows = defaultdict(lambda: {"taxable": ZERO, "cgst": ZERO, "sgst": ZERO, "igst": ZERO})
        for line in note.lines.all():
            row = rows[line.invoice_line.gst_rate]
            row["taxable"] += line.taxable_value
            row["cgst"] += line.cgst
            row["sgst"] += line.sgst
            row["igst"] += line.igst
        return [
            {"rate": str(rate), **{k: str(v) for k, v in row.items()}, "tax": str(row["cgst"] + row["sgst"] + row["igst"])}
            for rate, row in sorted(rows.items())
        ]

    def get_amount_in_words(self, note):
        return rupees_in_words(note.total)
