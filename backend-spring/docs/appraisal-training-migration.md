# PAP and TRA Java migration

## Scope and source evidence

This worker owns only `com.vibehr.appraisal`, `com.vibehr.training`, their tests, and this document. The canonical source is `docs/spring-migration/endpoint-manifest.json`, not decorator count alone.

| Area | Python source decorators | Spring registrations | Decision |
| --- | ---: | ---: | --- |
| PAP appraisal, targets, final results | 10 | 10 | All source handlers are live and mapped. |
| TRA | 18 | 12 | Six later Python decorators are shadowed by FastAPI's earlier registrations and intentionally have no Spring mapping. |

PAP paths are the four `/api/v1/pap/appraisals` CRUD handlers, `/api/v1/pap/targets` and `/api/v1/pap/targets/batch`, and the four `/api/v1/pap/final-results` CRUD handlers. `POST` appraisal and final-result creation returns `201`; delete returns `204`.

TRA canonical paths are:

- `POST /api/v1/tra/generate/required-events`
- `POST /api/v1/tra/generate/required-targets`
- `POST /api/v1/tra/generate/elearning-windows`
- `POST /api/v1/tra/cyber-results/apply`
- `GET` and `POST /api/v1/tra/my-applications`
- `GET /api/v1/tra/applications-detail`
- `POST /api/v1/tra/applications/{app_id}/approve`
- `POST /api/v1/tra/applications/{app_id}/reject`
- `PUT /api/v1/tra/applications/{app_id}/withdraw`
- `GET /api/v1/tra/{resource}`
- `POST /api/v1/tra/{resource}/batch`

The intentionally unreachable Python handlers are `backend/app/api/tra.py` lines 173, 185, 198, 209, 221, and 234. They duplicate, respectively, the canonical handlers at lines 96, 108, 121, 132, 144, and 157. Registering them in Spring would create illegal duplicate mappings and change the live FastAPI behavior.

## Java mapping guide

| Python concept | Java equivalent | Reason |
| --- | --- | --- |
| Pydantic create/response schema | package-private Java record | Jackson's configured snake-case strategy preserves wire names while records make nullable fields explicit. |
| Pydantic `exclude_unset` patch | typed patch DTO with setter presence flags | Bean Validation enforces the Python field constraints while the service can distinguish an omitted nullable field from explicit JSON `null`. |
| Domain-owned SQLModel table | field-access JPA entity | PAP and TRA write-owned table and column names match the Alembic schema; runtime Java DDL remains disabled. |
| Foreign key relation | scalar `*_id` field | Domain ownership stays local and avoids accidental cross-module cascades. |
| `session.commit()` service method | `@Transactional` Spring service method | A complete state change commits or rolls back atomically. |
| FastAPI `HTTPException` | `ApiException` | The platform exception advice returns the existing `detail` envelope and status. |
| Joined application/target serializer | MyBatis read projection | Application and PAP target responses cross employee, user, department, and domain tables, so projection SQL avoids duplicate JPA ownership. |
| HR employee lookup from TRA | MyBatis scalar read projection | TRA reads `id`, `user_id`, `employee_no`, `department_id`, and `employment_status` without declaring an `hr_employees` entity. |

PAP enforces the original role gates plus `pap.appraisals` or `pap.final-results` menu `query`/`save` actions. TRA preserves its role sets: manager/admin for generators and administration, employee/manager/admin for employee application and resource reads. The role and menu checks query the same `auth_*` and `app_*` data instead of introducing a new authorization model.

PAP and TRA declare no JPA entity for `auth_users`, `hr_employees`, or `org_departments`. `AuthUser` remains the auth table owner, and the HR/ORG packages remain the employee and department owners. Cross-domain reads use table/column projections only.

## Transaction, lock, and conflict decisions

| Operation | Transaction boundary | Lock or natural key | Repeat/idempotency result | Unique-conflict decision |
| --- | --- | --- | --- | --- |
| PAP create/update/delete | One service transaction | Pessimistic row lock for update/delete; database code uniqueness for create/update | State transitions are atomic; duplicate codes remain `409` | Platform integrity advice preserves `409`. |
| PAP target batch | One service transaction | Existing target rows lock on update/delete | The Python create/update/delete counters and skip rules are preserved | A database conflict rolls back the complete batch. |
| TRA application create | One service transaction | Transaction-scoped advisory lock `tra:application-sequence` | Number is `TRA-YYYY-NNNNNN`, where the suffix is `max(tra_applications.id) + 1` | The shared sequence lock prevents Java writers from allocating the same number. |
| TRA application approve/reject/withdraw | One service transaction | Pessimistic application row lock; employee IDs use value equality | Invalid repeat transitions remain `409`; cross-employee withdrawal remains `403` | A write conflict rolls back the state change. |
| Required-event generation | One application transaction | Advisory lock on `(course_id,event_code)`, then existence recheck | Existing events are skipped and not counted | SQLSTATE `23505` retries the whole transaction once; the retry sees the winner and reports a skip. |
| Required-target generation | One application transaction | Advisory lock on `(year,employee_id,rule_code,course_id,edu_month)`, then existence recheck | Existing targets are skipped and not counted | SQLSTATE `23505` retries the whole transaction once; no partial generation is committed. |
| E-learning-window generation | One service transaction | Existing month rows are updated; missing months are inserted | Every call processes all 12 months as Python does | A conflict rolls back all 12 month operations. |
| Cyber upload application | One application transaction | Upload ID row/advisory lock plus organization-name, course-name, event, history, and generated-code locks | A closed upload is rechecked and skipped; supporting rows are reused | SQLSTATE `23505` retries the whole transaction once and reuses the concurrent winner. |

PAP patch validation occurs before authorization/service invocation and returns the platform's Pydantic-compatible `422` validation envelope. Nested target batch rows cascade `@Valid`, so row field limits are enforced at the controller boundary.

The opt-in `integrationTest` task starts PostgreSQL only when `VIBEHR_RUN_CONTAINER_TESTS=true`. It creates disposable, minimal test-only schemas, executes the real TRA MyBatis enrichment projection with IDs above Java's integer cache, and verifies concurrent advisory-lock behavior for application numbering, required events, required targets, and cyber upload closing. It does not claim Alembic-head compatibility: provisioning and running the full migration schema remains the separate integration-harness handoff.
