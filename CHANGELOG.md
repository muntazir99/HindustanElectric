# Changelog

Every change to Hindustan Electric is recorded here: date, what changed, and why.
Plans and decisions live in [docs/PLAN.md](docs/PLAN.md).

## [Unreleased]

### 2026-10-02 — AWS trial server, step 1: deploy files

Plan: [PLAN.md §11](docs/PLAN.md) (approved 2026-10-02).

**Added**
- `deploy/setup.sh`: builds the server on a fresh Ubuntu 24.04 machine and can be run again safely. It installs:
  - nginx with a Let's Encrypt certificate;
  - Postgres 17, reachable only from the server itself, with no password because the app logs in as its own system user;
  - Node 22 from nodejs.org (checksum checked), used only to build the app;
  - 2 GB swap;
  - the live settings, with a secret key generated on the server into a root-only file.
- `deploy/update.sh`: backup, pull `main`, install, migrate, build the app into a new folder and swap it in, restart, health check.
- `deploy/backup.sh` + nightly timer (02:30 India time, 14 days kept); `deploy/pull-backup.sh` copies backups to your Mac.
- `deploy/hindustan-electric.service` (gunicorn, 3 workers, restarts itself), `deploy/nginx.conf`, `deploy/manage.sh` (`sudo hindustan-manage …`).
- `deploy/README.md`: build, update, back up, restore, move to the shop's own domain.
- `gunicorn` in `backend/requirements.txt`.

### 2026-10-02 — Pre-push check for GitHub

**Added**
- Test `test_every_api_address_needs_a_login`: walks all 56 API addresses and calls each with GET, POST, PUT, PATCH and DELETE without logging in; every one must refuse (401/403/405) except login and the health check. New addresses are covered automatically.

**Checked (no change needed)**
- Nothing secret is tracked or in the history to be pushed: all `.env` files, `.claude/`, logs, uploads, `build/`, `node_modules` and virtualenvs are ignored. The only passwords in the code are test values for the throwaway test database. An old frontend `.env` in history held only the API address and a build flag.
- Server settings refuse to start without `DJANGO_SECRET_KEY` and `DATABASE_URL` from the environment; debug is off by default.
- The old Flask app already on GitHub (`main`) had a hard-coded JWT key; that app is retired and the new server's key is different.

### 2026-10-02 — Khata printout: compact statement

**Fixed**
- **Print khata** printed the screen page itself: large bold text, tall rows, the boxed "History" strip, icons, blue links and red/green amounts, so a handful of entries filled a page. It now prints its own statement, in the same style as the bill and receipt printouts: 11 px black text on white, shop name (and address, phone, GSTIN once filled in Shop settings), **KHATA STATEMENT**, the customer and the period, then one thin-ruled line per entry and **Balance due**. About 35–40 entries fit on an A4 page instead of 7; the column headings repeat on each new page.
- Same words as before: Bill amount / Paid / Balance, "Owed before …" when a From date is set; a cancelled receipt's number is struck through. The screen view is unchanged.

### 2026-10-02 — Middle-ground look, step 5: records and forms (look done)

**Changed**
- **A bill**: Items, Payments and Totals each in a labelled box; return / refund buttons in the steel style.
- **A customer's khata**: name, phone and udhaar in a top box with its buttons along the bottom; History box with the date filters on its right; Recent bills box.
- **An item**: boxes for Units & barcodes (with "Add pack" on the right), Stock history, In stock and Details.
- **Goods Arrived**: boxes for Bill details, Goods on this bill and Totals; a saved purchase bill shows the same way.
- **Add New Item**: Product and Sizes and colours boxes; the Excel hint as a plain green note.
- **A stock check**: boxes for Items without a barcode, Scan to count and Counted so far.
- **Upload from Excel**: the kinds as pills; the result in a box marked "Saved" or "Preview — nothing saved yet".
- **Staff & Access**: an open person's header strip is tinted like the other boxes.
- Last old-blue leftovers moved to the steel colours: Log out, the error screen, login, customer picker, item search.
- On a phone, Home's recent bills and the Khata list put the buyer / phone details under the number or name, so the amount fits without swiping. Wider screens unchanged.

All checks in [PLAN.md §10.4](docs/PLAN.md) met: 311 server and 18 app tests pass unchanged; screens checked as the owner and as a Counter-set staff member at desktop and phone width.

