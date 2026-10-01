from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Item
from sales.models import Customer, Invoice, Payment
from sales.numbering import financial_year_label
from stock.models import Adjustment
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal
FY = financial_year_label(timezone.localdate())


@pytest.fixture
def stocked_wire(wire, owner):
    Item.objects.filter(pk=wire.pk).update(selling_price=D("27.47"), cost_price=D("20"))
    create_adjustment(wire.pk, D("400"), Adjustment.Reason.CORRECTION, owner)
    return wire


@pytest.fixture
def customer(owner):
    return Customer.objects.create(name="Ramesh", phone="9876543210", created_by=owner)


def make_bill(client, wire, quantity="10", customer=None, pay="all"):
    body = {"lines": [{"item": wire.pk, "unit": wire.units.get(name="m").pk, "quantity": quantity}]}
    if customer:
        body["customer"] = customer.pk
    bill = client.post("/api/sales/invoices", body, format="json").data
    payments = [{"mode": "cash", "amount": bill["total"]}] if pay == "all" else []
    return client.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": payments}, format="json").data


def return_goods(client, bill, quantity, refund_mode="cash", reason="Wrong size"):
    return client.post(
        f"/api/sales/invoices/{bill['id']}/returns",
        {"lines": [{"line": bill["lines"][0]["id"], "quantity": quantity}], "refund_mode": refund_mode, "reason": reason},
        format="json",
    )


class TestReturns:
    def test_only_owner(self, staff_api, stocked_wire):
        bill = make_bill(staff_api, stocked_wire)
        assert return_goods(staff_api, bill, "2").status_code == 403

    def test_cash_return_gives_credit_note_stock_and_refund(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire, "10")  # 274.70 -> 275
        response = return_goods(owner_api, bill, "4")
        assert response.status_code == 201, response.data
        note = response.data
        assert note["number"] == f"CN/{FY}/00001"
        assert note["invoice_number"] == bill["number"]
        line = note["lines"][0]
        assert D(line["total"]) == D(line["taxable_value"]) + D(line["cgst"]) + D(line["sgst"])
        assert D(note["total"]) == D("110")  # 109.88 rounded
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("394")  # 400 - 10 + 4
        assert stocked_wire.movements.first().kind == "sale_return"
        refund = Payment.objects.get(kind="refund")
        assert (refund.mode, refund.amount) == ("cash", D("110"))

    def test_returning_in_parts_reverses_exactly_what_was_charged(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire, "10")
        charged = bill["lines"][0]
        notes = [return_goods(owner_api, bill, part).data for part in ("3", "3", "4")]
        for key in ("taxable_value", "cgst", "sgst", "total"):
            assert sum(D(n["lines"][0][key]) for n in notes) == D(charged[key])

    def test_cannot_return_more_than_sold(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire, "10")
        return_goods(owner_api, bill, "8")
        response = return_goods(owner_api, bill, "3")
        assert response.status_code == 400 and "only 2 m left" in response.data["detail"]
        detail = owner_api.get(f"/api/sales/invoices/{bill['id']}").data
        assert detail["lines"][0]["returned_quantity"] == "8.000"
        assert len(detail["credit_notes"]) == 1

    def test_khata_credit_needs_customer(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire)
        response = return_goods(owner_api, bill, "1", refund_mode="khata")
        assert response.status_code == 400 and "customer" in response.data["detail"]

    def test_khata_credit_reduces_what_customer_owes(self, owner_api, stocked_wire, customer):
        bill = make_bill(owner_api, stocked_wire, "10", customer=customer, pay="none")
        assert customer.balance() == D(bill["total"])
        note = return_goods(owner_api, bill, "10", refund_mode="khata").data
        assert customer.balance() == D(bill["total"]) - D(note["total"])
        assert not Payment.objects.filter(kind="refund").exists()

    def test_cash_refund_to_customer_shows_in_khata_both_ways(self, owner_api, stocked_wire, customer):
        bill = make_bill(owner_api, stocked_wire, "10", customer=customer)
        return_goods(owner_api, bill, "5")
        assert customer.balance() == D("0")
        kinds = list(customer.ledger.values_list("kind", flat=True))
        assert kinds[-2:] == ["return", "refund"]

    def test_bill_with_returns_cannot_be_cancelled(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire)
        return_goods(owner_api, bill, "1")
        response = owner_api.post(f"/api/sales/invoices/{bill['id']}/cancel", {"reason": "x"}, format="json")
        assert response.status_code == 400 and "returned" in response.data["detail"]

    def test_reason_required(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire)
        assert return_goods(owner_api, bill, "1", reason=" ").status_code == 400

    def test_credit_note_detail(self, owner_api, stocked_wire):
        bill = make_bill(owner_api, stocked_wire)
        note = return_goods(owner_api, bill, "2").data
        detail = owner_api.get(f"/api/sales/credit-notes/{note['id']}").data
        assert detail["tax_summary"][0]["rate"] == "18.00"
        assert detail["amount_in_words"].startswith("Rupees")


