from decimal import Decimal

import pytest

from catalog.models import Category, Item, ItemUnit, Product
from stock.models import Adjustment, StockCount
from stock.services import count_item, create_adjustment, post_count

pytestmark = pytest.mark.django_db
D = Decimal

WIRE_PRODUCT = {
    "name": "Lifeline Plus HRFR wire",
    "brand": "Havells",
    "hsn_code": "8544",
    "gst_rate": "18",
    "base_unit": "m",
    "pack": {"name": "coil", "factor": "90"},
    "variants": [
        {"variant": "1.5 sq mm Red", "selling_price": "28", "pack_barcode": "111", "pack_price": "2400", "rack": "W1"},
        {"variant": "1.5 sq mm Black", "selling_price": "28", "pack_barcode": "112", "pack_price": "2400", "rack": "W1"},
    ],
}


@pytest.mark.parametrize(
    "method, url",
    [
        ("get", "/api/catalog/items"),
        ("get", "/api/catalog/items/1"),
        ("get", "/api/catalog/products"),
        ("post", "/api/catalog/products"),
        ("get", "/api/catalog/lookup?code=1"),
        ("get", "/api/catalog/categories"),
        ("get", "/api/catalog/brands"),
        ("patch", "/api/catalog/units/1"),
        ("get", "/api/stock/summary"),
        ("get", "/api/stock/counts"),
        ("get", "/api/stock/adjustments"),
        ("get", "/api/purchases/bills"),
        ("get", "/api/purchases/suppliers"),
        ("get", "/api/import/catalogue/template"),
        ("post", "/api/import/catalogue"),
    ],
)
def test_every_endpoint_needs_login(api, method, url):
    assert getattr(api, method)(url).status_code == 401


class TestCreateProduct:
    def test_staff_creates_product_with_variants_and_packs(self, staff_api):
        response = staff_api.post("/api/catalog/products", WIRE_PRODUCT, format="json")
        assert response.status_code == 201, response.data
        assert len(response.data["items"]) == 2
        red = Item.objects.get(variant="1.5 sq mm Red")
        assert red.name == "Havells Lifeline Plus HRFR wire 1.5 sq mm Red"
        assert red.base_unit == "m"
        coil = red.units.get(name="coil")
        assert (coil.factor, coil.barcode, coil.selling_price) == (D("90"), "111", D("2400"))

    def test_existing_product_points_to_add_variants(self, staff_api):
        staff_api.post("/api/catalog/products", WIRE_PRODUCT, format="json")
        response = staff_api.post("/api/catalog/products", {**WIRE_PRODUCT, "brand": "havells"}, format="json")
        assert response.status_code == 400
        assert response.data["product_id"] == Product.objects.get().pk

    def test_barcode_clash_creates_nothing(self, staff_api, wire):
        payload = {**WIRE_PRODUCT, "variants": [{**WIRE_PRODUCT["variants"][0], "pack_barcode": "8901030000011"}]}
        response = staff_api.post("/api/catalog/products", payload, format="json")
        assert response.status_code == 400
        assert "already used by" in response.data["detail"]
        assert not Product.objects.filter(name="Lifeline Plus HRFR wire").exists()

    def test_gst_rate_accepts_returned_format(self, staff_api):
        response = staff_api.post("/api/catalog/products", {**WIRE_PRODUCT, "gst_rate": "18.00"}, format="json")
        assert response.status_code == 201

    def test_invalid_gst_rate_is_rejected(self, staff_api):
        response = staff_api.post("/api/catalog/products", {**WIRE_PRODUCT, "gst_rate": "15"}, format="json")
        assert response.status_code == 400
        assert "gst_rate" in response.data

    def test_add_variants_to_existing_product(self, staff_api, wire):
        response = staff_api.post(
            f"/api/catalog/products/{wire.product_id}/variants",
            {"base_unit": "m", "variants": [{"variant": "2.5 sq mm Red"}]},
            format="json",
        )
        assert response.status_code == 201
        assert wire.product.items.count() == 2

    def test_only_owner_edits_hsn_and_gst(self, staff_api, owner_api, wire):
        url = f"/api/catalog/products/{wire.product_id}"
        assert staff_api.patch(url, {"gst_rate": "5"}, format="json").status_code == 403
        assert owner_api.patch(url, {"gst_rate": "5"}, format="json").status_code == 200
        assert Product.objects.get(pk=wire.product_id).gst_rate == D("5")


class TestItemList:
    def test_search_matches_all_words_in_any_order(self, staff_api, wire, make_item):
        make_item(product="Batten holder", brand="Anchor")
        response = staff_api.get("/api/catalog/items?search=red havells")
        assert [row["id"] for row in response.data["results"]] == [wire.pk]

    def test_search_finds_barcode(self, staff_api, wire):
        response = staff_api.get("/api/catalog/items?search=8901030000011")
        assert response.data["count"] == 1

    def test_status_filters(self, staff_api, owner, wire, make_item):
        switch = make_item(product="Switch", min_stock=D("10"))
        make_item(product="Fan", min_stock=D("10"))  # not counted: never "low"
        count = StockCount.objects.create(title="S1", created_by=owner)
        count_item(count, switch.pk, D("4"), owner)
        post_count(count, owner)
        low = staff_api.get("/api/catalog/items?status=low").data["results"]
        assert [row["id"] for row in low] == [switch.pk]
        assert low[0]["is_low"] is True
        assert staff_api.get("/api/catalog/items?status=not_counted").data["count"] == 2

    def test_category_filter_includes_subcategories(self, staff_api, wire):
        parent = Category.objects.create(name="Wires & Cables")
        child = Category.objects.create(name="House wire", parent=parent)
        Product.objects.filter(pk=wire.product_id).update(category=child)
        assert staff_api.get(f"/api/catalog/items?category={parent.pk}").data["count"] == 1

    def test_inactive_items_hidden_by_default(self, staff_api, wire):
        Item.objects.filter(pk=wire.pk).update(is_active=False)
        assert staff_api.get("/api/catalog/items").data["count"] == 0
        assert staff_api.get("/api/catalog/items?status=inactive").data["count"] == 1

    def test_stock_shown_in_packs(self, staff_api, owner, wire):
        create_adjustment(wire.pk, D("395"), Adjustment.Reason.CORRECTION, owner)
        row = staff_api.get(f"/api/catalog/items/{wire.pk}").data
        assert row["stock_display"] == "4 coil + 35 m"


