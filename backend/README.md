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

## API (so far)

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Server is up |
| POST | `/api/auth/login` | anyone (10/min limit) | `{username, password}` → `{success, token, refresh, role, name}` |
| GET | `/api/auth/me` | logged in | Current user |
| POST | `/api/auth/create_user` | owner | `{username, password, role}` |
| POST | `/api/auth/change_password` | logged in | `{old_password, new_password}` |
| GET | `/api/shop/settings` | logged in | Shop name, GSTIN, address, bank details, bill terms |

Every endpoint requires login unless it says otherwise.
