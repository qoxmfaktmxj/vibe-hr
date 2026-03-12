# Employee Master Refactor Plan

Updated: 2026-03-12

## Scope

Target: `frontend/src/components/hr/employee-master-manager.tsx`

## Goal

- keep existing screen behavior
- reduce single-file responsibility
- add small regression coverage before and during refactor

## Vertical Slice 1

- [x] extract pure helper functions and shared screen types
- [x] add unit tests for extracted helper behavior
- [x] extract search section UI into a dedicated component
- [x] keep toolbar order and grid standard-v2 contract unchanged
- [x] run `npm run validate:grid`
- [x] run `npm run lint`
- [x] run `npm run build`
- [x] run `npm run test`

## Next Slices

- [x] extract grid column definitions and cell editors
- [x] extract save/upload/download actions into a hook
- [x] extract page state persistence and dirty-row reload flow
- [ ] extract row mutation/edit lifecycle into focused hooks
