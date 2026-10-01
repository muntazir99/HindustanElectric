# Changelog

Every change to Hindustan Electric is recorded here: date, what changed, and why.
Plans and decisions live in [docs/PLAN.md](docs/PLAN.md).

## [Unreleased]

### 2026-10-01 — Simple screens, step 1: top bar and "All options"

Design only: nothing about bills, stock, GST or khata changed. Plan: [PLAN.md §8](docs/PLAN.md).

**Changed**
- The left sidebar (12 links) is replaced by one short bar on every screen: shop name (goes Home), **Find an item** (shows stock and price, opens the item), a green **New Bill** button, **More**, and the Owner/Staff menu with Log out.
- New **All options** page (More): Bills, Items & stock, Buying from distributors, Khata, Setup — each a large tile with a one-line explanation in plain words. Owner-only tiles show a lock; staff see them greyed out with "Only the owner can do this".
- Bills list renamed **Old Bills** with tabs Bills / Kept for later / Estimates / Cancelled; "Return Goods" and "Cancel a Bill" open it with a line saying what to do next. "Update Prices" opens the Excel page on the price-list option.
- Larger text everywhere (18px, Hind font), taller buttons and fields, plain table headings (no small capitals).
- Login page: plain form ("Forgot your password? Ask the owner to reset it." instead of a link that went nowhere).

**Removed**
- Old sidebar, and the login page's unused images and font.

### 2026-10-01 — Phase 2, step 5: today's numbers, cleanup — Phase 2 complete

**Added**
- Home **Today**: sales and number of bills, put on khata, khata collected, returns, money received by mode after refunds (for the end-of-day cash count), held bills waiting; owner also sees total udhaar outstanding and how many customers owe. "New bill" is the first quick action.
- `GET /api/sales/today`; 1 new test (264 backend tests).

**Removed**
- 57 old frontend files no longer reachable from the app (old billing, invoices, customers, payments, purchase orders, reports, dashboard, Redux store, unused icons, the old jsPDF invoice with the 18% bug). Still in git history.
- 16 unused npm packages (Redux, jsPDF, charts, calendar, number-to-words, old Node polyfills).

**Security**
- axios 1.20 and react-router-dom 7.18: packages shipped to the browser now have 0 known vulnerabilities. Dev-only tools still have advisories; npm 10.7 crashes on `npm audit fix` — upgrade npm, then run it.

### 2026-10-01 — Phase 2, step 4: returns (credit notes) and quotations

**Added**
- **Returns** (owner only, as decided): pick the bill, enter how much of each line is coming back, choose cash back / UPI back / credit to khata, give a reason. Makes a numbered **credit note** `CN/26-27/00001` (A4 print, against the original invoice number and date), puts the goods back into stock at their original cost, and records the refund or khata credit.
- GST on returns is reversed at the bill's own rates; returning a line in several parts reverses exactly what was charged, to the paisa. Can't return more than was sold; a bill with returns can't be cancelled.
- **Quotations**: "Quotation" on the billing screen turns the current bill into a numbered quotation `QT/26-27/00001`, valid 15 days, printed as *QUOTATION — not a tax invoice*. No stock or khata effect. **Convert to bill** opens a new bill at the quoted prices. Quotations have their own tab in Bills and never use invoice numbers.
- Bill page shows returned quantities and links to credit notes.
- 13 new tests (263 backend tests).

### 2026-10-01 — Phase 2, step 3: customers & khata

**Added**
- **Customers & khata** page: list with what each customer owes (or advance), filter "owe money", search by name/phone/GSTIN; add and edit customers (credit limit and discount are owner-only).
- **Khata statement** per customer with running balance, links to bills and receipts, date range with "brought forward", and printing (the menu is hidden when printing).
- **Receive payment** (staff and owner): cash / UPI / card / bank / cheque with reference; numbered receipt `RC/26-27/00001`; printable receipt showing amount in words and balance still due.
- **Opening balance** from the paper khata (owner, once per customer) and **khata adjustments** with a reason (owner).
- **Cancel a receipt** (owner, with reason) for a payment entered by mistake — marked cancelled and struck through, khata corrected, nothing deleted.
- Overpayment check: if the amount is more than the customer owes, the screen says how much will become an advance and asks to confirm; the amount box selects its value on focus so typing replaces it.
- 12 new tests (250 backend tests).

**Fixed**
- Billing screen: a newly scanned line sometimes showed "…" instead of its price — line state is now built once outside React's update step.

**Why the receipt fixes:** while testing, a prefilled ₹3,500 plus a typed ₹1,000 became ₹3,50,01,000 and was accepted without question. That can happen at the counter too.

### 2026-10-01 — Phase 2, step 2: counter billing, printing, bills list

