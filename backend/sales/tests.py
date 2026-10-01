from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Item
from sales.models import Customer, Invoice, LedgerEntry, Payment
from sales.numbering import financial_year_label, next_number
from sales.services import BillingError, cancel, default_rate, finalise, save_draft
from shop.models import ShopSettings
from stock.models import Adjustment, StockMovement
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal
FY = financial_year_label(timezone.localdate())


@pytest.fixture
def stocked_wire(wire, owner):
    """Wire at ₹28/m, ₹2400 per 90 m coil, average cost ₹20/m, 400 m in stock."""
    Item.objects.filter(pk=wire.pk).update(selling_price=D("28"), cost_price=D("20"))
    wire.units.filter(name="coil").update(selling_price=D("2400"))
    create_adjustment(wire.pk, D("400"), Adjustment.Reason.CORRECTION, owner)
    wire.refresh_from_db()
    return wire


@pytest.fixture
def customer(owner):
    return Customer.objects.create(name="Ramesh Electrician", phone="+91 98765-43210", kind="electrician", created_by=owner)


def draft(user, item, unit_name="m", quantity="10", **header):
    lines = header.pop("lines", None) or [{"item": item, "unit": item.units.get(name=unit_name), "quantity": D(quantity)}]
    return save_draft(Invoice(), lines=lines, user=user, **header)


class TestNumbering:
    @pytest.mark.parametrize(
        "day, label",
        [(date(2026, 4, 1), "26-27"), (date(2026, 10, 1), "26-27"), (date(2027, 3, 31), "26-27"), (date(2027, 4, 1), "27-28")],
    )
    def test_financial_year_runs_april_to_march(self, day, label):
        assert financial_year_label(day) == label

    def test_numbers_follow_on_and_restart_each_year(self):
        assert next_number("invoice", date(2027, 3, 30), "HE") == "HE/26-27/00001"
        assert next_number("invoice", date(2027, 3, 31), "HE") == "HE/26-27/00002"
        assert next_number("invoice", date(2027, 4, 1), "HE") == "HE/27-28/00001"
        assert next_number("credit_note", date(2027, 4, 1)) == "CN/27-28/00001"

    def test_number_fits_gst_limit(self):
        assert len(next_number("invoice", date(2026, 10, 1), "ABCD")) <= 16


class TestDrafts:
    def test_draft_is_priced_but_touches_nothing(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire, quantity="10")
        assert invoice.number is None and invoice.status == "draft"
        assert invoice.total == D("280")
        assert invoice.lines.get().description == stocked_wire.name
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("400")
        assert not Payment.objects.exists()

    def test_default_rate_uses_pack_price(self, stocked_wire):
        assert default_rate(stocked_wire, stocked_wire.units.get(name="coil")) == D("2400")
        assert default_rate(stocked_wire, stocked_wire.units.get(name="m")) == D("28")

    def test_pack_without_price_uses_base_price_times_size(self, stocked_wire):
        stocked_wire.units.filter(name="coil").update(selling_price=None)
        assert default_rate(stocked_wire, stocked_wire.units.get(name="coil")) == D("2520.00")

    def test_item_without_price_needs_a_typed_rate(self, staff, make_item):
        fan = make_item(product="Fan")
        with pytest.raises(BillingError, match="no selling price"):
            draft(staff, fan, unit_name="pc", quantity="1")
        invoice = save_draft(Invoice(), lines=[{"item": fan, "unit": fan.units.get(), "quantity": 1, "rate": D("2450")}], user=staff)
        assert invoice.total == D("2450")

    def test_customer_discount_applies_by_default(self, staff, stocked_wire, customer):
        customer.default_discount_percent = D("10")
        customer.save()
        invoice = draft(staff, stocked_wire, quantity="10", customer=customer)
        assert invoice.total == D("252")

    def test_unit_of_another_item_refused(self, staff, stocked_wire, make_item):
        other = make_item(product="MCB")
        with pytest.raises(BillingError):
            save_draft(Invoice(), lines=[{"item": stocked_wire, "unit": other.units.get(), "quantity": 1}], user=staff)

    def test_other_state_bill_has_igst(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire, quantity="10", place_of_supply="09")
        assert invoice.igst_total > 0 and invoice.cgst_total == 0


