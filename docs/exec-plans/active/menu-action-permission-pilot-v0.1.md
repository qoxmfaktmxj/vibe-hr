Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: TBD
Confidence: Medium

# 메뉴 액션 권한 3개 화면 Pilot Execution Plan v0.1

## 목표
메뉴 액션 권한을 **UI + 서버 + 테스트 + evidence** 까지 닫는 표준 패턴을 3개 대표 화면에 시범 적용한다.

이 pilot의 목적은 단순히 3개 화면을 수정하는 것이 아니라, 이후 다수의 AG Grid 화면에 재사용 가능한 액션 권한 적용 기준을 만드는 것이다.

## Pilot 대상 화면
### 1. 사원관리
- Registry Key: `hr.employee`
- Path: `/hr/employee`
- Page: `frontend/src/app/hr/employee/page.tsx`
- Component: `frontend/src/components/hr/employee-master-manager.tsx`
- 성격: 표준 단일 AG Grid CRUD 화면

### 2. 조직코드관리
- Registry Key: `org.departments`
- Path: `/org/departments`
- Page: `frontend/src/app/org/departments/page.tsx`
- Component: `frontend/src/components/org/organization-manager.tsx`
- 성격: 조직 도메인 표준형 AG Grid 화면

### 3. 공통코드관리
- Registry Key: `settings.common-codes`
- Path: `/settings/common-codes`
- Page: `frontend/src/app/settings/common-codes/page.tsx`
- Component: `frontend/src/components/settings/common-code-manager.tsx`
- 성격: 마스터-디테일 복합형 AG Grid 화면

## 왜 이 3개인가
- `docs/MENU_ACTION_PERMISSION_PLAN.md`의 단계별 적용 계획과 일치한다. [Observed]
- 세 화면 모두 프론트에 `useMenuActions(path)` 기반 액션 gating 구조가 이미 존재한다. [Observed]
- 세 화면이 각각 다른 대표 패턴을 보여 준다. [Derived]
  - 표준 단일 CRUD
  - 조직 도메인 표준형
  - 복합형 마스터-디테일

## 적용 순서
### Phase 1 — `hr.employee`
가장 표준적인 단일 CRUD형 화면으로, 액션 권한 표준 패턴을 먼저 고정하기 좋다.

### Phase 2 — `org.departments`
같은 패턴을 조직 도메인 화면에 재적용해 재사용성을 검증한다.

### Phase 3 — `settings.common-codes`
복합형 예외 케이스(2-grid, 2-save 흐름)까지 처리해 확장성을 검증한다.

## 범위
### 포함
- 3개 대상 화면의 toolbar/action gating 정리
- 액션 코드 표준(`query`, `create`, `copy`, `template_download`, `upload`, `save`, `download`) 기준 통일 점검
- 서버 측 메뉴 액션 권한 API/서비스 동작 검증
- UI 비노출/비활성 + 서버 enforcement의 end-to-end 점검
- 테스트/검증/작업 evidence 기록 패턴 수립
- 이후 확장용 rollout checklist 도출

### 비포함
- 모든 AG Grid 화면 일괄 적용
- 메뉴 권한 관리 UI 대규모 개편
- 권한 체계 전체 재설계
- auth/authz 구조 전면 변경
- 급여/정산/배포 영역 변경

## 위험도
- Risk Class: **R2**
- 이유:
  - 권한 흐름과 공통 UI 패턴에 영향이 있다.
  - 프론트/백 모두 확인해야 한다.
  - 추후 다수 화면 확장의 기준이 되므로 local fix 수준이 아니다.

## 승인 정책
- 기본 상태: **사전 승인 필요**
- 근거: `docs/GOVERNANCE.md`의 R2 규칙
- 추가 승인 없이 진행 가능한 범위:
  - 실행계획 문서화
  - 영향도 분석
  - 테스트/검증 설계
- 실제 코드 수정 전 요구사항:
  - 3개 화면 범위 확정
  - 서버 enforcement 대상 API 목록 정리
  - 검증 세트 확정

## 예상 변경 파일 후보
### 프론트엔드
- `frontend/src/components/hr/employee-master-manager.tsx`
- `frontend/src/components/org/organization-manager.tsx`
- `frontend/src/components/settings/common-code-manager.tsx`
- `frontend/src/lib/menu/use-menu-actions.ts` (필요 시)
- `frontend/src/components/grid/grid-toolbar-actions.tsx` (필요 시)
- `frontend/src/components/grid/grid-standard-toolbar.tsx` (필요 시)

### 백엔드
- `backend/app/api/menu.py`
- `backend/app/services/menu_service.py`
- `backend/app/schemas/menu.py`
- 관련 route/service tests (`backend/tests/*menu*`, 필요 시 신규 테스트)

### 문서
- `docs/MENU_ACTION_PERMISSION_PLAN.md` (pilot 결과 반영이 필요할 경우)
- `docs/TEST_STRATEGY.md` (권한 변경 테스트 패턴 보강이 필요할 경우)
- `docs/TASK_LEDGER.md` (실행 기록 추가)
- `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`

## 작업 분해
### Frontend lane
#### 목표
- 화면별 toolbar action이 `allowedActions` 기준으로 일관되게 제어되는지 정리한다.
- hidden/disabled 기준을 통일한다.
- saveAction과 일반 action의 처리 기준을 명확히 한다.

