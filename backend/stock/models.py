from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone

from catalog.models import Item


class StockMovement(models.Model):
    """
    One line of the stock ledger. Every change to an item's stock is one row here,
    written by stock.services.record_movement. Rows are never edited or deleted.
    """

    class Kind(models.TextChoices):
        COUNT = "count", "Stock count"
        PURCHASE = "purchase", "Purchase"
        SALE = "sale", "Sale"
        SALE_RETURN = "sale_return", "Sale return"
        SALE_CANCELLED = "sale_cancelled", "Bill cancelled"
        PURCHASE_RETURN = "purchase_return", "Return to supplier"
        ADJUSTMENT = "adjustment", "Adjustment"

    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="movements")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, help_text="In base units; negative = out.")
    balance_after = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)

    source_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.PROTECT)
    source_id = models.PositiveBigIntegerField(null=True, blank=True)
    source = GenericForeignKey("source_type", "source_id")
    note = models.CharField(max_length=250, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["item", "-created_at"])]

    def __str__(self):
        return f"{self.get_kind_display()} {self.quantity:+} {self.item}"


class Adjustment(models.Model):
    """A manual stock correction with a reason. Owner only."""

    class Reason(models.TextChoices):
        DAMAGED = "damaged", "Damaged / broken"
        LOST = "lost", "Lost / missing"
        SAMPLE = "sample", "Given as sample"
        OWN_USE = "own_use", "Used in shop"
        CORRECTION = "correction", "Entry mistake correction"
        OTHER = "other", "Other"

    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="adjustments")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, help_text="In base units; negative removes stock.")
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.CharField(max_length=250, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_reason_display()} {self.quantity:+} {self.item}"


class StockCount(models.Model):
    """A counting session for one rack or category."""

    class Status(models.TextChoices):
        OPEN = "open", "Counting"
        POSTED = "posted", "Posted"
        CANCELLED = "cancelled", "Cancelled"

    title = models.CharField(max_length=80, help_text='What is being counted, e.g. "Rack A3" or "Wires".')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    note = models.CharField(max_length=250, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class StockCountLine(models.Model):
    """
    What was found on the shelf for one item.

    system_qty is the system's stock at the moment this line was last counted.
    Posting adds (counted - system_qty), so purchases or sales between counting
    and posting are not lost.
    """

    count = models.ForeignKey(StockCount, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    counted_qty = models.DecimalField(max_digits=12, decimal_places=3)
    system_qty = models.DecimalField(max_digits=12, decimal_places=3)
    counted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    counted_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-counted_at"]
        constraints = [models.UniqueConstraint("count", "item", name="count_line_item_unique")]

    @property
    def difference(self):
        return self.counted_qty - self.system_qty
