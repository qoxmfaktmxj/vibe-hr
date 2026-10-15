# GitHub Actions diagnosis, 2026-10-16

## Verified observations

- Investigated baseline commit: `d0cd9253eb5f1aa4715ba0ca9de1c52aa79b9b87`.
- Deploy run: https://github.com/qoxmfaktmxj/vibe-hr/actions/runs/38763351853
- Its `test` job stopped before Gradle at `spring-schema-coverage.js --verify-complete`: `1 per-owner extra columns found`.
- The reviewed V6 column, `tim_leave_requests.annual_charge_breakdown`, is present in the JPA model but not represented as an approved extension of the frozen legacy schema reference. The earlier local `--verify` pass did not exercise the CI completeness condition.
- The preceding four scheduled Deploy runs succeeded. Historical 2026-09-22 image-promotion failure was a quoted Go-template error; the 2026-10-08 source fix predates the succeeding runs.
- Standalone UI run https://github.com/qoxmfaktmxj/vibe-hr/actions/runs/38763351844 and the Deploy reusable UI job execute the same SHA concurrently.

## Test inventory

- Employee UX: 8 distinct cases.
- Employee experience: 43 distinct cases, covering login/session/accessibility/fallback and rendering behavior.
- Repository audit: 33 cases, of which 2 are the same UI smoke cases already in employee experience. The other 31 protect the newly repaired workflows.
- No existing test case has been demonstrated obsolete. Source tests should be retained.
- Deploy repeats four Node test scripts after its all-script discovery already executes them.
- Deploy repeats frontend grid/lint/unit/build after the required UI job does the same work.
- Gradle `integrationTest` and `migrationIntegrationTest` both execute the same four migration/replay classes, totaling 20 duplicated test methods.
- The shell integration block currently runs two Gradle commands under `set +e`; a failing first command can be masked by a succeeding second command. This must remain fail-closed after simplification.

## Approved implementation scope

The user explicitly approved all changes below, publication to main and hosted
Actions verification. The baseline standalone UI workflow has since completed
successfully; its existing cases do not require removal.

1. Extend the static completeness checker for the exact V6 table/entity/column contract, physical JSONB mapping and nullable metadata. Preserve frozen manifests and fail on unrelated columns, missing reviewed extension, or drifted types.
2. Keep standalone UI validation on main pushes. Replace the duplicated reusable UI execution in Deploy with the existing read-only exact-SHA gate. Keep `deploy.needs: [test, ui]`, latest-failure rejection, actual successful job checks and clean checkout rechecks. Document that a scheduled same-SHA release reuses its latest successful standalone UI evidence. Give this gate only contents/actions read permissions and allow its exact support command in the Python-retirement checker.
3. Remove only proven duplicate execution: the four explicit Node test reruns and Deploy's redundant frontend validation block. Keep delivery-image builds, backend tests, schema/migration checks and compose smoke.
4. Run migration/replay classes only in the dedicated migration task, with the remaining integration classes in the generic task. Invoke both tasks in one Gradle command so any failure propagates to the shell status.
5. Add the existing 31 new workflow cases to standalone UI validation after its production build. Keep the existing 8 UX and 43 experience cases; omit only the two smoke cases already run in the 43-case suite. No test source files are deleted.

## Verification plan

- Reproduce the actual completeness failure locally, then test exact reviewed extension acceptance and unrelated/schema-type drift rejection.
- Run the same inventory commands used by Actions, including completeness mode and immutable artifact verification.
- Exercise the actual integration shell block with a controlled failing Gradle fixture so a failed generic integration task cannot be masked.
- Verify Gradle test partition has no class overlap and no missing migration/security coverage; run applicable tests.
- Retain exact-SHA gate positive/negative regression coverage, plus workflow structure checks and hosted UI evidence.
- Publish only approved files, read back remote SHA, and inspect the resulting GitHub Actions run. Production promotion remains dependent on all gates.

