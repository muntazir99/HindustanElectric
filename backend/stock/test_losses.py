"""Losses: what written-off stock (Fix Stock) cost the shop in a month."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.access import SEE_COSTS
from stock import services
from stock.models import Adjustment

pytestmark = pytest.mark.django_db

THIS_MONTH = timezone.localdate().strftime("%Y-%m")


def write_off(item, quantity, reason, user):
    return services.create_adjustment(item.pk, Decimal(quantity), reason, user)


def test_the_month_s_losses_by_reason_at_the_cost_of_the_day(owner_api, owner, make_item):
    fan = make_item(product="Ceiling fan", cost_price=Decimal("1800"))
    switch = make_item(product="Roma switch", cost_price=Decimal("30"))
    write_off(fan, "-1", Adjustment.Reason.DAMAGED, owner)  # ₹1,800
    write_off(switch, "-5", Adjustment.Reason.DAMAGED, owner)  # ₹150
    write_off(switch, "-2", Adjustment.Reason.LOST, owner)  # ₹60 lost…
    write_off(switch, "1", Adjustment.Reason.LOST, owner)  # …one found again: ₹30 back
    write_off(switch, "-3", Adjustment.Reason.CORRECTION, owner)  # a typing fix, not a loss

    body = owner_api.get(f"/api/stock/losses?month={THIS_MONTH}").json()

    assert body["total"] == "1980.00"
    rows = {row["reason"]: row for row in body["by_reason"]}
    assert rows["damaged"]["value"] == "1950.00" and rows["damaged"]["entries"] == 2
    assert rows["lost"]["value"] == "30.00"
    assert "correction" not in rows


def test_an_item_without_a_cost_is_counted_but_not_guessed(owner_api, owner, make_item):
    old_stock = make_item(product="Old MCB")  # bought before the app: no cost yet
    write_off(old_stock, "-2", Adjustment.Reason.DAMAGED, owner)
    body = owner_api.get("/api/stock/losses").json()
    assert body["total"] == "0.00" and body["uncosted"] == 1


def test_other_months_are_left_out(owner_api, owner, make_item):
    fan = make_item(product="Ceiling fan", cost_price=Decimal("1800"))
    old = write_off(fan, "-1", Adjustment.Reason.DAMAGED, owner)
    Adjustment.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=62))
    assert owner_api.get(f"/api/stock/losses?month={THIS_MONTH}").json()["total"] == "0.00"


def test_only_people_who_may_see_costs(staff_api, staff):
    assert staff_api.get("/api/stock/losses").status_code == 403
    staff.access = [*staff.access, SEE_COSTS]
    staff.save()
    assert staff_api.get("/api/stock/losses").status_code == 200


def test_a_bad_month_is_refused(owner_api):
    assert owner_api.get("/api/stock/losses?month=October").status_code == 400
