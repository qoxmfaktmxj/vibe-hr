# HRI and Welfare Migration

## Scope

This Spring package owns the existing `hri_*` and `wel_*` tables only. It maps no HR, organization, or authentication entity: those IDs are scalar values and read-only projections use `HriRequestProjectionMapper` or native scalar queries. No Flyway/Alembic change, DDL, dependency, seed, or platform/auth change is part of this migration.

## Canonical Route Coverage

| Area | Canonical route | Spring handler |
| --- | --- | --- |
| HRI | `GET /api/v1/hri/form-types` | `HriController.formTypes` |
| HRI | `POST /api/v1/hri/form-types/batch` | `HriController.saveFormTypes` |
| HRI | `GET /api/v1/hri/approval-templates` | `HriController.approvalTemplates` |
| HRI | `POST /api/v1/hri/approval-templates/batch` | `HriController.saveApprovalTemplates` |
| HRI | `POST /api/v1/hri/requests/draft` | `HriController.saveDraft` |
| HRI | `POST /api/v1/hri/requests/{request_id}/submit` | `HriController.submit` |
| HRI | `POST /api/v1/hri/requests/{request_id}/withdraw` | `HriController.withdraw` |
| HRI | `POST /api/v1/hri/requests/{request_id}/approve` | `HriController.approve` |
| HRI | `POST /api/v1/hri/requests/{request_id}/reject` | `HriController.reject` |
| HRI | `POST /api/v1/hri/requests/{request_id}/receive-complete` | `HriController.receiveComplete` |
| HRI | `POST /api/v1/hri/requests/{request_id}/receive-reject` | `HriController.receiveReject` |
| HRI | `GET /api/v1/hri/requests/my` | `HriController.myRequests` |
| HRI | `GET /api/v1/hri/requests/{request_id}` | `HriController.detail` |
| HRI | `GET /api/v1/hri/tasks/my-approvals` | `HriController.myApprovalTasks` |
| HRI | `GET /api/v1/hri/tasks/my-receives` | `HriController.myReceiveTasks` |
| Welfare | `GET /api/v1/wel/benefit-types` | `WelfareController.benefitTypes` |
| Welfare | `POST /api/v1/wel/benefit-types/batch` | `WelfareController.saveBenefitTypes` |
| Welfare | `GET /api/v1/wel/requests` | `WelfareController.requests` |
| Welfare | `POST /api/v1/wel/requests` | `WelfareController.createRequest` |
| Welfare | `GET /api/v1/wel/my-requests` | `WelfareController.myRequests` |
| Welfare | `POST /api/v1/wel/requests/{req_id}/approve` | `WelfareController.approve` |
| Welfare | `POST /api/v1/wel/requests/{req_id}/reject` | `WelfareController.reject` |
| Welfare | `PUT /api/v1/wel/requests/{req_id}/withdraw` | `WelfareController.withdraw` |

## HRI Mutation And Default Decisions

| Mutation | Public defaults | Transaction, authorization, and decision |
| --- | --- | --- |
| Form-type batch | `module_code=COMMON`, `is_active=true`, `allow_draft=true`, `allow_withdraw=true`, `requires_receive=false`, `default_priority=50` | `hr_manager` or `admin`; one transaction; update/delete locks the row; duplicate `form_code` is `409`. |
| Approval-template batch | `scope_type=GLOBAL`, `is_default=false`, `is_active=true`, `priority=100`; step `allow_delegate=true` | `hr_manager` or `admin`; one transaction; update/delete locks the header and replaces steps. Scope, unique order, actor fields, actor-rule existence, phase ordering, and `step_type`/`required_action` coherence are checked before mutation. |
| Draft create/update | `content_json={}` at the HTTP schema; resulting status `DRAFT` | Employee-family roles; PostgreSQL advisory lock allocates `HRI-YYYYMM-NNNNNN`; updates lock the request. `allow_draft=false` is `409`; only `DRAFT`, `APPROVAL_REJECTED`, and `RECEIVE_REJECTED` are editable. Known detail fields are type/length validated without inventing dates or integer defaults; incomplete drafts remain JSON-only until materializable. |
| Submit | No body/default | Owner only; request lock; validates the complete discriminated detail, effective form policies, attachment count, selected template, and exact `requires_receive` agreement. Effective template/policy dates use the `Asia/Seoul` business date. Snapshots are recreated from the effective template; prior snapshots are serialized into immutable history on resubmission. |
| Withdraw | No body/default | Owner only; request lock; only `APPROVAL_IN_PROGRESS`; `allow_withdraw=false` is `409`; all waiting snapshots become `REJECTED`. |
| Approve/reject | `comment=null`, maximum 1000 | Current resolved approval actor only; request and current snapshot use write locks. Stale/repeated status is `409`; a different user is `403`, even when template metadata has `allow_delegate=true`. |
| Receive complete/reject | `comment=null`, maximum 1000 | Current resolved receive actor only; same lock/conflict semantics. Completion is terminal; rejection enters editable `RECEIVE_REJECTED`. |
| Request/task reads | `page=1`, `limit=50`, maximum 200 | Owner-only request detail; task lists expose only the exact current waiting actor and phase. |

