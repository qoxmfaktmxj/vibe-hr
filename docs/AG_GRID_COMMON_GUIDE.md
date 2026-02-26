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

### Pagination

- `frontend/src/lib/grid/use-grid-pagination.ts`
  - Shared page state transitions
- `frontend/src/components/grid/grid-pagination-controls.tsx`
  - Shared pagination UI and "go to page" behavior

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

## 5) Forbidden patterns

Do NOT:

- Implement per-screen custom toolbar button rendering.
- Implement per-screen custom delete/restore status logic.
- Implement per-screen custom row status CSS mapping.
- Implement per-screen custom pagination state logic.
- Hardcode search placeholders that already exist in `search-presets.ts`.

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

