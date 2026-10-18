from django.apps import AppConfig


class PublicConfig(AppConfig):
    """Read-only addresses for the shop's public website (plan §21.4). No login; nothing here writes."""

    name = "public"

    def ready(self):
        from corsheaders.signals import check_request_enabled
        from django.conf import settings

        def website_may_call(sender, request, **kwargs):
            # The website (its own domain) may call /api/public/ from the browser, and nothing else.
            return request.path.startswith("/api/public/") and request.headers.get("Origin") in settings.PUBLIC_SITE_ORIGINS

        check_request_enabled.connect(website_may_call, weak=False)
