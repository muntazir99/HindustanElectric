from django.contrib import admin
from django.contrib.auth.models import Group
from django.http import JsonResponse
from django.urls import include, path

from shop.views import ShopSettingsView

admin.site.site_header = "Hindustan Electric — Back office"
admin.site.site_title = "Hindustan Electric"
admin.site.index_title = "Back office"
admin.site.site_url = None  # no public site yet
# Access is controlled by each user's role, not Django groups.
admin.site.unregister(Group)


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/auth/", include("accounts.urls")),
    path("api/shop/settings", ShopSettingsView.as_view(), name="shop-settings"),
]
