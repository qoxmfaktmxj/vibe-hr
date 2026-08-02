# Organization Java Migration

## Scope and ownership

`com.vibehr.organization` is the final JPA write owner for `org_corporations`, `org_departments`, `org_mapping_type_items`, `org_mapping_assignments`, `org_dept_change_histories`, `org_restructure_plans`, and `org_restructure_plan_items`.

`OrganizationReferenceReadMapper` reads `auth_users`, `hr_employees`, `hr_personnel_histories`, `app_code_groups`, and `app_codes` as typed MyBatis projections. Those tables retain their one authoritative owners (`auth`, HR, and `commoncode`); organization has no partial entity, repository, or write path for them. The mapper remains within `OrganizationService`'s existing Spring transaction, so deletion guards, personal-status snapshots, code lookups, and audit display contracts are unchanged.

### Table ownership decisions

| Table | Java ownership | PostgreSQL key shape | Foreign keys in current schema evidence | Unique/check/exclusion and index evidence |
| --- | --- | --- | --- | --- |
| `org_corporations` | Full JPA read/write owner | `id integer` primary key | None | `uq_org_corporations_enter_cd`, `uq_org_corporations_company_code`; non-unique lookup indexes `ix_org_corporations_enter_cd`, `ix_org_corporations_company_code` |
| `org_departments` | Full JPA read/write and tree owner | `id integer` primary key; `parent_id integer` | Self-reference `parent_id -> org_departments.id` | Unique index `ix_org_departments_code`; no separate named unique constraint in the baseline snapshot |
| `org_mapping_type_items` | Full JPA temporal item owner | `id integer` primary key | Named `created_by` and `updated_by` references to `auth_users`, both `ON DELETE SET NULL` | `uq_org_mapping_type_items_id_type`, `ck_org_mapping_type_items_date_order`, `ex_org_mapping_type_items_period`, `ix_org_mapping_type_items_type_item_from` |
| `org_mapping_assignments` | Full JPA temporal assignment and upload owner | `id integer` primary key | Named department, composite `(item_id,type_code)`, created-by, and updated-by foreign keys with the migration's exact delete rules | `ck_org_mapping_assignments_date_order`, `ex_org_mapping_assignments_period`, `ix_org_mapping_assignments_department_type_from`, `ix_org_mapping_assignments_item_id` |
| `org_dept_change_histories` | Append/read owner; entries are written only with department mutations | `id integer` primary key | Baseline department and optional auth-user references | `ix_org_dept_change_histories_changed_at`, `ix_org_dept_change_histories_department_id`, `ix_org_dept_change_histories_dept_changed` |
| `org_restructure_plans` | Full JPA plan lifecycle owner | `id integer` primary key | Baseline `created_by` and optional `applied_by` references to `auth_users` | `ck_org_restructure_plans_status`, `ix_org_restructure_plans_status_created` |
| `org_restructure_plan_items` | Full JPA plan-item lifecycle owner | `id integer` primary key | Baseline plan, target-department, and new-parent references | `ck_org_restructure_plan_items_action`, `ck_org_restructure_plan_items_status`, `ix_org_restructure_plan_items_plan`, `ix_org_restructure_plan_items_plan_id` |

All organization scalar IDs remain Java `Long` at the HTTP/application boundary but use Hibernate `SqlTypes.INTEGER`, matching the Alembic/PostgreSQL `int4` columns. Baseline organization timestamps map to `timestamp without time zone`; mapping-foundation audit timestamps map to `timestamp with time zone`. This distinction is validated by the live fixture.

## Canonical route coverage

All 35 routes from `backend/app/api/organization.py` are represented by `OrganizationController`:

| # | Route |
| --- | --- |
| 1 | `GET /corporations` |
| 2 | `POST /corporations` |
| 3 | `PUT /corporations/{corporation_id}` |
| 4 | `DELETE /corporations/{corporation_id}` |
| 5 | `GET /departments` |
| 6 | `GET /chart` |
| 7 | `GET /mapping-types` |
| 8 | `GET /mapping-assignments` |
| 9 | `POST /mapping-assignments` |
| 10 | `GET /mapping-assignments/upload-template` |
| 11 | `POST /mapping-assignments/upload-preview` |
| 12 | `POST /mapping-assignments/upload-confirm` |
| 13 | `PUT /mapping-assignments/{assignment_id}` |
| 14 | `DELETE /mapping-assignments/{assignment_id}` |
| 15 | `GET /mapping-personal-status` |
| 16 | `GET /mapping-type-items` |
| 17 | `POST /mapping-type-items` |
| 18 | `PUT /mapping-type-items/{item_id}` |
| 19 | `DELETE /mapping-type-items/{item_id}` |
| 20 | `GET /mapping-type-options` |
| 21 | `GET /mapping-item-options` |
| 22 | `GET /department-options` |
| 23 | `POST /departments` |
| 24 | `PUT /departments/{department_id}` |
| 25 | `DELETE /departments/{department_id}` |
| 26 | `GET /dept-history` |
| 27 | `GET /restructure/plans` |
| 28 | `POST /restructure/plans` |
| 29 | `PUT /restructure/plans/{plan_id}` |
| 30 | `DELETE /restructure/plans/{plan_id}` |
| 31 | `POST /restructure/plans/{plan_id}/apply` |
| 32 | `GET /restructure/plans/{plan_id}/items` |
| 33 | `POST /restructure/plans/{plan_id}/items` |
| 34 | `PUT /restructure/plans/{plan_id}/items/{item_id}` |
| 35 | `DELETE /restructure/plans/{plan_id}/items/{item_id}` |

