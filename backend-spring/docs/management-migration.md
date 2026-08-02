# Management Migration

## Scope and Route Coverage

This package migrates all 43 FastAPI MNG routes under `/api/v1/mng`. The route inventory test asserts the same 9 + 18 + 10 + 6 split as the source routers.

| Python source | Spring controller | Routes |
| --- | --- | ---: |
| `mng_company.py` | `ManagementCompanyController` | 9 |
| `mng_dev.py` | `ManagementDevelopmentController` | 18 |
| `mng_outsource.py` | `ManagementOutsourceController` | 10 |
| `mng_infra.py` | `ManagementInfrastructureController` | 6 |

The 43 covered method/path pairs are:

```text
GET    /companies
GET    /companies/dropdown
GET    /companies/{company_id}
POST   /companies
PUT    /companies/{company_id}
DELETE /companies
GET    /manager-status
POST   /manager-status
DELETE /manager-status
GET    /dev-requests
GET    /dev-requests/monthly-summary
GET    /dev-requests/{request_id}
POST   /dev-requests
PUT    /dev-requests/{request_id}
DELETE /dev-requests
GET    /dev-projects
GET    /dev-projects/{project_id}
POST   /dev-projects
PUT    /dev-projects/{project_id}
DELETE /dev-projects
GET    /dev-inquiries
GET    /dev-inquiries/{inquiry_id}
POST   /dev-inquiries
PUT    /dev-inquiries/{inquiry_id}
DELETE /dev-inquiries
GET    /dev-staff/projects
GET    /dev-staff/revenue-summary
GET    /outsource-contracts
GET    /outsource-contracts/check-duplicate
GET    /outsource-contracts/{contract_id}
POST   /outsource-contracts
PUT    /outsource-contracts/{contract_id}
DELETE /outsource-contracts
GET    /outsource-attendances/summary
GET    /outsource-attendances/{contract_id}
POST   /outsource-attendances
DELETE /outsource-attendances
GET    /infra-masters
POST   /infra-masters
DELETE /infra-masters
GET    /infra-configs/{master_id}
POST   /infra-configs/{master_id}
DELETE /infra-configs/{config_id}
```

## Python to Java Map

| Python responsibility | Java destination |
| --- | --- |
| FastAPI route and `Depends(require_roles(...))` | Controller plus `ManagementAuthorization` |
| Company menu query/save action check | `ManagementAuthorization` through `MenuPermissionService` |
| Pydantic request/response schema | `ManagementDtos` records and presence-aware typed patch DTOs |
| `mng_*_service.py` operation | `ManagementService` application use case |
| SQLModel table | `ManagementEntities` nested JPA entity |
| SQLModel query/session operation | `ManagementRepository` JPA/native scalar projection |
| `HTTPException` | `ApiException`, rendered by the platform as `{ "detail": ... }` |
| Python test characterization | `ManagementRouteContractTest` and `ManagementServiceTest` |

All MNG entities retain the PostgreSQL table and column names, including PostgreSQL `INTEGER` keys. Cross-feature references such as `company_id`, `employee_id`, and `master_id` remain scalar IDs; this package has no object relationship to HR, auth, or menu aggregates. Employee and display-name enrichment uses read-only scalar projections only.

The five PUT bodies are typed DTOs. Their setters record whether each JSON field was supplied. Company updates follow the Python service and ignore supplied `null` values. The development request/project/inquiry and outsource-contract DTOs preserve omission versus explicit `null`: nullable columns can be cleared, while supplied `null` for a non-null database column is ignored rather than assigned to a Java primitive. Invalid typed JSON and a `null` body are rendered as `422` by the platform validation handler.

## JPA Transaction Example

`ManagementService.createDevRequest` is an application-service `@Transactional` method. When `request_seq` is zero, it locks the existing `mng_companies` row with `PESSIMISTIC_WRITE`, reads the maximum sequence for the matching `(company_id, request_ym)`, then persists and flushes the new request. Under PostgreSQL `READ COMMITTED`, the second allocator waits for the first transaction and then observes its committed sequence. This prevents concurrent Java requests from selecting the same next sequence without changing the legacy schema.

The infra-config bulk upsert similarly locks its `mng_infra_masters` row before looking up or inserting `(master_id, section, config_key)` values. There is no `@Version` column because the baseline schema has no version column. There is no automatic retry loop; lock timeout, deadlock, or serialization failures roll back and are left to the request/infrastructure retry policy.

## Mutation Decisions

All rows below use an application-service `@Transactional` boundary and PostgreSQL's default `READ COMMITTED` isolation. "Repeat" describes a second call after the first committed.

