from django.db import transaction
from django.utils import timezone

from core.numbers import cost, qty
from stock.models import StockMovement
from stock.services import StockError, lock_items, record_movement, weighted_average_cost

from .models import PurchaseBill


def post_bill(bill, user):
    """Add a draft bill's goods to stock and update each item's average cost."""
    with transaction.atomic():
        bill = PurchaseBill.objects.select_for_update().select_related("supplier").get(pk=bill.pk)
        if bill.status != PurchaseBill.Status.DRAFT:
            raise StockError("This bill is already posted.")
        lines = list(bill.lines.select_related("unit").order_by("id"))
        if not lines:
            raise StockError("Add at least one item before posting.")
        items = lock_items([line.item_id for line in lines])
        for line in lines:
            if line.unit.item_id != line.item_id:
                raise StockError(f"Line {line.pk}: unit does not belong to the item.")
            item = items[line.item_id]
            base_qty = qty(line.base_quantity)
            # Cost excludes GST: a registered dealer claims GST paid as input credit.
            unit_cost = cost(line.taxable_amount / base_qty)
            item.cost_price = weighted_average_cost(item.stock_qty, item.cost_price, base_qty, unit_cost)
            record_movement(
                item,
                StockMovement.Kind.PURCHASE,
                base_qty,
                user,
                unit_cost=unit_cost,
                source=line,
                note=f"Bill {bill.bill_number} · {bill.supplier.name}",
            )
        bill.recalculate()
        bill.status = PurchaseBill.Status.POSTED
        bill.posted_by = user
        bill.posted_at = timezone.now()
        bill.save()
    return bill
