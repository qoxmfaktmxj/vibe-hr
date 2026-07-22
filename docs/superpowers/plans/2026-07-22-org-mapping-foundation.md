# Organization Mapping Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/org/chart`을 실제 읽기 전용 조직도로 제공하고 기간형 조직구분 항목·부서 다대다 배정 기반의 ORG 네 화면을 순서대로 구현한다.

**Architecture:** 기존 `OrgDepartment.organization_type`은 `HEADQUARTERS`/`TEAM` 계층 유형으로 보존한다. 신규 업무는 별도 `org_mapping_type_items` 및 `org_mapping_assignments` 모델, 전용 FastAPI/BFF, standard-v2 AG Grid로 연결하며 PostgreSQL exclusion constraint와 서비스 검사로 기간 겹침을 막는다.

**Tech Stack:** FastAPI, SQLModel, Alembic, PostgreSQL, Next.js 16, React 19, TypeScript, AG Grid 35, SWR, XLSX, pytest, Vitest, Playwright.

## Global Constraints

- schema, migration, API, permission이 포함된 R3 변경의 명시 승인 완료 상태에서 실행한다.
- 구현은 Terra, task별 및 최종 review는 Sol이 수행한다.
- `OrgDepartment.organization_type`과 `OrgRestructurePlanItem.new_organization_type`을 신규 조직구분으로 읽거나 쓰거나 자동 이관하지 않는다.
- 순서는 `/org/chart` → backend domain → `/org/type-items` → `/org/types` → `/org/type-personal-status` → `/org/type-upload`으로 고정한다.
- 새 Grid는 공통 `frontend/src/components/grid/*`, `frontend/src/lib/grid/*`, `GRID_SCREEN`, registry, toolbar `query -> create -> copy -> template -> upload -> save -> download`, `npm run validate:grid`를 사용하고 VibeGrid를 사용하지 않는다.
- chart v1은 tree/search/expand-collapse/status/metadata/edit link만 제공하고 drag-drop 및 조직개편 적용은 제공하지 않는다.
- item 기간은 `(type_code, item_code)`, assignment 기간은 `(department_id, type_code)`에서 겹치지 않는다.
- upload는 `mode: "atomic"`만 허용한다. 한 행 오류는 422과 0건 저장이다.
- personal status는 기준일 `employment_status == "active"` 직원과 유형별 읽기 전용 동적 열만 제공한다.
- dependency를 추가하지 않는다. `xlsx`는 이미 설치되어 있다.
- VibeGrid 제거는 제외한다. base `a440a211673a179b00dab399cd3dffffb7d8dcb0`의 선행조건이며 관련 파일을 수정하지 않는다.
- task별 검증은 focused test + `git diff --check`다. 각 Grid task에는 `npm run validate:grid`, frontend에는 changed-file ESLint를 실행한다. `npx tsc --noEmit`은 interface checkpoint와 최종, `npm run build`는 최종 한 번만 실행하며 전체 suite/전체 lifecycle은 반복하지 않는다.

## Shared Contracts

| Area | Contract |
| --- | --- |
| Mapping type source | `app_code_groups`/`app_codes`의 전용 group `ORG_MAPPING_TYPE`; `/org/mapping-types`로만 read한다. |
| Item table | `org_mapping_type_items(id, type_code, item_code, name, effective_from, effective_to, erp_employee_code, cost_center_type, sort_order, remark, is_active, created_by, updated_by, created_at, updated_at)`. |
| Assignment table | `org_mapping_assignments(id, department_id, type_code, item_id, effective_from, effective_to, created_by, updated_by, created_at, updated_at)`. |
| Action codes | `query`, `create`, `copy`, `template_download`, `upload`, `save`, `download` in `STANDARD_MENU_ACTION_CODES`; apply them against exact ORG menu paths. |
| BFF | Each BFF reads `vibe_hr_token`, forwards Authorization, query/body/status unchanged, and returns upstream JSON. |

### Task 1: `/org/chart` read-only organization tree

**Files:** Create `frontend/src/lib/org/org-chart-tree.ts`, `frontend/src/lib/org/org-chart-tree.test.ts`, `frontend/src/components/org/org-chart-manager.tsx`, `frontend/tests/e2e/org-chart.spec.ts`; modify `frontend/src/app/org/chart/page.tsx`, `frontend/src/types/organization.ts`.

