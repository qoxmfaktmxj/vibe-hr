<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
> **IMMUTABLE PRE-CUTOVER ARCHIVE - NON-EXECUTABLE**
>
> This document preserves retired implementation and test planning evidence. Do not run, restore, or update legacy commands or paths. Use `docs/SPRING_BOOT_JAVA_MIGRATION_PLAN.md` for current Spring-only guidance.

# Grid Retirement Mutation Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the VibeGrid retirement verification gap with executable regression coverage for all 15 affected screens: real isolated-database mutations for supported services, UI-to-HTTP mutation contracts for workflow screens, and explicit behavior checks for the three read-only screens.

**Architecture:** Backend service tests use a disposable SQLite database so create/update/delete operations exercise real SQLModel persistence without touching shared data. Frontend Playwright tests drive the real screens and intercept only domain API calls, allowing deterministic assertions for request methods, paths, payloads, list refresh, and read-only behavior. Existing detailed severance and voucher service suites remain the source of truth for R3 calculation/workflow semantics and are run, not duplicated.

**Tech Stack:** Python, pytest, SQLModel/SQLite, Next.js 16, React 19, TypeScript, Playwright, AG Grid 35.

## Global Constraints

- Work directly on `main`; the user explicitly selected direct `main` integration and push.
- Do not mutate or depend on shared/local persistent business data in automated tests.
- Do not change production API paths, payloads, permissions, payroll meaning, retirement meaning, DB schema, migrations, shared AG Grid modules, `config/grid-screens.json`, or `.vibe-grid` CSS.
- Test the 12 mutation-capable screens according to their real supported actions; do not invent CRUD for `mng/dev-staff`, `tim/status`, or `wel/benefit-types`, which are read-only in these components.
- MNG CRUD must cover create/update/delete where the UI exposes all three; create/delete where update is not exposed.
- HR/payroll/TIM irreversible workflow calls must use Playwright route isolation and must never confirm or adjust a shared database record.
- Run `npm run validate:grid` before frontend lint/build.
- Preserve existing authenticated `storageState` setup and single-worker Playwright execution.
- No new dependencies.

---

### Task 1: Add isolated backend mutation service regression

**Files:**
- Create: `backend/tests/test_grid_retirement_mutation_services_unit.py`

**Interfaces:**
- Consumes: existing SQLModel entities, request schemas, and service functions from `mng_company_service`, `mng_dev_service`, `mng_infra_service`, `mng_outsource_service`, `hr_retire_service`, and `tim_leave_service`.
- Produces: pytest coverage proving real disposable-database persistence for the mutation behavior behind the affected screens.

- [ ] **Step 1: Create a disposable SQLite test session**

Use the existing test style and create a fresh engine per test:

```python
engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
SQLModel.metadata.create_all(engine)
with Session(engine) as session:
    ...
```

Seed only the minimum `AuthUser`, `HrEmployee`, and MNG company rows required by foreign keys. Use unique codes/names inside each test; never connect to the application-configured database.

- [ ] **Step 2: Cover MNG development CRUD with real persistence**

Add one focused test each for:

```text
dev inquiry: create -> update progress/title field -> delete -> select returns none
dev project: create -> update contract/status field -> delete -> select returns none
dev request: create -> update status/MM field -> delete -> select returns none
```

Call the real service functions and schema request objects. Assert the created IDs, updated values, deletion count `1`, and absence after deletion.

- [ ] **Step 3: Cover MNG relationship/config mutations with real persistence**

Add focused tests for:

```text
infra: create master -> upsert one harmless config key -> delete config -> delete master
manager status: create employee/company mapping -> delete mapping
outsource: create contract -> update leave count -> create attendance -> delete attendance -> delete contract
```

Use a harmless config value such as `grid-retirement-e2e`; never create secret-like values. Delete child attendance/config rows before their parent where the service contract requires it.

- [ ] **Step 4: Cover missing HR/TIM mutation behavior without duplicating R3 calculation tests**

