# Hindustan Electric — Backend

Django 5.2 LTS + Django REST Framework + PostgreSQL. Python 3.12.

## First-time setup (macOS)

```bash
brew install postgresql@17
```

This Mac also has an EDB PostgreSQL 16 on port 5432, so the Homebrew server is set to port **5433**
(`port = 5433` in `/opt/homebrew/var/postgresql@17/postgresql.conf`).

```bash
brew services start postgresql@17
```

```bash
/opt/homebrew/opt/postgresql@17/bin/createdb -h localhost -p 5433 hindustan_electric
```

From `backend/`:

```bash
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
```

```bash
cp .env.example .env
```

Fill in `DJANGO_SECRET_KEY` (the command to generate one is in the file), then:

```bash
.venv/bin/python manage.py migrate
```

```bash
.venv/bin/python manage.py createsuperuser
```

`createsuperuser` always creates an **owner**.

## Daily use

```bash
.venv/bin/python manage.py runserver 8000
```

- Back office (owners): http://localhost:8000/admin/
- API: http://localhost:8000/api/

```bash
.venv/bin/pytest
```

## Roles

| Role | Can do |
|---|---|
| Owner | Everything, including Django admin, Staff & Access, shop settings |
| Staff | Only the jobs the owner switched on for them (`accounts/access.py`, 15 switches); no Django admin |

Django's `is_staff` / `is_superuser` flags are set from the role automatically. Every API view lists the
switch each action needs in an `access` map (`accounts.permissions.HasAccess`); an action not listed is
owner-only, so a new endpoint is never open to staff by accident. Finding items is open to everyone.

## How billing works

- `sales/pricing.py` is the only place a bill is calculated (GST incl./excl., discounts, CGST/SGST or IGST,
  round-off). The screen, print and records all use its saved results.
- Numbers come from `sales/numbering.py`: one unbroken series per financial year per document type
  (`HE/26-27/00001` invoices, `CN/` credit notes, `RC/` receipts, `QT/` quotations), taken only when the
  document is finalised.
- `sales/services.py` finalises, cancels, returns and receives payments, each in one transaction that updates
  stock, payments and the khata ledger together. Khata = `LedgerEntry` rows, append-only; nothing is deleted.

## How stock works

- Stock is kept in each item's **base unit** (m, pc…). Packs (coil = 90 m, box = 20 pc) convert to it.
- Every change is one row in the **stock ledger** (`StockMovement`), written by `stock/services.py` in the same
  transaction as the item's cached `stock_qty`. Nothing else changes stock.
- **Counts** set the truth: posting applies (counted − system stock at the time of counting).
- Stock going below zero on a counted item is **allowed but flagged** (`needs_recount`).
- **Cost** is the weighted average purchase cost, GST excluded, updated when a purchase bill is posted.
- `manage.py check_stock` verifies cached stock equals the ledger.

## API

