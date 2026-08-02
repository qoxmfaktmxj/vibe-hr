# Vibe-HR Governance

Status: Active
Scope: Spring-only runtime, frontend BFF, PostgreSQL, and documented operating controls.

## Risk Classes

| Class | Scope | Requirement |
| --- | --- | --- |
| R0 | Documentation or non-executable local metadata | Focused review and static validation |
| R1 | Isolated local frontend or Spring code change | Relevant tests and diff review |
| R2 | Shared API contract, grid convention, CI, permission workflow, or shared configuration | Explicit approval before code changes |
| R3 | Authentication, authorization, payroll semantics, Flyway/schema, reference data, deployment, secrets, or destructive data action | Explicit scoped approval and thorough verification |

## Protected Spring Surfaces

- `backend-spring/src/main/java/com/vibehr/auth/**`
- `backend-spring/src/main/java/com/vibehr/menu/**`
- `backend-spring/src/main/java/com/vibehr/payroll/**`
- `backend-spring/src/main/java/com/vibehr/platform/security/**`
- `backend-spring/src/main/resources/db/migration/**`
- `backend-spring/src/main/resources/application*.yml`
- `frontend/src/components/grid/**`, `frontend/src/lib/grid/**`, and `config/grid-screens.json`
- `.github/workflows/**`, `docker-compose.deploy.yml`, and `backend-spring/Dockerfile`

## Approval And Evidence

1. State the intended change, affected boundary, and risk class before editing.
2. Obtain explicit approval before R2 or R3 implementation.
3. Keep the change limited to the approved scope.
4. Run the checks that prove the claim: Gradle tests for Spring work, grid validation before frontend lint/build, and browser checks for user-visible Korean text or interactive behavior.
5. Record changed files, commands, results, approval, and remaining risks in `docs/TASK_LEDGER.md`.

## Non-Negotiable Controls

- Flyway is the only schema and required-reference-data writer. Do not modify migration history manually.
- Spring controllers do not own transaction boundaries; application services do.
- UI hiding does not replace backend authorization.
- Secrets stay in environment configuration and never enter source, fixtures, logs, or ledger entries.
- Historic implementation evidence is non-executable and must carry the immutable pre-cutover archive notice.

## Release Gate

Release readiness requires a reviewed diff, appropriate approval, clean applicable checks, no unresolved critical security/data findings, and a concrete rollback or recovery path for any R3 change.
