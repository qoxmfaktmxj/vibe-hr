# VIBE-HR 프로젝트 온보딩 문서
## 목적
이 문서는 **처음 이 저장소에 들어온 Claude Code가 프로젝트를 빠르게 파악하고**, 기존 운영 문서를 올바른 순서로 읽고, 안전하게 작업하도록 돕기 위한 상위 안내문이다.
세부 규칙은 이미 저장소 내부 문서에 존재한다. 이 문서는 그것들을 **어떤 순서와 관점으로 소비해야 하는지**를 고정한다.

---

## 1. 프로젝트 한 줄 설명
VIBE-HR은 한국형 인사관리 현대화 프로젝트다.
프론트엔드는 **Next.js App Router + React + TypeScript + AG Grid**, 백엔드는 **Rust, axum, SQLx**, DB는 **PostgreSQL** 기반으로 구성되어 있다.

---

## 2. 기술 스택 요약
### 프론트엔드
- Next.js 16 (App Router)
- React 19
- TypeScript
- AG Grid 35
- shadcn/ui, Radix UI
- Tailwind CSS 4
- SWR
- Recharts
- date-fns
- react-day-picker
- xlsx

### 백엔드
- Rust 2024, axum, Tokio
- Serde 요청/응답, SQLx 쿼리와 트랜잭션
- Flyway SQL과 PostgreSQL 카탈로그 검증

### 데이터/인프라
- PostgreSQL
- Docker / Nginx

### 품질 도구
- ESLint
- Vitest
- Cargo 테스트, rustfmt, Clippy
- Playwright E2E
- AG Grid validator (`npm run validate:grid`)

---

## 3. 먼저 읽어야 할 문서 순서
Claude Code는 작업 전에 반드시 아래 순서로 읽는다.

1. `docs/DEVELOPMENT_PRECHECK.md`
2. `AGENTS.md`
3. `WORKFLOW.md`
4. `config/grid-screens.json`
5. `docs/GRID_SCREEN_STANDARD.md`
6. `docs/AG_GRID_COMMON_GUIDE.md`
7. `docs/MENU_ACTION_PERMISSION_PLAN.md`
8. 작업 대상 페이지/컴포넌트/API 파일

이 순서를 바꾸지 않는 이유:
- 화면은 AG Grid 표준 계약을 따르고, Rust 핸들러는 메뉴/액션 권한을 검사한다.
- 화면을 하나 고칠 때도 **grid registry**, **shared grid module**, **toolbar 순서**, **dirty-row 처리**, **권한 검증**, **저장 순서**까지 같이 맞아야 한다.

---

## 4. 저장소 구조를 어떻게 이해해야 하는가
### 루트
- `frontend/`: Next.js 앱
- `backend-rust/`: 실행 백엔드
- `backend-spring/`: Spring 비교 구현과 Flyway SQL
- `config/`: 화면 registry 및 공통 설정
- `docs/`: 개발 규칙/표준/진행 현황 문서
- `orchestration/`: 배포/실행 보조 구성
- `.claude/`: 프로젝트 내부 AI 협업 관련 자료

### 프론트엔드 핵심 구조
- `frontend/src/app/`: 라우트 페이지
- `frontend/src/components/`: 도메인/공통 UI 컴포넌트
- `frontend/src/lib/`: 서버 호출, grid 유틸, 권한/메뉴 유틸, 공통 헬퍼
- `frontend/tests/e2e/`: Playwright E2E

### 백엔드 핵심 구조
- `backend-rust/src/main.rs`에서 서버와 DB 명령을 시작하고 `backend-rust/src/lib.rs`에서 라우터를 구성한다.
- `backend-rust/src/security/`는 인증을, `backend-rust/src/menu.rs`는 메뉴 권한을 담당한다.
- `backend-rust/src/hr/`, `backend-rust/src/time/` 등 각 업무 모듈에 핸들러와 SQLx 쿼리가 있다.
- `backend-rust/src/db/`에는 스키마 검사와 개발용 시드 명령이 있다.

---

## 5. 이 프로젝트의 핵심 실행 흐름
## 5-1. 프론트 진입 흐름
- 루트(`/`)는 인증 쿠키(`vibe_hr_token`)를 보고 `/dashboard` 또는 `/login`으로 보낸다.
- `frontend/src/proxy.ts`는 사실상 인증/세션 미들웨어 역할을 한다.
- 비인증 사용자가 보호 경로에 접근하면 `/login`으로 돌리고, 토큰 만료가 가까우면 refresh도 시도한다.

