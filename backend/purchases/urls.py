from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("bills", views.PurchaseBillViewSet, basename="purchase-bill")
router.register("orders", views.PurchaseOrderViewSet, basename="purchase-order")

urlpatterns = [path("reorder", views.Reorder.as_view(), name="reorder"), *router.urls]
