# Isolated leave, time close and payroll verification

Status: Local verification complete; exact-SHA publication and production readback evidence accompany the final report.

## Authorization and isolation

The user requested leave approval and attendance month-close verification through payroll calculation and final payment, using the same isolated environment as financial finalization. Necessary fixes, regression tests, push and deployment are explicitly authorized. Changes to the TIM to PAY pipeline are R3.

Reuse only the disposable PostgreSQL container labelled `codex.task=financial-finalization-20261017`, its existing minimal development administrators and new synthetic `FQ-` employees. Do not copy production data or perform production business mutations. Temporary credentials remain in ignored local runtime state. Preserve unrelated working tree changes.

## Plan and acceptance

1. Run the existing payroll/time baseline and inspect the established contracts.
2. Compare pending, approved and cancelled annual, half-day and unpaid requests. Annual and half-day approval must debit annual balances correctly without reducing paid base salary. Approved unpaid leave is an existing payroll review event; V1 does not define an automatic unpaid deduction formula. Verify the event and explicit variable deduction path rather than inventing a salary policy.
3. Close October attendance and compare all five generated overtime/night/holiday items with independently calculated amounts. Reopen, correct and reclose to verify replacement rather than duplication. Match the applicable profile period with payroll snapshot selection.
4. Calculate and refresh the dedicated payroll run, inspect item-level results, close, confirm balanced vouchers, mark paid and verify the synthetic owner's payslip. Closed/paid results must remain immutable.
5. Reproduce any defect before a narrow correction. Run applicable regression gates, push only task-owned files, verify exact-SHA hosted checks and deployment, then read back the deployed site without business writes.

## Contract boundaries

`TimeApplicationService`, `TimePayrollGateway` and their PostgreSQL tests own month-close generation. `PayrollService` and `PayrollProjectionMapper` own source-event snapshots, variable inputs and calculation. The existing BFF routes and browser screens retain their API shapes. Preserve hourly divisor 209, existing multipliers, tax masters, rounding and snapshot refresh semantics.

## Evidence

Ignored local evidence directory: `output/time-payroll-chain-20261017/`.

## T01: expired payroll profiles affect month-close allowances

`TimePayrollGateway.monthlyPayWork` checks only `effective_from`, whereas payroll target snapshots also require `effective_to` to overlap the month. A newer expired profile therefore doubles the fixture's five allowances from a valid 2,090,000 salary to an expired 4,180,000 salary. With only an expired profile, it still creates allowances. Reclosing after a profile is expired also leaves those amounts in place.

Four PostgreSQL regressions cover selection of an older applicable profile, no applicable profile, clearing existing generated amounts on reclose, and the inclusive first-day boundary. Before the correction, three fail and the boundary passes. After the correction, all 19 time integration cases pass. The correction adds the existing payroll period-overlap condition and stable ID ordering, and uses a left lateral join with zero salary when no profile applies. Existing upsert logic then clears stale generated amounts without creating zero-only rows. No API, migration, tax, divisor, multiplier, rounding or permission change is involved.

Affected files: `backend-spring/src/main/java/com/vibehr/time/TimePayrollGateway.java`, `backend-spring/src/test/java/com/vibehr/time/TimePostgreSqlIntegrationTest.java`. Regression workflow: `frontend/tests/e2e/time-payroll-chain.spec.ts` and `frontend/playwright.financial.config.ts`.

## T02: invalid month-close confirmation markup

The real flow emits React invalid-nesting errors because both confirmations put block elements inside the shared description's paragraph. A focused browser regression fails on the nested paragraph in the reopen dialog. Keep the shared dialog unchanged, pass description text directly, and move the close memo into its existing children slot. The month-close API and Korean text remain unchanged. The regression checks both descriptions, the memo input and cancellation, with no business writes.

Affected file: `frontend/src/components/tim/tim-month-close-manager.tsx`.

The existing hosted employee-experience month-close case also opens and cancels the close dialog on both route aliases, verifies the memo and valid description markup, and captures Korean screenshots. This adds assertions to the existing CI case without changing the hosted case count or workflow.