## Welfare Mutation And Default Decisions

| Mutation | Public defaults | Transaction, authorization, and decision |
| --- | --- | --- |
| Benefit-type batch | `is_deduction=false`, `is_active=true`, `sort_order=0`; `_status=clean` | `admin`; one transaction; update/delete locks rows; `_status` controls add/update/delete and response counters. |
| Direct request | `description=null`; status `submitted` | Employee-family roles; requires active benefit type and linked employee; advisory lock protects `WEL-YYYYMM-NNNNN`; exact Korean not-found/profile errors are retained. |
| Approve | `note=null` | Manager/payroll/admin; request write lock; only `submitted`; approved amount/time are stored and optional note is appended as `[승인메모]`. |
| Reject | `reason=null` | Manager/payroll/admin; request write lock; only `submitted` or `draft`; optional reason is appended as `[반려사유]`. |
| Withdraw | No body/default | Employee-family roles plus matching `employee_id`; request write lock; only `submitted` or `draft`; exact Korean forbidden/conflict details are retained. |
| List reads | `page=1`, `limit=50`, maximum 200 for admin lists; my-list has its legacy single-page shape | Admin list uses manager/payroll/admin roles. My-list resolves the caller's employee and filters by `employee_id`. |
| HRI projection | HRI status maps to the existing lowercase welfare status vocabulary | Same HRI transaction; advisory natural-key lock plus existing-row write lock; upsert by `request_no` is repeat-call idempotent and now carries the requester's scalar `employee_id`. |

## State And Projection Rules

HRI transitions are `DRAFT -> APPROVAL_IN_PROGRESS -> RECEIVE_IN_PROGRESS -> COMPLETED`, with `APPROVAL_REJECTED`, `RECEIVE_REJECTED`, and `WITHDRAWN` branches matching the exposed Python service. `REFERENCE` is auto-received, approval steps must precede receive steps, and `requires_receive` must exactly match whether the effective template has a receive step. `allow_delegate` remains stored configuration metadata: none of the 15 canonical Python routes delegates a task, and no delegated-actor lineage exists, so the action contract remains direct-snapshot-actor authorization rather than inventing a twenty-fourth route.

The exposed typed detail contract is `TIM_CORRECTION`, `CERT_EMPLOYMENT`, `LEAVE_REQUEST`, and the discriminated `WEL_BENEFIT_REQUEST` projection. Invalid dates, integers, lengths, required fields, leave span/past-date/reason policy, and welfare benefit/reason policy return FastAPI-shaped `422` detail entries. `hri_req_tim_attendance` is retained in the legacy JPA ownership because the table exists, but current Python has no writer, reader, seeded form type, or frontend renderer for `TIM_ATTENDANCE`; it is intentionally not claimed as implemented behavior.

Attachments and histories likewise have no public route in the canonical 23. Attachment metadata remains DB-owned support and submit enforces effective `attachment_required`/`max_attachment_count` against rows supplied by the existing external attachment integration. History is write-only through the exposed use cases. Python deletes/recreates snapshots on resubmit; Spring preserves that public behavior and additionally captures the complete prior snapshot values inside the immutable `SUBMIT` history payload before replacement, without changing schema or response shape.

For `WEL_BENEFIT_REQUEST`, welfare projection maps `DRAFT` to `draft`, approval progress to `submitted`, receive progress to `approved`, completion to `payroll_reflected`, rejection to `rejected`, and withdrawal to `withdrawn`. The inherited Python projection omitted `employee_id`, making its own `GET /wel/my-requests` filter hide HRI-created rows. Assigning the already-resolved scalar employee ID is an intentional compatibility correction: it restores the documented cross-domain effect and changes no request/response schema.

## Persistence Metadata

JPA reproduces every representable legacy table name, unique constraint, check constraint, index, nullability rule, and bounded string length for `hri_*` and `wel_*`. Cross-domain HR, organization, and authentication IDs remain scalar fields as required; their legacy foreign keys are database-owned rather than modeled as duplicate JPA entities. The self-provisioning PostgreSQL test creates and asserts all internal and cross-domain FKs and runs Hibernate `ddl-auto=validate` against the exact fixture. Production DDL remains externally managed.

## Validation

- `HriRouteContractTest` asserts the 15 HRI paths and methods.
- `WelfareRouteContractTest` asserts the 8 welfare paths and methods.
- Business-date tests straddle the UTC-to-Seoul midnight boundary used by effective template selection.
- Detail/policy and invariant tests cover typed `422`, `allow_draft`, actor fields, step action coherence, and exact Korean/English errors.
- State-lock tests assert repeated mutation conflicts and current-action snapshots use `PESSIMISTIC_WRITE`.
- `HriWelfarePostgreSqlIntegrationTest` is tagged `integration`, self-provisions `postgres:16-alpine`, starts Spring/JPA with `ddl-auto=validate`, exercises real service transactions and concurrent advisory/row locks, enforces DB constraints, verifies typed details and resubmission lineage, and proves HRI-created welfare visibility through `employee_id`. It has no external legacy URL and no schema-test skip.
