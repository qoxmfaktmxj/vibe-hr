# Full release readiness follow-up

Base: main `456213221d1fe83ea3b6d43bf3bef6444a7cff5f`.

## Acceptance and current findings

The user requested complete applicable testing and correction before another push. Required checks must pass without removing tests, weakening assertions or bypassing authorization. Absolute absence of all future defects is not a testable promise; this task records the concrete checks and any unresolved condition.

- Initial inventory found133 distinct Playwright cases in20 specs. New common-code unsaved-change and account-switch regressions raise the current count to135 in21 specs. Hosted UI executes83; the additional52 include real local Spring workflows, organization/management fixtures, layout checks, GPU rendering and the new regression.
- Baseline fresh frontend unit296, backend199 default +70 integration +20 migration/security, Node46, Python gate8 and adversarial dotenv shell tests pass.
- Fourteen existing lint warnings affect seven screen components. The scoped cleanup retains required grid status and existing API/permission semantics; root verification follows the final edits.
- Six active guidance files contain retired backend commands or obsolete deployment descriptions. They are aligned with Spring and the exact-SHA hosted delivery gate without changing numeric quality scores or lowering approval boundaries.
- Two older E2E helpers authenticate directly to the backend even though login now requires a signed BFF assertion. They must use the actual BFF cookie login. Default local browser setup also needs the sanitized loopback proxy header.
- `load-deploy-env.test.sh` is not found by the current JavaScript-only CI discovery. It passes locally and must remain covered without removing any existing deployment tests.

## Approved dependency security correction, R2

The current npm lockfile audit reports 49 affected package entries, including eight critical entries. Five entries are production dependencies and the rest are development dependencies; inherited parent entries are not independent vulnerabilities. A metadata-only candidate was resolved under the ignored task evidence directory, without changing the application's package files or installed dependencies.

Proposed exact boundary:

