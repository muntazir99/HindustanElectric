from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from catalog.display import format_quantity
from catalog.models import Brand, Item, ItemUnit, Product

pytestmark = pytest.mark.django_db


class TestItem:
    def test_new_item_gets_code_and_base_unit(self, make_item):
        item = make_item(base_unit="m")
        assert item.code == str(10000 + item.pk)
        base = item.units.get(is_base=True)
        assert (base.name, base.factor) == ("m", Decimal("1"))

    def test_name_combines_brand_product_and_variant(self, wire):
        assert wire.name == "Havells Lifeline wire 1.5 sq mm Red"

    def test_search_text_covers_names_aliases_and_code(self, make_item):
        item = make_item(product="Batten holder", brand="Anchor", aliases="kit-kat, holder")
        assert "anchor batten holder" in item.search_text
        assert "kit-kat" in item.search_text
        assert item.code in item.search_text

    def test_renaming_product_updates_item_search(self, wire):
        product = wire.product
        product.name = "Lifeline Plus HRFR"
        product.save()
        wire.refresh_from_db()
        assert "lifeline plus hrfr" in wire.search_text

    def test_changing_base_unit_renames_base_unit_row(self, make_item):
        item = make_item(base_unit="pc")
        item.base_unit = "set"
        item.save()
        assert item.units.get(is_base=True).name == "set"

    def test_same_variant_twice_is_rejected(self, wire):
        with pytest.raises(IntegrityError):
            Item.objects.create(product=wire.product, variant="1.5 SQ MM RED", base_unit="m")


class TestUnitsAndBarcodes:
    def test_barcode_must_be_unique_across_all_items(self, wire, make_item):
        other = make_item(product="MCB", variant="16A")
        with pytest.raises(IntegrityError):
            ItemUnit.objects.create(item=other, name="box", factor=10, barcode="8901030000011")

    def test_blank_barcodes_do_not_clash(self, make_item):
        first = make_item(product="Screw", variant="1 inch")
        second = make_item(product="Screw", variant="2 inch")
        ItemUnit.objects.create(item=first, name="box", factor=100, barcode="  ")
        ItemUnit.objects.create(item=second, name="box", factor=100, barcode="")
        assert ItemUnit.objects.filter(barcode__isnull=True, name="box").count() == 2

    def test_only_one_base_unit_per_item(self, wire):
        with pytest.raises(IntegrityError), transaction.atomic():
            ItemUnit.objects.create(item=wire, name="metre", factor=1, is_base=True)


class TestProduct:
    def test_product_name_unique_per_brand_ignoring_case(self):
        brand = Brand.objects.create(name="Polycab")
        Product.objects.create(name="Fan", brand=brand)
        with pytest.raises(IntegrityError):
            Product.objects.create(name="FAN", brand=brand)

    def test_unbranded_product_names_are_unique_too(self):
        Product.objects.create(name="Insulation tape")
        with pytest.raises(IntegrityError):
            Product.objects.create(name="insulation tape")


class TestQuantityDisplay:
    @pytest.mark.parametrize(
        "quantity, expected",
        [
            ("395", "4 coil + 35 m"),
            ("180", "2 coil"),
            ("50", "50 m"),
            ("12.5", "12.5 m"),
            ("-5", "-5 m"),
            ("0", "0 m"),
        ],
    )
    def test_uses_largest_pack(self, wire, quantity, expected):
        assert format_quantity(Decimal(quantity), "m", list(wire.units.all())) == expected

    def test_item_without_packs(self, make_item):
        item = make_item(product="Switch", base_unit="pc")
        assert format_quantity(Decimal("12"), "pc", list(item.units.all())) == "12 pc"
