# Vibe-HR Test Strategy

Status: Active
Backend test runtime: Gradle / JUnit 5 / Spring Boot Test / Testcontainers PostgreSQL

## Required Checks

Run only the checks applicable to the changed scope, in dependency order.

### Frontend

```powershell
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

Run `npm run validate:grid` before lint or build when an AG Grid screen or shared grid module changes. Run targeted Playwright coverage for behavior that requires a browser.

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
