"""The billing arithmetic. Every rupee printed on a bill comes from price_bill."""

import random
from decimal import Decimal

import pytest

from sales.pricing import LineInput, PricingError, price_bill

D = Decimal


def line(quantity, rate, gst="18", discount="0"):
    return LineInput(D(str(quantity)), D(str(rate)), D(gst), D(discount))


def check_adds_up(bill):
    """The invariants every bill must satisfy."""
    for result in bill.lines:
        assert result.taxable + result.cgst + result.sgst + result.igst == result.total
    assert bill.taxable + bill.cgst + bill.sgst + bill.igst == bill.subtotal
    assert bill.subtotal + bill.round_off == bill.total
    assert abs(bill.round_off) <= D("0.50")


class TestRatesIncludeGst:
    def test_customer_pays_the_shelf_price(self):
        bill = price_bill([line(2, "118.00")])
        assert bill.subtotal == D("236.00")
        assert bill.taxable == D("200.00")
        assert (bill.cgst, bill.sgst, bill.igst) == (D("18.00"), D("18.00"), D("0"))
        check_adds_up(bill)

    def test_odd_tax_splits_without_losing_a_paisa(self):
        # 100 incl. 18% -> taxable 84.75, tax 15.25 -> CGST 7.63 + SGST 7.62
        bill = price_bill([line(1, 100)])
        result = bill.lines[0]
        assert (result.taxable, result.cgst, result.sgst) == (D("84.75"), D("7.63"), D("7.62"))
        check_adds_up(bill)

    def test_loose_wire_by_the_metre(self):
        bill = price_bill([line("12.5", "27.47")])
        assert bill.lines[0].gross == D("343.38")  # 343.375 rounds half up
        assert bill.total == D("343")
        assert bill.round_off == D("-0.38")
        check_adds_up(bill)

    def test_different_gst_rates_on_one_bill(self):
        bill = price_bill([line(1, 105, gst="5"), line(1, 118, gst="18"), line(1, 50, gst="0")])
        assert [r.taxable for r in bill.lines] == [D("100.00"), D("100.00"), D("50.00")]
        assert bill.subtotal == D("273.00")
        check_adds_up(bill)


class TestRatesExcludeGst:
    def test_gst_added_on_top(self):
        bill = price_bill([line(10, "35.50")], rates_include_tax=False)
        assert bill.taxable == D("355.00")
        assert (bill.cgst, bill.sgst) == (D("31.95"), D("31.95"))
        assert bill.subtotal == D("418.90")
        assert bill.total == D("419")
        check_adds_up(bill)


class TestDiscounts:
    def test_line_discount_percent(self):
        bill = price_bill([line(2, 1000, discount="10")])
        assert bill.lines[0].discount == D("200.00")
        assert bill.subtotal == D("1800.00")
        check_adds_up(bill)

    def test_bill_discount_is_shared_in_proportion(self):
        bill = price_bill([line(1, 300), line(1, 100)], bill_discount=D("40"))
        assert [r.discount for r in bill.lines] == [D("30.00"), D("10.00")]
        assert bill.discount == D("40.00")
        assert bill.subtotal == D("360.00")
        check_adds_up(bill)

    def test_bill_discount_shares_add_up_exactly(self):
        bill = price_bill([line(1, 10), line(1, 10), line(1, 10)], bill_discount=D("10"))
        assert sum(r.discount for r in bill.lines) == D("10.00")
        assert bill.subtotal == D("20.00")
        check_adds_up(bill)

    def test_line_and_bill_discount_together(self):
        bill = price_bill([line(1, 200, discount="10"), line(1, 100)], bill_discount=D("27"))
        # nets 180 and 100 -> shares 17.36 and 9.64
        assert [r.discount for r in bill.lines] == [D("37.36"), D("9.64")]
        assert bill.subtotal == D("253.00")
        check_adds_up(bill)

    def test_bill_discount_larger_than_bill_is_refused(self):
        with pytest.raises(PricingError):
            price_bill([line(1, 100)], bill_discount=D("101"))

    def test_free_item_with_bill_discount(self):
        bill = price_bill([line(1, 0), line(1, 100)], bill_discount=D("10"))
        assert bill.lines[0].total == D("0")
        assert bill.subtotal == D("90.00")
        check_adds_up(bill)


class TestPlaceOfSupply:
    def test_other_state_pays_igst(self):
        bill = price_bill([line(1, 118)], same_state=False)
        assert (bill.cgst, bill.sgst, bill.igst) == (D("0"), D("0"), D("18.00"))
        check_adds_up(bill)


class TestRoundOff:
    def test_half_rupee_rounds_up(self):
        bill = price_bill([line(1, "100.50", gst="0")])
        assert (bill.total, bill.round_off) == (D("101"), D("0.50"))

    def test_round_off_can_be_turned_off(self):
        bill = price_bill([line(1, "100.37")], round_off=False)
        assert (bill.total, bill.round_off) == (D("100.37"), D("0"))


class TestBadInput:
    @pytest.mark.parametrize(
        "bad",
        [line(0, 10), line(-1, 10), line(1, -5), line(1, 10, discount="101"), line(1, 10, discount="-1")],
    )
    def test_refused(self, bad):
        with pytest.raises(PricingError):
            price_bill([bad])

    def test_negative_bill_discount_refused(self):
        with pytest.raises(PricingError):
            price_bill([line(1, 10)], bill_discount=D("-1"))


def test_random_bills_always_add_up():
    """500 random bills: totals always reconcile to the paisa, whatever the mix."""
    rng = random.Random(2026)
    for _ in range(500):
        lines = [
            line(
                D(rng.choice(["1", "2", "3", "12.5", "90", "0.75"])),
                D(rng.randint(0, 500000)) / 100,
                gst=rng.choice(["0", "5", "12", "18", "28"]),
                discount=rng.choice(["0", "0", "5", "7.5", "10"]),
            )
            for _ in range(rng.randint(1, 8))
        ]
        include = rng.random() < 0.7
        draft = price_bill(lines, rates_include_tax=include)
        discount = min(D(rng.randint(0, 5000)) / 100, draft.subtotal if include else draft.taxable)
        bill = price_bill(lines, rates_include_tax=include, bill_discount=discount, same_state=rng.random() < 0.8)
        check_adds_up(bill)
        assert sum(r.discount for r in bill.lines) == bill.discount
