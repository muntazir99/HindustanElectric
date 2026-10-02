// Staff access switches — the same codes as the server (backend/accounts/access.py).
export const A = {
  BILLING: "billing",
  PAYMENTS: "payments",
  PURCHASES: "purchases",
  ADD_ITEMS: "add_items",
  COUNT_STOCK: "count_stock",
  VIEW_BILLS: "view_bills",
  VIEW_KHATA: "view_khata",
  VIEW_SALES: "view_sales",
  RETURNS: "returns",
  EDIT_ITEMS: "edit_items",
  FIX_STOCK: "fix_stock",
  KHATA_CONTROL: "khata_control",
  LOW_PRICES: "low_prices",
  IMPORT: "import",
  SEE_COSTS: "see_costs",
};

/** Only the owner, never a switch: staff logins and shop details. */
export const OWNER = "owner";
