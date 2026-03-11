# AG Grid Common Guide (mandatory)

This document is the single source of truth for all new AG Grid screens in VIBE-HR.

If a screen uses `AgGridReact`, contributors MUST follow this guide.

## 1) Objective

- Keep all AG Grid screens visually and behaviorally identical.
- Enable one-point fixes (change shared layer once, apply everywhere).
- Prevent per-screen custom implementations that drift over time.

## 2) Mandatory building blocks

All new AG Grid screens MUST use the shared modules below.

### Layout and search

- `frontend/src/components/grid/manager-layout.tsx`
  - `ManagerPageShell`
  - `ManagerSearchSection`
  - `ManagerGridSection`
- `frontend/src/components/grid/search-controls.tsx`
  - `SearchFieldGrid`
  - `SearchTextField`
- `frontend/src/lib/grid/search-presets.ts`
  - Shared placeholders/labels for search fields

### Toolbar and badges

- `frontend/src/components/grid/grid-toolbar-actions.tsx`
  - Standard action button rendering
- `frontend/src/components/grid/grid-change-summary-badges.tsx`
  - Added/updated/deleted counters

### Row status and grid styling

- `frontend/src/lib/hr/grid-change-tracker.ts`
  - Snapshot and revert checks
- `frontend/src/lib/grid/grid-status.ts`
  - Status summary and CSS class mapping
- `frontend/src/lib/grid/grid-status-mutations.ts`
  - Status transitions for edit/delete/restore

All standard-v2 screens must wire row visuals exactly like the shared pattern:
- `const rowClassRules = useMemo(() => buildGridRowClassRules<RowType>(), [])`
- `const getRowClass = useCallback((params) => getGridRowClass(params.data?._status), [])`
- pass both `rowClassRules` and `getRowClass` to `AgGridReact`

### Pagination

- `frontend/src/lib/grid/use-grid-pagination.ts`
  - Shared page state transitions
- `frontend/src/components/grid/grid-pagination-controls.tsx`
  - Shared pagination UI and "go to page" behavior

### Dirty-row navigation protection

- Use shared `ConfirmDialog` flow for unsaved row protection
- Trigger it before any reload/navigation action that would replace current grid rows
- Reuse the same title/description/button labels across all AG Grid screens

## 3) Mandatory data/status contract

Each row model MUST include:

- `_status: "clean" | "added" | "updated" | "deleted"`
- `_original?: Record<string, unknown>`
- `_prevStatus?: "clean" | "added" | "updated" | "deleted"`

Rules:

1. New row -> `_status = "added"`.
2. Existing row edited -> `_status = "updated"` (unless reverted to original).
3. Delete checked -> `_status = "deleted"`, keep previous state in `_prevStatus`.
4. Delete unchecked -> restore with `toggleDeletedStatus` / `resolveRestoredStatus`.
5. If reverted to original values -> `_status = "clean"`.
6. Revert checks MUST compare normalized values, not raw editor output.
7. Editable columns with formatted/select values must convert to canonical row values before calling `reconcileUpdatedStatus`.

Examples:
- `"Y" | "N"` select -> `boolean`
- numeric select/input -> `number`
- date editor output -> normalized date string used by the row model

## 4) Mandatory UI contract

All AG Grid screens MUST follow this composition:

1. `ManagerPageShell`
2. `ManagerSearchSection`
3. `ManagerGridSection`
4. Grid body (`AgGridReact`) inside `ManagerGridSection`
5. Toolbar from `GridToolbarActions`
6. Status badge from `GridChangeSummaryBadges`
7. Pagination from `GridPaginationControls` (if paged screen)

Toolbar order is fixed:

`query -> create -> copy -> template -> upload -> save -> download`

Header-left order is fixed:

`pagination -> total count -> change summary badges`

Even when the current screen has only one page, use the shared pagination control so the layout stays identical.

List screens MUST prefer backend pagination and return:
- request params: `page`, `limit`, optional `all`
- response fields: `total_count`, `page`, `limit`

When the user attempts paging/query navigation with dirty rows:
- stop grid editing first
- protect unsaved rows with a confirm dialog or equivalent shared flow
- do not silently discard modified rows
- use the standardized dialog copy below:
  - title: `저장되지 않은 변경 사항이 있습니다.`
  - description: `현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?`
  - confirmLabel: `무시하고 이동`
  - cancelLabel: `취소`

Dirty-row protection is mandatory for:
- query button
- Enter-triggered query
- previous/next page
- go-to-page button
- direct page number jumps
- filter/search actions that refetch from server
- any action that clears/replaces the current grid dataset

## 5) Forbidden patterns

Do NOT:

- Implement per-screen custom toolbar button rendering.
- Implement per-screen custom delete/restore status logic.
- Implement per-screen custom row status CSS mapping.
- Omit `rowClassRules` and rely on ad-hoc row coloring when using shared status states.
- Implement per-screen custom pagination state logic.
- Hardcode search placeholders that already exist in `search-presets.ts`.
- Reconcile dirty status from raw editor values when the row model uses normalized values.
- Use custom per-screen dirty-row warning copy or silently discard modified rows.

If a shared component is missing a needed option, extend the shared component first.

## 6) Validation gates (required)

Before merge:

1. `npm run validate:grid`
2. `npm run lint`
3. `npm run build`

## 7) Migration rule for legacy screens

- Legacy AG Grid screens may remain temporarily.
- Any touched legacy screen MUST be migrated to this shared pattern in the same task.
- New AG Grid screens MUST start with this guide from day one.
