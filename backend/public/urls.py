from django.urls import path

from . import views

urlpatterns = [
    path("shop", views.ShopInfo.as_view(), name="public-shop"),
    path("categories", views.Categories.as_view(), name="public-categories"),
    path("products", views.Products.as_view(), name="public-products"),
    path("products/<int:pk>", views.ProductDetail.as_view(), name="public-product"),
    path("new", views.NewInStore.as_view(), name="public-new"),
    path("images/<str:name>", views.Image.as_view(), name="public-image"),
]
