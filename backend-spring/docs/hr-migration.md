# HR Migration

## Scope And Ownership

This slice is the final JPA write owner for `hr_employees` and the HR-prefixed tables used by the employee, basic records, recruitment, appointment, retirement, and severance workflows. Cross-domain auth, organization, code, and payroll data is accessed by scalar IDs or explicit PostgreSQL projections; it is not re-owned by this package. Existing read-only `hr_employees` projections in auth, dashboard, appraisal, and training remain temporary duplicates outside this slice.

The implemented HTTP inventory is exactly 43 canonical routes:

- `7` `/employees` routes from `employee.py`.
- `6` `/hr/basic` routes.
- `7` `/hr/recruit/finalists` routes.
- `4` `/hr/appointment-codes` routes.
- `5` `/hr/appointments` routes.
- `9` `/hr/retire` routes.
- `5` `/hr/severance/calcs` routes.

`/pay/severance-item-rules` and `/pay/severance-item-rules/batch` are intentionally excluded. They are the two payroll-owned routes in `hr_severance.py`, so including them would turn the requested HR contract into 45 routes and violate the assigned HR-only ownership boundary.

## Behavior And Concurrency

- Employee create/update/delete preserves role and `/hr/employee` menu-action checks. Create and finalist-to-employee conversion use the existing PBKDF2 hash format and create the `employee` role link when it exists.
- Recruitment uses PostgreSQL transaction advisory locks for candidate and employee-number allocation. Repeat finalist-to-employee requests reconcile an existing employee rather than creating a duplicate.
- Appointment confirmation, retirement case transitions, and severance confirmation load their aggregate with `PESSIMISTIC_WRITE`; repeated terminal transitions return the legacy `409` conflict. Confirmation synchronizes linked finalists to `appointed`.
- Retirement confirm/cancel creates history and audit records and updates the employee/profile atomically. A retirement confirmation creates one idempotent severance snapshot for its case.
- The employee grid uses MyBatis because it is a cross-domain, dynamically filtered PostgreSQL projection. Aggregate writes stay JPA-owned.

## Numeric Compatibility

`hr_severance_calcs` remains mapped as legacy `Double` storage and API output. The calculation core uses `BigDecimal` with `DECIMAL128` only during arithmetic, then returns the existing double representation. The focused parity test locks inclusive service-day, three-month wage-window, and numeric-output behavior before any later storage migration.

## Schema And Default Decisions

The final Alembic schema has no persistent server defaults on HR business columns. Identity values are database-generated; all Python `Field(default=...)` and `default_factory=utc_now` behavior is supplied by typed request defaults and the transactional service before JPA persistence. The temporary zero defaults added while backfilling the phase-two severance tax columns are removed by the same Alembic revision and are not represented as JPA column defaults.