class TestFinaliseWalkIn:
    def test_cash_sale_numbers_bill_and_moves_stock(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire, unit_name="coil", quantity="1")
        invoice, warnings = finalise(invoice, payments=[("cash", D("2400"))], user=staff)
        assert invoice.number == f"HE/{FY}/00001"
        assert (invoice.status, invoice.invoice_date) == ("final", timezone.localdate())
        assert warnings == []
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("310")  # one 90 m coil out
        movement = stocked_wire.movements.first()
        assert (movement.kind, movement.quantity) == ("sale", D("-90"))
        line = invoice.lines.get()
        assert line.cost_amount == D("1800.00")
        payment = Payment.objects.get()
        assert (payment.kind, payment.mode, payment.amount) == ("sale", "cash", D("2400"))
        assert not LedgerEntry.objects.exists()

    def test_split_payment(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire, quantity="10")
        finalise(invoice, payments=[("cash", 200), ("upi", 80)], user=staff)
        assert sorted(Payment.objects.values_list("mode", "amount")) == [("cash", D("200")), ("upi", D("80"))]

    def test_numbers_follow_on_and_drafts_dont_use_them(self, staff, stocked_wire):
        first = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        draft(staff, stocked_wire)  # held / abandoned
        second = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        assert (first.number, second.number) == (f"HE/{FY}/00001", f"HE/{FY}/00002")

    def test_prefix_comes_from_shop_settings(self, staff, stocked_wire):
        settings = ShopSettings.load()
        settings.invoice_prefix = "HEC"
        settings.save()
        invoice = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        assert invoice.number.startswith("HEC/")

    def test_walk_in_must_pay_in_full(self, staff, stocked_wire):
        with pytest.raises(BillingError, match="Choose a customer"):
            finalise(draft(staff, stocked_wire), payments=[("cash", 100)], user=staff)
        assert not Invoice.objects.exclude(number=None).exists()

    def test_overpayment_refused(self, staff, stocked_wire):
        with pytest.raises(BillingError, match="more than the bill"):
            finalise(draft(staff, stocked_wire), payments=[("cash", 500)], user=staff)

    def test_big_walk_in_bill_needs_name_and_address(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire, unit_name="coil", quantity="25")  # ₹60,000
        with pytest.raises(BillingError, match="name and address"):
            finalise(invoice, payments=[("cash", invoice.total)], user=staff)
        invoice.buyer_name, invoice.buyer_address = "S. Kumar", "Brahampura, Muzaffarpur"
        invoice.save()
        assert finalise(invoice, payments=[("cash", invoice.total)], user=staff)[0].status == "final"

    def test_failed_finalise_changes_nothing(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire)
        with pytest.raises(BillingError):
            finalise(invoice, payments=[("cash", 1)], user=staff)
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("400")
        assert not Payment.objects.exists()
        assert Invoice.objects.get().status == "draft"

    def test_cannot_finalise_twice(self, staff, stocked_wire):
        invoice = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        with pytest.raises(BillingError):
            finalise(invoice, payments=[("cash", 280)], user=staff)

    def test_stock_may_go_below_zero(self, staff, stocked_wire):
        invoice = draft(staff, stocked_wire, quantity="500")
        finalise(invoice, payments=[("cash", invoice.total)], user=staff)
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("-100")


class TestKhata:
    def test_unpaid_part_goes_on_khata(self, staff, stocked_wire, customer):
        invoice = draft(staff, stocked_wire, unit_name="coil", quantity="2", customer=customer)  # ₹4800
        invoice, _ = finalise(invoice, payments=[("cash", 1800)], user=staff)
        assert (invoice.paid_amount, invoice.credit_amount) == (D("1800"), D("3000"))
        assert invoice.buyer_name == "Ramesh Electrician" and invoice.buyer_phone == "9876543210"
        entries = list(customer.ledger.values_list("kind", "debit", "credit"))
        assert entries == [("bill", D("4800"), D("0")), ("payment", D("0"), D("1800"))]
        assert customer.balance() == D("3000")

    def test_fully_paid_customer_bill_nets_to_zero(self, staff, stocked_wire, customer):
        finalise(draft(staff, stocked_wire, customer=customer), payments=[("upi", 280)], user=staff)
        assert customer.balance() == D("0")
        assert customer.ledger.count() == 2

    def test_staff_cannot_exceed_credit_limit(self, staff, stocked_wire, customer):
        customer.credit_limit = D("1000")
        customer.save()
        with pytest.raises(BillingError, match="credit limit"):
            finalise(draft(staff, stocked_wire, unit_name="coil", quantity="1", customer=customer), payments=[], user=staff)

    def test_owner_can_exceed_with_warning(self, owner, stocked_wire, customer):
        customer.credit_limit = D("1000")
        customer.save()
        invoice, warnings = finalise(
            draft(owner, stocked_wire, unit_name="coil", quantity="1", customer=customer), payments=[], user=owner
        )
        assert invoice.status == "final"
        assert "credit limit" in warnings[0]
        assert customer.balance() == D("2400")

    def test_zero_limit_means_no_credit(self, staff, stocked_wire, customer):
        customer.credit_limit = D("0")
        customer.save()
        with pytest.raises(BillingError):
            finalise(draft(staff, stocked_wire, customer=customer), payments=[("cash", 100)], user=staff)


