# Legacy database ownership transfer

These one-shot commands cover a PostgreSQL database that still has the historical Alembic head `org_mapping_foundation_20260722`. A normal Rust release uses the existing Flyway preflight, migrations and current-schema verification. Check the actual database and its Flyway history before selecting a procedure.

## Build the operator image

Build the Rust backend from the reviewed revision and pass its image tag to the operator build. Use the repository root as context. The operator image includes the same backend executable, Flyway CLI 12.4.0, the repository migrations and the reviewed historical repair SQL.

```sh
docker build -t vibehr-backend-rust:local backend-rust
docker build --build-arg BACKEND_IMAGE=vibehr-backend-rust:local \
  -f scripts/rust-migration/legacy.Dockerfile -t vibehr-legacy:local .
```

## Verify and adopt an exact historical database

Prepare a PostgreSQL backup, restore it to a separate database and retain the source and backup until verification. Set `DATABASE_URL` in the operator environment to the restore. Choose a Docker network on which that URL reaches the restored database. In the examples, `TEST_NETWORK` holds that network name. `docker run -e DATABASE_URL` forwards the environment value without writing a password in command arguments.

```sh
docker run --rm --network "$TEST_NETWORK" -e DATABASE_URL vibehr-legacy:local \
  adopt-legacy adopt-exact-alembic-head /legacy/migration
```

With the adoption advisory lock held, the binary checks the exact Alembic head and checked-in V1 catalog fingerprint. Flyway applies the baseline record and V2 marker retirement. The operator checks the resulting history, validates the resolved Flyway checksums and verifies the V1 catalog. A retry against the exact completed V1/V2 state returns `ALREADY_ADOPTED`. A partial baseline with both history markers requires operator investigation. Extra history rows, altered checksums and schema drift fail verification. Advance a verified adopted clone through the normal Flyway release migration and run `schema-verify` for the current schema.

## Reconcile the reviewed drift shape

The following applies only to the source fingerprint captured for the 2026-08-03 reconciliation. It preserves the five original source tables in the `vibehr_pre_adoption_20260803` archive schema. The serializable transaction checks the source data, rebuilds the reviewed tables, verifies the V1 fingerprint, compares deterministic protected row counts and checksums, and checks the next sequence values before committing. A second repair attempt detects the archive schema. After a successful repair, use the exact-head adoption command above.

```sh
docker run --rm --network "$TEST_NETWORK" -e DATABASE_URL vibehr-legacy:local \
  reconcile-legacy reconcile-known-production-drift-20260803 \
  e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1 \
  /legacy/reconcile.sql
```

If a check fails, capture the exit status and diagnostic and inspect the retained source and clone. For a failed rehearsal, restore the backup to another disposable database. Any operational switch or change to production data requires separate approval.

## Run the PostgreSQL regression

Use a PostgreSQL 16 test container on an isolated named Docker network, with a loopback-only published PostgreSQL port and a `codex.task` label starting with `vibehr-rust-`. Supply a synthetic database owner with permission to create disposable databases and its password in `VIBEHR_LEGACY_TEST_PASSWORD`.

```sh
python scripts/rust-migration/legacy-parity.py --postgres "$TEST_POSTGRES" \
  --network "$TEST_NETWORK" --user "$TEST_ROLE" --image vibehr-legacy:local
```

The proof creates unique databases, applies V1 with Flyway, reconstructs the synthetic legacy and drift fixtures, exercises successful and rejected adoption attempts, and compares the protected tables and schedule assignments through V7. The script removes its temporary runner and databases after verification.