Add focused tests for:

```text
retire checklist: create active checklist item and verify persisted code/title/order
retire case cancellation: create isolated employee/case, cancel through the real service, assert employee status and retire date are restored
annual leave: adjust an isolated employee by +0.5 days and assert granted/remaining values changed once
```

Do not confirm severance or generate vouchers here. Those semantics are already covered by `test_hr_severance_service_unit.py` and `test_pay_voucher_service_unit.py`.

- [ ] **Step 5: Run focused backend tests and commit**

Run:

```powershell
cd backend
python -m pytest -q tests/test_grid_retirement_mutation_services_unit.py tests/test_hr_severance_service_unit.py tests/test_pay_voucher_service_unit.py
```

Expected: all selected tests pass against disposable databases. Commit only the new backend test file.

---

### Task 2: Add MNG screen CRUD and read-only Playwright regression

**Files:**
- Create: `frontend/tests/e2e/grid-retirement-mng-crud.spec.ts`

**Interfaces:**
- Consumes: authenticated Playwright `storageState`, the seven MNG mutation screens, and `/mng/dev-staff`.
- Produces: deterministic UI-to-HTTP regression coverage for MNG create/update/delete and the read-only staff query.

- [ ] **Step 1: Add domain route fixtures with in-memory state**

Create small typed helpers that fulfill JSON and capture mutation requests. Intercept only these paths:

```text
/api/mng/companies/dropdown
/api/mng/dev-inquiries
/api/mng/dev-projects
/api/mng/dev-requests
/api/mng/dev-requests/monthly-summary
/api/mng/dev-staff/projects
/api/mng/dev-staff/revenue-summary
/api/mng/infra-masters
/api/mng/infra-configs/**
/api/mng/manager-status
/api/mng/outsource-contracts
/api/mng/outsource-contracts/check-duplicate
/api/mng/outsource-attendances/**
/api/employees
```

Each list handler must return the real response envelope used by its component, including `items`, `total_count`, `page`, and `limit` where required. Mutation handlers update the test-local array before returning success so SWR revalidation displays the changed row.

- [ ] **Step 2: Exercise the three full development CRUD screens**

For `/mng/dev-inquiries`, `/mng/dev-projects`, and `/mng/dev-requests`:

```typescript
await page.goto(route);
await page.getByPlaceholder(uniqueFieldPlaceholder).fill(createValue);
await page.getByRole("button", { name: "저장" }).click();
expect(capturedMethods).toContain("POST");
await expect(page.locator(".ag-row").filter({ hasText: createValue })).toBeVisible();
await page.locator(".ag-row").filter({ hasText: createValue }).click();
await page.getByPlaceholder(updateFieldPlaceholder).fill(updateValue);
await page.getByRole("button", { name: "저장" }).click();
expect(capturedMethods).toContain("PUT");
await page.getByRole("button", { name: "삭제" }).click();
expect(capturedMethods).toContain("DELETE");
```

Assert the captured body keeps the component's real field names and that DELETE is `{ ids: [createdId] }`.

- [ ] **Step 3: Exercise relationship/config create-delete paths**

Add UI tests for:

```text
infra: master POST -> config POST -> config DELETE -> master DELETE
manager status: mapping POST -> DELETE
outsource contracts: POST -> PUT -> DELETE
outsource attendance: POST -> DELETE
```

Assert the actual request path and payload for every click. For outsource attendance, expose one in-memory contract fixture; for manager status and contracts, expose one in-memory employee fixture.

- [ ] **Step 4: Lock the read-only dev-staff contract**

For `/mng/dev-staff`, select a company filter and click `조회`. Assert project and revenue GET requests include the selected `company_id`, an AG Grid row renders, and no POST/PUT/DELETE domain request occurs.

- [ ] **Step 5: Run focused E2E and commit**

Run with local frontend/backend servers:

```powershell
cd frontend
npx playwright test tests/e2e/grid-retirement-mng-crud.spec.ts --workers=1 --reporter=line
```

Expected: every MNG scenario passes with zero shared database mutations. Commit only the new MNG Playwright spec.

---

### Task 3: Add HR, payroll, TIM, and welfare workflow regression

**Files:**
- Create: `frontend/tests/e2e/grid-retirement-workflow-mutations.spec.ts`

**Interfaces:**
- Consumes: authenticated Playwright `storageState` and the seven non-MNG affected screens.
- Produces: deterministic request/payload/state regression for five mutation-capable workflow screens and explicit read-only checks for two screens.

- [ ] **Step 1: Model each screen with isolated response state**

Intercept only the affected domain APIs and return response shapes copied from their TypeScript types:

```text
retire checklist: GET/POST /api/hr/retire/checklist
retire approval: GET/POST /api/hr/retire/cases, GET case detail, PUT checklist item, POST confirm/cancel
severance: GET list/detail, POST recalculate/confirm, PUT adjustment
voucher: GET runs/list/detail, POST generate/confirm/cancel
annual leave: GET my/list, POST adjust
attendance status: GET daily list
welfare benefit types: GET list
```

Keep all state in the test process. Mutation handlers must update local state and return the same envelope the real BFF returns.

- [ ] **Step 2: Exercise HR mutation contracts**

Add tests proving:

```text
checklist: filling code/title and clicking 등록 sends POST with code/title/description/is_required/is_active/sort_order
retire approval: selecting a case and toggling a checklist item sends PUT; confirm and cancel buttons send the correct POST paths and cancel_reason
severance: changing adjustment amount/reason sends PUT; recalculate and confirm send the correct POST paths
```

Assert the UI reflects the mocked post-mutation state and that none of these requests reach the shared backend.

- [ ] **Step 3: Exercise payroll and annual-leave mutation contracts**

Add tests proving:

```text
voucher: generate sends {run_id}; selected draft confirm/cancel use /confirm and /cancel
annual leave: adjustment sends {employee_id,year,adjustment_days,reason} and refreshed row reflects the new remaining days
```

Use one in-memory closed payroll run and one in-memory employee leave balance. Do not call real R3 endpoints.

- [ ] **Step 4: Lock the two read-only contracts**

For `/tim/status`, click the row's `정정` action and assert navigation to `/tim/correction?attendance_id=<fixtureId>` without a mutation request. For `/wel/benefit-types`, apply a keyword and assert filtered row/summary rendering with no POST/PUT/DELETE request.

- [ ] **Step 5: Run focused and aggregate frontend gates, then commit**

Run:

```powershell
cd frontend
npx playwright test tests/e2e/grid-retirement-workflow-mutations.spec.ts --workers=1 --reporter=line
npm run validate:grid
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Expected: all commands exit 0; lint may retain the existing 15 warnings but must have 0 errors. Commit only the new workflow Playwright spec.

---

### Task 4: Final aggregate verification and evidence

**Files:**
- Modify: `docs/TASK_LEDGER.md`

- [ ] **Step 1: Run the entire affected regression set**

```powershell
cd backend
python -m pytest -q
cd ..\frontend
npm run validate:grid
npm run lint
npx tsc --noEmit
npm test
npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts tests/e2e/grid-retirement-mng-crud.spec.ts tests/e2e/grid-retirement-workflow-mutations.spec.ts --workers=1 --reporter=line
npm run build
```

- [ ] **Step 2: Review scope and safety**

Confirm the diff contains only the new test files, this plan, and the ledger entry. Confirm production components, API code, schema/migrations, shared AG Grid code, registry, CSS, and persistent business data are unchanged.

- [ ] **Step 3: Record evidence**

Append a completed R1 entry to `docs/TASK_LEDGER.md` listing test counts, commands, the 12 mutation-capable/3 read-only classification, and the fact that backend mutations used disposable SQLite while Playwright workflow mutations were route-isolated.
<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