## Scope boundaries

The initial scope changes CI/checker orchestration. The separately approved hosted follow-up below also corrects the two attendance planned-time mappings. Authentication, payroll formulas, stored data and existing migrations are unchanged. Existing source tests and security/data gates remain. No production-host browser fallback is introduced.

## Local verification results

- All 43 discovered Node tests pass. They include exact schema-extension rejection cases, hosted workflow contract checks, and execution of the actual integration shell block with generic-task failure 17, migration-task failure 23, and success 0. The pre-fix shell fixture reproduced a masked failure before the single-invocation correction.
- All eight existing Python exact-SHA gate tests pass. The retirement scanner reports zero application Python files/invocations and preserves its two exact reviewed support-file exceptions.
- The same route, schema, mutation, Flyway, BFF and delivery verification commands used by Actions pass, including `spring-schema-coverage.js --verify-complete`. Frozen references and original migration files are unchanged.
- Full local Gradle `test integrationTest migrationIntegrationTest` passes with container tests enabled: 199 default, 68 generic integration and 20 migration/security cases. XML reports show zero failures, errors or skips and no class overlap between integration tasks.
- The existing compose-smoke behavior regression passes. Workflow YAML parses successfully. The exact additional Playwright command discovers 31 business cases, leaving the existing 8 UX and 43 experience cases intact for 82 unique hosted browser cases.
- Final source review found no blocking issue in the workflow ownership, gate permissions, test partition or remaining delivery-image smoke prerequisites. No dependency was added and no test source was removed.
- Git diff whitespace validation passes. Hosted validation and deployment remain pending until the approved main publication; their results must be read from the new commit's Actions runs.

## Changed files and simplifications

- Workflows: `.github/workflows/deploy.yml` and `.github/workflows/ui-validation.yml` assign frontend validation to one standalone run and retain exact-SHA deployment gating.
- Backend test orchestration: `backend-spring/build.gradle.kts` and `scripts/ci/deploy-integration.test.js` remove duplicate task ownership and protect shell failure propagation.
- Static guardrails: the schema coverage, delivery verification and Python retirement scripts and their tests validate the narrowly approved contracts. Generated schema coverage JSON/Markdown records the reviewed V6 addition separately from frozen legacy evidence.
- Operating evidence: `docs/UI_VALIDATION_CI.md`, `docs/TEST_STRATEGY.md`, this report and `docs/TASK_LEDGER.md` describe ownership, verification and recovery.
- Recovery: revert this CI orchestration change only while retaining an effective same-SHA UI release gate. No application data or migration rollback is part of this change.

## Hosted follow-up: time-zone-dependent planned-time contract

- Published CI fix: `b5c6ead13e33a3f6476903f0ebea878e93cf3563`. Hosted strict inventories and Spring unit build passed. The generic integration task now correctly stops release on a real failure instead of masking it with a later task result.
- Deploy run 38767328971 failed one of 68 integration cases at `TimePostgreSqlIntegrationTest.java:165`. A local targeted run with `JAVA_TOOL_OPTIONS=-Duser.timezone=UTC` reproduces the exact failure: expected `2026-08-02T00:00`, actual `2026-08-01T15:00`.
- The existing test inserts the historical UTC-naive planned timestamp and expects a KST-local Java value. `TimEmployeeDailySchedule` currently uses plain `LocalDateTime` while that context sets Hibernate JDBC time zone to UTC. The implicit JDBC conversion depends on the JVM default zone; the previous local KST run therefore passed accidentally.
- Runtime investigation boundary: planned start/end mapping and the service's generation, display and late-classification paths. A correction must preserve the expected UTC persisted instant and KST business clock explicitly, verify database read/write and both JVM zones, and avoid a global time-zone override or weakened assertion. Existing stored-data format compatibility must be established before changing interpretation; no heuristic or data rewrite is authorized.
- This crosses from approved CI orchestration into attendance semantics with payroll consequences. The user explicitly approved the additional planned-time mapping and related business regressions before runtime edits. Existing failed test and local UTC XML are retained as red evidence; no test is deleted.
- A separate diagnostic defect is also visible: the failure annotator expects `classname` before `name`, while Gradle emits `name` before `classname`, so it incorrectly reports no JUnit failure report. Correcting that existing CI diagnostic parser is within the authorized failure-reporting boundary and must be regression-tested against real Gradle XML.

