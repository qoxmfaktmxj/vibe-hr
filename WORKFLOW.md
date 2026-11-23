# VIBE-HR WORKFLOW

## 0) Start checklist (required)
1. `git fetch --all`
2. `git checkout main`
3. `git pull --ff-only origin main`
4. Read `docs/DEVELOPMENT_PRECHECK.md`
5. Read `AGENTS.md`
6. Read `config/grid-screens.json`
7. Read `docs/GRID_SCREEN_STANDARD.md`
8. Read `docs/AG_GRID_COMMON_GUIDE.md`
9. Read `docs/MENU_ACTION_PERMISSION_PLAN.md`

## 1) Work split

### Frontend
- Implement screen/component/interaction
- For AG Grid screens, use the common pattern from `docs/AG_GRID_COMMON_GUIDE.md`
- Connect template download/upload/download actions

### Backend
- `backend-rust/src/`에서 axum 핸들러, 업무 권한, SQLx 트랜잭션을 확인한다. `backend-spring/`은 동작 대조와 버전별 Flyway SQL에 사용한다.
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
- [ ] Rust 변경 범위의 Cargo 포맷, Clippy, 테스트 통과. DB나 BFF 계약을 바꾼 경우 [테스트 전략](docs/TEST_STRATEGY.md)의 관련 검증 통과
- [ ] Toolbar order and behaviors match the common guide
- [ ] Save order is `DELETE -> UPDATE -> INSERT`
- [ ] Docs updated
