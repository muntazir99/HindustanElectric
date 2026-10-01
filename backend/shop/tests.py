import pytest
from django.core.exceptions import ValidationError

from shop.models import ShopSettings

pytestmark = pytest.mark.django_db


def test_load_always_returns_the_single_record():
    first = ShopSettings.load()
    first.phone = "9000000000"
    first.save()
    assert ShopSettings.load().phone == "9000000000"
    assert ShopSettings.objects.count() == 1


def test_saving_a_new_instance_overwrites_instead_of_adding():
    ShopSettings.load()
    ShopSettings(name="Another").save()
    assert ShopSettings.objects.count() == 1
    assert ShopSettings.load().name == "Another"


def test_settings_cannot_be_deleted():
    with pytest.raises(ValidationError):
        ShopSettings.load().delete()


def test_gstin_must_match_state_code():
    settings = ShopSettings(gstin="09ABCDE1234F1Z5", state_code="10")
    with pytest.raises(ValidationError):
        settings.full_clean()


def test_staff_can_read_settings(staff_api):
    response = staff_api.get("/api/shop/settings")
    assert response.status_code == 200
    assert response.data["data"]["name"] == "Hindustan Electric"
    assert response.data["data"]["state_code"] == "10"
