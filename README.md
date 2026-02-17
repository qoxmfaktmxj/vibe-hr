# Vibe-HR

Vibe-HR MVP 프로젝트입니다.

- 프론트엔드: Next.js(App Router) + TypeScript + shadcn/ui
- 백엔드: FastAPI + SQLModel
- DB(테스트용): SQLite

## 1) 현재 개발 기준

### DB 정책
- 운영 전 MVP 단계에서는 SQLite를 사용합니다.
- 테이블명은 prefix 방식으로 고정합니다.
- 스키마 분리(`hr.` 등)는 사용하지 않습니다.

사용 테이블:
- `auth_users`
- `auth_roles`
- `auth_user_roles`
- `org_departments`
- `hr_employees`
- `hr_attendance_daily`
- `hr_leave_requests`

DDL 위치:
- `backend/db/migrations/001_init.sql`

참고:
- SQLite는 `COMMENT ON`을 지원하지 않아, DDL 내부 주석을 한글로 작성했습니다.

### 디자인 톤(첨부 HTML 기준)
`c:\Users\sp20171217yw\Downloads\login.html` 및  
`c:\Users\sp20171217yw\Downloads\dashboard.html`의 색상 코드를 기준으로 사용합니다.

핵심 토큰:
- `--vibe-primary-login: #3a6aee`
- `--vibe-primary: #3c6dee`
- `--vibe-primary-light: #7a9cec`
- `--vibe-sidebar-bg: #f8fafc`
- `--vibe-accent-purple: #5e5fa3`
- `--vibe-accent-muted: #64748b`
- `--vibe-accent-dark: #3e3262`
- `--vibe-background-light: #f6f6f8`
- `--vibe-background-dark: #101522`
- `--vibe-text-base: #111318`

전역 CSS 위치:
- `frontend/src/app/globals.css`

## 2) 실행 방법

## 백엔드 실행
```bash
cd backend
py -3 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

기본 시드 계정:
- email: `admin@vibe-hr.local`
- password: `admin1234`

## 프론트엔드 실행
```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

접속:
- 로그인: `http://localhost:3000/login`
- 대시보드: `http://localhost:3000/dashboard`

## 3) 프론트 개발 원칙

- UI 라이브러리는 MUI를 사용하지 않고 `shadcn/ui`를 사용합니다.
- 페이지 구현 시 첨부 HTML의 색상/톤을 우선 유지합니다.
- 기본 라우팅:
  - `/` -> `/login` 리다이렉트
  - `/login`
  - `/dashboard`

## 4) 백엔드 개발 원칙

- 프레임워크: FastAPI + SQLModel
- DB URL은 환경변수로 관리합니다.
- SQLite에서는 연결 시 FK 활성화(`PRAGMA foreign_keys=ON`)를 강제합니다.

## 5) Codex 스킬 사용 규칙 (다음 세션용)

프론트 작업 요청 시 아래 3개 스킬을 항상 같이 명시합니다.

- `vercel-react-best-practices`
- `vercel-composition-patterns`
- `web-design-guidelines`

권장 요청 예시:
```text
이번 프론트 작업은 vercel-react-best-practices, vercel-composition-patterns 적용해서 구현하고,
마지막에 web-design-guidelines로 src/app/login/page.tsx, src/app/dashboard/page.tsx 리뷰해줘.
```

## 6) 프로젝트 구조

```text
Vibe-HR/
  backend/
    app/
      api/
      core/
      models/
      schemas/
      services/
      main.py
    db/migrations/001_init.sql
  frontend/
    src/app/login/page.tsx
    src/app/dashboard/page.tsx
    src/components/ui/*
    src/components/auth/*
    src/components/dashboard/*
```

