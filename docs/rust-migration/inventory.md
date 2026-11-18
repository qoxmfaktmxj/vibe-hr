# Spring parity baseline

The reference checkout is `75b94e868d2eea94689f840c3bce495ab5f5f5c5` with its existing local changes. The Rust acceptance target is the behavior of this checkout. The historical FastAPI manifest identifies earlier decisions and calls that may already have changed.

## HTTP surface

[spring-handlers.tsv](spring-handlers.tsv) records the explicit HTTP method, actual Spring path template, domain, controller and method. The inventory task compiles the current sources and asks Spring MVC to resolve its mappings. [openapi.json](../../backend-rust/resources/openapi.json) records the document served by an isolated instance of the built Spring application. Only the generated loopback server origin was replaced by `/`.

| Evidence | Observed scope |
| --- | ---: |
| Application Java controllers | 20 |
| Declared application controller operations | 290 |
| Framework-supplied `GET` and `HEAD /openapi.json` | 2 |
| Paths published by OpenAPI 3.1.0 | 218 |
| Published operations, including `/health` | 284 |
| Named OpenAPI schemas | 361 |

The six HTML documentation mappings use `@Hidden`. OpenAPI publishes the remaining 284 controller operations. Additional framework surfaces include implicit HEAD on GET routes, CORS preflight, method-not-allowed handling, Actuator discovery, health, liveness, readiness and info, Swagger UI, and ReDoc web assets. Compare live responses, protection, headers and content for those separately. Some HR handlers return dynamic maps. A matching schema alone gives no evidence about actual field values or database changes.

The old manifest lists 290 canonical routes including nine operational entries. The former Spring verifier reports two additional endpoints, `POST /api/v1/hr/basic/{employee_id}/records/batch` and `POST /api/v1/hri/requests/submit`. Current employee search adds repeated positions and employment statuses and an inclusive hire-date cutoff on the existing URL. A route count alone would miss this change. The old [mutation ledger](../spring-migration/mutation-ledger.md) has 166 Python source records, including shadowed handlers. Use its locking and retry rationale alongside current service code when verifying each mutation.

| Domain | Controller operations | Behavior to demonstrate against PostgreSQL |
| --- | ---: | --- |
| appraisal | 10 | Appraisal definitions, final results and target batch edits |
| auth | 7 | Corporation discovery, BFF login and social exchange, me, refresh, impersonation and active-user resolution |
| commoncode | 9 | Group and item CRUD, action authorization, public active options and ordering |
| dashboard | 1 | Summary aggregates and empty-data defaults |
| hr | 44 | Employee filters, bulk writes, basic records, recruitment to employment, appointment state, retirement and severance |
| hri | 16 | Form and approval configuration, draft, atomic submission, withdrawal, approval and receiver transitions |
| management | 43 | Company, development, infrastructure and outsourced work records, reads, partial edits and deletes |
| menu | 18 | Role-visible menu trees, administration, grants and action permissions |
| organization | 35 | Corporation and department lifecycle, chart, reference options, upload preview and confirmation, restructure application and history |
| payroll | 41 | Setup, payroll profiles, variable inputs, calculation and recalculation, snapshots, close and payment, vouchers, exports and payslips |
| platform | 8 | Two health responses and six HTML documentation method contracts |
| systemsettings | 2 | Current session policy, bounds, defaults, audit and administrator checks |
| time | 36 | Code and schedule maintenance, daily attendance, correction history, annual leave accounting, approval/cancellation and monthly close/reopen |
| training | 12 | Training definitions and application workflow, access control and repeated actions |
| welfare | 8 | Benefit type maintenance and application state transitions shared with HRI |

## Work outside controller handlers

