# Database And Seed Migration

This module owns the PostgreSQL schema and production reference data after the Java cutover. Flyway is the sole schema and required-reference-data writer when the explicit cutover profile is enabled. Normal application startup remains Flyway-disabled.

There are two intentionally distinct schema views:

- The immutable V1 transfer baseline is the historical Alembic head: 105 business tables.
- A current V1-V5 Flyway installation has 106 application tables: those 105 business tables plus the `bff_assertion_replays` operational security table introduced in V4 and extended in V5.

> **Frozen pre-cutover evidence:** Alembic revisions, Python bootstrap inventory, source SQL, and
> checksums are retained only to prove the completed ownership transfer. Do not regenerate or run
> them. New schema or required-reference-data changes require a reviewed, forward-only Flyway
> migration and matching Spring validation.

## Versioned ownership

| Version | Purpose | Fresh database | Adopted database |
| --- | --- | --- | --- |
| `V1__alembic_head_baseline.sql` | Canonical PostgreSQL schema at Alembic `org_mapping_foundation_20260722` | Creates all 105 historical business tables | Recorded as the verified Alembic baseline; it is not executed |
| `V2__retire_alembic_version_marker.sql` | Retires the Python ownership marker | Safely drops the temporary Alembic marker created by V1's source chain | Drops the real marker only after the head and catalog fingerprint were verified |
| `V3__required_reference_data.sql` | Required roles, reference codes, menu/action permissions, policies, and settings | Reconciles 1,377 deterministic canonical rows by Python natural key | Runs on the first Flyway cutover startup after adoption |
| `V4__bff_assertion_replay_store.sql` | Adds the operational BFF assertion replay store | Adds `bff_assertion_replays`, the 106th application table | Runs after an adopted V1/V2 baseline |
| `V5__bff_assertion_replay_capacity.sql` | Adds source and bucket replay-capacity metadata | Adds required source/bucket columns, bucket range validation, and replay query indexes | Runs after an adopted V1/V2 baseline |

`schema-metadata-manifest.json` captures PostgreSQL catalog metadata for each of the 105 historical business tables: columns, nullability, defaults, precision/scale, constraints, foreign keys, indexes, sequences, and the `btree_gist` extension. It intentionally excludes `bff_assertion_replays`, because that operational, TTL-bound replay table did not exist at the Alembic head and therefore must not alter the immutable V1 ownership fingerprint. The adoption service and container test compare this exact historical fingerprint before ownership changes.

The source-equivalent V1 baseline is generated from all seven Alembic revisions. `V1` contains only the documented clean-install normalizations in [flyway-baseline-manifest.json](../../docs/spring-migration/flyway-baseline-manifest.json): historical cleanup drops are made idempotent where an empty database never had their pre-Alembic objects. The V1 catalog remains identical to the captured Alembic head; V2-V5 are forward-only Flyway changes.

## Verify Frozen Evidence

Run all source and generated-artifact checks from the repository root:

```powershell
node scripts/spring-migration/flyway-verify.js
```

This verifies the frozen Alembic/Python evidence, the 105-table V1 baseline, bootstrap inventory, source snapshot, and Flyway artifacts without making them executable. `V1` through `V3` and their manifests are immutable transfer evidence: do not regenerate their SQL, checksums, or seed snapshots. V4/V5 are already-released forward migrations; do not rewrite them. Add later changes as a new migration.

For an approved schema or required-reference-data change, add a new forward-only Flyway migration, update the owning Spring entities and tests, and run the Flyway verification suite. Do not recapture V1/V3 or invoke Python bootstrap functions.

To capture a metadata manifest from a disposable V1 database:

```powershell
.\scripts\spring-migration\flyway-schema-manifest.ps1 `
  -JdbcUrl 'jdbc:postgresql://localhost:5432/vibehr_capture' `
  -Username vibehr -Password vibehr
```

The database supplied to this command must already have V1 applied. Use `-Verify` to compare a new capture with both checked-in manifest copies.

## Adoption Lifecycle

Never set `baselineOnMigrate=true` for an existing Vibe-HR database. Blind baseline would create Flyway history without proving which Alembic revision created the schema, could accept drifted columns/constraints, and would leave two migration systems able to mutate the same database.

1. Confirm the retired legacy writer cannot run and take a verified database backup.
2. Confirm `alembic_version` contains exactly one row: `org_mapping_foundation_20260722`.
3. Run the explicit adoption command. It holds a PostgreSQL advisory lock, verifies the full catalog fingerprint, records Flyway V1, runs V2 to remove `alembic_version`, and verifies the catalog again.

