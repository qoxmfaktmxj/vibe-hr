# Spring Boot Cutover and Rollback Runbook

Status: execution runbook. Production cutover is not complete until the smoke checks below pass against the intended deployment database.

## Preconditions

- Freeze schema changes and record the exact Alembic head and PostgreSQL schema manifest.
- Run `node scripts/spring-migration/flyway-verify.js` and `node scripts/spring-migration/spring-route-coverage.js --verify-complete` from the repository root.
- Run the explicit Flyway adoption command against a database copy before changing production traffic. The database must have exactly the approved Alembic head, no schema drift, and no `flyway_schema_history` table.
- Retain the previous Spring backend/frontend image tags and the database backup for the observation window. A non-Spring release is not a rollback target.
- Create `.env.deploy.secret` from `.env.deploy.secret.example` only on the deployment host. The tracked example is intentionally invalid. It must contain the three Spring datasource variables plus separate random `AUTH_TOKEN_SECRET` and `VIBEHR_BFF_ASSERTION_SECRET` values of at least 32 bytes, with no whitespace or placeholder text.
- Store the exact SSH host-key line for the deployment host in the GitHub Actions `DEPLOY_KNOWN_HOSTS` secret. For a non-default SSH port, the entry must use `[host]:port` syntax. Do not use `ssh-keyscan` during deployment.

## Flyway Adoption

Run this only after the preconditions are satisfied and from a database backup/copy first. It is deliberately non-default and refuses ambiguous ownership.

```powershell
cd backend-spring
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://<host>:5432/<database>"
$env:SPRING_DATASOURCE_USERNAME = "<user>"
$env:SPRING_DATASOURCE_PASSWORD = "<password>"
./gradlew --no-daemon bootRun --args="--spring.profiles.active=flyway-adoption --vibehr.migration.adoption-confirmation=adopt-exact-alembic-head"
```

After adoption, verify that `alembic_version` is absent and Flyway history contains exactly the successful V1 baseline and V2 marker-retirement rows with their expected rank, version, description, type, script, and checksum. Reject any extra, missing, duplicate, failed, or tampered row; do not repair history manually. The checked-in schema manifest must also match before using the `flyway-cutover` profile.

```sql
select installed_rank, version, description, type, script, checksum, success
from flyway_schema_history
order by installed_rank;
```

The adoption command stops at the exact V1/V2 ownership transfer. The separate `flyway-cutover` stage applies V3, V4, and V5 on startup after adoption succeeds.

## Verification Stages

- Post-adoption: run the exact V1/V2 integrity check immediately after the adoption command completes.
- After starting `flyway-cutover`: confirm the exact current V1-V5 chain/checksums, then confirm the 106-table live schema check through the migration gate and smoke.

Fixture profiles are prohibited in this runbook. `dev-seed` and `demo-seed` additionally require a `local` or `dev` profile, `VIBEHR_ALLOW_FIXTURE_SEEDING=true`, a loopback PostgreSQL host, and a database name without `prod` or `live`; the seed gate rejects production-like targets before the local `admin` fixture can be written.

## Spring-Only Smoke

This uses disposable PostgreSQL and removes its volume afterward. It is the required local proof before any deployment claim.

```powershell
./scripts/spring-migration/smoke-spring-compose.ps1
```

The script waits for Spring readiness, verifies the non-root/no-Python image contract, checks all public documentation GET/HEAD endpoints, and confirms that live `/openapi.json` documents all effective canonical application operations.

## BFF Assertion Replay Contract

The Next.js BFF signs the exact UTF-8 JSON request-body SHA-256 digest together with the method, path, principal binding, and a short-lived nonce. Spring verifies all claims before handling `/api/v1/auth/login` or `/api/v1/auth/social/exchange`. Nonces are consumed atomically in PostgreSQL and expire at assertion TTL; V4/V5 bound replay capacity per signed client/source scope, per source hash, and per replay bucket so one source or bucket cannot crowd out unexpired evidence from others. Do not use forwarded headers to derive redirects: social callbacks require the configured canonical `APP_ORIGIN`.

## Production Cutover

1. Confirm the final backend image can start against the adopted database with `SPRING_PROFILES_ACTIVE=flyway-cutover` and `VIBEHR_SCHEMA_OWNER=flyway`.
2. Confirm `.env.deploy.secret` defines non-empty `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, and separate non-placeholder `AUTH_TOKEN_SECRET` and `VIBEHR_BFF_ASSERTION_SECRET` values with at least 32 bytes and no whitespace. The tracked `.env.deploy` must define `VIBEHR_BFF_BACKEND_URL=http://backend:8080` and a canonical `APP_ORIGIN`; no external BFF target is permitted.
3. Confirm GitHub Actions has `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`. The workflow fails closed if the supplied known-host entry does not exactly match the destination host and port.
4. Dispatch the `Deploy Vibe-HR` workflow. It builds a candidate backend, verifies candidate readiness and `/openapi.json` on an isolated loopback port, then promotes the compose release only after both checks pass. It also verifies the replacement frontend at `/login`. It retains the previous Spring backend/frontend image IDs and operator configuration. A candidate, replacement, or post-promotion failure recreates that Spring release and must pass rollback readiness and `/openapi.json` checks. If a prior Spring backend is not running, deployment stops before replacing the live release.

```bash
# The CI workflow performs the staged promotion. Do not replace a live release
# with an unchecked `docker compose up --build` command.
```

5. Run authenticated smoke workflows for login/refresh, menu permission denial and success, one grid query/save, one binary download, attendance, and payroll. Do not make production differential writes.

## Rollback

The deployment workflow restores only the previous Spring images and `.env.deploy`/`.env.deploy.secret` after a candidate or promotion failure. It fails closed when no prior Spring backend is running, and it fails the job if rollback compose, readiness, or `/openapi.json` verification fails. Rollback changes routing and containers only. Do not execute reverse DDL: the Flyway baseline and application schema remain unchanged.

```bash
# The deployment workflow creates a temporary override with the retained image tags.
# Do not attempt a manual rollback when no prior Spring image is available.
curl --fail --silent --show-error http://127.0.0.1:8080/actuator/health/readiness
curl --fail --silent --show-error http://127.0.0.1:8080/openapi.json
```

Record the reason, timestamp, image tags, database manifest checksum, affected routes, and health output. Keep the Spring service stopped until the failure is understood; do not attempt partial dual-write routing.
