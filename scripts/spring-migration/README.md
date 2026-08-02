# Spring Migration Inventory Tool

`endpoint-manifest.js` creates the Phase-0 FastAPI route registry for Spring migration planning. It preserves the source-decorator inventory, separately inventories framework and application operational routes, and derives canonical entries keyed by HTTP method plus normalized path.

## Usage

Run from the repository root:

```powershell
node scripts/spring-migration/endpoint-manifest.js
node scripts/spring-migration/endpoint-manifest.js --verify
node scripts/spring-migration/endpoint-manifest.test.js
```

## Flyway Schema And Seed Ownership

The Java migration transfer is verified with the checked-in Alembic baseline, PostgreSQL metadata fingerprint, required-reference snapshot, and 66-function bootstrap ownership ledger.

```powershell
node scripts/spring-migration/flyway-verify.js
cd backend-spring
.\gradlew.bat migrationIntegrationTest --rerun-tasks
```

See [database-and-seed-migration.md](../../backend-spring/docs/database-and-seed-migration.md) for the guarded adoption command, explicit cutover profile, local fixture commands, and recovery requirements. Never use Flyway `baselineOnMigrate` on an existing Vibe-HR database.

The generator writes:

- `docs/spring-migration/endpoint-manifest.json`
- `docs/spring-migration/endpoint-manifest.md`

`--verify` exits nonzero when the source decorator count differs from the Phase-0 contract of `287`, an endpoint has no function identity, a BFF candidate is unresolved or ambiguous, a required operational/framework route is missing or its count drifts, or a duplicate method/path group cannot be resolved.

## Reviewed Mutation Decisions

`mutation-ledger.js` inventories every `POST`, `PUT`, `PATCH`, and `DELETE` source decorator. Its reviewed overlay is `docs/spring-migration/mutation-decision-registry.json`; it is an array so duplicate keys can be detected rather than silently overwritten by JSON object parsing. Each entry is keyed by the generated `ledger_key` and must provide all seven decisions, an active/shadowed status, canonical handler key, and (for active handlers) an exact Spring controller mapping plus a domain migration-document anchor.

```powershell
node scripts/spring-migration/mutation-ledger.js
node scripts/spring-migration/mutation-ledger.js --verify
node scripts/spring-migration/mutation-ledger.js --verify-complete
node scripts/spring-migration/mutation-ledger.js --check
node scripts/spring-migration/mutation-ledger.js --check-complete
node scripts/spring-migration/mutation-ledger.test.js
```

Each mutation decision field must include its supported value, a non-tautological rationale, and structured `source_ref` plus `implementation_ref` objects. `--verify-complete` additionally rejects missing, extra, duplicate, malformed (including null, missing, blank, or non-string keys), blank, placeholder, tautological, or unsupported decisions; invalid canonical/shadow relationships; and missing or drifted source, Spring, and document references. The four shadowed TRA source decorators are retained as `retired_shadowed` records that point to their effective FastAPI handler; they are not independent Spring mutations.

`--check` and `--check-complete` never write files. They build the ledger in memory and compare both generated ledger artifacts byte-for-byte with the checked-in JSON and Markdown; `--check-complete` also applies the full reviewed-decision gate. Use these modes in CI or immediately before Python retirement.

When a state-changing endpoint changes, regenerate the endpoint manifest first, run the mutation ledger once, then add or update exactly one reviewed registry entry for every changed `ledger_key`. Do not copy an old source line or turn a shadowed decorator into an active decision without first confirming the canonical route in `endpoint-manifest.json` and Spring route coverage.

## Reviewed Schema Defaults

`schema-ledger.js` inventories all SQLModel table classes and merges `docs/spring-migration/schema-default-decision-registry.json`. Every `default_factory` item is keyed as `table_name.column_name @ source_file:line` and records its source factory, exact Java owner/behavior, and the Flyway baseline owner.

```powershell
node scripts/spring-migration/schema-ledger.js
node scripts/spring-migration/schema-ledger.js --verify
node scripts/spring-migration/schema-ledger.js --verify-complete
node scripts/spring-migration/schema-ledger.js --check
node scripts/spring-migration/schema-ledger.js --check-complete
node scripts/spring-migration/schema-ledger.test.js
```

Each default decision must include a supported behavior with a non-tautological `detail`, a structured Python `source_ref`, and structured Java `implementation_ref`, in addition to its Java/Flyway owners. Complete verification rejects missing, extra/stale, duplicate, malformed (including null, missing, blank, or non-string keys), blank, placeholder, tautological, or unsupported default decisions. It also rejects any remaining application default factory and any genuine type, nullability, or source-location failure; a reviewed default cannot conceal unrelated schema uncertainty.

`--check` and `--check-complete` are read-only byte-for-byte checks for `schema-ledger.json` and `schema-ledger.md`; the complete mode also runs every default-decision evidence gate.

When a SQLModel `default_factory` changes, regenerate the schema ledger and update the corresponding registry item with the new exact key, Python factory value, Java owner, behavior, and Flyway strategy. Additions/removals must leave no registry extras.

## Python Retirement Freeze

The generated `mutation-ledger.{json,md}` and `schema-ledger.{json,md}` are source-controlled migration evidence. Immediately before final Python retirement, run both `--verify-complete` commands and commit the generated ledgers with their reviewed registries. After `backend/app/**` is removed, preserve those four artifacts as frozen evidence and do not run the Python-source scanners again; future Java-only changes are verified by Spring route/schema coverage instead. Any attempt to revise frozen historical decisions requires restoring the matching pre-retirement Python inventory in a dedicated audit worktree.

## Inventory Rules

- Resolves every `APIRouter(...)` variable imported from `app.api.*` and passed to `app.include_router(...)` in `backend/app/main.py`, including aliased imports.
- Scans the selected router variables for `get`, `post`, `put`, `patch`, and `delete` decorators.
- Resolves each router prefix and the `/api/v1` prefix declared by `backend/app/main.py`.
- Handles multiline decorators and records source location, method, paths, function, auth clues, and response-model clue.
- Scans `frontend/src/app/api/**/route.ts` for statically visible `/api/v1/...` strings and associates matching BFF candidates with backend endpoints. Dynamic template segments are recorded as `{param}`, with source variable names retained as evidence when competing backend parameter paths need disambiguation.
- Matches BFF and backend paths by segment type: static segments only match identical static segments, and `{param}` only matches a backend path parameter. Catch-all proxies match descendants under their aligned static/parameter prefix and do not credit sibling prefixes.
- Separately inventories `/health`, `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, and `/redoc`. The default FastAPI documentation routes register `GET` and `HEAD`; the explicit `@app.get("/health")` route registers `GET` only.
- Builds `canonical_routes` as a JSON object keyed by strings such as `GET /api/v1/auth/login`. Each value identifies the effective first-match handler and any shadowed handlers.
- Attempts to import `app.main:app` and inspect `app.routes` without entering the lifespan context. If the environment cannot import the application, it falls back to `main.py` router include order plus source decorator order; the generated manifest and Markdown record which evidence path was used.
