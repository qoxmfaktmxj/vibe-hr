# GRID SCREEN STANDARD (standard-v2)

This standard defines the minimum requirements for AG Grid screens.
For implementation details, always read:

- `docs/AG_GRID_COMMON_GUIDE.md`

## 1) Scope

A screen is treated as an AG Grid screen when all conditions are true:
1. Uses `AgGridReact`
2. Declares `GRID_SCREEN` metadata in page file
3. Is registered in `config/grid-screens.json`

## 2) Required page metadata

Every AG Grid page file (`src/app/**/page.tsx`) must include:

```ts
const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "module.screen",
} as const;
```

`registryKey` must match the key in `config/grid-screens.json`.

## 3) Required implementation contract

All AG Grid screens MUST:
- use shared layout/search/toolbar/status/pagination modules from:
  - `frontend/src/components/grid/*`
  - `frontend/src/lib/grid/*`
- use row status contract with `_status`, `_original`, `_prevStatus`
- use shared status transition logic for delete/restore/update
- use shared row style wiring from `grid-status.ts`:
  - `buildGridRowClassRules(...)`
  - `getGridRowClass(...)`
  - `getGridStatusCellClass(...)`
- render header-left in this order using shared modules:
  - pagination controls
  - total count text (`총 x,xxx건`)
  - change summary badges
- protect dirty rows before any data-reloading action:
  - query/search
  - page move / previous / next / go-to-page
  - filter changes that trigger refetch
  - any screen action that replaces current row data
- keep toolbar order exactly:
  - `query -> create -> copy -> template -> upload -> save -> download`

List APIs backing AG Grid screens MUST expose pagination-ready contracts:
- request: `page`, `limit`, optional `all`
- response: `total_count`, and when paged, `page`, `limit`

Dirty-row protection dialog text is standardized:
- title: `저장되지 않은 변경 사항이 있습니다.`
- description: `현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?`
- confirm: `무시하고 이동`
- cancel: `취소`

This dialog must be shown before discarding unsaved row changes.

## 4) Validation gate

Before merge:
1. `npm run validate:grid`
2. `npm run lint`
3. `npm run build`

## 5) Legacy rule

- Existing legacy AG Grid screens may remain temporarily.
- Any modified legacy AG Grid screen must be migrated to standard-v2 in the same task.
- New AG Grid screens must start with standard-v2.