**Interfaces:** consumes `GET /api/org/departments?all=true` → `OrganizationDepartmentListResponse`; produces `buildOrgChartForest(departments: OrganizationDepartmentItem[]): OrgChartNode[]`. The component makes no write request.

- [ ] **Step 1: Write the failing tests**

```ts
it("builds roots, children, and one visible orphan", () => {
  const nodes = buildOrgChartForest([dept(1, null), dept(2, 1), dept(3, 99)]);
  expect(nodes.map((node) => node.department.id)).toEqual([1, 3]);
  expect(nodes[0].children[0].department.id).toBe(2);
});
test("chart exposes Korean search, status, expand, and edit link", async ({ page }) => {
  await page.goto("/org/chart");
  await expect(page.getByRole("link", { name: "조직코드관리에서 편집" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/lib/org/org-chart-tree.test.ts; npx playwright test tests/e2e/org-chart.spec.ts --workers=1`

Expected: FAIL because the builder and chart UI do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export type OrgChartNode = { department: OrganizationDepartmentItem; children: OrgChartNode[] };
export function buildOrgChartForest(departments: OrganizationDepartmentItem[]): OrgChartNode[] {
  // map ids, attach valid non-self parents, append every unreachable node once
}
```

`OrgChartManager` fetches the existing all=true route, filters code/name, stores `expandedIds: Set<number>`, renders `활성`/`비활성`, `organization_type`, `cost_center_code`, `employee_count`, empty/error states, and `<Link href="/org/departments">조직코드관리에서 편집</Link>`. Do not send `POST`, `PUT`, `PATCH`, or `DELETE`.

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npx vitest run src/lib/org/org-chart-tree.test.ts; npx eslint src/lib/org/org-chart-tree.ts src/lib/org/org-chart-tree.test.ts src/components/org/org-chart-manager.tsx src/app/org/chart/page.tsx; npx playwright test tests/e2e/org-chart.spec.ts --workers=1; git diff --check`

Expected: tests/lint pass; `output/playwright/org-chart.png` proves Korean render; no whitespace error.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/lib/org/org-chart-tree.ts frontend/src/lib/org/org-chart-tree.test.ts frontend/src/components/org/org-chart-manager.tsx frontend/src/app/org/chart/page.tsx frontend/src/types/organization.ts frontend/tests/e2e/org-chart.spec.ts; git commit -m "feat: add read-only organization chart"`

### Task 2: Mapping domain, migration, type source, and permission defaults

**Files:** Create `backend/app/services/organization_mapping_service.py`, `backend/migrations/versions/org_mapping_foundation_20260722_add_mapping_tables.py`, `backend/tests/test_org_mapping_service_unit.py`; modify `backend/app/models/entities.py`, `backend/app/models/__init__.py`, `backend/app/schemas/organization.py`, `backend/app/api/organization.py`, `backend/app/bootstrap.py`, `backend/tests/test_menu_action_permission_unit.py`.

**Interfaces:** consumes `AppCode`, `OrgDepartment`, `AuthUser`, `require_menu_action_for_user`; produces `OrgMappingTypeItem`, `OrgMappingAssignment`, `list_org_mapping_types(session) -> list[OrgMappingType]`.

- [ ] **Step 1: Write the failing unit and permission tests**

```python
def test_mapping_item_rejects_overlapping_same_type_and_item_period() -> None:
    create_mapping_item(session, item("COST", "A", date(2026, 1, 1), None))
    with pytest.raises(HTTPException, match="overlaps"):
        create_mapping_item(session, item("COST", "A", date(2026, 6, 1), None))

def test_type_items_query_denies_without_menu_permission() -> None:
    with pytest.raises(HTTPException, match="Action not allowed"):
        organization_mapping_type_items(page=1, limit=100, session=session, current_user=user)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_menu_action_permission_unit.py -q`

Expected: FAIL because mapping domain is absent.

- [ ] **Step 3: Write minimal domain and migration**

```python
class OrgMappingTypeItem(SQLModel, table=True):
    __tablename__ = "org_mapping_type_items"
    id: int | None = Field(default=None, primary_key=True)
    type_code: str = Field(index=True, max_length=50)
    item_code: str = Field(index=True, max_length=50)
    name: str = Field(max_length=100)
    effective_from: date = Field(index=True)
    effective_to: date | None = Field(default=None, index=True)