| Authoritative table | Required values without an application default | Application default parity | JPA/schema decision |
| --- | --- | --- | --- |
| `hr_employees` | `user_id`, `employee_no`, `department_id`, `position_title`, `hire_date` | `employment_status=active`; `created_at`/`updated_at=now` | Identity `id`; named user/employee-number unique constraints and status check; service supplies all defaults before persist. |
| `hr_employee_basic_profiles` | `employee_id` | `created_at`/`updated_at=now` | One row per employee; every profile field is nullable and patch omission is distinct from explicit null. |
| `hr_employee_info_records` | `employee_id`, `category` | `created_at=now` | Append-only basic/appointment/retirement record; optional content stays nullable. |
| `hr_contact_points` | `employee_id` | `seq=1`, `is_primary=false`, timestamps `=now` | Sequence is resolved under the employee mutation lock; all contact details and actor IDs are nullable. |
| `hr_careers` | `employee_id` | `seq=1`, model fallback `career_scope=EXTERNAL`, `is_current=false`, timestamps `=now` | Scope check is authoritative. Record mutations derive/preserve `INTERNAL` or `EXTERNAL` from category/type instead of applying the fallback indiscriminately. |
| `hr_licenses` | `employee_id` | `seq=1`, `allowance_yn=false`, timestamps `=now` | Legacy allowance rate/amount remain nullable `Double`; no rounding or storage conversion is introduced. |
| `hr_military` | `employee_id` | `seq=1`, `special_case_yn=false`, timestamps `=now` | Optional service/detail fields remain nullable. |
| `hr_reward_punish` | `employee_id`, `reward_punish_type` | `seq=1`, `status=DRAFT`, timestamps `=now` | Named type/status checks are retained; amount remains nullable `Double`. |
| `hr_appointment_orders` | `appointment_no`, `title`, `effective_date` | `status=draft`, timestamps `=now` | Appointment number is unique; confirmation metadata remains nullable until transition. |
| `hr_appointment_order_items` | `order_id`, `employee_id`, `action_type`, `start_date` | `appointment_kind=permanent`, `apply_status=pending`, timestamps `=now` | Named kind/status/temporary-end-date checks and order/employee uniqueness are retained. |
| `hr_personnel_histories` | `employee_id`, `history_type`, `source_table`, `source_id`, `effective_date` | `created_at=now` | HR is the authoritative full mapping; optional field-level before/after data permits one no-change history row. |
| `hr_retire_checklist_items` | `code`, `title` | `is_required=true`, `is_active=true`, `sort_order=0`, timestamps `=now` | Code is unique; updates preserve omitted fields. |
| `hr_retire_cases` | `employee_id`, `retire_date` | `status=draft`, timestamps `=now` | Transition actor/time, previous status, reason, and cancellation fields remain nullable until their lifecycle step. |
| `hr_retire_case_items` | `case_id`, `checklist_item_id` | `is_required=true`, `is_checked=false`, timestamps `=now` | Case/checklist pair is unique; checked actor/time is nullable when unchecked. |
| `hr_retire_audit_logs` | `case_id`, `action_type` | `created_at=now` | Append-only audit detail and actor remain nullable exactly as the source model. |
| `hr_recruit_finalists` | `candidate_no`, `full_name` | `source_type=manual`, `hire_type=new`, `status_code=draft`, `is_active=true`, timestamps `=now` | Candidate/external keys and lifecycle checks are retained; generated employee/login IDs are application values, not database defaults. |
| `hr_severance_calcs` | `retire_case_id`, `employee_id`, `hire_date`, `retire_date` | Numeric snapshot fields `=0`, `status=draft`, timestamps `=now` | One calculation per retirement case. Legacy numeric columns remain `double precision`; `tax_detail_json` stays nullable text and phase-two backfill server defaults are removed. |

## Mutation Decisions

Every row below is one state-changing route unless marked internal. `Transaction` means one Spring use-case transaction; a thrown API or persistence exception rolls back that complete boundary.

