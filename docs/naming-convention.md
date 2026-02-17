# Vibe-HR Database Naming Rules

## Core Rule
Use: `<schema>.<plural_table_name>`

Examples:
- `auth.users`
- `auth.roles`
- `org.departments`
- `hr.employees`

## Decision: plural vs singular
- Chosen: **plural**
- Reason: a table is a set/collection, and the query style stays natural.

## Consistency Checklist
- Table names: plural `snake_case`
- Columns: singular meaning + `_id` for foreign keys
- Join tables: plural plural pattern (`user_roles`)
- Constraint names: `pk_`, `fk_`, `uq_`, `ck_`, `idx_` prefixes
