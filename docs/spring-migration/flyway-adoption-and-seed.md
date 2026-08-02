# Flyway Adoption And Seed Ownership

The Java migration ownership transfer is intentionally one-way and guarded:

1. `V1` is generated from the seven-revision Alembic chain at `org_mapping_foundation_20260722` and creates 105 application tables on an empty PostgreSQL 16 database.
2. The adoption command accepts only that exact one-row Alembic marker and the checked-in PostgreSQL metadata fingerprint before it writes Flyway history.
3. `V2` removes `alembic_version` only after successful verification.
4. `V3` owns 1,377 required reference, menu/action, permission, policy, and code rows. It atomically generated from the classified Python snapshot, uses type-safe PostgreSQL CTEs, reconciles canonical rows by source natural key, and has no application-startup seed hook.

An `ALREADY_ADOPTED` retry accepts only the exact successful V1 baseline and V2 marker-retirement history records: installed rank, version, description, type, script, and checksums must all match. Missing, duplicated, failed, extra, or tampered history is a recovery stop, not a reason to baseline again.

Dev/demo fixtures are not part of Flyway. They require an explicit `local` or `dev` profile, `VIBEHR_ALLOW_FIXTURE_SEEDING=true`, and a loopback PostgreSQL URL whose database name is not production-like. They are rejected before fixture SQL can create the documented local `admin` account on a production-like target.

Use [database-and-seed-migration.md](../../backend-spring/docs/database-and-seed-migration.md) for the commands, recovery procedure, fixture profiles, and the reason `baselineOnMigrate` is forbidden. The source evidence is checked in alongside this guide:

- [flyway-baseline-manifest.json](flyway-baseline-manifest.json)
- [flyway-schema-metadata-manifest.json](flyway-schema-metadata-manifest.json)
- [flyway-reference-seed-manifest.json](flyway-reference-seed-manifest.json)
- [flyway-seed-ownership-ledger.md](flyway-seed-ownership-ledger.md)

Run `node scripts/spring-migration/flyway-verify.js` before delivery. The Java default remains Flyway-disabled; only `flyway-cutover` can enable migration, and it requires `VIBEHR_SCHEMA_OWNER=flyway` as the explicit sole-writer fence.
