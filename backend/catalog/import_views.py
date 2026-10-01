from django.http import HttpResponse
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOwner

from . import importers

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

KINDS = {
    "catalogue": (importers.CATALOGUE_COLUMNS, importers.CATALOGUE_EXAMPLES, importers.import_catalogue),
    "prices": (importers.PRICE_COLUMNS, (), importers.import_prices),
}


def flag(request, name):
    return str(request.data.get(name, "")).lower() in ("1", "true", "yes")


def kind_or_404(kind):
    if kind not in KINDS:
        raise NotFound("Unknown import type.")
    return KINDS[kind]


class ImportTemplate(APIView):
    permission_classes = [IsOwner]

    def get(self, request, kind):
        columns, examples, _ = kind_or_404(kind)
        response = HttpResponse(importers.build_template(columns, examples), content_type=XLSX)
        response["Content-Disposition"] = f'attachment; filename="hindustan-electric-{kind}-template.xlsx"'
        return response


class ImportUpload(APIView):
    """
    Upload a filled sheet (field "file"). By default this is a preview that changes nothing.
    Send commit=true to save; add skip_errors=true to save the good rows when some rows have errors.
    """

    permission_classes = [IsOwner]
    parser_classes = [MultiPartParser]

    def post(self, request, kind):
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose an .xlsx or .csv file."})
        if upload.size > MAX_UPLOAD_BYTES:
            raise ValidationError({"file": "File is larger than 5 MB. Split it into parts."})
        _, _, run_import = kind_or_404(kind)
        result = run_import(upload, commit=flag(request, "commit"), skip_errors=flag(request, "skip_errors"))
        return Response(result)
