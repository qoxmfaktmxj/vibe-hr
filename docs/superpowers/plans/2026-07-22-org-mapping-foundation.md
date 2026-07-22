# Organization Mapping Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/org/chart`을 독립 권한의 읽기 전용 조직도로 구현하고, 기간형 조직구분 항목과 부서 다대다 배정으로 `/org/type-items`, `/org/types`, `/org/type-personal-status`, `/org/type-upload`을 순서대로 제공한다.

**Architecture:** 기존 `OrgDepartment.organization_type`은 `HEADQUARTERS`/`TEAM` 계층 유형으로 보존한다. 신규 mapping은 `org_mapping_type_items`와 `org_mapping_assignments`로 분리하며, PostgreSQL 폐구간 날짜 exclusion constraint와 서비스 validation을 함께 적용한다. chart는 departments API를 재사용하지 않고 `/org/chart` 권한을 검사하는 별도 read API/BFF를 쓴다.

**Tech Stack:** FastAPI, SQLModel, Alembic, PostgreSQL, Next.js 16, React 19, TypeScript, AG Grid 35, SWR, XLSX, pytest, Vitest, Playwright.

## Global Constraints

- R3 schema/migration/API/permission 명시 승인 범위다. 구현은 Terra, task 및 final review는 Sol이 수행한다.
- `OrgDepartment.organization_type`과 `OrgRestructurePlanItem.new_organization_type`을 mapping 데이터로 읽거나 쓰거나 자동 이관하지 않는다.
- 전체 순서는 chart → backend domain → type-items → types → personal-status → upload다.
- 새 AG Grid 화면은 `ManagerPageShell`, `ManagerSearchSection`, `ManagerGridSection`, `GridToolbarActions`, `GridPaginationControls`, `useGridPagination`, `useMenuActions`, `buildGridRowClassRules`, `getGridRowClass`, `reconcileUpdatedStatus`를 사용한다. VibeGrid는 사용하지 않는다.
- canonical toolbar subset은 type-items/types `query/create/copy/save/download`, personal-status `query/download`, upload `query/template/upload/download`이다. Grid registry에는 네 신규 화면을 등록하고 `/org/departments` 회귀를 확인한다.
- 기간은 닫힌 구간 `[effective_from, effective_to]`; `effective_to >= effective_from`; 동일 일자 경계는 충돌, 다음 날 시작은 허용, null 종료일은 open-ended다.
- item `(id,type_code)`는 composite unique이고 assignment의 `(item_id,type_code)`는 그 composite FK를 참조한다. assignment 기간은 참조 item 기간에 완전히 포함해야 한다.
- upload는 `mode: "atomic"`만 받는다. backend binary dependency를 추가하지 않으며 template API는 JSON headers를 반환하고 frontend가 이미 설치된 `xlsx`로 workbook을 만든다.
- status는 기준일 `hire_date <= reference_date`인 직원의 `HrPersonnelHistory`를 reference-date 이후부터 역순으로 되돌린 snapshot이 정확히 `active`인 행만 노출한다.
- VibeGrid 제거는 base `a440a211673a179b00dab399cd3dffffb7d8dcb0` 선행조건이며 이 계획 범위에서 수정하지 않는다.
- 검증은 changed-area focused test와 `git diff --check`만 task별 실행한다. 각 Grid task는 `npm run validate:grid`, frontend는 changed-file ESLint; `npx tsc --noEmit`은 interface checkpoint와 final, `npm run build`는 final 한 번만 실행한다.

## Cross-layer Contracts

| Contract | Exact value |
| --- | --- |
| Chart backend/BFF | `GET /api/v1/org/chart` ↔ `GET /api/org/chart`, both guarded by menu path `/org/chart`, action `query` |
| Type-item source | `GET /api/v1/org/mapping-types` ↔ `GET /api/org/mapping-types`, guarded by `/org/type-items`, `query` |
| Type lookups | `GET /api/v1/org/mapping-type-options`, `/mapping-item-options?type_code=COST`, `/department-options`; all guarded by `/org/types`, `query` |
| Item CRUD | `/api/v1/org/mapping-type-items` and `/api/org/mapping-type-items`; list uses `page,limit,type_code,reference_date`, write path `/org/type-items` action `save` |
| Assignment CRUD | `/api/v1/org/mapping-assignments` and `/api/org/mapping-assignments`; list uses `page,limit,department_id,type_code,reference_date`, write path `/org/types` action `save` |
| Personal status | `/api/v1/org/mapping-personal-status` ↔ `/api/org/mapping-personal-status`, path `/org/type-personal-status`, action `query` |
| Upload JSON | `GET /mapping-assignments/upload-template` → `{headers:["조직코드","유형코드","항목코드","시작일","종료일"]}`; `POST /upload-preview`, `POST /upload-confirm` ↔ same BFF paths, path `/org/type-upload` |

### Task 1: Chart API/BFF and chart-only permission boundary

**Files:** Create `frontend/src/app/api/org/chart/route.ts`, `frontend/src/lib/org/org-chart-bff-route.test.ts`, `backend/tests/test_org_chart_routes_unit.py`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_service.py`, `backend/app/api/organization.py`, `backend/tests/test_menu_action_permission_unit.py`.

**Interfaces:** produces `organization_chart(session: Session, current_user: AuthUser) -> OrganizationChartResponse`; `GET /api/v1/org/chart` returns `{departments: OrganizationDepartmentItem[], total_count: int}`. The BFF forwards JSON success/error and returns `new NextResponse(null,{status:204})` only for a 204 upstream response.

- [ ] **Step 1: Write failing permission and contract tests**

```python
def test_chart_uses_chart_query_permission_not_departments_permission() -> None:
    user = seed_permissions(session, path="/org/chart", allow_query=False)
    with pytest.raises(HTTPException, match="Action not allowed"):
        organization_chart(session=session, current_user=user)

def test_chart_returns_all_departments_without_department_menu_fallback() -> None:
    user = seed_permissions(session, path="/org/chart", allow_query=True)
    assert organization_chart(session=session, current_user=user).total_count == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_chart_routes_unit.py tests/test_menu_action_permission_unit.py -q`

Expected: FAIL because `/org/chart` backend handler and BFF do not exist.

- [ ] **Step 3: Write minimal implementation**

```python
@router.get("/chart", response_model=OrganizationChartResponse)
def organization_chart(session: Session = Depends(get_session), current_user: AuthUser = Depends(get_current_user)) -> OrganizationChartResponse:
    require_menu_action_for_user(session, user_id=current_user.id, path="/org/chart", action_code="query")
    departments, total_count = list_departments(session)
    return OrganizationChartResponse(departments=departments, total_count=total_count)
