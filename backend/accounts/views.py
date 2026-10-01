from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .permissions import IsOwner


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    # The React app reads the role from the token to decide which menus to show.
    refresh["role"] = user.role
    return {"token": str(refresh.access_token), "refresh": str(refresh)}


def password_errors(password, user=None):
    try:
        validate_password(password, user)
    except ValidationError as exc:
        return list(exc.messages)
    return []


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Username and password are required.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"success": False, "message": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            {
                "success": True,
                "message": "Login successful",
                "role": user.role,
                "name": user.get_full_name() or user.username,
                **tokens_for(user),
            }
        )


class MeView(APIView):
    def get(self, request):
        user = request.user
        return Response(
            {
                "success": True,
                "data": {
                    "username": user.username,
                    "name": user.get_full_name() or user.username,
                    "role": user.role,
                },
            }
        )


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    password = serializers.CharField()
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.STAFF)


class CreateUserView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        serializer = CreateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data
        if User.objects.filter(username__iexact=data["username"]).exists():
            return Response(
                {"success": False, "message": "A user with this username already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        errors = password_errors(data["password"], User(username=data["username"]))
        if errors:
            return Response(
                {"success": False, "message": " ".join(errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        User.objects.create_user(username=data["username"], password=data["password"], role=data["role"])
        return Response(
            {"success": True, "message": f"User '{data['username']}' created."},
            status=status.HTTP_201_CREATED,
        )


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField()


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"success": False, "message": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_password = serializer.validated_data["new_password"]
        errors = password_errors(new_password, user)
        if errors:
            return Response({"success": False, "message": " ".join(errors)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        return Response({"success": True, "message": "Password updated."})