class OrgMappingAssignment(SQLModel, table=True):
    __tablename__ = "org_mapping_assignments"
    department_id: int = Field(foreign_key="org_departments.id", index=True)
    type_code: str = Field(index=True, max_length=50)
    item_id: int = Field(foreign_key="org_mapping_type_items.id", index=True)
    effective_from: date = Field(index=True)
    effective_to: date | None = Field(default=None, index=True)
```

Add item fields `erp_employee_code`, `cost_center_type`, `sort_order`, `remark`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`; add equivalent audit fields to assignment. Create revision `org_mapping_foundation_20260722` with `down_revision = "ffc17a622333"`. Upgrade creates `btree_gist` only when absent, both tables, FKs, date-order checks, indexes, `ex_org_mapping_type_item_period` over `type_code,item_code,daterange(effective_from,coalesce(effective_to,'infinity'::date),'[]')`, and `ex_org_mapping_assignment_period` over `department_id,type_code,daterange(effective_from,coalesce(effective_to,'infinity'::date),'[]')`. Downgrade drops only the new constraints/indexes/tables and leaves `btree_gist` installed because it can be shared by other PostgreSQL objects; it never updates `org_departments` or data.

Seed only `ORG_MAPPING_TYPE` group and existing menu action defaults for `org.chart`, `org.types`, `org.type-items`, `org.type-upload`, `org.type-personal-status`. Seed no type values and do not transform hierarchy fields. New ORG APIs read mapping type codes without `/settings/common-codes` authorization.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_menu_action_permission_unit.py -q; ./.venv/Scripts/python.exe -m alembic upgrade head; ./.venv/Scripts/python.exe -m alembic downgrade -1; ./.venv/Scripts/python.exe -m alembic upgrade head; ./.venv/Scripts/python.exe -m alembic check; git diff --check`

Expected: test and migration cycle pass; existing `organization_type="HEADQUARTERS"` is preserved; no schema drift or whitespace error.

- [ ] **Step 5: Commit**

Run: `git add backend/app/models/entities.py backend/app/models/__init__.py backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/app/bootstrap.py backend/migrations/versions/org_mapping_foundation_20260722_add_mapping_tables.py backend/tests/test_org_mapping_service_unit.py backend/tests/test_menu_action_permission_unit.py; git commit -m "feat: add organization mapping domain"`

### Task 3: Mapping item API, BFF, and `/org/type-items`

**Files:** Create `backend/tests/test_org_mapping_routes_unit.py`, `frontend/src/app/api/org/mapping-types/route.ts`, `frontend/src/app/api/org/mapping-type-items/route.ts`, `frontend/src/app/api/org/mapping-type-items/[itemId]/route.ts`, `frontend/src/components/org/org-mapping-type-item-manager.tsx`, `frontend/tests/e2e/org-type-items.spec.ts`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`, `backend/tests/test_org_mapping_service_unit.py`, `frontend/src/app/org/type-items/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`.

**Interfaces:** `GET /api/v1/org/mapping-types` → `{items:[{code,name}]}`. `GET /api/v1/org/mapping-type-items?page&limit&type_code&reference_date` → `{items,total_count,page,limit}`. `POST /api/v1/org/mapping-type-items`, `PUT|DELETE /api/v1/org/mapping-type-items/{item_id}` use `/org/type-items` `query`/`save` permissions.

- [ ] **Step 1: Write the failing tests**

```python
def test_item_list_filters_reference_date_and_pages() -> None:
    response = organization_mapping_type_items(page=1, limit=1, type_code="COST", reference_date=date(2026, 7, 22), session=session, current_user=user)
    assert response.total_count == 2
    assert len(response.items) == 1
```

```ts
test("type-items renders standard grid controls", async ({ page }) => {
  await page.goto("/org/type-items");
  await expect(page.getByRole("button", { name: "조회" })).toBeVisible();
  await expect(page.locator(".ag-root")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_routes_unit.py tests/test_org_mapping_service_unit.py -q; cd ../../frontend; npx playwright test tests/e2e/org-type-items.spec.ts --workers=1`

Expected: FAIL because API and Grid screen do not exist.

- [ ] **Step 3: Write minimal API, BFF, and Grid implementation**

```python
class OrgMappingTypeItemCreateRequest(BaseModel):
    type_code: str = Field(min_length=1, max_length=50)
    item_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    effective_from: date
    effective_to: date | None = None
    erp_employee_code: str | None = None
    cost_center_type: str | None = None
    sort_order: int = 0
    remark: str | None = None
    is_active: bool = True
```

