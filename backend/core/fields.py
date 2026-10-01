from rest_framework import serializers

from catalog.models import GST_RATES

VALID_GST_RATES = {rate for rate, _ in GST_RATES}


class GstRateField(serializers.DecimalField):
    """A GST rate given as any number format ("18", 18, "18.00") that equals an allowed rate."""

    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 4)
        kwargs.setdefault("decimal_places", 2)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value not in VALID_GST_RATES:
            allowed = ", ".join(f"{rate.normalize()}" for rate in sorted(VALID_GST_RATES))
            raise serializers.ValidationError(f"GST rate must be one of: {allowed}.")
        return value
