from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("staff", views.StaffViewSet, basename="staff")

urlpatterns = [
    path("login", views.LoginView.as_view(), name="login"),
    path("me", views.MeView.as_view(), name="me"),
    path("change_password", views.ChangePasswordView.as_view(), name="change-password"),
    path("access", views.AccessView.as_view(), name="access"),
    *router.urls,
]
