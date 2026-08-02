# PAY Migration

> **Runtime ownership:** Spring Boot and Flyway are the only runtime owners. Python, FastAPI,
> Pydantic, and Alembic references below are frozen pre-cutover compatibility evidence; never run
> them as an operating procedure.

## Scope

This package owns the 41 canonical `pay` routes in `docs/spring-migration/endpoint-manifest.json`:

- `10` `pay_setup` routes.
- `12` `pay_voucher` routes.
- `17` `payroll_phase2` routes.
- `2` severance item-rule routes documented by the frozen `hr_severance.py` evidence but categorized as PAY.

The five `/api/v1/hr/severance/calcs/**` routes remain HR-owned. PAY reads HR, organization,
auth, TIM leave, appointment, and welfare data through typed MyBatis/native projections only
for complex read shapes and does not register another JPA entity for those tables.

## Schema Defaults

Flyway is the sole schema and required-reference-data writer, and Hibernate uses `ddl-auto=validate`.
JPA is the default write path for PAY mutations. Use MyBatis only for the cross-domain reads and
projection shapes that would otherwise become awkward, duplicated, or inefficient in JPA.
The following table documents the Java runtime default chosen from the frozen FastAPI/Pydantic evidence when a field is
omitted. `null` preserves an explicit legacy nullable value. Existing numeric columns stay
`Double`/`double` to preserve PostgreSQL `FLOAT` and FastAPI float output compatibility.

| Table | Java owner | Runtime defaults / notes |
| --- | --- | --- |
| `pay_payroll_codes` | `PayrollCode` | `tax_deductible=true`, `social_ins_deductible=true`, `is_active=true` |
| `pay_tax_rates` | `TaxRate` | Nullable employee/employer rate and limits remain nullable |
| `pay_income_tax_brackets` | `IncomeTaxBracket` | `annual_taxable_to=null`; rate and deduction remain legacy doubles |
| `pay_allowance_deductions` | `AllowanceDeduction` | `calculation_type=fixed`, `is_active=true`, `sort_order=0` |
| `pay_item_groups` | `ItemGroup` | `description=null`, `is_active=true`; omitted `details` does not replace existing links |
| `pay_item_group_details` | `ItemGroupDetail` | Rebuilt only when a group request supplies `details` |
| `pay_employee_profiles` | `EmployeeProfile` | Salary `0`, `regular`, `fixed_day`, `previous_business_day`, active `true` |
| `pay_variable_inputs` | `VariableInput` | Memo remains nullable; amounts keep legacy double behavior |
| `pay_payroll_runs` | `PayrollRun` | Starts `draft` with zero totals |
| `pay_payroll_run_targets` | `PayrollRunTarget` | Snapshot JSON is PostgreSQL `json`; created at run creation/backfill with the real event count and review flag |
| `pay_payroll_run_employees` | `PayrollRunEmployee` | Result rows are replaced atomically during calculation |
| `pay_payroll_run_items` | `RunItemEntity` | Detail lines preserve legacy double amounts and source type |
| `pay_payroll_run_events` | `PayrollRunEvent` | Append-only workflow event audit |
| `pay_payroll_run_target_events` | `PayrollRunTargetEvent` | PostgreSQL `json`; records confirmed appointment, payroll-profile, approved unpaid-leave, and approved/payroll-reflected welfare events with source payloads |
| `gl_accounts` | `GlAccount` | Net-pay/cash flags default `false`; active defaults `true` |
| `pay_gl_mappings` | `GlMapping` | `note=null`, `is_active=true` |
| `pay_vouchers` | `Voucher` | `voucher_type=accrual`, draft status, calculated totals |
| `pay_voucher_lines` | `VoucherLine` | Nullable cost center, summary, and source item code are retained |
| `pay_severance_item_rules` | `SeveranceItemRule` | `include_type=full`, `is_active=true`, `note=null` |

## Mutation Decisions