Reject unknown type, invalid date order, overlap (409), and deletion referenced by assignment (409). The three BFF routes follow the common cookie proxy. Page declares `const GRID_SCREEN = { engine: "ag-grid", profile: "standard-v2", registryKey: "org.type-items" } as const;`, uses shared manager/search/toolbar/status/pagination/dirty-dialog modules, and registers the same key. Columns are 유형코드, 항목코드, 명칭, 시작일, 종료일, ERP 사원코드, CC 유형, 정렬, 비고, 사용여부. Toolbar is exactly query/create/copy/template/upload/save/download and maps to existing action codes.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_routes_unit.py tests/test_org_mapping_service_unit.py -q; cd ../../frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-types/route.ts src/app/api/org/mapping-type-items/route.ts src/app/api/org/mapping-type-items/[itemId]/route.ts src/app/org/type-items/page.tsx src/components/org/org-mapping-type-item-manager.tsx src/types/organization.ts; npx tsc --noEmit; npx playwright test tests/e2e/org-type-items.spec.ts --workers=1; git diff --check`

Expected: API, Grid, interface checkpoint, lint, and Korean screenshot pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_service_unit.py backend/tests/test_org_mapping_routes_unit.py frontend/src/app/api/org/mapping-types/route.ts frontend/src/app/api/org/mapping-type-items/route.ts frontend/src/app/api/org/mapping-type-items/[itemId]/route.ts frontend/src/app/org/type-items/page.tsx frontend/src/components/org/org-mapping-type-item-manager.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-type-items.spec.ts; git commit -m "feat: add organization mapping item screen"`

### Task 4: Assignment API and `/org/types`

**Files:** Create `frontend/src/app/api/org/mapping-assignments/route.ts`, `frontend/src/app/api/org/mapping-assignments/[assignmentId]/route.ts`, `frontend/src/components/org/org-mapping-assignment-manager.tsx`, `frontend/tests/e2e/org-types.spec.ts`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`, `backend/tests/test_org_mapping_service_unit.py`, `backend/tests/test_org_mapping_routes_unit.py`, `frontend/src/app/org/types/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`.

**Interfaces:** `GET /api/v1/org/mapping-assignments?page&limit&department_id&type_code&reference_date` → `{items: OrgMappingAssignmentItem[],total_count,page,limit}`; `POST`, `PUT|DELETE /api/v1/org/mapping-assignments/{assignment_id}`; protected path `/org/types` uses `query` and `save`.

- [ ] **Step 1: Write the failing tests**

```python
def test_assignment_allows_two_types_for_one_department() -> None:
    assert create_mapping_assignment(session, dept.id, "COST", cost.id, date(2026, 1, 1), None, user.id).type_code == "COST"
    assert create_mapping_assignment(session, dept.id, "REGION", region.id, date(2026, 1, 1), None, user.id).type_code == "REGION"
def test_assignment_rejects_same_department_type_period_overlap() -> None:
    create_mapping_assignment(session, dept.id, "COST", first.id, date(2026, 1, 1), None, user.id)
    with pytest.raises(HTTPException, match="overlaps"):
        create_mapping_assignment(session, dept.id, "COST", second.id, date(2026, 7, 1), None, user.id)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_org_mapping_routes_unit.py -q; cd ../../frontend; npx playwright test tests/e2e/org-types.spec.ts --workers=1`

Expected: FAIL because assignments and screen are absent.

- [ ] **Step 3: Write minimal API and Grid implementation**

```python
class OrgMappingAssignmentCreateRequest(BaseModel):
    department_id: int
    type_code: str = Field(min_length=1, max_length=50)
    item_id: int
    effective_from: date
    effective_to: date | None = None
```

Service validates department/item existence, `item.type_code == type_code`, active-item coverage, same department/type overlap, and server permissions. The BFF follows Task 3. The `org.types` standard-v2 Grid consumes mapping types/items/departments and filters item options by type; it supports query/create/copy/save/download, common dirty-row protection, and common status modules. Register toolbar `query/create/copy/save/download` without a VibeGrid dependency.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_org_mapping_routes_unit.py -q; cd ../../frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-assignments/route.ts src/app/api/org/mapping-assignments/[assignmentId]/route.ts src/app/org/types/page.tsx src/components/org/org-mapping-assignment-manager.tsx src/types/organization.ts; npx playwright test tests/e2e/org-types.spec.ts tests/e2e/org-chart.spec.ts --workers=1; git diff --check`