```powershell
cd backend-spring
.\gradlew.bat bootRun --args='--spring.profiles.active=flyway-adoption --vibehr.migration.adoption-confirmation=adopt-exact-alembic-head'
```

Adoption rejects a missing, wrong, or multiple Alembic head; any schema drift; a pre-existing incomplete Flyway history; and any case where both histories exist. A repeat accepts only the exact successful V1 baseline and V2 marker-retirement records, including installed rank, version, description, type, script, and checksums; missing, duplicated, failed, extra, or tampered rows are rejected. These failures occur before `flyway_schema_history` is created for a new adoption. A successful repeat reports `ALREADY_ADOPTED` and does not change application rows.

4. Start the Java service only with the delivery cutover profile and environment fence:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'flyway-cutover'
$env:VIBEHR_SCHEMA_OWNER = 'flyway'
.\gradlew.bat bootRun
```

The cutover profile refuses an Alembic marker, an untracked existing application schema, missing ownership flags, and metadata drift. It is the only profile that enables Flyway. A fresh Java database runs V1 through V5 in order. An adopted database has V1/V2 recorded during adoption and applies V3, V4, and V5 at cutover.

Hibernate is always configured with `ddl-auto=validate`, never schema create/update. The migration integration suite performs a Hibernate validation pass against the Flyway-created database alongside the exhaustive PostgreSQL catalog manifest. Full application entity validation becomes the delivery gate once the parallel domain packages have converged on the final Java mappings; this ownership transfer does not modify those packages.

## Seed Split

Production startup never calls a seed runner. `V3` is the sole owner of required reference, permission/menu, code, policy, and setting data.

The complete 66-function Python bootstrap inventory is checked in at [flyway-seed-ownership-ledger.md](../../docs/spring-migration/flyway-seed-ownership-ledger.md):

- 33 required-reference/menu/permission functions are versioned in V3.
- Four local identity/employee fixture functions are owned by `DevSeedRunner`.
- Five Korean-employee demo fixture functions are owned by `DemoSeedRunner`.
- Twenty-three legacy transactional, request, payroll, leave, and training samples are intentionally archived/retired rather than silently carrying test data into production.

Both retained fixture commands require Flyway V3, reject a remaining Alembic marker, use a fixed clock and stable keys, and can run repeatedly without duplicating rows. They also require an active `local` or `dev` profile, `VIBEHR_ALLOW_FIXTURE_SEEDING=true`, a loopback PostgreSQL host, and a database name without `prod` or `live`. Production-like profiles and targets are rejected before fixture SQL runs, so the documented `admin` account cannot be created there:

```powershell
cd backend-spring
$env:VIBEHR_ALLOW_FIXTURE_SEEDING = 'true'
.\gradlew.bat bootRun --args='--spring.profiles.active=dev,dev-seed --vibehr.seed.confirmation=dev'
.\gradlew.bat bootRun --args='--spring.profiles.active=dev,demo-seed --vibehr.seed.confirmation=demo --vibehr.seed.demo-employee-count=6000'
```

The local-only account password is `admin`; it is never created by production startup. Each command reports a deterministic row count and checksum.

## Test And Recovery

Run the self-provisioning PostgreSQL 16 tests:

```powershell
cd backend-spring
.\gradlew.bat compileJava
.\gradlew.bat migrationIntegrationTest --rerun-tasks
```

The suite covers the immutable 105-table V1 baseline and exact metadata ownership checks, the live 106-table V1-V5 fresh install, Hibernate validation, V3 reference row count, drifted canonical-row correction, V3 rerun idempotency without duplicates, noncanonical business-row survival, no automatic fixtures, fixture denial for missing opt-in/profile and production-like targets, verified adoption without application-row changes, wrong-head and schema-drift rejection before Flyway history mutation, exact-history rejection for missing/extra/duplicated/failed/tampered V1/V2 records, repeat adoption, and explicit dev/demo idempotency. `FreshFlywayReplayStoreSchemaIntegrationTest` verifies the fresh V4 replay-table columns, primary key, query indexes, and V5 required source/bucket metadata with the `0..255` bucket constraint. The same `migrationIntegrationTest` task also runs `BffAssertionReplayStorePostgreSqlIntegrationTest` against a fresh V1-V5 database to verify expiry cleanup plus per-scope, per-source, and per-bucket active-replay capacity behavior.

There is no destructive Flyway rollback migration for V1-V5. For a failed or aborted adoption, leave the marker/history untouched and correct the verified preflight failure. For a failure after history changes, stop both writers, restore the pre-adoption backup, and investigate the catalog/history mismatch before retrying. Do not manually recreate `alembic_version`, delete Flyway rows, use `clean`, or run Alembic and Flyway concurrently.