### Claude Code가 기억할 것
- 이 프로젝트의 인증 흐름은 “페이지 컴포넌트만” 보면 안 된다.
- **루트 페이지 → proxy.ts → `/api/auth/*` route handlers → backend auth API** 순으로 이어진다.

## 5-2. 로그인 흐름
- 로그인은 단순 `id/password`가 아니다.
- `ENTER_CD + login_id + password` 조합이다.
- 백엔드는 먼저 활성화된 회사(`OrgCorporation`)로서 `enter_cd`가 유효한지 확인한 뒤 사용자 인증을 진행한다.
- 즉, dev 계정이 있어도 **ENTER_CD가 활성 상태가 아니면 로그인 자체가 실패**할 수 있다.

## 5-3. 프론트-백엔드 통신 흐름
프론트는 두 레이어로 백엔드와 통신한다.

### 서버 유틸
- `frontend/src/lib/server/backend-client.ts`
- 서버 컴포넌트/서버 유틸에서 쿠키 토큰을 붙여 백엔드에 요청한다.

### Route proxy
- `frontend/src/lib/server/route-proxy.ts`
- Next route handler에서 백엔드 API로 프록시한다.

### 의미
Claude Code는 API를 수정할 때:
- 프론트 페이지
- 프론트 route handler
- 서버 유틸
- 백엔드 router/schema/service
를 함께 봐야 한다.

## 5-4. 백엔드 시작 흐름
배포 구성은 Rust 사전 검사, Flyway 마이그레이션, Rust 카탈로그 검사 순서로 DB를 준비한 뒤 API를 시작한다. 서버는 DB 연결과 서명 키를 검사하고 기본 `127.0.0.1:8080`에서 요청을 받는다. 개발 시드는 별도 명령으로 실행한다.

---

## 6. AG Grid가 사실상 이 프로젝트의 화면 엔진이다
이 레포에서 대부분의 관리형 화면은 단순한 React 페이지가 아니라 **AG Grid 표준 화면**으로 취급된다.

### AG Grid 화면의 필수 조건
- 페이지 파일에 `GRID_SCREEN` 메타데이터 선언
- `config/grid-screens.json`에 registry 등록
- profile은 보통 `standard-v2`
- 공통 grid 모듈을 우선 재사용
- toolbar 순서 고정
- row 상태 계약 준수
- dirty-row 보호
- `npm run validate:grid` 통과

### 표준 toolbar 순서
`query -> create -> copy -> template -> upload -> save -> download`

### row 상태 계약
- `_status`
- `_original`
- `_prevStatus`

### 의미
Claude Code는 다음을 하면 안 된다.
- 화면별로 독자적인 grid toolbar를 새로 만들기
- 상태 전이 로직을 각 화면에서 제각각 구현하기
- pagination/dirty-row 경고/row CSS 상태 매핑을 화면마다 따로 만들기

공통 기능이 부족하면 **개별 화면 우회 구현**이 아니라 **shared module을 먼저 확장**해야 한다.

---

## 7. 권한 시스템은 “메뉴 진입 권한”과 “화면 액션 권한”을 분리하려는 방향이다
이 프로젝트는 단순 메뉴 노출 여부만 권한으로 보지 않는다.

### 표준 액션 코드
- `query`
- `create`
- `copy`
- `template_download`
- `upload`
- `save`
- `download`

### 중요한 원칙
- 버튼을 숨기는 것만으로 권한 처리가 끝나지 않는다.
- 서버 API에서도 액션 권한을 검증해야 한다.
- 즉, UI 변경만으로 권한 작업을 끝냈다고 판단하면 안 된다.

---

## 8. 저장/배치 처리에서 자주 놓치는 계약
백엔드의 저장 흐름은 단순 bulk upsert가 아니다.

### 기본 저장 순서
`DELETE -> UPDATE -> INSERT`

화면 저장 API/서비스를 수정할 때는 이 순서가 유지되는지 반드시 점검한다.
특히 AG Grid 편집 화면에서 이 순서를 깨면 데이터 정합성이 쉽게 무너진다.