Every endpoint requires login unless it says otherwise. Decimals are sent as strings. Ids in query
strings (`customer`, `category`, `brand`, `supplier`) must be numbers (else 400). Errors are JSON
`{"detail": "..."}`, including 404 and 500 when `DJANGO_DEBUG` is off.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Server is up |
| POST | `/api/auth/login` | anyone (10/min limit) | `{username, password}` → `{success, token, refresh, role, name}` |
| GET | `/api/auth/me` | logged in | Current user |
| GET/POST | `/api/auth/staff` | owner | Everyone who can log in; POST `{username, name, password, role?, access?}` (new staff start with the Counter set) |
| PATCH | `/api/auth/staff/{id}` | owner | `{access?, name?, is_active?}` — switches apply at once; can't switch off your own login |
| POST | `/api/auth/staff/{id}/password` | owner | `{password}` — set a new password |
| GET | `/api/auth/access` | owner | The 15 switches (group, label, help) and the starting sets |
| POST | `/api/auth/change_password` | logged in | `{old_password, new_password}` |
| GET | `/api/shop/settings` | logged in | Shop name, GSTIN, address, bank details, bill terms |
| GET | `/api/catalog/items` | logged in | `search`, `status` (low, not_counted, needs_recount, inactive), `category`, `brand`, `rack`, `ordering`, `page` |
| GET/PATCH | `/api/catalog/items/{id}` | logged in; prices & active: owner | Item detail / edit |
| GET | `/api/catalog/items/{id}/movements` | logged in | Stock ledger for one item |
| POST | `/api/catalog/items/{id}/units` | logged in; prices: owner | Add a pack unit |
| PATCH/DELETE | `/api/catalog/units/{id}` | PATCH: logged in, prices owner; DELETE: owner | Edit barcode/pack, remove unused pack |
| GET | `/api/catalog/lookup?code=` | logged in | Item + unit by barcode or item code |
| GET/POST | `/api/catalog/products` | logged in | List; create product with variants and pack |
| GET/PATCH | `/api/catalog/products/{id}` | PATCH: owner | Product, HSN, GST |
| POST | `/api/catalog/products/{id}/variants` | logged in | Add variants |
| GET/POST | `/api/catalog/categories`, `/api/catalog/brands` | logged in | |
| GET/POST | `/api/stock/adjustments` | owner | Corrections with a reason |
| GET/POST | `/api/stock/counts` | logged in | Counting sessions |
| GET | `/api/stock/counts/{id}` | logged in | Lines; system qty & difference for owner only |
| POST | `/api/stock/counts/{id}/lines` | logged in | `{item, unit?, quantity, mode: add|set}` |
| DELETE | `/api/stock/counts/{id}/lines/{line}` | logged in | |
| POST | `/api/stock/counts/{id}/post`, `/cancel` | owner | |
| GET | `/api/stock/summary` | logged in | Home screen numbers; stock value for owner |
| GET/POST/PATCH | `/api/purchases/suppliers` | logged in | |
| GET/POST | `/api/purchases/bills` | logged in | Drafts with lines; `status`, `supplier`, `search`, `date_from`, `date_to` |
| GET/PATCH/DELETE | `/api/purchases/bills/{id}` | logged in; delete: owner or creator | Drafts only |
| POST | `/api/purchases/bills/{id}/post` | logged in | Add goods to stock |
| GET/POST | `/api/purchases/bills/{id}/attachment` | logged in | GET the photo/PDF (only way to see it; no public link). POST `file`: checked by its contents (PDF, JPG, PNG, WebP, HEIC), max 10 MB, stored under a random name |
| GET | `/api/import/{catalogue,prices}/template` | owner | Excel template |
| GET | `/api/import/catalogue/sample` | logged in | Filled-in example sheet |
| POST | `/api/import/{catalogue,prices}` | owner | `file`, `commit`, `skip_errors` — preview unless `commit=true`. Catalogue stock columns go into a new open stock count (`stock_count_id` in the summary) |
| GET/POST/PATCH | `/api/sales/customers` | logged in; credit limit & discount: owner | `search`, `owing=1`; balance included |
| GET | `/api/sales/customers/{id}/ledger` | logged in | Khata statement with running balance; `date_from`, `date_to` |
| POST | `/api/sales/customers/{id}/payments` | logged in | Receive khata payment → receipt `RC/…` |
| POST | `/api/sales/customers/{id}/opening`, `/adjust` | owner | Opening balance (once) / correction with reason |
| GET | `/api/sales/receipts/{id}`; POST `…/cancel` | logged in; cancel: owner | Receipt for printing; cancel a mistaken receipt |
| GET/POST | `/api/sales/invoices` | logged in | `status` = final (default) / held / cancelled / quotation / all; `date_from`, `date_to`, `customer`, `search`. POST creates a draft |
| GET/PUT/DELETE | `/api/sales/invoices/{id}` | logged in; delete: owner or creator | PUT replaces a draft's header and lines (autosave) |
| GET | `/api/sales/invoices/current` | logged in | This user's unfinished counter bill (204 if none) |
| POST | `/api/sales/invoices/{id}/finalise` | logged in | `{payments: [{mode, amount}]}`; unpaid part goes on khata → number `HE/…` |
| POST | `/api/sales/invoices/{id}/cancel` | owner | `{reason}` |
| POST | `/api/sales/invoices/{id}/returns` | owner | `{lines: [{line, quantity}], refund_mode, reason}` → credit note `CN/…` |
| POST | `/api/sales/invoices/{id}/quotation`, `/convert` | logged in | Draft → quotation `QT/…`; quotation → new draft bill |
| GET | `/api/sales/credit-notes/{id}` | logged in | Credit note for printing |
| GET | `/api/sales/today` | logged in; udhaar total: owner | Today's sales, khata, money by mode, returns |

## Going live: settings

Set these in the live server's environment (see `.env.example`):

| Setting | Live value | Why |
|---|---|---|
| `DJANGO_DEBUG` | `false` | Never show error details to visitors |
| `DJANGO_SECURE` | `true` | HTTPS only, secure cookies, browsers told to always use HTTPS (HSTS, 30 days) |
| `DJANGO_BEHIND_PROXY` | `true` if nginx / the host handles HTTPS | So Django knows the visit was HTTPS |
| `DJANGO_NUM_PROXIES` | `1` behind one proxy, else `0` | Real visitor address for login limits; never trust a faked `X-Forwarded-For` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://your-address` | Back office login form behind HTTPS |
| `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | the live addresses | Only your own site can use the API |
| `DJANGO_CACHE_DIR` | a folder, e.g. `/var/cache/hindustan` | Login limits shared by all server processes |
| `DJANGO_MEDIA_ROOT` | a folder that is backed up | Purchase bill photos |

Check with `DJANGO_DEBUG=false DJANGO_SECURE=true .venv/bin/python manage.py check --deploy`: only the
two optional HSTS extras (`INCLUDE_SUBDOMAINS`, `PRELOAD`) should remain; leave them off unless every
sub-address of the domain is HTTPS. Back office login: 5 wrong passwords from one address → 15-minute wait.
