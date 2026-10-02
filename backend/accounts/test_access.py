"""Staff access switches (docs/PLAN.md §9): each switch allows its jobs when on and refuses them when off."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts import access
from accounts.models import User
from catalog.models import Item
from conftest import PASSWORD, login
from sales.models import Customer

pytestmark = pytest.mark.django_db
D = Decimal


def person(*codes, username="helper"):
    user = User.objects.create_user(username=username, password=PASSWORD, role=User.Role.STAFF, access=list(codes))
    return user, login(APIClient(), user)


@pytest.fixture
def shop(make_item, owner):
    item = make_item(variant="Probe", base_unit="pc", selling_price=D("50"), cost_price=D("40"))
    customer = Customer.objects.create(name="Ramesh", created_by=owner)
    return {"item": item, "customer": customer}


def requests_for(shop):
    """One representative request per switch: (method, url, body)."""
    item, customer = shop["item"], shop["customer"]
    return {
        access.BILLING: ("post", "/api/sales/invoices", {"lines": []}),
        access.PAYMENTS: ("post", f"/api/sales/customers/{customer.pk}/payments", {"amount": "10", "mode": "cash"}),
        access.PURCHASES: ("get", "/api/purchases/bills", {}),
        access.ADD_ITEMS: ("post", "/api/catalog/brands", {"name": "Anchor"}),
        access.COUNT_STOCK: ("post", "/api/stock/counts", {"title": "Rack A"}),
        access.VIEW_BILLS: ("get", "/api/sales/invoices", {}),
        access.VIEW_KHATA: ("get", f"/api/sales/customers/{customer.pk}/ledger", {}),
        access.RETURNS: ("post", "/api/sales/invoices/999999/cancel", {"reason": "x"}),
        access.EDIT_ITEMS: ("patch", f"/api/catalog/products/{item.product_id}", {"gst_rate": "18"}),
        access.FIX_STOCK: ("get", "/api/stock/adjustments", {}),
        access.KHATA_CONTROL: ("post", f"/api/sales/customers/{customer.pk}/adjust", {"amount": "5", "note": "x"}),
        access.IMPORT: ("post", "/api/import/catalogue", {}),
    }


@pytest.mark.parametrize("code", sorted(set(access.CODES) - {access.VIEW_SALES, access.LOW_PRICES, access.SEE_COSTS}))
def test_each_switch_allows_its_job_and_nothing_without_it(shop, code):
    method, url, body = requests_for(shop)[code]
    _, with_switch = person(code, username="with")
    _, without = person(username="without")
    assert getattr(with_switch, method)(url, body, format="json").status_code != 403
    response = getattr(without, method)(url, body, format="json")
    assert response.status_code == 403
    assert "Ask the owner" in response.data["detail"]


def test_no_switches_still_finds_items_and_prints(shop):
    _, nobody = person()
    assert nobody.get("/api/catalog/items").status_code == 200
    assert nobody.get(f"/api/catalog/lookup?code={shop['item'].code}").status_code == 200
    assert nobody.get("/api/shop/settings").status_code == 200
    assert nobody.get("/api/auth/me").data["data"]["access"] == []
    assert nobody.get("/api/sales/invoices").status_code == 403


def test_billing_alone_sees_kept_for_later_but_not_old_bills(shop):
    _, counter = person(access.BILLING)
    assert counter.get("/api/sales/invoices?status=held").status_code == 200
    assert counter.get("/api/sales/invoices").status_code == 403


def test_returns_can_find_the_bill(shop):
    _, returns = person(access.RETURNS)
    assert returns.get("/api/sales/invoices?search=HE").status_code == 200


def test_todays_numbers_follow_the_switches(shop):
    _, counter = person(access.BILLING)
    data = counter.get("/api/sales/today").data
    assert "held_bills" in data and "sales" not in data and "udhaar_outstanding" not in data
    _, manager = person(access.VIEW_SALES, access.VIEW_KHATA, username="manager")
    data = manager.get("/api/sales/today").data
    assert "sales" in data and "udhaar_outstanding" in data and "held_bills" not in data


def test_costs_only_with_see_costs(shop):
    item_url = f"/api/catalog/items/{shop['item'].pk}"
    _, plain = person(access.BILLING)
    _, boss = person(access.SEE_COSTS, username="boss")
    assert "cost_price" not in plain.get(item_url).data
    assert boss.get(item_url).data["cost_price"] == "40.0000"
    assert "stock_value" in boss.get("/api/stock/summary").data
    assert "stock_value" not in plain.get("/api/stock/summary").data


def test_prices_need_change_prices_switch(shop):
    item_url = f"/api/catalog/items/{shop['item'].pk}"
    _, adder = person(access.ADD_ITEMS)
    assert adder.patch(item_url, {"rack": "S2"}, format="json").status_code == 200
    assert adder.patch(item_url, {"selling_price": "1"}, format="json").status_code == 400
    _, pricer = person(access.EDIT_ITEMS, username="pricer")
    assert pricer.patch(item_url, {"selling_price": "60"}, format="json").status_code == 200


def test_price_updates_from_excel_need_change_prices_not_upload(shop):
    _, uploader = person(access.IMPORT)
    assert uploader.post("/api/import/prices", {}, format="multipart").status_code == 403
    _, pricer = person(access.EDIT_ITEMS, username="pricer")
    assert pricer.post("/api/import/prices", {}, format="multipart").status_code == 400  # allowed; no file sent


def test_low_prices_switch(shop):
    item = shop["item"]

    def bill_at(client, rate):
        draft = client.post(
            "/api/sales/invoices",
            {"lines": [{"item": item.pk, "unit": item.units.get(is_base=True).pk, "quantity": "1", "rate": rate}]},
            format="json",
        ).data
        return client.post(f"/api/sales/invoices/{draft['id']}/finalise", {"payments": [{"mode": "cash", "amount": draft["total"]}]}, format="json")

    _, counter = person(access.BILLING)
    refused = bill_at(counter, "20")
    assert refused.status_code == 400 and "too low" in refused.data["detail"]
    _, trusted = person(access.BILLING, access.LOW_PRICES, username="trusted")
    allowed = bill_at(trusted, "20")
    assert allowed.status_code == 200
    assert f"{item.name} is sold below its cost." in allowed.data["warnings"]
    assert "₹40" not in " ".join(allowed.data["warnings"])  # no cost figure without See costs


def test_switch_change_applies_at_once(shop):
    user, client = person()
    assert client.get("/api/sales/invoices").status_code == 403
    user.access = [access.VIEW_BILLS]
    user.save()
    assert client.get("/api/sales/invoices").status_code == 200  # same login, no need to log in again


def test_owner_always_has_everything(owner_api):
    assert owner_api.get("/api/auth/me").data["data"]["access"] == access.CODES


class TestStaffAndAccess:
    def test_only_owner_manages_staff(self, staff_api, owner_api):
        assert staff_api.get("/api/auth/staff").status_code == 403
        assert staff_api.get("/api/auth/access").status_code == 403
        assert owner_api.get("/api/auth/staff").status_code == 200
        switches = owner_api.get("/api/auth/access").data
        assert [s["code"] for s in switches["switches"]] == access.CODES
        assert switches["presets"]["Counter"] == access.NEW_STAFF

    def test_new_staff_start_with_counter_set(self, owner_api):
        response = owner_api.post(
            "/api/auth/staff", {"username": "raju", "name": "Raju", "password": "Counter-pass-22"}, format="json"
        )
        assert response.status_code == 201
        assert response.data["access"] == access.NEW_STAFF
        assert User.objects.get(username="raju").first_name == "Raju"

    def test_owner_chooses_switches(self, owner_api):
        response = owner_api.post(
            "/api/auth/staff",
            {"username": "store1", "password": "Counter-pass-22", "access": ["count_stock", "purchases", "count_stock"]},
            format="json",
        )
        assert response.data["access"] == ["purchases", "count_stock"]  # standard order, no repeats

    def test_unknown_switch_rejected(self, owner_api, staff):
        response = owner_api.patch(f"/api/auth/staff/{staff.pk}", {"access": ["fly"]}, format="json")
        assert response.status_code == 400

    def test_turning_switches_off(self, owner_api, staff, staff_api):
        owner_api.patch(f"/api/auth/staff/{staff.pk}", {"access": [access.BILLING]}, format="json")
        assert staff_api.get("/api/purchases/bills").status_code == 403

    def test_switching_a_login_off(self, owner_api, staff, staff_api, api):
        assert owner_api.patch(f"/api/auth/staff/{staff.pk}", {"is_active": False}, format="json").status_code == 200
        assert staff_api.get("/api/auth/me").status_code == 401
        assert api.post("/api/auth/login", {"username": "staff", "password": PASSWORD}, format="json").status_code == 401

    def test_owner_cannot_switch_off_own_login(self, owner_api, owner):
        response = owner_api.patch(f"/api/auth/staff/{owner.pk}", {"is_active": False}, format="json")
        assert response.status_code == 400

    def test_reset_password(self, owner_api, staff, api):
        assert owner_api.post(f"/api/auth/staff/{staff.pk}/password", {"password": "12345678"}, format="json").status_code == 400
        assert owner_api.post(f"/api/auth/staff/{staff.pk}/password", {"password": "Fresh-pass-2026"}, format="json").status_code == 200
        response = api.post("/api/auth/login", {"username": "staff", "password": "Fresh-pass-2026"}, format="json")
        assert response.status_code == 200
        assert response.data["access"] == access.STAFF_BEFORE_SWITCHES
