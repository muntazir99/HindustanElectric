"""
The only code allowed to change stock.

Every function here runs inside a database transaction and locks the affected
items, so the ledger (StockMovement) and each item's cached stock_qty always
change together.
"""

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from catalog.models import Item
from core.numbers import cost, qty

from .models import Adjustment, StockCount, StockCountLine, StockMovement


class StockError(Exception):
    """A stock operation that is not allowed; the message is shown to the user."""


def lock_items(item_ids):
    """Lock items for update in id order (avoids deadlocks). Returns {id: item}."""
    items = (
        Item.objects.select_for_update(of=("self",))
        .select_related("product__brand")
        .filter(pk__in=set(item_ids))
        .order_by("pk")
    )
    locked = {item.pk: item for item in items}
    missing = set(item_ids) - set(locked)
    if missing:
        raise StockError(f"Item(s) not found: {sorted(missing)}")
    return locked


def weighted_average_cost(old_qty, old_cost, in_qty, in_cost):
    """New average cost after receiving in_qty at in_cost. Negative/zero old stock is ignored."""
    if old_cost is None or old_qty <= 0:
        return cost(in_cost)
    return cost((old_qty * old_cost + in_qty * in_cost) / (old_qty + in_qty))


def record_movement(item, kind, quantity, user, *, unit_cost=None, source=None, note=""):
    """
    Add one ledger row and update the item's cached stock.
    The caller must hold a lock on `item` (see lock_items) inside transaction.atomic().
    """
    quantity = qty(quantity)
    now = timezone.now()
    item.stock_qty = qty(item.stock_qty + quantity)
    # Stock below zero on a counted item means something was missed: flag it, never block.
    if item.stock_qty < 0 and item.counted_at is not None:
        item.needs_recount = True
    movement = StockMovement.objects.create(
        item=item,
        kind=kind,
        quantity=quantity,
        balance_after=item.stock_qty,
        unit_cost=unit_cost,
        source_type=ContentType.objects.get_for_model(source) if source is not None else None,
        source_id=source.pk if source is not None else None,
        note=note[:250],
        created_by=user,
        created_at=now,
    )
    Item.objects.filter(pk=item.pk).update(
        stock_qty=item.stock_qty,
        needs_recount=item.needs_recount,
        cost_price=item.cost_price,
        updated_at=now,
    )
    return movement


def create_adjustment(item_id, quantity, reason, user, note=""):
    quantity = qty(quantity)
    if quantity == 0:
        raise StockError("Adjustment quantity cannot be zero.")
    with transaction.atomic():
        item = lock_items([item_id])[item_id]
        adjustment = Adjustment.objects.create(item=item, quantity=quantity, reason=reason, note=note, created_by=user)
        record_movement(
            item,
            StockMovement.Kind.ADJUSTMENT,
            quantity,
            user,
            unit_cost=item.cost_price,
            source=adjustment,
            note=f"{adjustment.get_reason_display()}{': ' + note if note else ''}",
        )
    return adjustment


def count_item(count, item_id, quantity, user, *, add=False):
    """
    Record what was found on the shelf. add=True adds to the existing count
    (one scan = one more unit); otherwise the quantity replaces it.
    """
    quantity = qty(quantity)
    with transaction.atomic():
        count = StockCount.objects.select_for_update().get(pk=count.pk)
        if count.status != StockCount.Status.OPEN:
            raise StockError("This count is already closed.")
        other = (
            StockCountLine.objects.filter(item_id=item_id, count__status=StockCount.Status.OPEN)
            .exclude(count=count)
            .select_related("count")
            .first()
        )
        if other:
            raise StockError(f'This item is already being counted in "{other.count.title}".')
        system_qty = Item.objects.values_list("stock_qty", flat=True).get(pk=item_id)
        line = StockCountLine.objects.filter(count=count, item_id=item_id).first()
        new_qty = (line.counted_qty + quantity) if (line and add) else quantity
        if new_qty < 0:
            raise StockError("Counted quantity cannot be negative.")
        if line:
            line.counted_qty = new_qty
            line.system_qty = system_qty
            line.counted_by = user
            line.save()
        else:
            line = StockCountLine.objects.create(
                count=count, item_id=item_id, counted_qty=new_qty, system_qty=system_qty, counted_by=user
            )
    return line


def post_count(count, user):
    """Apply a count: each item's stock moves by (counted - system stock when counted)."""
    with transaction.atomic():
        count = StockCount.objects.select_for_update().get(pk=count.pk)
        if count.status != StockCount.Status.OPEN:
            raise StockError("This count is already closed.")
        lines = list(count.lines.order_by("item_id"))
        if not lines:
            raise StockError("Nothing has been counted yet.")
        items = lock_items([line.item_id for line in lines])
        now = timezone.now()
        for line in lines:
            item = items[line.item_id]
            record_movement(
                item,
                StockMovement.Kind.COUNT,
                line.counted_qty - line.system_qty,
                user,
                unit_cost=item.cost_price,
                source=line,
                note=f"Count: {count.title}",
            )
            Item.objects.filter(pk=item.pk).update(counted_at=now, needs_recount=False)
        count.status = StockCount.Status.POSTED
        count.posted_by = user
        count.posted_at = now
        count.save()
    return count


def cancel_count(count):
    with transaction.atomic():
        count = StockCount.objects.select_for_update().get(pk=count.pk)
        if count.status != StockCount.Status.OPEN:
            raise StockError("This count is already closed.")
        count.status = StockCount.Status.CANCELLED
        count.save()
    return count
