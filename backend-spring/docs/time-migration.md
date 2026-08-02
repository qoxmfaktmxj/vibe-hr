# TIM Spring Migration

## Scope

This package migrates the TIM HTTP and persistence behavior from the Python service into `com.vibehr.time`.
It owns JPA write models for all `tim_*` tables and uses MyBatis annotation mappers for the attendance and reporting grids.
HR, organization, and auth identifiers remain scalar IDs; this package does not duplicate their entities.

## Route Coverage

The controller contract test fixes the canonical set at **36 of 36 Spring routes**.

| Area | Count | Canonical routes |
| --- | ---: | --- |
| Attendance codes | 2 | `GET /tim/attendance-codes`, `POST /tim/attendance-codes/batch` |
| Work schedules | 2 | `GET /tim/work-schedules`, `POST /tim/work-schedules/batch` |
| Holidays | 3 | `GET /tim/holidays`, `POST /tim/holidays/batch`, `POST /tim/holidays/copy-year` |
| Schedule assignment | 7 | `GET /tim/schedules/patterns`, `GET/POST /tim/schedules/departments`, `GET/POST /tim/schedules/exceptions/employees`, `POST /tim/schedules/generate`, `GET /tim/schedules/me/today` |
| Daily attendance | 8 | `GET /tim/attendance-daily`, `GET /today`, `GET /today-schedule`, `GET /detail/{attendance_id}`, `POST /check-in`, `POST /check-out`, `POST /{attendance_id}/correct`, `GET /{attendance_id}/corrections` |
| Annual leave | 4 | `GET /tim/annual-leave/employee/{employee_id}`, `GET /my`, `POST /adjust`, `GET /list` |
| Leave requests | 6 | `GET /tim/leave-requests`, `GET /my`, `POST /tim/leave-requests`, `POST /{request_id}/approve`, `POST /{request_id}/reject`, `POST /{request_id}/cancel` |
| Month close | 3 | `GET /tim/month-close`, `POST /tim/month-close`, `POST /tim/month-close/{year}/{month}/reopen` |
| Report | 1 | `GET /tim/reports/summary` |

The Spring base path is `/api/v1`, so the first route is served as `/api/v1/tim/attendance-codes`.

## Behavior Decisions

| Mutation | Locking and repeat behavior | Status behavior |
| --- | --- | --- |
| Check-in | Employee-and-KST-date advisory lock plus pessimistic row lock; the resolved naive planned start is interpreted as KST and compared with the UTC actual instant. | Duplicate: `409` with `오늘 이미 출근 처리되었습니다.`. A closed month does not add a non-legacy `423` gate. |
| Check-out | Employee-and-KST-date advisory lock plus pessimistic row lock; calculation and mutation commit together. | Missing check-in: `400` with `출근 기록이 없어 퇴근 처리할 수 없습니다.`; duplicate: `409` with `오늘 이미 퇴근 처리되었습니다.`. A closed month preserves those legacy outcomes. |
| Attendance correction | Pessimistic attendance row lock and correction audit insert in the same transaction. | Missing record: `404`; closed month: `423` |
| Schedule generation | Date-range advisory lock; `create_if_missing` skips pre-existing employee-date rows. | Invalid target or range: `400` |
| Leave create | Employee/year advisory lock and overlap check; annual balance is checked before insert. | Overlap: `409`; insufficient balance: `400`; closed month: `423` |
| Leave decision and cancel | Pessimistic request and annual-balance row locks; approved annual leave debits once and cancellation refunds once. | Non-pending decision: `400`; invalid cancellation: `409`; closed month: `423` |
| Month close | Month advisory lock and pessimistic close-row lock; recalculates daily hours, snapshots totals, then JPA-persist/updates the five PAY variable inputs in the same transaction. A JPA write failure rolls back the close row and every earlier PAY write. | Repeated close: `409` with the legacy year/month detail |
| Month reopen | Month advisory lock and pessimistic close-row lock; generated PAY rows remain, and a later close updates rather than duplicates them. | Unclosed or missing month: `409` with the legacy year/month detail |

`409` and `423` use the shared typed `ApiException` response envelope where the legacy route defines them. Check-in and check-out do not add a `423` response. User-facing lock details remain Korean.

The legacy menu-action boundary is preserved without duplicating authorization data: attendance-code reads/writes require
`query`/`save` on `/tim/codes`, work schedules and schedule assignments require them on `/tim/work-codes`, and holiday
routes require them through the `tim.holidays` menu code. The existing menu permission service remains the single source
of action decisions.

## Time Semantics

