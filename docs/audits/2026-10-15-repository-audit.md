# Repository workflow audit, 2026-10-15

## Execution packet

- Request: pull the repository, use REA runtime evidence, find broken workflows and project-rule violations, and correct verified defects.
- Baseline: `main`, fast-forwarded from `f9efff0` to `be66845`; existing `.impeccable/` and `.playwright-mcp/` are preserved.
- Profile: controlled, small verified batches; no publication, production writes, deployment, migration-history changes, or dependency additions.
- Evidence: repository inspection establishes code paths; regression tests establish controlled behavior; REA captures will be recorded separately. Synthetic browser services do not certify Spring authorization or production data.
- Approval: user explicitly approved the HRI inbox and LF correction, HR transition changes, half-day and cross-year accounting, atomic HRI submission and appraisal validation, V6 deduction history, and real file processing across all 14 inventoried screens. User also explicitly approved the shared read-only grid selection repaint correction.
- Validation: grid registry before lint/build; affected browser flows before one final frontend build; Spring unit and focused PostgreSQL integration tests; delivery and immutable-evidence checks.

## Baseline observations

- Grid registry: passed.
- Frontend: 166 unit tests passed.
- Spring default test task: 179 tests, no failures, errors, or skips.
- Route coverage: 290/290; schema coverage passed; BFF audit found 158 route files and 142 Spring-targeted proxies with no legacy target.
- Immutable-evidence tests initially failed on 16 artifacts. Every LF-normalized working file and every Git blob matches the original frozen SHA-256. Windows `core.autocrlf=true` changed checked-out bytes to CRLF. No frozen content or expected digest needs changing.
- Docker was initially stopped. The existing local Docker Desktop was started for isolated test containers. No existing application containers or volumes are targeted for cleanup.

## Findings and disposition

