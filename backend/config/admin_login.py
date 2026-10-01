"""
Limit password guessing on the back office (Django admin) login, which has no limit of its own.
After ADMIN_LOGIN_ATTEMPTS wrong passwords from one address, that address waits ADMIN_LOGIN_LOCKOUT_SECONDS.
"""

from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework.settings import api_settings


def client_address(request):
    """The visitor's address, trusting X-Forwarded-For only for the configured number of proxies."""
    proxies = api_settings.NUM_PROXIES or 0
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if proxies and forwarded:
        hops = [hop.strip() for hop in forwarded.split(",")]
        return hops[-min(proxies, len(hops))]
    return request.META.get("REMOTE_ADDR", "")


def limit_login(login_view):
    @wraps(login_view)
    def view(request, *args, **kwargs):
        if request.method != "POST":
            return login_view(request, *args, **kwargs)
        key = f"admin-login-failures:{client_address(request)}"
        failures = cache.get(key, 0)
        if failures >= settings.ADMIN_LOGIN_ATTEMPTS:
            return HttpResponse(
                "Too many wrong passwords. Wait 15 minutes, then try again.",
                status=429,
                content_type="text/plain; charset=utf-8",
            )
        response = login_view(request, *args, **kwargs)
        if request.user.is_authenticated:
            cache.delete(key)
        else:
            cache.set(key, failures + 1, settings.ADMIN_LOGIN_LOCKOUT_SECONDS)
        return response

    return view
