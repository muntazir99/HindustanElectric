"""Sales and profit (plan §16.2). 0% GST items keep the arithmetic easy to check by hand."""

import io
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from openpyxl import load_workbook

from catalog.models import Item, Product
from sales.models import Invoice
from stock.models import Adjustment
from stock.services import create_adjustment

pytestmark = pytest.mark.django_db
D = Decimal


def no_gst_item(make_item, owner, name, price, cost=None, **packs):
    item = make_item(product=name, base_unit="m" if name == "Wire" else "pc", **packs)
    Product.objects.filter(pk=item.product_id).update(gst_rate=D("0"))
    Item.objects.filter(pk=item.pk).update(selling_price=D(price), cost_price=D(cost) if cost else None)
    create_adjustment(item.pk, D("100"), Adjustment.Reason.CORRECTION, owner)
    return Item.objects.get(pk=item.pk)


def sell(client, item, quantity):
    unit = item.units.get(is_base=True)
    draft = client.post("/api/sales/invoices", {"lines": [{"item": item.pk, "unit": unit.pk, "quantity": str(quantity)}]}, format="json").data
    return client.post(f"/api/sales/invoices/{draft['id']}/finalise", {"payments": [{"mode": "cash", "amount": draft["total"]}]}, format="json").data


@pytest.fixture
def month(staff_api, owner_api, owner, make_item):
    """This month: 10 m of wire (₹30/m, cost ₹20) and an old MCB with no cost yet (₹50); then 2 m come back."""
    wire = no_gst_item(make_item, owner, "Wire", "30", cost="20")
    mcb = no_gst_item(make_item, owner, "Old MCB", "50")
    bill = sell(staff_api, wire, 10)
    sell(staff_api, mcb, 1)
    owner_api.post(
        f"/api/sales/invoices/{bill['id']}/returns",
        {"lines": [{"line": bill["lines"][0]["id"], "quantity": "2"}], "refund_mode": "cash", "reason": "Extra"},
        format="json",
    )
    return wire, mcb


def test_sales_returns_and_profit_add_up(owner_api, month):
    report = owner_api.get("/api/sales/report").json()
    summary = report["summary"]
    assert (summary["bills"], summary["sales"], summary["returns"], summary["net_sales"]) == (2, "350.00", "60.00", "290.00")
    # Profit on what had a cost: (300 − 60) sold − (200 − 40) cost = 80, i.e. 33.3% of 240.
    assert (summary["profit"], summary["margin"]) == ("80.00", "33.3")
    assert summary["unknown_cost_sales"] == "50.00"  # the old MCB: never guessed
    assert summary["gst"] == "0.00"

    items = {row["name"]: row for row in report["by_item"]}
    wire = next(row for name, row in items.items() if "Wire" in name)
    assert (wire["quantity"], wire["net_sales"], wire["profit"], wire["margin"]) == ("8", "240.00", "80.00", "33.3")
    mcb = next(row for name, row in items.items() if "Old MCB" in name)
    assert (mcb["profit"], mcb["margin"], mcb["unknown_cost_sales"]) == (None, None, "50.00")  # unknown, not zero

    [today] = report["by_period"]
    assert today["period"] == timezone.localdate().isoformat() and today["profit"] == "80.00"
    [category] = report["by_category"]
    assert category["category"] == "No category" and category["net_sales"] == "290.00"


def test_without_see_costs_there_is_no_profit(staff_api, month):
    report = staff_api.get("/api/sales/report").json()  # the test staff may see sales, not costs
    assert report["summary"]["net_sales"] == "290.00"
    assert "profit" not in report["summary"] and "profit" not in report["by_item"][0]


def test_other_months_and_cancelled_bills_are_left_out(owner_api, month):
    Invoice.objects.filter(lines__description__contains="Old MCB").update(
        invoice_date=timezone.localdate().replace(day=1) - timedelta(days=1)
    )
    assert owner_api.get("/api/sales/report").json()["summary"]["sales"] == "300.00"


def test_excel_download(owner_api, month):
    response = owner_api.get("/api/sales/report?download=xlsx")
    assert response["Content-Type"].startswith("application/vnd.openxmlformats")
    book = load_workbook(io.BytesIO(response.content))
    assert book.sheetnames == ["Summary", "By day", "By item", "By category"]
    rows = {row[0]: row[1] for row in book["Summary"].iter_rows(values_only=True)}
    assert rows["Profit"] == 80.0 and rows["Net sales"] == 290.0


def test_a_long_or_backwards_period_is_refused(owner_api):
    assert owner_api.get("/api/sales/report?from=2026-10-31&to=2026-10-01").status_code == 400
    assert owner_api.get("/api/sales/report?from=2024-01-01&to=2026-10-01").status_code == 400


def test_round_quantities_read_plainly(owner_api, owner, make_item, staff_api):
    wire = no_gst_item(make_item, owner, "Wire", "30", cost="20")
    sell(staff_api, wire, 90)  # 90 m, not "9E+1"
    [row] = owner_api.get("/api/sales/report").json()["by_item"]
    assert row["quantity"] == "90"
