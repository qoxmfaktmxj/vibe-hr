# Leave approval automatic attendance and unpaid deduction

Status: Local implementation and verification complete; exact-SHA publication and deployed readback are required before the final release result.

## Authorization and policy

The user explicitly requested automatic attendance-state reflection and unpaid-leave deduction on approval, alignment with existing policy, verification in the same isolated environment, passing tests, push and deployment. The user selected the recommended new amount rule: base salary / 209 multiplied by scheduled leave hours, excluding nonworking days. This is R3 authorization for the bounded TIM/PAY, forward migration and release work below.

The existing V1 deduction path adds deductions to the payslip and subtracts them from net pay. Preserve that path, existing tax/insurance bases and masters, divisor, overtime multipliers and half-even rounding. Aggregate approved unpaid scheduled minutes per employee/month and round the resulting automatic deduction to whole won using BigDecimal HALF_EVEN. Use the payroll target's existing base-salary snapshot so refresh/recalculation stays internally consistent. Paid annual/half-day/sick/other leave does not create an unpaid deduction.

## Implementation plan and acceptance

1. Establish the existing payroll/time baseline before behavior changes.
2. Persist an explicit attendance-to-approved-request link plus the underlying status and whether leave created the row. Approval and cancellation update this in the same transaction as existing annual balances. Preserve punch timestamps. Full-day approval conflicting with recorded work fails atomically; approved full-day leave must be cancelled before a conflicting punch/correction. Half-day metadata coexists with real work status and minutes, without inventing AM/PM or overtime-threshold changes.
3. Use generated employee schedules where available, otherwise existing weekday/active-holiday rules. Freeze applied attendance links and unpaid minutes at approval. New annual deductions use the same applicable workdays; legacy null annual snapshots retain their earlier cancellation accounting. Half-day remains one eligible weekday, uses 0.5 annual days and rejects an employee nonworking day.
4. New approved unpaid requests store nullable monthly scheduled-minute snapshots. Payroll calculation derives a reserved automatic deduction directly from approved snapshots. Cancellation removes that source from subsequent calculations. Historical null snapshots retain the existing manual review behavior, preventing retroactive/double charges.
5. Share existing month-close advisory locks across approval, cancellation, corrections, punches and payroll finalization. Recheck closure after acquiring locks. Preserve the explicit legacy permission for punches in a closed month. Reject automatic-source changes affecting closed/paid employee payroll. Refresh changed automatic amounts before closing an otherwise calculated run, preserving finalized snapshots.
6. Add a forward V7 migration for the exact new fields and required deduction/GL references. Preserve V1 through V6 and the adoption manifest; extend runtime schema verification to recognize only the exact V7 additions. No historical business-data backfill.
7. Show approved half-day metadata in existing attendance views and fractional leave usage in month-close results. Existing API routes and role policy stay intact. Affected BFF paths are `/api/tim/leave-requests/**`, `/api/tim/attendance-daily/**`, `/api/tim/month-close/**`, `/api/tim/reports/summary` and `/api/pay/runs/**`; Spring controllers retain their `/api/v1` equivalents.
8. Add red/green unit/PostgreSQL and real-browser tests for approval/cancellation, workday boundaries, preserved punches, half-day hours, cross-month/year snapshots, repeated actions, concurrent close and finalized payroll protection. Run applicable full gates, publish only owned files, then verify exact-SHA Actions and deployed read-only behavior.

## Responsibilities and concrete schema

The time implementation owns `backend-spring/src/main/java/com/vibehr/time/**` and related time tests. Parent owns payroll, Flyway/schema-verification, frontend, audit and task-ledger changes. Shared Gradle and Next build/test invocations are coordinated sequentially.

V7 additions: nullable attendance `approved_leave_request_id` with an explicit request FK, nullable `leave_base_status`, non-null `leave_generated` default false; nullable leave-request `payroll_minutes_snapshot` JSONB; non-null month-close `half_day_count` default zero. Full-day count stays in the existing integer column; response `leave_days` includes half-day_count / 2. Attendance responses add nullable `approved_leave_type`, retaining existing status values. The reserved automatic deduction code is `TIM_UNPAID`; its GL mapping follows the existing base-salary expense mapping. Manual variable inputs cannot use this automatic code.

## Isolation and recovery

Reuse only the preserved container labelled `codex.task=financial-finalization-20261017`, owned loopback Spring/Next services, temporary credentials and new synthetic FQ employees/payroll codes. Never copy or mutate production business data for verification. Preserve unrelated working-tree configuration cleanup and the gallery ledger insertion.

Recovery retains the additive columns and approved-source snapshots. Revert application changes only with leave approval/cancellation and affected payroll operations suspended until a compatible version is restored; never drop snapshots or resume the earlier cancellation implementation over new approvals. No immutable migration or historical finalized payroll is rewritten.

The previous V6-only image cannot restart after a candidate commits V7. Deployment now validates the previous OCI commit and compares migration paths/content before candidate startup. Failures before promotion preserve running containers. Once promotion starts, changed migration inventory selects the tested new backend with the previous frontend for recovery; unchanged inventory permits both previous images. All three readiness checks remain mandatory, backups/image identities are retained on failure, and a recovered workflow still fails. No schema downgrade or validation bypass is introduced. A pre-promotion failure after migration requires a compatible forward release before restarting the old backend.

