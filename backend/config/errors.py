"""
Error replies when DEBUG is off: JSON for the API (the React app shows its "detail"), plain text elsewhere.
Tracebacks are never sent to the browser; Django logs them (see LOGGING in settings).
"""

from django.http import HttpResponse, JsonResponse


def _is_api(request):
    return request.path.startswith("/api/")


def not_found(request, exception=None):
    if _is_api(request):
        return JsonResponse({"detail": "Not found."}, status=404)
    return HttpResponse("Page not found.", status=404, content_type="text/plain; charset=utf-8")


def server_error(request):
    message = "Something went wrong on the server. Please try again; if it keeps happening, tell the owner."
    if _is_api(request):
        return JsonResponse({"detail": message}, status=500)
    return HttpResponse(message, status=500, content_type="text/plain; charset=utf-8")
