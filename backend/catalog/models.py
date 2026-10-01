from decimal import Decimal

from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

GST_RATES = [(Decimal(rate), f"{rate}%") for rate in ("0", "5", "12", "18", "28", "40")]

hsn_validator = RegexValidator(r"^(\d{4}|\d{6}|\d{8})$", "HSN code is 4, 6 or 8 digits.")


class BaseUnit(models.TextChoices):
    """The smallest unit an item is sold in. Stock is always kept in this unit."""

    PIECE = "pc", "Piece"
    METRE = "m", "Metre"
    FOOT = "ft", "Foot"
    KG = "kg", "Kilogram"
    LITRE = "l", "Litre"
    SET = "set", "Set"
    PAIR = "pair", "Pair"
    PACKET = "pkt", "Packet"
    ROLL = "roll", "Roll"


class Category(models.Model):
    name = models.CharField(max_length=80)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]
        constraints = [models.UniqueConstraint(Lower("name"), name="category_name_unique")]

    def __str__(self):
        return f"{self.parent} › {self.name}" if self.parent_id else self.name


class Brand(models.Model):
    name = models.CharField(max_length=80)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(Lower("name"), name="brand_name_unique")]

    def __str__(self):
        return self.name


class Product(models.Model):
    """
    A product line that comes in variants, e.g. "Lifeline Plus HRFR wire".
    HSN and GST are set once here for all its variants.
    """

    name = models.CharField(max_length=150)
    brand = models.ForeignKey(Brand, null=True, blank=True, on_delete=models.PROTECT, related_name="products")
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.PROTECT, related_name="products"
    )
    hsn_code = models.CharField("HSN code", max_length=8, blank=True, validators=[hsn_validator])
    gst_rate = models.DecimalField("GST %", max_digits=4, decimal_places=2, choices=GST_RATES, default=Decimal("18"))
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                "brand", Lower("name"), name="product_brand_name_unique", nulls_distinct=False
            )
        ]

    def __str__(self):
        return f"{self.brand} {self.name}" if self.brand_id else self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Item search text includes the product and brand names.
        for item in self.items.select_related("product__brand"):
            item.save(update_fields=["search_text", "updated_at"])


class Item(models.Model):
    """
    One thing you stock and sell: a product variant such as
    "Havells Lifeline Plus HRFR wire — 1.5 sq mm Red".

    stock_qty is a cached total of the item's stock movements and is only
    changed by stock.services.record_movement.
    """

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="items")
    variant = models.CharField(max_length=120, blank=True, help_text='e.g. "1.5 sq mm Red". Blank if no variants.')
    code = models.CharField(max_length=12, unique=True, blank=True, help_text="Short code for items without a barcode.")
    base_unit = models.CharField(max_length=4, choices=BaseUnit.choices, default=BaseUnit.PIECE)

    mrp = models.DecimalField("MRP", max_digits=12, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, help_text="Per base unit, GST included."
    )
    cost_price = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True,
        help_text="Weighted average purchase cost per base unit, GST excluded.",
    )

    stock_qty = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"), editable=False)
    min_stock = models.DecimalField(
        max_digits=12, decimal_places=3, default=Decimal("0"), validators=[MinValueValidator(Decimal("0"))]
    )
    rack = models.CharField(max_length=30, blank=True)
    aliases = models.CharField(
        max_length=250, blank=True, help_text="Other names customers use, comma separated."
    )

    is_active = models.BooleanField(default=True)
    counted_at = models.DateTimeField(null=True, blank=True, editable=False)
    needs_recount = models.BooleanField(default=False, editable=False)

    search_text = models.TextField(blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__name", "variant"]
        constraints = [
            models.UniqueConstraint("product", Lower("variant"), name="item_product_variant_unique"),
        ]
        indexes = [models.Index(fields=["rack"])]

    def __str__(self):
        return self.name

    @property
    def name(self):
        parts = [self.product.brand.name if self.product.brand_id else "", self.product.name, self.variant]
        return " ".join(part for part in parts if part)

    def save(self, *args, **kwargs):
        self.search_text = " ".join([self.name, self.code, self.aliases, self.rack]).lower()
        super().save(*args, **kwargs)
        if not self.code:
            self.code = str(10000 + self.pk)
            self.search_text = f"{self.search_text} {self.code}"
            super().save(update_fields=["code", "search_text"])
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "base_unit" not in update_fields:
            return
        base = self.units.filter(is_base=True).first()
        if base is None:
            ItemUnit.objects.create(item=self, name=self.base_unit, factor=Decimal("1"), is_base=True)
        elif base.name != self.base_unit:
            base.name = self.base_unit
            base.save(update_fields=["name"])


class ItemUnit(models.Model):
    """
    A unit an item is bought or sold in. Every item has one base unit (factor 1);
    packs add larger units, e.g. coil = 90 m or box = 100 pc.
    Barcodes live here, so scanning a box barcode means one box.
    """

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="units")
    name = models.CharField(max_length=20)
    factor = models.DecimalField(
        max_digits=12, decimal_places=3, help_text="How many base units in one of this unit.",
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    is_base = models.BooleanField(default=False, editable=False)
    barcode = models.CharField(max_length=64, null=True, blank=True, unique=True)
    selling_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Price for this whole pack, GST included. Blank = base price × size.",
    )

    class Meta:
        ordering = ["factor"]
        constraints = [
            models.UniqueConstraint("item", Lower("name"), name="item_unit_name_unique"),
            models.UniqueConstraint("item", condition=Q(is_base=True), name="item_single_base_unit"),
            models.CheckConstraint(condition=Q(factor__gt=0), name="item_unit_factor_positive"),
        ]

    def __str__(self):
        return self.name if self.is_base else f"{self.name} ({self.factor.normalize()} {self.item.base_unit})"

    def save(self, *args, **kwargs):
        self.barcode = (self.barcode or "").strip() or None
        super().save(*args, **kwargs)
