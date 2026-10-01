from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("bills", views.PurchaseBillViewSet, basename="purchase-bill")

urlpatterns = router.urls
