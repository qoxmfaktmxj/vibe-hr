# Vibe-HR Architecture

Status: Active
Runtime: Spring Boot 4.1 / Java 21 / PostgreSQL

## System Shape

```text
Browser
  -> Next.js 16 App Router and BFF
  -> Spring Boot 4.1 application
  -> PostgreSQL
```

The Next.js BFF owns browser-facing session forwarding and route proxying. The Spring application owns all API behavior, authorization, transactions, persistence, migrations, fixture gates, health endpoints, and OpenAPI output.

## Repository Boundaries

```text
frontend/        Next.js screens, BFF routes, shared UI, browser tests
backend-spring/  Spring Boot application, Gradle build, Java tests, Flyway migrations
config/          Grid registry and shared configuration
docs/            Active policies, runbooks, and immutable migration evidence
```

Frontend changes stay in `frontend/**`; backend changes stay in `backend-spring/**` unless the task explicitly changes the BFF-to-API contract.

## Spring Backend

The application is a package-by-feature modular monolith below `backend-spring/src/main/java/com/vibehr`:

- `auth`, `menu`, and `platform/security` own authentication and authorization boundaries.
- Domain packages such as `organization`, `hr`, `time`, `payroll`, `hri`, `welfare`, `training`, `appraisal`, and `management` own controllers, application services, and persistence.
- `platform/config`, `platform/error`, `platform/health`, and `platform/openapi` own cross-cutting runtime behavior.
- `migration` owns Flyway adoption and schema-manifest verification; `seed` owns explicitly gated local or demo fixtures.

Controllers define HTTP contracts. Application services own transactions and state transitions. JPA is the default for aggregate lifecycle operations; MyBatis is reserved for named, explicit SQL where projection complexity or PostgreSQL execution characteristics require it. A write use case has one authoritative persistence path.

## Database Ownership

PostgreSQL is the only datastore. Hibernate validates mappings with `ddl-auto=validate`; it never creates schema at runtime. Flyway versioned SQL under `backend-spring/src/main/resources/db/migration` is the schema and required-reference-data owner. Local/demo data is permitted only through the explicit fixture gate and never starts automatically in production.

Schema, seed, payroll, authentication, and authorization changes are R3. They require explicit approval, focused Gradle coverage, and task-ledger evidence.

## API And Security Contract

The Spring application preserves the frontend-facing `/api/v1/**` contract, snake_case JSON, and `{ "detail": ... }` error shape. Contract changes must name the affected BFF routes and Java controllers together.

Spring Security enforces the bearer-token, active-user, role, menu, and action-permission boundaries. UI visibility is not an authorization control. Sensitive endpoints require server-side enforcement and regression tests for both allowed and denied cases.

Public operational endpoints are `/health`, `/api/v1/health`, and Actuator health probes. Compatibility documentation is served from `/openapi.json`, `/docs`, and `/redoc`.

## Change Rules

- Preserve AG Grid metadata, toolbar order, and `config/grid-screens.json` registration for any grid screen.
- Treat changes that cross `frontend/**` and `backend-spring/**` as API-contract work.
- Keep migrations forward-only and reviewable; do not manually alter Flyway history.
- Use Java unit tests for domain behavior and tagged Testcontainers tests for PostgreSQL-dependent behavior.
- Record commands, outcomes, and remaining risks in `docs/TASK_LEDGER.md`.
