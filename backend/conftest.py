import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

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
    return User.objects.create_user(username="staff", password=PASSWORD, role=User.Role.STAFF)


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
