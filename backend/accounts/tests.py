import pytest
from django.core.management import call_command
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


class TestRoles:
    def test_owner_gets_admin_access(self, owner):
        assert owner.is_staff and owner.is_superuser

    def test_staff_has_no_admin_access(self, staff):
        assert not staff.is_staff and not staff.is_superuser

    def test_changing_role_updates_admin_access(self, staff):
        staff.role = User.Role.OWNER
        staff.save()
        assert staff.is_staff and staff.is_superuser

    def test_createsuperuser_makes_an_owner(self, monkeypatch):
        monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", PASSWORD)
        call_command("createsuperuser", "--noinput", username="boss", email="")
        assert User.objects.get(username="boss").role == User.Role.OWNER


class TestLogin:
    def test_valid_login_returns_token_with_role(self, api, staff):
        response = api.post("/api/auth/login", {"username": "staff", "password": PASSWORD}, format="json")
        assert response.status_code == 200
        assert response.data["success"] is True
        assert response.data["role"] == "staff"
        assert AccessToken(response.data["token"])["role"] == "staff"

    def test_wrong_password_is_rejected(self, api, staff):
        response = api.post("/api/auth/login", {"username": "staff", "password": "wrong"}, format="json")
        assert response.status_code == 401
        assert response.data["success"] is False

    def test_inactive_user_cannot_log_in(self, api, staff):
        staff.is_active = False
        staff.save()
        response = api.post("/api/auth/login", {"username": "staff", "password": PASSWORD}, format="json")
        assert response.status_code == 401

    def test_repeated_attempts_are_throttled(self, api, staff):
        codes = [
            api.post("/api/auth/login", {"username": "staff", "password": "wrong"}, format="json").status_code
            for _ in range(11)
        ]
        assert codes[-1] == 429


class TestEndpointsNeedLogin:
    @pytest.mark.parametrize(
        "method, url",
        [
            ("get", "/api/auth/me"),
            ("get", "/api/auth/staff"),
            ("post", "/api/auth/staff"),
            ("post", "/api/auth/change_password"),
            ("get", "/api/shop/settings"),
        ],
    )
    def test_anonymous_is_rejected(self, api, method, url):
        assert getattr(api, method)(url).status_code == 401

    def test_me_returns_current_user(self, staff_api):
        response = staff_api.get("/api/auth/me")
        assert response.data["data"]["username"] == "staff"
        assert response.data["data"]["role"] == "staff"


class TestAddStaff:
    def test_staff_cannot_add_users(self, staff_api):
        response = staff_api.post("/api/auth/staff", {"username": "new", "password": "Another-pass-99"}, format="json")
        assert response.status_code == 403
        assert not User.objects.filter(username="new").exists()

    def test_owner_adds_staff_by_default(self, owner_api):
        response = owner_api.post("/api/auth/staff", {"username": "new", "password": "Another-pass-99"}, format="json")
        assert response.status_code == 201
        assert User.objects.get(username="new").role == User.Role.STAFF

    def test_duplicate_username_is_rejected_ignoring_case(self, owner_api, staff):
        response = owner_api.post("/api/auth/staff", {"username": "STAFF", "password": "Another-pass-99"}, format="json")
        assert response.status_code == 400
        assert "already exists" in str(response.data)

    def test_weak_password_is_rejected(self, owner_api):
        response = owner_api.post("/api/auth/staff", {"username": "new", "password": "12345678"}, format="json")
        assert response.status_code == 400
        assert not User.objects.filter(username="new").exists()


class TestChangePassword:
    def test_wrong_current_password_is_rejected(self, staff_api, staff):
        response = staff_api.post(
            "/api/auth/change_password", {"old_password": "nope", "new_password": "Brand-new-pass-7"}, format="json"
        )
        assert response.status_code == 400
        staff.refresh_from_db()
        assert staff.check_password(PASSWORD)

    def test_password_is_changed(self, staff_api, staff):
        response = staff_api.post(
            "/api/auth/change_password",
            {"old_password": PASSWORD, "new_password": "Brand-new-pass-7"},
            format="json",
        )
        assert response.status_code == 200
        staff.refresh_from_db()
        assert staff.check_password("Brand-new-pass-7")
