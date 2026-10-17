"""Reorder list (plan §18.1)."""

from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Item
from stock.models import Adjustment
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal


def counted(item, minimum, stock, owner):
    Item.objects.filter(pk=item.pk).update(min_stock=D(minimum), counted_at=timezone.now())
    current = Item.objects.get(pk=item.pk).stock_qty
    if D(stock) != current:
        create_adjustment(item.pk, D(stock) - current, Adjustment.Reason.CORRECTION, owner)


@pytest.fixture
def low(owner_api, owner, supplier, wire, make_item):
    """Wire: bought last in coils (₹1,000 less 10%), min 100 m, 30 m left. MCB: never bought, min 10, 4 left."""
    coil = wire.units.get(name="coil")
    bill = owner_api.post("/api/purchases/bills", {
        "supplier": supplier.pk, "bill_number": "A1", "bill_date": "2026-10-01",
        "lines": [{"item": wire.pk, "unit": coil.pk, "quantity": "1", "rate": "1000", "discount_percent": "10"}],
    }, format="json").data
    owner_api.post(f"/api/purchases/bills/{bill['id']}/post")
    counted(wire, "100", "30", owner)
    mcb = make_item(product="MCB")
    counted(mcb, "10", "4", owner)
    never_counted = make_item(product="Switch")
    Item.objects.filter(pk=never_counted.pk).update(min_stock=D("10"))  # low on paper, but not counted yet: left out
    return wire, mcb


def test_grouped_by_last_distributor_with_whole_packs(owner_api, low):
    wire, mcb = low
    [sharma, nobody] = owner_api.get("/api/purchases/reorder").data["groups"]
    assert sharma["supplier"]["name"] == "Sharma Distributors" and nobody["supplier"] is None
    [line] = sharma["items"]
    # Up to twice the minimum: 200 − 30 = 170 m, in 90 m coils → 2 coils.
    assert (line["stock"], line["min_stock"], line["unit"], line["quantity"]) == ("30", "100", wire.units.get(name="coil").pk, "2")
    assert line["last"] == {"date": "2026-10-01", "rate": "900.00", "unit_name": "coil"}
    [other] = nobody["items"]
    assert (other["id"], other["unit"], other["quantity"]) == (mcb.pk, mcb.units.get().pk, "16")  # 20 − 4, loose


def test_what_is_on_order_comes_off(owner_api, supplier, low):
    wire, _ = low
    owner_api.post("/api/purchases/orders", {
        "supplier": supplier.pk, "lines": [{"item": wire.pk, "unit": wire.units.get(name="coil").pk, "quantity": "1"}],
    }, format="json")
    line = owner_api.get("/api/purchases/reorder").data["groups"][0]["items"][0]
    assert (line["on_order"], line["quantity"]) == ("90", "1")  # 170 − 90 = 80 m → 1 coil


def test_last_rates_need_see_costs(staff_api, low):
    line = staff_api.get("/api/purchases/reorder").data["groups"][0]["items"][0]
    assert "last" not in line and line["quantity"] == "2"
