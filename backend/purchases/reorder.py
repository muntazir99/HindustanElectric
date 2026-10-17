"""
Reorder list (plan §18.1): items running low, grouped by the distributor they were last bought from,
each with a suggested quantity: enough to reach twice the minimum, less what is already on order,
in the unit last bought in (whole coils, boxes...).
"""

from decimal import ROUND_CEILING, Decimal

from django.db.models import DecimalField, F, Sum

from catalog.models import LOW_STOCK, Item
from core.numbers import money

from .models import PurchaseBill, PurchaseLine, PurchaseOrder, PurchaseOrderLine

ZERO = Decimal("0")


def plain(value):
    return format(value.normalize(), "f")


def suggest(item, on_order, last_unit_id):
    """(unit, quantity): the unit last bought in, else the smallest pack, else the base unit; rounded up."""
    units = list(item.units.all())
    packs = [unit for unit in units if not unit.is_base]
    unit = next((u for u in units if u.id == last_unit_id), None) or (packs[0] if packs else next(u for u in units if u.is_base))
    need = 2 * item.min_stock - item.stock_qty - on_order
    return unit, (need / unit.factor).to_integral_value(rounding=ROUND_CEILING) if need > 0 else ZERO


def reorder_list(*, with_costs):
    low = list(
        Item.objects.filter(LOW_STOCK, is_active=True).select_related("product__brand").prefetch_related("units")
    )
    last = {
        row["item_id"]: row
        for row in PurchaseLine.objects.filter(bill__status=PurchaseBill.Status.POSTED, item__in=low)
        .order_by("item_id", "-bill__bill_date", "-id")
        .distinct("item_id")
        .values("item_id", "unit_id", "unit__name", "rate", "discount_percent", "bill__bill_date", "bill__supplier_id", "bill__supplier__name")
    }
    on_order = dict(
        PurchaseOrderLine.objects.filter(order__status__in=PurchaseOrder.OPEN, item__in=low)
        .values("item_id")
        .annotate(total=Sum(F("quantity") * F("unit__factor"), output_field=DecimalField()))
        .values_list("item_id", "total")
    )

    groups = {}
    for item in sorted(low, key=lambda item: item.name.lower()):
        bought = last.get(item.pk)
        ordered = on_order.get(item.pk, ZERO)
        unit, quantity = suggest(item, ordered, bought and bought["unit_id"])
        row = {
            "id": item.pk, "name": item.name, "code": item.code, "base_unit": item.base_unit,
            "stock": plain(item.stock_qty), "min_stock": plain(item.min_stock), "on_order": plain(ordered),
            "units": [{"id": u.id, "name": u.name, "factor": plain(u.factor), "is_base": u.is_base} for u in item.units.all()],
            "unit": unit.id, "quantity": plain(quantity),
        }
        if with_costs and bought:
            net = bought["rate"] * (1 - bought["discount_percent"] / 100)
            row["last"] = {"date": bought["bill__bill_date"].isoformat(), "rate": str(money(net)), "unit_name": bought["unit__name"]}
        key = bought["bill__supplier_id"] if bought else None
        groups.setdefault(key, {"supplier": {"id": key, "name": bought["bill__supplier__name"]} if bought else None, "items": []})
        groups[key]["items"].append(row)
    # Distributors by name; items never bought last, where a distributor is picked.
    return sorted(groups.values(), key=lambda group: (group["supplier"] is None, (group["supplier"] or {}).get("name", "").lower()))