| ID | Priority / risk | Trigger and evidence | Planned correction / status |
| --- | --- | --- | --- |
| F01 | P1 / R1 | Training approval selection calls `setGridApi(prev => prev)`, so approval/rejection eligibility does not rerender. `frontend/src/components/tra/tra-applications-approval-manager.tsx`. | Fixed. Actual selection state drives approval/rejection; training browser regressions pass. |
| F02 | P1 / R1 | Own training withdrawal memo depends on unchanged GridApi identity. `frontend/src/components/tra/tra-my-applications-manager.tsx`. | Fixed. Selected current rows drive withdrawal eligibility and refreshed-state handling. |
| F03 | P2 / R1 | Training confirmation dialogs omit `busy`, leaving confirmation active while create/withdraw/approve/reject requests run. Same two components. | Fixed. Existing busy contract protects all four dialogs; delayed create/withdraw tests pass. |
| F04 | P1 / R1 | Retirement approval compares a page-2 selected ID with a separate first-50 list, then resets to another employee. `frontend/src/components/hr/hr-retire-approval-manager.tsx`. | Fixed. Displayed page owns selection; page-2 writes, creation and refreshed empty results verified. |
| F05 | P1 / R1 | Severance calculations use the same first-page selection reset. `frontend/src/components/hr/hr-severance-calc-manager.tsx`. | Fixed. Page-2 selected calculation and actual adjustment/recalculation IDs verified. |
| F06 | P1 / R3 | HRI task query selects any actor WAITING step, while mutation authorizes only `current_step_order`. Future approvers/receivers see non-actionable tasks. `backend-spring/src/main/java/com/vibehr/hri/HriApplicationService.java`, `taskList` versus `actionable`. | Approved and fixed. Current-order-only list; real sequential approval/receive and terminal-state regressions pass. |
| F07 | P2 / R2 | Frozen SHA-256 verification fails on Windows CRLF checkout despite matching Git contents. `.gitattributes`, `scripts/spring-migration/retirement-snapshot.js`. | Approved and fixed. Sixteen canonical artifact hashes preserved; LF also fixes the existing Bash validation failure. Snapshot/seed-ledger and repository checks pass. |
| F08 | P1 / R3 | Open-ended permanent appointment blocks every later appointment; confirmed appointments cannot be edited/deleted. `HrApplicationService.appointmentRules`, update/delete guards. | Approved and fixed. Prior confirmed permanent interval ends the day before successor confirmation; same-date conflicts and temporary compatibility tested. |
| F09 | P1 / R3 | Two retirement drafts can both confirm. Cancelling one restores employee active despite another confirmed case. `HrApplicationService.createRetireCase`, `confirmRetireCase`, `cancelRetireCase`. | Approved and fixed. Employee-lock recheck prevents duplicate confirmation; realistic overlapping legacy cancellations restore original active/leave status in both orders. |
| F10 | P2 / R2 | New HRI submission always creates a draft, but `allow_draft=false` rejects that call, making the form impossible to submit. `hri-application-hub.tsx`, `HriApplicationService.saveDraft`. | Approved and fixed. Atomic direct-submit route, BFF and one-request UI; failed submission/resubmission rolls back without an intermediate visible draft. |
| F11 | P2 / R2 | `half_day` is offered by the UI/API but full working days are returned and annual balance changes only for `annual`. `TimeApplicationService` leave create/decide/cancel and response mapping. | Approved and fixed. One working-date half-day consumes/restores 0.5, with exact approval snapshots and legacy-null compatibility. |
| F12 | P2 / R2 | Cross-year annual leave is charged and restored only against its start year. Same leave methods. | Approved and fixed. Per-year debits, ascending locks, all-year preflight, exact snapshot restoration and employee-wide overlap protection verified. |
| F13 | P2 / R1 | Saving incomplete HRI draft JSON skips updating existing detail projection; subsequent detail read prefers stale projection. `HriApplicationService.saveDraft`, `detail`. | Fixed. DRAFT detail uses the latest saved content; complete/incomplete/read and subsequent submission verified. |
| F14 | P2 / R1 frontend, R2 server | New appraisal target has employee_id 0, employee columns are read-only, save removes zero ID, and backend silently skips it. `pap-appraisal-targets-manager.tsx`, `AppraisalService.targetBatch`. | Approved and fixed. Real employee selection and whole-batch preflight; explicit nullable score clearing and invalid-number protection also verified. |
| F15 | P2 / R1 | Appraisal target query/appraisal switch silently replaces dirty rows. Same target manager. | Fixed. Standard dirty confirmation reconciles active edits synchronously; cancel/confirm paths and original-value restoration tested. |
| F16 | P2 / R1 interface, R3 payroll import | Payroll and TIM template/upload/download handlers show a success toast without creating/reading a file. See inventory below. | User approved real implementation. All 14 screens now perform real file actions; 125 XLSX/CSV unit cases and 18 browser file-workflow cases pass. |
| F17 | P2 / R2 | The retirement CI scanner rejects existing hosted-UI support scripts and their documented unittest command. | Approved and fixed. Exact two file paths and whole command lines are reviewed exceptions; unknown files/commands still fail. Seven focused scanner tests and the actual repository scan pass. |

## Leave compatibility amendment requiring schema approval

The leave review found an additional data-compatibility boundary: existing approved half-day requests never debited annual balances, while existing cross-year approvals debited only the start year. Applying the new cancellation formula to those records would credit days to the wrong balances. Request dates alone cannot distinguish old and new accounting.

Proposed R3 amendment: add one nullable JSONB charge snapshot to `tim_leave_requests` through a new forward-only Flyway migration. New approvals store the exact year/day deductions before completion. New cancellations restore that snapshot, even if holiday configuration later changes. A null snapshot identifies pre-change approvals and preserves their original cancellation accounting: annual restores to the start year; legacy half-day restores zero. Do not backfill or rewrite historical balances. Verify fresh migration, legacy rows, new approvals, cancellation, and insufficient-balance rollback. Reverting requires disabling the new behavior before dropping or ignoring its column; never edit prior migrations.

## Deliberate policy conflict

Month-close does not block check-in/check-out. This can diverge closed totals from later punches, but `TimePostgreSqlIntegrationTest.closedMonthDoesNotReplaceTheLegacyCheckInAndCheckOutContractsWith423` explicitly protects that compatibility. It is not an automatic bug fix. Decide whether to reopen/recompute affected months or preserve the current contract before an R3 change.

## File-action implementation coverage

The former placeholder handlers are now connected to real XLSX file operations in these components under `frontend/src/components`:

