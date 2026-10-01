from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

from catalog.services import CatalogError
from sales.services import BillingError
from stock.services import StockError


def api_exception_handler(exc, context):
    """Business-rule and model validation errors become a 400 with their message."""
    if isinstance(exc, (CatalogError, StockError, BillingError)):
        return Response({"detail": str(exc)}, status=400)
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            return Response(exc.message_dict, status=400)
        return Response({"detail": " ".join(exc.messages)}, status=400)
    return exception_handler(exc, context)