Expected: different-type assignment succeeds, same-type conflict is 409, chart regression and Korean browser tests pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_service_unit.py backend/tests/test_org_mapping_routes_unit.py frontend/src/app/api/org/mapping-assignments/route.ts frontend/src/app/api/org/mapping-assignments/[assignmentId]/route.ts frontend/src/app/org/types/page.tsx frontend/src/components/org/org-mapping-assignment-manager.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-types.spec.ts; git commit -m "feat: add organization mapping assignment screen"`

### Task 5: Personal-status projection and `/org/type-personal-status`

**Files:** Create `frontend/src/app/api/org/mapping-personal-status/route.ts`, `frontend/src/components/org/org-mapping-personal-status-manager.tsx`, `frontend/tests/e2e/org-type-personal-status.spec.ts`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`, `backend/tests/test_org_mapping_service_unit.py`, `backend/tests/test_org_mapping_routes_unit.py`, `frontend/src/app/org/type-personal-status/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`.

**Interfaces:** `GET /api/v1/org/mapping-personal-status?reference_date&page&limit` returns `{items: OrgMappingPersonalStatusRow[],type_columns:[{type_code,name}],total_count,page,limit}` and has only `query` permission on `/org/type-personal-status`.

- [ ] **Step 1: Write the failing projection test**

```python
def test_personal_status_has_only_active_employees_and_dynamic_cells() -> None:
    response = list_mapping_personal_status(session, reference_date=date(2026, 7, 22), page=1, limit=100)
    assert [row.employee_no for row in response.items] == ["E-001"]
    assert response.items[0].mappings["COST"].item_name == "서울"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_org_mapping_routes_unit.py -q`

Expected: FAIL because the projection does not exist.

- [ ] **Step 3: Write minimal read-only implementation**

Join `HrEmployee`, `AuthUser`, `OrgDepartment`, effective assignment, and effective item. Exclude `leave` and `resigned`; return empty cells for absent mappings. Page declares `GRID_SCREEN` key `org.type-personal-status`, uses standard-v2 shell/search/pagination/status styling, query/download toolbar, fixed employee columns, and `type_columns.map()` with `editable: false`. Do not create write BFF routes or create/copy/template/upload/save controls.

```ts
type OrgMappingPersonalStatusResponse = { items: OrgMappingPersonalStatusRow[]; type_columns: { type_code: string; name: string }[]; total_count: number; page: number; limit: number };
```

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_org_mapping_routes_unit.py -q; cd ../../frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-personal-status/route.ts src/app/org/type-personal-status/page.tsx src/components/org/org-mapping-personal-status-manager.tsx src/types/organization.ts; npx playwright test tests/e2e/org-type-personal-status.spec.ts --workers=1; git diff --check`

Expected: active-only/dynamic-readonly assertions, Grid validation, lint, and Korean screenshot pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_service_unit.py backend/tests/test_org_mapping_routes_unit.py frontend/src/app/api/org/mapping-personal-status/route.ts frontend/src/app/org/type-personal-status/page.tsx frontend/src/components/org/org-mapping-personal-status-manager.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-type-personal-status.spec.ts; git commit -m "feat: add organization mapping personal status"`

### Task 6: Atomic upload backend contract

**Files:** Create `backend/tests/test_org_mapping_upload_service_unit.py`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`, `backend/tests/test_org_mapping_routes_unit.py`.

**Interfaces:** `GET /api/v1/org/mapping-assignments/upload-template` returns XLSX columns `조직코드`, `유형코드`, `항목코드`, `시작일`, `종료일`. `POST /upload-preview` and `/upload-confirm` accept `OrgMappingAssignmentUploadRequest(mode: Literal["atomic"] = "atomic", rows: list[OrgMappingAssignmentUploadRow])`. Preview returns `{rows:[{row_number,valid,errors,normalized}],valid_count,invalid_count}`; confirm returns `{inserted_count,updated_count}` or preview shape with 422.

- [ ] **Step 1: Write failing atomicity tests**

```python
def test_confirm_rolls_back_every_row_when_one_is_invalid() -> None:
    with pytest.raises(HTTPException, match="upload validation failed"):
        confirm_mapping_assignment_upload(session, [valid_row(), invalid_row()], actor_id=user.id)
    assert session.exec(select(OrgMappingAssignment)).all() == []
