# Hindustan Electric — Digitization Plan

Living document. Decisions are recorded here; individual changes go in [CHANGELOG.md](../CHANGELOG.md).
**Workflow:** plan → owner approval → build → changelog entry → one commit per approved step.

---

## 1. Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-01 | Backend rebuilt on **Django 5.2 LTS + Django REST Framework + PostgreSQL** (Python 3.12) | Shop data is accounting data: transactions, exact decimals, constraints and migrations come built in. Django adds admin, users/permissions and LTS support to 2028. |
| 2026-10-01 | **Keep React + Vite + Tailwind** frontend; keep Cloudinary for files | Works and builds; the app shell (layout, sidebar, auth, routing) carries over. Data screens are rebuilt for the new model. |
| 2026-10-01 | **One repo**: `backend/` + `frontend/`, history of both kept | Most features touch both sides; one plan, one changelog. |
| 2026-10-01 | Old MongoDB data **not recovered**; last Flask version tagged `flask-final` | Cluster no longer exists; nothing was in production use. |
| 2026-10-01 | **English only** | Not needed in Hindi. |
| 2026-10-01 | **Public website deferred** to Phase 4 | First priority is digitizing the shop itself. |
| 2026-10-01 | Host API + DB in **Mumbai or Singapore** region (chosen at deploy) | Old setup defaulted to Oregon, US. |
| 2026-10-02 | **Trial server on AWS Lightsail, Sydney** (one server: app, API, Postgres; free sslip.io address); region and Paid plan decided at go-live | AWS project is fixed to Sydney on the Free plan; costs ₹0 until 2 Apr 2027; scripted, so it can move. See §11. |
| 2026-10-01 | **Phase 2 approved.** Invoice series starts at 1 with prefix `HE` (`HE/26-27/00001`) | No numbered GST bills were issued on paper this financial year. |
| 2026-10-01 | **Returns and refunds: owner only** | Handing back cash is the easiest place for money to leak. |
| 2026-10-01 | **Customer Excel import deferred**; opening khata balances entered per customer by the owner | Owner will say if the paper khata needs a bulk import. |

## 2. What the shop looks like (inputs to the design)

- **Thousands** of different items; **most have barcodes** on the box.
- **Loose sales**: wire by the metre from coils, screws by the piece from boxes.
- Purchase bills arrive **mixed**: paper, PDF and Excel; some distributor price lists available.
- Used **mostly at a counter PC**; printing on a small **A4 inkjet**.

## 3. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0. Foundation** | Monorepo, Django + Postgres, owner/staff users, JWT login, shop settings, Django admin, test setup | Done 2026-10-01 |
| **1. Catalogue & stock-in** | Products/variants, units & barcodes, Excel import, purchase bill entry, stock ledger, stock counts, adjustments, low-stock list | Done 2026-10-01 |
| **2. Counter billing** | Scanner-friendly billing, GST-correct invoices, FY numbering, A4 print, customers & khata, payments, returns/credit notes, quotations | Done 2026-10-01 — CA confirmation pending before go-live |
| **3. Back office & reports** | Day-end summary, sales & profit, GST summary for CA, supplier payables, expenses, reorder list → purchase orders, barcode label printing, Excel/DB exports & backups | Later |
| **4. Growth** | Public website, WhatsApp bills & reminders, read bill photos/PDFs into draft purchase entries automatically, electrician loyalty, demand forecasting | Later |

**First version = Phases 0–2.** Phase 1 ships first so catalogue entry (the slowest, human part) can start while Phase 2 is built.

Existing features not in the first version: purchase orders and aging report → Phase 3; AI forecasting / credit score and calendar view → Phase 4 (code kept under tag `flask-final`).

## 4. Rollout at the shop

1. **After Phase 1 — build the catalogue.** Import distributor price lists and past purchase bills via Excel; add the rest by hand or by scanning. No quantities yet.
2. **After Phase 2 — go-live date.** From this day every purchase bill is entered and every sale is billed. Missing items are added on the spot.
3. **Count gradually**, rack by rack / category by category, costly and fast-moving items first (fans, MCBs, wire coils). Uncounted items show *"not counted"*, not a wrong number.
4. **After everything is counted once:** small weekly cycle counts instead of one big yearly count.

