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

## 9. Open items

- [x] Owner approval of Phase 1 design (§6)
- [x] Remove the old Flask files from the repo root (preserved under tag `flask-final`)
- [x] Remove old React screens (57 files) and 16 unused npm packages
- [x] Owner approval of Phase 2 design (§7)
- [ ] CA confirmation of items marked *Confirm with CA* in §7 (before go-live)
- [x] Last paper invoice number this financial year — none; start at 1
- [ ] Hosting choice (before first deploy)
- [ ] Fill Shop settings in the back office: GSTIN, address, phone, bank details, bill terms, UPI ID
- [x] Owner approval of the simple-screens redesign (§8)
- [ ] Upgrade npm on the dev Mac (npm 10.7 crashes on `npm audit fix`; only dev tools have open advisories)
