from django.contrib import admin

from .models import Adjustment, StockCount, StockMovement


class ReadOnlyAdmin(admin.ModelAdmin):
    """Stock records only change through the app's stock services."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockMovement)
class StockMovementAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "item", "kind", "quantity", "balance_after", "unit_cost", "created_by", "note")
    list_filter = ("kind",)
    search_fields = ("item__search_text", "note")
    list_select_related = ("item__product__brand", "created_by")


@admin.register(Adjustment)
class AdjustmentAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "item", "quantity", "reason", "note", "created_by")
    list_filter = ("reason",)
    list_select_related = ("item__product__brand", "created_by")


@admin.register(StockCount)
class StockCountAdmin(ReadOnlyAdmin):
    list_display = ("title", "status", "created_by", "created_at", "posted_at")
    list_filter = ("status",)
