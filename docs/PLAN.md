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

## 2. What the shop looks like (inputs to the design)

- **Thousands** of different items; **most have barcodes** on the box.
- **Loose sales**: wire by the metre from coils, screws by the piece from boxes.
- Purchase bills arrive **mixed**: paper, PDF and Excel; some distributor price lists available.
- Used **mostly at a counter PC**; printing on a small **A4 inkjet**.

## 3. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0. Foundation** | Monorepo, Django + Postgres, owner/staff users, JWT login, shop settings, Django admin, test setup | Done 2026-10-01 (old Flask files still to be removed) |
| **1. Catalogue & stock-in** | Products/variants, units & barcodes, Excel import, purchase bill entry, stock ledger, stock counts, adjustments, low-stock list | **Awaiting approval (§6)** |
| **2. Counter billing** | Scanner-friendly billing, GST-correct invoices, FY numbering, A4 print, customers & khata, payments, returns/credit notes, quotations | Design summary §7; detailed plan before build |
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

## 6. Phase 1 — Catalogue & stock-in (FOR APPROVAL)

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

## 7. Phase 2 — Counter billing (summary; detailed plan before build)

- Billing screen built for **keyboard + USB barcode scanner**: scan or search adds a line; sell in any unit (1 coil or 12.5 m).
- **One GST calculation, in the backend**, tested: prices tax-inclusive; CGST + SGST for Bihar buyers (state 10), IGST when the buyer's GSTIN is from another state; per-line rounding, invoice round-off.
- **Invoice numbers:** one series per financial year, e.g. `HE/26-27/00001`, unique and consecutive; cancelled invoices keep their number. Credit notes `CN/26-27/00001`.
- **Customers & khata:** balance = credit invoices − payments; split payments (cash + UPI); partial payment at the counter.
- **Returns** (common when electricians return unused material) → credit note, stock back in.
- **Quotations/estimates** — no stock or ledger effect; convert to a bill later.
- **A4 print** from a browser print view; shop details come from Settings.
- **To confirm with your CA:** how today's "GST / non-GST bill" toggle should map to invoice types.

## 8. Open items

- [ ] Owner approval of Phase 1 design (§6)
- [ ] Remove the old Flask files from the repo root (preserved under tag `flask-final`)
- [ ] CA confirmation on invoice types (before Phase 2)
- [ ] Hosting choice (before first deploy)
