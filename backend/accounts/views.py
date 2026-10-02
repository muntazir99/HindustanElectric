from datetime import datetime, timezone

from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from . import access
from .models import User
from .permissions import OPEN, IsOwner


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
        update_last_login(None, user)  # shown on Staff & Access ("last logged in …")
        return Response(
            {
                "success": True,
                "message": "Login successful",
                "role": user.role,
                "name": user.get_full_name() or user.username,
                "access": user.switches(),
                **tokens_for(user),
            }
        )


def note_login_time(user, token):
    """
    App logins before 2026-10-02 didn't record the time, so Staff & Access said "hasn't logged in yet" for
    people who had. The login token says when it was issued: record that if it's newer than what's stored.
    """
    issued = token.get("iat") if token is not None and hasattr(token, "get") else None
    if not issued:
        return
    started = datetime.fromtimestamp(issued, tz=timezone.utc)
    # Tokens count whole seconds; the login itself records the exact moment.
    if user.last_login is None or user.last_login.replace(microsecond=0) < started:
        User.objects.filter(pk=user.pk).update(last_login=started)
        user.last_login = started


class MeView(APIView):
    """Who is logged in and what they may do. The app asks on every start, so switch changes show at once."""

    access = {"get": OPEN}

    def get(self, request):
        user = request.user
        note_login_time(user, request.auth)
        return Response(
            {
                "success": True,
                "data": {
                    "username": user.username,
                    "name": user.get_full_name() or user.username,
                    "role": user.role,
                    "access": user.switches(),
                },
            }
        )


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField()


class ChangePasswordView(APIView):
    access = {"post": OPEN}

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


# --- Staff & Access (owner only) ---


class AccessView(APIView):
    """The switches, their groups and the quick starting sets, for the Staff & Access page."""

    permission_classes = [IsOwner]

    def get(self, request):
        return Response(
            {
                "switches": [
                    {"code": code, "group": group, "label": label, "help": help_text}
                    for code, group, label, help_text in access.SWITCHES
                ],
                "presets": access.PRESETS,
                "new_staff": access.NEW_STAFF,
            }
        )


class StaffSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, required=False, allow_blank=True)
    access = serializers.ListField(child=serializers.ChoiceField(choices=access.CODES), required=False)

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "is_active", "access", "last_login"]
        read_only_fields = ["username", "role", "last_login"]

    def to_representation(self, user):
        data = super().to_representation(user)
        data["access"] = user.switches()
        return data

    def validate_access(self, codes):
        return access.clean(codes)


class NewStaffSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    password = serializers.CharField()
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.STAFF)
    access = serializers.ListField(child=serializers.ChoiceField(choices=access.CODES), required=False)

    def validate_username(self, username):
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError("A user with this username already exists.")
        return username

    def validate(self, attrs):
        errors = password_errors(attrs["password"], User(username=attrs["username"], first_name=attrs["name"]))
        if errors:
            raise ValidationError({"password": errors})
        return attrs


class StaffViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Everyone who can log in: add staff, turn their switches on/off, reset a password, switch a login off."""

    permission_classes = [IsOwner]
    serializer_class = StaffSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch"]
    queryset = User.objects.order_by("-role", "-is_active", "first_name", "username")

    def create(self, request):
        serializer = NewStaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = User.objects.create_user(
            username=data["username"],
            password=data["password"],
            first_name=data["name"].strip(),
            role=data["role"],
            access=access.clean(data.get("access", access.NEW_STAFF)),
        )
        return Response(StaffSerializer(user).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        if serializer.instance == self.request.user and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"is_active": "You can't switch off your own login."})
        serializer.save()

    @action(detail=True, methods=["post"])
    def password(self, request, pk=None):
        """Set a new password for someone who forgot theirs: {password}."""
        user = self.get_object()
        new_password = str(request.data.get("password", ""))
        errors = password_errors(new_password, user)
        if errors:
            raise ValidationError({"password": errors})
        user.set_password(new_password)
        user.save()
        return Response({"success": True, "message": f"New password set for {user.username}."})
