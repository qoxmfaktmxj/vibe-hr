# 메뉴권한 + 화면 액션권한 통합 계획

## 목표
메뉴 진입 권한과 화면 액션(버튼) 권한을 분리해 통제한다.

## 1. 권한 모델

### 1) 메뉴 권한 (기존)
- 메뉴 접근 여부 제어

### 2) 액션 권한 (신규)
- 버튼 단위 제어
- 표준 액션 코드:
  - `query`
  - `create`
  - `copy`
  - `template_download`
  - `upload`
  - `save`
  - `download`

## 2. DB 스키마 제안

### app_menu_actions
- id
- menu_id (FK app_menus)
- action_code
- enabled_default
- created_at, updated_at

### app_role_menu_actions
- id
- role_id (FK auth_roles)
- menu_id (FK app_menus)
- action_code
- allowed
- created_at, updated_at

## 3. API
- `GET /api/v1/menus/actions/tree` : 메뉴 + 액션 권한 트리
- `PUT /api/v1/menus/actions/roles/{roleId}` : 역할별 액션 권한 저장
- `GET /api/v1/menus/actions/roles/{roleId}` : 역할별 액션 권한 조회

## 4. 프론트 적용
- 로그인/권한 로드 시 메뉴 + 액션 권한 수신
- AG Grid 툴바는 `allowedActions` 기준으로 버튼 표시/비활성
- 비권한 버튼 클릭 차단

## 5. 서버 보안
- 저장/업로드/다운로드 등 액션별 API에 권한 검증 필수
- UI 비노출만으로 보안 대체 금지

## 6. 단계별 적용
1) 사원/공통코드/조직코드 3화면에 액션 권한 적용
2) 메뉴권한관리 UI에 액션 매트릭스 탭 추가
3) 나머지 AG Grid 화면 순차 편입

## 7. Pilot 확정 범위 (2026-03-22)
### 대상 화면
1. `hr.employee` (`/hr/employee`)
2. `org.departments` (`/org/departments`)
3. `settings.common-codes` (`/settings/common-codes`)

### 적용 순서
1. `hr.employee`
2. `org.departments`
3. `settings.common-codes`

### 이유
- 세 화면 모두 frontend에 `useMenuActions(path)` 기반 gating 구조가 이미 존재한다. [Observed]
- 표준 단일 CRUD / 조직 도메인 표준형 / 복합형 마스터-디테일의 3가지 패턴을 커버한다. [Derived]
- 이후 다수의 AG Grid 화면에 확장 가능한 rollout 기준점이 된다. [Derived]

## 8. Pilot 구현 결과
### 완료된 것
- backend 메뉴 액션 권한 helper 추가
- `employee`, `organization(departments)`, `common_code` API에 `query`/`save` action gate 연결
- pilot 범위 단위 테스트 추가 (`backend/tests/test_menu_action_permission_unit.py`)

### 검증 결과
- targeted backend permission pytest: passed (dockerized python test run) [Observed]
- `scripts/check-risk-paths.py` 실행: passed, permission-related R2 signal 확인 [Observed]
- `guardrails.yml` actionlint: passed [Observed]
- frontend `validate:grid`: failed, but pilot 변경과 무관한 기존 baseline 이슈 확인 [Observed]

## 9. Rollout Checklist
다음 화면에 액션 권한을 붙일 때 아래를 확인한다.
- 메뉴 path / menu code가 실제 registry 및 route와 일치하는가
- frontend에서 `useMenuActions(path)`를 사용하고 있는가
- toolbar action key와 표준 action code(`query/create/copy/template_download/upload/save/download`) 매핑이 일치하는가
- 권한 없는 action이 hide / disable / click block 중 어떤 방식으로 처리되는지 일관적인가
- 저장/업로드/다운로드 관련 backend endpoint에 action-level enforcement가 있는가
- `validate:grid` / lint / build / backend tests / 수동 검증 중 어떤 검증을 적용했는가
- 결과를 `docs/TASK_LEDGER.md`에 기록했는가
