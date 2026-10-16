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

For explicit full QA, inventory every spec rather than equating the hosted83 cases with the whole repository. Separate configurations cover checklist and retirement layouts and GPU rendering. The default configuration contains additional Spring-backed and mocked-response workflows, including the real finalist-to-employee/appointment case and lifecycle screen checks. Run those against a disposable loopback backend with development fixtures and BFF cookie login; set `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL` and the fixture's distinct temporary `AUTH_TOKEN_SECRET`/`VIBEHR_BFF_ASSERTION_SECRET`. This configuration owns its Next server, refuses to reuse a listening frontend and explicitly pins its BFF target to the loopback API URL. Do not invoke every default-config spec together, because synthetic-only specs require their own fixture server/configuration. Use per-run JSON reports and distinct output paths so a later run or restarted worker cannot erase earlier failures. A lifecycle grid check proves page/API health, not every possible business write.

Keep all existing cases and assertions. On an intermittent failure, preserve the failing evidence, identify the missing synchronization or product defect, and rerun the affected case before claiming a clean final suite. A version upgrade that changes lint analysis is a failed gate to investigate; do not disable rules or force an unsupported analyzer version to obtain a green result.

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

The generic integration task excludes the migration package and the replay-store
integration class, which are owned by `migrationIntegrationTest`. To run the full
PostgreSQL gate, invoke both tasks in one Gradle command. CI does this to preserve
failure propagation and avoid executing the same four classes twice.

Planned-time regressions exercise real schedule generation and reload in both UTC
and Asia/Seoul JVM defaults. Java values use the KST business clock and the existing
timestamp columns store UTC-naive values explicitly. Keep the legacy UTC read and
late-classification test; do not force a global JVM time zone to make it pass.

Flyway ownership-transfer work additionally requires:

```powershell
.\gradlew.bat migrationIntegrationTest
```

Hosted UI validation runs the existing 8 employee UX cases, all 44 employee
experience cases, and 31 additional repository-audit workflow cases after one
production build. Only the audit configuration's duplicate two smoke cases are
omitted from that extra invocation. The Deploy workflow verifies the standalone
same-SHA result instead of repeating the browser suites and frontend fast checks.

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
