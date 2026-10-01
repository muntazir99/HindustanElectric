from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q, Sum

from catalog.models import GST_RATES, Item, ItemUnit
from shop.models import gstin_validator

state_code_validator = RegexValidator(r"^[0-9]{2}$", "State code is two digits.")
ZERO = Decimal("0")


def money_field(**kwargs):
    kwargs.setdefault("max_digits", 12)
    kwargs.setdefault("decimal_places", 2)
    kwargs.setdefault("default", ZERO)
    return models.DecimalField(**kwargs)


class Customer(models.Model):
    """Someone who buys on khata or wants their name on the bill."""

    class Kind(models.TextChoices):
        RETAIL = "retail", "Retail"
        ELECTRICIAN = "electrician", "Electrician"
        CONTRACTOR = "contractor", "Contractor"
        BUSINESS = "business", "Business"

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=15, blank=True, db_index=True)
    gstin = models.CharField("GSTIN", max_length=15, blank=True, validators=[gstin_validator])
    state_code = models.CharField(max_length=2, default="10", validators=[state_code_validator])
    address = models.TextField(blank=True)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.RETAIL)
    credit_limit = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Most they may owe on khata. Blank = no limit; 0 = no credit.",
    )
    default_discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=ZERO, validators=[MinValueValidator(ZERO)],
        help_text="Applied to every line of their bills, e.g. electricians' discount.",
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.phone})" if self.phone else self.name

    def save(self, *args, **kwargs):
        self.phone = "".join(ch for ch in self.phone if ch.isdigit())[-10:] if self.phone else ""
        self.gstin = self.gstin.strip().upper()
        if self.gstin:
            self.state_code = self.gstin[:2]
        super().save(*args, **kwargs)

    def balance(self):
        """What the customer owes (positive) on khata."""
        totals = self.ledger.aggregate(debit=Sum("debit"), credit=Sum("credit"))
        return (totals["debit"] or ZERO) - (totals["credit"] or ZERO)


class DocumentSeries(models.Model):
    """Last number used in a series, e.g. "invoice/2026" (financial year 2026-27)."""

    key = models.CharField(max_length=30, unique=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = "document series"

    def __str__(self):
        return f"{self.key}: {self.last_number}"


class Invoice(models.Model):
    """
    A sale. Drafts (including held bills) have no number and don't touch stock or khata;
    finalising gives the next number and applies everything at once.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        FINAL = "final", "Final"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=16, unique=True, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    invoice_date = models.DateField(null=True, blank=True)
    held = models.BooleanField(default=False, help_text="Parked at the counter to finish later.")

    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.PROTECT, related_name="invoices")
    buyer_name = models.CharField(max_length=150, blank=True)
    buyer_phone = models.CharField(max_length=15, blank=True)
    buyer_gstin = models.CharField(max_length=15, blank=True)
    buyer_address = models.TextField(blank=True)
    place_of_supply = models.CharField(max_length=2, default="10", validators=[state_code_validator])
    rates_include_tax = models.BooleanField(default=True)
    bill_discount = money_field()

    gross_total = money_field()
    discount_total = money_field()
    taxable_total = money_field()
    cgst_total = money_field()
    sgst_total = money_field()
    igst_total = money_field()
    round_off = money_field(max_digits=6)
    total = money_field()
    paid_amount = money_field(help_text="Paid at the counter.")
    credit_amount = money_field(help_text="Put on the customer's khata.")

    note = models.CharField(max_length=250, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finalised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    finalised_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=250, blank=True)

    class Meta:
        ordering = ["-finalised_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(status="draft") | Q(number__isnull=False), name="invoice_final_has_number"
            ),
        ]

    def __str__(self):
        return self.number or f"Draft #{self.pk}"

    @property
    def same_state(self):
        from shop.models import ShopSettings

        return self.place_of_supply == ShopSettings.load().state_code


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    position = models.PositiveSmallIntegerField(default=0)
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    unit = models.ForeignKey(ItemUnit, on_delete=models.PROTECT, related_name="+")
    # Snapshots: the bill must read the same even if the item is renamed later.
    description = models.CharField(max_length=250)
    unit_name = models.CharField(max_length=20)
    hsn_code = models.CharField(max_length=8, blank=True)

    quantity = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    base_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    rate = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(ZERO)])
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO)
    gst_rate = models.DecimalField(max_digits=4, decimal_places=2, choices=GST_RATES)

    gross = money_field()
    discount = money_field(help_text="Line discount plus its share of the bill discount.")
    taxable_value = money_field()
    cgst = money_field()
    sgst = money_field()
    igst = money_field()
    total = money_field()
    cost_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, help_text="Average cost of the goods when sold."
    )

    class Meta:
        ordering = ["position", "id"]


class Payment(models.Model):
    """Money in (at the counter or against khata) or out (refunds)."""

    class Mode(models.TextChoices):
        CASH = "cash", "Cash"
        UPI = "upi", "UPI"
        CARD = "card", "Card"
        BANK = "bank", "Bank transfer"
        CHEQUE = "cheque", "Cheque"

    class Kind(models.TextChoices):
        SALE = "sale", "Paid with bill"
        KHATA = "khata", "Khata payment"
        REFUND = "refund", "Refund"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    mode = models.CharField(max_length=10, choices=Mode.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    date = models.DateField()
    receipt_number = models.CharField(max_length=16, unique=True, null=True, blank=True)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    reference = models.CharField(max_length=60, blank=True, help_text="UPI reference, cheque number…")
    note = models.CharField(max_length=250, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    # A khata receipt entered by mistake is cancelled (never deleted) and left out of cash totals.
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=250, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} {self.get_mode_display()} ₹{self.amount}"


class LedgerEntry(models.Model):
    """One line of a customer's khata. Never edited or deleted; balance = debits − credits."""

    class Kind(models.TextChoices):
        OPENING = "opening", "Opening balance"
        BILL = "bill", "Bill"
        PAYMENT = "payment", "Payment"
        BILL_CANCELLED = "bill_cancelled", "Bill cancelled"
        REFUND = "refund", "Payment returned"
        RETURN = "return", "Goods returned"
        RECEIPT_CANCELLED = "receipt_cancelled", "Receipt cancelled"
        ADJUSTMENT = "adjustment", "Adjustment"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="ledger")
    date = models.DateField()
    kind = models.CharField(max_length=20, choices=Kind.choices)
    debit = money_field(help_text="Customer owes more.")
    credit = money_field(help_text="Customer owes less.")
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    payment = models.ForeignKey(Payment, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    note = models.CharField(max_length=250, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "id"]
        verbose_name_plural = "ledger entries"
        constraints = [
            models.CheckConstraint(
                condition=(Q(debit__gt=0) & Q(credit=0)) | (Q(debit=0) & Q(credit__gt=0)),
                name="ledger_entry_one_side",
            ),
        ]

    def __str__(self):
        return f"{self.customer} {self.get_kind_display()} {self.debit or -self.credit}"
