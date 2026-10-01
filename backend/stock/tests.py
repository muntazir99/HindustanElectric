from decimal import Decimal

import pytest
from django.core.management import CommandError, call_command
from django.db.models import Sum

from catalog.models import Item
from stock.models import Adjustment, StockCount, StockMovement
from stock.services import (
    StockError,
    cancel_count,
    count_item,
    create_adjustment,
    lock_items,
    post_count,
    record_movement,
    weighted_average_cost,
)

pytestmark = pytest.mark.django_db
D = Decimal


def stock_of(item):
    item.refresh_from_db()
    return item.stock_qty


def new_count(owner, title="Rack A1"):
    return StockCount.objects.create(title=title, created_by=owner)


class TestAdjustment:
    def test_adjustment_moves_stock_and_writes_ledger(self, wire, owner):
        create_adjustment(wire.pk, D("10"), Adjustment.Reason.CORRECTION, owner)
        create_adjustment(wire.pk, D("-3"), Adjustment.Reason.DAMAGED, owner, note="cut wrong")
        assert stock_of(wire) == D("7")
        last = wire.movements.first()
        assert (last.kind, last.quantity, last.balance_after) == ("adjustment", D("-3"), D("7"))
        assert "cut wrong" in last.note
        assert isinstance(last.source, Adjustment)

    def test_zero_adjustment_is_rejected(self, wire, owner):
        with pytest.raises(StockError):
            create_adjustment(wire.pk, 0, Adjustment.Reason.OTHER, owner)


class TestNegativeStock:
    def test_uncounted_item_can_go_negative_without_flag(self, wire, owner):
        create_adjustment(wire.pk, D("-5"), Adjustment.Reason.OTHER, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("-5")
        assert wire.needs_recount is False

    def test_counted_item_going_negative_is_flagged_not_blocked(self, wire, owner):
        count = new_count(owner)
        count_item(count, wire.pk, D("2"), owner)
        post_count(count, owner)
        create_adjustment(wire.pk, D("-3"), Adjustment.Reason.OTHER, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("-1")
        assert wire.needs_recount is True


class TestCount:
    def test_count_sets_stock_even_after_unrecorded_sales(self, wire, owner):
        # Sold 5 before the item was ever counted.
        create_adjustment(wire.pk, D("-5"), Adjustment.Reason.OTHER, owner)
        count = new_count(owner)
        count_item(count, wire.pk, D("20"), owner)
        post_count(count, owner)
        wire.refresh_from_db()
        assert wire.stock_qty == D("20")
        assert wire.counted_at is not None
        movement = wire.movements.first()
        assert (movement.kind, movement.quantity) == ("count", D("25"))

    def test_stock_received_between_counting_and_posting_is_kept(self, wire, owner):
        create_adjustment(wire.pk, D("10"), Adjustment.Reason.CORRECTION, owner)
        count = new_count(owner)
        count_item(count, wire.pk, D("8"), owner)  # shelf had 8, system thought 10
        create_adjustment(wire.pk, D("5"), Adjustment.Reason.CORRECTION, owner)  # 5 arrive before posting
        post_count(count, owner)
        assert stock_of(wire) == D("13")

    def test_scanning_adds_and_typing_replaces(self, wire, owner):
        count = new_count(owner)
        count_item(count, wire.pk, D("90"), owner, add=True)
        line = count_item(count, wire.pk, D("90"), owner, add=True)
        assert line.counted_qty == D("180")
        line = count_item(count, wire.pk, D("175"), owner)
        assert line.counted_qty == D("175")
        assert count.lines.count() == 1

    def test_counting_unchanged_stock_still_marks_counted(self, wire, owner):
        count = new_count(owner)
        count_item(count, wire.pk, D("0"), owner)
        post_count(count, owner)
        wire.refresh_from_db()
        assert wire.counted_at is not None
        assert wire.movements.first().quantity == D("0")

    def test_posting_clears_recount_flag(self, wire, owner):
        Item.objects.filter(pk=wire.pk).update(needs_recount=True)
        count = new_count(owner)
        count_item(count, wire.pk, D("4"), owner)
        post_count(count, owner)
        wire.refresh_from_db()
        assert wire.needs_recount is False

    def test_item_cannot_be_in_two_open_counts(self, wire, owner):
        count_item(new_count(owner, "Rack A1"), wire.pk, D("1"), owner)
        with pytest.raises(StockError, match="Rack A1"):
            count_item(new_count(owner, "Wires"), wire.pk, D("1"), owner)

    def test_negative_count_is_rejected(self, wire, owner):
        with pytest.raises(StockError):
            count_item(new_count(owner), wire.pk, D("-1"), owner)

    def test_empty_count_cannot_be_posted(self, owner):
        with pytest.raises(StockError):
            post_count(new_count(owner), owner)

    def test_closed_count_cannot_be_changed(self, wire, owner):
        count = new_count(owner)
        count_item(count, wire.pk, D("1"), owner)
        post_count(count, owner)
        with pytest.raises(StockError):
            post_count(count, owner)
        with pytest.raises(StockError):
            count_item(count, wire.pk, D("2"), owner)
        with pytest.raises(StockError):
            cancel_count(count)

    def test_cancelled_count_changes_nothing(self, wire, owner):
        count = new_count(owner)
        count_item(count, wire.pk, D("50"), owner)
        cancel_count(count)
        assert stock_of(wire) == D("0")
        assert not wire.movements.exists()


class TestWeightedAverageCost:
    def test_blends_old_and_new_cost(self):
        assert weighted_average_cost(D("90"), D("10"), D("90"), D("12")) == D("11")

    def test_first_purchase_sets_cost(self):
        assert weighted_average_cost(D("0"), None, D("90"), D("12")) == D("12")

    def test_negative_stock_is_ignored(self):
        assert weighted_average_cost(D("-10"), D("10"), D("90"), D("12")) == D("12")


class TestLedgerConsistency:
    def test_cached_stock_always_equals_ledger(self, wire, make_item, owner):
        switch = make_item(product="Switch", base_unit="pc")
        create_adjustment(wire.pk, D("100"), Adjustment.Reason.CORRECTION, owner)
        create_adjustment(switch.pk, D("12"), Adjustment.Reason.CORRECTION, owner)
        count = new_count(owner)
        count_item(count, wire.pk, D("97.5"), owner)
        post_count(count, owner)
        create_adjustment(switch.pk, D("-2"), Adjustment.Reason.DAMAGED, owner)
        for item in (wire, switch):
            total = StockMovement.objects.filter(item=item).aggregate(total=Sum("quantity"))["total"]
            assert stock_of(item) == total
        call_command("check_stock")

    def test_check_stock_reports_tampering(self, wire, owner):
        create_adjustment(wire.pk, D("10"), Adjustment.Reason.CORRECTION, owner)
        Item.objects.filter(pk=wire.pk).update(stock_qty=D("999"))
        with pytest.raises(CommandError):
            call_command("check_stock")

    def test_record_movement_rounds_to_three_decimals(self, wire, owner):
        from django.db import transaction

        with transaction.atomic():
            item = lock_items([wire.pk])[wire.pk]
            movement = record_movement(item, StockMovement.Kind.ADJUSTMENT, D("1.23456"), owner)
        assert movement.quantity == D("1.235")
