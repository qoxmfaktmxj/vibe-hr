# $vibe-validate — Vibe-HR Full Validation Pipeline

## Trigger
Keywords: `vibe-validate`, `validate all`, `full check`, `전체검증`

## Description
Runs the complete Vibe-HR validation pipeline across both frontend and backend.

## Steps
1. **Backend tests**
   ```bash
   cd backend && pytest -x --tb=short
   ```
2. **Frontend grid validation**
   ```bash
   cd frontend && npm run validate:grid
   ```
3. **Frontend lint**
   ```bash
   cd frontend && npm run lint
   ```
4. **Frontend type check**
   ```bash
   cd frontend && npx tsc --noEmit
   ```
5. **Frontend build**
   ```bash
   cd frontend && npm run build
   ```

## Rules
- Run steps in order. If any step fails, stop and report the failure.
- For AG Grid changes, grid validation MUST pass before lint/build.
- Report: pass/fail per step, total time, and any error details.

## Completion
Report a summary table:
| Step | Status | Time |
|------|--------|------|
| Backend pytest | ✅/❌ | Xs |
| Grid validate | ✅/❌ | Xs |
| Frontend lint | ✅/❌ | Xs |
| Type check | ✅/❌ | Xs |
| Frontend build | ✅/❌ | Xs |