| Endpoint family | Transaction owner | Lock / idempotency decision | Conflict behavior |
| --- | --- | --- | --- |
| Setup, GL, profile, variable-input, and severance-rule batch saves | `PayrollService` JPA transaction | Natural keys are prechecked and retained as database unique constraints; delete of a missing id is a no-op | Duplicate natural keys return `409` with the FastAPI detail |
| `POST /runs` | `PayrollService` JPA transaction | PostgreSQL transaction advisory lock on `(year_month, payroll_code_id)` before insert | Repeat create returns `409` |
| Calculate, recalculate, and snapshot backfill | `PayrollService` JPA transaction | `PESSIMISTIC_WRITE` on payroll run; results are delete-and-rebuild within the same transaction | Missing `404`; closed/paid calculation/backfill `409` |
| Appointment, leave, and welfare source collection | Typed `PayrollProjectionMapper` reads; PAY JPA event writes | External tables retain their existing owner; PAY persists only `pay_payroll_run_target_events` and target counters | Only confirmed appointment, approved overlapping leave, active welfare type, matching approved/reflected welfare rows are included |
| Welfare payroll reflection | Native external command inside the calculation transaction | Matching requests become `payroll_reflected` with `<YYYY-MM> 정기급여`; the same label makes recalculation idempotently reuse the request | Non-matching month and already-reflected requests for another run are excluded |
| Close and mark-paid | `PayrollService` JPA transaction | `PESSIMISTIC_WRITE` on run; terminal state is checked under lock | Invalid or repeat transition `409` |
| Automatic accrual voucher after close | Separate `TransactionTemplate` transaction | Failure remains isolated from the committed close and is logged at WARN with `run_id` and `action=close` | Accounting setup failure does not reopen payroll |
| Generate accrual/disbursement voucher | `PayrollService` JPA transaction | Uses locked payroll run and unique `(run_id, voucher_type)` key; a draft is replaced, confirmed/cancelled rows are immutable | State/precondition conflicts `409`, missing mappings `422` |
| Confirm/cancel voucher | `PayrollService` JPA transaction | `PESSIMISTIC_WRITE` on voucher | Repeated/invalid transition `409` |
| My payslip/detail/PDF and grids | Read-only transaction | Employee identity is derived from authenticated user; projection only | Missing/non-closed payroll data `404` |

## Arithmetic And Output Compatibility

- Storage and JSON values retain `Double`/`double`, while intermediate money rounding uses the
  original IEEE-754 double with ties-to-even at two decimal places. This preserves Python
  `round(..., 2)` results for legacy inputs such as `2.355 -> 2.35`.
- Voucher lines are rounded to whole won. A debit/credit difference at or below one won receives a
  rounding adjustment line; larger differences fail with the legacy `400` detail.
- Income tax uses the annual bracket first, then the legacy flat-rate fallback. National pension,
  health, long-term-care, employment, income, and local tax detail lines preserve the source item
  codes and warning text.
- Voucher CSV is UTF-8 with BOM, uses the legacy header order, and has quoted attachment names.
  Payslip endpoints return `application/pdf` with the exact unquoted legacy filename headers.
- Welfare applies `approved_amount` first and falls back to `requested_amount`. Earning benefits
  update gross and taxable/non-taxable totals; deduction benefits update deductions. Item master
  direction, name, tax type, and calculation type follow the FastAPI fallback order.
- Payslips are valid A4 PDFBox 3.0.8 documents containing employee number/name/department,
  year-month, earning and deduction tables, and gross/deduction/net totals. The renderer checks
  `VIBEHR_PAYSLIP_FONT_PATH`, then `vibehr.payroll.payslip-font-path`, then the same Windows/Linux
  Korean system-font families used by FastAPI. Delivery must install a licensed Korean TTF/OTF
  (for example the distro Nanum package) and may set the environment variable; no font binary is
  bundled in PAY.

## Learning And Deferred Contract

- Target materialization is part of payroll calculation input, not display-only audit data. Review
  events must set the employee warning and contribute once to `review targets: N`; apply events
  still increment `event_count` without setting `review_required`.
- The frontend currently calls `/api/pay/runs/{run_id}/targets/{employee_id}` from
  `payroll-run-manager.tsx`, while FastAPI has a service function but no registered controller route
  and the canonical manifest has no route key. This migration intentionally does **not** add a 42nd
  Spring PAY route. The missing source consumer contract is an approved deferred product decision.

## Validation Commands

From `backend-spring` on Windows PowerShell:

```powershell
.\gradlew.bat test --tests 'com.vibehr.payroll.*'
$env:VIBEHR_RUN_CONTAINER_TESTS='true'; .\gradlew.bat integrationTest --tests 'com.vibehr.payroll.*'
```

Route coverage is read without writing generated global ledgers:

```powershell
node -e "const c=require('./scripts/spring-migration/spring-route-coverage').buildCoverage(process.cwd()); console.log(c.domains.implemented.pay, c.domains.missing.pay)"
```

Exact command results for this completion pass are recorded in the final implementation report;
generated global ledgers are intentionally not edited by PAY.
