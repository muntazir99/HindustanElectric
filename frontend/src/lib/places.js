// Plain names for screens, used on "Back to …" links. Same names as the All options page.

const SCREENS = {
  "/dashboard": "Home",
  "/more": "All options",
  "/billing": "New Bill",
  "/bills": "Old Bills",
  "/customers": "Khata",
  "/items": "All Items",
  "/items/new": "Add New Item",
  "/purchases": "Purchase Bills",
  "/purchases/new": "Goods Arrived",
  "/counts": "Check Stock",
  "/suppliers": "Distributors",
  "/adjustments": "Fix Stock",
  "/import": "Upload from Excel",
  "/create-user": "Staff Logins",
};

const DETAIL_SCREENS = [
  [/^\/bills\/\d+$/, "the bill"],
  [/^\/customers\/\d+$/, "the customer"],
  [/^\/items\/\d+$/, "the item"],
  [/^\/purchases\/\d+$/, "the purchase bill"],
  [/^\/counts\/\d+$/, "the stock check"],
];

/** "/bills?status=held" -> "Kept for Later". null for screens with no name (print pages). */
export function placeName(path) {
  const [pathname, search = ""] = path.split("?");
  const status = new URLSearchParams(search).get("status");
  if (pathname === "/bills" && status === "held") return "Kept for Later";
  if (pathname === "/bills" && status === "quotation") return "Estimates";
  if (pathname === "/items" && status === "low") return "Running Low";
  if (SCREENS[pathname]) return SCREENS[pathname];
  const detail = DETAIL_SCREENS.find(([pattern]) => pattern.test(pathname));
  return detail ? detail[1] : null;
}
