from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("items", views.ItemViewSet, basename="item")
router.register("products", views.ProductViewSet, basename="product")

urlpatterns = [
    path("categories", views.CategoryList.as_view(), name="categories"),
    path("brands", views.BrandList.as_view(), name="brands"),
    path("lookup", views.ItemLookup.as_view(), name="item-lookup"),
    path("units/<int:pk>", views.UnitDetail.as_view(), name="unit-detail"),
    *router.urls,
]
