"""The website's public data (plan §21.4): only website products, only public fields, read-only."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from catalog.models import Item, ItemUnit, Product
from purchases.models import PurchaseBill
from shop.models import ShopSettings

pytestmark = pytest.mark.django_db
D = Decimal
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\0" * 64
PUBLIC_WORDS = {"mrp", "from_mrp", "gstin"}  # MRP is the only money a visitor sees; the GSTIN is on every bill anyway
SECRET_WORDS = ("cost", "selling", "price", "stock_qty", "barcode", "hsn", "gst", "rack", "min_stock", "aliases")


@pytest.fixture(autouse=True)
def media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def switch(make_item, owner):
    """Anchor Roma switch on the website: White (in stock, photo, cut-out), Black (none left), Grey (no longer sold)."""
    white = make_item(product="Roma 6A switch", brand="Anchor", variant="White", mrp=D("52"), selling_price=D("45"),
                      cost_price=D("30"), rack="S1")
    black = make_item(product="Roma 6A switch", brand="Anchor", variant="Black", mrp=D("55"))
    make_item(product="Roma 6A switch", brand="Anchor", variant="Grey", mrp=D("50"), is_active=False)
    Product.objects.filter(pk=white.product_id).update(on_website=True, tryon_surface="wall", web_description="Smooth click.")
    ItemUnit.objects.create(item=white, name="box", factor=D("20"), mrp=D("1000"), barcode="8901234500035")
    white.web_photo.save("a" * 32 + ".jpg", ContentFile(JPG))
    white.tryon_image.save("b" * 32 + ".png", ContentFile(PNG))
    Item.objects.filter(pk=white.pk).update(stock_qty=D("10"))  # after the saves above, which write the whole item
    hidden = make_item(product="Secret MCB", brand="Havells", mrp=D("300"))
    return white, black, hidden


def keys(value, found=None):
    """Every key anywhere in a JSON answer."""
    found = set() if found is None else found
    if isinstance(value, dict):
        for key, inner in value.items():
            found.add(key)
            keys(inner, found)
    elif isinstance(value, list):
        for inner in value:
            keys(inner, found)
    return found


def test_only_website_products_and_public_fields(api, switch):
    white, black, hidden = switch
    listed = api.get("/api/public/products").json()["results"]
    assert [row["name"] for row in listed] == ["Anchor Roma 6A switch"]
    product = api.get(f"/api/public/products/{white.product_id}").json()
    assert set(product) == {"id", "name", "brand", "category", "from_mrp", "mrp_per", "photo", "tryon", "variants", "description"}
    assert (product["from_mrp"], product["mrp_per"], product["tryon"], product["description"]) == ("52.00", "pc", "wall", "Smooth click.")
    by_name = {row["name"]: row for row in product["variants"]}
    assert set(by_name) == {"White", "Black"}  # Grey is no longer sold
    assert set(by_name["White"]) == {"id", "name", "mrp", "unit", "in_stock", "photo", "tryon_image", "packs"}
    assert (by_name["White"]["in_stock"], by_name["Black"]["in_stock"]) == (True, False)
    assert by_name["White"]["packs"] == [{"name": "box", "size": "20", "mrp": "1000.00"}]
    assert by_name["White"]["photo"] == f"/api/public/images/{'a' * 32}.jpg"

    every = keys([listed, product, api.get("/api/public/shop").json(), api.get("/api/public/categories").json()])
    leaked = [key for key in every - PUBLIC_WORDS if any(word in key for word in SECRET_WORDS)]
    assert leaked == []
    assert api.get(f"/api/public/products/{hidden.product_id}").status_code == 404


def test_sold_only_in_packs_shows_the_pack_mrp(api, wire):
    """Wire with no MRP per metre but an MRP per 90 m coil: the card shows the coil."""
    Product.objects.filter(pk=wire.product_id).update(on_website=True)
    wire.units.filter(name="coil").update(mrp=D("2650"))
    [row] = api.get("/api/public/products").json()["results"]
    assert (row["from_mrp"], row["mrp_per"]) == ("2650.00", "coil")


def test_search_and_category(api, switch):
    assert api.get("/api/public/products?q=black").json()["count"] == 1
    assert api.get("/api/public/products?q=fan").json()["count"] == 0
    assert api.get("/api/public/products?brand=anchor").json()["count"] == 1


def test_pictures_only_while_on_the_website(api, switch):
    white, _, _ = switch
    response = api.get(f"/api/public/images/{'a' * 32}.jpg")
    assert response.status_code == 200 and response["Content-Type"] == "image/jpeg"
    assert "immutable" in response["Cache-Control"]
    for name in ("../../etc/passwd", "a" * 32 + ".pdf", "c" * 32 + ".jpg"):
        assert api.get(f"/api/public/images/{name}").status_code == 404
    Product.objects.filter(pk=white.product_id).update(on_website=False)
    assert api.get(f"/api/public/images/{'a' * 32}.jpg").status_code == 404


def test_new_in_store(api, owner_api, switch, supplier):
    white, _, _ = switch
    assert api.get("/api/public/new").json() == []
    bill = owner_api.post("/api/purchases/bills", {
        "supplier": supplier.pk, "bill_number": "N1", "bill_date": "2026-10-01",
        "lines": [{"item": white.pk, "unit": white.units.get(is_base=True).pk, "quantity": "5", "rate": "30"}],
    }, format="json").data
    owner_api.post(f"/api/purchases/bills/{bill['id']}/post")
    assert [row["id"] for row in api.get("/api/public/new").json()] == [white.product_id]
    PurchaseBill.objects.filter(pk=bill["id"]).update(posted_at=timezone.now() - timedelta(days=40))
    assert api.get("/api/public/new").json() == []  # over 30 days ago
    Product.objects.filter(pk=white.product_id).update(web_new=Product.WebNew.ALWAYS)
    assert len(api.get("/api/public/new").json()) == 1


def test_shop_details(api):
    ShopSettings.objects.update_or_create(pk=1, defaults={"phone": "9876543210", "opening_hours": "9 am – 9 pm", "bank_account_number": "123"})
    shop = api.get("/api/public/shop").json()
    assert set(shop) == {"name", "phone", "address", "opening_hours", "gstin"}
    assert shop["opening_hours"] == "9 am – 9 pm"


def test_the_website_may_call_from_its_own_domain_only(api, switch, settings):
    settings.PUBLIC_SITE_ORIGINS = ["https://shop.example"]
    public = api.get("/api/public/products", HTTP_ORIGIN="https://shop.example")
    assert public["Access-Control-Allow-Origin"] == "https://shop.example"
    private = api.get("/api/catalog/items", HTTP_ORIGIN="https://shop.example")
    assert "Access-Control-Allow-Origin" not in private
    other = api.get("/api/public/products", HTTP_ORIGIN="https://elsewhere.example")
    assert "Access-Control-Allow-Origin" not in other


class TestStaffPictures:
    def url(self, item, kind="photo"):
        return f"/api/catalog/items/{item.pk}/web-image/{kind}"

    def test_owner_adds_shows_and_removes_a_photo(self, owner_api, switch):
        _, black, _ = switch
        response = owner_api.post(self.url(black), {"file": SimpleUploadedFile("x.png", PNG)}, format="multipart")
        assert response.status_code == 200 and response.data["website"]["photo"] is True
        black.refresh_from_db()
        assert black.web_photo.name.startswith("website/") and black.web_photo.name.endswith(".png")
        assert owner_api.get(self.url(black)).status_code == 200
        assert owner_api.delete(self.url(black)).data["website"]["photo"] is False

    def test_cut_out_must_be_see_through_and_small(self, owner_api, switch):
        _, black, _ = switch
        jpg = owner_api.post(self.url(black, "tryon"), {"file": SimpleUploadedFile("x.jpg", JPG)}, format="multipart")
        assert jpg.status_code == 400
        html = owner_api.post(self.url(black), {"file": SimpleUploadedFile("x.png", b"<html>")}, format="multipart")
        assert html.status_code == 400
        big = owner_api.post(self.url(black), {"file": SimpleUploadedFile("x.png", PNG + b"\0" * (2 * 1024 * 1024))}, format="multipart")
        assert big.status_code == 400

    def test_staff_without_change_items_cannot(self, staff_api, switch):
        _, black, _ = switch
        assert staff_api.post(self.url(black), {"file": SimpleUploadedFile("x.png", PNG)}, format="multipart").status_code == 403

    def test_website_settings_on_the_product(self, owner_api, switch):
        _, _, hidden = switch
        response = owner_api.patch(f"/api/catalog/products/{hidden.product_id}",
                                   {"on_website": True, "tryon_surface": "ceiling", "web_new": "never"}, format="json")
        assert (response.data["on_website"], response.data["tryon_surface"], response.data["web_new"]) == (True, "ceiling", "never")
        assert owner_api.patch(f"/api/catalog/products/{hidden.product_id}", {"tryon_surface": "roof"}, format="json").status_code == 400
