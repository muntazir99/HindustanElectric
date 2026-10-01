from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Lower

from catalog.models import GST_RATES, Item, ItemUnit
from core.numbers import money
from shop.models import gstin_validator


class Supplier(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    gstin = models.CharField("GSTIN", max_length=15, blank=True, validators=[gstin_validator])
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(Lower("name"), name="supplier_name_unique")]

    def __str__(self):
        return self.name


class PurchaseBill(models.Model):
    """
    A distributor's bill for goods received. Drafts can be edited freely;
    posting adds the goods to stock and cannot be undone except by adjustment.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        POSTED = "posted", "Posted"

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="bills")
    bill_number = models.CharField(max_length=40)
    bill_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    attachment = models.FileField(upload_to="purchase-bills/%Y/%m/", blank=True)
    notes = models.TextField(blank=True)

    taxable_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    round_off = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("0"), help_text="As printed on the bill, e.g. -0.40"
    )
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-bill_date", "-id"]
        constraints = [
            # The same distributor bill can never be entered twice.
            models.UniqueConstraint("supplier", Lower("bill_number"), name="purchase_bill_number_unique"),
        ]

    def __str__(self):
        return f"{self.supplier} #{self.bill_number}"

    def recalculate(self):
        lines = list(self.lines.all())
        self.taxable_total = money(sum((line.taxable_amount for line in lines), Decimal("0")))
        self.tax_total = money(sum((line.tax_amount for line in lines), Decimal("0")))
        self.total = money(self.taxable_total + self.tax_total + self.round_off)


class PurchaseLine(models.Model):
    bill = models.ForeignKey(PurchaseBill, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    unit = models.ForeignKey(ItemUnit, on_delete=models.PROTECT, related_name="+")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    rate = models.DecimalField(
        max_digits=12, decimal_places=4, validators=[MinValueValidator(Decimal("0"))],
        help_text="Per unit, before GST. 0 for free goods.",
    )
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    gst_rate = models.DecimalField("GST %", max_digits=4, decimal_places=2, choices=GST_RATES)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    class Meta:
        ordering = ["id"]

    def clean(self):
        if self.unit_id and self.item_id and self.unit.item_id != self.item_id:
            raise ValidationError({"unit": "This unit belongs to a different item."})

    def save(self, *args, **kwargs):
        gross = self.quantity * self.rate
        self.taxable_amount = money(gross - gross * self.discount_percent / 100)
        self.tax_amount = money(self.taxable_amount * self.gst_rate / 100)
        super().save(*args, **kwargs)

    @property
    def base_quantity(self):
        return self.quantity * self.unit.factor