class TestCostIsOwnerOnly:
    def test_staff_never_sees_cost(self, staff_api, owner, wire):
        Item.objects.filter(pk=wire.pk).update(cost_price=D("10"))
        create_adjustment(wire.pk, D("5"), Adjustment.Reason.CORRECTION, owner)
        assert "cost_price" not in staff_api.get(f"/api/catalog/items/{wire.pk}").data
        assert "cost_price" not in staff_api.get("/api/catalog/items").data["results"][0]
        movements = staff_api.get(f"/api/catalog/items/{wire.pk}/movements").data["results"]
        assert "unit_cost" not in movements[0]

    def test_owner_sees_cost(self, owner_api, wire):
        Item.objects.filter(pk=wire.pk).update(cost_price=D("10"))
        assert owner_api.get(f"/api/catalog/items/{wire.pk}").data["cost_price"] == "10.0000"


class TestEditItem:
    def test_staff_can_edit_rack_but_not_price(self, staff_api, wire):
        url = f"/api/catalog/items/{wire.pk}"
        assert staff_api.patch(url, {"rack": "B2"}, format="json").status_code == 200
        response = staff_api.patch(url, {"selling_price": "1"}, format="json")
        assert response.status_code == 400
        assert "selling_price" in response.data
        wire.refresh_from_db()
        assert (wire.rack, wire.selling_price) == ("B2", None)

    def test_owner_changes_price_and_deactivates(self, owner_api, wire):
        response = owner_api.patch(
            f"/api/catalog/items/{wire.pk}", {"selling_price": "29.50", "is_active": False}, format="json"
        )
        assert response.status_code == 200
        wire.refresh_from_db()
        assert (wire.selling_price, wire.is_active) == (D("29.50"), False)

    def test_base_unit_fixed_after_stock_moves(self, owner_api, owner, wire):
        create_adjustment(wire.pk, D("5"), Adjustment.Reason.CORRECTION, owner)
        response = owner_api.patch(f"/api/catalog/items/{wire.pk}", {"base_unit": "ft"}, format="json")
        assert response.status_code == 400
        wire.refresh_from_db()
        assert wire.base_unit == "m"

    def test_cost_and_stock_cannot_be_edited(self, owner_api, wire):
        owner_api.patch(f"/api/catalog/items/{wire.pk}", {"stock_qty": "999", "cost_price": "1"}, format="json")
        wire.refresh_from_db()
        assert (wire.stock_qty, wire.cost_price) == (D("0"), None)


class TestUnitsAndLookup:
    def test_lookup_by_pack_barcode_returns_pack(self, staff_api, wire):
        response = staff_api.get("/api/catalog/lookup?code=8901030000011")
        assert response.data["item"]["id"] == wire.pk
        assert response.data["unit_id"] == wire.units.get(name="coil").pk

    def test_lookup_by_item_code_returns_base_unit(self, staff_api, wire):
        response = staff_api.get(f"/api/catalog/lookup?code={wire.code}")
        assert response.data["unit_id"] == wire.units.get(is_base=True).pk

    def test_lookup_unknown_code(self, staff_api):
        assert staff_api.get("/api/catalog/lookup?code=nope").status_code == 404

    def test_add_pack_and_set_base_barcode(self, staff_api, make_item):
        screw = make_item(product="Screw", variant="1 inch")
        response = staff_api.post(f"/api/catalog/items/{screw.pk}/units", {"name": "box", "factor": "100"}, format="json")
        assert response.status_code == 201
        base = screw.units.get(is_base=True)
        assert staff_api.patch(f"/api/catalog/units/{base.pk}", {"barcode": "555"}, format="json").status_code == 200
        assert ItemUnit.objects.get(pk=base.pk).barcode == "555"

    def test_base_unit_takes_only_barcode(self, owner_api, wire):
        base = wire.units.get(is_base=True)
        response = owner_api.patch(f"/api/catalog/units/{base.pk}", {"factor": "2"}, format="json")
        assert response.status_code == 400

    def test_used_pack_cannot_be_removed_or_resized(self, owner_api, owner, wire, supplier):
        from purchases.models import PurchaseBill, PurchaseLine

        coil = wire.units.get(name="coil")
        bill = PurchaseBill.objects.create(supplier=supplier, bill_number="1", bill_date="2026-10-01", created_by=owner)
        PurchaseLine.objects.create(bill=bill, item=wire, unit=coil, quantity=1, rate=900, gst_rate=18)
        assert owner_api.patch(f"/api/catalog/units/{coil.pk}", {"factor": "100"}, format="json").status_code == 400
        assert owner_api.delete(f"/api/catalog/units/{coil.pk}").status_code == 400
