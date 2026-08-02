# Vibe-HR Observability Policy

Status: Active

## Runtime Signals

The Spring application exposes `/health`, `/api/v1/health`, and Actuator health probes. Spring Boot emits structured ECS console logs and includes the active runtime environment in the service metadata.

## Required Evidence

- Task scope, changed files, commands, results, and remaining risks in `docs/TASK_LEDGER.md`.
- Spring health result and the affected endpoint response for runtime changes.
- Gradle test output for backend changes.
- Browser evidence for user-visible Korean text, workflow behavior, or AG Grid interactions.
- Deployment revision and smoke-check outcome for delivery work.

## Logging Constraints

Never log raw secrets, bearer tokens, passwords, personal data dumps, or payroll payloads. Classify failures as build, test, runtime, permission, data-integrity, payroll-logic, deployment, environment, or tool failures so recovery work has an explicit owner and next check.
