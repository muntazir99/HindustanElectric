from django.http import HttpResponse
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOwner

from . import importers

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# kind: (columns, examples, extra guide notes, import function)
KINDS = {
    "catalogue": (importers.CATALOGUE_COLUMNS, importers.SAMPLE_ROWS[:3], importers.STOCK_GUIDE, importers.import_catalogue),
    "prices": (importers.PRICE_COLUMNS, (), (), importers.import_prices),
}


def flag(request, name):
    return str(request.data.get(name, "")).lower() in ("1", "true", "yes")


def kind_or_404(kind):
    if kind not in KINDS:
        raise NotFound("Unknown import type.")
    return KINDS[kind]


def xlsx_response(content, filename):
    response = HttpResponse(content, content_type=XLSX)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


class ImportTemplate(APIView):
    """Empty sheet with headings and a how-to sheet."""

    permission_classes = [IsOwner]

    def get(self, request, kind):
        columns, examples, notes, _ = kind_or_404(kind)
        return xlsx_response(
            importers.build_template(columns, examples, notes=notes),
            f"hindustan-electric-{kind}-template.xlsx",
        )


class CatalogueSample(APIView):
    """A filled-in example sheet, for anyone preparing items (staff fill it, the owner imports it)."""

    def get(self, request):
        return xlsx_response(
            importers.build_template(
                importers.CATALOGUE_COLUMNS, importers.SAMPLE_ROWS, filled=True, notes=importers.STOCK_GUIDE
            ),
            "hindustan-electric-sample-items.xlsx",
        )


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
        _, _, _, run_import = kind_or_404(kind)
        result = run_import(
            upload, commit=flag(request, "commit"), skip_errors=flag(request, "skip_errors"), user=request.user
        )
        return Response(result)
