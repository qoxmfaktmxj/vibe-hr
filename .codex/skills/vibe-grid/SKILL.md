# $vibe-grid — AG Grid Screen Guard

## Trigger
Keywords: `vibe-grid`, `grid change`, `그리드수정`, `AG Grid`

## Description
Enforces AG Grid standards when creating or modifying grid-based screens.
Grid changes are R2-level (shared contracts) and require careful validation.

## Pre-read (mandatory)
Before any grid work, read these files in order:
1. `config/grid-screens.json` — screen registry
2. `docs/GRID_SCREEN_STANDARD.md` — toolbar/column standards
3. `docs/AG_GRID_COMMON_GUIDE.md` — shared component guide
4. Target page/component files

## Protected Paths
- `frontend/src/components/grid/**`
- `frontend/src/lib/grid/**`
- `config/grid-screens.json`

## Rules
- Use shared modules from `frontend/src/components/grid/*` and `frontend/src/lib/grid/*`.
- Toolbar order: `query -> create -> copy -> template -> upload -> save -> download`
- Every `AgGridReact` page must declare `GRID_SCREEN` metadata.
- Register/update in `config/grid-screens.json`.
- Run `npm run validate:grid` BEFORE lint/build.

## Steps
1. Read the 4 mandatory files above.
2. Plan changes (list affected screens, columns, toolbars).
3. Ask for approval if touching shared grid components (R2).
4. Implement changes.
5. Run `npm run validate:grid`.
6. Run `npm run lint && npx tsc --noEmit`.
7. Verify at least one existing screen still renders correctly.

## Completion
Report: screens affected, grid validation result, toolbar order preserved (y/n).
