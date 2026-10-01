"""
Excel / CSV import for the catalogue and for price updates.

Every import runs in one transaction with a savepoint per row, so a preview
(commit=False) shows exactly what would happen, including clashes with
existing data, and then rolls everything back.
"""

import csv
import io
import logging
from decimal import Decimal, InvalidOperation
from itertools import islice

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from stock.models import StockCount
from stock.services import StockError, count_item

from .display import format_quantity
from .models import GST_RATES, Item, ItemUnit, Product, hsn_validator
from .services import (
    CatalogError,
    brand_named,
    category_named,
    check_barcode_free,
    create_item,
    find_product,
    parse_base_unit,
    set_base_unit,
    set_pack,
)

MAX_ROWS = 10000
# Never read more than this from a sheet, however big the file claims to be (a 5 MB .xlsx can unpack to
# millions of cells). Extra columns beyond these are ignored.
MAX_READ_ROWS = MAX_ROWS + 1000
MAX_READ_COLUMNS = 60

logger = logging.getLogger(__name__)

# (header, key, help text)
CATALOGUE_COLUMNS = [
    ("Category", "category", "e.g. Wires & Cables. Created if new."),
    ("Brand", "brand", "e.g. Havells. Created if new. Blank for unbranded goods."),
    ("Product", "product", "Required. The product line, e.g. Lifeline Plus HRFR wire."),
    ("Variant", "variant", "Size / colour / rating, e.g. 1.5 sq mm Red. Blank if none."),
    ("HSN", "hsn", "4, 6 or 8 digit HSN code."),
    ("GST %", "gst", "0, 5, 12, 18, 28 or 40. Default 18."),
    ("Unit", "unit", "Smallest unit you sell in: pc, m, ft, kg, l, set, pair, pkt, roll. Default pc."),
    ("MRP", "mrp", "MRP per unit."),
    ("Selling price", "selling_price", "Your price per unit, GST included."),
    ("Barcode", "barcode", "Barcode of a single unit, if it has one."),
    ("Pack unit", "pack_unit", "If also bought/sold in packs: coil, box, bundle..."),
    ("Pack size", "pack_size", "Units in one pack, e.g. 90 (m in a coil) or 100 (pc in a box)."),
    ("Pack barcode", "pack_barcode", "Barcode printed on the pack."),
    ("Pack MRP", "pack_mrp", "MRP of the whole pack."),
    ("Pack price", "pack_price", "Your price for the whole pack, GST included."),
    ("Rack", "rack", "Where it is kept, e.g. A3."),
    ("Stock (packs)", "stock_packs", "Full packs on the shelf now, e.g. 4 coils. Blank if not counted."),
    ("Stock (loose)", "stock_loose", "Loose units on the shelf now, in the Unit column's unit, e.g. 35 (m). Blank if not counted."),
    ("Min stock", "min_stock", "Reorder when stock falls to this (in units)."),
    ("Aliases", "aliases", "Other names customers use, comma separated."),
]

# Stock columns don't change stock directly: they fill a stock count for the owner to review and post.
STOCK_KEYS = {"stock_packs", "stock_loose"}

PRICE_COLUMNS = [
    ("Barcode or code", "code", "Item barcode, pack barcode, or the item code shown in the app."),
    ("MRP", "mrp", "New MRP for that unit or pack. Blank = unchanged."),
    ("Selling price", "selling_price", "New selling price for that unit or pack, GST included. Blank = unchanged."),
]