**Added**
- **Billing screen** for the counter: scan or search adds a line (scanning again adds one more); unit, quantity, rate and discount editable; stock shown on each line with a warning when the bill asks for more than the shelf should have; lines priced below cost highlighted (staff see "price too low — ask the owner", never the cost).
- Customer picker by name or phone with khata balance shown, and quick "add new customer"; walk-in by default. Optional buyer details, rates excluding GST, place of supply, bill note, discount on the whole bill.
- Payment in one click (Cash / UPI / Card / Khata) or split; anything unpaid goes on khata.
- Keyboard: F2 item, F4 customer, F8 hold, F9 finish & print.
- **Autosave**: the bill is saved to the server as you go, so a refresh or power cut doesn't lose it; totals always come from the server's calculation.
- **Hold** a bill and resume it later from "Held bills" (or from the Bills page).
- **A4 tax invoice print** in the shop's layout: GSTIN, invoice number and date, place of supply, lines with HSN, taxable value and GST, GST summary by rate, amount in words in lakh/crore style, payments and amount due, bank details, terms, signature boxes; UPI QR for the amount due when a UPI ID is set; CANCELLED watermark on cancelled bills.
- **Bills** list (by day, held, cancelled; search by number, name or phone) and bill page with reprint and owner-only cancel (with reason).
- API: `/api/sales/invoices` (drafts, current, finalise, cancel) and `/api/sales/customers`; 27 new tests (238 backend tests).

**Tested in the browser:** scanned bill, hold and resume, refresh mid-bill, finish, print view, cancel with refund.

### 2026-10-01 — Phase 2, step 1: billing engine (no screens yet)

**Decided:** Phase 2 plan approved; invoice series starts at 1 with prefix `HE`; returns and refunds are owner-only; customer Excel import deferred (docs/PLAN.md §1).

**Added**
- **Bill calculation** in one place (`sales/pricing.py`): rates including or excluding GST, line discount %, bill discount shared across lines, CGST/SGST for Bihar or IGST for another state, round-off to the rupee. Every line and the bill add up to the paisa — checked on 500 random bills.
- **Invoice numbers** `HE/26-27/00001`: one unbroken series per financial year (April–March), taken only when a bill is finalised, so drafts and held bills never leave gaps; within the 16-character GST limit.
- **Customers** (name, phone, GSTIN, type, credit limit, default discount) and the **khata ledger** (append-only; balance = debits − credits).
- **Finalising a bill** in one transaction: number, stock out (packs converted to base units, cost recorded for profit), payments by mode, khata updated. Walk-in bills must be paid in full; bills over ₹50,000 to walk-in buyers need name and address.
- **Controls:** staff can't sell below average cost or exceed a customer's credit limit (the owner gets a warning instead); the staff message never reveals the cost.
- **Cancelling a bill** (owner): goods back, money refunded by the same mode, khata reversed; the number stays, marked cancelled.
- Bills keep the item name, unit and HSN as they were when sold.
- Shop settings: invoice prefix, UPI ID (for a QR on bills), round-off on/off.
- 57 new tests (211 backend tests).

### 2026-10-01 — Excel: opening stock and sample sheet

**Why:** the shop has thousands of items already on the shelves; filling current stock in Excel is the practical way to load it.

**Added**
- Two new columns in the item sheet: **Stock (packs)** and **Stock (loose)** (e.g. 4 coils + 35 m → 4 and 35). They don't change stock directly: the import puts them into a **stock count named after the file**, which the owner reviews and posts like any other count, so every quantity is still recorded in the stock ledger. Blank = not counted. Packs use the row's pack size, or the item's own pack if it has exactly one.
- **Sample sheet download** (any logged-in user) on **Add item** and on **Import from Excel**: 12 example items with packs, prices, racks and shelf stock, plus a how-to sheet. Generated by the server from the same column list the import uses, so the sample always matches.
- After importing, a link goes straight to the new stock count; the preview says how many items have stock.
- 10 new tests (154 backend tests).

### 2026-10-01 — Phase 1: catalogue & stock-in

