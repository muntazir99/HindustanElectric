"""
GST summary for the CA (plan §16.3): a month (or quarter) of bills and returns in the GSTR-1 layout.
- b2b: bills with the buyer's GSTIN, one row per bill and rate.
- b2cl: inter-state bills to unregistered buyers over ₹1,00,000; b2cs: every other unregistered sale, by state and rate.
- cdnr: returns on b2b bills. Returns on unregistered bills come off b2cs.
- 0% lines go to exemp (nil rated). The HSN summary is net of returns, split b2b / b2c.
- Cancelled bills only count under docs; estimates are left out.
"""

from decimal import Decimal

from django.db.models import F

from core.numbers import money
from shop.models import ShopSettings

from .models import CreditNote, CreditNoteLine, Invoice, InvoiceLine
from .states import STATES

ZERO = Decimal("0")
B2CL_ABOVE = Decimal("100000")
TAXES = ("taxable_value", "igst", "cgst", "sgst")
UQC = {
    "pc": "PCS-PIECES", "m": "MTR-METERS", "ft": "OTH-OTHERS", "kg": "KGS-KILOGRAMS", "l": "LTR-LITRES",
    "set": "SET-SETS", "pair": "PRS-PAIRS", "pkt": "PAC-PACKS", "roll": "ROL-ROLLS",
}
EXEMPT = {
    (True, True): "Inter-State supplies to registered persons",
    (False, True): "Intra-State supplies to registered persons",
    (True, False): "Inter-State supplies to unregistered persons",
    (False, False): "Intra-State supplies to unregistered persons",
}
CHECK = ["IGST (to check)", "CGST (to check)", "SGST (to check)"]
HSN_COLUMNS = ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value",
               "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"]
SHEETS = {
    "b2b": ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply",
            "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value",
            "Cess Amount", *CHECK],
    "b2cl": ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate",
             "Taxable Value", "Cess Amount", "E-Commerce GSTIN", "IGST (to check)"],
    "b2cs": ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount",
             "E-Commerce GSTIN", *CHECK],
    "cdnr": ["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply",
             "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value",
             "Cess Amount", *CHECK],
    "exemp": ["Description", "Nil Rated Supplies", "Exempted(other than nil rated/non GST supply)", "Non-GST Supplies"],
    "hsn(b2b)": HSN_COLUMNS,
    "hsn(b2c)": HSN_COLUMNS,
    "docs": ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"],
}


def place(code):
    return f"{code}-{STATES.get(code, 'Other Territory')}"


def when(day):
    return day.strftime("%d-%b-%Y")


def rate_text(rate):
    return format(rate.normalize(), "f")


def _add(table, key, line, sign, fields=TAXES):
    """Add a line's amounts into table[key]; the first line seen keeps the bill's details for the row."""
    row = table.setdefault(key, {"line": line, **dict.fromkeys(fields, ZERO)})
    for field in fields:
        row[field] += sign * line[field]


def _taxes(row):
    return {"IGST (to check)": row["igst"], "CGST (to check)": row["cgst"], "SGST (to check)": row["sgst"]}


def _documents(nature, numbers, cancelled=0):
    numbers = sorted(numbers)
    if not numbers:
        return []
    return [{"Nature of Document": nature, "Sr. No. From": numbers[0], "Sr. No. To": numbers[-1],
             "Total Number": len(numbers), "Cancelled": cancelled}]