# A filled-in example sheet anyone can download. Prices and barcodes are made up.
SAMPLE_ROWS = [
    {"category": "Wires & Cables", "brand": "Havells", "product": "Lifeline Plus HRFR wire", "variant": "1.5 sq mm Red",
     "hsn": "8544", "gst": 18, "unit": "m", "selling_price": 28, "pack_unit": "coil", "pack_size": 90,
     "pack_barcode": "8901234500011", "pack_mrp": 2650, "pack_price": 2400, "rack": "W1",
     "stock_packs": 4, "stock_loose": 35, "min_stock": 180},
    {"category": "Wires & Cables", "brand": "Havells", "product": "Lifeline Plus HRFR wire", "variant": "1.5 sq mm Black",
     "hsn": "8544", "gst": 18, "unit": "m", "selling_price": 28, "pack_unit": "coil", "pack_size": 90,
     "pack_barcode": "8901234500012", "pack_mrp": 2650, "pack_price": 2400, "rack": "W1",
     "stock_packs": 3, "min_stock": 180},
    {"category": "Wires & Cables", "brand": "Havells", "product": "Lifeline Plus HRFR wire", "variant": "2.5 sq mm Red",
     "hsn": "8544", "gst": 18, "unit": "m", "selling_price": 44, "pack_unit": "coil", "pack_size": 90,
     "pack_barcode": "8901234500013", "pack_mrp": 4200, "pack_price": 3800, "rack": "W1",
     "stock_packs": 2, "stock_loose": 60, "min_stock": 180},
    {"category": "Switches & Sockets", "brand": "Anchor", "product": "Roma 6A switch", "variant": "White",
     "hsn": "8536", "gst": 18, "unit": "pc", "mrp": 52, "selling_price": 45, "barcode": "8901234500028",
     "pack_unit": "box", "pack_size": 20, "pack_barcode": "8901234500035", "rack": "S1",
     "stock_packs": 2, "stock_loose": 7, "min_stock": 40, "aliases": "button switch"},
    {"category": "Switches & Sockets", "brand": "Anchor", "product": "Roma 6A socket", "variant": "White",
     "hsn": "8536", "gst": 18, "unit": "pc", "mrp": 78, "selling_price": 68, "barcode": "8901234500042",
     "pack_unit": "box", "pack_size": 10, "pack_barcode": "8901234500059", "rack": "S1",
     "stock_loose": 14, "min_stock": 20, "aliases": "plug socket"},
    {"category": "MCB & DB", "brand": "Havells", "product": "SP MCB C-curve", "variant": "16A",
     "hsn": "8536", "gst": 18, "unit": "pc", "mrp": 310, "selling_price": 270, "barcode": "8901234500066",
     "rack": "M2", "stock_loose": 23, "min_stock": 10, "aliases": "mcb"},
    {"category": "Lighting", "brand": "Syska", "product": "LED bulb B22", "variant": "9W Cool Day Light",
     "hsn": "8539", "gst": 5, "unit": "pc", "mrp": 120, "selling_price": 90, "barcode": "8901234500073",
     "pack_unit": "box", "pack_size": 10, "pack_barcode": "8901234500080", "rack": "L1",
     "stock_packs": 5, "stock_loose": 3, "min_stock": 30, "aliases": "bulb"},
    {"category": "Fans", "brand": "Crompton", "product": "HS Plus ceiling fan 1200 mm", "variant": "Brown",
     "hsn": "8414", "gst": 18, "unit": "pc", "mrp": 2900, "selling_price": 2450, "barcode": "8901234500097",
     "rack": "F1", "stock_loose": 6, "min_stock": 2, "aliases": "pankha"},
    {"category": "Pipes & Fittings", "product": "PVC conduit pipe 20 mm", "variant": "3 m length",
     "hsn": "3917", "gst": 18, "unit": "pc", "selling_price": 55, "pack_unit": "bundle", "pack_size": 10,
     "rack": "P1", "stock_packs": 7, "stock_loose": 4, "min_stock": 20, "aliases": "pipe"},
    {"category": "Hardware", "product": "Wood screw", "variant": "1 inch", "hsn": "7318", "gst": 18, "unit": "pc",
     "selling_price": 1, "pack_unit": "box", "pack_size": 100, "pack_barcode": "8901234500103", "pack_price": 80,
     "rack": "H3", "stock_packs": 3, "stock_loose": 45, "min_stock": 200, "aliases": "pench"},
    {"category": "Hardware", "brand": "Anchor", "product": "Insulation tape", "variant": "Black", "hsn": "3919",
     "gst": 18, "unit": "roll", "mrp": 25, "selling_price": 20, "barcode": "8901234500110", "rack": "H1",
     "stock_loose": 38, "min_stock": 20, "aliases": "tape"},
    {"category": "Accessories", "brand": "Anchor", "product": "Batten holder", "variant": "Straight", "hsn": "8536",
     "gst": 18, "unit": "pc", "mrp": 45, "selling_price": 38, "rack": "S3", "aliases": "holder, kit-kat"},
]

STOCK_GUIDE = [
    ("Stock example", "4 coils of 90 m and 35 m cut loose  ->  Stock (packs) = 4, Stock (loose) = 35  ->  395 m."),
    ("", "Item with no pack (e.g. MCB): leave Stock (packs) blank and put the count in Stock (loose)."),
    ("", "Not counted yet? Leave both stock cells blank. The item is added and shows as 'not counted'."),
    ("", "Stock goes into a stock count named after your file. The owner reviews it under Stock counts and posts it."),
]

