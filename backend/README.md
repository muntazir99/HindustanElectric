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
| Owner | Everything, including Django admin, users, shop settings |
| Staff | Daily work in the React app only; no Django admin |

A user's role decides their access; Django's `is_staff` / `is_superuser` flags are set from it automatically.

## How stock works

- Stock is kept in each item's **base unit** (m, pc…). Packs (coil = 90 m, box = 20 pc) convert to it.
- Every change is one row in the **stock ledger** (`StockMovement`), written by `stock/services.py` in the same
  transaction as the item's cached `stock_qty`. Nothing else changes stock.
- **Counts** set the truth: posting applies (counted − system stock at the time of counting).
- Stock going below zero on a counted item is **allowed but flagged** (`needs_recount`).
- **Cost** is the weighted average purchase cost, GST excluded, updated when a purchase bill is posted.
- `manage.py check_stock` verifies cached stock equals the ledger.

## API

Every endpoint requires login unless it says otherwise. Decimals are sent as strings.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Server is up |
| POST | `/api/auth/login` | anyone (10/min limit) | `{username, password}` → `{success, token, refresh, role, name}` |
| GET | `/api/auth/me` | logged in | Current user |
| POST | `/api/auth/create_user` | owner | `{username, password, role}` |
| POST | `/api/auth/change_password` | logged in | `{old_password, new_password}` |
| GET | `/api/shop/settings` | logged in | Shop name, GSTIN, address, bank details, bill terms |
| GET | `/api/catalog/items` | logged in | `search`, `status` (low, not_counted, needs_recount, inactive), `category`, `brand`, `rack`, `ordering`, `page` |
| GET/PATCH | `/api/catalog/items/{id}` | logged in; prices & active: owner | Item detail / edit |
| GET | `/api/catalog/items/{id}/movements` | logged in | Stock ledger for one item |
| POST | `/api/catalog/items/{id}/units` | logged in; prices: owner | Add a pack unit |
| PATCH/DELETE | `/api/catalog/units/{id}` | logged in; prices: owner | Edit barcode/pack, remove unused pack |
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
| POST | `/api/purchases/bills/{id}/attachment` | logged in | Photo/PDF of the paper bill (`file`) |
| GET | `/api/import/{catalogue,prices}/template` | owner | Excel template |
| POST | `/api/import/{catalogue,prices}` | owner | `file`, `commit`, `skip_errors` — preview unless `commit=true` |