- payroll/payroll-run-manager.tsx: download.
- payroll/pay-variable-input-manager.tsx: template, upload, download.
- payroll/pay-payment-schedule-manager.tsx: template, upload (already disabled), download.
- payroll/pay-employee-profile-manager.tsx: template, upload, download.
- payroll/pay-gl-account-manager.tsx: template, upload.
- payroll/pay-item-group-manager.tsx: template, upload.
- payroll/pay-allowance-deduction-manager.tsx: template, upload.
- payroll/pay-severance-item-rule-manager.tsx: template, upload.
- payroll/payroll-code-manager.tsx: template, upload.
- payroll/pay-gl-mapping-manager.tsx: template, upload.
- payroll/payroll-tax-rate-manager.tsx: template, upload.
- tim/holiday-manager.tsx: template, upload.
- tim/attendance-code-manager.tsx: template, upload.
- tim/work-schedule-manager.tsx: template, upload.

This is the inspected inventory, not a claim that every possible defect has been found. Baseline green tests did not exercise these broken workflows. Follow-up changes must retain the project toolbar ordering and server-side authorization.

## Implemented follow-ups and independent review

- F08/F09: permanent appointment intervals close only when the successor is confirmed, with history preserved. Employee locking prevents duplicate retirement confirmation. Cancellation of realistic legacy duplicates follows overlapping case history to restore the original active/leave status without writing another case. The final focused HR PostgreSQL class passes 19 cases, including both cancellation orders and concurrent cancellation.
- F10/F13: direct HRI submission is transactional, including failed resubmission rollback, and draft detail uses the saved JSON. Draft prohibition remains enforced. The new route is an explicit extension to the immutable 290-route reference; historical manifests are unchanged.
- F11/F12: half-day and yearly accounting use an approved deduction snapshot in V6. New response mappings display stored deductions. Legacy null snapshots preserve old accounting; an employee-wide creation lock also prevents overlapping requests whose start years differ.
- F14/F15: employee selection stores real IDs and malformed added rows fail before writes. Unsaved query/switch protection synchronously reconciles edited values before deciding to discard. An additive `clear_score` flag permits intentional score removal while omitted/null legacy patch fields preserve their prior behavior. NaN and Infinity are rejected before JSON serialization.
- F16: all templates and missing downloads create real workbooks. Each import validates the whole file before one local commit; saving remains explicit. Operation-screen downloads are explicitly current-page scoped. Existing master/TIM exports retain their original display columns; the separate template is the supported upload format.
- Independent file review found and corrected two asynchronous races: month changes during variable-input parsing, and year-copy completion during a holiday import. Deterministic delayed-read and delayed-response browser cases cover both directions.
- The shared workbook parser preserves CSV leading zeros and date-like string codes, rejects Excel error cells instead of interpreting them as nullable blanks, and validates types before returning any rows. Actual XLSX/CSV byte regressions cover these cases.
- The first production-browser run exposed accessibility-locator errors in two new tests, a dirty-edit event timing issue, and stale selection highlighting in the shared read-only grid. Failed artifacts are retained under `.omx/state/repository-audit-20261015/first-production-browser-run`. Test fixes preserve the actual workflow assertions.

## REA runtime evidence

REA launched an owned Chromium instance against the isolated login page and waited for the actual login input. Evidence `ev_157d21fbba8300dc496e49f3984dc4b7b0e6d8f5751240b40a2ecf0996ea57d8` has observed confidence, controlled-replay authority, complete requested captures, no page errors, and no failed network requests. A non-blocking Next Image parent-position warning was observed. REA did not establish artifact identity or production authentication; business mutations are covered separately by real PostgreSQL and synthetic-browser regressions.

The retained bundle is `.omx/state/repository-audit-20261015/rea-evidence-bundle.json`. The initial connection-refused attempt occurred between synthetic-server runs; the successful evidence above was captured after server readiness was verified.

## Recovery

All fixes are local source changes. Reverting only their scoped diff restores prior behavior; no production data or database history is modified. Keep the LF path declarations with frozen artifacts so Windows checkout cannot invalidate byte-level evidence again.

## Changed files