TEXT_KEYS = {"barcode", "pack_barcode", "code", "hsn"}


# --- reading files -----------------------------------------------------------

def _cell_text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def read_rows(upload, columns):
    """Return [(row_number, {key: text})] from an .xlsx or .csv upload."""
    name = (upload.name or "").lower()
    if name.endswith(".csv"):
        data = upload.read()
        # "CSV UTF-8" from Excel, or plain "CSV" from Excel on Windows (Windows-1252).
        for encoding in ("utf-8-sig", "cp1252"):
            try:
                text = data.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise CatalogError("Could not read the CSV file. In Excel use Save As › “CSV UTF-8”, or upload the .xlsx.")
        raw = [row[:MAX_READ_COLUMNS] for row in islice(csv.reader(io.StringIO(text)), MAX_READ_ROWS + 1)]
    elif name.endswith(".xlsx"):
        try:
            sheet = load_workbook(upload, read_only=True, data_only=True).worksheets[0]
            rows = sheet.iter_rows(max_col=MAX_READ_COLUMNS, values_only=True)
            raw = [list(row) for row in islice(rows, MAX_READ_ROWS + 1)]
        except Exception as exc:
            logger.warning("Unreadable Excel upload %r: %s", upload.name, exc)
            raise CatalogError("Could not read this Excel file. Open it in Excel, save it again as .xlsx, and retry.") from exc
    else:
        raise CatalogError("Upload an .xlsx (Excel) or .csv file.")
    if len(raw) > MAX_READ_ROWS:
        raise CatalogError(f"Too many rows. Split the file into parts of {MAX_ROWS}.")

    header_index = next((i for i, row in enumerate(raw) if any(_cell_text(c) for c in row)), None)
    if header_index is None:
        raise CatalogError("The file is empty.")
    by_header = {header.lower(): key for header, key, _ in columns}
    keys = [by_header.get(_cell_text(cell).lower()) for cell in raw[header_index]]
    if not any(keys):
        expected = ", ".join(header for header, _, _ in columns)
        raise CatalogError(f"No known column headings found. Expected: {expected}.")

    rows = []
    for offset, row in enumerate(raw[header_index + 1:], start=header_index + 2):
        values = {key: "" for _, key, _ in columns}
        for key, cell in zip(keys, row):
            if key:
                values[key] = _cell_text(cell)
        if any(values.values()):
            rows.append((offset, values))
    if len(rows) > MAX_ROWS:
        raise CatalogError(f"Too many rows ({len(rows)}). Split the file into parts of {MAX_ROWS}.")
    return rows


def _decimal(row, key, label):
    text = row.get(key, "").replace(",", "").replace("₹", "").strip()
    if not text:
        return None
    try:
        value = Decimal(text)
    except InvalidOperation as exc:
        raise CatalogError(f'{label}: "{row[key]}" is not a number.') from exc
    if value < 0:
        raise CatalogError(f"{label} can't be negative.")
    return value


def _gst(row):
    value = _decimal(row, "gst", "GST %")
    if value is None:
        return None
    if value not in {rate for rate, _ in GST_RATES}:
        raise CatalogError(f"GST % must be 0, 5, 12, 18, 28 or 40 (got {row['gst']}).")
    return value


def _messages(exc):
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            return [f"{field}: {msg}" for field, msgs in exc.message_dict.items() for msg in msgs]
        return list(exc.messages)
    if isinstance(exc, IntegrityError):
        return ["Conflicts with existing data (duplicate name or barcode)."]
    return [str(exc)]


def _run(rows, handle_row, *, commit, skip_errors, before=None, after=None):
    """
    Run handle_row for every row, each in its own savepoint. `before` runs first and
    `after` runs last (returning extra summary fields), both inside the same transaction.
    """
    results = []
    extra = {}
    with transaction.atomic():
        if before:
            before()
        for number, row in rows:
            try:
                with transaction.atomic():
                    results.append({"row": number, **handle_row(number, row)})
            except (CatalogError, StockError, DjangoValidationError, IntegrityError) as exc:
                label = " ".join(filter(None, [row.get("brand"), row.get("product"), row.get("variant"), row.get("code")]))
                results.append({"row": number, "status": "error", "item": label, "messages": _messages(exc)})
        if after:
            extra = after() or {}
        errors = sum(1 for result in results if result["status"] == "error")
        committed = commit and (errors == 0 or skip_errors)
        if not committed:
            transaction.set_rollback(True)
            # New items and counts get their real ids only when actually saved.
            extra.pop("stock_count_id", None)
            for result in results:
                if result["status"] == "created":
                    result.pop("code", None)
    summary = {
        "rows": len(results),
        "created": sum(1 for r in results if r["status"] == "created"),
        "updated": sum(1 for r in results if r["status"] == "updated"),
        "unchanged": sum(1 for r in results if r["status"] == "unchanged"),
        "errors": errors,
        "committed": committed,
        **extra,
    }
    return {"summary": summary, "rows": results}


