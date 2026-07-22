# VibeGrid Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the incomplete `VibeGrid` wrapper from all 15 consumers while preserving each screen's current API, query, pagination, selection, export, and adjacent CRUD/workflow behavior through explicit `ReadonlyGridManager` wiring.

**Architecture:** Each consumer owns its SWR key, page state, response normalization, readonly row creation, and query revalidation again. The existing `ReadonlyGridManager`, AG Grid shared modules, registry, page metadata, and `.vibe-grid` CSS remain the runtime standard. The validator returns to validating every registered component directly without a wrapper exception.

**Tech Stack:** Next.js 16, React 19, TypeScript, SWR, AG Grid 35, Vitest, Playwright.

---

### Task 1: Restore explicit readonly grid orchestration in 15 screens

**Files:**

- Modify: `frontend/src/components/hr/hr-retire-approval-manager.tsx`
- Modify: `frontend/src/components/hr/hr-retire-checklist-manager.tsx`
- Modify: `frontend/src/components/hr/hr-severance-calc-manager.tsx`
- Modify: `frontend/src/components/mng/dev-inquiry-manager.tsx`
- Modify: `frontend/src/components/mng/dev-project-manager.tsx`
- Modify: `frontend/src/components/mng/dev-request-manager.tsx`
- Modify: `frontend/src/components/mng/dev-staff-viewer.tsx`
- Modify: `frontend/src/components/mng/infra-config-manager.tsx`
- Modify: `frontend/src/components/mng/manager-status-viewer.tsx`
- Modify: `frontend/src/components/mng/outsource-attendance-manager.tsx`
- Modify: `frontend/src/components/mng/outsource-contract-manager.tsx`
- Modify: `frontend/src/components/payroll/pay-voucher-manager.tsx`
- Modify: `frontend/src/components/tim/annual-leave-manager.tsx`
- Modify: `frontend/src/components/tim/attendance-status-manager.tsx`
- Modify: `frontend/src/components/wel/wel-benefit-type-overview.tsx`

- [ ] **Step 1: Use the pre-migration Git versions as the behavioral reference**

Inspect `73b3a78^`, `e50b0e9^`, `06ce5e8^`, `d07d384^`, `6570db8^`, and `213eaa9^` for the explicit `ReadonlyGridManager` patterns. Preserve all later bug fixes and UI changes from current `HEAD`; do not replace entire files from old commits.

- [ ] **Step 2: Replace each VibeGrid render with explicit state and fetch wiring**

Each screen must own the equivalent of:

```tsx
const [page, setPage] = useState(1);
const query = `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}page=${page}&limit=${PAGE_SIZE}`;
const { data, isLoading, mutate } = useSWR<ListResponse>(query, fetcher, {
  revalidateOnFocus: false,
});
const rowData = useMemo(() => createReadonlyGridRows(data?.items ?? []), [data?.items]);

<ReadonlyGridManager
  title={title}
  searchFields={searchFields}
  rowData={rowData}
  columnDefs={columnDefs}
  totalCount={data?.total_count ?? 0}
  page={data?.page ?? page}
  pageSize={data?.limit ?? PAGE_SIZE}
  onPageChange={setPage}
  onQuery={handleQuery}
  onDownload={handleDownload}
  loading={isLoading}
/>
```

Use each API's real response type. Preserve existing `fetchAdapter` semantics for `project_id`/`contract_id`, `transformRows` filtering semantics, `beforeGrid`/`afterGrid`, row selection, empty text, query label, height, and XLSX filename/formatters.

- [ ] **Step 3: Preserve adjacent mutations and selection refresh behavior**

Do not change request URLs, payloads, menu actions, forms, approval actions, detail panels, toast messages, or global SWR invalidation. Querying the same filter must still revalidate; applying new filters must reset to page 1 and fetch the new key.

- [ ] **Step 4: Run targeted static validation**

Run:

```powershell
cd frontend
npx tsc --noEmit
npm run validate:grid
```

Expected: both commands exit 0.

### Task 2: Remove the wrapper and validator exception

**Files:**

- Delete: `frontend/src/components/grid/vibe-grid.tsx`
- Modify: `frontend/scripts/validate-grid-screens.mjs`
- Modify: `frontend/tests/e2e/lifecycle-grid-qa.spec.ts`
- Delete: `docs/VIBE_GRID_ROADMAP.md`
- Modify: `docs/design-docs/PAY_VOUCHER_GL_DESIGN.md`
- Modify: `docs/design-docs/HR_SEVERANCE_DESIGN.md`

- [ ] **Step 1: Delete the runtime wrapper after all imports are gone**

Delete `vibe-grid.tsx`. Do not delete or rename `readonly-grid-manager.tsx`, other shared grid modules, or any `.vibe-grid` CSS selector.

- [ ] **Step 2: Make validator direct for every registered screen**

Remove `usesVibeGrid`, its token exemptions, and its pagination exemption. Every registered component must now pass the same `AgGridReact`, standard-v2 token, and pagination checks directly.

- [ ] **Step 3: Retire only active VibeGrid guidance**

Delete the roadmap, replace current design-document wording with `ReadonlyGridManager/AG Grid`, and update the lifecycle QA comment. Keep historical `TASK_LEDGER` and audit records unchanged.

- [ ] **Step 4: Assert complete runtime removal**

Run:

```powershell
rg -n 'components/grid/vibe-grid|\bVibeGrid\b' frontend/src frontend/scripts frontend/tests
```

Expected: zero matches. `.vibe-grid` CSS class matches are explicitly allowed and must remain.

### Task 3: Full regression verification

- [ ] **Step 1: Run frontend gates in required order**

```powershell
cd frontend
npm run validate:grid
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run route-level E2E when an authenticated environment is available**

```powershell
npx playwright test tests/e2e/lifecycle-grid-qa.spec.ts --workers=1 --reporter=line
```

Expected: all 23 route checks pass. If authentication storage state is unavailable, report that as an explicit unverified gap rather than treating it as a product failure.

- [ ] **Step 3: Review the final diff**

Confirm that only the 15 consumers, wrapper removal, validator cleanup, targeted active docs, test comment, and this plan changed. Confirm `config/grid-screens.json`, page `GRID_SCREEN` metadata, all shared AG Grid modules, and `frontend/src/app/globals.css` are unchanged.
