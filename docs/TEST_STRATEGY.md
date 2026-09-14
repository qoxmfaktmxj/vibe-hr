# Vibe-HR Test Strategy

Status: Active
Backend test runtime: Gradle / JUnit 5 / Spring Boot Test / Testcontainers PostgreSQL

## Required Checks

Run only the checks applicable to the changed scope, in dependency order.

### Frontend

```powershell
cd frontend
npm run check:ui
```

For small navigation or app-shell UI changes, `check:ui` runs lint, all fast unit tests, two static-background browser flows (desktop and mobile), then one production build. The build includes TypeScript checking, so do not also run a separate typecheck at this final gate. The existing build pre-hook validates the grid registry.

During implementation, run the affected tests and file-scoped lint first. Run the final gate once after the last code change. Reuse successful evidence while its code is unchanged; do not repeat build or browser suites for documentation-only edits.

| Command | Scope |
| --- | --- |
| `npm run test` | All fast unit tests, retained without deleting cases |
| `npm run test:ui` | Two `@ui-smoke` navigation flows with reduced motion and no 3D texture downloads |
| `npm run test:ui:full` | Full existing employee-experience regression suite, for broad shared-shell changes or explicit full QA |
| `npm run test:gpu` | Rendered title and water interaction, for scene/shader/motion changes |
| `npm run check:ui` | Final small-UI gate with exactly one build |

The two smoke flows cover navigation, not every feature. Add or select focused tests when changing another screen, authentication, permissions, data writes, or other behavior they do not exercise. For 3D lifecycle or fallback changes, also select the relevant cases from the full suite. `test:gpu` uses D3D11 on Windows by default; `PLAYWRIGHT_HARDWARE_GPU=0` explicitly selects the default browser rendering path.

Run `npm run validate:grid` before lint when an AG Grid screen or shared grid module changes. Run browser and build commands sequentially: the dev server and build share Next artifacts. Tests use isolated synthetic services and do not certify production authentication. These local commands do not weaken existing CI or protected-change gates.

### Production-host UI isolation

Daily deployments use the exact-SHA GitHub-hosted UI gate in
[`UI_VALIDATION_CI.md`](UI_VALIDATION_CI.md). Do not run browser suites or Next dev
on the production host. Missing/failed remote UI evidence blocks deployment;
it does not waive testing. Backend and runtime checks below remain applicable.

### Spring Backend

```powershell
cd backend-spring
.\gradlew.bat test
```

Use a focused test selector when it isolates the changed behavior:

```powershell
.\gradlew.bat test --tests com.vibehr.time.TimeControllerTest
```

Run PostgreSQL-backed coverage only when Docker is available and the changed behavior depends on database, locking, migration, or SQL semantics:

```powershell
$env:VIBEHR_RUN_CONTAINER_TESTS = "true"
.\gradlew.bat integrationTest
```

Flyway ownership-transfer work additionally requires:

```powershell
.\gradlew.bat migrationIntegrationTest
```

### Runtime Smoke Check

```powershell
cd backend-spring
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

Verify `/health` and the affected `/api/v1/**` route. Use `/openapi.json` or `/docs` when contract output needs inspection.

## Test Design

- Unit tests cover calculations, validation, DTO mapping, authorization decisions, and state transitions.
- Controller tests cover status codes, snake_case payloads, error shape, and authentication/authorization outcomes.
- Tagged integration tests cover PostgreSQL mappings, MyBatis SQL, Flyway, locking, repeat-call behavior, and concurrency-sensitive workflows.
- Frontend BFF tests cover request forwarding, response mapping, and backend-target configuration.
- Browser tests cover the highest-risk end-to-end workflow and AG Grid interactions.

## Completion Evidence

Every task reports the exact command, result, and any skipped check with reason. A failed required check blocks completion until fixed or explicitly approved as an external limitation.
