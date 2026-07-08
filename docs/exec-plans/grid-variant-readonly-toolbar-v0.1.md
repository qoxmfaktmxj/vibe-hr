# Exec Plan: grid-screens.json variant 필드 + readonly toolbar 축소 (v0.1)

- Date: 2026-07-08
- Status: draft (승인 대기)
- Risk Class: R2 (`config/grid-screens.json`, `frontend/src/lib/grid/**` 보호 경로)
- Approval Status: requested
- Owner: kms
- Inputs: `docs/GRID_CRUD_AUDIT.md`(2026-03-23, 63화면 전수), `docs/VIBE_GRID_LIFECYCLE_QA_PLAN.md`, `docs/GRID_SCREEN_STANDARD.md`

## Goal

레지스트리에 화면 성격(variant)을 명시해 (1) 읽기전용 화면의 toolbar 과대등록(7버튼 → 실지원 2버튼) 정합성 문제를 해소하고, (2) validate:grid가 variant별 규칙을 검증하게 하며, (3) 이후 VibeGrid wrapper 도입의 분류 기반을 만든다.

## Schema 변경안

`config/grid-screens.json` 각 screen 항목에 선택 필드 추가:

```json
"variant": "crud" | "readonly" | "workflow" | "custom"
```

- 기본값(필드 부재 시): `crud` — 기존 화면 하위호환.
- `readonly`: toolbar는 `["query", "download"]`만 허용.
- `workflow`: 표준 CRUD 대신 워크플로우 액션(예: 계산/마감/지급, 승인/반려) — toolbar 검증은 `query` 필수 + 화면 선언 액션 허용.
- `custom`: AgGridReact 미사용(예: tim.month-close HTML 테이블). 렌더 검증만 수행.

주의: GRID_CRUD_AUDIT는 `approval`을 별도 제안했으나 wel.requests(승인/반려)와 payroll.runs(계산/마감)를 모두 `workflow`로 통합한다. 세분화는 실익이 없고 validator 분기만 늘린다.

## 분류 초안 (감사 문서 기준, 적용 전 재검증 필요)

- `readonly` 19: hr.retire.checklist, tim.annual-leave, tim.attendance-status, tim.leave-approval, tim.reports, hri.tasks.approvals, hri.tasks.receives, mng.dev-inquiries, mng.dev-projects, mng.dev-requests, mng.dev-staff, mng.infra, mng.manager-status, mng.outsource-attendance, mng.outsource-contracts, org.dept-history, wel.benefit-types (감사 시점 19 → 현재 등록 60화면 기준 재확인)
- `workflow` 3: payroll.runs, wel.requests, wel.my-requests
- `custom` 1: tim.month-close
- 나머지: `crud`

## 구현 순서 (승인 후, Sonnet 실행자 위임)

1. `frontend/scripts/validate-grid-screens.mjs`에 variant 규칙 추가 (필드 부재 = crud 취급, 미지정 variant 값은 에러).
2. `config/grid-screens.json`에 variant 필드 일괄 부여 (위 분류 초안 → 화면별 실코드 재확인 후 확정).
3. readonly 화면 toolbar를 `["query", "download"]`로 축소 — **한 커밋에 한 도메인씩** (tim → mng → 나머지), 각 단계마다 `npm run validate:grid && npm run lint && npm run build`.
4. 브라우저 확인: readonly 화면 2개 샘플(예: tim.attendance-status, org.dept-history)에서 toolbar 버튼 노출과 서버 액션 권한 응답 일치 확인 (UI 숨김만으로 처리 금지 — `docs/MENU_ACTION_PERMISSION_PLAN.md` 규칙).
5. `docs/GRID_SCREEN_STANDARD.md`에 variant 규칙 문서화.

## Non-Scope

- VibeGrid wrapper 도입(별도 파일럿), 부분구현 9화면 기능 보완, 시각 디자인 변경.

## Rollback

- variant 필드는 additive — validator에서 규칙만 끄면 원복. toolbar 축소는 커밋 단위 revert.

## 승인 요청 사항

1. variant 4종(approval 통합) 채택 여부
2. readonly 19화면 toolbar 축소 진행 여부 (도메인 단위 분할 커밋)
3. 파일럿 화면 선정: tim.attendance-status 제안
