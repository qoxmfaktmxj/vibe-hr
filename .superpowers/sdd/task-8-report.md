# Task 8 Report

## 완료 내용
- `/org/types` 페이지를 AG Grid 화면으로 연결하고 `GRID_SCREEN` 메타데이터를 추가했다.
- `org.types`를 `config/grid-screens.json`에 등록하고 toolbar를 `query/create/copy/save/download`로 맞췄다.
- `frontend/src/types/organization.ts`에 lookup 응답 타입을 추가했다.
- `org/types` 화면 타이틀을 `조직구분`으로 맞췄다.
- `org-types` Playwright 스펙을 추가했다.
- `org-bff-route-contract.test.ts`의 타입 불일치를 정리했다.

## 검증
- `npm run validate:grid` 통과
- `npx eslint ...Task8 files...` 통과
- `npx vitest run src/lib/org/org-bff-route-contract.test.ts` 통과
- `npx tsc --noEmit` 통과
- `npx playwright test tests/e2e/org-types.spec.ts tests/e2e/org-chart.spec.ts --workers=1` 실패
  - 실패 사유: `frontend/tests/e2e/global-setup.ts`에서 로그인 후 `**/dashboard` 이동 대기 시간 초과
- `git diff --check` 통과

## 비고
- Playwright 실패는 `org/types` 렌더링 이전의 글로벌 셋업 문제였다.
- 커밋 대상은 Task8 파일만 유지했다.