### 2026-10-02 — Middle-ground look, step 4: lists

**Changed**
- **Old Bills**: the bills table sits in a labelled box ("Today · 3 bills", with the total on the right); search at the top; a **Show** box on the right with Day (Today / Yesterday / Any day / pick a date) and Kind (Bills / Kept for later / Estimates / Cancelled).
- **Khata**: the udhaar figures in one box; customers are a striped table (Name, Phone, Type, Udhaar) with Everyone / Owe money and search above it.
- **All Items, Purchase Bills, Distributors, Check Stock, Fix Stock**: each list in a labelled box with its count, its filters as pills inside the box, and striped rows.

### 2026-10-02 — Middle-ground look, step 3: New Bill

**Changed**
- Items are rows of a table — Item (with the unit picker under the name when there are packs), Qty with − / +, Price ₹, Disc %, Amount — so amounts line up down one column.
- Right side in labelled boxes: **Who is buying?** and **To pay** (big total, GST, discount, tax details, How are they paying?, big green Save & Print Bill).
- The right column sits beside the items only on wide screens (1280 px and up); on smaller screens it comes below the items, so the table never needs sideways scrolling.

### 2026-10-02 — Middle-ground look, step 2: Home and All options

**Changed**
- Home: greeting and date on one line; the task tiles are shorter (icon beside the name); **Today** is one box of figures; **Recent bills** is a striped table; **Udhaar to collect** and **Needs attention** are labelled boxes.
- New **Other things** box on Home: plain links to Old bills, Kept for later, Khata, All items, Check stock, Purchase bills and Distributors (each only for those allowed), "Everything else is in More", and the item count / stock value.
- All options: each group is one labelled box with its options as rows inside it, instead of separate cards.

### 2026-10-02 — Middle-ground look, step 1: frame and shared pieces

Look only — no rules, switches, numbers or printouts changed. Plan: [PLAN.md §10](docs/PLAN.md).

**Changed**
- Top bar is now a slim dark steel-blue bar (shop name, Find an item, Home, green New Bill, More, name).
- New line under it on every screen: **"Home › this page"**, with **"← Back to …"** on the right when you came from somewhere other than Home (it still goes where you came from). Each screen names itself once (`usePage`), instead of drawing its own back link.
- Shared pieces: boxes with a labelled header strip (`Section`), filter pills (`Pills`), striped tables, 8–10 px corners, steel-blue main buttons, steel-tinted dialog headers.

### 2026-10-02 — Staff & Access: folding cards

**Changed**
- Each person on Staff & Access is one folded row — name, Owner / login-off badge and a one-line summary ("3 of 15 on: Make bills, Take udhaar payments, See old bills") — that opens to show their switches, password and login buttons. Someone just added opens by itself.

### 2026-10-02 — Staff access switches, step 2: screens — done

**Added**
- **Staff & Access** page (More › Setup, owner only; replaces Add user): each person with their switches grouped as Daily jobs / Seeing / Owner-type, each with what it allows. Changes save as you flip them and apply at once. Quick sets: Counter, Store, All off. Add staff (name, username, password, switches — Counter set to start), set a new password, switch a login off or on.
- Staff see **only** what they're allowed: Home tiles (the first four of New Bill, Goods Arrived, Take Payment, Add New Item, Check Stock), the New Bill button, All options tiles (empty sections disappear), and the buttons inside screens (Return goods, Cancel bill, Fix stock, prices, credit limits, cost columns, count differences…). The greyed-out "Only the owner can do this" tiles are gone.
- Opening a screen you're not allowed to use shows "You don't have access to this — ask the owner".
- The app asks the server for the person's switches when it starts and when its window comes back to the front, so changes show without logging in again.
- The top bar shows the person's name.
- 2 app tests (18).

**Removed**
- Add user page and `/api/auth/create_user` (replaced by Staff & Access and `/api/auth/staff`).

### 2026-10-02 — Staff access switches, step 1: server

Plan: [PLAN.md §9](docs/PLAN.md).