- `.gitattributes`
- `backend-spring/src/main/java/com/vibehr/appraisal/AppraisalContracts.java`
- `backend-spring/src/main/java/com/vibehr/appraisal/AppraisalService.java`
- `backend-spring/src/main/java/com/vibehr/hr/HrApplicationService.java`
- `backend-spring/src/main/java/com/vibehr/hri/HriApplicationService.java`
- `backend-spring/src/main/java/com/vibehr/hri/HriController.java`
- `backend-spring/src/main/java/com/vibehr/migration/FlywayCutoverConfiguration.java`
- `backend-spring/src/main/java/com/vibehr/migration/PostgreSqlSchemaManifest.java`
- `backend-spring/src/main/java/com/vibehr/time/TimeApplicationService.java`
- `backend-spring/src/main/java/com/vibehr/time/TimeEntities.java`
- `backend-spring/src/main/java/com/vibehr/time/TimeGridMapper.java`
- `backend-spring/src/main/resources/db/migration/V6__time_leave_annual_charge_breakdown.sql`
- `backend-spring/src/test/java/com/vibehr/appraisal/AppraisalControllerTest.java`
- `backend-spring/src/test/java/com/vibehr/appraisal/AppraisalServiceTest.java`
- `backend-spring/src/test/java/com/vibehr/hr/HrPostgreSqlSchemaIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/hri/HriControllerTest.java`
- `backend-spring/src/test/java/com/vibehr/hri/HriRouteContractTest.java`
- `backend-spring/src/test/java/com/vibehr/hri/HriWelfarePostgreSqlIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/migration/FlywayOwnershipTransferIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/migration/FreshFlywayReplayStoreSchemaIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/migration/FreshFlywayWholeApplicationHibernateValidationIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/time/TimeLeaveAccountingTest.java`
- `backend-spring/src/test/java/com/vibehr/time/TimePostgreSqlIntegrationTest.java`
- `docs/HRI_SUBMISSION_API.md`
- `docs/TASK_LEDGER.md`
- `docs/audits/2026-10-15-repository-audit.md`
- `docs/spring-migration/CUTOVER_RUNBOOK.md`
- `docs/spring-migration/spring-route-coverage.json`
- `docs/spring-migration/spring-route-coverage.md`
- `docs/spring-migration/spring-schema-coverage.json`
- `docs/spring-migration/spring-schema-coverage.md`
- `frontend/playwright.appraisal-targets.config.ts`
- `frontend/playwright.audit.config.ts`
- `frontend/playwright.retirement-selection.config.ts`
- `frontend/playwright.spreadsheet.config.ts`
- `frontend/playwright.training.config.ts`
- `frontend/src/app/api/hri/requests/submit/route.test.ts`
- `frontend/src/app/api/hri/requests/submit/route.ts`
- `frontend/src/components/grid/readonly-grid-manager.tsx`
- `frontend/src/components/hr/hr-retire-approval-manager.tsx`
- `frontend/src/components/hr/hr-severance-calc-manager.tsx`
- `frontend/src/components/hri/hri-application-hub.tsx`
- `frontend/src/components/pap/pap-appraisal-targets-manager.tsx`
- `frontend/src/components/payroll/pay-allowance-deduction-manager.tsx`
- `frontend/src/components/payroll/pay-employee-profile-manager.tsx`
- `frontend/src/components/payroll/pay-gl-account-manager.tsx`
- `frontend/src/components/payroll/pay-gl-mapping-manager.tsx`
- `frontend/src/components/payroll/pay-item-group-manager.tsx`
- `frontend/src/components/payroll/pay-payment-schedule-manager.tsx`
- `frontend/src/components/payroll/pay-severance-item-rule-manager.tsx`
- `frontend/src/components/payroll/pay-variable-input-manager.tsx`
- `frontend/src/components/payroll/payroll-code-manager.tsx`
- `frontend/src/components/payroll/payroll-run-manager.tsx`
- `frontend/src/components/payroll/payroll-tax-rate-manager.tsx`
- `frontend/src/components/tim/attendance-code-manager.tsx`
- `frontend/src/components/tim/holiday-manager.tsx`
- `frontend/src/components/tim/work-schedule-manager.tsx`
- `frontend/src/components/tra/tra-applications-approval-manager.tsx`
- `frontend/src/components/tra/tra-my-applications-manager.tsx`
- `frontend/src/lib/spreadsheet/payroll-master-schemas.test.ts`
- `frontend/src/lib/spreadsheet/payroll-master-schemas.ts`
- `frontend/src/lib/spreadsheet/payroll-operation-schemas.test.ts`
- `frontend/src/lib/spreadsheet/payroll-operation-schemas.ts`
- `frontend/src/lib/spreadsheet/time-payroll-code-schemas.test.ts`
- `frontend/src/lib/spreadsheet/time-payroll-code-schemas.ts`
- `frontend/src/lib/spreadsheet/workbook.test.ts`
- `frontend/src/lib/spreadsheet/workbook.ts`
- `frontend/src/types/pap-appraisal.ts`
- `frontend/tests/e2e/appraisal-targets.spec.ts`
- `frontend/tests/e2e/employee-experience-backend.mjs`
- `frontend/tests/e2e/hri-tasks.spec.ts`
- `frontend/tests/e2e/retirement-selection.spec.ts`
- `frontend/tests/e2e/spreadsheet-actions.spec.ts`
- `frontend/tests/e2e/training-applications.spec.ts`
- `scripts/spring-migration/spring-route-coverage.js`
- `scripts/spring-migration/spring-route-coverage.test.js`
- `scripts/spring-migration/verify-delivery.js`
- `scripts/spring-migration/verify-delivery.test.js`
- `scripts/spring-migration/verify-python-retirement.js`
- `scripts/spring-migration/verify-python-retirement.test.js`

