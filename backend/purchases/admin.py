from django.contrib import admin

from .models import PurchaseBill, PurchaseLine, Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "gstin", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "gstin", "phone")


class PurchaseLineInline(admin.TabularInline):
    model = PurchaseLine
    fields = ("item", "unit", "quantity", "rate", "discount_percent", "gst_rate", "taxable_amount", "tax_amount")
    readonly_fields = fields
    extra = 0
    can_delete = False


@admin.register(PurchaseBill)
class PurchaseBillAdmin(admin.ModelAdmin):
    """View-only here: bills are entered and posted in the app so stock stays correct."""

    list_display = ("bill_date", "supplier", "bill_number", "total", "status", "created_by")
    list_filter = ("status", "supplier")
    search_fields = ("bill_number", "supplier__name")
    inlines = [PurchaseLineInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