Rule for staff: *nothing goes on the shelf without a purchase entry; nothing leaves without a bill.*

## 5. Phase 0 — Foundation (approved)

- Repo layout: `backend/` (Django), `frontend/` (React, imported with history), `docs/`, `CHANGELOG.md`.
- Django apps: `accounts` (custom User with `role` = owner | staff), `shop` (single ShopSettings record: name, GSTIN, state code, address, phone, email, bank details, invoice terms, logo).
- Login: `POST /api/auth/login` → `{token, role}` (JWT), same shape the React app already expects.
- `python manage.py createsuperuser` creates an **owner**. Owners use Django admin at `/admin/`; staff only use the React app.
- Settings from environment; the app **refuses to start** without `DJANGO_SECRET_KEY` / `DATABASE_URL` in production. `.env.example` documents them.
- Local PostgreSQL 17 via Homebrew on port 5433 (5432 is used by an existing EDB PostgreSQL 16); tests with `pytest-django`.

## 6. Phase 1 — Catalogue & stock-in (approved and built 2026-10-01)

Changes made while building, beyond the approved design:
- **Packs have their own MRP** as well as price — distributor price lists quote wire per coil, and a per-metre MRP would lose paise.
- **"Low stock" only applies to counted items.** An uncounted item reads 0, which would mark everything low after an import.
- **Paper-bill check** on purchase entry: type the total printed on the bill to catch typing mistakes before posting.
- **Blind counting:** staff don't see the system quantity while counting; the owner sees differences when reviewing.
- **Rack helper** on the count screen lists everything on a rack, for items without barcodes.
- An item can only be in one open count at a time (two open counts would apply the same correction twice).
- **Opening stock from Excel** (approved after Phase 1): Stock (packs) / Stock (loose) columns in the item sheet fill a stock count named after the file, which the owner reviews and posts. A downloadable sample sheet is linked from Add item and Import.

### 6.1 Data model

**Catalogue**

| Table | Key fields | Notes |
|---|---|---|
| `Category` | name, parent | e.g. *Wires & Cables › House wire* |
| `Brand` | name | Havells, Polycab, Anchor… |
| `Product` | name, brand, category, HSN code, GST rate, description, image | Groups variants; HSN/GST set once |
| `Item` | product, variant name, code (auto), base unit, MRP, selling price, cost (WAC), stock qty, min stock, rack, aliases, active, counted_at, needs_recount | The thing you stock and sell, e.g. *Havells Lifeline 1.5 sq mm Red* |
| `ItemUnit` | item, unit name, factor to base, barcode (unique), selling price (optional) | Every item has its base unit (factor 1) plus packs: *coil = 90 m*, *box = 100 pc* |

- **Variant generator:** create *sizes × colours* (e.g. 5 × 5 = 25 items) in one step.
- **Barcodes live on units**, so scanning a box barcode adds 1 box and a piece barcode adds 1 piece.
- **Aliases** make search find shop-floor names ("batten", "kit-kat").
- **Code** is a short auto number for items without a barcode (typing and, later, label printing).

**Stock**

| Table | Key fields | Notes |
|---|---|---|
| `StockMovement` | item, qty (signed, base units), kind, unit cost, balance after, reference (bill/count/adjustment), note, user, time | The stock ledger. Kinds: opening/count, purchase, sale, sale return, purchase return, adjustment |
| `StockCount` + lines | scope (rack/category), status, counted qty, system qty at posting, difference | A counting session |
| `Adjustment` | item, qty ±, reason (damaged, lost, sample, own use, correction), note | |

**Purchases**

| Table | Key fields | Notes |
|---|---|---|
| `Supplier` | name, phone, GSTIN, state code, address | |
| `PurchaseBill` | supplier, bill no, bill date, status (draft/posted), attachment (photo/PDF), totals | **Unique (supplier, bill no)** — the same bill can't be entered twice |
| `PurchaseLine` | item, unit, qty, rate, discount, GST rate, amount | Converted to base units when posted |

### 6.2 Rules

