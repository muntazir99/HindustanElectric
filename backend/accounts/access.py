"""
What each staff member may do: one on/off switch per job. The owner always has every switch; staff have
only the ones the owner turns on. Staff logins, their access and shop details are never switches: they
stay with the owner. Plan: docs/PLAN.md §9.
"""

BILLING = "billing"
PAYMENTS = "payments"
PURCHASES = "purchases"
ADD_ITEMS = "add_items"
COUNT_STOCK = "count_stock"
VIEW_BILLS = "view_bills"
VIEW_KHATA = "view_khata"
VIEW_SALES = "view_sales"
RETURNS = "returns"
EDIT_ITEMS = "edit_items"
FIX_STOCK = "fix_stock"
KHATA_CONTROL = "khata_control"
LOW_PRICES = "low_prices"
IMPORT = "import"
SEE_COSTS = "see_costs"

# (code, group, label, what it allows) — in the order the owner sees them.
SWITCHES = [
    (BILLING, "Daily jobs", "Make bills", "New Bill, keep for later, estimates, udhaar on a bill"),
    (PAYMENTS, "Daily jobs", "Take udhaar payments", "Take Payment, print receipts"),
    (PURCHASES, "Daily jobs", "Enter goods arrived", "Goods Arrived, purchase bills, distributors"),
    (ADD_ITEMS, "Daily jobs", "Add new items", "Add New Item, sizes and colours, barcodes"),
    (COUNT_STOCK, "Daily jobs", "Count stock", "Check Stock: counting only"),
    (VIEW_BILLS, "Seeing", "See old bills", "Old Bills, Kept for Later, Estimates, reprint"),
    (VIEW_KHATA, "Seeing", "See khata", "Customers, who owes what, statements"),
    (VIEW_SALES, "Seeing", "See today's sales and cash", "The money numbers on Home"),
    (RETURNS, "Owner-type", "Returns and cancellations", "Return goods, refunds, cancel a bill or receipt"),
    (EDIT_ITEMS, "Owner-type", "Change prices and items", "Prices, HSN/GST, switch items off, pack sizes, Update Prices"),
    (FIX_STOCK, "Owner-type", "Fix stock", "Fix Stock, save or cancel a stock check"),
    (KHATA_CONTROL, "Owner-type", "Udhaar control", "Credit limits, discounts, old udhaar, correct khata, allow over-limit udhaar"),
    (LOW_PRICES, "Owner-type", "Allow low prices", "Bill below cost (with a warning)"),
    (IMPORT, "Owner-type", "Upload from Excel", "Add many items at once"),
    (SEE_COSTS, "Owner-type", "See costs and profit", "Cost price, stock value"),
]
CODES = [code for code, *_ in SWITCHES]

# Quick starting points on the Staff & Access page.
PRESETS = {
    "Counter": [BILLING, PAYMENTS, VIEW_BILLS],
    "Store": [PURCHASES, ADD_ITEMS, COUNT_STOCK],
}
NEW_STAFF = PRESETS["Counter"]

# What every staff member could do before switches existed (given to them when switches arrived).
STAFF_BEFORE_SWITCHES = [BILLING, PAYMENTS, PURCHASES, ADD_ITEMS, COUNT_STOCK, VIEW_BILLS, VIEW_KHATA, VIEW_SALES]


def clean(codes):
    """Known codes only, in the standard order, no repeats."""
    wanted = set(codes or [])
    return [code for code in CODES if code in wanted]
