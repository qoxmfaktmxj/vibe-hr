# VIBE-HR WORKFLOW

## 0) Start checklist (required)
1. `git fetch --all`
2. `git checkout main`
3. `git pull --ff-only origin main`
4. Read `AGENTS.md`
5. Read `config/grid-screens.json`
6. Read `docs/GRID_SCREEN_STANDARD.md`
7. Read `docs/AG_GRID_COMMON_GUIDE.md`
8. Read `docs/MENU_ACTION_PERMISSION_PLAN.md`

## 1) Work split

### Frontend
- Implement screen/component/interaction
- For AG Grid screens, use the common pattern from `docs/AG_GRID_COMMON_GUIDE.md`
- Connect template download/upload/download actions

### Backend
- Organize batch APIs and transaction flow
- Keep save order fixed: `DELETE -> UPDATE -> INSERT`
- Provide permission checks (menu + action)

### QA
- Run scenario tests by screen
- Verify query reset behavior
- Verify create/copy/delete-check/save flow
- Verify download behavior

## 2) AG Grid implementation order
1. Update metadata/registry (`GRID_SCREEN`, `config/grid-screens.json`)
2. Apply shared UI and state modules first
3. Bind screen-specific events/API only after shared pattern is in place
4. Validate save flow and permissions
5. Run lint/build/tests
6. Update docs and commit/push

## 3) Definition of Done
- [ ] `npm run validate:grid` passed
- [ ] `npm run lint` passed
- [ ] `npm run build` passed
- [ ] Toolbar order and behaviors match the common guide
- [ ] Save order is `DELETE -> UPDATE -> INSERT`
- [ ] Docs updated

