# HRI atomic submission API

Status: Active
Approval: User-approved shared API and UI correction on 2026-10-15.

The application hub at `/hri/requests/mine` submits new applications and edited applications through `POST /api/hri/requests/submit`. The BFF forwards the authenticated session and JSON to `POST /api/v1/hri/requests/submit` in `HriController`.

The payload reuses the draft-upsert schema: optional `request_id`, required `form_type_id` and `title`, and `content_json`. Omit `request_id` or set it to null for a new application. An existing ID may be edited and resubmitted only by its requester and only in the existing editable states. The response preserves the submit schema: `request_id`, `status_code`, and `current_step_order`.

`HriApplicationService.saveAndSubmit` owns one transaction covering request persistence, detail validation, approval-template selection, snapshots, histories, counters, and welfare projection. Draft-disabled form types can be submitted through this route. The existing draft endpoint still rejects those form types, and the existing `/{request_id}/submit` endpoint remains available. A failed new submission leaves no request or projection; a failed resubmission preserves the prior request and projection.

This is a deliberate extension to the fifteen historical HRI routes. The immutable migration endpoint manifest remains unchanged. The active route-coverage allowlist records this single extension and continues to reject unreviewed extra routes. No database schema or migration changes are required. Frontend and backend must be released together. Rollback restores the affected frontend handlers/BFF and Spring route/service together.

Verification covers allowed and denied controller roles, BFF authentication and validation-response forwarding, PostgreSQL rollback on incomplete content or a missing approval chain, and browser submission of a form with `allow_draft=false`.
