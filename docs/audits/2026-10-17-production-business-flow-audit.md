# Deployed business-flow audit, 2026-10-16 to 2026-10-17

## Scope and evidence

The user requested direct verification of the deployed site and authorized one dedicated test employee, October2026 and September when prior-month data is necessary. The initial deployed SHA is `2053fea846b2065d14daaa951534067863db5231`; its UI run38891520014 and deployment run38891519952 succeeded before this audit.

The actual browser menu exposes85 routes across10 domains. All85 were visited, with actual queries where enabled. A route visit is not proof of every business write. Some queries require an employee, evaluation or other parent selection; empty and still-loading observations are retained separately. No production fixture seeding, bulk employee mutation, payroll calculation, monthly closing, payment or retirement confirmation was performed.

The20 initially loading routes were revisited in Chrome through completed reads, with no visible loading state or page/query error in the final observations. AG Grid's1px accessibility loading text was excluded from the visible-loading signal. The menu evidence contains86 entries and85 distinct paths because the appraisal route appears in two menu positions.

The initial in-app browser used its normal narrow viewport. After its native confirmation dialog stalled browser control, the audit continued in a dedicated Chrome tab at its normal desktop viewport. No viewport override was applied. A detached Chrome debugger was recovered with a fresh tab; unresponsive automation clicks were not classified as application grid defects. Sanitized control/row counts and screenshots without employee identifiers are stored under ignored `.omx/state/production-audit-20261016/`. Employee identity, original profile values, financial values, credentials and tokens are excluded from tracked evidence.

## Confirmed findings

| ID | Reproduction and cause | Bounded correction |
| --- | --- | --- |
| P01 | A real menu click to `/tim/month-closing` removes the header, menu and open-work tabs. Both monthly-close pages return their manager without AppShell. | R1: wrap the two pages in the existing AppShell; preserve guards, manager and metadata. |
| P02 | A known employee found in employee management cannot be found in HR basic search. The header searches only the initial100 employees. A partial deep link can also choose a different employee before the exact match. | R1: bounded name/number searches using existing filters, deduplicate results, preserve selected identity and require exact deep-link matching. |
| P03 | Personal training submission rejects the UI's missing primitive `year_plan_yn` with422; rendering structured error details causes React31 and a page-load failure. Reload confirms no extra application was created. | R1: send explicit false and convert create/withdraw errors to strings through the existing parser. No backend production contract change. |
| P04 | Leave approval's default label says pending-only, but cancelled and pending test requests both appear. Its `pending_only` request name is not the server's `pendingOnly` parameter. Explicit `status=pending` works. | R1: default to existing `status=pending`, label empty filter as all statuses and preserve approval rules. |
| P05 | In administrator account switching, select candidate A, search for B and wait for the new result. The new list has one candidate, zero pressed candidates and no A, but the switch button remains enabled. The hidden previous selected ID is retained. No wrong-account login was executed. | User-approved R3 account-selection amendment below. |
| P06 | After Korean midnight, the dashboard shows October17 while leave and attendance defaults still show October16. Their ISO date conversion uses UTC. | R1: derive the two screens' business date and attendance export date with an explicit Asia/Seoul formatter; cover midnight, month and year boundaries without changing stored data or global timezone. |
| P07 | The in-app browser cannot complete native leave-cancel and HRI-withdraw confirmation prompts. | R1 compatibility: reuse the existing application ConfirmDialog in those two actions, preserving eligibility, endpoints and explicit confirmation. Cancel, close and duplicate-click regressions protect the same actions. |

P01 through P04 have focused red reproductions and bounded source corrections. P05 is a confirmed selection-intent defect in an authentication workflow. The user explicitly approved its selection validation and regressions before implementation, then directed autonomous execution of recommended remaining actions through completion.

## Approved account-switch selection amendment, R3

Affected production file: `frontend/src/components/layout/impersonation-popover.tsx`. Existing endpoints, allowed roles, tokens, cookies, session lifetime and permissions remain unchanged.