class TestBelowCost:
    def test_staff_cannot_sell_below_cost(self, staff, stocked_wire):
        lines = [{"item": stocked_wire, "unit": stocked_wire.units.get(name="m"), "quantity": 10, "rate": D("20")}]
        invoice = save_draft(Invoice(), lines=lines, user=staff)  # ₹20 incl. GST = ₹16.95 before GST < cost ₹20
        with pytest.raises(BillingError, match="too low"):
            finalise(invoice, payments=[("cash", invoice.total)], user=staff)

    def test_staff_message_does_not_reveal_cost(self, staff, stocked_wire):
        lines = [{"item": stocked_wire, "unit": stocked_wire.units.get(name="m"), "quantity": 10, "rate": D("20")}]
        invoice = save_draft(Invoice(), lines=lines, user=staff)
        with pytest.raises(BillingError) as error:
            finalise(invoice, payments=[("cash", invoice.total)], user=staff)
        assert "20.00" not in str(error.value)

    def test_owner_gets_a_warning(self, owner, stocked_wire):
        lines = [{"item": stocked_wire, "unit": stocked_wire.units.get(name="m"), "quantity": 10, "rate": D("20")}]
        invoice = save_draft(Invoice(), lines=lines, user=owner)
        invoice, warnings = finalise(invoice, payments=[("cash", invoice.total)], user=owner)
        assert "below its average cost" in warnings[0]


class TestCancel:
    def test_cancel_reverses_everything_and_keeps_number(self, owner, staff, stocked_wire, customer):
        invoice = draft(staff, stocked_wire, unit_name="coil", quantity="2", customer=customer)
        invoice, _ = finalise(invoice, payments=[("cash", 1800)], user=staff)
        cancel(invoice, reason="Customer changed mind", user=owner)
        invoice.refresh_from_db()
        assert (invoice.status, invoice.number) == ("cancelled", f"HE/{FY}/00001")
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("400")
        assert stocked_wire.cost_price == D("20.0000")
        assert stocked_wire.movements.first().kind == StockMovement.Kind.SALE_CANCELLED
        refund = Payment.objects.get(kind="refund")
        assert (refund.mode, refund.amount) == ("cash", D("1800"))
        assert customer.balance() == D("0")
        # The next bill continues the series.
        nxt = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        assert nxt.number == f"HE/{FY}/00002"

    def test_reason_required_and_only_once(self, owner, staff, stocked_wire):
        invoice = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        with pytest.raises(BillingError, match="reason"):
            cancel(invoice, reason=" ", user=owner)
        cancel(invoice, reason="Wrong item", user=owner)
        with pytest.raises(BillingError):
            cancel(invoice, reason="Again", user=owner)

    def test_draft_cannot_be_cancelled(self, owner, stocked_wire):
        with pytest.raises(BillingError):
            cancel(draft(owner, stocked_wire), reason="x", user=owner)


class TestSnapshots:
    def test_bill_keeps_old_name_after_rename(self, staff, stocked_wire):
        invoice = finalise(draft(staff, stocked_wire), payments=[("cash", 280)], user=staff)[0]
        stocked_wire.variant = "1.5 sq mm RED (new)"
        stocked_wire.save()
        assert "new" not in invoice.lines.get().description


def test_customer_phone_and_gstin_are_cleaned(owner):
    customer = Customer.objects.create(name="ABC Traders", phone="+91 98765 43210", gstin=" 09abcde1234f1z5 ", created_by=owner)
    assert (customer.phone, customer.gstin, customer.state_code) == ("9876543210", "09ABCDE1234F1Z5", "09")