---

## 9. 도메인별 구현 범위

[도메인 책임](ARCHITECTURE.md)에서 모듈을 찾고 [Rust 전환 검증 결과](rust-migration/verification.md)에서 해당 API와 DB 상태를 실제로 대조한 범위를 확인한다.

## 10. 개발 데이터

Flyway는 필수 기준 데이터를 관리한다. 개발 관리자 계정과 테스트 사원은 [로컬 시드 절차](../README.md#시드-데이터)에 따라 별도로 만든다. 급여 실행이나 승인 이력이 필요한 시나리오는 격리 DB에 해당 fixture를 준비한다.

## 11. Claude Code가 실수하기 쉬운 지점
1. **AG Grid 공통 규칙을 안 읽고 화면만 수정**
2. `grid-screens.json` 등록 누락
3. toolbar 순서 변경
4. dirty-row 보호 누락
5. `_status / _original / _prevStatus` 계약 파손
6. 프론트 버튼 권한만 수정하고 서버 검증 누락
7. 저장 순서 `DELETE -> UPDATE -> INSERT` 파손
8. 로그인에서 `ENTER_CD` 조건을 무시
9. route proxy / server util / backend schema 중 하나만 수정
10. 문서 업데이트 없이 “코드만 맞췄다”고 판단

---

## 12. 화면/기능 작업 시 기본 추적 순서
예를 들어 AG Grid 기반 화면을 수정할 때는 다음 순서로 본다.

1. `config/grid-screens.json`에서 registryKey 찾기
2. 해당 page 파일 확인 (`GRID_SCREEN`, menu access, route)
3. 해당 manager/component 파일 확인
4. `frontend/src/components/grid/*`와 `frontend/src/lib/grid/*` 재사용 지점 확인
5. `useMenuActions` 등 액션 권한 연결 확인
6. 프론트 route handler 여부 확인
7. 백엔드 router/schema/service/model 확인
8. 저장 순서/권한 검증/페이지네이션 응답 형식 확인
9. 관련 docs/TODO 반영 필요 여부 확인

---

## 13. 검증 명령
작업 후 기본 검증:
- `npm run validate:grid`
- `npm run lint`
- `npm run test`
- 필요 시 `npm run test:e2e:hr`
- 필요 시 `npm run build`
- 백엔드 변경 시 `backend-rust`에서 `cargo test --locked` 실행. DB와 BFF가 관련된 변경은 [테스트 전략](TEST_STRATEGY.md)을 따른다.
- 필요 시 서버 기동 확인

### 최소 기준
AG Grid 화면을 건드렸는데 `validate:grid` 없이 끝내면 완료가 아니다.

---

## 14. UI/텍스트/브라우저 검증
이 프로젝트는 한국어 업무 화면 비중이 높다.
따라서 Claude Code는 단순 타입 통과만으로 끝내지 말고:
- 한국어 라벨 깨짐 여부
- 버튼/툴바 정렬
- 그리드 헤더/페이징/배지 배치
- dirty-row 경고
- 권한에 따른 버튼 노출/비노출
를 브라우저 기준으로 확인해야 한다.

---

## 15. 작업할 때의 안전한 태도
- 넓은 리팩터링보다 **좁고 검증 가능한 변경**을 선호한다.
- 화면별 커스텀 규칙을 추가하기보다 **공통 모듈 확장**을 우선한다.
- README/진행문서와 실제 코드가 다르면, 둘 중 하나를 조용히 무시하지 말고 차이를 기록한다.
- 불완전한 도메인 영역에서는 “완성형 제품처럼” 가정하지 않는다.
- 변경 이유, 영향 범위, 검증 결과를 남긴다.

---

## 16. Claude Code가 가장 먼저 해야 할 일
새 작업을 시작할 때 항상 아래 네 문장을 스스로 체크한다.

1. 이 작업이 AG Grid 표준 화면 작업인가?
2. 관련 registryKey와 shared module은 무엇인가?
3. 권한/저장 순서/dirty-row 계약에 영향이 있는가?
4. README + 진행 문서 기준으로 이 영역은 현재 어느 정도 완성 상태인가?

이 네 가지를 먼저 정리한 뒤 구현에 들어가면, 이 저장소에서는 실수가 크게 줄어든다.