## Final evidence

### Final guardrail mismatch discovered after workflow verification (F17, R2)

The real repository Python-retirement CLI fails on two existing hosted-UI support files, `scripts/ci/require-ui-validation.py` and `scripts/ci/test_require_ui_validation.py`, plus their documented unittest command. These files are used by the existing `ui-validation.yml`; they are not the retired application backend. The existing `guardrails.yml` runs this scanner, so this is an actual CI contradiction.

Proposed correction: allow exactly those two support file paths, and allow exactly the existing unittest command only as a whole line in `docs/UI_VALIDATION_CI.md` and `.github/workflows/ui-validation.yml`. Continue scanning their contents and all other paths; unknown Python files, changed commands and application invocations must still fail. Two new regression cases expose the mismatch and constrain the exception. No workflow execution, application runtime, deployment, or Python support script is changed. The user explicitly approved this R2 scope. It is implemented and the real repository scanner now passes, with both support scripts reported separately. Unknown files, other document paths, modified commands, and inline workflow Python commands remain rejected. Both red regressions now pass.

- Final frontend: grid registry passed; full lint passed with 0 errors and 14 existing warnings; all 296 unit tests passed; production build and TypeScript passed.
- Final backend: all 199 default tests passed, 44 focused PostgreSQL workflow cases passed, and 20 migration/replay/schema cases passed. No failures, errors, or skips in these final XML results.
- Final browser: 33 distinct cases passed. The complete production attempt passed 26, with three test expectation mismatches and four cases not yet run after its failure threshold. The subsequent focused run passed all nine selected cases (the unresolved seven plus two viewport-accurate selection captures). All 33 latest outcomes are successful, with no remaining skipped/flaky case. These are synthetic-browser tests, separate from the real PostgreSQL validation.
- Repository checks: 36 Node policy/delivery/retirement tests and 8 existing hosted-UI support-tool unit tests passed; the real repository retirement CLI also passes. delivery verification, active route coverage, active schema coverage and BFF audit passed. Frozen SHA-256 evidence is unchanged.
- Evidence: browser JSON reports are in frontend/test-results/repository-audit/results.json and frontend/test-results/repository-audit-recheck/results.json. The merged per-case index is .omx/state/repository-audit-20261015/browser-verification.json.
- Visual inspection: Korean employee selection at 390px, holiday import/validation at desktop and mobile, and the visible page-2 calculation grid were inspected. Grid captures explicitly scroll the actual grid into view, avoiding an offscreen layer in full-page screenshots.
- Source review: independent backend and spreadsheet findings were resolved and regression-tested. No new dependencies, committed changes, pushed changes, production writes or deployment were performed.
- Remaining compatibility boundary: V6 must be applied before this backend serves leave traffic. Do not mix old and new approval/cancellation implementations once snapshot-backed approvals exist. The runbook records recovery restrictions. Existing month-close/check-in compatibility was deliberately preserved as approved.
- Low-priority observations: the existing login-image parent-position console warning and 14 pre-existing lint warnings remain. They are not covered by a claim of a warning-free or globally defect-free repository.
