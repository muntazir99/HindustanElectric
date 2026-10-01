from rest_framework.exceptions import ValidationError


def id_param(params, name):
    """An id from the query string (?customer=12), or None. Anything but digits is a 400, not a crash."""
    value = params.get(name, "").strip()
    if not value:
        return None
    if not value.isdigit():
        raise ValidationError({name: "Must be a number."})
    return int(value)
