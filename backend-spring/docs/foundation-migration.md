# Foundation FastAPI To Spring Mapping

> **Frozen source evidence:** Python/FastAPI and Alembic names in this document describe the
> pre-cutover contract only. Spring Boot, Gradle, Flyway, and the Next.js BFF are the active
> runtime stack; do not run Python or Alembic from this guide.

This migration owns the 37 non-health Foundation endpoints under `/api/v1`.
It preserves FastAPI snake_case JSON, status codes, error `detail` bodies, role checks, and
menu action enforcement. No Flyway migration or schema change is included.

| Frozen Python router evidence | Frozen Python functions | Java entry point | Persistence choice |
| --- | --- | --- | --- |
| `app/api/auth.py` (7) | `enter_cds`, `login`, `me`, `refresh`, `get_impersonation_users`, `impersonation_login`, `social_exchange` | `auth.AuthController`, `auth.AuthService` | JPA for `auth_*` and the social-onboarding write; typed MyBatis reads for corporation/department projections |
| `app/api/menu.py` (18) | `menu_tree`, `current_menu_actions`, admin menu CRUD, role CRUD, role/menu matrices, action matrix | `menu.MenuController`, `menu.MenuPermissionService` | JPA for CRUD and replacement transactions; MyBatis only for role-filtered tree and action projections |
| `app/api/common_code.py` (9) | group/item list, create, update, delete, and active options | `commoncode.CommonCodeController`, `commoncode.CommonCodeService` | JPA |
| `app/api/system_setting.py` (2) | `auth_session_policy_get`, `auth_session_policy_update` | `systemsettings.SystemSettingController`, `AuthSessionPolicyService` | JPA, including setting history writes |
| `app/api/dashboard.py` (1) | `summary` | `dashboard.DashboardController`, `DashboardService` | One typed MyBatis count projection across HR, organization, and time tables |

## Authentication And Authorization

`JwtAuthenticationFilter` verifies the existing HS256 JWT contract, requires `sub`, `iat`,
`exp`, and `iss`, then loads an active `auth_users` record and its role codes. Missing Bearer
credentials produce `401 {"detail":"Not authenticated."}`; an invalid token or inactive user
produces `401 {"detail":"Invalid access token."}`. Admin endpoints check `admin`, and common
code endpoints additionally call the `/settings/common-codes` `query` or `save` action policy.

## JPA Versus MyBatis

Each physical table has one authoritative JPA entity owner: `auth` owns `auth_*`, `commoncode`
owns `app_code_*`, organization owns `org_*`, HR owns `hr_*`, and time owns `tim_*`. A feature
that only needs another domain's data must not add a partial entity or repository for that table.

JPA is the default persistence path for lifecycle rows that are created, updated, deleted, or
locked by the endpoint contract. Use MyBatis only for complex cross-domain read projections,
role grants, active corporation/department reads, and aggregate counts where explicit SQL is
clearer or cheaper than forcing the shape through JPA. Social onboarding uses `AuthService`'s JPA
write path without introducing a second HR entity mapping.

## Test Modes

Unit and MockMvc tests run under the normal Gradle `test` task. PostgreSQL checks use the
`integration` JUnit tag and run only through `integrationTest` when
`VIBEHR_RUN_CONTAINER_TESTS=true`; they use disposable Testcontainers infrastructure and never
alter the shared application database.

## Validation Compatibility

The bounded MVC security slice verifies FastAPI-shaped 422 responses for a missing required query
parameter, integer conversion failure, a `@Min` violation with the original query string, and
malformed JSON. For these cases, `loc` and `input` match the current FastAPI fixtures: including
`["query", "page"]` with `null`, `"abc"`, or `"0"`, and `["body", 15]` with `{}` for the
fixture body `{"employee_no":`.

This is not a claim of complete Pydantic taxonomy parity. Body field constraints still use Spring
validation types and messages, generic non-integer conversion falls back to `value_error`, and
the FastAPI `ctx` object is not emitted yet. Nested models, lists, unions, headers, paths, and
all Pydantic-specific validation codes need endpoint-specific compatibility work as those routes
migrate.

## Coexistence Environment Contract

The Spring datasource uses only `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and
`SPRING_DATASOURCE_PASSWORD`. The retired Python `DATABASE_URL` and its `postgresql+psycopg://`
form are frozen evidence only and are not accepted runtime configuration.
