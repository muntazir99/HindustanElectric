from rest_framework.permissions import BasePermission

# An action anyone logged in may use (finding items, printing details, ...).
OPEN = "open"


def can(request_or_context, *codes):
    """True if the user has any of `codes` (the owner always does). Takes a request or a serializer context."""
    request = request_or_context.get("request") if isinstance(request_or_context, dict) else request_or_context
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated and any(user.can(code) for code in codes))


class IsOwner(BasePermission):
    """Allows access only to users with the owner role."""

    message = "Only the owner can do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_owner)


class HasAccess(BasePermission):
    """
    Checks the view's `access` map: {action or method: switch code, a tuple of codes (any one is enough),
    a function (request, view) -> codes, or OPEN}. An action missing from the map is owner-only, so a new
    endpoint is never open to staff by accident.
    """

    message = "You don't have access to this. Ask the owner."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_owner:
            return True
        rules = getattr(view, "access", {})
        key = getattr(view, "action", None) or request.method.lower()
        if key not in rules:
            key = request.method.lower()
        rule = rules.get(key)
        if callable(rule):
            rule = rule(request, view)
        if rule is None:
            return False
        if rule == OPEN:
            return True
        codes = (rule,) if isinstance(rule, str) else rule
        return can(request, *codes)