# --- catalogue -----------------------------------------------------------------

def import_catalogue(upload, *, commit=False, skip_errors=False, user=None):
    """
    Create or update items. Rows with Stock (packs) / Stock (loose) also go into one
    stock count named after the file, for the owner to review and post.
    """
    rows = read_rows(upload, CATALOGUE_COLUMNS)
    has_stock = any(row[key] for _, row in rows for key in STOCK_KEYS)
    seen = {}
    state = {"count": None}

    def before():
        if has_stock:
            state["count"] = StockCount.objects.create(
                title=f"Excel: {upload.name}"[:80], note="Stock quantities imported from Excel", created_by=user
            )

    def handle(number, row):
        if not row["product"]:
            raise CatalogError("Product name is missing.")
        key = (row["brand"].lower(), row["product"].lower(), row["variant"].lower())
        if key in seen:
            raise CatalogError(f"Same product and variant as row {seen[key]}.")
        seen[key] = number
        result, item = _catalogue_row(row)
        stock = _stock_quantity(row, item)
        if stock is not None:
            count_item(state["count"], item.pk, stock, user)
            result["messages"] = [f"On shelf: {format_quantity(stock, item.base_unit, item.units.all())} — goes into a stock count to review"]
        return result

    def after():
        count = state["count"]
        if count is None:
            return {}
        lines = count.lines.count()
        if lines == 0:
            count.delete()
            return {}
        return {"stock_count_id": count.pk, "stock_count_title": count.title, "stock_lines": lines}

    return _run(rows, handle, commit=commit, skip_errors=skip_errors, before=before, after=after)


def _stock_quantity(row, item):
    """Stock on the shelf in base units, from Stock (packs) × pack size + Stock (loose). None if blank."""
    packs = _decimal(row, "stock_packs", "Stock (packs)")
    loose = _decimal(row, "stock_loose", "Stock (loose)")
    if packs is None and loose is None:
        return None
    total = loose or Decimal("0")
    if packs:
        if row["pack_size"]:
            factor = _decimal(row, "pack_size", "Pack size")
        else:
            item_packs = list(item.units.filter(is_base=False))
            if len(item_packs) != 1:
                raise CatalogError(
                    "Stock (packs) needs Pack unit and Pack size in this row"
                    + (" (the item has more than one pack size)." if item_packs else ".")
                )
            factor = item_packs[0].factor
        total += packs * factor
    return total


def _catalogue_row(row):
    base_unit = parse_base_unit(row["unit"]) if row["unit"] else None
    gst = _gst(row)
    hsn = row["hsn"].replace(" ", "")
    if hsn:
        hsn_validator(hsn)
    brand = brand_named(row["brand"])
    category = category_named(row["category"])

    product = find_product(row["product"], brand)
    if product is None:
        product = Product(name=row["product"].strip(), brand=brand, category=category, hsn_code=hsn)
        if gst is not None:
            product.gst_rate = gst
        product.full_clean()
        product.save()
    else:
        changed = False
        for field, value in (("category", category), ("hsn_code", hsn or None), ("gst_rate", gst)):
            if value is not None and getattr(product, field) != value:
                setattr(product, field, value)
                changed = True
        if changed:
            product.full_clean()
            product.save()

    fields = {}
    for key, label in (("mrp", "MRP"), ("selling_price", "Selling price"), ("min_stock", "Min stock")):
        value = _decimal(row, key, label)
        if value is not None:
            fields[key] = value
    for key in ("rack", "aliases"):
        if row[key]:
            fields[key] = row[key]

    pack = None
    if row["pack_unit"] or row["pack_size"]:
        size = _decimal(row, "pack_size", "Pack size")
        if not row["pack_unit"] or not size:
            raise CatalogError("Give both Pack unit and Pack size, or neither.")
        pack = {
            "name": row["pack_unit"],
            "factor": size,
            "barcode": row["pack_barcode"] or None,
            "mrp": _decimal(row, "pack_mrp", "Pack MRP"),
            "selling_price": _decimal(row, "pack_price", "Pack price"),
        }

    item = product.items.filter(variant__iexact=row["variant"].strip()).first()
    if item is None:
        item = create_item(
            product, row["variant"], base_unit or "pc", barcode=row["barcode"] or None, pack=pack, **fields
        )
        return {"status": "created", "item": item.name, "code": item.code}, item

    if base_unit:
        set_base_unit(item, base_unit)
    for field, value in fields.items():
        setattr(item, field, value)
    item.full_clean(exclude=["product"])
    item.save()
    if row["barcode"]:
        base = item.units.get(is_base=True)
        base.barcode = check_barcode_free(row["barcode"], base)
        base.save()
    if pack:
        set_pack(item, pack["name"], pack["factor"], barcode=pack["barcode"], mrp=pack["mrp"],
                 selling_price=pack["selling_price"])
    return {"status": "updated", "item": item.name, "code": item.code}, item