- Actual event persistence uses `Instant` with Hibernate `TIMESTAMP` JDBC typing against canonical PostgreSQL `timestamp without time zone` columns, with the JDBC session fixed to UTC; business dates use `LocalDate` in `Asia/Seoul`.
- Planned daily start/end values remain naive `LocalDateTime` KST wall times, matching the legacy schema. They are explicitly normalized to UTC before late comparison.
- Regular work is actual elapsed time minus breaks, capped at expected minutes.
- Night work is the KST overlap with `22:00-06:00`, including cross-midnight intervals.
- Holiday or non-workday minutes are split into holiday base (first 480 minutes), holiday overtime, and holiday night minutes.

## Persistence Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Writes and state transitions | JPA entities plus `EntityManager` transactions | Natural row lifecycle, pessimistic locks, and auditable correction records. |
| Daily attendance grid | MyBatis annotation mapper | Existing HR/ORG/AUTH joins and pagination are explicit without duplicate entities. |
| Summary report grid | MyBatis annotation mapper | Grouped aggregation remains database-side and returns typed projection records. |
| PAY month-close output | MyBatis read projection plus JPA `EntityManager` write | Reads the latest active salary profile, then locks the variable-input natural key and persists or updates `OTX`, `NGT`, `HDW`, `HDO`, and `HDN` through the PAY entity. |
| Cross-domain lookup | Scalar IDs and read-only SQL projections | TIM never owns HR, ORG, or AUTH entity lifecycle. |

PAY amounts preserve the legacy formula: base salary divided by 209 hours, multiplied by minutes divided by 60 and the item multiplier (`1.5`, `0.5`, `1.5`, `2.0`, `2.0`), then rounded with Python-compatible half-even behavior. Existing rows are updated even when recalculation reaches zero; new zero rows are not inserted. The memo is `월마감 자동생성 ({minutes}분)`.

## Migration Learnings

| Legacy observation | Spring decision | Regression guard |
| --- | --- | --- |
| Planned datetimes are stored without a zone but represent KST. | Model planned values as `LocalDateTime` and normalize with `Asia/Seoul` only at the comparison boundary. | UTC-date-boundary formula, service, and PostgreSQL tests. |
| Duplicate punches are conflicts, not successful retries. | Keep locking idempotent at the data layer while returning the exact `409` contract. | Unit detail assertions and two-thread PostgreSQL duplicate test. |
| Month close writes both TIM snapshot and PAY variable inputs. | Flush TIM JPA state before the typed aggregate read, then persist/update PAY rows through JPA in the same Spring transaction. | Five-code amount assertions plus reopen/reclose update test. |
| A missing close row is created under contention. | Populate all non-null fields before identity insert, protected by the month advisory lock. | Two-thread close test proving one close and one exact `409`. |

## Tests

- `TimeRouteContractTest`: exact 36-route controller surface.
- `TimeFormulaTest`: KST cross-midnight night, regular/overtime, holiday, and leave calculations.
- `TimeAttendanceMutationTest`: exact duplicate/missing-punch statuses and Korean details, plus the KST-to-UTC late boundary.
- `TimeLockingTest`: advisory lock plus `PESSIMISTIC_WRITE` before legacy month-close conflict.
- `TimeControllerTest`: authenticated self-service target resolution and legacy menu-action enforcement.
- `TimeContractTest`: legacy optional-field defaults and nested typed Bean Validation.
- `TimePostgreSqlIntegrationTest`: self-provisioning `postgres:16-alpine` with canonical Flyway V1-V5 and Hibernate validation enabled. It verifies that a KST business date and UTC event instant persist/reload through the real `timestamp without time zone` columns, closed-month check-in/check-out retain the legacy `400`/`409` behavior, concurrent close calls leave one natural-key row per PAY item, five PAY outputs update on reclose, and a forced JPA write failure rolls back both `tim_month_closes` and all PAY rows.

Run locally:

```powershell
cd backend-spring
./gradlew test --tests "com.vibehr.time.*"
$env:VIBEHR_RUN_CONTAINER_TESTS = "true"
./gradlew integrationTest --tests "com.vibehr.time.TimePostgreSqlIntegrationTest"
```

The integration fixture creates no manual DDL. Flyway V1-V5 own the disposable PostgreSQL schema, while the test adds and removes only a temporary failure trigger used to prove transaction rollback.

## BFF Coverage And Gaps

The integration route measurement reports **36 of 36** canonical TIM routes with zero extras and zero duplicates. No BFF files were modified here because they remain outside this package's ownership. There are no known TIM route gaps.