1. **Stock is kept in base units** (metres, pieces) with 3 decimals; money with 2 decimals (exact, never floats).
2. **Every stock change is one `StockMovement`**, written in the same database transaction as the item's cached quantity. Nobody edits a quantity directly. A check command verifies cache = ledger.
3. **Counting sets the truth.** Posting a count records the difference between what's on the shelf and what the system thought, then marks the item counted.
4. **Negative stock: warn, don't block.** If a sale or adjustment would take stock below zero, the bill still goes through (the goods are physically in the customer's hand), a warning shows, and the item is flagged *needs recount*. Blocking would push staff to skip the system. Negative stock is a visible signal of a missed purchase entry, never silent corruption.
5. **Cost = weighted average cost**, updated when a purchase is posted. Cost is never shown to staff on billing screens.
6. **Items used in any bill are never deleted**, only deactivated.
7. **Drafts don't touch stock.** Only posting a purchase bill, count or adjustment does.

### 6.3 Screens (React, desktop-first; count screen also works on a phone)

- **Items** — search by name / brand / barcode / code / alias; filters: category, brand, low stock, not counted, needs recount; stock shown in its unit ("4 coils + 35 m").
- **Add / edit item** — product + variants in one form, units and barcodes, scan to fill barcode.
- **Excel import** — download template → fill → upload → preview with row errors → confirm. Two templates:
  - *Catalogue:* Category, Brand, Product, Variant, HSN, GST %, Base unit, Pack unit, Pack size, MRP, Selling price, Barcode, Rack, Min stock, Aliases.
  - *Price update:* Barcode or Code, MRP, Selling price.
- **Purchase entry** — supplier, bill no & date, scan/search lines, add a new item inline, qty in any unit, rate, GST; attach bill photo/PDF; save draft or post.
- **Stock count** — choose rack/category → scan/search → enter counted qty → review differences → post.
- **Adjustment** — item, ± qty, reason.
- **Item history** — full stock ledger for one item.
- **Low stock** — items at or below minimum.
- **Django admin** (owner): categories, brands, suppliers, users, shop settings.

### 6.4 Done when

- Owner can import a distributor price list, enter a purchase bill, count a rack and see correct stock and history for every item.
- Tests cover unit conversion, WAC, count posting, negative-stock flagging, duplicate-bill rejection, and that staff can't reach owner-only actions.

## 7. Phase 2 — Counter billing (approved and built 2026-10-01)

Changes made while building, beyond the approved design:
- **Owner can cancel a khata receipt** entered by mistake (kept, marked cancelled, khata corrected), and the payment screen confirms before turning an overpayment into an advance — found when a prefilled amount plus a typed one became ₹3,50,01,000 in testing.
- **Quotations are numbered drafts** (`kind = quotation`) rather than a separate table, so they reuse the bill calculation and print layout.
- Home shows **today's** sales, khata, money by mode (after refunds), returns and — for the owner — total udhaar outstanding.

Goal: the father and staff can bill every sale at the counter, correctly for GST, faster than writing by hand —
and stock, khata and cash all update by themselves.

### 7.1 What changes from the earlier summary

- **Place of supply is not "the buyer's GSTIN state".** For goods handed over at the shop, the place of supply is
  Bihar, so even an out-of-state GSTIN buyer normally pays CGST + SGST. IGST applies only when goods are delivered
  to another state. Each bill gets a *Place of supply* (default Bihar). **Confirm with CA.**