#### 세부 작업
- `ACTION_CODE_BY_KEY`와 toolbar key/action code 매핑 점검
- 권한 없는 action의 처리 방식 정리
  - 숨김
  - 비활성
  - 클릭 차단
- `queryDisabled`, `saveAction`, `GridToolbarActions` 사용 패턴 비교
- 복합형 화면(common-codes)의 group/detail action gating 분리 기준 정리

#### 산출물
- 화면별 action gating 정합화
- 재사용 가능한 frontend 패턴 메모

### Backend lane
#### 목표
- 현재 메뉴 액션 권한 API/서비스가 3개 화면에 대해 기대대로 동작하는지 점검한다.
- UI 비노출만으로 끝나지 않도록 서버 enforcement 필요 지점을 식별한다.

#### 세부 작업
- `/menus/actions/current` 응답 구조 점검
- `STANDARD_MENU_ACTION_CODES`와 프론트 액션 코드 정합성 확인
- 역할별 action permission matrix update/read 흐름 점검
- 화면별 실제 저장/업로드/다운로드 관련 API가 권한 검증을 받고 있는지 식별
- 서버 검증 누락 endpoint 목록 작성

#### 산출물
- 서버 enforcement 점검 결과
- 누락 API 목록(있다면)
- 최소 보강안

### QA / Verification lane
#### 목표
- pilot 3개 화면에 대한 최소 end-to-end 검증 기준을 만든다.

#### 세부 작업
- 역할/권한 조합별 expected action matrix 정의
- 화면별 최소 수동 검증 시나리오 작성
- 가능하면 backend test 또는 regression 후보 도출
- `validate:grid`, lint, build, pytest 적용 범위 정리

#### 산출물
- 권한 검증 체크리스트
- 실패 taxonomy 적용 예시
- evidence 템플릿

### Documentation lane
#### 목표
- 이번 pilot에서 나온 패턴을 이후 rollout 기준으로 남긴다.

#### 세부 작업
- rollout checklist 정리
- 표준 action 권한 적용 규칙 요약
- 향후 대상 화면 분류 기준 정리

#### 산출물
- pilot completion note
- rollout checklist
- 후속 적용 기준 메모

## 검증 계획
### 필수 검증
#### Frontend
```bash
cd frontend
npm run validate:grid
npm run lint
npm run build
```

#### Backend
```bash
cd backend
pytest
```

### 추가 권장 검증
- 3개 화면에 대해 권한 허용/비허용 수동 시나리오 점검
- 권한 없는 action에 대한 UI 차단 확인
- 권한 없는 요청에 대한 서버 차단 확인

## 화면별 기대 검증 포인트
### `hr.employee`
- query/create/copy/template/upload/save/download 권한별 표시/차단 상태
- 저장/다운로드/업로드 관련 서버 경로의 권한 검증 여부

### `org.departments`
- 표준형 toolbar 액션 gating 일관성
- 조직코드 저장/템플릿/업로드/다운로드 흐름 권한 검증 여부

### `settings.common-codes`
- group 영역과 detail 영역의 action 분리 제어
- save가 2개 흐름일 때 권한 처리 기준
- 복합형 화면의 예외 케이스 정리

## 완료 기준 (Definition of Done)
다음이 충족되면 pilot 1차 완료로 본다.

- [ ] 대상 3개 화면이 pilot 대상으로 공식 확정되었다.
- [ ] 화면별 frontend action gating 기준이 정리되었다.
- [ ] backend action permission 응답/검증 구조가 점검되었다.
- [ ] 서버 enforcement 누락 여부가 식별되었다.
- [ ] 필수 검증 세트가 정의되었다.
- [ ] rollout checklist 초안이 도출되었다.
- [ ] 결과를 `docs/TASK_LEDGER.md` 기준으로 기록할 수 있다.

## 후속 결과물
pilot 이후 반드시 남겨야 할 것:
1. frontend 적용 패턴
2. backend enforcement 패턴
3. QA 검증 시나리오
4. rollout checklist
5. 다음 적용 후보 화면 목록

## Known Risks
- UI gating은 이미 일부 존재하지만 서버 enforcement가 화면별로 고르게 닫히지 않았을 수 있다.
- 복합형 화면(common-codes)은 단일 CRUD 기준만으로 처리하기 어려울 수 있다.
- permission frontend path는 일부 공통화되어 있지만 실제 저장 API 경로별 검증은 별도 확인이 필요하다.

## Stop / Escalation Conditions
다음이 나오면 구현 전에 멈추고 다시 승인/결정을 받는다.
- auth/authz 구조 자체를 바꿔야 하는 경우
- DB schema 변경이 필요한 경우
- 권한 관리 UI를 대규모로 다시 짜야 하는 경우
- 공통 Grid 컴포넌트 대규모 수정이 필요한 경우

## 추천 다음 단계
1. 이 plan 승인
2. `docs/TASK_LEDGER.md`에 pilot task 1건 생성
3. Phase 1 (`hr.employee`)부터 실제 구현/검증 시작
4. Phase 1 결과를 패턴으로 고정한 뒤 Phase 2/3 확장