def test_confirm_revalidates_after_preview() -> None:
    assert preview_mapping_assignment_upload(session, [valid_row()]).invalid_count == 0
    deactivate_item(session, item.id)
    with pytest.raises(HTTPException):
        confirm_mapping_assignment_upload(session, [valid_row()], actor_id=user.id)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_upload_service_unit.py tests/test_org_mapping_routes_unit.py -q`

Expected: FAIL because preview/confirm do not exist.

- [ ] **Step 3: Write minimal all-or-nothing service**

Normalize codes with `strip().upper()`, accept ISO dates, resolve immutable department/item codes, validate every database and batch interval, and return every row error. Confirm invokes the same validator inside `with session.begin()`, rejects all errors before commit, and creates/updates only an exact `(department_id,type_code,item_id,effective_from)` match when all rows validate. Template needs `template_download`; preview/confirm need `upload`; error export needs `download`; every check uses `/org/type-upload`.


Service signatures are `preview_mapping_assignment_upload(session: Session, rows: list[OrgMappingAssignmentUploadRow]) -> OrgMappingAssignmentUploadPreviewResponse` and `confirm_mapping_assignment_upload(session: Session, rows: list[OrgMappingAssignmentUploadRow], *, actor_id: int) -> OrgMappingAssignmentUploadConfirmResponse`.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_upload_service_unit.py tests/test_org_mapping_routes_unit.py -q; git diff --check`