# --- prices ---------------------------------------------------------------------

def import_prices(upload, *, commit=False, skip_errors=False, user=None):
    rows = read_rows(upload, PRICE_COLUMNS)
    return _run(rows, _price_row, commit=commit, skip_errors=skip_errors)


def _price_row(number, row):
    code = row["code"]
    if not code:
        raise CatalogError("Barcode or code is missing.")
    unit = ItemUnit.objects.select_related("item__product__brand").filter(barcode=code).first()
    if unit is None:
        item = Item.objects.select_related("product__brand").filter(code__iexact=code).first()
        if item is None:
            raise CatalogError(f"No item with barcode or code {code}.")
        unit = item.units.get(is_base=True)
    item = unit.item
    target = item if unit.is_base else unit
    changes = []
    for key, label in (("mrp", "MRP"), ("selling_price", "Selling price")):
        value = _decimal(row, key, label)
        if value is None:
            continue
        old = getattr(target, key)
        if old != value:
            changes.append(f"{label} {old if old is not None else '—'} → {value}")
            setattr(target, key, value)
    label = item.name if unit.is_base else f"{item.name} ({unit.name})"
    if not changes:
        return {"status": "unchanged", "item": label, "code": item.code}
    target.save()
    return {"status": "updated", "item": label, "code": item.code, "messages": changes}


# --- templates ------------------------------------------------------------------

def build_template(columns, examples=(), *, filled=False, notes=()):
    """
    An .xlsx with the column headings and a "How to fill" sheet.
    examples are dicts keyed by column key: shown on the guide sheet, or written into
    the Items sheet itself when filled=True (the downloadable sample).
    """
    keys = [key for _, key, _ in columns]
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Items"
    blue, green = PatternFill("solid", fgColor="1E3A8A"), PatternFill("solid", fgColor="15803D")
    for index, (header, key, _) in enumerate(columns, start=1):
        cell = sheet.cell(row=1, column=index, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = green if key in STOCK_KEYS else blue
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        sheet.column_dimensions[cell.column_letter].width = max(12, len(header) + 4)
        if key in TEXT_KEYS:
            # Long barcodes lose digits if Excel treats them as numbers.
            for row in range(2, 2001):
                sheet.cell(row=row, column=index).number_format = "@"
    if "product" in keys:
        sheet.column_dimensions[sheet.cell(row=1, column=keys.index("product") + 1).column_letter].width = 30
    sheet.freeze_panes = "A2"
    if filled:
        for row_number, example in enumerate(examples, start=2):
            for column, key in enumerate(keys, start=1):
                if example.get(key) not in (None, ""):
                    sheet.cell(row=row_number, column=column, value=example[key])

    guide = workbook.create_sheet("How to fill")
    guide.column_dimensions["A"].width = 18
    guide.column_dimensions["B"].width = 90
    if filled:
        guide.append(["SAMPLE FILE", "Every row is an example with made-up prices and barcodes. Delete them and enter your own items."])
        guide.append([])
    guide.append(["Column", "What to enter"])
    guide[guide.max_row][0].font = Font(bold=True)
    for header, _, help_text in columns:
        guide.append([header, help_text])
    guide.append([])
    guide.append(["Notes", "Fill the Items sheet only. One row per item (each size/colour is its own row)."])
    guide.append(["", "Blank cells leave existing values unchanged when the item already exists."])
    for label, text in notes:
        guide.append([label, text])
    if examples and not filled:
        guide.append([])
        guide.append(["Examples"])
        guide.append([header for header, _, _ in columns])
        for example in examples:
            guide.append([example.get(key, "") for key in keys])
    for row in guide.iter_rows():
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    guide["A1"].font = Font(bold=True)

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()