def gst_summary(start, end):
    """(screen, sheets): totals for the screen, and the rows of each Excel sheet."""
    shop = ShopSettings.load()
    bills = Invoice.objects.filter(kind=Invoice.Kind.INVOICE, status=Invoice.Status.FINAL, invoice_date__range=(start, end))
    notes = CreditNote.objects.filter(date__range=(start, end))
    sold = InvoiceLine.objects.filter(invoice__in=bills).values(
        "gst_rate", "hsn_code", "description", "base_quantity", "total", *TAXES,
        doc=F("invoice_id"), number=F("invoice__number"), day=F("invoice__invoice_date"), value=F("invoice__total"),
        gstin=F("invoice__buyer_gstin"), buyer=F("invoice__buyer_name"), pos=F("invoice__place_of_supply"),
        base_unit=F("item__base_unit"),
    )
    back = CreditNoteLine.objects.filter(credit_note__in=notes).values(
        "base_quantity", "total", *TAXES,
        doc=F("credit_note_id"), number=F("credit_note__number"), day=F("credit_note__date"), value=F("credit_note__total"),
        gstin=F("credit_note__invoice__buyer_gstin"), buyer=F("credit_note__invoice__buyer_name"),
        pos=F("credit_note__invoice__place_of_supply"), gst_rate=F("invoice_line__gst_rate"),
        hsn_code=F("invoice_line__hsn_code"), description=F("invoice_line__description"),
        base_unit=F("invoice_line__item__base_unit"),
    )

    by_rate, b2b, b2cl, b2cs, cdnr, exempt, hsn = {}, {}, {}, {}, {}, {}, {}
    missing_hsn = set()
    for sign, lines in ((1, sold), (-1, back)):
        for line in lines:
            rate, registered, inter = line["gst_rate"], bool(line["gstin"]), line["pos"] != shop.state_code
            _add(by_rate, rate, line, sign)
            _add(hsn, (registered, line["hsn_code"], UQC.get(line["base_unit"], "OTH-OTHERS"), rate), line, sign,
                 (*TAXES, "base_quantity", "total"))
            if not line["hsn_code"]:
                missing_hsn.add(line["description"])
            if not rate:
                _add(exempt, (inter, registered), line, sign)
            elif registered:
                _add(b2b if sign > 0 else cdnr, (line["number"], rate), line, 1)
            elif sign > 0 and inter and line["value"] > B2CL_ABOVE:
                _add(b2cl, (line["number"], rate), line, 1)
            else:
                # ponytail: a return on a b2cl bill also comes off b2cs; the portal wants it under cdnur. Add if one ever happens.
                _add(b2cs, (line["pos"], rate), line, sign)

    sheets = {
        "b2b": [
            {"GSTIN/UIN of Recipient": r["line"]["gstin"], "Receiver Name": r["line"]["buyer"], "Invoice Number": number,
             "Invoice date": when(r["line"]["day"]), "Invoice Value": r["line"]["value"], "Place Of Supply": place(r["line"]["pos"]),
             "Reverse Charge": "N", "Invoice Type": "Regular B2B", "Rate": rate, "Taxable Value": r["taxable_value"],
             "Cess Amount": ZERO, **_taxes(r)}
            for (number, rate), r in sorted(b2b.items())
        ],
        "b2cl": [
            {"Invoice Number": number, "Invoice date": when(r["line"]["day"]), "Invoice Value": r["line"]["value"],
             "Place Of Supply": place(r["line"]["pos"]), "Rate": rate, "Taxable Value": r["taxable_value"], "Cess Amount": ZERO,
             "IGST (to check)": r["igst"]}
            for (number, rate), r in sorted(b2cl.items())
        ],
        "b2cs": [
            {"Type": "OE", "Place Of Supply": place(pos), "Rate": rate, "Taxable Value": r["taxable_value"], "Cess Amount": ZERO,
             **_taxes(r)}
            for (pos, rate), r in sorted(b2cs.items())
        ],
        "cdnr": [
            {"GSTIN/UIN of Recipient": r["line"]["gstin"], "Receiver Name": r["line"]["buyer"], "Note Number": number,
             "Note Date": when(r["line"]["day"]), "Note Type": "C", "Place Of Supply": place(r["line"]["pos"]),
             "Reverse Charge": "N", "Note Supply Type": "Regular B2B", "Note Value": r["line"]["value"], "Rate": rate,
             "Taxable Value": r["taxable_value"], "Cess Amount": ZERO, **_taxes(r)}
            for (number, rate), r in sorted(cdnr.items())
        ],
        "exemp": [
            {"Description": EXEMPT[key], "Nil Rated Supplies": r["taxable_value"],
             "Exempted(other than nil rated/non GST supply)": ZERO, "Non-GST Supplies": ZERO}
            for key, r in sorted(exempt.items(), reverse=True)
        ],
    }
    for name, registered in (("hsn(b2b)", True), ("hsn(b2c)", False)):
        sheets[name] = [
            {"HSN": code, "UQC": uqc, "Total Quantity": r["base_quantity"],
             "Total Value": r["total"], "Rate": rate, "Taxable Value": r["taxable_value"], "Integrated Tax Amount": r["igst"],
             "Central Tax Amount": r["cgst"], "State/UT Tax Amount": r["sgst"], "Cess Amount": ZERO}
            for (b2b_side, code, uqc, rate), r in sorted(hsn.items()) if b2b_side == registered
        ]
    numbered = Invoice.objects.filter(
        kind=Invoice.Kind.INVOICE, invoice_date__range=(start, end), status__in=[Invoice.Status.FINAL, Invoice.Status.CANCELLED]
    )
    sheets["docs"] = _documents(
        "Invoices for outward supply", numbered.values_list("number", flat=True),
        numbered.filter(status=Invoice.Status.CANCELLED).count(),
    ) + _documents("Credit Note", notes.values_list("number", flat=True))

    total = dict.fromkeys(TAXES, ZERO)
    for row in by_rate.values():
        for field in TAXES:
            total[field] += row[field]
    as_text = lambda row: {"taxable": str(money(row["taxable_value"])), **{tax: str(money(row[tax])) for tax in TAXES[1:]},
                           "gst": str(money(row["igst"] + row["cgst"] + row["sgst"]))}
    screen = {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "shop_gstin": shop.gstin,
        "by_rate": [{"rate": rate_text(rate), **as_text(row)} for rate, row in sorted(by_rate.items())],
        "total": as_text(total),
        "counts": {
            "bills": bills.count(), "b2b": len({number for number, _ in b2b}), "b2cl": len({number for number, _ in b2cl}),
            "returns": notes.count(), "cdnr": len({number for number, _ in cdnr}),
        },
        "documents": sheets["docs"],
        "missing_hsn": sorted(missing_hsn),
    }
    return screen, sheets


def workbook(screen, sheets):
    """A Summary sheet for reading, then one sheet per GSTR-1 table with the portal's column names."""
    from openpyxl import Workbook

    book = Workbook()
    summary = book.active
    summary.title = "Summary"
    summary.append(["GST summary", f"{screen['from']} to {screen['to']}"])
    summary.append(["Shop GSTIN", screen["shop_gstin"] or "Not filled in Shop Details"])
    summary.append([])
    summary.append(["GST rate %", "Taxable value", "IGST", "CGST", "SGST", "Total GST"])
    for row in [*screen["by_rate"], {"rate": "Total", **screen["total"]}]:
        summary.append([float(row["rate"]) if row["rate"] != "Total" else "Total",
                        *(float(row[field]) for field in ("taxable", "igst", "cgst", "sgst", "gst"))])
    summary.append([])
    summary.append(["Net of returns. Cancelled bills appear only under docs; estimates are left out."])
    for name, headers in SHEETS.items():
        sheet = book.create_sheet(name)
        sheet.append(headers)
        for row in sheets[name]:
            sheet.append([float(value) if isinstance(value, Decimal) else value for value in map(row.get, headers)])
    return book