## Findings and regression evidence

- The initial seven attendance tests fail before automatic approval handling. New unit and actual PostgreSQL cases cover generated-row removal, correction-history preservation, full-day punch conflicts, half-day work, working Saturdays/nonworking days, cross-month/year snapshots, close races and finalized payroll protection.
- Five of eleven payroll cases fail before automatic calculation. A separate two-session PostgreSQL regression exposes an incorrect 32-bit advisory key in the initial implementation; calculation now uses the exact Time `hashtextextended` 64-bit month key. The existing payroll natural-key lock is unchanged.
- Manual `TIM_UNPAID` inputs are rejected on save. Existing stored inputs with that reserved code also block calculation and close with 409 before replacing calculated results, covering an old-backend/new-database transition. The added assertion fails before this guard and preserves the earlier calculated totals afterward.
- The existing leave-type report used XML-escaped comparisons in a raw MyBatis annotation, producing invalid SQL when the new real report test exercised it. Replace those two comparisons with SQL operators; retain all report and access checks.
- A UTC-browser regression exposed attendance clocks displayed in the browser's time zone. Both existing clock formatters now use Asia/Seoul. The retained business-date case verifies `반차 (정상출근)`, 09:00/14:00, export dates and full-day dashboard punch controls. The screenshot confirms correct Korean rendering.
- Runtime schema verification rejects wrong V7 defaults, types, JSONB nullability and FK targets. Static coverage recognizes only the five reviewed V7 fields and retains missing-owner, extra-field and type/nullability rejection. Frozen legacy references and V1-V6 files are unchanged. Fresh-install replay-store assertions now require all seven versions.
- Six shell fixtures execute the actual deployment recovery functions with isolated Docker/health stubs: pre-promotion preservation, migrated partial promotion, unchanged inventory, recovery compose failure, recovery readiness failure and invalid prior image revision. Three fail before the workflow correction. Review also strengthened the invalid-revision fixture so it asserts the intended failure rather than an uninitialized shell variable.

No dependency, role policy, route, shared grid implementation, existing payroll divisor/multiplier, tax master or historical payroll snapshot is changed. Existing cases and assertions are retained; affected cases extend the new behavior.

## Completed local verification

850 distinct cases pass with zero final failures, errors, skips or flaky cases: 216 default, 94 PostgreSQL and 20 migration/security backend cases; 305 frontend units; 154 browser cases; 53 Node and 8 Python cases. Browser inventory is 3 actual financial/time scenarios, 47 additional workflows, 8 employee UX, 57 experience, 34 production-build audit, 4 responsive layout and 1 GPU case. The standalone new time scenario also passes; it is not counted twice. Red attempts and invalid interrupted/partial checks are retained separately and do not substitute for the final complete gates.

Commands and final logs in the evidence directory:

- `VIBEHR_RUN_CONTAINER_TESTS=true JAVA_TOOL_OPTIONS=-Duser.timezone=UTC ./gradlew --no-daemon --console=plain --rerun-tasks test integrationTest migrationIntegrationTest bootJar`: `final-backend-green.log` and final Gradle XML, all 330 cases green.
- `npm run validate:grid`, global ESLint, `vitest run`, all eight browser configurations listed above and `next build` including TypeScript: `static-frontend.log`, `live-frontend.log`, named JSON reports and screenshots. Next invocations run sequentially against the shared build directory.
- `node --test` over every `scripts` and `orchestration` test file, plus the existing `python -m unittest discover -s scripts/ci -p test_*.py`: `final-node-green.log`, `final-python.log`.
- Exact retirement/endpoint/route/schema/mutation/Flyway/BFF/delivery inventories and `smoke-spring-compose.behavior.test.ps1`: `static-gates.log` and individual gate logs. Frozen reference checks remain intact.
- `scripts/spring-migration/smoke-spring-compose.ps1`: `final-image-smoke.log`, real fresh V7 PostgreSQL/image readiness, non-root/no-Python image and Korean PDF font checks, 281 API operations and 8 public-doc method contracts. Only its labelled disposable resources are removed afterward.

The isolated real time scenario verifies 1.5 annual days, preserved 240 half-day work minutes, 2.5 month-close leave days, five generated allowances totalling 515,000, and an automatic unpaid deduction of 80,000 for 8 approved hours with a 2,090,000 base snapshot. Cancellation decreases deductions by exactly 80,000 and removes its generated attendance before reapproval. Independent manual deduction remains 10,000. Gross 2,605,000, deductions 649,301.81 and net 1,955,698.19 agree through paid state, confirmed balanced accrual/disbursement vouchers and the owner's payslip/PDF. Reopening attendance cannot change the finalized payroll sources. The original three-month payment, retirement and reviewed severance finalization scenario also passes.

Independent read-only reviews cover Time concurrency/data preservation, payroll calculation/finalization, strict schema extensions, shell recovery and the regression fixtures. No remaining implementation blocker was found. All 29 source/workflow/test hashes match the final frozen manifest. Owned loopback services are stopped and the labelled database is retained after final SQL readback. Publication stages only the explicit 36 files and this task's ledger addition, preserving unrelated local work. Hosted/deployed results are recorded after publication in ignored evidence so evidence-only updates do not trigger another release.

Ignored evidence directory: `output/leave-auto-reflection-20261017/`.
