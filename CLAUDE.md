# CLAUDE.md

> Projection document for Claude-family tools.
> Canonical sources:
> - `AGENTS.md`
> - `docs/GOVERNANCE.md`
> - `docs/ARCHITECTURE.md`
> - `docs/TEST_STRATEGY.md`
> - `docs/TASK_LEDGER.md`

This file is an execution entrypoint, not a source of truth. If any rule here conflicts with canonical docs, follow the canonical docs.

## Project
Vibe-HR is a Korean HR modernization monorepo.

- Frontend: Next.js 16, React 19, TypeScript, AG Grid
- Backend: FastAPI, SQLModel, PostgreSQL
- Domains: HR / ORG / TIM / PAYROLL / WEL / HRI / TRA

## Source of Truth Map
- Runtime workflow / Codex-OMX execution surface: `AGENTS.md`
- Governance / approvals / risk classes: `docs/GOVERNANCE.md`
- Architecture / domains / hotspots: `docs/ARCHITECTURE.md`
- Testing / validation requirements: `docs/TEST_STRATEGY.md`
- Execution loop / batch / failure handling: `docs/EXECUTION_PROTOCOL.md`
- Quality score / readiness: `docs/QUALITY_SCORE.md`
- Security / protected changes: `docs/SECURITY.md`
- Observability / runtime signals: `docs/OBSERVABILITY.md`
- Sub-agent structure: `docs/SUB_AGENTS.md`
- Skill index / automation hints: `docs/SKILLS_INDEX.md`
- Work evidence / task trace: `docs/TASK_LEDGER.md`
- AG Grid standard: `docs/GRID_SCREEN_STANDARD.md`
- Menu / action permission plan: `docs/MENU_ACTION_PERMISSION_PLAN.md`

## Default Workflow
1. Read the relevant canonical docs first.
2. Determine risk class (R0 / R1 / R2 / R3).
3. If the work is R2 or R3, stop and require explicit approval before changing code.
4. Make the smallest viable change.
5. Run required validation.
6. Record evidence consistently with `docs/TASK_LEDGER.md`.

## Risk Summary
- **R0**: docs / low-risk non-executable changes
- **R1**: local low-risk code changes with validation
- **R2**: shared contracts / CI / permission flow / shared grid rules → approval required
- **R3**: auth, payroll semantics, DB schema/migration, deploy/infra, secrets → explicit approval required

## Sensitive Paths
Treat the following as protected paths.

- `frontend/src/components/grid/**`
- `frontend/src/lib/grid/**`
- `config/grid-screens.json`
- `backend/app/api/auth.py`
- `backend/app/core/auth.py`
- `backend/app/schemas/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/api/payroll_phase2.py`
- `backend/app/services/payroll_phase2_service.py`
- `backend/app/schemas/payroll_phase2.py`
- `backend/app/api/menu.py`
- `backend/app/services/menu_service.py`
- `backend/app/schemas/menu.py`
- `.github/workflows/**`
- `docker-compose.deploy.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`

## Required Validation
### Frontend
```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

### Backend
```bash
cd backend
pytest
```

## AG Grid Rule
If an AG Grid screen or shared grid module is changed:
- read `config/grid-screens.json`
- read `docs/GRID_SCREEN_STANDARD.md`
- preserve toolbar order and registry contract
- run `npm run validate:grid`

## Permission Rule
If menu/action permission paths are changed:
- read `docs/MENU_ACTION_PERMISSION_PLAN.md`
- verify both UI behavior and server-side enforcement
- do not treat UI hiding as security

## Do Not
- change auth / payroll / deploy / data-repair behavior without explicit approval
- duplicate long canonical policy into tool-specific files
- claim completion without validation evidence
- bypass grid validation for shared grid changes

## Task Evidence
For meaningful work, keep the result consistent with `docs/TASK_LEDGER.md`:
- changed files
- commands run
- verification summary
- remaining risks
- follow-ups