The proposed patch clears selection immediately when the query changes, accepts only the latest query's result, and requires a candidate selected from the current visible results before enabling or submitting a switch. A stale response must not restore an old candidate or selection. Closing the panel cancels its pending lookup. Submission uses the currently validated candidate rather than an unchecked retained ID.

Regression acceptance: select A then search B; before selecting B there is no login request and switching is disabled. Selecting B sends B's ID. An older A lookup completing last cannot overwrite B. Empty results, query clearing and close/reopen cannot submit a hidden selection. Existing successful administrator switching still refreshes the session and menus.

Governance basis: `docs/GOVERNANCE.md` classifies authentication and authorization as R3 and requires explicit scoped approval and thorough verification. This is an additional account-selection correction, separate from the previously approved employee lookup and ERROR-dispatch changes.

Independent R1 review found one further exact-lookup limit:100 older substring matches can precede the exact employee number. The frontend must continue through bounded pages until finding the exact number or exhausting the reported count. A page-two exact-match regression is required before publication.

## Actual workflow checkpoints

- The dedicated test employee's detail drawer matches the selected employee. All eight HR history tabs retain the same target. One existing non-payroll profile field was saved, verified after reload, restored and verified again. No employee/history record was created or deleted.
- A half-day request correctly records0.5 days. A native calendar selection commits2026-10-20 and that date appears in the owner's list and manager queue. An earlier date mismatch came from the browser automation's date-fill event, not a confirmed product defect.
- QA-001 is cancelled. QA-002 was rejected through the actual administrator queue after browser control recovered. Both final statuses were read back; no audit leave remains pending. Approval was not committed; the current UI has no normal cancellation action for already approved leave.
- Training's failed submission created no additional application. The retry and withdrawal cycle remain required after P03 is deployed.
- HRI certificate form configuration permits withdrawal and has an active multi-step approval template. Its initial creation dialog was cancelled before submission. Any later audit document must be withdrawn or otherwise explicitly recorded before completion.
- October has one draft payroll Run with no calculated employee results; September has no Run. Existing creation/calculation applies to all eligible employees. No all-employee calculation, closure or payment was used to manufacture test data.

## Publication verification

Local review and validation are complete. Publication must still be followed by readback of the exact pushed SHA's hosted UI and deployment results, actual-site rechecks, the failed training cycle and final QA request statuses. Post-publication outcomes are stored in the ignored task evidence directory and the final task report. Preserve audit history and report the unexecuted payroll/final-approval boundaries explicitly.

## Local verification checkpoints

- Full UTC backend:204 default,72 PostgreSQL and20 migration/security tests,296 total, no failures/errors/skips. The two added MVC cases cover the required training boolean and normal explicit-false submission.
- Script and gate checks:47 Node cases and8 Python cases pass, along with strict route/schema/mutation/Flyway/seed/BFF/delivery inventories and Compose smoke behavior.
- Independent review: the original14-file repairs and subsequent date helper/callers have no outstanding correctness findings. Review required and verified exact employee lookup after100 partial matches.
- Final frozen-source matrix passes sequentially:47 isolated backend workflows,4 responsive layout cases,1 rendered GPU case,56 employee-experience cases,305 fast unit cases, one production build/TypeScript check, then34 production-server audit cases. The8 employee UX cases also pass and their source is unchanged. This is150 distinct browser cases and806 total test cases, all with zero final failures/errors/skips/flaky cases. The overnight-interrupted experience attempt is retained separately; the complete56-case rerun passes. Some earlier aggregate reports are unavailable after the interruption; their previously observed completed counts and retained passed `.last-run.json` artifacts are identified in `local-final-summary.json`.
- KST red/green evidence: the former UTC formula fails4 boundary cases and the browser shows16 instead of17 after Korean midnight. All7 helper tests and the UTC-browser date, pending-cancel and approval-action cases pass after the correction. User-edited dates remain unchanged.
