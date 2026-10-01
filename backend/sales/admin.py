from django.contrib import admin

from stock.admin import ReadOnlyAdmin

from .models import Customer, DocumentSeries, Invoice, InvoiceLine, LedgerEntry, Payment


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "kind", "gstin", "credit_limit", "is_active")
    list_filter = ("kind", "is_active")
    search_fields = ("name", "phone", "gstin")
    readonly_fields = ("created_by", "created_at")

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return False


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    fields = ("description", "unit_name", "hsn_code", "quantity", "rate", "discount", "taxable_value", "gst_rate", "total")
    readonly_fields = fields
    extra = 0
    can_delete = False


@admin.register(Invoice)
class InvoiceAdmin(ReadOnlyAdmin):
    """View only: bills are made, finalised and cancelled in the app."""

    list_display = ("number", "invoice_date", "status", "buyer_name", "total", "paid_amount", "credit_amount")
    list_filter = ("status", "invoice_date")
    search_fields = ("number", "buyer_name", "buyer_phone")
    inlines = [InvoiceLineInline]


@admin.register(Payment)
class PaymentAdmin(ReadOnlyAdmin):
    list_display = ("date", "kind", "mode", "amount", "customer", "invoice", "receipt_number")
    list_filter = ("kind", "mode", "date")


@admin.register(LedgerEntry)
class LedgerEntryAdmin(ReadOnlyAdmin):
    list_display = ("date", "customer", "kind", "debit", "credit", "note")
    list_filter = ("kind",)
    search_fields = ("customer__name", "customer__phone")


@admin.register(DocumentSeries)
class DocumentSeriesAdmin(ReadOnlyAdmin):
    list_display = ("key", "last_number")
