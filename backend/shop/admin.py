from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse

from .models import ShopSettings


@admin.register(ShopSettings)
class ShopSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Shop", {"fields": ("name", "gstin", "state_code", "address", "phone", "email")}),
        ("Bank details (printed on bills)", {"fields": ("bank_name", "bank_branch", "bank_account_number", "bank_ifsc")}),
        ("Bills", {"fields": ("invoice_prefix", "round_off_bills", "upi_id", "invoice_terms")}),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        # There is only one settings record, so go straight to its edit page.
        obj = ShopSettings.load()
        return redirect(reverse("admin:shop_shopsettings_change", args=[obj.pk]))
