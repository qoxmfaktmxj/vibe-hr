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

This task changes CI/checker orchestration, not application authentication, payroll calculations, stored data, or existing migrations. Existing source tests and security/data gates remain. No production-host browser fallback is introduced.

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
