# FastAPI Shared Database Mode

> **Historical pre-cutover archive. Do not execute these instructions.** This document preserves
> the retired FastAPI/Alembic shared-database design as migration evidence. The current runtime is
> Spring Boot with Flyway as the sole schema and required-reference-data owner; do not run FastAPI
> `create_all()`, startup seeding, or Alembic against an active environment.

## Purpose

Set `SHARED_DATABASE_MODE=true` when FastAPI connects to a PostgreSQL database
whose schema lifecycle is owned by the Spring application. This preserves normal
legacy behavior by default: when the variable is unset or false, FastAPI still
runs `SQLModel.metadata.create_all()` and follows `AUTO_SEED_ON_START`.

## Required Runtime Settings

```dotenv
SHARED_DATABASE_MODE=true
AUTO_SEED_ON_START=false
DATABASE_URL=postgresql+psycopg://fastapi_runtime:REDACTED@host:5432/vibe_hr
```

With shared mode enabled, FastAPI validates the settings before initialization,
logs that schema management and automatic bootstrap are disabled, skips
`SQLModel.metadata.create_all()`, and never invokes bootstrap seeding. Starting
with both `SHARED_DATABASE_MODE=true` and `AUTO_SEED_ON_START=true` fails before
any schema or bootstrap operation.

The FastAPI runtime PostgreSQL role must be DML-only. It must not have `CREATE`,
`ALTER`, `DROP`, database ownership, or schema ownership privileges. Grant only
the table and sequence privileges needed for application reads and writes.

## External Preflight Gates

Spring migration ownership is not verified by FastAPI at runtime. Before either
service starts against the shared database, the release process must independently
confirm the exact expected Alembic head and the approved schema checksum. Those
two checks are external preflight gates; this mode only prevents FastAPI startup
from changing the schema or running bootstrap code.
