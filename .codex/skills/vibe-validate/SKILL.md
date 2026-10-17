# $vibe-validate - Vibe-HR Full Validation Pipeline

## Trigger
Keywords: `vibe-validate`, `validate all`, `full check`, `전체검증`

## Description
Runs the Spring backend and frontend validation gates. Read `docs/TEST_STRATEGY.md` and `docs/UI_VALIDATION_CI.md` first. The hosted UI gate covers 98 synthetic browser cases; it does not cover every repository E2E scenario or production authentication.

## Steps
Run from the repository root. Docker is required for PostgreSQL integration coverage.

1. **Backend build, unit and PostgreSQL tests**
   ```powershell
   Push-Location backend-spring
   $env:VIBEHR_RUN_CONTAINER_TESTS = "true"
   .\gradlew.bat --no-daemon --console=plain compileJava test integrationTest migrationIntegrationTest bootJar
   Pop-Location
   ```
2. **Delivery inventory and security checks**
   Run the current commands in the Deploy workflow's `Verify migration inventories and BFF cutover` step. Keep strict completeness checks and deployment-shell regression tests; do not substitute weaker verification modes.
3. **Frontend fast checks and existing browser suites**
   ```powershell
   Push-Location frontend
   npm run validate:grid
   npm run lint
   npm run test
   npx playwright test --config playwright.employee-ux.config.ts --reporter=line --max-failures=1
   npm run test:ui:full
   npm run build
   npx playwright test --config playwright.audit.config.ts --grep-invert '@ui-smoke' --reporter=line --max-failures=1
   Pop-Location
   ```
4. **Remaining browser coverage**
   Run the separate GPU/layout configurations and affected actual-Spring scenarios when required by the requested scope. Use disposable local fixtures, local URLs and valid BFF authentication for actual-Spring tests. Do not run the default all-specs configuration against an unspecified server or production data.

## Rules
- Run each dependent command only after its prerequisite passes. If a step fails, fix the cause and rerun the affected checks before continuing.
- Grid validation MUST pass before lint/build. The production build includes TypeScript checking; do not repeat a standalone typecheck at this gate.
- Keep browser suites and builds sequential because they share Next artifacts.
- Docker unavailable or an unrun browser scenario is a verification gap, not a pass. Record the reason and affected coverage.
- Reuse unchanged successful evidence for documentation-only edits. Record exact commands, results, screenshots/traces and remaining risks in `docs/TASK_LEDGER.md`.
- Main push, scheduled and manual deployment use the standalone successful UI result for the exact SHA in addition to backend, image and runtime gates.

## Completion
Report pass/fail and duration for backend, delivery checks, frontend fast checks/build, hosted-equivalent browser cases and remaining requested browser scenarios. Do not present a discovered test count as an executed result or claim that passing tests proves every possible behavior.
