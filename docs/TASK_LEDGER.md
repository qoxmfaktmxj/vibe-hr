## TASK VH-R3-SPRING-PRODUCTION-CUTOVER-20260803
- Date: 2026-08-03
- Status: executing with explicit production approval
- Mode: High-risk controlled production cutover
- Risk Class: R3 (database ownership transfer, authentication secrets, deployment and traffic switch)
- Approval Status: user explicitly approved immediate Spring Boot production cutover
- Owner: Codex implementation lane

### Scope
- Fast-forward the reviewed reconciliation/V3 correction onto the current design `main` revision.
- Stop Python writes, take a final backup, restore to a separate Spring production database, and run guarded reconciliation plus Flyway V1-V5.
- Verify an isolated Spring candidate before replacing the Python backend and switching the Next.js BFF to Spring.
- Retain the original Python images, operator configuration, original database, and final backup as rollback assets.

### Stop Conditions
- Any permanent successful V3 history, fingerprint/history/checksum mismatch, protected data checksum change, unsafe sequence, destructive reconciliation requirement, candidate validation failure, or production smoke failure stops promotion or triggers routing/container rollback.

### Cutover Hotfix
- Production smoke exposed Hibernate 7 closing a native `getResultStream()` used by the non-transactional employee permission check before `findFirst()` advanced it. The authorization lookup was changed to a bounded result-list read, with its unit tests updated, before backend re-promotion.
- The attendance status UI sends the frozen FastAPI-compatible `start_date`, `end_date`, and optional `employee_id` query names. Explicit Spring `@RequestParam` bindings and a reflection contract test were added after smoke exposed implicit camelCase binding.

## TASK VH-R3-PRODUCTION-DRIFT-RECONCILIATION-20260803
- Date: 2026-08-03
- Status: clone end-to-end verification completed; production cutover remains stopped pending separate approval
- Mode: Restored-backup verification
- Risk Class: R3 (schema ownership transfer and production-data compatibility)
- Approval Status: approved explicitly by the user for clone/source work only; production execution not approved
- Owner: Codex implementation lane

### Scope
- Mechanically compare the restored production schema with the frozen V1 catalog manifest and determine whether production or V1 is canonical.
- Add an exact-fingerprint, exact-head, advisory-locked, transactional reconciliation command without changing V1/V2 or the frozen schema manifest.
- Preserve source tables in an archive schema, prove protected row/checksum equality, and exercise reconciliation through Flyway V1-V5 on PostgreSQL 16.
- Confirm no known permanent database has successful V3 history, then correct V3's pre-first-application source-ID mapping without changing valid assignments.

### Evidence
- Restored clone source fingerprint `e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1`; fresh same-version V1 and reconciled clone both matched `fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e`.
- Five protected tables retained identical row counts/checksums; all five canonical sequences produced a next value above max ID.
- Read-only permanent-database audit found no successful V3 row: production has no Flyway table and the retained evidence database has V1/V2 only.
- A new restore `vibehr_reconcile_v3fix_20260803` passed reconciliation, exact V1/V2 adoption (`V2=-1027260723`), corrected V3 (`720383589`), V4/V5, 106-table validation, Hibernate validation, readiness, OpenAPI, and signed authentication/permission smoke.
- The actual scheduling shape (50 departments, 100 active assignments) retained exact checksum `a18af37c745f60c0e7904915e990a065` across V3-V5; 1,377 canonical source rows remained intact.
- `migrationIntegrationTest`, full unit tests, `flyway-verify`, and route coverage `290/290` passed. All 102 owned sequences have calculated next values above max IDs.

### Remaining Risk / Stop Condition
- Any newly discovered successful V3 in a permanent database invalidates this checksum-change path and requires a stop/guarded-bridge review. No production DB, container, Compose, Nginx, secret, push, or PR was changed.
- See `docs/spring-migration/PRODUCTION_DRIFT_RECONCILIATION_20260803.md`.

