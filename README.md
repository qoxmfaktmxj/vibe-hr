# Vibe-HR

Vibe-HR은 **한국어 사용 환경을 기본으로 하는 인사(HR) 시스템 프로젝트**입니다.

- Frontend: Next.js (App Router) + TypeScript + shadcn/ui
- Backend: FastAPI + SQLModel
- Database: PostgreSQL

---

## 프로젝트 성격

- 한국어 UI/문구를 기본으로 설계합니다.
- 국내 조직/인사 운영 시나리오(권한, 조직, 근태, 휴일, 공통코드)를 중심으로 개발합니다.
- 운영 환경은 Docker + Nginx Reverse Proxy 기반을 전제로 합니다.

---

## 백엔드 실행

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

기본 개발 계정:
- login_id: `admin`
- password: `admin`

---

## 프론트엔드 실행

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

주요 진입 경로:
- 로그인: `http://localhost:3000/login`
- 대시보드: `http://localhost:3000/dashboard`
- 사원관리: `http://localhost:3000/hr/employee`
- 공통코드관리: `http://localhost:3000/settings/common-codes`

---

## 개발 시드 데이터 (PostgreSQL)

API 시작 시 `seed_initial_data()`가 자동 실행됩니다.

PostgreSQL 기준으로 시드를 수동 재실행하려면:

```bash
cd backend
set DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/vibe_hr
set PYTHONPATH=%CD%
python scripts/seed_dev_postgres.py
```

시드 동작:
- `admin`, `admin-local` 계정 보장
- `admin` 표시명 기본값 보정
- 한국어 더미 사용자/사원 데이터 생성 및 유지
- 메뉴/권한/공통코드 초기 데이터 동기화
