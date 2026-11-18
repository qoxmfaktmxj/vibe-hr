# Vibe-HR Architecture

Runtime in this checkout: a Rust application with axum, Tokio, Serde, SQLx and PostgreSQL. Production rollout is a separate operator decision.

## Request and data flow

```text
Browser (React, AG Grid)
  -> Next.js App Router and BFF
  -> Rust HTTP server (axum on Tokio)
     -> authenticate principal and validate requests
     -> domain authorization and business transactions
     -> SQLx -> PostgreSQL

Rust schema-preflight -> Flyway migrate -> Rust schema-verify -> backend startup
```

The Next.js BFF owns browser cookies, backend targeting, proxy forwarding and social provider callbacks. The Rust process owns the API contract, authorization and business decisions. A privileged action must pass its backend enforcement even when requested directly without an originating screen.

## Repository boundaries

| Location | Responsibility |
| --- | --- |
| `frontend/` | Next.js screens, BFF routes, shared UI and browser tests |
| `backend-rust/src/` | HTTP entry point, domain services, SQLx queries, database commands and typed request/response contracts |
| `backend-rust/resources/` | OpenAPI and same-origin documentation assets |
| `backend-spring/` | Java reference implementation and comparison tests; the canonical Flyway SQL files remain under `src/main/resources/db/migration` |
| `config/` | Grid registry and shared configuration |
| `scripts/rust-migration/`, `docs/rust-migration/` | Reproducible parity checks, reference inventory and reviewed behavior differences |

## Domain and transaction ownership

The runtime is a package-by-feature modular monolith. `security` handles authentication, current account resolution, BFF assertions, nonce consumption, replay cleanup and login throttling. `menu` owns grants and action permissions. `input`, `platform` and `documentation` handle common HTTP behavior. `db` contains explicit database verification, setup and fixture commands.

`organization`, `hr`, `time`, `payroll`, `hri`, `welfare`, `training`, `appraisal` and `management` implement the respective business rules. Common codes, dashboard and session policy have their own handlers. Each write use case owns its SQL transaction, required row or advisory locks and audit writes. The same transaction covers coupled state changes such as leave approval and attendance generation. Preserve the documented post-commit boundary for dependent work such as generating a severance draft after retirement confirmation.

## Database ownership

Flyway owns schema changes and required reference data. The reviewed chain is V1 through V7. The deployment configuration runs the Rust preflight, the Flyway migrator and catalog verification in sequence before starting the backend. The verification reads the versioned catalog manifest and checks the expected additions. The development and demo seed commands require their own opt-in and local database. Preserve stored records and issued-history checksums when changing application runtime.

## API and security contract

The Rust backend preserves `/api/v1/**`, snake_case JSON, the `detail` error envelope, and the existing BFF authentication/cookie contract. Authenticated requests validate the token and active user. Domain handlers enforce role, menu, action and record ownership rules as applicable. Login and social exchange validate the BFF assertion, request binding and replay state. Use distinct JWT and BFF signing secrets supplied through the environment.

Operational surfaces include `/health`, `/api/v1/health` and Actuator-compatible probes. Public documentation includes `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, and `/redoc`. See the [inventory](rust-migration/inventory.md) and [observed differences](rust-migration/business-differences.md) for the distinction between a published route and a verified business outcome.

## Change Rules

- Preserve AG Grid metadata, toolbar order, and `config/grid-screens.json` registration for any grid screen.
- Treat changes that cross `frontend/**` and `backend-rust/**` as API-contract work.
- Keep migrations forward-only and reviewable; do not manually alter Flyway history.
- Use Rust tests for domain behavior, real PostgreSQL for database semantics and the Spring reference when checking migration parity.
- Record commands, outcomes, and remaining risks in `docs/TASK_LEDGER.md`.

## Employee grid query extension

The employee list at GET /api/v1/employees now accepts optional repeated positions and employment_statuses parameters and an inclusive ISO-date hire_date_to parameter. Existing employee_no, name, department, employment_status, active, page, limit and all parameters retain their behavior. The employee screen and its all-row spreadsheet download share the frontend query builder. The employee reader and menu-query gates cover both the screen and its download. Apply the same bound filters to rows and total_count.
