from django.urls import path

from . import views

urlpatterns = [
    path("login", views.LoginView.as_view(), name="login"),
    path("me", views.MeView.as_view(), name="me"),
    path("create_user", views.CreateUserView.as_view(), name="create-user"),
    path("change_password", views.ChangePasswordView.as_view(), name="change-password"),
]