| Mutation | JPA write and lock | Retry | Repeat, idempotency, and conflict decision |
| --- | --- | --- | --- |
| `POST /companies` | Pre-check then `persist`/`flush`; unique constraint is authoritative | None | Non-idempotent; repeated code is `409` with the Python Korean detail |
| `PUT /companies/{id}` | Managed-entity dirty checking/`flush`; no lock | None | State-idempotent for the same patch, though `updated_at` changes; missing row is `404`; supplied null is ignored |
| `DELETE /companies` | Load matching IDs then `remove`/`flush`; no lock | None | Repeat is `404 삭제할 고객사가 없습니다.`; FK conflicts are `409` |
| `POST /manager-status` | Scalar FK checks then `persist`/`flush`; unique constraint is authoritative | None | Non-idempotent; duplicate mapping is `409` |
| `DELETE /manager-status` | Load then `remove`/`flush`; no lock | None | Repeat is `404 삭제할 매핑이 없습니다.` |
| `POST /dev-requests` | `PESSIMISTIC_WRITE` company lock only for zero-sequence allocation, then `persist`/`flush` | None | Non-idempotent; zero generates the next sequence, explicit sequence is retained |
| `PUT /dev-requests/{id}` | Managed dirty checking/`flush`; no lock | None | State-idempotent; explicit null clears nullable fields, missing row is `404` |
| `DELETE /dev-requests` | Load then `remove`/`flush`; no lock | None | Idempotent count contract; repeat returns `deleted_count: 0` |
| `POST /dev-projects` | `persist`/`flush`; no lock | None | Non-idempotent; database conflicts are `409` |
| `PUT /dev-projects/{id}` | Managed dirty checking/`flush`; no lock | None | State-idempotent; strings are trimmed like Python; missing row is `404` |
| `DELETE /dev-projects` | Load then `remove`/`flush`; no lock | None | Idempotent count contract; repeat returns zero |
| `POST /dev-inquiries` | `persist`/`flush`; no lock | None | Non-idempotent; database conflicts are `409` |
| `PUT /dev-inquiries/{id}` | Managed dirty checking/`flush`; no lock | None | State-idempotent; explicit null clears nullable fields; missing row is `404` |
| `DELETE /dev-inquiries` | Load then `remove`/`flush`; no lock | None | Idempotent count contract; repeat returns zero |
| `POST /outsource-contracts` | Employee check, duplicate pre-check, then `persist`/`flush`; unique constraint handles races | None | Non-idempotent; duplicate employee/start date is `409` with the Python Korean detail |
| `PUT /outsource-contracts/{id}` | Managed dirty checking/`flush`; unique constraint handles changed-date races | None | State-idempotent; nullable note can be cleared; missing row is `404` |
| `DELETE /outsource-contracts` | Load then `remove`/`flush`; no lock | None | Idempotent count contract; repeat returns zero; FK conflicts are `409` |
| `POST /outsource-attendances` | Contract check then `persist`/`flush`; no lock | None | Non-idempotent; repeats create another attendance row |
| `DELETE /outsource-attendances` | Load then `remove`/`flush`; no lock | None | Idempotent count contract; repeat returns zero |
| `POST /infra-masters` | Duplicate pre-check then `persist`/`flush`; unique constraint handles races | None | Non-idempotent; duplicate triple is `409` with the Python Korean detail |
| `DELETE /infra-masters` | Bulk-delete child configs, remove masters, then `flush`; no lock | None | Idempotent count contract; repeat returns zero |
| `POST /infra-configs/{master_id}` | `PESSIMISTIC_WRITE` master lock, lookup by unique key, then insert or dirty-check/`flush` | None | Key-idempotent: repeat/concurrent same key leaves one row; last committed values win |
| `DELETE /infra-configs/{config_id}` | Load then `remove`/`flush`; no lock | None | Repeat is `404 인프라 구성을 찾을 수 없습니다.` |

## Tests and Opt-In PostgreSQL Check

Run the route and service tests with:

```powershell
cd backend-spring
.\gradlew.bat test --tests 'com.vibehr.management.*'
```

`ManagementPostgreSqlSchemaIntegrationTest` is tagged `integration`. It starts disposable PostgreSQL 16, creates test-only DDL derived from the baseline migration for the nine MNG tables plus minimal referenced HR/auth keys, and boots an isolated Spring JPA context with Hibernate `ddl-auto=validate`. It checks integer primary keys, FK count, representative baseline indexes, concurrent request sequence allocation, and concurrent infra upsert idempotency. It does not add or execute production DDL.

```powershell
$env:VIBEHR_RUN_CONTAINER_TESTS = 'true'
.\gradlew.bat integrationTest
```

The disposable fixture is not the complete Alembic head: provisioning every non-MNG table and executing the full Python migration graph is outside this worker's ownership. Hibernate validation against all nine exact MNG mappings is covered; a full Alembic-head environment remains the live deployment validation gap.

No generated endpoint ledger or manifest assignment is claimed here. Route coverage is the controller mapping inventory asserted by `ManagementRouteContractTest`; the separate endpoint manifest and its path-parameter matcher are intentionally untouched.