| Mutation | Transaction and lock decision | Retry and idempotency decision |
| --- | --- | --- |
| `POST /api/v1/employees` | One transaction across `auth_users`, role link, and `hr_employees`; uniqueness is enforced by pre-checks and database constraints. | Not idempotent; duplicate login, email, or employee number returns `409`. |
| `POST /api/v1/employees/batch` | One atomic transaction for delete, update, then insert; delete IDs are sorted and affected employees are `PESSIMISTIC_WRITE` locked. | The whole batch rolls back on any error; replay follows normal create/conflict semantics rather than silently duplicating rows. |
| `PUT /api/v1/employees/{employee_id}` | Employee row is `PESSIMISTIC_WRITE` locked while HR and auth values are updated. | Deterministic patch replay is safe; omitted fields are untouched and explicit null follows the typed contract. |
| `DELETE /api/v1/employees/{employee_id}` | Employee is locked before dependent cleanup and auth deletion in the same transaction. | Not terminal-idempotent; a replay returns the canonical not-found error. |
| `PUT /api/v1/hr/basic/{employee_id}/profile` | Employee lock serializes profile upsert and linked auth/employee updates. | Patch replay converges; omission and explicit null remain distinct. |
| `POST /api/v1/hr/basic/{employee_id}/records` | Employee lock serializes per-category sequence allocation and record creation. | Not idempotent; each accepted call appends one canonical record. Career scope is derived from the requested category/type. |
| `PUT /api/v1/hr/basic/{employee_id}/records/{record_id}` | Employee lock serializes category record mutation and validates employee ownership. | Patch replay converges; career scope is updated when supplied/derived and is never ignored. |
| `DELETE /api/v1/hr/basic/{employee_id}/records/{record_id}` | Single transaction validates category and employee ownership before removal. | Not terminal-idempotent; a replay returns the canonical not-found error. |
| `POST /api/v1/hr/recruit/finalists` | Transaction-scoped PostgreSQL advisory lock serializes candidate-number allocation. | Not idempotent; unique candidate/external-key conflicts are preserved. |
| `PUT /api/v1/hr/recruit/finalists/{finalist_id}` | Finalist row is `PESSIMISTIC_WRITE` locked before lifecycle validation. | Same-value replay converges; invalid or terminal status transitions return canonical `422`. |
| `DELETE /api/v1/hr/recruit/finalists` | Requested finalist rows are write-locked and removed in one transaction. | Missing IDs are ignored when at least one row exists; replay after all rows are gone returns the canonical not-found error. |
| `POST /api/v1/hr/recruit/finalists/if-sync` | Candidate-number advisory lock serializes external-key upsert and allocation. | Idempotent by unique `external_key`: replay updates the existing finalist rather than inserting another. |
| `POST /api/v1/hr/recruit/finalists/generate-employee-no` | Finalists are locked in sorted ID order and employee-number allocation uses a transaction advisory lock. | Idempotent per finalist; rows already holding a number are reported as skipped. |
| `POST /api/v1/hr/recruit/finalists/create-employees` | Finalists are locked in sorted ID order; employee-number allocation is advisory-locked and each conversion reconciles auth/employee linkage. | Idempotent per finalist; already appointed or already linked rows are skipped/reconciled and row results preserve canonical errors. |
| `POST /api/v1/hr/appointment-codes` | One transaction creates/finds the HR appointment code group and inserts its code; database group/code uniqueness is final arbitration. | Not idempotent; duplicate code returns `409`. |
| `PUT /api/v1/hr/appointment-codes/{code_id}` | One transaction validates group ownership and updates the code row. | Patch replay converges; conflicting renamed code returns `409`. |
| `DELETE /api/v1/hr/appointment-codes/{code_id}` | One transaction validates appointment-group ownership before delete. | Not terminal-idempotent; replay returns not found. |
| `POST /api/v1/hr/appointments/records` | Employee write lock protects overlap checks; appointment-number allocation uses a transaction advisory lock; order and item persist atomically. | Not idempotent; supplied/generated appointment number uniqueness returns `409` on duplicate. |
| `PUT /api/v1/hr/appointments/records/{item_id}` | Item, order, and target employee are `PESSIMISTIC_WRITE` locked; only draft orders mutate. | Patch replay converges; confirmed/cancelled order mutation returns `409`. |
| `DELETE /api/v1/hr/appointments/records/{item_id}` | Item and order are write-locked; deleting the last item also removes its draft order atomically. | Not terminal-idempotent; replay returns not found. |
| `POST /api/v1/hr/appointments/orders/{order_id}/confirm` | Order, ordered items, and affected employees are write-locked; employee changes, history/info rows, finalist synchronization, and terminal status commit together. | Deliberately conflict-idempotent: exactly one confirmation succeeds and every replay returns the canonical `409`. |
| `POST /api/v1/hr/retire/checklist` | One transaction inserts a unique normalized checklist code. | Not idempotent; duplicate code returns `409`. |
| `PUT /api/v1/hr/retire/checklist/{checklist_item_id}` | Checklist row is `PESSIMISTIC_WRITE` locked. | Patch replay converges. |
| `POST /api/v1/hr/retire/cases` | Employee write lock serializes eligibility; case, checklist snapshots, and create audit commit together. | Not idempotent; each accepted request creates a separate case. |
| `PUT /api/v1/hr/retire/cases/{case_id}/items/{case_item_id}` | Case and case-item rows are write-locked; only draft cases mutate and audit is atomic. | Same check state converges while still appending the source-compatible audit action for the accepted mutation. |
| `POST /api/v1/hr/retire/cases/{case_id}/confirm` | Case and employee are write-locked; case/profile/employee, retirement info/history, and audit commit together before publishing the event. | Deliberately conflict-idempotent: one draft-to-confirmed transition succeeds; replay returns `409`. |
| `POST /api/v1/hr/retire/cases/{case_id}/cancel` | Confirmed case and employee are write-locked; restored status/profile, cancellation info/history, and audit commit together. | Deliberately conflict-idempotent: one confirmed-to-cancelled transition succeeds; replay returns `409`. |
| `POST /api/v1/hr/severance/calcs/{calc_id}/recalculate` | Calculation is write-locked; retirement case is read-locked and employee is write-locked while the snapshot is replaced. | Draft/reviewed replay recalculates from current paid payroll; confirmed calculations return `409`. |
| `PUT /api/v1/hr/severance/calcs/{calc_id}` | Calculation is write-locked while adjustment, tax, warning, and final/net amounts are recomputed. | Same adjustment replay converges; confirmed calculations return `409`. |
| `POST /api/v1/hr/severance/calcs/{calc_id}/confirm` | Calculation is `PESSIMISTIC_WRITE` locked through the terminal transition. | Deliberately conflict-idempotent: concurrent/repeated confirmation yields one success and canonical `409` losers. |
| Internal retirement-to-severance draft | `AFTER_COMMIT` event starts `REQUIRES_NEW`, then write-locks retirement case and employee; the unique retirement-case constraint is final arbitration. | Idempotent by `retire_case_id`; repeated event delivery leaves exactly one draft snapshot and cannot roll back retirement confirmation. |

