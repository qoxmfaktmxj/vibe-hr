# Vibe-HR Observability Policy

Status: Active

## Runtime Signals

The Rust application exposes `/health`, `/api/v1/health`, and the existing Actuator-compatible probe paths. Database-backed API health distinguishes degraded availability. HTTP server errors emit structured JSON with service, environment, status, matched route and elapsed time.

## Required Evidence

- Task scope, changed files, commands, results, and remaining risks in `docs/TASK_LEDGER.md`.
- Rust health result and the affected endpoint response for runtime changes.
- Cargo test output and any relevant Spring comparison for backend changes.
- Browser evidence for user-visible Korean text, workflow behavior, or AG Grid interactions.
- Deployment revision and smoke-check outcome for delivery work.

## Logging Constraints

Never log raw secrets, bearer tokens, passwords, personal data dumps, or payroll payloads. Classify failures as build, test, runtime, permission, data-integrity, payroll-logic, deployment, environment, or tool failures so recovery work has an explicit owner and next check.
