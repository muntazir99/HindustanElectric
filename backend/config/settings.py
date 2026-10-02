"""
Django settings for the Hindustan Electric backend.

All secrets and environment-specific values come from environment variables
(loaded from backend/.env in development). See .env.example for the full list.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def require_env(name):
    """Return an environment variable or refuse to start without it."""
    value = os.environ.get(name)
    if not value:
        raise ImproperlyConfigured(f"Environment variable {name} must be set.")
    return value


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() == "true"


SECRET_KEY = require_env("DJANGO_SECRET_KEY")
DEBUG = env_bool("DJANGO_DEBUG")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# The site's own address(es) with https://, so the back office accepts its login form behind a proxy.
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "accounts",
    "shop",
    "catalog",
    "stock",
    "purchases",
    "sales",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.parse(require_env("DATABASE_URL"), conn_max_age=600),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Uploaded files (purchase bill photos/PDFs). They are never served as public files: the API hands
# them out only to logged-in users (see purchases.views). Keep this folder in the backups.
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- API ---

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Every endpoint requires login, and for staff the switch its view names in `access`; an endpoint
    # that names none is owner-only (accounts.permissions.HasAccess).
    "DEFAULT_PERMISSION_CLASSES": [
        "accounts.permissions.HasAccess",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    # Slows down password guessing on the login endpoint.
    "DEFAULT_THROTTLE_RATES": {"login": "10/min"},
    # How many proxies (e.g. nginx) sit in front of Django. 0 = use the connecting address and ignore
    # X-Forwarded-For, which anyone can fake to dodge the login limit.
    "NUM_PROXIES": int(os.environ.get("DJANGO_NUM_PROXIES", "0")),
}

# Login limits (app and back office) count attempts in this cache. In production use a folder, so
# every server process shares one count.
CACHES = {
    "default": (
        {"BACKEND": "django.core.cache.backends.filebased.FileBasedCache", "LOCATION": os.environ["DJANGO_CACHE_DIR"]}
        if os.environ.get("DJANGO_CACHE_DIR")
        else {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    )
}

# Back office login: this many wrong passwords from one address, then a 15-minute wait.
ADMIN_LOGIN_ATTEMPTS = 5
ADMIN_LOGIN_LOCKOUT_SECONDS = 15 * 60

# --- Production (HTTPS) ---
# DJANGO_SECURE=true on the live server: HTTPS only, secure cookies, and browsers told to always use
# HTTPS. DJANGO_BEHIND_PROXY=true when nginx or the host terminates HTTPS in front of Django.
if env_bool("DJANGO_SECURE"):
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", str(30 * 24 * 60 * 60)))
if env_bool("DJANGO_BEHIND_PROXY"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Errors go to the console (the host's log), so a crash on the live server is never silent.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "{asctime} {levelname} {name}: {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {"django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False}},
}

SIMPLE_JWT = {
    # One shop day, so staff are not logged out at the counter mid-shift.
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