## Regression harness and recovery

Repeated local financial runs reached the existing five-minute login limiter. Preserve those failed preflight reports. The shared global setup already logs in through the real browser and saves authenticated storage state, so both financial scenarios now verify that session through `/api/auth/me` instead of logging the administrator in again. Separate synthetic employee sessions still use the real login endpoint. No authentication control, limiter, cookie policy, existing test case or business assertion is removed. Run synthetic suites while the normal limit window expires, then run the live suites sequentially.

Rollback is a revert of this task's source/test/documentation commit followed by the same validation and deployment gates. There is no database migration or production data repair. Existing finalized payroll snapshots retain their immutable results. Historical finalized adjustments, if needed after a separate review, use the normal business process. Stop only the owned loopback Java process and labelled disposable container after collecting evidence; preserve the isolated database and all failed/green reports.

## Final local verification

All 815 distinct cases pass with zero final failures, errors, skipped or flaky cases: 204 default, 77 PostgreSQL and 20 migration/security backend cases; 305 frontend unit cases; 154 browser cases; 47 Node and 8 Python gate cases. Browser coverage is 3 financial/time cases, 47 additional workflows, 8 UX, 57 employee experience, 34 production-build audit, 4 responsive layouts and 1 GPU case. The extended existing hosted month-close case also passes a focused rerun on both route aliases. Grid validation, global and affected-file lint, the production build/TypeScript check, source hash verification and diff checks pass. No existing case is removed.

The final synthetic October employee uses 1.5 annual days and retains 13.5. A 2,090,000 base salary generates OTX 15,000, NGT 40,000, HDW 240,000, HDO 60,000 and HDN 160,000. Gross is 2,605,000. Reopening and correcting overtime produces 30,000, then zero, then 15,000 on the same five input IDs. A reviewed explicit 10,000 deduction changes net pay by exactly 10,000; final deductions are 569,301.81 and net is 2,035,698.19 under the unchanged V1 masters and rounding. The run reaches paid, both balanced vouchers are confirmed, the owner's item-level payslip and PDF agree, and paid-state recalculation, snapshot refresh and repeated payment return 409. Annual cancellation, pending approval and attendance correction return 423 while the month is closed. Only the approved unpaid request produces its review event; pending, rejected and cancelled requests are excluded.

Historical punch rows are explicitly synthetic fixture inputs. Attendance leave status is applied through the existing correction API; approval does not silently rewrite punches. Unpaid leave uses the existing review-event and separately entered deduction process. This verification does not claim automatic leave-to-punch synchronization or introduce an automatic unpaid salary formula.

SQL readback of the preserved disposable database shows 19 paid runs and paid events, 38 confirmed balanced vouchers, 5 confirmed retirement cases and severance calculations, 4 paid time-chain runs and closed October attendance. Every run has one employee. The owned backend and container are stopped and all owned test ports are closed. No production business mutation was submitted. A read-only production confirmation before publication reproduces three invalid nested blocks, then cancellation leaves January open.

## Publication manifest

- `backend-spring/src/main/java/com/vibehr/time/TimePayrollGateway.java`
- `backend-spring/src/test/java/com/vibehr/time/TimePostgreSqlIntegrationTest.java`
- `frontend/src/components/tim/tim-month-close-manager.tsx`
- `frontend/playwright.financial.config.ts`
- `frontend/tests/e2e/financial-finalization.spec.ts`
- `frontend/tests/e2e/time-payroll-chain.spec.ts`
- `frontend/tests/e2e/employee-experience.spec.ts`
- `docs/TEST_STRATEGY.md`
- This audit and this task's appended entry in `docs/TASK_LEDGER.md`

Publish only these ten files, preserving unrelated local configuration cleanup and the gallery ledger insertion. Verify the same commit's hosted UI and Deploy results, actual image revision/health and deployed read-only month-close, leave and payroll screens. Post-publication evidence remains in the ignored task directory and the final report.