class TestQuotations:
    def test_quote_then_convert_to_bill(self, staff_api, stocked_wire, customer):
        draft = staff_api.post(
            "/api/sales/invoices",
            {"customer": customer.pk, "lines": [{"item": stocked_wire.pk, "unit": stocked_wire.units.get(name="m").pk, "quantity": "10", "rate": "25"}]},
            format="json",
        ).data
        quote = staff_api.post(f"/api/sales/invoices/{draft['id']}/quotation").data
        assert (quote["kind"], quote["number"], quote["status"]) == ("quotation", f"QT/{FY}/00001", "draft")
        assert quote["valid_until"]
        stocked_wire.refresh_from_db()
        assert stocked_wire.stock_qty == D("400")
        assert customer.balance() == D("0")

        # Quotations don't appear as bills, held bills or the counter's current bill.
        assert staff_api.get("/api/sales/invoices?status=quotation").data["count"] == 1
        assert staff_api.get("/api/sales/invoices?status=draft").data["count"] == 0
        assert staff_api.get("/api/sales/invoices/current").status_code == 204

        # Can't be edited or finalised.
        assert staff_api.put(f"/api/sales/invoices/{quote['id']}", {"lines": []}, format="json").status_code == 400
        assert staff_api.post(f"/api/sales/invoices/{quote['id']}/finalise", {"payments": []}, format="json").status_code == 400

        bill = staff_api.post(f"/api/sales/invoices/{quote['id']}/convert").data
        assert (bill["kind"], bill["status"], bill["number"]) == ("invoice", "draft", None)
        assert bill["lines"][0]["rate"] == "25.00"  # quoted price kept
        assert bill["customer"] == customer.pk
        assert f"QT/{FY}/00001" in bill["note"]
        # Converting again resumes the same draft.
        assert staff_api.post(f"/api/sales/invoices/{quote['id']}/convert").data["id"] == bill["id"]

        final = staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": bill["total"]}]}, format="json").data
        assert final["number"] == f"HE/{FY}/00001"
        again = staff_api.post(f"/api/sales/invoices/{quote['id']}/convert")
        assert again.status_code == 400 and "already billed" in again.data["detail"]

    def test_empty_draft_cannot_be_quoted(self, staff_api):
        draft = staff_api.post("/api/sales/invoices", {"lines": []}, format="json").data
        assert staff_api.post(f"/api/sales/invoices/{draft['id']}/quotation").status_code == 400

    def test_quotation_numbers_dont_use_invoice_numbers(self, staff_api, stocked_wire):
        draft = staff_api.post("/api/sales/invoices", {"lines": [{"item": stocked_wire.pk, "unit": stocked_wire.units.get(name="m").pk, "quantity": "1"}]}, format="json").data
        staff_api.post(f"/api/sales/invoices/{draft['id']}/quotation")
        bill = make_bill(staff_api, stocked_wire, "1")
        assert bill["number"] == f"HE/{FY}/00001"
        assert Invoice.objects.filter(kind="quotation").count() == 1
