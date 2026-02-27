# Vibe-HR

## 🔒 AI 개발 시작 전 필독 순서

1. `docs/DEVELOPMENT_PRECHECK.md`
2. `AGENTS.md`
3. `config/grid-screens.json`
4. `docs/GRID_SCREEN_STANDARD.md`
5. `docs/MENU_ACTION_PERMISSION_PLAN.md`
6. 작업 대상 화면의 `page.tsx` + 컴포넌트 파일

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

## UI 컬러/버튼 가이드

기준 팔레트(Coolors):
- `https://coolors.co/3c6dee-7a9cec-0ea5e9-b95f89-cc2936`

색상 토큰(`frontend/src/app/globals.css`):
- `--vibe-primary`: `#3C6DEE` (주색 — 조회 등)
- `--vibe-primary-light`: `#7A9CEC` (보조색)
- `--vibe-save`: `#0EA5E9` (저장/확정)
- `--vibe-action`: `#0EA5E9` (특수 이벤트 — save와 동일 톤)
- `--vibe-warning`: `#B95F89` (주의성 동작)
- `--destructive`: `#CC2936` (삭제/위험 동작)

버튼 variant 기준(`frontend/src/components/ui/button.tsx`):
- `query`: 조회 버튼 (`--vibe-primary` 파랑)
- `save`: 저장 버튼 (`--vibe-save` 스카이블루)
- `action`: 화면 특수 이벤트(예: 새 메뉴, 새 권한, 생성)
- `warning`: 주의성 버튼 (`--vibe-warning` 로즈핑크)
- `outline`: 입력/복사/다운로드/업로드/양식 다운로드 계열(흰 배경)
- `destructive`: 삭제 계열 (`--destructive` 레드)

적용 원칙:
- 조회/저장/삭제는 역할을 고정해 화면별 일관성을 유지합니다.
- 일반 보조 기능(입력, 복사, 다운로드, 업로드)은 `outline`을 기본값으로 사용합니다.
- 강한 채움색 버튼은 한 화면에서 과도하게 늘리지 않습니다.

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