The controller test mechanically asserts the complete 35-route set. It also covers the source-specific authorization differences: corporations are role-only, chart is menu-action-only, and mapping mutations require both role and `save` action.

## Mutation transaction decisions

Every row below uses Spring `@Transactional` with propagation `REQUIRED`, the datasource's PostgreSQL `READ COMMITTED` default, and no automatic application retry. A caller may retry only according to the idempotency column; the service never hides serialization or integrity failures with an internal retry loop.

| Mutation | JPA operation and transaction scope | Lock/isolation decision | Retry and idempotency decision | Conflict decision |
| --- | --- | --- | --- | --- |
| `POST /corporations` | Persist and flush one corporation | No row exists to lock; database unique constraints close the race | No retry; non-idempotent without a client key | Duplicate normalized `enter_cd`/`company_code` or raced integrity failure returns `409` |
| `PUT /corporations/{id}` | Load, patch supplied non-null fields, flush | Corporation `PESSIMISTIC_WRITE` | No retry; final field state is repeatable, but `updated_at` changes | Missing row `404`; duplicate codes/integrity race `409` |
| `DELETE /corporations/{id}` | Remove and flush | Corporation `PESSIMISTIC_WRITE` | No retry; repeat after success is `404` | FK/integrity conflict `409` |
| `POST /departments` | Validate parent, persist, flush | Parent `PESSIMISTIC_READ` when supplied | No retry; non-idempotent | Duplicate code/integrity race `409`; invalid parent `400` |
| `PUT /departments/{id}` | Patch and append changed-field history in one transaction | Department `PESSIMISTIC_WRITE`; parent `PESSIMISTIC_READ`; tree rechecked | No retry; same values add no duplicate history, although `updated_at` changes | Missing `404`; duplicate code `409`; self/cycle `400` |
| `DELETE /departments/{id}` | Check children/employees, then remove and flush | Department `PESSIMISTIC_WRITE` | No retry; repeat after success is `404` | Child or employee reference `409` |
| `POST /mapping-type-items` | Validate period, persist, flush | Native `FOR UPDATE` on existing `(type_code,item_code)` rows | No retry; non-idempotent | Application overlap or GiST/other integrity race `409` |
| `PUT /mapping-type-items/{id}` | Validate final period/reference rules, patch, flush | Item `PESSIMISTIC_WRITE` plus native temporal-group `FOR UPDATE` | No retry; final field state repeatable, `updated_at` changes | Missing `404`; overlap/reference/integrity conflict `409`; bad date order `422` |
| `DELETE /mapping-type-items/{id}` | Reference check, remove, flush | Item `PESSIMISTIC_WRITE` | No retry; repeat after success is `404` | Referenced item or integrity race `409` |
| `POST /mapping-assignments` | Validate department/item/containment/period, persist, flush | Department `PESSIMISTIC_READ`; native assignment-group `FOR UPDATE` | No retry; non-idempotent | Missing/inactive reference as source contract; overlap or GiST/integrity race `409` |
| `PUT /mapping-assignments/{id}` | Validate final assignment, patch, flush | Assignment `PESSIMISTIC_WRITE`, department `PESSIMISTIC_READ`, temporal-group `FOR UPDATE` | No retry; final field state repeatable, `updated_at` changes | Missing `404`; containment/overlap/integrity conflict follows source `409`/validation detail |
| `DELETE /mapping-assignments/{id}` | Remove and flush | Assignment `PESSIMISTIC_WRITE` | No retry; repeat after success is `404` | Integrity race `409` |
| `POST /mapping-assignments/upload-confirm` | Validate whole batch, lock groups, revalidate, upsert all rows, flush once | Native `FOR UPDATE` for every affected `(department_id,type_code)` group | No retry; idempotent final state by `(department,type,effective_from)`, repeat reports updates | Any invalid/raced overlap returns source-shaped `422`; the transaction rolls back all rows |
| `POST /restructure/plans` | Persist and flush one draft | No row exists to lock | No retry; non-idempotent | Integrity failure `409` |
| `PUT /restructure/plans/{id}` | Validate lifecycle, patch non-null fields, flush | Plan `PESSIMISTIC_WRITE` | No retry; final state repeatable, `updated_at` changes | Missing `404`; applied/cancelled `409`; invalid direct status `400` with exact Korean detail |
| `DELETE /restructure/plans/{id}` | Delete items then plan in one transaction | Plan `PESSIMISTIC_WRITE` | No retry; repeat after success is `404` | Applied plan `409`; integrity failure `409` |
| `POST /restructure/plans/{id}/apply` | Apply all pending items, histories, departments, and plan state in one transaction | Plan and pending items `PESSIMISTIC_WRITE`; touched departments/parents `PESSIMISTIC_WRITE` | No retry; conflict-on-repeat is the canonical idempotency contract (`409`) | Applied/cancelled plan `409`; per-item source `ApiException` becomes a persisted skipped item/message |
| `POST /restructure/plans/{id}/items` | Validate lifecycle/action, persist, flush | Plan `PESSIMISTIC_WRITE` | No retry; non-idempotent | Missing target `404`; invalid action requirements `400`; closed plan/integrity `409` |
| `PUT /restructure/plans/{id}/items/{itemId}` | Patch non-null fields and flush | Plan and item `PESSIMISTIC_WRITE` | No retry; final state repeatable, `updated_at` changes | Missing item `404`; applied item or closed plan `409` |
| `DELETE /restructure/plans/{id}/items/{itemId}` | Remove item and flush | Plan and item `PESSIMISTIC_WRITE` | No retry; repeat after success is `404` | Closed plan/integrity conflict `409` |