**Added — backend**
- **Catalogue**: categories, brands, products with variants (items), units with pack sizes (coil = 90 m, box = 20 pc). Barcodes per unit, so scanning a box means one box. Short auto item codes for items without barcodes. Packs have their own MRP and price.
- **Stock ledger**: every stock change is one recorded movement with who, when and why. Item stock is a cached total, changed only by the stock services in the same transaction. `manage.py check_stock` verifies it.
- **Stock counts**: count a rack or category; scanning adds, typing replaces. Posting applies (counted − system stock at the time of counting), so sales/purchases during a count aren't lost. Staff count blind; only the owner sees differences, posts or cancels. An item can be in only one open count.
- **Negative stock is allowed but flagged** "needs recount" on counted items, never blocked.
- **Adjustments** (owner only) with a reason: damaged, lost, sample, own use, correction.
- **Purchases**: suppliers; purchase bills as drafts, then posted to stock. Lines in any unit, discount %, GST. Posting converts packs to base units and updates weighted average cost (GST excluded). The same bill number from the same supplier can't be entered twice. Photo/PDF of the paper bill can be attached.
- **Excel/CSV import** (owner only) for the catalogue and for price updates: downloadable template with a how-to sheet; preview shows every row as new / update / error before anything is saved; option to skip error rows. Accepts common unit spellings (mtr, pcs, nos…).
- Cost prices are never sent to staff. Staff can create items; only the owner changes prices, HSN/GST or deactivates items.
- 71 API tests + domain tests (144 backend tests in all).

**Added — frontend** (React screens rebuilt for the new backend)
- Home with stock numbers (not counted, needs recount, low stock, drafts, stock value for owner) and quick actions.
- Items list with search (any word order, barcodes), status filters, categories; item page with stock shown in packs ("1 coil + 80 m"), units & barcodes, full stock history, edit, owner adjust.
- Add item: product + all variants at once, size × colour generator, copy-down, Enter moves to the next row's barcode for fast scanning.
- Purchase bill entry built for a USB barcode scanner, with a new-item shortcut, live totals, and a check against the total printed on the paper bill.
- Stock counts with scan-to-count and a rack list for items without barcodes.
- Adjustments, suppliers, Excel import, add user (owner/staff).
- Phone-friendly menu for counting on a phone.
- Unit tests for on-screen bill arithmetic (matches server rounding) and error messages.

**Changed**
- Frontend talks to the Django API (`VITE_API_URL`, default `http://localhost:8000/api`); `frontend/.env` is no longer tracked — see `frontend/.env.example`.
- Roles are owner/staff (was admin/user). An expired login returns to the login page.
- Old screens (billing, invoices, customers, payments, purchase orders, reports, logs, calendar) are no longer routed; their files remain for reference until Phase 2/3 replaces them.

**Fixed during testing**
- "Low stock" no longer shows on items that haven't been counted.
- Import preview no longer shows item codes that the real import would assign differently.
- Opening a purchase bill right after posting it no longer keeps the confirmation dialog open.
- Leaving a new, unsaved purchase bill (refresh/close) now asks first.

### 2026-10-01 — Phase 0: foundation

**Added**
- `frontend/`: the React app imported from the `hindustanelectric-frontend` repo with its full commit history (branch `pre-monorepo`).
- `backend/`: new Django 5.2 LTS + DRF + PostgreSQL project (Python 3.12).
  - Users with a **role** (owner / staff). Owners get Django admin; staff only use the React app. `createsuperuser` always makes an owner.
  - API: login (JWT, returns `{success, token, role}` as the React app expects, limited to 10 attempts/min), current user, owner-only create user, change own password.
  - **Shop settings**: one record for shop name, GSTIN (checked against state code 10), address, phone, email, bank details, bill terms. Replaces details hardcoded in the frontend; read via `GET /api/shop/settings`, edited in Django admin.
  - Every API endpoint requires login unless it explicitly opts out; the app refuses to start without `DJANGO_SECRET_KEY` and `DATABASE_URL`.
  - Timezone Asia/Kolkata; tokens last 12 hours (one shop day).
  - 24 tests (pytest) covering login, roles, owner-only actions, settings.
- Local PostgreSQL 17 via Homebrew on port 5433 (port 5432 is taken by an existing EDB PostgreSQL 16 install).
- `.gitignore`: Python virtualenvs, caches, static build output.

**Not done yet**
- Old Flask files (`app/`, `run.py`, `requirements.txt`, `render.yaml`, root `README.md`) are still at the repo root; removal was blocked by a permission check and is left for the owner. They're preserved under tag `flask-final`.

### 2026-10-01 — Project kickoff

**Decided** (details in docs/PLAN.md §1)
- Rebuild backend on Django + PostgreSQL; keep the React frontend; merge both repos into one.
- Public website deferred; first priority is digitizing the shop (catalogue, stock, billing).
- Old MongoDB data not recovered (cluster no longer exists); English only.

**Changed**
- Backend repo: new branch `v2-django`. Uncommitted AI credit-risk and forecasting work committed as-is (`0ee1cf9`) so it stays separate from the rebuild.
- Backend repo: tagged the last Flask version as `flask-final` for reference.
- Frontend repo: new branch `pre-monorepo`. Uncommitted forecast modal and customer/inventory tweaks committed as-is (`cf9c919`).
- Added `docs/PLAN.md` (roadmap, decisions, Phase 1 design) and this changelog.
