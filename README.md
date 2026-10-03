# Hindustan Electric — Shop System

Billing, khata, stock and purchases for Hindustan Electric, Muzaffarpur.

| Folder | What |
|---|---|
| `backend/` | Django 5.2 + Django REST Framework + PostgreSQL API, and the owner's back office (`/admin/`). See [backend/README.md](backend/README.md). |
| `frontend/` | React + Vite + Tailwind app used at the counter and on phones. |
| `deploy/` | The live server on AWS: setup, updates, backups. See [deploy/README.md](deploy/README.md). |
| `docs/HANDBOOK.md` | How to use every screen, step by step (also the help assistant's source). |
| `docs/PLAN.md` | Roadmap, decisions and designs. |
| `CHANGELOG.md` | Every change, with date and reason. |

## Run it locally

Backend (first-time setup is in [backend/README.md](backend/README.md)):

```bash
cd backend && .venv/bin/python manage.py runserver 8000
```

Frontend (first time: `npm ci` and copy `.env.example` to `.env`):

```bash
cd frontend && npm start
```

Open http://localhost:3000 and log in. Owners also have the back office at http://localhost:8000/admin/.

## Tests

```bash
cd backend && .venv/bin/pytest
```

```bash
cd frontend && npx vitest run
```

```bash
cd backend && .venv/bin/python manage.py check_stock
```

`check_stock` confirms every item's stock equals the sum of its stock ledger.
