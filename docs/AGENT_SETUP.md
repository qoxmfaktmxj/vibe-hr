# Vibe-HR Agent Setup

Status: Active

## Required Context

Before changing this repository, read `AGENTS.md`, the applicable policy in `docs/`, and the target source files. Treat `backend-spring/**` as the only backend implementation surface. Historical material under an immutable pre-cutover archive header is evidence, not an execution guide.

## Runtime Commands

```powershell
cd backend-spring
.\gradlew.bat test
```

```powershell
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

Use `VIBEHR_RUN_CONTAINER_TESTS=true` with `integrationTest` only for Docker-backed PostgreSQL coverage. Do not introduce another backend runtime or dependency manager.

## Codex / OMX

Project instructions live in `AGENTS.md`; role prompts live in `.codex/prompts/`; workflow skills live in `.codex/skills/`. The normal sequence is inspect, identify risk, make the smallest valid change, run the relevant verification, and report evidence.

For grid work, read `config/grid-screens.json`, `docs/GRID_SCREEN_STANDARD.md`, and `docs/AG_GRID_COMMON_GUIDE.md` before editing. For menu or action permissions, also read `docs/MENU_ACTION_PERMISSION_PLAN.md` and verify server-side enforcement.

## Claude Configuration

`CLAUDE.md` mirrors the same project boundary and validation requirements. Local permissions must not retain commands or path allow-lists for a retired backend runtime.

## Delivery Rules

- Do not write outside the assigned frontend, Spring backend, or documentation scope without explicit reason.
- Do not change CI, deployment, migration, auth, payroll, or permission behavior without the required approval.
- Do not claim completion without current command output.
- Keep task-ledger evidence concise: changed files, verification, remaining risks, and any skipped check.
