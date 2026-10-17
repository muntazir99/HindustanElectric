"""
Sales and profit (plan §16.2), built only from what bills and returns saved:
- sales = bill totals with GST (as Home and Close the day count them); returns come off on the day they happened;
- profit = value before GST − the cost saved on each bill line when it was sold (returns take back their share);
- lines sold before an item had a cost are reported as "profit unknown", never guessed.
"""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth

from core.numbers import money

from .models import CreditNote, CreditNoteLine, Invoice, InvoiceLine

ZERO = Decimal("0")


def _row():
    return {"bills": 0, "sales": ZERO, "returns": ZERO, "taxable": ZERO, "cost": ZERO, "costed_taxable": ZERO, "quantity": ZERO}


def _finish(row, with_costs):
    """Money as text (like the rest of the API); profit and margin only for those who may see costs."""
    done = {key: str(money(row[key])) for key in ("sales", "returns", "taxable")}
    done["net_sales"] = str(money(row["sales"] - row["returns"]))
    done["bills"] = row["bills"]
    if row["quantity"]:
        done["quantity"] = format(row["quantity"].normalize(), "f")  # "90", never "9E+1"
    if with_costs:
        profit = row["costed_taxable"] - row["cost"]
        # Nothing with a known cost sold: profit is unknown, not zero.
        done["profit"] = str(money(profit)) if row["costed_taxable"] or row["cost"] else None
        done["margin"] = str((profit * 100 / row["costed_taxable"]).quantize(Decimal("0.1"))) if row["costed_taxable"] else None
        done["unknown_cost_sales"] = str(money(row["taxable"] - row["costed_taxable"]))
    return done


def sales_and_profit(start, end, *, with_costs):
    by_month = (end - start).days > 62
    period_of = (lambda day: day.strftime("%Y-%m")) if by_month else (lambda day: day.isoformat())
    summary, periods, items, categories = _row(), defaultdict(_row), defaultdict(_row), defaultdict(_row)
    names = {}

    bills = Invoice.objects.filter(kind=Invoice.Kind.INVOICE, status=Invoice.Status.FINAL, invoice_date__range=(start, end))
    for day, count, total in bills.values_list("invoice_date").annotate(count=Count("id"), total=Sum("total")):
        for row in (summary, periods[period_of(day)]):
            row["bills"] += count
            row["sales"] += total
    returns = CreditNote.objects.filter(date__range=(start, end))
    for day, total in returns.values_list("date").annotate(total=Sum("total")):
        for row in (summary, periods[period_of(day)]):
            row["returns"] += total

    sold = InvoiceLine.objects.filter(invoice__in=bills).values_list(
        "invoice__invoice_date", "item_id", "description", "item__base_unit", "item__product__category__name",
        "base_quantity", "taxable_value", "total", "cost_amount",
    )
    back = CreditNoteLine.objects.filter(credit_note__in=returns).values_list(
        "credit_note__date", "invoice_line__item_id", "invoice_line__description", "invoice_line__item__base_unit",
        "invoice_line__item__product__category__name", "base_quantity", "taxable_value", "total",
        "invoice_line__cost_amount", "invoice_line__base_quantity",
    )
    lines = [(1, *line, None) for line in sold] + [(-1, *line) for line in back]
    for sign, day, item, name, unit, category, quantity, taxable, total, cost, line_quantity in lines:
        if sign < 0 and cost is not None:  # a return takes back its share of the line's cost
            cost = cost * quantity / line_quantity
        names.setdefault(item, (name, unit))
        for row in (summary, periods[period_of(day)], items[item], categories[category or "No category"]):
            row["taxable"] += sign * taxable
            if cost is not None:
                row["cost"] += sign * cost
                row["costed_taxable"] += sign * taxable
        items[item]["quantity"] += sign * quantity
        kind = "sales" if sign > 0 else "returns"
        items[item][kind] += total
        categories[category or "No category"][kind] += total

    result = {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "by": "month" if by_month else "day",
        "summary": {**_finish(summary, with_costs), "gst": None},
        "by_period": [{"period": key, **_finish(periods[key], with_costs)} for key in sorted(periods)],
        "by_item": sorted(
            ({"item": item, "name": names[item][0], "unit": names[item][1], **_finish(row, with_costs)} for item, row in items.items()),
            key=lambda row: -Decimal(row["net_sales"]),
        ),
        "by_category": sorted(
            ({"category": name, **_finish(row, with_costs)} for name, row in categories.items()),
            key=lambda row: -Decimal(row["net_sales"]),
        ),
    }
    tax = InvoiceLine.objects.filter(invoice__in=bills).aggregate(c=Sum("cgst"), s=Sum("sgst"), i=Sum("igst"))
    tax_back = CreditNoteLine.objects.filter(credit_note__in=returns).aggregate(c=Sum("cgst"), s=Sum("sgst"), i=Sum("igst"))
    result["summary"]["gst"] = str(money(sum(v or ZERO for v in tax.values()) - sum(v or ZERO for v in tax_back.values())))
    return result


SHEETS = [
    ("by_period", "By {by}", [("period", "Date / month"), ("bills", "Bills"), ("sales", "Sales"), ("returns", "Returns"), ("net_sales", "Net sales")]),
    ("by_item", "By item", [("name", "Item"), ("quantity", "Quantity"), ("unit", "Unit"), ("sales", "Sales"), ("returns", "Returns"), ("net_sales", "Net sales")]),
    ("by_category", "By category", [("category", "Category"), ("sales", "Sales"), ("returns", "Returns"), ("net_sales", "Net sales")]),
]
COST_COLUMNS = [("profit", "Profit"), ("margin", "Margin %"), ("unknown_cost_sales", "Sold with no cost yet")]


NUMBERS = {"bills", "quantity", "sales", "returns", "net_sales", "taxable", "gst", "profit", "margin", "unknown_cost_sales"}


def cell(field, value):
    """Amounts and quantities go into Excel as numbers, so they can be added up; names stay text."""
    return float(value) if field in NUMBERS and value is not None else value


def workbook(report, with_costs):
    """The report as an Excel file: a summary sheet and one sheet per list."""
    from openpyxl import Workbook

    book = Workbook()
    sheet = book.active
    sheet.title = "Summary"
    sheet.append(["Sales and profit", f"{report['from']} to {report['to']}"])
    for field, label in [("bills", "Bills"), ("sales", "Sales (with GST)"), ("returns", "Returns"), ("net_sales", "Net sales"),
                         ("taxable", "Net sales before GST"), ("gst", "GST collected")] + (COST_COLUMNS if with_costs else []):
        sheet.append([label, cell(field, report["summary"].get(field))])
    for key, title, columns in SHEETS:
        columns = columns + (COST_COLUMNS if with_costs else [])
        sheet = book.create_sheet(title.format(by=report["by"]))
        sheet.append([label for _, label in columns])
        for row in report[key]:
            sheet.append([cell(field, row.get(field)) for field, _ in columns])
    return book
