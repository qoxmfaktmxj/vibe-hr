# Vibe-HR

PostgreSQL-first schema baseline for the Vibe-HR project.

## Naming Convention

- Use lowercase `snake_case`.
- Use plural table names (`users`, `departments`, `employees`) for collection semantics.
- Use business schemas for domain boundaries: `auth`, `org`, `hr`.
- Primary key column: `id`.
- Foreign key column: `<target>_id`.
- Prefix constraints/indexes with table-aware names (`fk_*`, `uq_*`, `ck_*`, `idx_*`).

## Why plural table names?

Both singular and plural are valid in practice. This repository uses **plural** because each table stores a collection of records and reads naturally in SQL (`SELECT * FROM hr.employees`).

## Quick Start (PostgreSQL)

```sql
\i db/migrations/001_init_vibe_hr.sql
```

The script creates schemas, tables, constraints, indexes, and table/column comments.