```

`frontend/src/app/api/org/chart/route.ts` follows the existing departments proxy token pattern, targets `/api/v1/org/chart`, parses JSON for non-204 results, and preserves upstream status. It must not call `/api/org/departments`.

`org-chart-bff-route.test.ts` stubs upstream fetch and asserts missing cookie 401 JSON plus upstream 200 and 403 JSON body/status propagation.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_chart_routes_unit.py tests/test_menu_action_permission_unit.py -q; cd ../../frontend; npx vitest run src/lib/org/org-chart-bff-route.test.ts; npx eslint src/app/api/org/chart/route.ts; git diff --check`

Expected: chart 403/200 tests and BFF lint pass with no whitespace errors.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_service.py backend/app/api/organization.py backend/tests/test_org_chart_routes_unit.py backend/tests/test_menu_action_permission_unit.py frontend/src/app/api/org/chart/route.ts frontend/src/lib/org/org-chart-bff-route.test.ts; git commit -m "feat: add protected organization chart api"`

### Task 2: Chart tree UI, algorithm, and Korean E2E

**Files:** Create `frontend/src/lib/org/org-chart-tree.ts`, `frontend/src/lib/org/org-chart-tree.test.ts`, `frontend/src/components/org/org-chart-manager.tsx`, `frontend/tests/e2e/org-chart.spec.ts`; modify `frontend/src/app/org/chart/page.tsx`, `frontend/src/types/organization.ts`.

**Interfaces:** consumes `GET /api/org/chart`; produces `buildOrgChartForest(departments: OrganizationDepartmentItem[]): OrgChartNode[]`, where `OrgChartNode = { department: OrganizationDepartmentItem; children: OrgChartNode[] }`.

- [ ] **Step 1: Write failing algorithm and route tests**

```ts
it.each([
  ["duplicate", [dept(1, null), dept(1, null)], [1]],
  ["self", [dept(1, 1)], [1]],
  ["orphan", [dept(1, 99)], [1]],
  ["cycle", [dept(1, 2), dept(2, 1)], [1, 2]],
])("keeps each %s node visible once", (_name, rows, expectedRoots) => {
  expect(buildOrgChartForest(rows).map((node) => node.department.id)).toEqual(expectedRoots);
});
test("chart saves Korean screenshot", async ({ page }) => {
  await page.goto("/org/chart");
  await expect(page.getByText("조직도관리")).toBeVisible();
  await expect(page.getByRole("link", { name: "조직코드관리에서 편집" })).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-chart-ko.png", fullPage: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/lib/org/org-chart-tree.test.ts; npx playwright test tests/e2e/org-chart.spec.ts --workers=1`

Expected: FAIL because tree module and UI are absent.

- [ ] **Step 3: Write cycle-safe forest and read-only UI**

```ts
export function buildOrgChartForest(rows: OrganizationDepartmentItem[]): OrgChartNode[] {
  const unique = new Map<number, OrganizationDepartmentItem>();
  for (const row of rows) if (!unique.has(row.id)) unique.set(row.id, row);
  const nodes = new Map([...unique].map(([id, department]) => [id, { department, children: [] }]));
  const roots: OrgChartNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.department.parent_id === null ? undefined : nodes.get(node.department.parent_id);
    if (!parent || parent === node || reaches(node.department.id, parent.department.id, nodes)) roots.push(node);
    else parent.children.push(node);
  }
  return roots.sort(byDepartmentCode);
}
```

`reaches(startId,candidateId,nodes)` walks parent ids with a visited set and returns true when it reaches `startId`. `OrgChartManager` fetches only `/api/org/chart`, supports search and expand/collapse, shows status/type/cost-center/headcount, shows explicit empty/error UI, and contains no write fetch. Page still calls `requireMenuAccess("/org/chart")`.

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npx vitest run src/lib/org/org-chart-tree.test.ts; npx eslint src/lib/org/org-chart-tree.ts src/lib/org/org-chart-tree.test.ts src/components/org/org-chart-manager.tsx src/app/org/chart/page.tsx; npx playwright test tests/e2e/org-chart.spec.ts --workers=1; git diff --check`

Expected: duplicate/self/orphan/cycle tests, Korean assertions, fixed screenshot path, and lint pass.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/lib/org/org-chart-tree.ts frontend/src/lib/org/org-chart-tree.test.ts frontend/src/components/org/org-chart-manager.tsx frontend/src/app/org/chart/page.tsx frontend/src/types/organization.ts frontend/tests/e2e/org-chart.spec.ts; git commit -m "feat: add read-only organization chart"`

### Task 3: Mapping models and exact reversible migration

**Files:** Create `backend/migrations/versions/org_mapping_foundation_20260722_add_mapping_tables.py`, `backend/tests/test_org_mapping_migration_contract.py`; modify `backend/app/models/entities.py`, `backend/app/models/__init__.py`.

**Interfaces:** produces SQLModel `OrgMappingTypeItem` and `OrgMappingAssignment`; migration revision `org_mapping_foundation_20260722`, `down_revision = "ea501237b804"`, exactly one Alembic head.

- [ ] **Step 1: Write failing migration-contract tests**

```python
def test_mapping_metadata_has_composite_item_key_and_assignment_fk() -> None:
    assert ["id"] == list(OrgMappingTypeItem.__table__.primary_key.columns.keys())
    assert "uq_org_mapping_type_items_id_type" in constraint_names(OrgMappingTypeItem.__table__)
    assert "fk_org_mapping_assignments_item_type" in foreign_key_names(OrgMappingAssignment.__table__)
def test_mapping_period_date_order_and_indexes_are_declared() -> None:
    assert "ck_org_mapping_type_items_date_order" in constraint_names(OrgMappingTypeItem.__table__)
    assert "ix_org_mapping_assignments_item_id" in index_names(OrgMappingAssignment.__table__)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_migration_contract.py -q`

Expected: FAIL because models and migration are absent.

- [ ] **Step 3: Write exact model and DDL**

```python
class OrgMappingTypeItem(SQLModel, table=True):
    __tablename__ = "org_mapping_type_items"
    __table_args__ = (
        UniqueConstraint("id", "type_code", name="uq_org_mapping_type_items_id_type"),
        CheckConstraint("effective_to IS NULL OR effective_to >= effective_from", name="ck_org_mapping_type_items_date_order"),
        Index("ix_org_mapping_type_items_type_item_from", "type_code", "item_code", "effective_from"),
    )
    id: int | None = Field(default=None, sa_column=Column(sa.Integer, primary_key=True, autoincrement=True, nullable=False))
    type_code: str = Field(sa_column=Column(sa.String(50), nullable=False))
    item_code: str = Field(sa_column=Column(sa.String(50), nullable=False))
    name: str = Field(sa_column=Column(sa.String(100), nullable=False))
    effective_from: date = Field(sa_column=Column(sa.Date, nullable=False))
    effective_to: date | None = Field(default=None, sa_column=Column(sa.Date, nullable=True))
```

Add nullable `erp_employee_code VARCHAR(50)`, `cost_center_type VARCHAR(50)`, `remark VARCHAR(500)`, nullable `created_by/updated_by INTEGER` FKs `fk_org_mapping_type_items_created_by/updated_by` with `ON DELETE SET NULL`; non-null `sort_order INTEGER DEFAULT 0`, `is_active BOOLEAN DEFAULT true`, `created_at/updated_at TIMESTAMPTZ DEFAULT now()`. Assignment has single autoincrement primary key `id INTEGER`, non-null `department_id INTEGER`, `type_code VARCHAR(50)`, `item_id INTEGER`, `effective_from DATE`, nullable `effective_to DATE`, same nullable audit FKs and timestamp fields; department FK `fk_org_mapping_assignments_department` uses `ON DELETE RESTRICT`, composite item FK `fk_org_mapping_assignments_item_type(item_id,type_code)` uses `ON DELETE RESTRICT`, check `ck_org_mapping_assignments_date_order`, indexes `ix_org_mapping_assignments_department_type_from(department_id,type_code,effective_from)` and `ix_org_mapping_assignments_item_id(item_id)`.

Migration creates `btree_gist` if absent, then tables/FKs/checks/indexes, `ex_org_mapping_type_items_period` on `(type_code WITH =, item_code WITH =, daterange(effective_from,coalesce(effective_to,'infinity'::date),'[]') WITH &&)`, and `ex_org_mapping_assignments_period` on `(department_id WITH =, type_code WITH =, daterange(effective_from,coalesce(effective_to,'infinity'::date),'[]') WITH &&)`. Downgrade reverses exactly: exclusions, indexes, FKs/checks/tables; leaves shared `btree_gist` installed. It never modifies `org_departments` data or hierarchy fields.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_migration_contract.py -q; ./.venv/Scripts/python.exe -m alembic heads; ./.venv/Scripts/python.exe -m alembic upgrade head; ./.venv/Scripts/python.exe -m alembic downgrade -1; ./.venv/Scripts/python.exe -m alembic upgrade head; ./.venv/Scripts/python.exe -m alembic check; git diff --check`

Expected: one `org_mapping_foundation_20260722 (head)` line, upgrade/downgrade/upgrade pass, no drift, preserved legacy `organization_type`.

- [ ] **Step 5: Commit**

Run: `git add backend/app/models/entities.py backend/app/models/__init__.py backend/migrations/versions/org_mapping_foundation_20260722_add_mapping_tables.py backend/tests/test_org_mapping_migration_contract.py; git commit -m "feat: add organization mapping schema"`

### Task 4: Mapping type source, menu defaults, and protected type lookups

**Files:** Create `backend/tests/test_org_mapping_lookup_routes_unit.py`; modify `backend/app/bootstrap.py`, `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`, `backend/tests/test_menu_action_permission_unit.py`.

**Interfaces:** produces `GET /api/v1/org/mapping-types` guarded by `/org/type-items/query`, plus `GET /api/v1/org/mapping-type-options`, `/mapping-item-options?type_code=COST`, `/department-options`, all guarded by `/org/types/query`; every route returns `{items:[...]}`.

- [ ] **Step 1: Write failing lookup authorization tests**

```python
@pytest.mark.parametrize("handler,kwargs", [(mapping_type_options, {}), (mapping_item_options, {"type_code": "COST"}), (department_options, {})])
def test_types_lookup_denies_without_types_query(handler, kwargs) -> None:
    user = seed_permissions(session, path="/org/types", allow_query=False)
    with pytest.raises(HTTPException, match="Action not allowed"):
        handler(session=session, current_user=user, **kwargs)

def test_mapping_types_requires_type_items_query_and_returns_200_when_allowed() -> None:
    denied = seed_permissions(session, path="/org/type-items", allow_query=False)
    with pytest.raises(HTTPException, match="Action not allowed"): mapping_types(session=session, current_user=denied)
    allowed = seed_permissions(session, path="/org/type-items", allow_query=True)
    assert mapping_types(session=session, current_user=allowed).items == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_lookup_routes_unit.py tests/test_menu_action_permission_unit.py -q`

Expected: FAIL because protected lookup routes are absent.

- [ ] **Step 3: Write minimal source and lookup implementation**

Seed group `ORG_MAPPING_TYPE` only; do not seed item values or read `/settings/common-codes`. `mapping_types` reads active `AppCode` rows in this group after `/org/type-items/query`. Seed existing menu defaults: chart query; type-items query/create/copy/save/download; types query/create/copy/save/download; status query/download; upload query/template_download/upload/download. Types lookup handlers return type codes, active type-filtered items, and active departments after `/org/types/query`; no shared lookup route accepts a caller-selected menu path.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_lookup_routes_unit.py tests/test_menu_action_permission_unit.py -q; git diff --check`

Expected: mapping-types returns 403/200 through `/org/type-items/query`; all three types lookups return 403/200 through `/org/types/query`, including `mapping-item-options?type_code=COST`.

- [ ] **Step 5: Commit**

Run: `git add backend/app/bootstrap.py backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_lookup_routes_unit.py backend/tests/test_menu_action_permission_unit.py; git commit -m "feat: add protected organization mapping lookups"`

### Task 5: Mapping item service and API

**Files:** Create `backend/tests/test_org_mapping_item_service_unit.py`, `backend/tests/test_org_mapping_item_routes_unit.py`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`.

**Interfaces:** `OrgMappingTypeItemCreateRequest(type_code,item_code,name,effective_from,effective_to,erp_employee_code,cost_center_type,sort_order,remark,is_active)`; `GET /api/v1/org/mapping-type-items?page&limit&type_code&reference_date` → `{items,total_count,page,limit}`; `GET /api/v1/org/mapping-types` → `{items:[{code,name}]}`; `POST`, `PUT`, `DELETE /{item_id}` on `/org/type-items` with query/save permissions.

- [ ] **Step 1: Write failing period/mutation tests**

```python
def test_item_period_closed_interval_boundaries_and_update_self_exclusion() -> None:
    first = create_mapping_item(session, item("COST", "A", date(2026, 1, 1), date(2026, 1, 31)))
    with pytest.raises(HTTPException, match="overlaps"): create_mapping_item(session, item("COST", "A", date(2026, 1, 31), date(2026, 2, 1)))
    create_mapping_item(session, item("COST", "A", date(2026, 2, 1), None))
    assert update_mapping_item(session, first.id, first.type_code, patch(name="A2")).name == "A2"
def test_referenced_item_cannot_change_code_type_shrink_period_or_deactivate() -> None:
    referenced = assigned_item(session)
    for request in [patch(item_code="B"), patch(type_code="REGION"), patch(effective_to=date(2026, 6, 30)), patch(is_active=False)]:
        with pytest.raises(HTTPException, match="referenced"): update_mapping_item(session, referenced.id, referenced.type_code, request)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_item_service_unit.py tests/test_org_mapping_item_routes_unit.py -q`

Expected: FAIL because item service/API is absent.

- [ ] **Step 3: Write minimal period and reference policy**

`validate_closed_period(start,end)` returns 422 when end precedes start. `ensure_no_item_overlap(session,type_code,item_code,start,end,exclude_id)` uses half-open query comparison converted for closed ranges: existing start `<= end-or-infinity` and existing end-or-infinity `>= start`; `exclude_id` is used only for update. Catch PostgreSQL `IntegrityError` from exclusion `flush()`, call `session.rollback()`, and raise HTTP 409.

Referenced items are immutable for `type_code` and `item_code`; period update is rejected if any existing assignment no longer fits completely; `is_active=False` is rejected while any assignment exists; delete is rejected while any assignment exists. Item name, ERP code, CC type, sort, remark and a non-breaking end-date extension remain editable. All direct handlers use `/org/type-items/query` or `/org/type-items/save` before service invocation.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_item_service_unit.py tests/test_org_mapping_item_routes_unit.py -q; git diff --check`

Expected: same-day conflict, next-day success, open-ended conflict, update-self success, immutability, 409-after-rollback, and direct 403 tests pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_item_service_unit.py backend/tests/test_org_mapping_item_routes_unit.py; git commit -m "feat: add organization mapping item api"`

### Task 6: `/org/type-items` BFF and AG Grid

**Files:** Create `frontend/src/app/api/org/mapping-types/route.ts`, `frontend/src/app/api/org/mapping-type-items/route.ts`, `frontend/src/app/api/org/mapping-type-items/[itemId]/route.ts`, `frontend/src/components/org/org-mapping-type-item-manager.tsx`, `frontend/tests/e2e/org-type-items.spec.ts`, `frontend/src/lib/org/org-bff-route-contract.test.ts`; modify `frontend/src/app/org/type-items/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`.

**Interfaces:** all BFF success/error responses are JSON; DELETE returns `new NextResponse(null,{status:204})` when upstream is 204. `OrgMappingTypeItem` TypeScript fields exactly match Task 5 response. Registry `org.type-items` toolbar is `query/create/copy/save/download`.

- [ ] **Step 1: Write failing BFF and E2E tests**

```ts
test("type-items uses the supported toolbar subset", async ({ page }) => {
  await page.goto("/org/type-items");
  await expect(page.getByRole("button", { name: "조회" })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "양식 다운로드" })).toHaveCount(0);
  await page.screenshot({ path: "output/playwright/org-type-items-ko.png", fullPage: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx playwright test tests/e2e/org-type-items.spec.ts --workers=1`

Expected: FAIL because placeholder page and BFF routes remain.

- [ ] **Step 3: Write minimal BFF/UI implementation**

`mapping-types/route.ts` targets `/api/v1/org/mapping-types`; the item BFF routes target `/api/v1/org/mapping-type-items`. Each BFF duplicates the existing departments token proxy shape; no generic helper is introduced. `GET/POST/PUT` parses JSON success/error; `DELETE` branches 204 before JSON parsing. Page declares `GRID_SCREEN` engine `ag-grid`, profile `standard-v2`, registryKey `org.type-items`. Manager uses every Global Constraints Grid module, status row fields `_status/_original/_prevStatus`, and columns 유형코드/항목코드/명칭/시작일/종료일/ERP 사원코드/CC유형/정렬/비고/사용여부.

`org-bff-route-contract.test.ts` stubs upstream `fetch` and asserts absent cookie → 401 JSON, upstream 200/422 JSON body/status propagation, and upstream 204 → empty `NextResponse`; add every BFF route module to this contract table.

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-types/route.ts src/app/api/org/mapping-type-items/route.ts src/app/api/org/mapping-type-items/[itemId]/route.ts src/app/org/type-items/page.tsx src/components/org/org-mapping-type-item-manager.tsx src/types/organization.ts; npx vitest run src/lib/org/org-bff-route-contract.test.ts; npx tsc --noEmit; npx playwright test tests/e2e/org-type-items.spec.ts --workers=1; git diff --check`

Expected: registry, BFF JSON/204 behavior, interface checkpoint, canonical toolbar, and Korean screenshot pass.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/app/api/org/mapping-types/route.ts frontend/src/app/api/org/mapping-type-items/route.ts frontend/src/app/api/org/mapping-type-items/[itemId]/route.ts frontend/src/components/org/org-mapping-type-item-manager.tsx frontend/src/app/org/type-items/page.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-type-items.spec.ts frontend/src/lib/org/org-bff-route-contract.test.ts; git commit -m "feat: add organization mapping item screen"`

### Task 7: Assignment service and API

**Files:** Create `backend/tests/test_org_mapping_assignment_service_unit.py`, `backend/tests/test_org_mapping_assignment_routes_unit.py`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`.

**Interfaces:** `OrgMappingAssignmentCreateRequest(department_id,type_code,item_id,effective_from,effective_to)`; list `GET /api/v1/org/mapping-assignments?page&limit&department_id&type_code&reference_date` → `{items:OrgMappingAssignmentItem[],total_count,page,limit}`; write path `/org/types` action `save`.

- [ ] **Step 1: Write failing assignment tests**

```python
def test_assignment_closed_period_rules_and_item_containment() -> None:
    create_assignment(session, dept.id, "COST", item.id, date(2026, 1, 1), date(2026, 1, 31))
    with pytest.raises(HTTPException, match="overlaps"): create_assignment(session, dept.id, "COST", other.id, date(2026, 1, 31), date(2026, 2, 1))
    create_assignment(session, dept.id, "COST", next_item.id, date(2026, 2, 1), None)
    with pytest.raises(HTTPException, match="item period"): create_assignment(session, dept.id, "COST", limited.id, date(2025, 12, 31), date(2026, 1, 1))
def test_assignment_update_excludes_self_and_allows_other_type() -> None:
    assignment = assigned(session, "COST")
    assert update_assignment(session, assignment.id, patch(effective_to=assignment.effective_to)).id == assignment.id
    assert create_assignment(session, dept.id, "REGION", region.id, date(2026, 1, 1), None).type_code == "REGION"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_assignment_service_unit.py tests/test_org_mapping_assignment_routes_unit.py -q`

Expected: FAIL because assignment service/API is absent.

- [ ] **Step 3: Write minimal assignment implementation**

Validate department exists, `item.id/type_code` composite match exists, date order, item active, and `item.effective_from <= assignment.effective_from` plus `(item.effective_to is None or assignment.effective_to is not None and assignment.effective_to <= item.effective_to)`. An open-ended assignment requires an open-ended item. `ensure_no_assignment_overlap(...,exclude_id)` follows Task 5 closed-period logic; exclusion `IntegrityError` requires rollback then 409. Direct list/create/update/delete handlers call `/org/types/query` or `/org/types/save` before service work.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_assignment_service_unit.py tests/test_org_mapping_assignment_routes_unit.py -q; git diff --check`

Expected: inclusive boundaries, next-day, open-ended, containment, update self-exclusion, other-type multi-assignment, 403, and rollback 409 pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_assignment_service_unit.py backend/tests/test_org_mapping_assignment_routes_unit.py; git commit -m "feat: add organization mapping assignment api"`

### Task 8: `/org/types` BFF, protected lookups, and AG Grid

**Files:** Create `frontend/src/app/api/org/mapping-type-options/route.ts`, `frontend/src/app/api/org/mapping-item-options/route.ts`, `frontend/src/app/api/org/department-options/route.ts`, `frontend/src/app/api/org/mapping-assignments/route.ts`, `frontend/src/app/api/org/mapping-assignments/[assignmentId]/route.ts`, `frontend/src/components/org/org-mapping-assignment-manager.tsx`, `frontend/tests/e2e/org-types.spec.ts`; modify `frontend/src/app/org/types/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`, `frontend/src/lib/org/org-bff-route-contract.test.ts`.

**Interfaces:** every lookup BFF maps only to the Task 4 protected endpoint; assignment BFF preserves JSON/204 semantics from Task 6. Registry `org.types` uses toolbar `query/create/copy/save/download`.

- [ ] **Step 1: Write failing types screen test**

```ts
test("types uses protected option sources and canonical toolbar", async ({ page }) => {
  await page.goto("/org/types");
  await expect(page.getByText("조직구분")).toBeVisible();
  await expect(page.locator(".ag-root")).toBeVisible();
  await expect(page.getByRole("button", { name: "업로드" })).toHaveCount(0);
  await page.screenshot({ path: "output/playwright/org-types-ko.png", fullPage: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx playwright test tests/e2e/org-types.spec.ts --workers=1`

Expected: FAIL because placeholder page and BFF routes remain.

- [ ] **Step 3: Write minimal protected lookup and Grid implementation**

Implement five explicit BFF proxy files; do not make a generic `/api/org/[...path]` proxy. Manager fetches only `mapping-type-options`, `mapping-item-options`, `department-options`, and assignments BFF paths. It passes selected `type_code` when loading items, uses every standard Grid module listed globally, and owns `_status/_original/_prevStatus` state. Columns are department code/name, type code, item code/name, start date, end date; all item selections are constrained by selected type.

Extend `org-bff-route-contract.test.ts` with all five route modules and the same 401, JSON 200/422, and DELETE 204 assertions.

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-type-options/route.ts src/app/api/org/mapping-item-options/route.ts src/app/api/org/department-options/route.ts src/app/api/org/mapping-assignments/route.ts src/app/api/org/mapping-assignments/[assignmentId]/route.ts src/app/org/types/page.tsx src/components/org/org-mapping-assignment-manager.tsx src/types/organization.ts; npx vitest run src/lib/org/org-bff-route-contract.test.ts; npx playwright test tests/e2e/org-types.spec.ts tests/e2e/org-chart.spec.ts --workers=1; git diff --check`

Expected: registry and lint pass; types and existing chart Korean screenshots pass.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/app/api/org/mapping-type-options/route.ts frontend/src/app/api/org/mapping-item-options/route.ts frontend/src/app/api/org/department-options/route.ts frontend/src/app/api/org/mapping-assignments/route.ts frontend/src/app/api/org/mapping-assignments/[assignmentId]/route.ts frontend/src/components/org/org-mapping-assignment-manager.tsx frontend/src/app/org/types/page.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-types.spec.ts; git commit -m "feat: add organization mapping assignment screen"`

### Task 9: Personal-status reference-date projection API

**Files:** Create `backend/tests/test_org_mapping_personal_status_service_unit.py`, `backend/tests/test_org_mapping_personal_status_routes_unit.py`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`.

**Interfaces:** `GET /api/v1/org/mapping-personal-status?reference_date&page&limit` → `{items:OrgMappingPersonalStatusRow[],type_columns:[{type_code,name}],total_count,page,limit}` protected by `/org/type-personal-status/query`.

- [ ] **Step 1: Write failing reference-date and pagination tests**

```python
def test_status_rewinds_future_personnel_history_and_filters_active_snapshot() -> None:
    # employee is active now, but a history at 2026-08-01 moves it to leave and department 20
    response = list_mapping_personal_status(session, reference_date=date(2026, 7, 31), page=1, limit=100)
    assert response.items[0].department_id == 10
    assert response.items[0].employee_no == "E-001"
def test_status_excludes_hired_after_reference_and_pages_distinct_employee_ids() -> None:
    response = list_mapping_personal_status(session, reference_date=date(2026, 7, 31), page=1, limit=1)
    assert response.total_count == 2
    assert len(response.items) == 1
    assert len({row.employee_id for row in response.items}) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_personal_status_service_unit.py tests/test_org_mapping_personal_status_routes_unit.py -q`

Expected: FAIL because reference-date projection is absent.

- [ ] **Step 3: Write minimal snapshot/pivot algorithm**

```python
def snapshot_employee_at_reference(employee: HrEmployee, histories: list[HrPersonnelHistory], reference_date: date) -> EmployeeSnapshot:
    state = EmployeeSnapshot(department_id=employee.department_id, employment_status=employee.employment_status)
    for history in sorted((h for h in histories if h.effective_date > reference_date), key=lambda h: h.effective_date, reverse=True):
        if history.field_name == "department_id" and history.before_value is not None: state.department_id = int(history.before_value)
        if history.field_name == "employment_status" and history.before_value is not None: state.employment_status = history.before_value
    return state
```

First select/count distinct `HrEmployee.id` where `hire_date <= reference_date`; paginate those IDs before joining mapping rows. For each candidate, load future histories descending, build the snapshot, retain exactly `employment_status == "active"`, then pivot mapping cells by type. Recompute enough candidate IDs to fill a page after status filtering and keep `total_count` as the distinct active-snapshot employee count; do not count join rows. Mapping type columns include every active mapping type, and absent cells are `{item_code:"",item_name:""}`.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_personal_status_service_unit.py tests/test_org_mapping_personal_status_routes_unit.py -q; git diff --check`

Expected: hire-date, future-history rewind, active-only snapshot, distinct page/count, dynamic pivot, and 403 tests pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_personal_status_service_unit.py backend/tests/test_org_mapping_personal_status_routes_unit.py; git commit -m "feat: add organization mapping personal status api"`

### Task 10: `/org/type-personal-status` BFF and read-only AG Grid

**Files:** Create `frontend/src/app/api/org/mapping-personal-status/route.ts`, `frontend/src/components/org/org-mapping-personal-status-manager.tsx`, `frontend/tests/e2e/org-type-personal-status.spec.ts`; modify `frontend/src/app/org/type-personal-status/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`, `frontend/src/lib/org/org-bff-route-contract.test.ts`.

**Interfaces:** `OrgMappingPersonalStatusRow` fields are `employee_id,employee_no,display_name,department_id,department_code,department_name,position_title,mappings:Record<string,{item_code,item_name}>`; registry key `org.type-personal-status`, toolbar `query/download`.

- [ ] **Step 1: Write failing read-only E2E**

```ts
test("personal status shows Korean dynamic columns without write controls", async ({ page }) => {
  await page.goto("/org/type-personal-status");
  await expect(page.getByText("조직구분개인별현황")).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toHaveCount(0);
  await expect(page.locator(".ag-root")).toBeVisible();
  await page.screenshot({ path: "output/playwright/org-type-personal-status-ko.png", fullPage: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx playwright test tests/e2e/org-type-personal-status.spec.ts --workers=1`

Expected: FAIL because placeholder page is present.

- [ ] **Step 3: Write minimal BFF/read-only Grid**

Implement the explicit JSON BFF with token forwarding and non-JSON 204 branch. Declare standard-v2 `GRID_SCREEN`; use all global Grid modules, but set every fixed and dynamic `ColDef` to `editable:false`, render only query/download, and never create a POST/PUT/DELETE BFF route. Build dynamic columns from `type_columns` with `valueGetter: params => params.data.mappings[type_code]?.item_name ?? ""`.

Extend the BFF contract test with this GET module's 401 and JSON 200/403 propagation assertions.

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-personal-status/route.ts src/app/org/type-personal-status/page.tsx src/components/org/org-mapping-personal-status-manager.tsx src/types/organization.ts; npx vitest run src/lib/org/org-bff-route-contract.test.ts; npx playwright test tests/e2e/org-type-personal-status.spec.ts --workers=1; git diff --check`

Expected: registry/lint pass and E2E proves Korean, dynamic columns, and no write controls.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/app/api/org/mapping-personal-status/route.ts frontend/src/components/org/org-mapping-personal-status-manager.tsx frontend/src/app/org/type-personal-status/page.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-type-personal-status.spec.ts; git commit -m "feat: add organization mapping personal status screen"`

### Task 11: Atomic upload service and JSON API

**Files:** Create `backend/tests/test_org_mapping_upload_service_unit.py`, `backend/tests/test_org_mapping_upload_routes_unit.py`; modify `backend/app/schemas/organization.py`, `backend/app/services/organization_mapping_service.py`, `backend/app/api/organization.py`.

**Interfaces:** `GET /api/v1/org/mapping-assignments/upload-template` → `{headers:["조직코드","유형코드","항목코드","시작일","종료일"]}`; `POST /upload-preview` and `/upload-confirm` accept `{mode:"atomic",rows:[{department_code,type_code,item_code,effective_from,effective_to}]}`. Preview returns `{rows:[{row_number,valid,errors,normalized}],valid_count,invalid_count}`; successful confirm returns `{inserted_count,updated_count}`; invalid confirm returns 422 preview shape.

- [ ] **Step 1: Write failing atomic and permission tests**

```python
def test_upload_permission_select_precedes_successful_confirm() -> None:
    user = seed_permissions(session, path="/org/type-upload", allow_upload=True)
    assert upload_confirm(payload(valid_row()), session=session, current_user=user).inserted_count == 1
def test_flush_constraint_error_rolls_back_all_staged_rows() -> None:
    force_exclusion_integrity_error_on_flush(session)
    with pytest.raises(HTTPException, match="overlaps") as exc_info:
        confirm_mapping_assignment_upload(session, [valid_row(), valid_row_2()], actor_id=user.id)
    assert exc_info.value.status_code == 422
    assert assignment_count(session) == 0
def test_invalid_row_causes_zero_writes_without_begin_context() -> None:
    with pytest.raises(HTTPException, match="upload validation failed") as exc_info:
        confirm_mapping_assignment_upload(session, [valid_row(), invalid_row()], actor_id=user.id)
    assert exc_info.value.status_code == 422
    assert assignment_count(session) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_upload_service_unit.py tests/test_org_mapping_upload_routes_unit.py -q`

Expected: FAIL because JSON upload handlers do not exist.

- [ ] **Step 3: Write minimal atomic service/API**

`upload_template` first checks `/org/type-upload/template_download`, then returns the header JSON; it creates no workbook. Preview first checks `upload`, parses only JSON rows, and calls `validate_upload_rows` without writing. Confirm first checks `upload`; validation resolves codes, validates closed dates, item containment, database conflicts, and conflicts among incoming rows. After validation succeeds, stage all inserts/updates with `session.add`, call `session.flush`, then one `session.commit`. Every confirm row/period/constraint `HTTPException` or `IntegrityError` calls `session.rollback` and returns HTTP 422 in the preview response shape; unexpected exceptions roll back and return a sanitized 500. HTTP 409 remains limited to normal item/assignment CRUD conflicts. Do not use `session.begin()`.

- [ ] **Step 4: Run focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_upload_service_unit.py tests/test_org_mapping_upload_routes_unit.py -q; git diff --check`

Expected: permission-select success, preview no-write, invalid/flush constraint zero-write 422 preview responses, one-commit success, and JSON template tests pass.

- [ ] **Step 5: Commit**

Run: `git add backend/app/schemas/organization.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/tests/test_org_mapping_upload_service_unit.py backend/tests/test_org_mapping_upload_routes_unit.py; git commit -m "feat: add atomic organization mapping upload api"`

### Task 12: `/org/type-upload` JSON BFF, XLSX UI, and E2E

**Files:** Create `frontend/src/app/api/org/mapping-assignments/upload-template/route.ts`, `frontend/src/app/api/org/mapping-assignments/upload-preview/route.ts`, `frontend/src/app/api/org/mapping-assignments/upload-confirm/route.ts`, `frontend/src/components/org/org-mapping-upload-manager.tsx`, `frontend/tests/e2e/org-type-upload.spec.ts`; modify `frontend/src/app/org/type-upload/page.tsx`, `frontend/src/types/organization.ts`, `config/grid-screens.json`, `frontend/src/lib/org/org-bff-route-contract.test.ts`.

**Interfaces:** BFF routes are JSON only and forward success/error JSON unchanged. `OrgMappingAssignmentUploadRow = {department_code:string;type_code:string;item_code:string;effective_from:string;effective_to:string|null}`. Registry `org.type-upload`, toolbar `query/template/upload/download`.

- [ ] **Step 1: Write failing upload E2E**

```ts
test("upload creates a browser template and blocks invalid atomic confirmation", async ({ page }) => {
  await page.goto("/org/type-upload");
  await expect(page.getByText("전체 행 원자성: 오류가 한 행이라도 있으면 저장하지 않습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "오류 다운로드" })).toBeDisabled();
  await page.screenshot({ path: "output/playwright/org-type-upload-ko.png", fullPage: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx playwright test tests/e2e/org-type-upload.spec.ts --workers=1`

Expected: FAIL because upload page and BFF paths are absent.

- [ ] **Step 3: Write minimal JSON BFF and XLSX implementation**

Each BFF follows the explicit token proxy rule, always parses JSON (no binary branch), and returns 204 empty only if upstream returns 204. Manager fetches template headers then uses installed `xlsx` `utils.aoa_to_sheet([headers])` and `writeFileXLSX` locally. It uses `xlsx.read(await file.arrayBuffer())`, verifies the five exact Korean columns, posts rows to preview, renders validation errors, generates an error workbook only when `invalid_count > 0`, and enables confirm only when `invalid_count === 0` and `can("upload")`. Use every global Grid module and register only query/template/upload/download.

Extend BFF contract tests with template/preview/confirm 401 and JSON 200/422 propagation; no test expects binary forwarding.

- [ ] **Step 4: Run focused verification**

Run: `cd frontend; npm run validate:grid; npx eslint src/app/api/org/mapping-assignments/upload-template/route.ts src/app/api/org/mapping-assignments/upload-preview/route.ts src/app/api/org/mapping-assignments/upload-confirm/route.ts src/app/org/type-upload/page.tsx src/components/org/org-mapping-upload-manager.tsx src/types/organization.ts; npx vitest run src/lib/org/org-bff-route-contract.test.ts; npx playwright test tests/e2e/org-type-upload.spec.ts --workers=1; git diff --check`

Expected: JSON BFF, canonical toolbar, browser-created template, invalid preview guard, error workbook, fixed Korean screenshot, and lint pass.

- [ ] **Step 5: Commit**

Run: `git add frontend/src/app/api/org/mapping-assignments/upload-template/route.ts frontend/src/app/api/org/mapping-assignments/upload-preview/route.ts frontend/src/app/api/org/mapping-assignments/upload-confirm/route.ts frontend/src/components/org/org-mapping-upload-manager.tsx frontend/src/app/org/type-upload/page.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-type-upload.spec.ts; git commit -m "feat: add organization mapping upload screen"`

### Task 13: Sol review and ORG-focused completion evidence

**Files:** Create `frontend/tests/e2e/org-departments-regression.spec.ts`; modify only reviewer-identified files listed in Tasks 1–12; update ignored `.superpowers/sdd/org-implementation-review.md`.

**Interfaces:** consumes all prior endpoint, type, migration, and fixture contracts; produces Sol approval evidence with command outputs and paths to five fixed Korean screenshots.

- [ ] **Step 1: Write the final regression guard**

```python
def test_mapping_workflow_preserves_legacy_hierarchy_type() -> None:
    department.organization_type = "HEADQUARTERS"
    create_mapping_item_and_assignment_then_upload(session)
    assert session.get(OrgDepartment, department.id).organization_type == "HEADQUARTERS"
```

- [ ] **Step 2: Run test to verify it fails before a violating implementation and passes after correction**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_mapping_item_service_unit.py tests/test_org_mapping_assignment_service_unit.py tests/test_org_mapping_upload_service_unit.py -q`

Expected: any write to hierarchy fields fails the guard; corrected implementation passes.

- [ ] **Step 3: Apply Sol findings only after a contract checklist**

Checklist for every Step 3 in Tasks 1–12: exact signature/request/response exists; algorithm includes its listed boundary/error condition; unauthorized direct route has a 403 test; BFF success/error/204 behavior is tested; no generic proxy/helper expands access; Grid file uses every required common module; migration DDL names, nullability, defaults, FKs and reverse drop order match Task 3.

- [ ] **Step 4: Run final ORG-focused verification**

Run: `cd backend; ./.venv/Scripts/python.exe -m pytest tests/test_org_chart_routes_unit.py tests/test_org_mapping_migration_contract.py tests/test_org_mapping_lookup_routes_unit.py tests/test_org_mapping_item_service_unit.py tests/test_org_mapping_item_routes_unit.py tests/test_org_mapping_assignment_service_unit.py tests/test_org_mapping_assignment_routes_unit.py tests/test_org_mapping_personal_status_service_unit.py tests/test_org_mapping_personal_status_routes_unit.py tests/test_org_mapping_upload_service_unit.py tests/test_org_mapping_upload_routes_unit.py tests/test_organization_service_unit.py tests/test_menu_action_permission_unit.py -q; cd ../../frontend; npm run validate:grid; npx vitest run src/lib/org/org-chart-bff-route.test.ts src/lib/org/org-bff-route-contract.test.ts; npx tsc --noEmit; npm run build; npx playwright test tests/e2e/org-chart.spec.ts tests/e2e/org-type-items.spec.ts tests/e2e/org-types.spec.ts tests/e2e/org-type-personal-status.spec.ts tests/e2e/org-type-upload.spec.ts tests/e2e/org-departments-regression.spec.ts --workers=1; git diff --check`

Expected: named ORG tests, one final typecheck/build, five focused E2E screenshots, and whitespace check pass; no whole-repository test suite is invoked.

- [ ] **Step 5: Commit only exact reviewed paths**

Run: `git diff --name-only > .superpowers/sdd/org-reviewed-files.txt; git add backend/app/models/entities.py backend/app/models/__init__.py backend/app/schemas/organization.py backend/app/services/organization_service.py backend/app/services/organization_mapping_service.py backend/app/api/organization.py backend/app/bootstrap.py backend/migrations/versions/org_mapping_foundation_20260722_add_mapping_tables.py backend/tests/test_org_chart_routes_unit.py backend/tests/test_org_mapping_migration_contract.py backend/tests/test_org_mapping_lookup_routes_unit.py backend/tests/test_org_mapping_item_service_unit.py backend/tests/test_org_mapping_item_routes_unit.py backend/tests/test_org_mapping_assignment_service_unit.py backend/tests/test_org_mapping_assignment_routes_unit.py backend/tests/test_org_mapping_personal_status_service_unit.py backend/tests/test_org_mapping_personal_status_routes_unit.py backend/tests/test_org_mapping_upload_service_unit.py backend/tests/test_org_mapping_upload_routes_unit.py backend/tests/test_menu_action_permission_unit.py frontend/src/app/api/org/chart/route.ts frontend/src/app/api/org/mapping-types/route.ts frontend/src/app/api/org/mapping-type-items/route.ts frontend/src/app/api/org/mapping-type-items/[itemId]/route.ts frontend/src/app/api/org/mapping-type-options/route.ts frontend/src/app/api/org/mapping-item-options/route.ts frontend/src/app/api/org/department-options/route.ts frontend/src/app/api/org/mapping-assignments/route.ts frontend/src/app/api/org/mapping-assignments/[assignmentId]/route.ts frontend/src/app/api/org/mapping-personal-status/route.ts frontend/src/app/api/org/mapping-assignments/upload-template/route.ts frontend/src/app/api/org/mapping-assignments/upload-preview/route.ts frontend/src/app/api/org/mapping-assignments/upload-confirm/route.ts frontend/src/lib/org/org-chart-tree.ts frontend/src/lib/org/org-chart-tree.test.ts frontend/src/lib/org/org-chart-bff-route.test.ts frontend/src/lib/org/org-bff-route-contract.test.ts frontend/src/components/org/org-chart-manager.tsx frontend/src/components/org/org-mapping-type-item-manager.tsx frontend/src/components/org/org-mapping-assignment-manager.tsx frontend/src/components/org/org-mapping-personal-status-manager.tsx frontend/src/components/org/org-mapping-upload-manager.tsx frontend/src/app/org/chart/page.tsx frontend/src/app/org/type-items/page.tsx frontend/src/app/org/types/page.tsx frontend/src/app/org/type-personal-status/page.tsx frontend/src/app/org/type-upload/page.tsx frontend/src/types/organization.ts config/grid-screens.json frontend/tests/e2e/org-chart.spec.ts frontend/tests/e2e/org-type-items.spec.ts frontend/tests/e2e/org-types.spec.ts frontend/tests/e2e/org-type-personal-status.spec.ts frontend/tests/e2e/org-type-upload.spec.ts frontend/tests/e2e/org-departments-regression.spec.ts; git commit -m "fix: address organization mapping review"`

## Self-Review

**Architecture/API/migration:** Chart has its own query route; lookup routes are locked to `/org/types/query`; mapping schema starts at actual head `ea501237b804`, has exact named constraints/FKs/indexes, and reversible object drops. Upload remains JSON-only at the backend and commits only after staged validation/flush.

**Coverage:** Tasks 1–2 complete chart before mapping domain. Tasks 3–5 build migration, type security, and items. Tasks 6 and 8 place BFF/UI after their backend contracts. Tasks 7–10 implement assignments then historical personal status. Tasks 11–12 finish all-or-nothing upload. Task 13 is Sol review and focused aggregate proof.

**Consistency:** `type_code`, `item_id`, `department_id`, `effective_from`, `effective_to`, `OrgMappingTypeItem`, `OrgMappingAssignmentItem`, request paths, permission paths, BFF paths, and toolbar subsets retain the same spelling through tasks.

**Placeholder and Step-3 scan:** the mandated placeholder-pattern scan must produce zero plan matches. Review every Step 3 against the Task 13 signature/algorithm/error-contract checklist before implementation.

## Completion Evidence

Sol approval requires exact migration head proof, rollout/rollback evidence, 403 direct-route evidence, inclusive-period and containment tests, upload zero-write tests, distinct historical personal-status pagination, four new Grid registry entries plus `/org/departments` regression, and fixed-path Korean screenshots.
