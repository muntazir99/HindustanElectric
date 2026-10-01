from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError

from purchases.models import PurchaseBill, PurchaseLine, Supplier
from purchases.services import post_bill
from stock.services import StockError

pytestmark = pytest.mark.django_db
D = Decimal


def make_bill(supplier, owner, number="INV-101"):
    return PurchaseBill.objects.create(
        supplier=supplier, bill_number=number, bill_date=date(2026, 10, 1), created_by=owner
    )


def add_line(bill, item, unit_name, quantity, rate, discount="0", gst="18"):
    return PurchaseLine.objects.create(
        bill=bill,
        item=item,
        unit=item.units.get(name=unit_name),
        quantity=D(quantity),
        rate=D(rate),
        discount_percent=D(discount),
        gst_rate=D(gst),
    )


class TestLineAmounts:
    def test_discount_then_gst(self, wire, supplier, owner):
        line = add_line(make_bill(supplier, owner), wire, "coil", "2", "1000", discount="10")
        assert line.taxable_amount == D("1800.00")
        assert line.tax_amount == D("324.00")

    def test_amounts_round_to_paise(self, wire, supplier, owner):
        line = add_line(make_bill(supplier, owner), wire, "m", "3", "10.3333", gst="18")
        assert line.taxable_amount == D("31.00")
        assert line.tax_amount == D("5.58")


class TestPosting:
    def test_coils_are_added_as_metres_at_cost_per_metre(self, wire, supplier, owner):
        bill = make_bill(supplier, owner)
        add_line(bill, wire, "coil", "2", "1000", discount="10")
        post_bill(bill, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("180")
        assert wire.cost_price == D("10")  # 1800 taxable / 180 m; GST excluded
        movement = wire.movements.get()
        assert movement.kind == "purchase"
        assert "INV-101" in movement.note

    def test_bill_totals_include_round_off(self, wire, supplier, owner):
        bill = make_bill(supplier, owner)
        bill.round_off = D("-0.40")
        bill.save()
        add_line(bill, wire, "m", "3", "10.3333")
        bill = post_bill(bill, owner)
        assert (bill.taxable_total, bill.tax_total, bill.total) == (D("31.00"), D("5.58"), D("36.18"))
        assert bill.status == PurchaseBill.Status.POSTED

    def test_second_purchase_averages_cost(self, wire, supplier, owner):
        first = make_bill(supplier, owner, "A1")
        add_line(first, wire, "coil", "1", "900")  # 10 per m
        post_bill(first, owner)
        second = make_bill(supplier, owner, "A2")
        add_line(second, wire, "coil", "1", "1080")  # 12 per m
        post_bill(second, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("180")
        assert wire.cost_price == D("11")

    def test_same_item_twice_in_one_bill(self, wire, supplier, owner):
        bill = make_bill(supplier, owner)
        add_line(bill, wire, "coil", "1", "900")
        add_line(bill, wire, "m", "10", "0")  # free sample metres
        post_bill(bill, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("100")
        assert wire.cost_price == D("9")  # 900 spread over 100 m
        assert wire.movements.count() == 2

    def test_bill_cannot_be_posted_twice(self, wire, supplier, owner):
        bill = make_bill(supplier, owner)
        add_line(bill, wire, "coil", "1", "900")
        post_bill(bill, owner)
        with pytest.raises(StockError):
            post_bill(bill, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("90")

    def test_empty_bill_cannot_be_posted(self, supplier, owner):
        with pytest.raises(StockError):
            post_bill(make_bill(supplier, owner), owner)

    def test_unit_from_another_item_is_rejected(self, wire, make_item, supplier, owner):
        other = make_item(product="MCB", base_unit="pc")
        bill = make_bill(supplier, owner)
        PurchaseLine.objects.create(
            bill=bill, item=wire, unit=other.units.get(), quantity=1, rate=10, gst_rate=18
        )
        with pytest.raises(StockError):
            post_bill(bill, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("0")


class TestDuplicateBills:
    def test_same_bill_number_from_same_supplier_is_rejected(self, supplier, owner):
        make_bill(supplier, owner, "inv-101")
        with pytest.raises(IntegrityError):
            make_bill(supplier, owner, "INV-101")

    def test_same_number_from_another_supplier_is_fine(self, supplier, owner):
        make_bill(supplier, owner, "INV-101")
        other = Supplier.objects.create(name="Gupta Electricals")
        make_bill(other, owner, "INV-101")
        assert PurchaseBill.objects.count() == 2