## TASK VH-R3-DELIVERY-HARDENING-20260803
- Date: 2026-08-03
- Status: completed
- Mode: Delivery hardening
- Risk Class: R3 (deployment container runtime and generated smoke credentials)
- Approval Status: approved explicitly by the user
- Owner: Terra implementation lane

### Scope
- Run the frontend deployment container as the existing unprivileged `node` user with copied runtime artifacts owned by that user.
- Generate distinct ephemeral 256-bit smoke secrets in process memory for each Compose invocation; never store or log them.
- Correct public application metadata to identify the Next.js, Spring Boot, and JPA runtime.

### Changed Files
- `frontend/Dockerfile`
- `docker-compose.spring-smoke.yml`
- `scripts/spring-migration/smoke-spring-compose.ps1`
- `scripts/spring-migration/smoke-spring-compose.behavior.test.ps1`
- `scripts/spring-migration/verify-delivery.js`
- `frontend/src/app/layout.tsx`
- `docs/TASK_LEDGER.md`

### Commands Run / Verification Summary
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\spring-migration\\smoke-spring-compose.behavior.test.ps1`: PASS. Generated secret format, secret separation, preexisting environment restoration, ownership refusal, and native cleanup failure propagation passed.
- `node scripts\\spring-migration\\verify-delivery.js`: PASS. The verifier now enforces frontend non-root ownership, generated smoke-secret injection, and current public metadata contracts.
- `docker compose -f docker-compose.spring-smoke.yml config --quiet` with ephemeral process-only secrets: PASS.
- `docker build --file frontend\\Dockerfile --tag vibehr-frontend:delivery-hardening .`: PASS. The image default user is `node` (UID `1000`), and Next runtime/public assets are readable.
- `frontend: npm run lint`: PASS with 0 errors and 15 existing warnings.
- `frontend: npm run build`: PASS. Grid validation and Next.js production build completed for 190 routes.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\spring-migration\\smoke-spring-compose.ps1`: PASS. Fresh Flyway startup, backend image verification, 281 application OpenAPI operations, 8 documentation contracts, and owned-resource teardown passed.

### Remaining Risks
- The public reverse proxy still must remove and reinject the canonical trusted client-IP header before reaching the Next.js BFF.

## TASK VH-R3-SECURITY-DELIVERY-REMEDIATION-20260802
- Date: 2026-08-02
- Status: completed
- Risk Class: R3 (authentication, payroll authorization, Flyway, deployment, and secrets)
- Approval Status: approved explicitly by the user
- Owner: Terra implementation lane

### Scope
- Require valid non-placeholder BFF secrets and canonical social callback origin; bind assertions to the exact signed JSON body.
- Replace process-local nonce state with PostgreSQL/Flyway atomic replay consumption and scoped TTL capacity.
- Harden deployment secret/TCP checks and guarded smoke Compose teardown; retain login rate-limit, HR permission, payroll IDOR, and BFF replay controls.

### Changed Files
- Frontend BFF assertion, login/social routes, and route/unit tests.
- Spring BFF security/replay implementation, V4 migration, security/migration tests, and HR/payroll regressions.
- Deploy/smoke scripts, Compose secret, secret example, delivery static tests, and this runbook.

### Evidence
- `npm run test -- src/app/api/_lib/bff-assertion.test.ts src/app/api/auth/login/route.test.ts src/app/api/auth/social/callback/[provider]/route.test.ts`: PASS (6 tests).
- Focused Gradle security, HR authorization, and payroll controller tests: PASS.
- `VIBEHR_RUN_CONTAINER_TESTS=true .\\gradlew.bat --no-daemon --console=plain integrationTest --tests com.vibehr.platform.security.BffAssertionReplayStorePostgreSqlIntegrationTest`: PASS.
- `.\\gradlew.bat --no-daemon --console=plain migrationIntegrationTest --tests com.vibehr.migration.FlywayOwnershipTransferIntegrationTest`: PASS.
- `node --test scripts/spring-migration/smoke-spring-compose.test.js scripts/spring-migration/deploy-security.test.js`, `node scripts/spring-migration/verify-delivery.js`, and `./scripts/spring-migration/smoke-spring-compose.ps1`: PASS.

