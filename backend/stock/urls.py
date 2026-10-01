from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("adjustments", views.AdjustmentViewSet, basename="adjustment")
router.register("counts", views.StockCountViewSet, basename="count")

urlpatterns = [
    path("summary", views.StockSummary.as_view(), name="stock-summary"),
    *router.urls,
]
