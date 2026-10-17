"""Purchase orders (plan §18)."""

import pytest
from django.utils import timezone

from accounts.models import User
from conftest import login
from rest_framework.test import APIClient
from sales.numbering import financial_year_label

pytestmark = pytest.mark.django_db
FY = financial_year_label(timezone.localdate())


def order_payload(supplier, wire, quantity="2"):
    return {"supplier": supplier.pk, "lines": [{"item": wire.pk, "unit": wire.units.get(name="coil").pk, "quantity": quantity}]}


def test_an_order_is_numbered_and_holds_no_rates(staff_api, supplier, wire):
    response = staff_api.post("/api/purchases/orders", {**order_payload(supplier, wire), "note": "Before Diwali"}, format="json")
    assert response.status_code == 201, response.data
    order = response.data
    assert (order["number"], order["status"], order["supplier_name"]) == (f"PO/{FY}/00001", "draft", "Sharma Distributors")
    [line] = order["lines"]
    assert (line["unit_name"], line["quantity"]) == ("coil", "2.000")
    assert "rate" not in line
    second = staff_api.post("/api/purchases/orders", order_payload(supplier, wire), format="json").data
    assert second["number"] == f"PO/{FY}/00002"


def test_draft_can_change_then_sent_cannot(staff_api, supplier, wire):
    order = staff_api.post("/api/purchases/orders", order_payload(supplier, wire), format="json").data
    changed = staff_api.patch(f"/api/purchases/orders/{order['id']}", order_payload(supplier, wire, "5"), format="json")
    assert changed.data["lines"][0]["quantity"] == "5.000"
    sent = staff_api.post(f"/api/purchases/orders/{order['id']}/send").data
    assert sent["status"] == "sent" and sent["sent_at"]
    assert staff_api.patch(f"/api/purchases/orders/{order['id']}", {"note": "x"}, format="json").status_code == 400
    assert staff_api.post(f"/api/purchases/orders/{order['id']}/cancel").data["status"] == "cancelled"
    assert staff_api.post(f"/api/purchases/orders/{order['id']}/send").status_code == 400


def test_bad_lines_are_refused(staff_api, supplier, wire, make_item):
    other = make_item(product="MCB")
    payload = order_payload(supplier, wire)
    payload["lines"][0]["unit"] = other.units.get().pk
    assert staff_api.post("/api/purchases/orders", payload, format="json").status_code == 400
    assert staff_api.post("/api/purchases/orders", {"supplier": supplier.pk, "lines": []}, format="json").status_code == 400


def test_open_orders_list_and_who_may_order(staff_api, supplier, wire, db):
    first = staff_api.post("/api/purchases/orders", order_payload(supplier, wire), format="json").data
    staff_api.post("/api/purchases/orders", order_payload(supplier, wire), format="json")
    staff_api.post(f"/api/purchases/orders/{first['id']}/cancel")
    listed = staff_api.get("/api/purchases/orders?status=open").data["results"]
    assert [row["number"] for row in listed] == [f"PO/{FY}/00002"]

    counter = User.objects.create_user(username="counter", password="Counter-test-pass-1", role=User.Role.STAFF, access=["billing"])
    assert login(APIClient(), counter).get("/api/purchases/orders").status_code == 403


def bill_from(order, supplier, quantity, number="INV-9"):
    line = order["lines"][0]
    return {
        "supplier": supplier.pk, "bill_number": number, "bill_date": "2026-10-10", "order": order["id"],
        "lines": [{"item": line["item"], "unit": line["unit"], "quantity": quantity, "rate": "1000"}],
    }


def test_goods_arrived_from_an_order_marks_it_received(staff_api, supplier, wire):
    order = staff_api.post("/api/purchases/orders", order_payload(supplier, wire, "3"), format="json").data
    assert order["lines"][0]["gst_rate"] == "18.00"  # Goods Arrived fills GST from the order
    staff_api.post(f"/api/purchases/orders/{order['id']}/send")
    bill = staff_api.post("/api/purchases/bills", bill_from(order, supplier, "2"), format="json").data
    assert (bill["order"], bill["order_number"]) == (order["id"], order["number"])
    assert staff_api.get(f"/api/purchases/orders/{order['id']}").data["status"] == "sent"  # not until it's added to stock

    staff_api.post(f"/api/purchases/bills/{bill['id']}/post")
    after = staff_api.get(f"/api/purchases/orders/{order['id']}").data
    assert after["status"] == "received"
    assert after["received"] == {str(wire.pk): "180"}  # 2 of the 3 coils came: 180 m
    assert after["bills"] == [{"id": bill["id"], "bill_number": "INV-9", "status": "posted"}]
    # Received or cancelled orders can't be used again.
    again = staff_api.post("/api/purchases/bills", bill_from(order, supplier, "1", "INV-10"), format="json")
    assert again.status_code == 400 and "received" in str(again.data["order"])


def test_an_order_only_fills_its_own_distributors_bill(staff_api, supplier, wire):
    from purchases.models import Supplier

    order = staff_api.post("/api/purchases/orders", order_payload(supplier, wire), format="json").data
    other = Supplier.objects.create(name="Gupta Traders")
    response = staff_api.post("/api/purchases/bills", {**bill_from(order, supplier, "1"), "supplier": other.pk}, format="json")
    assert response.status_code == 400 and "Sharma Distributors" in str(response.data["order"])
