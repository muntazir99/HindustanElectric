"""Day-end summary (plan §16.1): one day's closing figures, the same as Home's Today box."""

from decimal import Decimal

import pytest
from django.utils import timezone

from catalog.models import Item
from sales.models import Customer
from stock.models import Adjustment
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal


@pytest.fixture
def stocked_wire(wire, owner):
    Item.objects.filter(pk=wire.pk).update(selling_price=D("30"), cost_price=D("20"))
    create_adjustment(wire.pk, D("400"), Adjustment.Reason.CORRECTION, owner)
    return wire


def bill(client, wire, metres, pay_with=None, customer=None):
    """A bill for `metres` of wire at ₹30/m, paid in full with `pay_with`, or left on the customer's khata."""
    body = {"lines": [{"item": wire.pk, "unit": wire.units.get(name="m").pk, "quantity": str(metres)}]}
    if customer:
        body["customer"] = customer.pk
    draft = client.post("/api/sales/invoices", body, format="json").data
    payments = [{"mode": pay_with, "amount": draft["total"]}] if pay_with else []
    return client.post(f"/api/sales/invoices/{draft['id']}/finalise", {"payments": payments}, format="json").data


def test_a_day_closes_with_the_right_cash(staff_api, owner_api, staff, stocked_wire, owner):
    ramesh = Customer.objects.create(name="Ramesh", created_by=owner)
    first = bill(staff_api, stocked_wire, 10, "cash")  # ₹300 cash, by staff
    bill(staff_api, stocked_wire, 5, "upi")  # ₹150 UPI, by staff
    bill(owner_api, stocked_wire, 20, customer=ramesh)  # ₹600 on udhaar, by the owner
    owner_api.post(f"/api/sales/customers/{ramesh.pk}/payments", {"amount": "100", "mode": "cash"}, format="json")
    owner_api.post(  # 2 m of the first bill comes back: ₹60 cash given back
        f"/api/sales/invoices/{first['id']}/returns",
        {"lines": [{"line": first["lines"][0]["id"], "quantity": "2"}], "refund_mode": "cash", "reason": "Extra"},
        format="json",
    )
    mistake = bill(staff_api, stocked_wire, 1, "cash")  # ₹30 cash, then cancelled: ₹30 given back
    owner_api.post(f"/api/sales/invoices/{mistake['id']}/cancel", {"reason": "Wrong item"}, format="json")
    estimate = staff_api.post("/api/sales/invoices", {"lines": [{"item": stocked_wire.pk, "unit": stocked_wire.units.get(name="m").pk, "quantity": "3"}]}, format="json").data
    staff_api.post(f"/api/sales/invoices/{estimate['id']}/quotation")

    day = owner_api.get("/api/sales/day-end").json()

    assert day["bills"] == 3 and D(day["sales"]) == D("1050")  # the cancelled bill isn't a sale
    assert D(day["cash_in_drawer"]) == D("340")  # 300 + 30 + 100 in, 60 + 30 given back
    cash, upi = day["by_mode"]["cash"], day["by_mode"]["upi"]
    assert (D(cash["received"]), D(cash["refunded"]), D(upi["received"])) == (D("430"), D("90"), D("150"))
    assert D(day["on_khata"]) == D("600") and D(day["khata_collected"]) == D("100")
    assert D(day["returns"]) == D("60")
    assert day["cancelled"]["count"] == 1 and D(day["cancelled"]["total"]) == D("30")
    assert day["estimates"] == 1

    people = {row["name"]: row for row in day["staff"]}
    counter = people[staff.get_full_name() or staff.username]
    assert counter["bills"] == 2 and D(counter["sales"]) == D("450")
    assert D(counter["received"]["cash"]) == D("330") and D(counter["received"]["upi"]) == D("150")
    boss = people[owner.get_full_name() or owner.username]
    assert boss["bills"] == 1 and D(boss["khata_collected"]) == D("100") and D(boss["given_back"]) == D("90")

    # Home's Today box shows the same numbers.
    today = owner_api.get("/api/sales/today").json()
    for key in ("bills", "sales", "returns", "by_mode", "on_khata", "khata_collected"):
        assert today[key] == day[key]


def test_another_day_is_empty(owner_api, staff_api, stocked_wire):
    bill(staff_api, stocked_wire, 10, "cash")
    yesterday = (timezone.localdate() - timezone.timedelta(days=1)).isoformat()
    day = owner_api.get(f"/api/sales/day-end?date={yesterday}").json()
    assert day["bills"] == 0 and day["cash_in_drawer"] == "0" and day["staff"] == []


def test_needs_see_todays_sales(staff_api, staff):
    staff.access = ["billing"]
    staff.save()
    assert staff_api.get("/api/sales/day-end").status_code == 403


def test_a_bad_date_is_refused(owner_api):
    assert owner_api.get("/api/sales/day-end?date=06-10-2026").status_code == 400
