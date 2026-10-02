from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import OPEN

from .models import ShopSettings


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        exclude = ["id", "updated_at"]


class ShopSettingsView(APIView):
    """Read-only for the React app (printing needs it); the owner edits settings in Django admin."""

    access = {"get": OPEN}

    def get(self, request):
        return Response({"success": True, "data": ShopSettingsSerializer(ShopSettings.load()).data})
