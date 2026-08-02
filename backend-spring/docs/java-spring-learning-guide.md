# Vibe-HR Java/Spring Learning Guide

This guide uses the current Spring Boot/Gradle/Flyway runtime as the source of truth. Any Python,
FastAPI, or Alembic names kept in the repo are historical migration evidence only.

## 1. Start Here

`backend-spring` is a Spring Boot 4.1 / Java 21 modular monolith. It uses Web MVC,
Validation, Security, Data JPA, Actuator, Flyway, MyBatis, springdoc, PDFBox, and PostgreSQL.
The normal Gradle tasks are `test`; `integrationTest` runs only when
`VIBEHR_RUN_CONTAINER_TESTS=true`.

`build.gradle.kts` and `src/main/resources/application.yml` are the best entry points for the
runtime model. `application.yml` keeps `ddl-auto=validate`, snake_case JSON, and Flyway disabled
outside the explicit cutover profile.

### Local Run

```powershell
cd backend-spring
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/vibe_hr"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "<local-password>"
$env:AUTH_TOKEN_SECRET = "<openssl-rand-hex-32-output>"
$env:VIBEHR_BFF_ASSERTION_SECRET = "<different-openssl-rand-hex-32-output>"
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

## 2. Persistence Rule

JPA is the default write path for entity lifecycle work. Use MyBatis only for complex read
projections, reporting shapes, or cross-domain SQL that is clearer or cheaper to express directly.
A feature should have one primary write owner.

The same rule applies to migration work:

- Spring owns runtime behavior.
- Flyway owns schema and required-reference-data changes.
- Python/Alembic names stay frozen as pre-cutover evidence.

## 3. Security Notes

`AUTH_TOKEN_SECRET` and `VIBEHR_BFF_ASSERTION_SECRET` must be distinct 64-character hexadecimal
values generated with `openssl rand -hex 32`.

The edge reverse proxy must strip any client-supplied `x-vibehr-client-ip` header and inject one
canonical value before BFF login requests reach Spring.

## 4. Validation

Backend checks:

```powershell
cd backend-spring
.\gradlew.bat test
$env:VIBEHR_RUN_CONTAINER_TESTS = "true"
.\gradlew.bat integrationTest
.\gradlew.bat migrationIntegrationTest
```

Use the focused test class for the behavior you changed when it keeps the check small and
repeatable.

## 5. Core Reading Order

1. `src/main/java/com/vibehr/VibeHrApplication.java`
2. `src/main/resources/application.yml`
3. `src/main/java/com/vibehr/platform/security/SecurityConfiguration.java`
4. `src/main/java/com/vibehr/payroll/PayrollService.java`
5. `src/main/java/com/vibehr/migration/FlywayAdoptionService.java`
6. `src/test/java/com/vibehr/migration/FlywayOwnershipTransferIntegrationTest.java`

These files show the current runtime shape, the persistence boundary, and the Flyway cutover
model.
