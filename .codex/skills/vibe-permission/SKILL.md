# $vibe-permission — Menu/Action Permission Guard

## Trigger
Keywords: `vibe-permission`, `permission change`, `권한변경`, `메뉴권한`

## Description
Enforces menu and action permission safety when modifying access control.
Permission changes are R2-level and require both UI and server-side verification.

## Pre-read (mandatory)
- `docs/MENU_ACTION_PERMISSION_PLAN.md`

## Protected Paths
- `backend/app/api/menu.py`
- `backend/app/services/menu_service.py`
- `backend/app/schemas/menu.py`
- `backend/app/api/auth.py`
- `backend/app/core/auth.py`

## Rules
- UI hiding is NOT security — always enforce server-side.
- Menu visibility and action permissions must be consistent.
- Role-based access must be verified end-to-end (frontend hide + backend reject).
- Never remove permission checks without explicit approval.

## Steps
1. Read `docs/MENU_ACTION_PERMISSION_PLAN.md`.
2. Identify affected menus/actions/roles.
3. Check both UI components AND backend decorators/guards.
4. Plan changes and ask for approval.
5. Implement with dual enforcement (UI + API).
6. Verify: test with admin role AND non-admin role.
7. Run `pytest -k menu` or relevant backend tests.

## Completion
Report: menus/actions changed, roles affected, UI enforcement (y/n), server enforcement (y/n).
