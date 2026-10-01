from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Item
from sales.models import Customer, Invoice
from sales.numbering import financial_year_label
from stock.models import Adjustment
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal
FY = financial_year_label(timezone.localdate())


@pytest.fixture
def stocked_wire(wire, owner):
    Item.objects.filter(pk=wire.pk).update(selling_price=D("28"), cost_price=D("20"))
    wire.units.filter(name="coil").update(selling_price=D("2400"))
    create_adjustment(wire.pk, D("400"), Adjustment.Reason.CORRECTION, owner)
    return wire


def lines_for(wire, unit="coil", quantity="1", **extra):
    return [{"item": wire.pk, "unit": wire.units.get(name=unit).pk, "quantity": quantity, **extra}]


@pytest.mark.parametrize(
    "method, url",
    [("get", "/api/sales/invoices"), ("post", "/api/sales/invoices"), ("get", "/api/sales/invoices/current"),
     ("get", "/api/sales/customers"), ("post", "/api/sales/customers")],
)
def test_needs_login(api, method, url):
    assert getattr(api, method)(url).status_code == 401


class TestCounterFlow:
    def test_draft_then_autosave_then_finalise(self, staff_api, stocked_wire):
        created = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json")
        assert created.status_code == 201, created.data
        bill_id = created.data["id"]
        assert (created.data["status"], created.data["number"], created.data["total"]) == ("draft", None, "2400.00")
        line = created.data["lines"][0]
        assert (line["rate"], line["unit_name"], line["item_stock"]["display"]) == ("2400.00", "coil", "4 coil + 40 m")

        # Autosave: quantity 2, unit changed to metres with no rate -> shelf price per metre is used.
        updated = staff_api.put(
            f"/api/sales/invoices/{bill_id}",
            {"lines": lines_for(stocked_wire, "coil", "2") + lines_for(stocked_wire, "m", "12.5")},
            format="json",
        )
        assert updated.data["total"] == "5150.00"  # 4800 + 350 (12.5 × 28)
        assert len(updated.data["lines"]) == 2

        final = staff_api.post(
            f"/api/sales/invoices/{bill_id}/finalise",
            {"payments": [{"mode": "cash", "amount": "5000"}, {"mode": "upi", "amount": "150"}]},
            format="json",
        )
        assert final.status_code == 200, final.data
        assert final.data["number"] == f"HE/{FY}/00001"
        assert final.data["warnings"] == []
        assert final.data["amount_in_words"] == "Rupees Five Thousand One Hundred Fifty Only"
        assert sorted((p["mode"], p["amount"]) for p in final.data["payments"]) == [("cash", "5000.00"), ("upi", "150.00")]
        summary = final.data["tax_summary"]
        assert summary[0]["rate"] == "18.00"
        # CGST takes the odd paisa, SGST the rest; together they are exactly the tax.
        assert D(summary[0]["tax"]) == D(final.data["cgst_total"]) + D(final.data["sgst_total"])

        # A finalised bill can't be edited or deleted.
        assert staff_api.put(f"/api/sales/invoices/{bill_id}", {"lines": []}, format="json").status_code == 400
        assert staff_api.delete(f"/api/sales/invoices/{bill_id}").status_code == 400

    def test_errors_come_back_as_messages(self, staff_api, stocked_wire):
        bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json").data
        response = staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "100"}]}, format="json")
        assert response.status_code == 400
        assert "Choose a customer" in response.data["detail"]

    def test_below_cost_line_is_flagged_without_cost(self, staff_api, stocked_wire):
        bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire, "m", "10", rate="15")}, format="json").data
        line = bill["lines"][0]
        assert line["below_cost"] is True
        assert "cost_price" not in str(bill)

    def test_resume_current_bill_and_held_bills(self, staff_api, stocked_wire):
        assert staff_api.get("/api/sales/invoices/current").status_code == 204
        held = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire), "held": True, "buyer_name": "Ramesh"}, format="json").data
        working = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire, "m", "3")}, format="json").data
        assert staff_api.get("/api/sales/invoices/current").data["id"] == working["id"]
        held_list = staff_api.get("/api/sales/invoices?status=held").data["results"]
        assert [bill["id"] for bill in held_list] == [held["id"]]
        assert held_list[0]["buyer_name"] == "Ramesh"

    def test_other_state_place_of_supply(self, staff_api, stocked_wire):
        bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire), "place_of_supply": "09"}, format="json").data
        assert bill["igst_total"] != "0.00" and bill["cgst_total"] == "0.00"
        assert bill["place_of_supply_label"] == "Uttar Pradesh (09)"

    def test_unknown_state_refused(self, staff_api, stocked_wire):
        response = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire), "place_of_supply": "99"}, format="json")
        assert response.status_code == 400