| Responsibility | Current owner and validation |
| --- | --- |
| Proxy and session | `frontend/src/app/api` contains 160 route modules at the baseline. The BFF owns HTTP-only cookies, trusted proxy address binding, safe path forwarding and selected response headers. Google and Kakao token/profile calls are in the Next.js callback. The backend owns signed social exchange, identity validation and account onboarding. Run real BFF login, refresh, impersonation and an allowed/denied action. |
| Authorization and input errors | `platform/security/SecurityConfiguration` defines the public allowlist, BFF-only login and social paths, bearer authentication, CORS and fallback access. Menu and domain services enforce individual actions. Compare concrete unauthenticated, forbidden and validation responses including HTTP status, detail type and field locations. |
| Replay cleanup | `platform/security/BffAssertionReplayStore` consumes a nonce atomically, limits capacity in PostgreSQL and prunes expired records in bounded batches on request and on a scheduled fixed delay. Test concurrent duplicate consumption, expiry, capacity and cleanup. |
| Retirement event | `hr/HrApplicationService` publishes confirmation. `HrRetirementSeveranceListener` invokes draft creation after commit and logs a failure. Preserve this boundary under rollback and partial failure. |
| Time to payroll | `time/TimePayrollGateway` and the time and payroll services share close-state and unpaid-time decisions. Exercise leave approval, cancellation, monthly snapshot, independent deductions, finalization and reopening in the same scenario. |
| Documents and files | `payroll/PayslipPdfService` loads a Korean font and renders PDF. `PayrollController` sets MIME types, filenames, CSV escaping and JSON attachment output. Verify owner and administrator access plus PDF text, amounts and disposition. `OrganizationController` receives structured JSON for mapping upload preview/confirm and returns a structured template. |
| Bootstrap and schema | `migration/FlywayCutoverConfiguration` checks ownership, Alembic and existing history before Flyway and catalog validation. `FlywayAdoptionRunner` and `PreAdoptionReconciliationRunner` have separate explicit profiles. `SchemaManifestTool` drives the operator capture command. The seven versioned SQL files and catalog manifest are under `backend-spring/src/main/resources/db/migration`. Compare fresh and populated installs, accepted history and refusal cases. |
| Local/demo fixture generation | `DevSeedRunner`, `DemoSeedRunner`, `FixtureSeedGate` and `FixtureSeedService` enforce explicit confirmation, approved profiles, loopback DB and Flyway ownership. Verify allow and reject cases including repeated seeding. |
| Operations | `application.yml` defines UTC JSON, structured ECS logging, graceful shutdown, probes and app metadata. Documented public HTML pages use local assets and per-page CSP. `/api/v1/health` probes the DB and can return HTTP 200 with a degraded body. Preserve the distinct root liveness and readiness semantics. |
| Delivery and rollback | `.github/workflows/deploy.yml`, `guardrails.yml`, `ui-validation.yml`, both root Compose files, the backend Dockerfile and `scripts/ci` own the same-SHA UI gate, PostgreSQL and image verification, staged readiness/OpenAPI probes, revision identity and migration-aware recovery. Exercise both pre-promotion failure and compatible rollback in isolation. |

## Reproduction

From `backend-spring`, run:

```powershell
.\gradlew.bat -I ../scripts/rust-migration/spring-inventory.init.gradle rustMigrationInventory
```

Adding `-PwriteRustBaseline` rewrites the table when a newly reviewed Spring baseline is needed. The task examines application classes without opening a DB. From the repository root, compare the document emitted by an isolated instance:

```powershell
node scripts/rust-migration/openapi-contract.mjs verify http://127.0.0.1:18119
```

The capture command accepts the same arguments with `capture` in place of `verify`. It checks that published operations exactly match the public non-hidden controller set before writing the reference. Both checks use the true path variable names. The historical source verifier is independent: use `node -e "const m=require('./scripts/spring-migration/spring-route-coverage'); console.log(m.buildCoverage().completion)"` to inspect it without rewriting pre-existing reports.

Compare read contracts with the same rows in independent loopback databases. For example:

```powershell
node scripts/rust-migration/read-parity.mjs http://127.0.0.1:18119 http://127.0.0.1:18120 anonymous platform auth commoncode systemsettings payroll
```