The two preview routes are read-only validation and therefore are not mutation rows. Mapping intervals are closed at both ends; `2026-06-30` overlaps another period ending on `2026-06-30`, while `2026-07-01` does not. Java uses Python's `date.max` equivalent `9999-12-31`, not Java `LocalDate.MAX`.

## Java implementation learning notes

- Every physical table has a single authoritative JPA entity owner. Cross-domain reads use package-local typed MyBatis projections rather than scalar reference entities, so ORM metadata cannot claim a foreign table and Hibernate validation remains unambiguous.
- `@Transactional` service methods are the only write boundary. `PESSIMISTIC_WRITE` protects editable plans and temporal mapping groups, with the existing PostgreSQL exclusion constraints as the final concurrency guard.
- Hibernate `IDENTITY` may execute an insert during `persist`, before an explicit `flush`. Creation and upload paths therefore translate `PersistenceException` around both operations so a raced constraint remains an ORG contract response and still marks the transaction for rollback.
- Mutable patch DTOs record `@JsonSetter` presence separately from values. This is required for Python parity: explicit `null` clears `parent_id`, mapping `effective_to`, and selected mapping metadata, while non-null-only Python branches treat explicit `null` like omission.
- `OrganizationReferenceReadMapper` is deliberately narrow: it only replaces foreign-table reads needed for employee deletion guards, department counters, personal-status snapshots, code lookups, and audit display names. Each SQL shape has a PostgreSQL Testcontainers regression test; organization write aggregates and locks remain JPA.

## PostgreSQL schema evidence and gaps

`OrganizationPostgreSqlSchemaIntegrationTest` is tagged `integration` and self-provisions PostgreSQL 16 through Testcontainers. Its test-only fixture combines the baseline snapshot's corporation/department/history/restructure DDL with `org_mapping_foundation_20260722`, plus only the five minimal cross-domain reference tables needed by the organization entity scan. Spring boots that isolated package with Hibernate `ddl-auto=validate`. The tests assert all seven owned tables, `integer` identifiers, timestamp flavors, all 14 evidenced foreign keys, all named unique/check/exclusion constraints, every current organization index, unique department-code behavior, and SQLState `23P01` from the GiST guard. They also exercise application transactions for concurrent assignment creation, atomic upload rejection and idempotent final state, closed temporal overlap, null/omitted patches, concurrent/repeat restructure apply, exact Korean response messages, and persisted audit strings.

This fixture does **not** run the application's full Spring/Flyway migration chain, provision the other tables in the 105-table generated ledger, or validate complete definitions for the five referenced auth/HR/code tables. It therefore proves the organization package against faithful current ORG schema evidence, but it does not replace the repository-wide full-schema gate. Run `./gradlew.bat migrationIntegrationTest --rerun-tasks` from `backend-spring` for the disposable PostgreSQL 16 Flyway V1-V5 and Hibernate-validation check.

The retired Alembic schema is immutable pre-cutover comparison evidence captured in `docs/spring-migration`; it is not an executable Spring operating instruction.
