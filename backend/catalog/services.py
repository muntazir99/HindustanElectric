"""Creating and updating catalogue entries. Shared by the API and the Excel import."""

from decimal import Decimal

from .models import BaseUnit, Brand, Category, Item, ItemUnit, Product


class CatalogError(Exception):
    """A catalogue change that is not allowed; the message is shown to the user."""


UNIT_ALIASES = {
    "pc": BaseUnit.PIECE, "pcs": BaseUnit.PIECE, "piece": BaseUnit.PIECE, "pieces": BaseUnit.PIECE,
    "nos": BaseUnit.PIECE, "no": BaseUnit.PIECE, "no.": BaseUnit.PIECE, "unit": BaseUnit.PIECE,
    "m": BaseUnit.METRE, "mtr": BaseUnit.METRE, "mtrs": BaseUnit.METRE, "metre": BaseUnit.METRE,
    "meter": BaseUnit.METRE, "metres": BaseUnit.METRE, "meters": BaseUnit.METRE,
    "ft": BaseUnit.FOOT, "feet": BaseUnit.FOOT, "foot": BaseUnit.FOOT,
    "kg": BaseUnit.KG, "kgs": BaseUnit.KG, "kilogram": BaseUnit.KG,
    "l": BaseUnit.LITRE, "ltr": BaseUnit.LITRE, "litre": BaseUnit.LITRE, "liter": BaseUnit.LITRE,
    "set": BaseUnit.SET, "sets": BaseUnit.SET,
    "pair": BaseUnit.PAIR, "pairs": BaseUnit.PAIR,
    "pkt": BaseUnit.PACKET, "packet": BaseUnit.PACKET, "pack": BaseUnit.PACKET,
    "roll": BaseUnit.ROLL, "rolls": BaseUnit.ROLL,
}


def parse_base_unit(text):
    key = (text or "pc").strip().lower()
    if key not in UNIT_ALIASES:
        valid = ", ".join(choice for choice, _ in BaseUnit.choices)
        raise CatalogError(f'Unknown unit "{text}". Use one of: {valid}.')
    return UNIT_ALIASES[key]


def brand_named(name):
    name = (name or "").strip()
    if not name:
        return None
    return Brand.objects.filter(name__iexact=name).first() or Brand.objects.create(name=name)


def category_named(name):
    name = (name or "").strip()
    if not name:
        return None
    return Category.objects.filter(name__iexact=name).first() or Category.objects.create(name=name)


def find_product(name, brand):
    return Product.objects.filter(name__iexact=name.strip(), brand=brand).first()


def item_has_history(item):
    return item.pk is not None and item.movements.exists()


def check_barcode_free(barcode, unit=None):
    barcode = (barcode or "").strip()
    if not barcode:
        return None
    clash = ItemUnit.objects.filter(barcode=barcode).select_related("item__product__brand")
    if unit is not None and unit.pk:
        clash = clash.exclude(pk=unit.pk)
    clash = clash.first()
    if clash:
        raise CatalogError(f"Barcode {barcode} is already used by {clash.item} ({clash.name}).")
    return barcode


def set_base_unit(item, base_unit):
    if item.base_unit == base_unit:
        return
    if item_has_history(item):
        raise CatalogError(f"{item}: the unit can't change after stock has moved (it is kept in {item.base_unit}).")
    item.base_unit = base_unit


def set_pack(item, name, factor, *, barcode=None, mrp=None, selling_price=None):
    """Create or update a pack unit (e.g. coil = 90 m) on an item."""
    name = name.strip()
    factor = Decimal(factor)
    if factor <= 0:
        raise CatalogError("Pack size must be more than zero.")
    if name.lower() == item.base_unit:
        raise CatalogError(f'Pack name "{name}" is the same as the base unit.')
    unit = item.units.filter(name__iexact=name, is_base=False).first() or ItemUnit(item=item, name=name)
    if unit.pk and unit.factor != factor and unit_is_used(unit):
        raise CatalogError(f"{item}: {name} size can't change after it has been used on a bill.")
    unit.factor = factor
    if barcode is not None:
        unit.barcode = check_barcode_free(barcode, unit)
    if mrp is not None:
        unit.mrp = mrp
    if selling_price is not None:
        unit.selling_price = selling_price
    unit.save()
    return unit


def unit_is_used(unit):
    from purchases.models import PurchaseLine

    return PurchaseLine.objects.filter(unit=unit).exists()


def create_item(product, variant, base_unit, *, barcode=None, pack=None, **fields):
    """
    Add one variant to a product. `pack` is an optional dict:
    {"name": "coil", "factor": 90, "barcode": ..., "mrp": ..., "selling_price": ...}.
    """
    variant = (variant or "").strip()
    if product.pk and product.items.filter(variant__iexact=variant).exists():
        label = f"{product} {variant}".strip()
        raise CatalogError(f'"{label}" already exists.')
    barcode = check_barcode_free(barcode)
    item = Item.objects.create(product=product, variant=variant, base_unit=base_unit, **fields)
    if barcode:
        base = item.units.get(is_base=True)
        base.barcode = barcode
        base.save()
    if pack and pack.get("name") and pack.get("factor"):
        set_pack(
            item,
            pack["name"],
            pack["factor"],
            barcode=pack.get("barcode"),
            mrp=pack.get("mrp"),
            selling_price=pack.get("selling_price"),
        )
    return item
