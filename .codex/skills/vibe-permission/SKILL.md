# $vibe-permission - Menu/Action Permission Guard

## Trigger
Keywords: `vibe-permission`, `permission change`, `권한변경`, `메뉴권한`

## Description
Enforces menu and action permission safety when modifying access control.
Shared menu/action workflow changes are R2. Authentication or authorization semantics are R3 under `docs/GOVERNANCE.md`. Both require explicit scoped approval and UI/server-side verification.

## Pre-read (mandatory)
- `docs/MENU_ACTION_PERMISSION_PLAN.md`
- `docs/GOVERNANCE.md`

## Protected Paths
- `backend-spring/src/main/java/com/vibehr/menu/**`
- `backend-spring/src/main/java/com/vibehr/auth/**`
- `backend-spring/src/main/java/com/vibehr/platform/security/**`
- `backend-spring/src/main/java/com/vibehr/**/*Authorization.java`
- `frontend/src/app/api/menus/**` and affected UI/BFF routes

## Rules
- UI hiding is NOT security; always enforce server-side.
- Menu visibility and action permissions must be consistent.
- Role-based access must be verified end-to-end (frontend hide + backend reject).
- Never remove permission checks without explicit approval.

## Steps
1. Read `docs/MENU_ACTION_PERMISSION_PLAN.md`.
2. Identify affected menus/actions/roles.
3. Check both UI components AND Spring authorization enforcement.
4. Plan changes and ask for approval.
5. Implement with dual enforcement (UI + API).
6. Verify: test with admin role AND non-admin role.
7. In `backend-spring`, run `.\gradlew.bat test --tests "com.vibehr.menu.*"` and the affected domain/auth/security tests. Add PostgreSQL coverage where applicable under `docs/TEST_STRATEGY.md`.

## Completion
Report: menus/actions changed, roles affected, UI enforcement (y/n), server enforcement (y/n).