**Added**
- 15 on/off switches per staff member (Make bills, Take udhaar payments, Enter goods arrived, Add new items, Count stock, See old bills, See khata, See today's sales and cash, Returns and cancellations, Change prices and items, Fix stock, Udhaar control, Allow low prices, Upload from Excel, See costs and profit). The owner always has all of them; staff logins and shop details stay owner-only.
- The server checks a switch on **every** request, read from the database, so a change applies at once. An endpoint that names no switch is owner-only, so nothing new is open to staff by accident.
- Parts of a reply follow the switches too: today's money only with "See today's sales and cash", the udhaar figures only with "See khata", cost and stock value only with "See costs and profit", count differences only with "Fix stock". Billing below cost or over a credit limit needs "Allow low prices" / "Udhaar control"; the below-cost warning shows the cost figure only with "See costs".
- Staff management for the owner: `GET/POST /api/auth/staff`, `PATCH /api/auth/staff/{id}` (switches, name, login on/off; can't switch off your own), `POST /api/auth/staff/{id}/password`, `GET /api/auth/access` (switch names and the Counter / Store starting sets). Login and `/api/auth/me` return the person's switches.
- New staff start with the Counter set (make bills, take payments, see old bills).

**Changed**
- Existing staff were given every daily-job and seeing switch, which is what they could do before. With "See khata" they now also see the udhaar total on Home (they could already see each customer's balance).
- 30 new backend tests (310).

### 2026-10-02 — Security fixes and error pages

From a review of all 56 API endpoints. Already sound and unchanged: every endpoint needs a login (except login and health); staff are refused all 18 owner-only actions; the server (not just the screen) stops staff selling below cost or over a credit limit; costs stay hidden from staff; a switched-off user is locked out at once; no known vulnerabilities in server or browser packages.

**Security**
- **Bill photos are private.** They are no longer files anyone with the link can open: the app fetches them through the API with the login. Uploads are checked by their contents, not the name or the browser's label (a web page called "photo.png" is refused), stored under a random name, and replacing a photo removes the old file.
- **Back office login** now allows 5 wrong passwords from one address, then a 15-minute wait (it had no limit).
- **App login limit can't be dodged** by faking the `X-Forwarded-For` header; the number of proxies in front of the server is now a setting (`DJANGO_NUM_PROXIES`, default 0).
- **Live-server settings**: `DJANGO_SECURE` turns on HTTPS-only, secure cookies and HSTS; `DJANGO_BEHIND_PROXY`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_CACHE_DIR` (login limits shared by all server processes), `DJANGO_MEDIA_ROOT`. Listed in `backend/README.md` and `.env.example`.
- Only the owner can remove a pack size from an item.

**Fixed**
- Searches by customer, category, brand or distributor answer "must be a number" instead of crashing when given letters.
- Excel/CSV upload: a CSV saved by Excel on Windows is read correctly; a broken file gets a clear message; oversized sheets are refused before they can slow the server.
- Server errors are JSON for the API and never show details; they are written to the server log (they were not logged at all with DEBUG off).

**Added**
- **Page not found** screen with Go to Home (an unknown address used to jump to Home silently).
- Clearer **"something went wrong"** screen: work is safe, Try again / Go to Home.
- Login page says "You were logged out after a long time away" when the 12-hour login ends; "Too many tries. Wait a minute" after repeated wrong passwords; plain wording for a server error or no connection.
- 16 backend tests (280) and 2 frontend tests (16).

### 2026-10-02 — Getting back Home

Screens only; how stock, bills and khata work is unchanged. Plan: [PLAN.md §8.3](docs/PLAN.md).

**Fixed**
- Opened from Home, Goods Arrived and Add New Item now say **Back to Home** (they said Purchase Bills / All Items, which then led to All options — three presses to get Home). Every "Back to …" link now returns to the screen it was opened from, like a phone's back button, and names it; it falls back to the usual screen above only when that isn't known. It still works after a page refresh.
- **Cancel** on Add New Item, and deleting an unfinished purchase bill, go back the same way (they always went to All Items / Purchase Bills).
- Leftover "Bill posted" message and "Import from Excel" link text.

**Added**
- **Home** button in the top bar on every screen (on a phone it takes the shop name's place).
- Done screens after the three everyday jobs, each with a big **Go to Home**:
  - Goods Arrived → **Goods added to stock** (bill, distributor, items, total) · Enter another bill · See this bill.
  - Add New Item → **N items added** (name and sizes/colours) · Add another item (a fresh form) · See these items.
  - Take Payment → **Payment saved** (amount, receipt number, and what the customer still owes) · Print receipt · See the khata.
- 4 frontend tests for the back links (14 frontend tests).

### 2026-10-01 — Simple screens, step 5: plain names everywhere — redesign complete

**Changed**
- Every screen now uses the names from the All options page, and each one has a back link to where it is opened from:
  - Items → **All Items** (filters: Running low, Not checked yet, Check again, Not sold any more); Add item → **Add New Item**; Adjust stock → **Fix stock**.
  - Adjustments → **Fix Stock** ("Which item?"); Stock counts → **Check Stock** (status: In progress / Saved to stock; "Check & save to stock").
  - Purchases → **Purchase Bills**; Enter a purchase bill → **Goods Arrived**; Post to stock → **Add to stock** (Added to stock / Not added yet); Save draft → "Save, finish later".
  - Suppliers → **Distributors**.
  - Bill page: Quotation → **Estimate**, Convert to bill → **Make it a bill**.
  - Import from Excel → **Upload from Excel** ("Save N rows"); Add user → **Staff Logins**.
- Phones: the top bar fits a 375px screen, and Home, New Bill, bills, purchases and the Excel page no longer scroll sideways.
- Printed bills, estimates, credit notes and receipts are unchanged.

### 2026-10-01 — Simple screens, step 4: Khata

**Changed**
- Customers page is now **Khata (Udhaar)** with three cards on top: **You will get** (owner: total udhaar and how many customers), **Received today**, **Given on udhaar today**.
- Customer list is a simple list (no table): a letter badge (red = owes, green = advance), name, phone and type, and the amount with "owes" / "advance" / "nothing due". Filters: Everyone / Owe money.
- Customer page: name and details with **Owes ₹…** in large red figures, a big green **Take Payment** button, Print khata, Edit details. Owner tools in one quiet row: "Add old udhaar from the register" (was Opening balance) and "Correct the khata" (was Adjust khata).
- History (was Statement) uses Khatabook words on screen — **You gave / You got / Owes** — and plain line names (Old udhaar from the register, Payment received, Goods returned, Correction…). The printout keeps neutral headings for the customer: Bill amount / Paid / Balance.
- Payment box: "Take payment from …", "Udhaar now", bigger Paid-by buttons.
- "Take payment" on Home opens the customer with the payment box ready.

### 2026-10-01 — Simple screens, step 3: New Bill

Same saving, pricing, GST and payment rules as before — only the screen changed.

**Changed**
- Billing is now **New Bill**: a large scan box with a blue border ("Scan the barcode, or type the item name").
- Each item reads like a receipt line: name and amount on top; below it **− / + buttons** around the quantity, the unit (only when the item has more than one), **Price ₹** and **Disc %**. Stock hints in plain words ("shelf stock not checked yet", "More than the stock shows — check the shelf").
- Right side, top to bottom: **Who is buying?** (empty = cash customer), **To pay** in large figures with "GST included", discount on whole bill, tax details folded away; **How are they paying?** with big **Cash / UPI / Udhaar** and smaller Card / Part payment; a large green **Save & Print Bill** (F9) and "Save without printing".
- Hold / Quotation / Clear are now **Keep for later**, **Make estimate**, **Start over**; held bills are listed as "Kept for later".
- Customer box: "Type the customer's name or phone"; a chosen customer shows "Udhaar: owes …".
- Shared fields: number boxes given a width now keep it (they used to stretch); the header search is not shown on New Bill so there is only one search box there.

### 2026-10-01 — Simple screens, step 2: Home

**Changed**
- Home opens with a greeting and the date, then **four big tiles** for the daily jobs: **New Bill** (blue), Goods Arrived, Take Payment, Add New Item.
- **Today's business**: total sales and number of bills, cash in the drawer, UPI/card if any (with "came in / given back" when there were refunds), given on udhaar (red), udhaar paid back (green), goods returned when any; bills kept for later with a link.
- **Udhaar to collect** (owner): total and number of customers, with the first five and a **Take payment** button each (opens the customer with the payment box ready).
- **Recent bills**: last five with Udhaar / Paid and the amount.
- **Needs your attention** (amber) lists only what needs doing — running low, check again, purchase bills not added to stock, stock checks not finished, items not checked yet — or says "Nothing needs your attention". Item count and (owner) stock value at cost in one quiet line.
- Headline amounts drop ".00" (₹2,535, but ₹386.69 when there are paise).

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
