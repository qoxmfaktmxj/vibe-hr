# Non-Security Improvement Plan

Updated: 2026-03-12

## Goal

Repository 기준으로 실제 확인된 비보안 개선 항목만 정리하고, 체크리스트로 실행 순서를 고정한다.

## Review Summary

### P0 - 먼저 손봐야 하는 항목

- [x] 루트 레이아웃의 전역 인증/메뉴 fetch 제거
  - 근거: `frontend/src/app/layout.tsx`에서 모든 페이지 렌더 시 `getAuthUser()`와 `getMenuTree()`를 호출한다.
  - 영향: 로그인 페이지 같은 공개 페이지도 인증/메뉴 조회 비용을 같이 부담한다.
  - 관련 파일:
    - `frontend/src/app/layout.tsx`
    - `frontend/src/lib/server/session.ts`
    - `frontend/src/components/providers.tsx`
    - `frontend/src/app/dashboard/layout.tsx`
    - `frontend/src/lib/guard.ts`
  - 완료 조건:
    - 공개 페이지(`login`, `unauthorized`, landing`)는 인증/메뉴 선조회 없이 렌더된다.
    - 보호 레이아웃 또는 보호 라우트 그룹에서만 세션/메뉴 preload를 수행한다.
    - 기존 `AuthProvider`, `MenuProvider`, `requireMenuAccess()` 동작이 깨지지 않는다.

- [x] 대시보드 fallback 하드코딩 제거
  - 근거: `frontend/src/lib/api.ts`의 `getDashboardSummary()`가 실패 시 고정 숫자를 반환한다.
  - 영향: 장애가 정상 데이터처럼 보인다.
  - 관련 파일:
    - `frontend/src/lib/api.ts`
    - `frontend/src/app/dashboard/page.tsx`
    - `frontend/src/types/dashboard.ts`
  - 완료 조건:
    - 실패 시 가짜 숫자를 보여주지 않는다.
    - 오류 상태와 빈 상태가 분리된다.
    - 서버 로그 또는 UI 배지로 실패가 드러난다.

- [x] 앱 시작 시 자동 시드 실행 분리
  - 근거: `backend/app/main.py`의 lifespan에서 `seed_initial_data(session)`를 항상 실행한다.
  - 영향: 부팅 부작용이 크고 테스트/배포/로컬 재현성이 흔들린다.
  - 관련 파일:
    - `backend/app/main.py`
    - `backend/app/bootstrap.py`
    - `backend/scripts/seed_dev_postgres.py`
  - 완료 조건:
    - 기본 부팅은 DB 초기화만 수행한다.
    - 시드는 CLI 또는 명시적 환경변수 플래그로만 실행된다.
    - 개발 편의 시나리오는 별도 문서/스크립트로 유지된다.

- [x] CI에 lint/build 품질 게이트 추가
  - 근거: `.github/workflows/deploy.yml`은 `pytest`, `npm run test`만 실행한다.
  - 영향: 프런트 lint/build 실패가 배포 전 차단되지 않는다.
  - 관련 파일:
    - `.github/workflows/deploy.yml`
    - `frontend/package.json`
    - `frontend/vitest.config.ts`
  - 완료 조건:
    - 프런트에서 최소 `npm run validate:grid`, `npm run lint`, `npm run build`, `npm run test`를 돈다.
    - 백엔드는 현재 테스트 외에 필요한 smoke check가 있으면 추가한다.

### P1 - 구조 개선 우선 항목

- [x] 프런트 API 접근 계층 통합
  - 근거:
    - `frontend/src/lib/api.ts`
    - `frontend/src/lib/server/session.ts`
    - `frontend/src/lib/mng-proxy.ts`
  - 현재 상태:
    - `API_BASE_URL`, 토큰 처리, fetch 옵션, 에러 처리 규칙이 분산돼 있다.
    - `getMenuTree()`가 `api.ts`와 `server/session.ts` 양쪽에 있다.
  - 완료 조건:
    - 서버용 typed fetch helper를 하나로 정리한다.
    - Route handler proxy helper도 공통화한다.
    - 동일 리소스는 한 경로에서만 조회 책임을 갖는다.

- [x] 백엔드 `employee_service.py` 책임 분리
  - 근거: `backend/app/services/employee_service.py` 하나에 목록 조회, 생성, 수정, 삭제, 배치 저장, ID 생성, 연관 데이터 정리까지 몰려 있다.
  - 추가 문제:
    - `batch_save_employees()`가 예기치 않은 예외를 전부 `409 Conflict`로 감싼다.
  - 완료 조건:
    - query/read 로직과 command/write 로직을 분리한다.
    - batch transaction 처리와 에러 매핑을 분리한다.
    - 예외 성격에 맞는 상태코드를 반환한다.

- [ ] 대형 AG Grid 매니저 컴포넌트 분해
  - 근거:
    - `REFACTORING_PLAN.md`
    - `frontend/src/components/hr/employee-master-manager.tsx`
    - `frontend/src/components/hri/hri-application-hub.tsx`
  - 현재 상태:
    - 대형 컴포넌트에 그리드, 검색, 툴바, 편집 상태, 모바일/데스크톱 분기가 함께 있다.
  - 완료 조건:
    - `page shell`, `search`, `toolbar`, `grid`, `edit state hook` 수준으로 분리한다.
    - 기존 AG Grid 표준 규칙은 유지한다.
    - 대표 화면 1개 이상에서 회귀 확인을 남긴다.

### P2 - 작은데 바로 맞춰둘 항목

- [x] HTML `lang` 값을 제품 언어와 맞추기
  - 근거: `frontend/src/app/layout.tsx`가 `<html lang="en">`을 사용한다.
  - 참고:
    - GPT 답변의 "README가 한국어 제품 설명" 근거는 현재 저장소와 다르다.
    - 현재 `frontend/README.md`는 기본 Next 템플릿 상태다.
  - 완료 조건:
    - 기본 언어를 `ko`로 맞추거나, locale 기반 처리로 바꾼다.

- [ ] 테스트 범위 현실화
  - 근거:
    - `backend/tests/conftest.py`
    - `backend/tests/test_employee_service_unit.py`
    - `frontend/src/lib/menu-icon-options.test.ts`
    - `frontend/vitest.config.ts`
  - 현재 상태:
    - 프런트 테스트는 `node` 환경의 `src/**/*.test.ts` 중심이다.
    - UI 상호작용, route handler, 페이지 레벨 검증은 비어 있다.
  - 완료 조건:
    - 최소한 핵심 화면용 `jsdom` 테스트 또는 E2E 진입점을 추가한다.
    - 서버/프런트 핵심 플로우에 대한 통합 테스트를 늘린다.

## Suggested Execution Order

1. [ ] 레이아웃 세션 preload 이동
2. [ ] 대시보드 fallback 제거
3. [ ] 자동 시드 분리
4. [ ] CI 게이트 강화
5. [ ] API 계층 통합
6. [ ] `employee_service.py` 분리
7. [ ] AG Grid 대형 컴포넌트 분해
8. [ ] `lang` 정리 및 테스트 보강

## Notes

- 이 문서는 보안 항목을 제외한 개선 계획만 다룬다.
- 실제 코드 수정 전에는 각 큰 작업마다 작은 세부 계획을 추가로 자르는 것이 안전하다.
- AG Grid 화면 수정 시에는 프로젝트의 grid 규칙 문서를 선행 확인해야 한다.
