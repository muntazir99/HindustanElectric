# Changelog

Every change to Hindustan Electric is recorded here: date, what changed, and why.
Plans and decisions live in [docs/PLAN.md](docs/PLAN.md).

## [Unreleased]

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
