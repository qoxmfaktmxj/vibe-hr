# Vibe-HR Spring Boot Java Runtime And Learning Guide

Status: Active
Runtime: Spring Boot 4.1 / Java 21 / PostgreSQL
Scope: The Spring application is the only operational backend.

## Runtime Topology

```text
Browser
  -> Next.js 16 App Router and BFF
  -> Spring Boot 4.1 / Java 21
  -> PostgreSQL
```

The frontend continues to own browser presentation and BFF proxying. `backend-spring/` owns API behavior, authorization, transaction boundaries, persistence, schema ownership, required reference data, explicitly gated fixtures, OpenAPI, health, and structured logging.

## Official Baseline

| Area | Standard |
| --- | --- |
| Runtime | Java 21 toolchain |
| Framework | Spring Boot 4.1.0 |
| HTTP and validation | Spring MVC and Bean Validation |
| Security | Spring Security with the Vibe-HR JWT and permission contract |
| Persistence | Spring Data JPA and MyBatis, one authoritative write path per use case |
| Schema and required reference data | Flyway versioned SQL |
| Database | PostgreSQL |
| Tests | JUnit 5, Spring Boot Test, MockMvc, and Testcontainers PostgreSQL |
| Build | Gradle Wrapper |
| Operations | Actuator health probes, Springdoc, and ECS structured logs |

## Repository Ownership

```text
backend-spring/src/main/java/com/vibehr/
  auth/            authentication, active user lookup, token handling
  menu/            menu and action permissions
  platform/        configuration, errors, security, health, OpenAPI
  organization/    organization domain
  hr/              employee, appointment, recruitment, retirement
  time/            attendance, schedules, leave, month close
  payroll/         payroll, severance, vouchers, payslips
  hri/             requests, approval, receiving
  welfare/         benefit types and requests
  appraisal/       appraisal outcomes
  training/        training workflows
  management/      management configuration and operations
  migration/       Flyway adoption and schema verification
  seed/            explicit local/demo fixtures
```

Controllers own HTTP translation. Application services own use cases and transactions. JPA serves aggregate lifecycle behavior; MyBatis serves named SQL with a justified projection or performance need. Controllers never open transactions, and a write operation is never implemented by both persistence styles.

## Contract And Security Rules

- Preserve the frontend contract for `/api/v1/**`, snake_case JSON, query names, status semantics, binary headers, and `{ "detail": ... }` errors.
- Pair each API-contract change with its affected Next.js BFF route and Spring controller/DTO tests.
- Enforce bearer-token, active-user, role, menu, and action checks in Spring Security and domain authorization services.
- Treat UI hiding as presentation only; every protected operation requires backend enforcement.
- Supply datasource credentials and `AUTH_TOKEN_SECRET` through the environment. Do not place them in code, fixtures, logs, or task evidence.

## Database And Seed Rules

- PostgreSQL is the single datastore.
- Hibernate runs with `ddl-auto=validate` and never creates schema.
- Flyway migrations under `backend-spring/src/main/resources/db/migration` are the only schema and required-reference-data writers.
- Fixture data is disabled by default and is enabled only by the documented local/demo profile gate.
- Financial logic uses explicit rounding rules and `BigDecimal` where precision requires it.
- Migration changes are R3: obtain approval, run focused Gradle and PostgreSQL integration tests, and document recovery evidence.

## Run And Verify

```powershell
cd backend-spring
.\gradlew.bat test
```

```powershell
$env:VIBEHR_RUN_CONTAINER_TESTS = "true"
.\gradlew.bat integrationTest
```

```powershell
.\gradlew.bat migrationIntegrationTest
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

The runtime smoke checks are `/health`, `/api/v1/health`, `/openapi.json`, and `/docs`.

## Completion Gates

Spring runtime work is complete only when the relevant items are true:

- The affected controller, DTO, application service, and persistence path have focused tests.
- PostgreSQL-dependent behavior has tagged Testcontainers coverage when applicable.
- The Next.js BFF reaches the Spring endpoint and preserves the contract.
- Auth, role, menu, and action failures are verified server-side.
- Flyway validates the schema and required reference data without manual database intervention.
- Frontend validation, lint, tests, build, and relevant browser scenarios pass when the change reaches the BFF or UI.
- The task ledger records the exact commands, outcomes, approvals, recovery notes, and remaining risks.

## Immutable Parity Evidence

`docs/spring-migration/**` contains the retained pre-cutover route, schema, mutation, seed, and ownership evidence. Those records are immutable migration evidence, not executable operating instructions. Do not edit them while documenting or implementing current Spring behavior.

## Learning Guide

The Spring implementation is also the learning surface. Start with `backend-spring/docs/java-spring-learning-guide.md`, then read the domain migration notes in `backend-spring/docs/` alongside their source packages and tests.

For each domain, study:

1. The controller and DTO contract.
2. The application service and transaction boundary.
3. The JPA repository or justified MyBatis mapper.
4. A focused unit or controller test.
5. A PostgreSQL integration or locking test when the behavior touches persistence.
6. The corresponding Flyway migration or fixture gate when data ownership matters.

Keep learning notes tied to production code. Do not create toy duplicate implementations or alternate backend runbooks.
