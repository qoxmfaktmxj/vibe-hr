# Vibe-HR OMX Team Guide

## Purpose

Keep shared-workspace work aligned with the current Spring Boot / Gradle / Flyway / Next.js
runtime and the repo governance docs.

## Start Of Day

```powershell
git status --short --branch
omx setup --scope project
omx doctor
```

## Runtime Facts

- Spring Boot is the only backend runtime.
- Flyway is the only schema and required-reference-data writer.
- Python, FastAPI, and Alembic names kept in migration docs are historical evidence only.
- Production deployment is composed from `docker-compose.deploy.yml`.
- `AUTH_TOKEN_SECRET` and `VIBEHR_BFF_ASSERTION_SECRET` must be distinct 64-hex values from
  `openssl rand -hex 32`.
- The edge reverse proxy must strip any client-supplied `x-vibehr-client-ip` header and inject one
  canonical value for BFF login.

## Common Checks

Frontend:

```powershell
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run test:e2e:hr
npm run build
```

Backend:

```powershell
cd backend-spring
.\gradlew.bat test
```

Use container-backed tests only when the changed doc or investigation depends on
PostgreSQL/Flyway behavior:

```powershell
$env:VIBEHR_RUN_CONTAINER_TESTS = "true"
.\gradlew.bat integrationTest
.\gradlew.bat migrationIntegrationTest
```

## Coordination Notes

- Follow `AGENTS.md` and `docs/GOVERNANCE.md` before changing shared documentation or runtime
  guidance.
- Keep edits minimal and avoid rewriting frozen evidence.
- Preserve `.omx/` state files and other user work in the dirty workspace.
