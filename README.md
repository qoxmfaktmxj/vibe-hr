# Vibe-HR

Vibe-HR MVP project.

- Frontend: Next.js (App Router) + TypeScript + shadcn/ui
- Backend: FastAPI + SQLModel
- Database: PostgreSQL only

## Run backend

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Default dev login:
- login_id: `admin`
- password: `admin`

## Run frontend

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Entry points:
- Login: `http://localhost:3000/login`
- Dashboard: `http://localhost:3000/dashboard`
- Employee master: `http://localhost:3000/hr/employee`

## Dev data seeding (PostgreSQL)

The API startup already runs `seed_initial_data()`.
To re-run seed explicitly against PostgreSQL:

```bash
cd backend
set DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/vibe_hr
set PYTHONPATH=%CD%
python scripts/seed_dev_postgres.py
```

Seed behavior:
- Ensures `admin` and `admin-local` accounts exist
- Sets display name of `admin` to `Admin`
- Generates/maintains 2,000 Korean employee users (`kr-*` login IDs)
- Keeps 1:1 mapping between `auth_users` and `hr_employees`