- **Every sale is a tax invoice** (with or without the buyer's GSTIN). The old "GST / non-GST" toggle becomes:
  *Tax invoice* for sales, *Quotation* for estimates (not a sale). **Confirm with CA.**
- **Opening khata balances** and a **customer Excel import** are added, so existing udhaar registers can move in.
- **Hold bill** is added (park a half-made bill while serving the next customer).

### 7.2 How a bill is calculated (one function on the server, used everywhere)

Prices on the shelf include GST, so by default **rates include GST** and the customer pays exactly the shelf price.
A bill can be switched to *rates exclude GST* (contractor / B2B quotes).

For each line:
1. gross = quantity × rate; line discount = gross × discount % (paise rounded, half-up).
2. A **bill discount** (₹, e.g. "₹50 kam") is shared across lines in proportion to their value; the last paisa goes to the largest line.
3. Rates include GST: line total = gross − discounts; taxable = line total × 100 / (100 + GST %); tax = line total − taxable.
   Rates exclude GST: taxable = gross − discounts; tax = taxable × GST %; line total = taxable + tax.
4. Bihar sale: CGST = half of tax, SGST = the rest (so they always add up exactly). Other state: IGST = tax.

Bill total = sum of line totals, rounded to the nearest rupee; the difference is printed as *Round off*.
The printed GST summary (by rate) is the sum of the saved line values — never recalculated — so the paper and the
records always agree. (Fixes the old bug where the PDF added 18% on its own.)

### 7.3 Data model (new app `sales`)

| Table | Key fields | Notes |
|---|---|---|
| `Customer` | name, phone, GSTIN, state code, address, type (retail / electrician / contractor / business), credit limit, default discount %, active | Phone searchable at the counter |
| `Invoice` | number, date, status (draft / held / final / cancelled), customer or walk-in name+phone+address, place of supply, rates-include-GST, bill discount, taxable, CGST, SGST, IGST, round off, total, paid at counter, to khata, cancel reason | Number given only when finalised |
| `InvoiceLine` | item, unit, quantity, base quantity, rate, discount %, discount ₹, taxable, GST %, CGST/SGST/IGST, total, **snapshot of name and HSN**, **cost at sale** | Snapshots keep old bills unchanged if an item is renamed; cost enables profit reports later |
| `Payment` | date, mode (cash / UPI / card / bank / cheque), amount, reference, customer and/or invoice, receipt number | Counter payments and khata receipts alike |
| `CustomerLedger` | customer, date, kind (opening / bill / payment / return / adjustment), debit, credit, link to document, note, user | **Khata.** Append-only; balance = debits − credits |
| `CreditNote` + lines | number, date, original invoice, lines returned, taxes reversed, refund mode (cash / UPI / to khata) | Returns |
| `Quotation` + lines | number, date, valid until, buyer, lines, totals, converted bill | No stock or khata effect |
| `DocumentSeries` | series (e.g. invoice 2026-27), last number | Locked while numbering, so numbers are never skipped or repeated |

Shop settings gain: invoice prefix, UPI ID (optional, for a pay-by-UPI QR on bills), round-off on/off.

### 7.4 Numbers on documents

| Document | Example | Rule |
|---|---|---|
| Tax invoice | `HE/26-27/00001` | One unbroken series per financial year (April–March), max 16 characters (GST rule). A number is taken only at the moment a bill is finalised, so held/abandoned bills don't leave gaps. Cancelled bills keep their number, marked *Cancelled*. Bill date = today (no back-dating, so numbers and dates stay in order). |
| Credit note | `CN/26-27/00001` | Own series |
| Payment receipt | `RC/26-27/00001` | For khata payments |
| Quotation | `QT/26-27/00001` | Not a GST document |

**Starting number:** if the shop already issued numbered GST bills on paper this financial year, the digital series
must either continue from the last paper number or use a new prefix. The owner sets this once in the back office.

### 7.5 What happens when…

| Event | Stock | Khata | Cash/UPI |
|---|---|---|---|
| Bill finalised | SALE out (base units), cost recorded | If any amount is on credit: bill debited, counter payments credited | Payments recorded by mode |
| Bill cancelled (owner) | Goods back in | Bill and its payments reversed | Payments reversed |
| Return / credit note | Returned goods back in | Credited (if refund mode = khata) | Refund recorded (if cash/UPI) |
| Khata payment received | — | Credited | Recorded, receipt printed |
| Quotation | — | — | — |

Rules:
- A bill can't be finalised unless *paid at counter + to khata = total*. Khata needs a customer; walk-in bills are paid in full.
- Walk-in bills over ₹50,000 need the buyer's name and address (GST rule for unregistered buyers).
- **Credit limit:** staff can't put a customer over their limit; the owner sees a warning and can go ahead.
- **Price below average cost:** staff can't save it ("price too low — ask the owner", the cost itself is never shown); the owner gets a warning.
- Negative stock: allowed, item flagged *needs recount* (as in Phase 1).
- Returns: quantity can't exceed what was sold minus earlier returns; GST is reversed at the original bill's rates.

### 7.6 Screens

- **Billing** (the counter screen, keyboard + scanner):
  scan or search → line added (scanning again adds 1); unit, quantity, rate, discount editable; stock shown per line.
  Right side: customer (search by name/phone, *walk-in* default, quick add) with khata balance; bill discount;
  totals; payment buttons — *Cash full*, *UPI full*, split, *To khata*. Keys: F2 search, F4 customer, F8 hold,
  F9 save & print, Esc clear.
- **Print (A4):** the shop's current layout — GSTIN, *TAX INVOICE*, shop details, party details, invoice no./date/place
  of supply, items with HSN, GST summary by rate, amount in words (Indian style: *One Lakh Twenty Thousand Rupees…*),
  bank details, terms, signature boxes; optional UPI QR. Browser print → paper or *Save as PDF*.
- **Bills:** today / date range / customer / number search; open → reprint, return, cancel (owner).
- **Held bills:** resume or discard.
- **Customers:** list with balances; customer page with khata statement (running balance, printable), receive
  payment (prints receipt), opening balance and credit limit (owner).
- **Returns:** pick the bill (by number, customer or date), tick quantities, choose refund → credit note printed.
- **Quotations:** same line builder → print → *Convert to bill*.
- **Home:** today's sales, number of bills, cash / UPI / khata split, cash refunds, total udhaar outstanding.
- ~~Customer import~~ — deferred; opening balances are entered per customer by the owner.

### 7.7 Who can do what

| | Staff | Owner |
|---|---|---|
| Make bills, hold, print, reprint, quotations | ✓ | ✓ |
| Add customers, receive khata payments | ✓ | ✓ |
| Discounts | ✓ (not below average cost) | ✓ (warning only) |
| Exceed a credit limit | | ✓ |
| Returns & refunds | | ✓ |
| Cancel bills, opening balances, credit limits, khata adjustments, customer import | | ✓ |

### 7.8 Build order (one commit each, tested before the next)

1. **Billing engine:** sales models, GST calculation, numbering, finalise/cancel with stock and khata effects. Tests only, no screens.
2. **Counter screen + A4 print + bills list.**
3. **Customers & khata:** statement, payments and receipts, opening balances.
4. **Returns (credit notes), quotations, held bills.**
5. **Home "today" numbers, remove the old billing/customer screens, docs.** Browser walk-through of a full counter day.

### 7.9 Done when

- A 5-item scanned bill paid part cash, part UPI is finalised and printed in under 30 seconds, and the printed totals equal the saved bill to the paisa.
- Stock, khata and today's cash figures are right after bills, returns, cancellations and khata payments.
- Invoice numbers have no gaps or repeats, including across 31 March → 1 April.
- Tests cover: inclusive/exclusive rates, line and bill discounts, rounding (lines always add up to the total), Bihar vs other-state tax split, numbering, every stock/khata effect above, return limits, staff limits.
- The CA has confirmed the items marked *Confirm with CA* before go-live.

### 7.10 Not in Phase 2

E-invoicing (IRN) and e-way bills (only needed above turnover / value limits — CA to confirm), WhatsApp sharing
(Phase 4), day-end report, GST return export and supplier payables (Phase 3), thermal receipt printers.

## 8. Simple screens for the counter (approved 2026-10-01)

The app is used by the owner's father, who is not used to computers. Design only — **no change to how bills,
stock, GST or khata work**, and no backend change. Mock-up: the "Shop app — simple redesign" design canvas.

### 8.1 Principles

- **No sidebar.** One short bar on every screen: shop name (goes Home), find an item, a green **New Bill**
  button, and **More**.
- **Home shows the four daily jobs** as big tiles: New Bill, Goods Arrived, Take Payment, Add New Item. Below:
  today's money, udhaar to collect, recent bills, and only the stock warnings that need doing.
- **Everything else is on More** ("All options"), grouped Bills / Items & stock / Buying / Khata / Setup, each
  with a one-line explanation. Owner-only options show a lock; staff see them greyed with "Only the owner can do
  this".
- **Shop words, not software words** (Khatabook style): New Bill, Old Bills, Kept for Later, Estimate, Return
  Goods, Goods Arrived, Distributors, Check Stock, Fix Stock, Udhaar, You gave / You got / Owes.
- **Colour means one thing:** green = money in / go, red = udhaar owed, amber = please check.
- **Big:** 18px text (Hind font), buttons at least 44px tall, main actions 56–64px.
- Printed bills, credit notes and receipts are unchanged.

### 8.2 Build order (one commit each)

1. App frame: top bar, All options page, larger shared buttons/fields, plain login page; old sidebar removed.
2. Home.
3. New Bill screen.
4. Khata (customer list and customer page).
5. Plain names on every other screen.

### 8.3 Getting back Home (approved 2026-10-02)

Found in use: opened from Home, Goods Arrived said "back to Purchase Bills", which said "back to All options" —
three presses to get Home, and the only shortcut (the shop name) wasn't obvious. Add New Item had the same
problem, and after saving, both left the person on a screen with no clear next step. Mock-up: the "Shop app —
getting back Home" design canvas.

- A **Home** button in the top bar on every screen.
- **Back** (and **Cancel**) go to the screen this one was opened from, named in plain words ("Back to Home");
  only when that isn't known (a bookmark, a fresh tab) do they go to the usual screen above.
- Finishing **Goods Arrived**, **Add New Item** or **Take Payment** shows a done screen: what was saved, then
  a big **Go to Home**, "do another", and a link to see what was saved.
- No phone bottom bar (decided against for now).

## 9. Staff access switches (approved 2026-10-02)

Today there are two roles: the owner can do everything; staff can do every daily job and see the owner's
options greyed out. Instead, the owner switches on, per staff member, exactly the jobs they may do, and
staff see **only** those. The owner always has everything; staff logins, access and shop details stay
owner-only and can't be given away.

### 9.1 The switches

| Group | Switch | What it allows |
|---|---|---|
| Daily jobs | **Make bills** | New Bill, keep for later, estimates, choose customer for udhaar |
| | **Take udhaar payments** | Take Payment, print receipts |
| | **Enter goods arrived** | Goods Arrived, purchase bills, distributors, add to stock |
| | **Add new items** | Add New Item, add sizes/colours |
| | **Count stock** | Check Stock: counting only |
| Seeing | **See old bills** | Old Bills, Kept for Later, Estimates, reprint |
| | **See khata** | Customers, who owes what, statements, add customers |
| | **See today's sales and cash** | The money numbers on Home |
| Owner-type | **Returns and cancellations** | Return goods, refunds, cancel a bill, cancel a receipt |
| | **Change prices and items** | Prices, HSN/GST, switch items off, pack sizes, Update Prices |
| | **Fix stock** | Fix Stock, save or cancel a stock check |
| | **Udhaar control** | Credit limits, customer discounts, old udhaar, correct khata, allow over-limit udhaar |
| | **Allow low prices** | Bill below cost (with a warning) |
| | **Upload from Excel** | Add many items at once |
| | **See costs and profit** | Cost price, stock value, count differences |

Finding an item (search, All Items) stays open to everyone logged in: every job needs it.

### 9.2 How it works

- Checked **by the server on every request**, from the database, so a change applies at once (not
  after the 12-hour login) and hiding a button is never the only protection.
- Staff see only what they're allowed: Home tiles, top bar, All options, buttons inside screens. Typing an
  address they can't use shows "You don't have access to this — ask the owner".
- **Staff & Access** page (owner, replaces Staff Logins): each staff member with their switches; quick
  starting points (Counter: bills + payments + old bills; Store: goods arrived + items + count); add staff,
  reset a password, switch a login off/on.
- Existing staff keep what they can do today (all daily jobs and seeing switches on). With "See khata" they
  also see the udhaar total, which they could already add up from each customer's balance.
- New staff start with the Counter set; the owner changes it before saving.

### 9.3 Build order (one commit each)

1. Server: switches on each user, existing staff migrated, every endpoint checked, staff management API,
   tests for each switch (allowed with it, refused without).
2. App: screens follow the switches; Staff & Access page.

## 10. Middle-ground look (approved 2026-10-02, done 2026-10-02)

The owner compared three designs (today's app; a plain back-office style; a middle ground) and chose the
middle ground. **Look only:** no change to rules, switches, numbers, wording or printouts. Mock-up: the
"Shop app — middle ground" design canvas (the plain-style canvas is kept for reference).

### 10.1 What it takes from each

- **From today's app** — the green New Bill and Home / More buttons, item search in the top bar; task tiles on
  Home (shorter); big bold money figures; big Cash / UPI / Udhaar buttons, − / + quantity, big Save & Print;
  touch-sized rows and buttons; done screens.
- **From the plain style** — a slim dark top bar; a "Home › this page" line under it so you always know where
  you are; every box has a labelled header strip; lists are striped tables with column headings (bills, khata
  history, items, purchase bills…) instead of stacks of cards; filters in a box on the right.
- **New** — a small "Other things" box on Home with plain links to the less-used screens (dropped if it feels
  busy at the counter).

### 10.2 Rules for the look

- Top bar `#264B6B`; trail line `#E7EEF4`; box header strips `#EAF0F6` with dark-blue labels; page `#F4F5F7`.
- Boxes: white, thin border, 10 px corners. Buttons 8–10 px corners, at least 44 px tall; one green main
  button per screen.
- Tables: header row in grey, rows at least 48 px, every other row lightly shaded, amounts right-aligned.
- Trail stays short — always "Home › this page". "← Back to …" keeps working as it does now (goes to where
  you came from) and sits at the right of the trail line when you came from somewhere other than Home.
- Same font (Hind), same 18 px text, same colours for money (red udhaar, green money in, amber "check this").
- Works at phone width with no sideways scrolling; printed bills, credit notes and receipts unchanged.

### 10.3 Build order (one commit each)

1. **Frame and shared pieces** — top bar, trail line, boxes with header strips, table and filter styles,
   buttons. Login, error, no-access and done screens pick them up.
2. **Home and All options.**
3. **New Bill.**
4. **Lists** — Old Bills, Khata, All Items, Purchase Bills, Distributors, Check Stock, Fix Stock.
5. **Records and forms** — a bill, a customer's khata, an item, Goods Arrived, Add New Item, a stock check,
   Upload from Excel, Staff & Access.

### 10.4 Done when

- Every screen uses the shared pieces; nothing looks half old, half new.
- All tests still pass unchanged (311 server, 18 app) — proof that no rule changed.
- Each screen checked in the browser as the owner and as a Counter-set staff member, at desktop and phone width.

All three met on 2026-10-02. On a phone, Home's recent bills and the Khata list put the name details under the
bill number / customer name so the amount fits without swiping. All Items (up to 7 number columns) still slides
sideways inside its own box on a phone, as it did before; the page itself does not.

## 11. Putting the app on AWS (approved 2026-10-02)

### 11.1 What we know

- AWS project `043475992431` uses AWS's new sign-up experience on the **Free plan**: $100 credit, plan ends
  **2 April 2027**. AWS fixes the project to one region, **Sydney (`ap-southeast-2`)**; Mumbai isn't possible in it.
- When the Free plan ends (date reached or credit used up) **AWS closes the account and deletes everything after
  90 days** unless it has been upgraded to the Paid plan. So: upgrade to Paid before real shop data depends on it.
- This is a **trial server**, not go-live. Go-live still waits for the CA's confirmation (§7), Shop settings and the
  printer test, and starts from a fresh, empty database.

### 11.2 Setup — one Lightsail server (recommended)

- Lightsail "micro": 1 GB memory, 2 vCPU, 40 GB disk, $7/month, Ubuntu 24.04, in Sydney, with 2 GB swap. (The
  2 GB "small" plan was the first choice, but AWS doesn't allow it on new accounts yet; 1 GB is enough for one
  shop and can be raised later from a snapshot.) A fixed (static) IP, free while attached. Firewall open only for web (80, 443) and SSH (22, key only, no passwords).
- On the server: **nginx** (HTTPS with a free Let's Encrypt certificate; serves the app; passes `/api` and `/admin`
  to Django), **gunicorn** running Django as a service that restarts itself, **Postgres 17** reachable only from the
  server itself, and the live settings from `backend/README.md` "Going live".
- App and API on one address: the app is built with `VITE_API_URL=/api`, so no cross-site setup is needed.
- Secrets (Django key, database password) are generated on the server into a root-only file. They are never in git
  and never shown, not even to me.
- The owner login is created by **you** on the server (`manage.py createsuperuser`), using Lightsail's
  "Connect using SSH" button in the browser.
- I connect for setup and updates with a new SSH key made on this Mac; only its public half goes to AWS.
- Not chosen: a separate AWS-managed database (Lightsail Postgres, +$15/month). Worth it later if looking after
  Postgres becomes a burden.

### 11.3 Backups — three layers

1. **Whole server:** Lightsail automatic daily snapshot, last 7 kept (about $1–2/month).
2. **Nightly on the server:** database dump plus bill photos, last 14 kept.
3. **Off AWS:** one command on your Mac (`deploy/pull-backup.sh`) copies the latest backup home. This protects
   against the AWS account itself closing. Weekly to start with.

A backup is restored once into a scratch database to prove it works.

### 11.4 Address

- **Trial:** a free address of the form `https://<server-ip-with-dashes>.sslip.io` with a real HTTPS certificate,
  nothing to buy.
- **Go-live:** the shop's own domain (e.g. `hindustanelectric.in`, about ₹600–900 a year from any registrar)
  pointed at the server; the certificate is renewed automatically.

### 11.5 Cost

| Period | Cost |
|---|---|
| Until 2 April 2027 (Free plan) | **₹0** — about $8/month, covered by the $100 credit; the Free plan can't charge |
| After upgrading to Paid | about **$7.50–8/month ≈ ₹660–700**, plus 18% GST if billed by AWS India (≈ ₹780–830) |

On the Paid plan, a budget alert is set at $20/month.

### 11.6 What goes in the repo (no secrets)

- `deploy/setup.sh`: first-boot script that installs and configures everything above. It's repeatable, so a new
  server can be built the same way.
- `deploy/nginx.conf`, `deploy/hindustan-electric.service` (gunicorn), `deploy/backup.sh` (+ nightly timer).
- `deploy/update.sh`: fetch the latest `main` from GitHub, migrate, build the app, restart.
- `deploy/pull-backup.sh`: run on your Mac.
- A "Running on AWS" section in the README. `gunicorn` added to `backend/requirements.txt`.

### 11.7 Steps (one commit each where files change)

1. Deploy files in the repo.
2. Create the server in Sydney with the setup script; static IP; firewall; daily snapshots.
3. Check:
   - the HTTPS address opens;
   - `manage.py check --deploy` is clean;
   - every API address refuses anyone not logged in on the live address;
   - you create the owner login.
4. Backups:
   - run one;
   - restore it into a scratch database;
   - copy it to your Mac.
5. Changelog entry; hosting decision recorded in §1.

### 11.8 Done when

- The address opens the app on the counter PC and on a phone; the owner logs in; a bill can be made and printed.
- No API address answers without a login.
- A backup has been restored successfully and a copy is on your Mac.
- A reminder is set to upgrade the AWS project to Paid before go-live (and in any case before 2 April 2027).

## 12. Open items

- [x] Owner approval of Phase 1 design (§6)
- [x] Remove the old Flask files from the repo root (preserved under tag `flask-final`)
- [x] Remove old React screens (57 files) and 16 unused npm packages
- [x] Owner approval of Phase 2 design (§7)
- [ ] CA confirmation of items marked *Confirm with CA* in §7 (before go-live)
- [x] Last paper invoice number this financial year — none; start at 1
- [x] Hosting choice for the trial: AWS Lightsail, Sydney (§11); final region at go-live
- [ ] Upgrade the AWS project to the Paid plan before go-live, at the latest before 2 April 2027 (§11)
- [ ] Fill Shop settings in the back office: GSTIN, address, phone, bank details, bill terms, UPI ID
- [x] Owner approval of the simple-screens redesign (§8)
- [x] Security review of all 56 API endpoints (2026-10-02); fixes 1–3 and 6–8 done
- [x] Owner approval of staff access switches (§9)
- [x] Owner approval of the middle-ground look (§10)
- [ ] Decide: staff price floor for items with no cost yet (review item 4) — block more than X% below the set price?
- [ ] Decide: "log out everywhere", also on password change (review item 5)
- [ ] Upgrade npm on the dev Mac (npm 10.7 crashes on `npm audit fix`; only dev tools have open advisories)
