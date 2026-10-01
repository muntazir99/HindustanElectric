from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Item
from sales.models import Customer, LedgerEntry, Payment
from sales.numbering import financial_year_label
from stock.models import Adjustment
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal
FY = financial_year_label(timezone.localdate())


@pytest.fixture
def customer(owner):
    return Customer.objects.create(name="Ramesh Electrician", phone="9876543210", created_by=owner)


def url(customer, action=""):
    return f"/api/sales/customers/{customer.pk}" + (f"/{action}" if action else "")


class TestOpeningBalance:
    def test_owner_sets_it_once(self, owner_api, customer):
        response = owner_api.post(url(customer, "opening"), {"amount": "3500"}, format="json")
        assert (response.status_code, response.data["balance"]) == (201, "3500.00")
        again = owner_api.post(url(customer, "opening"), {"amount": "100"}, format="json")
        assert again.status_code == 400 and "adjustment" in again.data["detail"]

    def test_negative_is_an_advance(self, owner_api, customer):
        owner_api.post(url(customer, "opening"), {"amount": "-500"}, format="json")
        assert customer.balance() == D("-500")

    def test_staff_cannot(self, staff_api, customer):
        assert staff_api.post(url(customer, "opening"), {"amount": "100"}, format="json").status_code == 403


class TestReceivePayment:
    def test_staff_receives_payment_with_numbered_receipt(self, staff_api, owner_api, customer):
        owner_api.post(url(customer, "opening"), {"amount": "3500"}, format="json")
        response = staff_api.post(url(customer, "payments"), {"amount": "1000", "mode": "upi", "reference": "UPI 4521"}, format="json")
        assert response.status_code == 201, response.data
        assert response.data["receipt_number"] == f"RC/{FY}/00001"
        assert response.data["balance_after"] == "2500.00"
        assert response.data["amount_in_words"] == "Rupees One Thousand Only"
        second = staff_api.post(url(customer, "payments"), {"amount": "500"}, format="json")
        assert second.data["receipt_number"] == f"RC/{FY}/00002"
        assert second.data["mode"] == "cash"
        assert customer.balance() == D("2000")
        receipt = staff_api.get(f"/api/sales/receipts/{response.data['id']}")
        assert receipt.data["customer_detail"]["name"] == "Ramesh Electrician"

    def test_amount_must_be_positive(self, staff_api, customer):
        assert staff_api.post(url(customer, "payments"), {"amount": "0"}, format="json").status_code == 400

    def test_paying_more_than_due_leaves_an_advance(self, staff_api, customer):
        staff_api.post(url(customer, "payments"), {"amount": "200"}, format="json")
        assert customer.balance() == D("-200")


class TestAdjust:
    def test_owner_adjusts_with_reason(self, owner_api, staff_api, customer):
        assert staff_api.post(url(customer, "adjust"), {"amount": "-50", "note": "x"}, format="json").status_code == 403
        assert owner_api.post(url(customer, "adjust"), {"amount": "-50"}, format="json").status_code == 400
        response = owner_api.post(url(customer, "adjust"), {"amount": "-50", "note": "Rounded off old dues"}, format="json")
        assert (response.status_code, response.data["balance"]) == (201, "-50.00")


class TestStatement:
    def test_running_balance_through_bills_and_payments(self, staff_api, owner_api, owner, customer, wire):
        Item.objects.filter(pk=wire.pk).update(selling_price=D("28"))
        create_adjustment(wire.pk, D("100"), Adjustment.Reason.CORRECTION, owner)
        owner_api.post(url(customer, "opening"), {"amount": "1000"}, format="json")
        bill = staff_api.post(
            "/api/sales/invoices",
            {"customer": customer.pk, "lines": [{"item": wire.pk, "unit": wire.units.get(name="m").pk, "quantity": "10"}]},
            format="json",
        ).data
        staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "80"}]}, format="json")
        staff_api.post(url(customer, "payments"), {"amount": "700"}, format="json")

        data = staff_api.get(url(customer, "ledger")).data
        rows = [(line["kind"], line["debit"], line["credit"], line["balance"]) for line in data["lines"]]
        assert rows == [
            ("opening", "1000.00", "0.00", "1000.00"),
            ("bill", "280.00", "0.00", "1280.00"),
            ("payment", "0.00", "80.00", "1200.00"),
            ("payment", "0.00", "700.00", "500.00"),
        ]
        assert data["closing_balance"] == "500.00"
        assert data["lines"][1]["invoice_number"] == f"HE/{FY}/00001"
        assert data["lines"][3]["receipt_number"] == f"RC/{FY}/00001"

    def test_date_range_brings_balance_forward(self, staff_api, owner_api, customer):
        owner_api.post(url(customer, "opening"), {"amount": "1000"}, format="json")
        LedgerEntry.objects.filter(customer=customer).update(date="2026-04-01")
        staff_api.post(url(customer, "payments"), {"amount": "300"}, format="json")
        today = timezone.localdate().isoformat()
        data = staff_api.get(url(customer, f"ledger?date_from={today}")).data
        assert data["brought_forward"] == "1000.00"
        assert [line["balance"] for line in data["lines"]] == ["700.00"]

    def test_customer_bills_list(self, staff_api, customer):
        assert staff_api.get(f"/api/sales/invoices?customer={customer.pk}").data["count"] == 0


def test_counter_payments_have_no_receipt_number(staff_api, customer, owner, wire):
    Item.objects.filter(pk=wire.pk).update(selling_price=D("28"))
    bill = staff_api.post(
        "/api/sales/invoices",
        {"customer": customer.pk, "lines": [{"item": wire.pk, "unit": wire.units.get(name="m").pk, "quantity": "1"}]},
        format="json",
    ).data
    staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "28"}]}, format="json")
    assert Payment.objects.get().receipt_number is None


class TestCancelReceipt:
    def test_owner_cancels_mistyped_receipt(self, staff_api, owner_api, customer):
        owner_api.post(url(customer, "opening"), {"amount": "3500"}, format="json")
        receipt = staff_api.post(url(customer, "payments"), {"amount": "35001000"}, format="json").data  # typo
        assert staff_api.post(f"/api/sales/receipts/{receipt['id']}/cancel", {"reason": "typo"}, format="json").status_code == 403
        assert owner_api.post(f"/api/sales/receipts/{receipt['id']}/cancel", {"reason": " "}, format="json").status_code == 400
        response = owner_api.post(f"/api/sales/receipts/{receipt['id']}/cancel", {"reason": "Typed 3500 + 1000"}, format="json")
        assert response.status_code == 200 and response.data["cancelled_at"]
        assert customer.balance() == D("3500")
        lines = staff_api.get(url(customer, "ledger")).data["lines"]
        assert [line["kind"] for line in lines] == ["opening", "payment", "receipt_cancelled"]
        assert lines[1]["receipt_cancelled"] is True
        assert owner_api.post(f"/api/sales/receipts/{receipt['id']}/cancel", {"reason": "again"}, format="json").status_code == 400
