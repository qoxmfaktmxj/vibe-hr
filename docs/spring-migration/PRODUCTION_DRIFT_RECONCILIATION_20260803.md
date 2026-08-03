# Production Drift Reconciliation — 2026-08-03

Status: restored-clone end-to-end verification passed; production execution and push/PR remain prohibited.

## Evidence boundary

- Source: `/var/backups/vibe-hr/20260803-pre-spring-cutover.dump` restored again into the new database `vibehr_reconcile_v3fix_20260803`.
- The restored `vibehr` schema was renamed to `public` only inside the verification database.
- The prior evidence database `vibehr_reconcile_verify_20260803` was retained unchanged at its V1/V2 state.
- Production database access remained read-only and no production container, Compose, Nginx, or secret was changed.
- Exact Alembic head: `org_mapping_foundation_20260722`.
- Source catalog fingerprint: `e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1`.
- Frozen V1 fingerprint: `fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e`.
- A fresh V1 on the same PostgreSQL 16.12 instance produced the frozen fingerprint exactly. PostgreSQL environment is not the cause.

## Permanent-database V3 history decision

Read-only inspection found no successful V3 history in any known permanent Vibe-HR database:

- Production `platform_db`: no `flyway_schema_history` table.
- Prior evidence database `vibehr_reconcile_verify_20260803`: V1 baseline and V2 only; no V3.
- The server's `postgres` maintenance database: no Flyway history.
- Repository deployment/runtime configuration and running containers expose no separate staging or shared-development Vibe-HR datasource.

The corrected V3 was therefore handled as a pre-first-permanent-application migration correction. The successful V3 row in `vibehr_reconcile_v3fix_20260803` belongs only to this disposable restored-copy verification and is not permanent deployment history. Before production approval, repeat the read-only history query for any newly disclosed database; any successful permanent V3 row is a hard stop and forbids changing its checksum.

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

## V3 migration correction

The prior V3 ID-map query joined each canonical department seed row to every active assignment in that department. With two valid active rows, one source ID was emitted twice and PostgreSQL rejected the `ON CONFLICT` statement.

The generator now uses a `JOIN LATERAL` canonical lookup with the same Spring contract: `priority DESC, effective_from DESC, id DESC LIMIT 1`. This affects only the temporary source-ID mapping used by later seed references. It does not update, deactivate, delete, or insert an existing assignment.

- Old V3 SHA-256: `564baf8e350c4e1a001ca992c1cd60c85d7d465c08def23c990b5fa8b9c99ab4`
- Corrected V3 SHA-256: `9e964bf96d864a7ef8f0a3114d3a6f27a6c187fed94031c8e0d92a6da51f0dcc`
- Corrected Flyway V3 checksum: `720383589`
- Corrected seed-manifest SHA-256: `ea9ab1e883bc626bab758ca527201263e770dfe01ac7769c4eabeefe6a1cf4ff`

V1, V2, and the schema metadata manifest/fingerprints were not modified. Only V3, its generator/unit test, the explicit seed manifest, and the two frozen retirement checksum allow-lists were updated. The 1,377 canonical required-reference source-row contract remains unchanged.

## End-to-end clone result

Reconciliation again produced exact frozen V1 fingerprint `fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e`. The five protected reconciliation tables retained the normalized row counts/checksums shown above. The scheduling contract also remained exact:

| Evidence | Before V3 | After V5 |
| --- | --- | --- |
| Departments with active assignments | `50` | `50` |
| Assignment rows / active rows | `100 / 100` | `100 / 100` |
| Full assignment checksum | `a18af37c745f60c0e7904915e990a065` | identical |

V3's existing required-reference contract canonicalized nine `org_departments` rows: eight metadata-only changes and the pre-existing seed-owned `HQ-FIN` name `2222` to `재무본부`. This behavior is unchanged by the mapping correction and is reported separately from protected transactional/assignment preservation.

Flyway adoption produced exactly V1 `BASELINE` and V2 `SQL`, removed `alembic_version`, and retained V2 checksum `-1027260723`. Cutover then produced the exact successful chain:

| Version | Description | Checksum |
| --- | --- | --- |
| V1 | verified Alembic `org_mapping_foundation_20260722` | baseline / null |
| V2 | retire Alembic version marker | `-1027260723` |
| V3 | required reference data | `720383589` |
| V4 | BFF assertion replay store | `1252995053` |
| V5 | BFF assertion replay capacity | `-890170560` |

- Application tables excluding Flyway history: `106`.
- All `102` owned sequences passed calculated-next-value `> max(owner column)`; minimum margin was `1`. No `nextval` was called.
- Whole-application Hibernate `ddl-auto=validate`: passed in integration and restored-clone candidate startup.
- Candidate readiness: `UP`; `/openapi.json`: OpenAPI `3.1.0`, `216` paths; Spring source route coverage `290/290`.
- Read-only auth/permission smoke: signed BFF login and JWT issuance passed; employee menu tree returned `200`; employee access to admin permission matrix returned `403`; unauthenticated protected access returned `401`.
- Fresh V1-V5 installation, drift fixture reconciliation/adoption/cutover, `migrationIntegrationTest`, unit tests, and `flyway-verify`: passed.

## Rollback and restore

- A failed reconciliation rolls back its whole transaction. Before adoption, the archive preserves every original table/sequence for reviewed transactional recovery.
- After adoption, do not reverse DDL or edit Flyway history. Recreate the verification DB from `/var/backups/vibe-hr/20260803-pre-spring-cutover.dump`.
- Never use Flyway `repair`, `clean`, reverse DDL, or partial dual-write routing.

Production remains stopped. Apply only after separate approval and only in this order: final read-only permanent-history audit; final backup/restore validation; guarded reconciliation; exact V1/V2 adoption/history check; V3-V5 candidate startup; 106-table/Hibernate/readiness/OpenAPI/auth checks; then and only then traffic promotion. Stop on any permanent prior V3, fingerprint/history/checksum mismatch, protected checksum/row-count change, unsafe sequence, migration/validation/smoke failure, or need for destructive DDL/data conversion.
