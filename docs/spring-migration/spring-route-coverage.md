# Spring Route Coverage

This report is generated deterministically by `scripts/spring-migration/spring-route-coverage.js` from the FastAPI endpoint manifest and Spring controller annotations.

## Current Status

- State: `complete_candidate`
- Required canonical routes: 290
- Implemented in Spring: 290
- Missing from Spring: 0
- Extra Spring mappings: 0
- Duplicate Spring mapping groups: 0
- Completion: 100.00%

This migration remains in progress while required canonical routes are missing. The percentage is coverage evidence, not a completeness claim.

## Verification

- `node scripts/spring-migration/spring-route-coverage.js --verify` checks manifest/parser integrity and fails for unresolved Spring mapping annotations or duplicate Spring mappings. It permits missing routes during migration.
- `node scripts/spring-migration/spring-route-coverage.js --verify-complete` adds a strict missing/extra route gate. It must not pass until every required route is migrated or explicitly approved below.

## Complete Allowlist

The hard-coded complete-mode allowlist is intentionally empty. Add only explicit, reviewed migration exceptions in `COMPLETE_ALLOWLIST` in the generator; never use it to hide a domain still in progress.

## Route Summary

- Canonical source routes: 281
- Canonical operational routes: 9
- Spring Java files scanned: 140
- Spring controllers found: 20
- Unresolved Spring annotations: 0

## Domain Progress

| Domain | Implemented | Missing |
| --- | ---: | ---: |
| auth | 7 | 0 |
| codes | 9 | 0 |
| dashboard | 1 | 0 |
| docs | 4 | 0 |
| employees | 7 | 0 |
| health | 2 | 0 |
| hr | 36 | 0 |
| hri | 15 | 0 |
| menus | 18 | 0 |
| mng | 43 | 0 |
| openapi.json | 2 | 0 |
| org | 35 | 0 |
| pap | 10 | 0 |
| pay | 41 | 0 |
| redoc | 2 | 0 |
| system-settings | 2 | 0 |
| tim | 36 | 0 |
| tra | 12 | 0 |
| wel | 8 | 0 |

## Shadowed Python TRA Handlers

The 6 handlers below are source-level FastAPI shadows recorded by the canonical manifest. They are informational and do not create additional required Spring mappings.

| Route | Source | Handler |
| --- | --- | --- |
| GET /api/v1/tra/applications-detail | backend/app/api/tra.py:198 | applications_detail_api |
| GET /api/v1/tra/my-applications | backend/app/api/tra.py:173 | my_applications_api |
| POST /api/v1/tra/applications/{param}/approve | backend/app/api/tra.py:209 | approve_application_api |
| POST /api/v1/tra/applications/{param}/reject | backend/app/api/tra.py:221 | reject_application_api |
| POST /api/v1/tra/my-applications | backend/app/api/tra.py:185 | create_application_api |
| PUT /api/v1/tra/applications/{param}/withdraw | backend/app/api/tra.py:234 | withdraw_application_api |

## Detailed Data

The companion JSON file contains deterministic, source-linked lists of implemented, missing, extra, duplicate, unresolved, and shadowed mappings.
