from django.contrib import admin

from .models import Brand, Category, Item, ItemUnit, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent")
    search_fields = ("name",)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    search_fields = ("name",)


class ItemInline(admin.TabularInline):
    model = Item
    fields = ("variant", "code", "base_unit", "mrp", "selling_price", "rack", "min_stock", "is_active")
    extra = 0
    show_change_link = True


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "category", "hsn_code", "gst_rate")
    list_filter = ("brand", "category", "gst_rate")
    search_fields = ("name", "brand__name", "hsn_code")
    autocomplete_fields = ("brand", "category")
    inlines = [ItemInline]


class ItemUnitInline(admin.TabularInline):
    model = ItemUnit
    fields = ("name", "factor", "barcode", "mrp", "selling_price", "is_base")
    readonly_fields = ("is_base",)
    extra = 0


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("__str__", "code", "stock_qty", "selling_price", "rack", "is_active", "counted_at")
    list_filter = ("is_active", "needs_recount", "product__brand", "product__category")
    search_fields = ("search_text", "units__barcode")
    list_select_related = ("product__brand",)
    readonly_fields = ("stock_qty", "cost_price", "counted_at", "needs_recount")
    autocomplete_fields = ("product",)
    inlines = [ItemUnitInline]

    def get_readonly_fields(self, request, obj=None):
        fields = super().get_readonly_fields(request, obj)
        # Quantities are stored in the base unit, so it is fixed once stock has moved.
        if obj and obj.movements.exists():
            fields = (*fields, "base_unit")
        return fields

    def has_delete_permission(self, request, obj=None):
        # Items are deactivated, never deleted, so old bills keep their history.
        return False
