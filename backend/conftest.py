from decimal import Decimal

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.access import STAFF_BEFORE_SWITCHES
from accounts.models import User

PASSWORD = "Counter-test-pass-1"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", password=PASSWORD, role=User.Role.OWNER)


@pytest.fixture
def staff(db):
    """A staff member with the switches every staff member had before switches existed."""
    return User.objects.create_user(
        username="staff", password=PASSWORD, role=User.Role.STAFF, access=list(STAFF_BEFORE_SWITCHES)
    )


def login(client, user):
    response = client.post("/api/auth/login", {"username": user.username, "password": PASSWORD}, format="json")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['token']}")
    return client


@pytest.fixture
def owner_api(owner):
    return login(APIClient(), owner)


@pytest.fixture
def staff_api(staff):
    return login(APIClient(), staff)


@pytest.fixture
def make_item(db):
    """make_item(variant="1.5 sq mm Red", base_unit="m", packs=[("coil", 90, "8901")], ...)"""
    from catalog.models import Brand, Item, ItemUnit, Product

    def make(product="Lifeline wire", brand="Havells", variant="", base_unit="pc", packs=(), **fields):
        brand_obj = Brand.objects.get_or_create(name=brand)[0] if brand else None
        product_obj = Product.objects.get_or_create(name=product, brand=brand_obj)[0]
        item = Item.objects.create(product=product_obj, variant=variant, base_unit=base_unit, **fields)
        for name, factor, *barcode in packs:
            ItemUnit.objects.create(item=item, name=name, factor=Decimal(str(factor)), barcode=barcode[0] if barcode else None)
        return item

    return make


@pytest.fixture
def wire(make_item):
    """A wire stocked in metres and bought in 90 m coils."""
    return make_item(variant="1.5 sq mm Red", base_unit="m", packs=[("coil", 90, "8901030000011")])


@pytest.fixture
def supplier(db):
    from purchases.models import Supplier

    return Supplier.objects.create(name="Sharma Distributors")