1. Update Next and its ESLint configuration together from16.2.12 to16.4.1, retaining React19 and ESLint9. [Official release](https://github.com/vercel/next.js/releases/tag/v16.4.1).
2. Keep Vitest on major4 and update to4.1.12. Keep its Vite dependency on patched7.3.7 rather than adopting Vite8 incidentally. [Vitest security advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).
3. Update the existing sharp override from0.35.3 to0.35.5. [Official advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
4. Refresh compatible transitive lockfile versions identified by the audit. Do not force unrelated major versions or accept the audit's downgrade suggestions.
5. Remove the old shadcn CLI dependency while preserving its actually imported stylesheet byte-for-byte with MIT attribution. Preserve `components.json` as descriptive component metadata. No UI style redesign is intended.
6. Remove to-ico and its obsolete image/network dependency tree. Keep the existing sharp PNG renderer and encode the three existing PNG icon frames in an ICO container without adding a package. Verify frame offsets, dimensions, image decode and generator output.
7. Run all applicable frontend unit, zero-warning lint, build, browser and asset checks after the final dependency changes. Do not publish a candidate based on package resolution alone.

The resolved candidate removes all critical entries and has zero production audit entries. It still has five high development entries, all one unpatched dependency chain:

```text
eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces
```

The official braces advisory lists no patched published version. Upgrading shadcn or accepting unsafe alias/major overrides does not resolve this correctly. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

The user approved the proposed security updates and the stated existing-lint/residual-risk approach. Preserve the existing Next lint checks and document this development-only residual advisory. Do not claim an all-dependency audit of zero, suppress the advisory, downgrade Next, or delete lint rules to manufacture a clean result.

The existing frontend runtime Dockerfile copies the complete `node_modules` directory. Packages classified as development dependencies, including that accepted lint chain, therefore remain in the image. The zero production-dependency audit result describes dependency classification; the residual chain above remains part of the release evidence.

## Approved backend dependency patches

Read-only Gradle metadata lists 118 runtime artifacts. OSV matches eight artifacts to 18 distinct advisories. Upstream impact depends on enabled features, so these are affected-version findings rather than 18 proven application exploits; primary Spring/Tomcat severity is used rather than inflated aggregator labels.

- Spring Boot4.1.0 to4.1.1, the current stable patch in the same branch. Its BOM also supplies Spring7.0.9, Log4j2.25.5 and PostgreSQL JDBC42.7.13. [Official release](https://github.com/spring-projects/spring-boot/releases/tag/v4.1.1), [BOM](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.1/spring-boot-dependencies-4.1.1.pom).
- Set the existing dependency-management properties `jackson-2-bom.version=2.21.7`, `jackson-bom.version=3.1.7` and `tomcat.version=11.0.27`, keeping each family consistent rather than individually overriding random modules. [Jackson core advisory](https://github.com/FasterXML/jackson-core/security/advisories/GHSA-7hhh-6rmp-j9qf), [Tomcat upstream advisories](https://tomcat.apache.org/security-11.html).
- Keep Java21, the current framework major versions, application contracts, authorization rules, payroll formulas and migrations. Re-run the complete backend and actual local workflows after applying patches; re-extract the whole resolved runtime graph for security verification.

One advisory requires an explicit qualification: upstream Jackson2 `GHSA-mhm7-754m-9p8w` still lists no patched release, despite OSV declaring a fixed version. Its vulnerable path requires the combined creator/view/external-property annotations. Repository source uses Jackson3 (`tools.jackson.databind.ObjectMapper`); no application use of `@JsonCreator`, `@JsonView`, `EXTERNAL_PROPERTY` or enabled default typing was found. This is evidence that the described path is not used in this application, not evidence that Jackson2 itself is fixed. [Maintainer advisory](https://github.com/FasterXML/jackson-databind/security/advisories/GHSA-mhm7-754m-9p8w).

## Isolation and release boundary

Additional live tests use a task-owned loopback PostgreSQL database and local Spring/BFF processes with temporary secrets and explicitly gated development fixtures. No production browser mutation or production seeding is permitted. Only task-owned processes and Docker resources are removed. The pre-existing unrelated untracked folders remain untouched.

No additional commit or push has been made for this follow-up. Final test counts, failures, fixes, review and hosted release evidence are recorded after verification.

## Confirmed personal time lookup failure, approved additional R3

Actual loopback Spring/BFF testing returns200 for the same valid session's employee list and annual-leave list, but401 for personal annual leave. This is a product failure exposed by the strengthened screen test, not a fixture-only selector failure.

The user explicitly approved both runtime corrections and the scoped authorization regression tests before implementation.

The runtime log reaches `TimeAuthorization.employeeIdForUser`: `getResultStream().findFirst()` attempts to consume a JDBC cursor after Spring's temporary shared EntityManager has closed. Open-in-view is disabled and the controller resolves this employee ID before entering the transactional application service. Current Spring ORM bytecode and the observed ResultSet-closed stack independently confirm this lifetime mismatch. Similar service-private stream sites remain inside transactions and are outside the proposed change.

Proposed exact production scope:

- `TimeAuthorization.java`: retain the existing user predicate, eagerly materialize at most one scalar with `setMaxResults(1).getResultList()` and then select the first result. Preserve missing-profile404 and all self/manager checks; do not add controller transactions or change identity/role meaning.
- `platform/security/SecurityConfiguration.java`: permit only internal `DispatcherType.ERROR` dispatches before existing path matchers. Keep normal REQUEST authentication, including a direct `/error` request. This allows server failures to retain their500 status rather than being masked by an unauthenticated error redispatch. Confirm the causal behavior with dispatch regressions.

Regression scope: real PostgreSQL employee lookup outside a transaction, different user/employee identifiers, missing profile404, self access, denied other-employee403, controller delegation to the resolved employee, internal ERROR500, direct `/error`401 and protected unauthenticated401. Re-run the actual personal annual-leave/schedule requests and the complete backend gate. No token policy, role policy, schema or migration change is proposed.

## Additional React analyzer findings, source correction proposal

The final Next16.4.1 lint check reports100 errors across54 files:71 state updates in effects,25 ref-boundary diagnostics, two memo dependency diagnostics and two mutation diagnostics. The old hooks7.0.1 analyzer reports zero on the same current source, while both supported7.1.0 and resolved7.1.1 report the same100. The recommended rules were already enabled; this is stronger analysis, not100 independently demonstrated runtime failures. Downgrading the analyzer below Next's supported range or turning off rules would not meet this task's acceptance criteria.

The exact file/rule/line inventory and full diagnostics are retained under the ignored task evidence directory in `eslint-upgrade-file-rule-lines.json` and `eslint-upgrade-errors.json`.

Proposed correction is limited to those reported state/effect, event/ref, memo and mutation boundaries. Keep API payloads, permissions, payroll calculations and grid conventions unchanged. Do not introduce packages, global helper layers, artificial timer deferrals or rule suppressions. Preserve hydration behavior, latest unsaved values, selection/page resets, reload behavior and cancellation behavior with focused checks and the complete browser matrix.

Protected approval boundary includes shared `src/lib/grid/use-grid-pagination.ts`, auth/menu initialization, app-shell navigation state, menu/role administration and payroll/attendance screen state synchronization. Execute five bounded frontend slices: auth/dashboard/layout/ui/pagination; HR/HRI; MNG/ORG/PAP; payroll; settings/TIM/TRA. Each slice must pass focused lint and review before integration. All54 diagnosed files are under `frontend/src`; no backend, schema or authorization policy change is included. The user explicitly approved this scoped R2 source correction with "다하고 푸시" before implementation.

## Follow-up verification checkpoint

- Fresh upgraded backend:202 default tests,71 PostgreSQL integration tests and20 migration/security tests passed with zero failures, errors or skips. The first combined invocation skipped the opt-in integration task because its environment flag was absent; the separate final invocation explicitly set `VIBEHR_RUN_CONTAINER_TESTS=true` and executed all71. Do not count the skipped invocation as evidence.
- Rebuilt real Tomcat runtime: anonymous missing public webjar returns404 with its original path, anonymous direct `/error` returns401, and anonymous protected personal-leave API returns401. This independently confirms servlet ERROR redispatch behavior beyond MockMvc. Focused red/green tests prove the original cursor failure and masked500 before the source corrections.
- Frontend grid registry and298 unit tests passed. The additional two asset tests execute the generator in a temporary directory and verify exact vendored CSS bytes, MIT attribution and every ICO PNG frame.
- All47 discovered script/orchestrator Node tests, eight existing CI gate Python tests, Compose behavioral cases and strict route/schema/mutation/Flyway/BFF/delivery inventories passed. The dotenv parser shell cases now run through the existing Node discovery.
- GPU pixel interaction1, checklist layout2, retirement layout2 and all43 employee-experience cases passed. Employee UX initially passed7/8; the bulk undo/paste case failed once and passed unchanged in a focused rerun. Its test now waits for the observable single-cell selection before pasting and passed three consecutive focused executions. The final full UX invocation remains required after the pending React source changes.
- The rebuilt actual BFF returns200 for personal annual leave, personal today's schedule and today's attendance schedule. An initial manual check used a nonexistent guessed schedule URL and returned404; the source-defined URLs above were then verified. The nonexistent URL is not a product failure.
- The actual Linux image build, non-root/no-Python/font checks, container readiness,281 application OpenAPI operations and eight public documentation method contracts passed after restoring the wrapper's tracked LF bytes locally. Its isolated Compose containers/network were removed by the existing ownership-checked teardown.
- Final production build, all remaining browser cases and zero-error lint remain open. No push has occurred.

## Two additional shared-boundary corrections proposed

The actual Docker build failed with `/bin/sh: ./gradlew: not found` after a successful COPY/chmod. Windows checkout had converted251 wrapper lines to CRLF, so Linux attempted to use a CR-suffixed interpreter path. Normalizing the working-copy wrapper back to its existing tracked LF bytes produces no Git content diff and lets the build pass that step. Proposed durable R2 correction: add only `backend-spring/gradlew text eol=lf` to `.gitattributes`; do not modify the Dockerfile or wrapper content.

The React unknown-prop warning is traced to `CalendarCaption` in `frontend/src/components/ui/calendar.tsx`: DayPicker's `MonthCaptionProps.displayIndex` is included in the spread onto a native div. The dependency's own caption filters that component-only prop before spreading DOM props. Proposed R2 correction: filter only `displayIndex` in our caption, preserve other DOM props and existing year/month navigation, and add a browser check that opens the calendar, changes month/year and rejects that warning. No new date rule, visible text or dependency change is included. The user explicitly approved both shared-file corrections with "다하고 푸시" before implementation.

## Actual finalist creation failure and harness review

The actual browser now reaches the employee creation request and correctly fails on a500 response. PostgreSQL rejects `hr_employee_basic_profiles.updated_at=NULL`. `HrApplicationService.createEmployeesFromFinalists` calls `persist` on an IDENTITY entity before assigning its required update timestamp, so the later assignment cannot repair the immediate INSERT. The correction is R1 initialization-order repair with no contract, schema, role or payroll-rule change: initialize that timestamp before persist and add a successful real-PostgreSQL finalist/profile regression. Existing collision/number-allocation coverage did not exercise this successful path.

Independent harness review found two additional test hazards. A loopback frontend URL does not prove that its BFF targets a fixture backend. The default live configuration now owns its Next server, refuses reuse, validates loopback HTTP origins and explicitly pins the backend target with the fixture's temporary secrets. The root-owned existing runtime was already pinned to its disposable database during the first run. The old HR cleanup also deleted the first partial employee-number search match. It now captures the created employee ID directly from the response and verifies its exact number, unique test name and email before deleting that ID. No partial-search deletion fallback remains. These test-only corrections require their own runtime rerun before final approval.

The finalist/profile regression reproduces the NOT NULL failure before the one-statement correction and passes afterwards. The complete final backend invocation with container tests explicitly enabled then passes202 default,72 PostgreSQL integration and20 migration/security cases, zero failures/errors/skips and no overlapping integration classes. `bootJar` also succeeds; the actual task server is restarted from that rebuilt jar. The first additional browser run passes46/47, including all23 strengthened lifecycle pages and the new common-code dirty-selection case; its only failure is the now-corrected profile creation path.

The owned-server focused rerun then passes all three cases: actual finalist creation through appointment confirmation and employee history, common-code unsaved-change navigation, and organization personal status. This run deliberately inherits an unreachable parent BFF URL; the owned server's explicit loopback target overrides it and authenticates against the task fixture. Separate negative checks reject a remote backend URL and identical temporary secrets. Captured-ID employee cleanup passes exact number/name/email verification and deletes the created employee. A leftover finalist from an earlier timed-out red run remains only in the disposable task database; no shared database is involved. The common-code screenshot renders the Korean confirmation and edited values correctly. The user subsequently approved the React/calendar/LF amendments. Their bounded implementation and final frontend gates are in progress. No commit or push has occurred.

## Approved source correction and final-gate progress

All100 React diagnostics are resolved with the official analyzer/rules retained. Pure source-derived drafts and selection use stable source/key guards; network result updates run in actual fetch completion callbacks; ref-bearing actions are built after permission checks and execute in events. No artificial timers/microtasks, lint suppressions, unsupported analyzer overrides, new packages or cross-domain helper layers were added. [React's external-store hydration contract](https://react.dev/reference/react/useSyncExternalStore) supports restoring tab/group browser storage while keeping server and first-hydration snapshots equal.

Independent review covers all54 diagnosed source files plus the calendar, test harness and expanded regression changes. It found one introduced empty-group/detail race, corrected by immediately invalidating the existing detail request generation before clearing state; the same response guards reject late results. No remaining introduced finding was identified. Payroll AST review confirms90 critical save/upload/copy/validation/download/status/formula/dirty-handler definitions remain equivalent to the base.

Global ESLint checks548 files with zero errors/warnings; all298 frontend unit tests pass. The stable final source also passes owned-file checks for the subsequent minimal payroll-selection and request-generation corrections. The final inventory is135 cases in21 specs:83 hosted-equivalent and52 additional. The new account-switch case checks changed identity/roles/profile and cleared persisted tabs after reload. Existing common-code and organization tests now also cover page input reset and calendar year/month/date query behavior; the payroll snapshot case checks same-employee refreshed snapshot data without hitting real payroll fixture IDs. Full final browser/build evidence follows below after completion.

The rebuilt final backend image passes Compose startup/readiness, non-root/no-Python/Nanum checks and281 application plus eight public-documentation method contracts. Final frontend production-dependency audit reports zero findings. The previously disclosed development braces chain and unused conditional Jackson2 advisory qualification remain recorded above; tests do not prove the complete absence of future defects.

The first final employee-experience invocation passed43/44 and caught an introduced development StrictMode regression: moving profile loading into a newly mounted dialog child started two initial requests and consumed the delayed-retry fixture before its retry button appeared. The correction restores the always-mounted dialog and guards its own open/user source state, retaining actual asynchronous completion, explicit retry and effect cleanup. The unchanged delayed-retry regression and three related profile/account cases pass4/4. A complete fresh browser sequence is then run against that correction; the prior failing invocation is retained rather than counted as green.

Recovery uses the deployment workflow's retained previous Spring/frontend image pair and existing rollback/readiness/OpenAPI checks. This follow-up adds no migration or data rewrite, and does not change production secret values. Runtime rollback therefore changes the application images under the current runbook; it does not reverse database ownership or Flyway history.

## Final local release gate, 2026-10-16

| Gate | Result |
| --- | --- |
| Backend default / PostgreSQL / migration-security | 202 / 72 / 20 passed,294 total, zero failures/errors/skips |
| Frontend unit | 298 passed in27 files |
| Global lint and grid | 548 files, zero errors/warnings; registry passed |
| Employee UX / experience | 8 / 44 passed |
| Checklist / retirement layout / GPU | 2 / 2 / 1 passed |
| Production-build business audit | 31 passed |
| Additional live/mocked workflows | 45 full-run passes plus two corrected-test passes,47 distinct cases |
| Unique browser coverage | 135 final passing cases in21 specs, none removed |
| Node / CI gate regressions | 47 / 8 passed |
| Route / schema / mutation / Flyway / BFF / delivery inventories | Strict checks passed |
| Windows production build and TypeScript | Passed |
| Linux backend/frontend images | Build and runtime contracts passed; frontend runs as node UID1000 and serves login/CSS200 |
| Production-dependency npm audit | Zero findings; accepted development-chain qualification above retained |

The interrupted live invocation has no completed report and is excluded. Lifecycle readiness now waits for visible rows or the grid's real no-rows overlay, preserving empty grids and every browser/API error assertion while removing the unconditional wait for impossible rows. In the restarted47-case run, two added assertions required fixture navigation corrections: select the search-area query button when two query buttons exist, and return from snapshot to calculation results before checking its existing warning. Those two cases then pass; the original request, warning, snapshot read-count and changed-salary assertions all remain. The final135-case map retains the older failing reports as diagnostic evidence and uses the passing reruns for those two corrected tests.

All reviewed runtime source hashes remain fixed. The publication manifest contains102 approved files; generated output, temporary credentials/runtime state, Next-generated agent instructions and original unrelated untracked folders are excluded. Hosted same-SHA UI, backend/image gates and automatic deployment are checked after the authorized main push and reported with their actual run links in the task result.
