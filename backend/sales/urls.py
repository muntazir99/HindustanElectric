from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("customers", views.CustomerViewSet, basename="customer")
router.register("invoices", views.InvoiceViewSet, basename="invoice")
router.register("receipts", views.ReceiptViewSet, basename="receipt")

urlpatterns = router.urls
