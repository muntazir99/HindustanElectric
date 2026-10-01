from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("customers", views.CustomerViewSet, basename="customer")
router.register("invoices", views.InvoiceViewSet, basename="invoice")
router.register("receipts", views.ReceiptViewSet, basename="receipt")
router.register("credit-notes", views.CreditNoteViewSet, basename="credit-note")

urlpatterns = [path("today", views.TodaySummary.as_view(), name="sales-today"), *router.urls]
