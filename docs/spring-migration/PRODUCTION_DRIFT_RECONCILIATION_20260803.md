# Production Drift Reconciliation — 2026-08-03

Status: clone reconciliation verified; production execution prohibited; V3 cutover blocked by valid scheduling data.

## Evidence boundary

- Source: `/var/backups/vibe-hr/20260803-pre-spring-cutover.dump` restored into `vibehr_reconcile_verify_20260803`.
- The restored `vibehr` schema was renamed to `public` only inside the verification database.
- Production database access remained read-only and no production container, Compose, Nginx, or secret was changed.
- Exact Alembic head: `org_mapping_foundation_20260722`.
- Source catalog fingerprint: `e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1`.
- Frozen V1 fingerprint: `fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e`.
- A fresh V1 on the same PostgreSQL 16.12 instance produced the frozen fingerprint exactly. PostgreSQL environment is not the cause.

## Mechanical drift decision table

| Target | Expected V1 | Restored clone | Classification and decision |
| --- | --- | --- | --- |
| `hri_approval_actor_rules` | `position_keywords_json varchar` before audit columns; V1 CHECK tree | appended as `text`; CHECK tree retained earlier type casts | Incremental/manual drift. Rebuild and losslessly cast to unbounded `varchar`; values unchanged. |
| `org_departments` | organization metadata before active/audit columns | metadata appended after audit columns | Physical ordinal drift only. Types, FK, indexes, and meaning agree. |
| `tim_attendance_daily` | canonical `tim_*` sequence; calculated fields before audit; no calculated-field DB defaults; date/status and employee/date indexes | legacy `hr_*` sequence/constraint names; fields appended; `0`/`false` defaults; two indexes absent | Incremental/manual DDL drift. Existing values satisfy V1; rebuild with canonical ownership/defaults/indexes. |
| `tim_leave_requests` | canonical `tim_*` sequence; decision fields before audit; unbounded comment; timestamp without zone; `decided_by` FK and two indexes | legacy names; fields appended; `varchar(1000)`; `timestamptz`; missing FK/indexes | Incremental/manual drift. All FKs resolve. Python stored UTC-aware values, so UTC normalization is lossless for the Java `Instant` contract. |
| `wel_benefit_requests` | `employee_id` before employee number/name | `employee_id` appended | Physical ordinal drift only. Type, FK, and indexes agree. |
| attendance/leave sequences | canonical `tim_*` names, owners, defaults, and setval | legacy `hr_*` names | Legacy-name drift. Originals move with archived tables; canonical `SERIAL` sequences reset to max ID. |

Column types/nullability/defaults, constraints/FKs, indexes, and sequence names/defaults/ownership/setval were compared separately. Thirty CHECK constraints on 22 other tables differed only in catalog parse-tree representation: earlier `text` columns had been narrowed to `varchar`, retaining element-level casts. Allowed values are identical. The guarded script recreates only those already-enforced CHECK constraints from reviewed V1 expressions.

## Root cause

- `a33aa90` added `hri_approval_actor_rules.position_keywords_json` through bootstrap `ADD COLUMN IF NOT EXISTS`, appending a `text` column.
- `3d2bf9f` repaired live attendance/welfare schema, adding calculated columns with `0`/`false` defaults and appending `employee_id`.
- The leave bootstrap path added `decision_comment varchar(1000)` and `decided_at timestamptz`; Python wrote UTC-aware timestamps.
- Organization metadata was appended by incremental bootstrap/migration changes rather than created in final model order.
- `88356e5` later removed manual repair code because the baseline contained the final model, but existing databases retained their catalog shape.
- Fresh V1 on PostgreSQL 16.12 matches the checked-in manifest. This is not a frozen-manifest capture error; the manifest must not be regenerated from production.

## Guarded reconciliation

The one-shot `pre-adoption-reconciliation` profile requires the exact confirmation and source fingerprint, exact Alembic head, no Flyway history, `current_schema()=public`, no prior archive, a transaction advisory lock, and a serializable transaction. It rejects duplicate keys, invalid CHECK values, orphan FKs, and lossy UTC conversion before rebuilding.

It moves the five source tables and owned sequences to `vibehr_pre_adoption_20260803`, creates canonical V1 tables, copies explicit columns, reconnects inbound FKs, verifies the exact V1 fingerprint, compares protected row counts/checksums, validates sequence next values, and commits only if all checks pass. No source table or row is dropped.

```bash
cd backend-spring
export SPRING_DATASOURCE_URL='jdbc:postgresql://<clone-host>:5432/<clone-db>'
export SPRING_DATASOURCE_USERNAME='<user>'
export SPRING_DATASOURCE_PASSWORD='<password>'
export AUTH_TOKEN_SECRET='<random-at-least-32-bytes>'
export VIBEHR_BFF_ASSERTION_SECRET='<different-random-at-least-32-bytes>'
./gradlew --no-daemon bootRun --args='--spring.profiles.active=pre-adoption-reconciliation --vibehr.migration.reconciliation-confirmation=reconcile-known-production-drift-20260803 --vibehr.migration.expected-source-fingerprint=e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1'
```

This command is for a restored clone only. Production execution requires separate approval.

## Clone data evidence

| Table | Before rows / checksum | After |
| --- | --- | --- |
| `hri_approval_actor_rules` | `4 / c0ede21b6bc89017ec6147e60b785d0e` | identical |
| `org_departments` | `50 / bc2b69de8b2a9dd2b2d0d810ce8b2d18` | identical |
| `tim_attendance_daily` | `30074 / 02efa239e4ced3c4f18706d77a60b9b6` | identical |
| `tim_leave_requests` | `6003 / 2b640d91e617c39814dcf2b96a9385b9` | identical after UTC-normalized serialization |
| `wel_benefit_requests` | `3005 / bdbcb0aa2040f2909c2befc98a99d522` | identical |

Sequence next/max evidence: actor rules `5/4`, departments `51/50`, attendance `30075/30074`, leave `6004/6003`, welfare `3006/3005`.

## Adoption result and cutover blocker

Flyway adoption succeeded with exactly V1 `BASELINE` and V2 `SQL`; V2 checksum is `-1027260723`, and `alembic_version` is absent.

V3 rolled back completely with PostgreSQL `21000`: `ON CONFLICT DO UPDATE command cannot affect row a second time` at the `tim_department_schedule_assignments` ID mapping. The clone has two active assignments for every department: 100 rows across 50 departments, effective `2026-01-01` and `2026-03-01`. This is a valid application contract: runtime resolution orders active effective assignments by priority, effective date, and ID. V3 instead joins reference rows to every active target using only department and active status, emitting each source ID twice.

Changing those business rows, choosing an arbitrary winner, or modifying frozen V3 exceeds this task's safety constraints. Validation stopped at V1/V2. V3-V5, Hibernate validation, readiness, OpenAPI, and authenticated smoke are not claimed.

## Rollback and restore

- A failed reconciliation rolls back its whole transaction. Before adoption, the archive preserves every original table/sequence for reviewed transactional recovery.
- After adoption, do not reverse DDL or edit Flyway history. Recreate the verification DB from `/var/backups/vibe-hr/20260803-pre-spring-cutover.dump`.
- Never use Flyway `repair`, `clean`, reverse DDL, or partial dual-write routing.

## Approval needed

Choose and explicitly approve one design before continuing the clone cutover:

1. A reviewed pre-V3 bridge that temporarily makes the 50 older assignments inactive during V3 and restores exact checksums immediately afterward; or
2. A policy exception to replace V3 with a corrected, newly checksummed migration before any production adoption.

No production action should occur until the chosen design passes the same restored-backup test.