### Remaining Risks
- PostgreSQL availability is now part of the login/social assertion path; the existing database health and deployment readiness gates remain required.

## TASK VH-R3-SPRING-ONLY-FLYWAY-CUTOVER-GATE-20260801
- Date: 2026-08-01
- Status: completed
- Mode: Execution / verification
- Risk Class: R3 (Flyway cutover configuration and deployment runtime)
- Approval Status: approved (user explicitly approved the full Java cutover and this bounded Spring-only correction)
- Owner: Terra implementation lane

### Scope
- Remove the retired legacy-writer startup gate from the Spring cutover profile, adoption runner, integration inputs, Compose-facing configuration, and active migration instructions.
- Keep Flyway disabled outside `flyway-cutover`; require explicit `vibehr.migration.owner=flyway` before the migration strategy can obtain a database connection or call Flyway.
- Preserve exact adoption confirmation and the existing V1/V2 history and catalog-tamper checks.

### Changed Files
- `backend-spring/src/main/java/com/vibehr/migration/FlywayCutoverConfiguration.java`
- `backend-spring/src/main/java/com/vibehr/migration/FlywayAdoptionRunner.java`
- `backend-spring/src/main/resources/application-flyway-cutover.yml`
- `backend-spring/src/test/java/com/vibehr/migration/FlywayCutoverConfigurationTest.java`
- `backend-spring/src/test/java/com/vibehr/migration/FreshFlywayWholeApplicationHibernateValidationIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/commoncode/IntegerPersistenceBindingIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/platform/openapi/OpenApiDocsContractTest.java`
- `backend-spring/README.md`
- `backend-spring/docs/database-and-seed-migration.md`
- `docs/spring-migration/CUTOVER_RUNBOOK.md`
- `docs/spring-migration/flyway-adoption-and-seed.md`
- `docs/TASK_LEDGER.md`

### Evidence
- `backend-spring: .\\gradlew.bat --no-daemon --console=plain test --tests com.vibehr.migration.FlywayCutoverConfigurationTest --rerun-tasks`: PASS. Missing or wrong owner is rejected before connection/Flyway interaction; a legacy property cannot bypass the owner fence; the active cutover profile declares no legacy property.
- `backend-spring: .\\gradlew.bat --no-daemon --console=plain clean compileJava compileTestJava test --rerun-tasks`: PASS.
- `backend-spring: .\\gradlew.bat --no-daemon --console=plain migrationIntegrationTest --rerun-tasks`: PASS. PostgreSQL 16 adoption integrity, exact V1/V2 history rejection, schema-manifest validation, and fresh full-context `flyway-cutover` startup pass without a legacy writer property.
- `docker compose -f docker-compose.spring-smoke.yml config --quiet`: PASS.
- `docker compose -f docker-compose.deploy.yml --env-file .env.deploy config --quiet`: PASS with a temporary non-secret local validation file removed immediately after the command.
- `scripts/spring-migration/smoke-spring-compose.ps1 -ProjectName vibehr-spring-cutover-fix`: PASS. Flyway cutover reached readiness; image verification confirmed non-root, no Python runtime, and Nanum font support; live OpenAPI verified 281 application operations and 8 public documentation method contracts.
- Active configuration and docs search: PASS; no production/config/Compose/documentation reference to the retired legacy-writer key remains. Tests retain negative assertions only.
- `node scripts/spring-migration/verify-python-retirement.js` in an artifact-free mirror of the current source: PASS, 0 `.py` files and 0 active Python invocations across 1,082 active files.

### Remaining Risks
- V1/V2/V3 remain intentionally non-reversible; recovery continues to require the verified backup-and-stop procedure.
- The direct workspace retirement verifier currently sees the isolated `backend-spring/.gradle-cutover-fix` cache created by this verification lane. It is not source or runtime content, but it must be removed before that direct workspace command is green. The execution policy prevented its deletion during this task; the artifact-free mirror passed.
- An additional local Terra CLI review could not run because the installed CLI is too old for `gpt-5.6-terra`; runtime, integration, and static verification above completed successfully.
