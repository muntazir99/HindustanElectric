from decimal import Decimal

import pytest

pytestmark = pytest.mark.django_db
D = Decimal


class TestAdjustments:
    def test_staff_cannot_adjust(self, staff_api, wire):
        response = staff_api.post(
            "/api/stock/adjustments", {"item": wire.pk, "quantity": "-1", "reason": "lost"}, format="json"
        )
        assert response.status_code == 403
        assert staff_api.get("/api/stock/adjustments").status_code == 403

    def test_adjust_in_packs_is_converted(self, owner_api, wire):
        coil = wire.units.get(name="coil")
        response = owner_api.post(
            "/api/stock/adjustments",
            {"item": wire.pk, "unit": coil.pk, "quantity": "2", "reason": "correction", "note": "opening"},
            format="json",
        )
        assert response.status_code == 201, response.data
        wire.refresh_from_db()
        assert wire.stock_qty == D("180")

    def test_unit_of_other_item_rejected(self, owner_api, wire, make_item):
        other = make_item(product="MCB")
        response = owner_api.post(
            "/api/stock/adjustments",
            {"item": wire.pk, "unit": other.units.get().pk, "quantity": "1", "reason": "other"},
            format="json",
        )
        assert response.status_code == 400


class TestCountFlow:
    def test_staff_counts_blind_owner_reviews_and_posts(self, staff_api, owner_api, wire):
        count_id = staff_api.post("/api/stock/counts", {"title": "Rack W1"}, format="json").data["id"]
        coil = wire.units.get(name="coil")
        for _ in range(2):  # two coil scans
            staff_api.post(
                f"/api/stock/counts/{count_id}/lines",
                {"item": wire.pk, "unit": coil.pk, "quantity": "1", "mode": "add"},
                format="json",
            )
        response = staff_api.post(
            f"/api/stock/counts/{count_id}/lines", {"item": wire.pk, "quantity": "15", "mode": "add"}, format="json"
        )
        assert response.data["counted_qty"] == "195.000"
        assert response.data["counted_display"] == "2 coil + 15 m"
        assert "system_qty" not in response.data and "difference" not in response.data

        assert staff_api.post(f"/api/stock/counts/{count_id}/post").status_code == 403
        review = owner_api.get(f"/api/stock/counts/{count_id}").data
        assert review["lines"][0]["difference"] == "195.000"

        posted = owner_api.post(f"/api/stock/counts/{count_id}/post")
        assert posted.status_code == 200
        assert posted.data["status"] == "posted"
        wire.refresh_from_db()
        assert wire.stock_qty == D("195")
        assert wire.counted_at is not None

    def test_item_in_another_open_count_gives_clear_message(self, staff_api, wire):
        first = staff_api.post("/api/stock/counts", {"title": "Rack W1"}, format="json").data["id"]
        second = staff_api.post("/api/stock/counts", {"title": "Wires"}, format="json").data["id"]
        staff_api.post(f"/api/stock/counts/{first}/lines", {"item": wire.pk, "quantity": "1"}, format="json")
        response = staff_api.post(f"/api/stock/counts/{second}/lines", {"item": wire.pk, "quantity": "1"}, format="json")
        assert response.status_code == 400
        assert "Rack W1" in response.data["detail"]

    def test_remove_line_and_cancel(self, staff_api, owner_api, wire):
        count_id = staff_api.post("/api/stock/counts", {"title": "Rack W1"}, format="json").data["id"]
        line_id = staff_api.post(
            f"/api/stock/counts/{count_id}/lines", {"item": wire.pk, "quantity": "3"}, format="json"
        ).data["id"]
        assert staff_api.delete(f"/api/stock/counts/{count_id}/lines/{line_id}").status_code == 204
        assert staff_api.post(f"/api/stock/counts/{count_id}/cancel").status_code == 403
        assert owner_api.post(f"/api/stock/counts/{count_id}/cancel").data["status"] == "cancelled"


class TestSummary:
    def test_stock_value_only_for_owner(self, staff_api, owner_api, wire):
        assert "stock_value" not in staff_api.get("/api/stock/summary").data
        data = owner_api.get("/api/stock/summary").data
        assert data["stock_value"] == "0.00"
        assert data["not_counted"] == 1
