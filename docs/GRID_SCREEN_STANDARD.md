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
export const GRID_SCREEN = {
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
- keep toolbar order exactly:
  - `query -> create -> copy -> template -> upload -> save -> download`

## 4) Validation gate

Before merge:
1. `npm run validate:grid`
2. `npm run lint`
3. `npm run build`

## 5) Legacy rule

- Existing legacy AG Grid screens may remain temporarily.
- Any modified legacy AG Grid screen must be migrated to standard-v2 in the same task.
- New AG Grid screens must start with standard-v2.