Expected: invalid batch gives 422 and zero rows; revalidation is protected; no whitespace error.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_upload_service_unit.py backend/tests/test_org_mapping_routes_unit.py; git commit -m "feat: add atomic organization mapping upload api"`

### Task 7: `/org/type-upload` preview, error workbook, and confirm UI

**Files:** Create `frontend/src/app/api/org/mapping-assignments/upload-template/route.ts`, `frontend/src/app/api/org/mapping-assignments/upload-preview/route.ts`, `frontend/src/app/api/org/mapping-assignments/upload-confirm/route.ts`, `frontend/src/components/org/org-mapping-upload-manager.tsx`, `frontend/tests/e2e/org-type-upload.spec.ts`; modify `frontend/src/app/org/type-upload/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`.

**Interfaces:** consumes Task 6 routes; produces `org.type-upload` standard-v2 registry screen with `query/template/upload/download`, and disabled Confirm until `invalid_count === 0`.

- [ ] **Step 1: Write failing browser test**

```ts
test("upload displays atomic policy and disables error export before validation", async ({ page }) => {
  await page.goto("/org/type-upload");
  await expect(page.getByText("전체 행 원자성")).toBeVisible();
  await expect(page.getByRole("button", { name: "오류 다운로드" })).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx playwright test tests/e2e/org-type-upload.spec.ts --workers=1`

Expected: FAIL because this page is a placeholder.

- [ ] **Step 3: Write minimal upload manager**

Declare `GRID_SCREEN` key `org.type-upload`. Use `xlsx.read(await file.arrayBuffer())` for exactly five Korean headers, post normalized JSON to preview, show row/error/normalized data in AG Grid, create the error workbook with `writeFileXLSX`, and submit the same rows to confirm. Render `전체 행 원자성: 오류가 한 행이라도 있으면 저장하지 않습니다.`. Use shared manager/search/toolbar/pagination modules and register exact metadata and toolbar in `config/grid-screens.json`.

```ts
type OrgMappingAssignmentUploadRow = { department_code: string; type_code: string; item_code: string; effective_from: string; effective_to: string | null };
const preview = await fetch("/api/org/mapping-assignments/upload-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "atomic", rows }) });
```

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-assignments/upload-template/route.ts src/app/api/org/mapping-assignments/upload-preview/route.ts src/app/api/org/mapping-assignments/upload-confirm/route.ts src/app/org/type-upload/page.tsx src/components/org/org-mapping-upload-manager.tsx src/types/organization.ts; npx playwright test tests/e2e/org-type-upload.spec.ts --workers=1; git diff --check`

Expected: Grid/lint pass; E2E proves preview error, disabled confirmation, error download, Korean screenshot.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/app/api/org/mapping-assignments/upload-template/route.ts frontend/src/app/api/org/mapping-assignments/upload-preview/route.ts frontend/src/app/api/org/mapping-assignments/upload-confirm/route.ts frontend/src/app/org/type-upload/page.tsx frontend/src/components/org/org-mapping-upload-manager.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-type-upload.spec.ts; git commit -m "feat: add organization mapping upload screen"`

### Task 8: Sol review, ORG aggregate evidence, and handoff

**Files:** Modify only concrete review-defect files from Tasks 1–7; create ignored evidence `.superpowers/sdd/org-implementation-review.md`.

**Interfaces:** consumes every prior API path and fixture; produces Sol pass/fail review for rollback, permission boundaries, BFF parity, registry, atomic upload, and Korean browser evidence.

- [ ] **Step 1: Write a protective regression test**

```python
def test_hierarchy_type_is_never_changed_by_mapping_workflow() -> None:
    department.organization_type = "HEADQUARTERS"
    run_mapping_item_assignment_and_upload_workflow(session)
    assert session.get(OrgDepartment, department.id).organization_type == "HEADQUARTERS"
```

- [ ] **Step 2: Run test to prove the guard**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py -q`

Expected: the test detects any mapping write that touches hierarchy metadata.

- [ ] **Step 3: Apply only Sol-identified minimal corrections**

Review checks: `down_revision` and reversible constraint names; no data migration; direct backend 403 checks; BFF/backend path parity; chart/status no-write boundary; assignment overlap key; preview/confirm revalidation and rollback; five registry entries; Korean screenshots.

- [ ] **Step 4: Run final ORG-focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_service_unit.py tests/test_org_mapping_routes_unit.py tests/test_org_mapping_upload_service_unit.py tests/test_organization_service_unit.py tests/test_menu_action_permission_unit.py -q; cd ../../frontend; npm run validate:grid; npx tsc --noEmit; npm run build; npx playwright test tests/e2e/org-chart.spec.ts tests/e2e/org-type-items.spec.ts tests/e2e/org-types.spec.ts tests/e2e/org-type-personal-status.spec.ts tests/e2e/org-type-upload.spec.ts --workers=1; git diff --check`

Expected: named ORG tests pass; final typecheck and build run once; five focused routes pass; no whitespace error.

- [ ] **Step 5: Commit review corrections only when present**

Run: `git add backend/app/models/entities.py backend/app/models/__init__.py backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/app/bootstrap.py backend/migrations/versions/org_mapping_foundation_20260722_add_mapping_tables.py backend/tests/test_org_mapping_service_unit.py backend/tests/test_org_mapping_routes_unit.py backend/tests/test_org_mapping_upload_service_unit.py backend/tests/test_menu_action_permission_unit.py frontend/src/app/org/chart/page.tsx frontend/src/app/org/type-items/page.tsx frontend/src/app/org/types/page.tsx frontend/src/app/org/type-personal-status/page.tsx frontend/src/app/org/type-upload/page.tsx frontend/src/components/org frontend/src/lib/org frontend/src/app/api/org frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-chart.spec.ts frontend/tests/e2e/org-type-items.spec.ts frontend/tests/e2e/org-types.spec.ts frontend/tests/e2e/org-type-personal-status.spec.ts frontend/tests/e2e/org-type-upload.spec.ts; git commit -m "fix: address organization mapping review"`

## Self-Review

**Spec coverage:** Task 1 covers chart v1. Task 2 covers isolated R3 schema, migration upgrade/downgrade, permission seed, type source, and preservation. Tasks 3–4 cover item then assignment contracts and screens. Task 5 covers active-person dynamic status. Tasks 6–7 cover template/preview/error workbook/all-or-nothing confirm. Task 8 covers Sol review and final focused checks.

**Placeholder scan:** The specified scan finds zero matches in this plan.

**Type consistency:** `type_code`, `item_id`, `department_id`, `effective_from`, and `effective_to` retain the same names through model, schema, service, route, BFF, and TypeScript types. `organization_type` remains only the existing department hierarchy field.

## Completion Evidence

Sol signs off only after output proves migration upgrade/downgrade preserves legacy department data; unauthorized direct API calls are 403; period conflicts are 409 or upload 422; one invalid upload row writes no assignment; chart/status emit no writes; all five Korean routes render; and new Grid entries pass `validate:grid`.