### Stored-data verification before publication

- Temporary branch `codex/time-storage-inventory` contains a manual-only inspection job in place of deployment jobs. Independent review confirmed it has no deployment, build, checkout, data-write or credential-output path. Existing pinned SSH host-key validation is retained. No temporary diagnostic workflow is merged into main.
- Read-only run [38769967506](https://github.com/qoxmfaktmxj/vibe-hr/actions/runs/38769967506) used `default_transaction_read_only=on` and `BEGIN READ ONLY`; output confirms read-only mode and finishes with `ROLLBACK`. The first attempt stopped before a query because host psql was absent; the successful attempt reused an existing PostgreSQL 16 client image without pulling an image or mounting volumes.
- Production release at inspection: `be668454566d46be01456698797b8ec51c43181a`. Container OS zone is UTC and PostgreSQL zone is Etc/UTC. No JVM default-zone claim is inferred from an absent Java property.
- The complete aggregate covers 186,310 schedule rows, all identified by the legacy generator tag. Of these, 54,090 have no planned times. Every non-null plan matches its KST pattern converted to UTC; KST-naive and unclassified counts are both zero. There are no Spring-generated rows in this snapshot. Individual employees, row values, environment contents and credentials are not output.
- This establishes the existing UTC storage contract and resolves the demonstrated mixed-format rollout risk for the inspected data. No row conversion or schema migration is needed. If future recovery encounters mixed-format rows, stop and classify them rather than applying a guessed offset.

### Final implementation and verification

- `KstScheduleTimeConverter` explicitly converts the two Java KST-local values to UTC-naive database values and back. The two fields use direct `LOCAL_DATE_TIME` JDBC binding with the existing physical timestamp type, avoiding implicit JVM-zone conversion. Other fields and business formulas are unchanged. The direct binding contract is documented in [Hibernate SqlTypes](https://docs.hibernate.org/orm/7.1/javadocs/org/hibernate/type/SqlTypes.html#LOCAL_DATE_TIME).
- The original legacy-read/UTC-instant/KST-late regression remains. A new two-zone database regression exercises real schedule generation, exact start/end storage, reloaded 09:00/18:00 display and late classification. Before the fix, its UTC variant stored 09:00 instead of canonical 00:00; afterwards both UTC and Asia/Seoul variants pass.
- Full local UTC Gradle verification passes 199 default tests, 70 generic integration cases and 20 migration/security cases with zero failures, errors or skips. A separate Asia/Seoul JVM run passes all 14 time integration cases. No class overlap is introduced between the integration tasks.
- All 46 discovered Node tests pass, including three new diagnostic regressions that execute both real workflow snippets against reordered Gradle XML and verify failure names, passing-case exclusion, missing-report handling and credential masking. Strict schema completeness remains 105/105; frozen evidence and prior migrations are unchanged.
- Hosted standalone UI run [38767328884](https://github.com/qoxmfaktmxj/vibe-hr/actions/runs/38767328884) passed grid/lint, 296 unit cases, all 82 distinct browser cases and production build/TypeScript. Its paired Deploy run correctly rejected the time integration failure and skipped promotion. The final amended commit must obtain its own successful same-SHA UI and Deploy results.
- Recovery: source revert must consider the same UTC storage contract. No production data was modified during diagnosis, so there is no data rollback for this fix. Hosted release health and image SHA checks remain required after publication.
