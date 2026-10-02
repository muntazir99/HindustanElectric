"""Checks from the security review (2026-10-02): back office login limit, faked addresses, error replies."""

import pytest
from django.test import Client, RequestFactory

from config.errors import server_error
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


class TestBackOfficeLogin:
    def attempt(self, client, password):
        return client.post("/admin/login/", {"username": "owner", "password": password, "next": "/admin/"})

    def test_wrong_passwords_lock_out_for_a_while(self, owner):
        client = Client()
        codes = [self.attempt(client, "wrong").status_code for _ in range(6)]
        assert codes[:5] == [200] * 5  # the form again, with an error
        assert codes[5] == 429
        # Even the right password waits until the lockout ends.
        assert self.attempt(client, PASSWORD).status_code == 429

    def test_right_password_clears_earlier_mistakes(self, owner):
        client = Client()
        for _ in range(4):
            self.attempt(client, "wrong")
        assert self.attempt(client, PASSWORD).status_code == 302  # logged in
        assert [self.attempt(Client(), "wrong").status_code for _ in range(4)] == [200] * 4


def test_faked_forwarded_address_does_not_dodge_the_app_login_limit(api, staff):
    codes = [
        api.post(
            "/api/auth/login",
            {"username": "staff", "password": "wrong"},
            format="json",
            HTTP_X_FORWARDED_FOR=f"10.0.0.{attempt}",
        ).status_code
        for attempt in range(11)
    ]
    assert codes[-1] == 429


class TestErrorReplies:
    def test_unknown_api_address_is_json_404(self, staff_api):
        response = staff_api.get("/api/no-such-thing")
        assert response.status_code == 404
        assert response.json() == {"detail": "Not found."}

    def test_server_error_is_json_without_details(self):
        response = server_error(RequestFactory().get("/api/sales/invoices"))
        assert response.status_code == 500
        assert b"Something went wrong on the server" in response.content
        assert b"Traceback" not in response.content


@pytest.mark.parametrize(
    "url",
    ["/api/sales/invoices?customer=abc", "/api/catalog/items?category=abc", "/api/catalog/items?brand=1x"],
)
def test_id_filters_must_be_numbers(staff_api, url):
    assert staff_api.get(url).status_code == 400


def test_only_owner_removes_a_pack_size(staff_api, owner_api, wire):
    coil = wire.units.get(name="coil")
    assert staff_api.delete(f"/api/catalog/units/{coil.pk}").status_code == 403
    assert owner_api.delete(f"/api/catalog/units/{coil.pk}").status_code == 204


# --- every API address refuses someone who isn't logged in --------------------------------

# The only addresses that answer without a login: logging in, and the health check.
OPEN_WITHOUT_LOGIN = {"/api/auth/login", "/api/health"}


def api_addresses():
    """Every /api address the server knows, with 1 for each id in it."""
    import re

    from django.urls import URLPattern, URLResolver, get_resolver

    def walk(patterns, prefix=""):
        for entry in patterns:
            if isinstance(entry, URLResolver):
                yield from walk(entry.url_patterns, prefix + str(entry.pattern))
            elif isinstance(entry, URLPattern):
                yield prefix + str(entry.pattern)

    addresses = set()
    for raw in walk(get_resolver().url_patterns):
        if "format" in raw:  # the same address again with a ".json" ending
            continue
        path = re.sub(r"\(\?P<[^>]+>[^)]*\)", "1", raw)  # router style: (?P<pk>[^/.]+)
        path = re.sub(r"<[^>]+>", "1", path)  # path() style: <int:pk>
        path = "/" + path.replace("^", "").replace("$", "").replace("/?", "")
        if path.startswith("/api/"):
            addresses.add(path)
    return sorted(addresses)


def test_every_api_address_needs_a_login(api):
    addresses = api_addresses()
    assert len(addresses) > 40  # the walk really found the API
    let_through = []
    for path in addresses:
        if path in OPEN_WITHOUT_LOGIN:
            continue
        for method in ("get", "post", "put", "patch", "delete"):
            code = getattr(api, method)(path, {}, format="json").status_code
            if code not in (401, 403, 405):
                let_through.append(f"{method.upper()} {path} -> {code}")
    assert let_through == []