Omitting the domain list includes all inventory domains. Use `admin` or `employee` with `VIBEHR_PARITY_TOKEN` from the legitimate fixture login to exercise authenticated reads. The driver verifies the fixture identity first. It compares response status, body, content type, attachment name, cache and authentication headers, and reports successful and negative responses separately. An anonymous 401 for a protected route cannot establish that its handler exists. IDs in the broad read sweep use 1; domain-specific fixtures and successful nonempty scenarios are still required.

With requests stopped, compare cloned database state before and after a matched write scenario:

```powershell
$env:VIBEHR_PARITY_DB_USER = 'vibehr_test'
node scripts/rust-migration/db-parity.mjs vibehr-rust-pg-1119 spring_reference rust_candidate
```

Both reads use repeatable-read, read-only transactions. The driver compares sorted SHA-256 fingerprints and counts of complete table rows, and the last value and called state of sequences. Supply relation names after the database arguments to check specific relations. Keep time-dependent audit events and independently generated tokens in the raw comparison. For an expected difference, assert its meaning with a scenario-specific test. The full comparison on the initial clone matched all 107 tables and 102 sequences.

## Validation status

Reference generation used a freshly built Spring Boot jar, a disposable PostgreSQL 16.13 instance on loopback and Flyway V1 through V7. The live document passed both capture and verification. Two dev administrators and one demo employee were then inserted through the gated seed profiles. A custom-format dump restored into an independent Rust candidate DB gave each side three users, three employees, seven successful Flyway versions and 107 public tables including Flyway history.

The Java baseline includes unit/MVC tests, the PostgreSQL-tagged `integrationTest` and the separate `migrationIntegrationTest`. Hosted UI tests and actual-backend browser scenarios use different fixtures. Rust completion requires evidence per domain, including authorization, writes, error paths, concurrent or repeated operations and DB results. A full Rust-only browser run must include authenticated HR grid edits, hiring to appointment and the financial scenarios in [the test strategy](../TEST_STRATEGY.md). Record Rust results separately from Spring baseline, synthetic/mock UI and published OpenAPI coverage.

The Spring baseline has an existing documentation asset mismatch. `GET /docs` returns 200 and references `/swagger-ui/swagger-ui.css` and `/swagger-ui/swagger-ui-bundle.js`; both requests return 404. `/webjars/swagger-ui/swagger-ui.css` and the ReDoc script return 200. Keep this finding distinct from Rust regressions when reviewing documentation behavior.

## Business differential evidence

The fixture used a legitimate seeded administrator token and matching UTC application processes with isolated `business_oracle_utc` and `business_candidate_utc` databases on PostgreSQL 16.13. Each request pair checked the status, media type, JSON fields and business values. Independently generated audit times had a five-second tolerance. The final comparison inspected each row and the sequence state in the listed tables.

| Domain | Paired requests | Unique successful method and route combinations | Compared tables |
| --- | ---: | ---: | ---: |
| Organization | 47 | 35 | 7 |
| Management | 47 | 43 | 9 |
| Appraisal | 16 | 10 | 3 |
| Training | 33 | 12, including reads and writes through dynamic resource routes | 9 |

Run `node scripts/rust-migration/business-parity.mjs DOMAIN REFERENCE_PORT CANDIDATE_PORT CONTAINER` with `VIBEHR_PARITY_TOKEN` and `VIBEHR_PARITY_DB_USER`. Use independent copies of the three-account seed. Configure `ENVIRONMENT=rust-parity` on both processes. Set `APP_NAME` to their respective database names, `business_oracle` and `business_candidate`. An optional `VIBEHR_PARITY_FIXTURE_SUFFIX` such as `_utc` appends to both names. Training preloads twelve months for the paired regeneration check. The separate `training::postgres_test` regression exercises the fresh year, regeneration and a blocked July update that rolls back the first six inserts. The organization PostgreSQL suite also covers concurrent assignment overlap and simultaneous application of a restructure plan.