class TestPermissions:
    def test_only_owner_cancels(self, staff_api, owner_api, stocked_wire):
        bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json").data
        staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "2400"}]}, format="json")
        assert staff_api.post(f"/api/sales/invoices/{bill['id']}/cancel", {"reason": "x"}, format="json").status_code == 403
        response = owner_api.post(f"/api/sales/invoices/{bill['id']}/cancel", {"reason": "Wrong item"}, format="json")
        assert (response.status_code, response.data["status"]) == (200, "cancelled")

    def test_staff_deletes_only_own_drafts(self, staff_api, owner_api, stocked_wire):
        owners = owner_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json").data
        staffs = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json").data
        assert staff_api.delete(f"/api/sales/invoices/{owners['id']}").status_code == 403
        assert staff_api.delete(f"/api/sales/invoices/{staffs['id']}").status_code == 204


class TestBillList:
    def test_search_and_status(self, staff_api, owner_api, stocked_wire):
        for name in ("Ramesh", "Suresh"):
            bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire), "buyer_name": name}, format="json").data
            staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "2400"}]}, format="json")
        staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json")  # draft
        finals = staff_api.get("/api/sales/invoices").data["results"]
        assert [bill["buyer_name"] for bill in finals] == ["Suresh", "Ramesh"]
        assert staff_api.get("/api/sales/invoices?search=sures").data["count"] == 1
        assert staff_api.get(f"/api/sales/invoices?search=00001").data["results"][0]["buyer_name"] == "Ramesh"


class TestCustomers:
    def test_staff_adds_customer_but_not_credit_terms(self, staff_api):
        response = staff_api.post("/api/sales/customers", {"name": "Ramesh", "phone": "98765 43210", "kind": "electrician"}, format="json")
        assert response.status_code == 201
        assert response.data["phone"] == "9876543210"
        blocked = staff_api.post("/api/sales/customers", {"name": "X", "credit_limit": "5000"}, format="json")
        assert blocked.status_code == 400
        assert "credit_limit" in blocked.data

    def test_owner_sets_credit_terms(self, owner_api):
        response = owner_api.post(
            "/api/sales/customers", {"name": "Big Contractor", "credit_limit": "50000", "default_discount_percent": "5"}, format="json"
        )
        assert (response.status_code, response.data["credit_limit"]) == (201, "50000.00")

    def test_list_shows_balance_and_searches_phone(self, staff_api, stocked_wire, owner):
        customer = Customer.objects.create(name="Ramesh", phone="9876543210", created_by=owner)
        bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire), "customer": customer.pk}, format="json").data
        staff_api.post(f"/api/sales/invoices/{bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "400"}]}, format="json")
        found = staff_api.get("/api/sales/customers?search=43210").data["results"]
        assert [(c["name"], c["balance"]) for c in found] == [("Ramesh", "2000.00")]
        assert staff_api.get("/api/sales/customers?owing=1").data["count"] == 1
        assert Invoice.objects.get().buyer_name == "Ramesh"


class TestToday:
    def test_counter_numbers(self, staff_api, owner_api, stocked_wire, owner):
        customer = Customer.objects.create(name="Ramesh", created_by=owner)
        cash_bill = staff_api.post("/api/sales/invoices", {"lines": lines_for(stocked_wire)}, format="json").data
        staff_api.post(f"/api/sales/invoices/{cash_bill['id']}/finalise", {"payments": [{"mode": "cash", "amount": "2400"}]}, format="json")
        khata_bill = staff_api.post("/api/sales/invoices", {"customer": customer.pk, "lines": lines_for(stocked_wire)}, format="json").data
        staff_api.post(f"/api/sales/invoices/{khata_bill['id']}/finalise", {"payments": [{"mode": "upi", "amount": "400"}]}, format="json")
        staff_api.post(f"/api/sales/customers/{customer.pk}/payments", {"amount": "500", "mode": "cash"}, format="json")
        owner_api.post(
            f"/api/sales/invoices/{cash_bill['id']}/returns",
            {"lines": [{"line": owner_api.get(f"/api/sales/invoices/{cash_bill['id']}").data["lines"][0]["id"], "quantity": "1"}], "refund_mode": "cash", "reason": "x"},
            format="json",
        )
        data = staff_api.get("/api/sales/today").data
        assert (data["bills"], data["sales"], data["on_khata"], data["khata_collected"]) == (2, "4800.00", "2000.00", "500.00")
        assert data["by_mode"]["cash"] == {"label": "Cash", "received": "2900.00", "refunded": "2400.00", "net": "500.00"}
        assert data["by_mode"]["upi"]["net"] == "400.00"
        assert data["returns"] == "2400.00"
        assert "udhaar_outstanding" not in data
        assert owner_api.get("/api/sales/today").data["udhaar_outstanding"] == "1500.00"