## Verification Evidence

- `./gradlew.bat compileJava --no-daemon` compiles the complete Spring source set.
- `./gradlew.bat test --tests "com.vibehr.hr.*" --no-daemon` runs the focused controller, route, validation, locking, and severance math suites. `HrValidationContractTest` proves FastAPI-shaped `422` details, nested indexed locations, and omitted-versus-explicit-null behavior.
- `node scripts/spring-migration/spring-route-coverage.js` followed by `--verify` proves exactly `7` employee and `36` HR canonical routes with no extras, duplicates, or unresolved annotations.
- `node scripts/spring-migration/spring-schema-coverage.js` followed by `--verify` proves all `17` HR-owned tables and their columns are mapped. Generated global ledgers are produced only by these commands and are never hand-edited.
- `VIBEHR_RUN_CONTAINER_TESTS=true ./gradlew.bat integrationTest --tests "com.vibehr.hr.HrPostgreSqlSchemaIntegrationTest" --no-daemon` self-provisions `postgres:16-alpine`. It verifies named HR constraints/indexes and legacy `double precision`, executes the MyBatis employee grid, derives and updates career scope, proves retirement/appointment history and info rows plus finalist sync, exercises severance tax fallback/warnings/snapshot idempotency, and races concurrent severance confirmations through real PostgreSQL locks.

## Integration Boundaries

`HrEmployee` and `HrPersonnelHistory` are the authoritative full JPA mappings for `hr_employees` and `hr_personnel_histories`. Removal of temporary read entities in auth, dashboard, organization, time, appraisal, and training is central integration work; this package neither modifies nor relies on those duplicate classes. Cross-domain support tables used by HR transactions remain scalar/native-query dependencies and are created only as minimal disposable fixtures inside the PostgreSQL integration test.

No HR-owned route, schema-column, default, mutation, validation, locking, idempotency, or tested behavior gap remains in this migration slice.
