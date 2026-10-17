# Isolated payroll payment and retirement finalization

## Authorization and scope

The user explicitly requested end-to-end payroll payment and retirement confirmation using a test employee in a separate environment, correction of reproduced defects, and publication/deployment verification. This authorizes the bounded R3 payroll/retirement application and regression changes necessary for these workflows. Production financial actions and production-data copies are outside this task.

Read the payroll safety guard, governance, architecture, security and test strategy before implementation. Candidate protected boundaries are PayrollService, payroll PostgreSQL/controller tests, HrApplicationService and HR PostgreSQL tests, plus their corresponding payroll Run, voucher, retirement and severance screens if a real UI defect is reproduced. Preserve existing multipliers, tax formulas, migrations and permission policy.

## Environment and acceptance plan

1. Start a newly named PostgreSQL container with a task label and a loopback-only random port. Run the existing Flyway cutover and explicitly gated minimal development seed. Use distinct generated local authentication/BFF secrets and an owned loopback backend/frontend. Verify database identity and BFF target before any financial mutation. Never load production database credentials or records.
2. Assign one synthetic development employee to an isolated payroll code/profile. Use October2026 and September where prior wages are required. Verify gross, deductions and net reconcile, then calculate, close, confirm the accrual voucher, mark paid, generate/confirm the disbursement voucher and inspect the employee payslip/PDF. Check invalid transitions and repeated completion for duplicate rows/events.
3. Create a retirement case for the same synthetic employee. Verify incomplete required checklist rejection, complete the checklist, confirm retirement and verify resigned status, retirement date, history/audit and the linked severance draft. Recalculate/review/confirm the severance and check final-state mutation guards. Add September and earlier synthetic wages only if the existing three-month calculation requires them.
4. Reproduce each defect in an appropriate regression before the smallest correction. Run payroll/time baseline and relevant PostgreSQL/HTTP/browser checks, then the required final gates. Preserve existing cases and assertions. Push only task-owned files and verify the exact SHA's hosted checks/deployment; inspect public production health without executing production payroll or retirement actions.

## Recovery and evidence

Stop only task-owned processes and the labelled local database after verification; preserve test records as evidence. A code correction is reversible by reverting its commit and restoring the last successful images. No production data rollback is needed because all financial finalization uses the isolated database.

Sanitized evidence is stored in the untracked task directory `output/financial-finalization-20261017/`. Temporary secrets remain in its private runtime file and must never enter tracked documentation or command output. Preserve the unrelated agent-configuration cleanup and gallery ledger work already present in this checkout.

## F01: native login submission exposes form fields in the URL

During local prerequisite login with the synthetic development account, submitting before the client handler initialized caused a native GET navigation containing the login fields as query keys. No production credentials were used. The form omits a method, so the browser defaults to GET before hydration or with JavaScript unavailable.

This prerequisite authentication correction is within the user's direction to correct encountered workflow defects and the standing instruction to proceed with recommended fixes. The bounded R3 amendment changes only the native form method to POST in `frontend/src/components/auth/login-card.tsx`; the existing hydrated JSON login endpoint, permissions, token/cookie policy and credential handling remain unchanged. Add a real no-JavaScript browser regression to the existing hosted experience suite, preserving normal login tests. The regression must observe POST navigation and no sensitive query keys, with a test-only intercepted response.

## F02: reviewed severance becomes impossible to finalize in the UI

The backend adjustment endpoint changes a draft calculation to `reviewed`, and the backend supports further review, recalculation and confirmation until `confirmed`. The screen only enables those actions for `draft`. The existing mocked workflow leaves its adjusted calculation in draft, masking this disagreement.

The new isolated HTTP and browser workflow reproduces this after paying three synthetic months and confirming retirement. The bounded R3 correction allows the existing draft and reviewed states in the screen while preserving confirmed-state immutability. Both existing mocked workflows now model the actual backend transition. No financial formula, schema or role change is required. The new opt-in financial browser configuration inherits the existing owned-loopback-server and temporary-secret guards, and rejects a database containing employees outside minimal development administrators and this test's synthetic namespace.

The real workflow reproduced the disabled confirmation button after three paid runs, six confirmed vouchers, a valid employee PDF, retirement confirmation and a linked reviewed severance calculation. After the screen correction, a second complete synthetic workflow reaches confirmed severance. Assertions cover one target per Run, gross/deduction/net reconciliation, balanced vouchers, repeated payment rejection, paid-result immutability, owner payslip identity, required checklist rejection, resigned employment status, audit history, exactly one severance draft, the three-month wage basis and confirmed-state mutation rejection. The reviewed-state transition is also represented in the existing hosted retirement-selection regression.

## Validation notes

The existing payroll/time baseline passes. The added PostgreSQL payment-finalization case and the four existing payroll integration cases pass together. Native-login red evidence observes GET; both the new POST/no-query regression and the existing normal login case pass after the one-line correction. An initial new-test accessor typo failed compilation and was corrected without changing an existing assertion; the failing log is preserved separately. No application backend production code has changed.

The isolated frontend uses the normal development mode for loopback cookie handling. The initial production-mode HTTP attempt correctly retained Secure cookies, so the API client could not authenticate over HTTP; no cookie security policy was weakened. One temporary proxy/browser session did not initialize its client scripts reliably. The committed real-browser test uses the repository's existing owned-server harness directly and completes its actual UI calculation, close, payment, retirement and severance actions against the isolated Spring backend.

## Final local gate and publication

All809 cases pass:204 default,73 PostgreSQL and20 migration/security backend tests;305 frontend unit tests;152 distinct browser cases;47 Node and8 Python gate cases. The browser inventory is1 real financial workflow,47 additional workflows,8 UX,57 experience,34 production-build audit,4 responsive layouts and1 GPU case. Every final report has zero failures/errors/skips/flaky cases. Grid validation, global lint and the final production build/TypeScript check pass. Source hashes remain fixed across verification.

The retained synthetic database contains6 paid Runs and6 paid events,12 confirmed vouchers,2 confirmed retirement cases and2 confirmed severance calculations across the red/green attempts. No voucher is unbalanced and every Run targets one employee. The first reviewed reproduction was also finalized. The owned backend and labelled database are stopped, with records preserved and no production financial action executed.

Publish only the13 owned files after these gates. Read back the exact commit's hosted UI and Deploy results and inspect the deployed application without production payroll or retirement mutations. Post-publication results are recorded in the untracked task evidence directory and final report.
