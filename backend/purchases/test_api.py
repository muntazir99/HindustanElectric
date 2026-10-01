from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from purchases.models import PurchaseBill

pytestmark = pytest.mark.django_db
D = Decimal


def bill_payload(supplier, wire, number="INV-101", **overrides):
    return {
        "supplier": supplier.pk,
        "bill_number": number,
        "bill_date": "2026-10-01",
        "round_off": "-0.40",
        "lines": [
            {"item": wire.pk, "unit": wire.units.get(name="coil").pk, "quantity": "2", "rate": "1000", "discount_percent": "10"},
        ],
        **overrides,
    }


class TestSuppliers:
    def test_duplicate_supplier_name_is_rejected(self, staff_api, supplier):
        response = staff_api.post("/api/purchases/suppliers", {"name": "sharma distributors"}, format="json")
        assert response.status_code == 400

    def test_invalid_gstin_is_rejected(self, staff_api):
        response = staff_api.post("/api/purchases/suppliers", {"name": "X", "gstin": "123"}, format="json")
        assert response.status_code == 400


class TestDraftBills:
    def test_create_draft_computes_totals_and_default_gst(self, staff_api, supplier, wire):
        response = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire), format="json")
        assert response.status_code == 201, response.data
        assert response.data["status"] == "draft"
        assert response.data["lines"][0]["gst_rate"] == "18.00"
        assert (response.data["taxable_total"], response.data["tax_total"], response.data["total"]) == (
            "1800.00", "324.00", "2123.60",
        )
        wire.refresh_from_db()
        assert wire.stock_qty == D("0")  # drafts don't touch stock

    def test_duplicate_bill_message_says_when(self, staff_api, supplier, wire):
        staff_api.post("/api/purchases/bills", bill_payload(supplier, wire), format="json")
        response = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire, "inv-101"), format="json")
        assert response.status_code == 400
        assert "already entered" in response.data["bill_number"][0]
        assert "01 Oct 2026" in response.data["bill_number"][0]

    def test_unit_of_another_item_is_rejected(self, staff_api, supplier, wire, make_item):
        other = make_item(product="MCB")
        payload = bill_payload(supplier, wire)
        payload["lines"][0]["unit"] = other.units.get().pk
        assert staff_api.post("/api/purchases/bills", payload, format="json").status_code == 400

    def test_editing_draft_replaces_lines(self, staff_api, supplier, wire):
        bill_id = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire), format="json").data["id"]
        new_lines = [{"item": wire.pk, "unit": wire.units.get(is_base=True).pk, "quantity": "10", "rate": "12"}]
        response = staff_api.patch(f"/api/purchases/bills/{bill_id}", {"lines": new_lines}, format="json")
        assert response.status_code == 200
        assert len(response.data["lines"]) == 1
        assert response.data["taxable_total"] == "120.00"

    def test_staff_deletes_own_draft_only(self, staff_api, owner_api, supplier, wire, owner):
        owners_bill = owner_api.post("/api/purchases/bills", bill_payload(supplier, wire, "A"), format="json").data["id"]
        staffs_bill = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire, "B"), format="json").data["id"]
        assert staff_api.delete(f"/api/purchases/bills/{owners_bill}").status_code == 403
        assert staff_api.delete(f"/api/purchases/bills/{staffs_bill}").status_code == 204


class TestPosting:
    def test_post_adds_stock_and_locks_bill(self, staff_api, supplier, wire):
        bill_id = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire), format="json").data["id"]
        response = staff_api.post(f"/api/purchases/bills/{bill_id}/post")
        assert response.status_code == 200
        assert response.data["status"] == "posted"
        wire.refresh_from_db()
        assert wire.stock_qty == D("180")

        assert staff_api.patch(f"/api/purchases/bills/{bill_id}", {"notes": "x"}, format="json").status_code == 400
        assert staff_api.delete(f"/api/purchases/bills/{bill_id}").status_code == 400
        assert staff_api.post(f"/api/purchases/bills/{bill_id}/post").status_code == 400
        wire.refresh_from_db()
        assert wire.stock_qty == D("180")

    def test_list_filters_by_status(self, staff_api, supplier, wire):
        first = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire, "A"), format="json").data["id"]
        staff_api.post("/api/purchases/bills", bill_payload(supplier, wire, "B"), format="json")
        staff_api.post(f"/api/purchases/bills/{first}/post")
        drafts = staff_api.get("/api/purchases/bills?status=draft").data["results"]
        assert [bill["bill_number"] for bill in drafts] == ["B"]
        assert drafts[0]["line_count"] == 1


class TestAttachment:
    def test_pdf_is_attached(self, staff_api, supplier, wire, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        bill_id = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire), format="json").data["id"]
        upload = SimpleUploadedFile("bill.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        response = staff_api.post(f"/api/purchases/bills/{bill_id}/attachment", {"file": upload}, format="multipart")
        assert response.status_code == 200
        assert "purchase-bills/" in response.data["attachment"]
        assert PurchaseBill.objects.get(pk=bill_id).attachment

    def test_other_file_types_rejected(self, staff_api, supplier, wire):
        bill_id = staff_api.post("/api/purchases/bills", bill_payload(supplier, wire), format="json").data["id"]
        upload = SimpleUploadedFile("bill.exe", b"MZ", content_type="application/octet-stream")
        response = staff_api.post(f"/api/purchases/bills/{bill_id}/attachment", {"file": upload}, format="multipart")
        assert response.status_code == 400
