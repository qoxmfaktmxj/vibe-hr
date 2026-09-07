## TASK VH-R3-SPRING-PRODUCTION-CUTOVER-20260803
- Date: 2026-08-03
- Status: completed; Spring Boot is serving production traffic
- Mode: High-risk controlled production cutover
- Risk Class: R3 (database ownership transfer, authentication secrets, deployment and traffic switch)
- Approval Status: user explicitly approved immediate Spring Boot production cutover
- Owner: Codex implementation lane

### Scope
- Fast-forward the reviewed reconciliation/V3 correction onto the current design `main` revision.
- Stop Python writes, take a final backup, restore to a separate Spring production database, and run guarded reconciliation plus Flyway V1-V5.
- Verify an isolated Spring candidate before replacing the Python backend and switching the Next.js BFF to Spring.
- Retain the original Python images, operator configuration, original database, and final backup as rollback assets.

### Stop Conditions
- Any permanent successful V3 history, fingerprint/history/checksum mismatch, protected data checksum change, unsafe sequence, destructive reconciliation requirement, candidate validation failure, or production smoke failure stops promotion or triggers routing/container rollback.

### Cutover Hotfix
- Production smoke exposed Hibernate 7 closing a native `getResultStream()` used by the non-transactional employee permission check before `findFirst()` advanced it. The authorization lookup was changed to a bounded result-list read, with its unit tests updated, before backend re-promotion.
- The attendance status UI sends the frozen FastAPI-compatible `start_date`, `end_date`, and optional `employee_id` query names. Explicit Spring `@RequestParam` bindings and a reflection contract test were added after smoke exposed implicit camelCase binding.

### Production Evidence
- Final pre-cutover backup: `/var/backups/vibe-hr/20260803-final-pre-spring-cutover.dump`; the original `platform_db.vibehr` schema remains at Alembic head `org_mapping_foundation_20260722` with no Flyway history.
- The restored and reconciled Spring database is `vibehr_spring_prod_20260803`. Flyway history is exactly V1-V5 with V2 `-1027260723`, corrected V3 `720383589`, V4 `1252995053`, and V5 `-890170560`; all rows are successful.
- Hibernate validation, readiness, OpenAPI 3.1.0 with 216 paths, and the 106-application-table migration gate passed. The 102 owned sequences were verified above their current maximum IDs before promotion.
- Protected production counts remained `4 / 50 / 30074 / 6003 / 3005` for approval actor rules, departments, attendance daily, leave requests, and welfare requests. The 100 scheduling assignments remained active and retained the reviewed pre/post checksum through V5.
- External `https://hr.minseok91.cloud` smoke passed login, current principal, menu tree/admin role authorization, employee grid, attendance query, payroll run query, and payroll PDF download. Employee access to an admin route returned the expected denial during cutover verification.
- The active containers are `vibehr-backend-spring` on loopback port 8080 and `vibehr-frontend` on loopback port 3000. The retired Python port 8000 is closed.
- Nginx now removes/reinjects the trusted BFF client address as `X-VibeHR-Client-IP $remote_addr`; configuration validation and reload succeeded.
- Source revisions promoted to `main`: `21f1aec`, `d1305f7`, `ee2394c`, `7f74be3`, and `20003f4`.

### Rollback Assets / Observation Window
- Retain `/var/backups/vibe-hr/20260803-spring-cutover`, the final database dump, the untouched legacy database, `vibe-hr-backend:pre-spring-20260803`, `vibe-hr-frontend:pre-spring-20260803`, and the retained Spring rollback image until the observation window is closed explicitly.
- Rollback changes routing/containers only and restores the retained Spring release. Database ownership is not reversed and no reverse DDL is permitted. The legacy Python image/database are disaster-recovery evidence, not an automatic application rollback target.

### Verification Commands
- `./gradlew --no-daemon --console=plain test`: PASS after both production hotfixes.
- `VIBEHR_RUN_CONTAINER_TESTS=true ./gradlew --no-daemon --console=plain migrationIntegrationTest`: PASS after the final promoted revision.
- `node scripts/spring-migration/flyway-verify.js`: PASS; exact Alembic head, 66 bootstrap ownership records, and 1,377 required reference rows verified.
- `node scripts/spring-migration/verify-delivery.js`: PASS.

### Remaining Risk
- The production frontend build reports 30 dependency audit findings (3 low, 7 moderate, 14 high, 6 critical). These were pre-existing dependency findings and require a separate dependency remediation cycle rather than an unreviewed cutover-time upgrade.

## TASK VH-R3-PRODUCTION-DRIFT-RECONCILIATION-20260803
- Date: 2026-08-03
- Status: clone end-to-end verification completed; later superseded by the separately approved production cutover above
- Mode: Restored-backup verification
- Risk Class: R3 (schema ownership transfer and production-data compatibility)
- Approval Status: approved explicitly by the user for clone/source work only; production execution not approved
- Owner: Codex implementation lane

### Scope
- Mechanically compare the restored production schema with the frozen V1 catalog manifest and determine whether production or V1 is canonical.
- Add an exact-fingerprint, exact-head, advisory-locked, transactional reconciliation command without changing V1/V2 or the frozen schema manifest.
- Preserve source tables in an archive schema, prove protected row/checksum equality, and exercise reconciliation through Flyway V1-V5 on PostgreSQL 16.
- Confirm no known permanent database has successful V3 history, then correct V3's pre-first-application source-ID mapping without changing valid assignments.

### Evidence
- Restored clone source fingerprint `e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1`; fresh same-version V1 and reconciled clone both matched `fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e`.
- Five protected tables retained identical row counts/checksums; all five canonical sequences produced a next value above max ID.
- Read-only permanent-database audit found no successful V3 row: production has no Flyway table and the retained evidence database has V1/V2 only.
- A new restore `vibehr_reconcile_v3fix_20260803` passed reconciliation, exact V1/V2 adoption (`V2=-1027260723`), corrected V3 (`720383589`), V4/V5, 106-table validation, Hibernate validation, readiness, OpenAPI, and signed authentication/permission smoke.
- The actual scheduling shape (50 departments, 100 active assignments) retained exact checksum `a18af37c745f60c0e7904915e990a065` across V3-V5; 1,377 canonical source rows remained intact.
- `migrationIntegrationTest`, full unit tests, `flyway-verify`, and route coverage `290/290` passed. All 102 owned sequences have calculated next values above max IDs.

### Remaining Risk / Stop Condition
- Any newly discovered successful V3 in a permanent database invalidates this checksum-change path and requires a stop/guarded-bridge review. This clone-only task itself made no production DB, container, Compose, Nginx, secret, push, or PR change; those later changes are recorded under the separately approved cutover task above.
- See `docs/spring-migration/PRODUCTION_DRIFT_RECONCILIATION_20260803.md`.

## TASK VH-R3-DELIVERY-HARDENING-20260803
- Date: 2026-08-03
- Status: completed
- Mode: Delivery hardening
- Risk Class: R3 (deployment container runtime and generated smoke credentials)
- Approval Status: approved explicitly by the user
- Owner: Terra implementation lane

### Scope
- Run the frontend deployment container as the existing unprivileged `node` user with copied runtime artifacts owned by that user.
- Generate distinct ephemeral 256-bit smoke secrets in process memory for each Compose invocation; never store or log them.
- Correct public application metadata to identify the Next.js, Spring Boot, and JPA runtime.

### Changed Files
- `frontend/Dockerfile`
- `docker-compose.spring-smoke.yml`
- `scripts/spring-migration/smoke-spring-compose.ps1`
- `scripts/spring-migration/smoke-spring-compose.behavior.test.ps1`
- `scripts/spring-migration/verify-delivery.js`
- `frontend/src/app/layout.tsx`
- `docs/TASK_LEDGER.md`

### Commands Run / Verification Summary
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\spring-migration\\smoke-spring-compose.behavior.test.ps1`: PASS. Generated secret format, secret separation, preexisting environment restoration, ownership refusal, and native cleanup failure propagation passed.
- `node scripts\\spring-migration\\verify-delivery.js`: PASS. The verifier now enforces frontend non-root ownership, generated smoke-secret injection, and current public metadata contracts.
- `docker compose -f docker-compose.spring-smoke.yml config --quiet` with ephemeral process-only secrets: PASS.
- `docker build --file frontend\\Dockerfile --tag vibehr-frontend:delivery-hardening .`: PASS. The image default user is `node` (UID `1000`), and Next runtime/public assets are readable.
- `frontend: npm run lint`: PASS with 0 errors and 15 existing warnings.
- `frontend: npm run build`: PASS. Grid validation and Next.js production build completed for 190 routes.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\spring-migration\\smoke-spring-compose.ps1`: PASS. Fresh Flyway startup, backend image verification, 281 application OpenAPI operations, 8 documentation contracts, and owned-resource teardown passed.

### Remaining Risks
- The public reverse proxy still must remove and reinject the canonical trusted client-IP header before reaching the Next.js BFF.

## TASK VH-R3-SECURITY-DELIVERY-REMEDIATION-20260802
- Date: 2026-08-02
- Status: completed
- Risk Class: R3 (authentication, payroll authorization, Flyway, deployment, and secrets)
- Approval Status: approved explicitly by the user
- Owner: Terra implementation lane

### Scope
- Require valid non-placeholder BFF secrets and canonical social callback origin; bind assertions to the exact signed JSON body.
- Replace process-local nonce state with PostgreSQL/Flyway atomic replay consumption and scoped TTL capacity.
- Harden deployment secret/TCP checks and guarded smoke Compose teardown; retain login rate-limit, HR permission, payroll IDOR, and BFF replay controls.

### Changed Files
- Frontend BFF assertion, login/social routes, and route/unit tests.
- Spring BFF security/replay implementation, V4 migration, security/migration tests, and HR/payroll regressions.
- Deploy/smoke scripts, Compose secret, secret example, delivery static tests, and this runbook.

### Evidence
- `npm run test -- src/app/api/_lib/bff-assertion.test.ts src/app/api/auth/login/route.test.ts src/app/api/auth/social/callback/[provider]/route.test.ts`: PASS (6 tests).
- Focused Gradle security, HR authorization, and payroll controller tests: PASS.
- `VIBEHR_RUN_CONTAINER_TESTS=true .\\gradlew.bat --no-daemon --console=plain integrationTest --tests com.vibehr.platform.security.BffAssertionReplayStorePostgreSqlIntegrationTest`: PASS.
- `.\\gradlew.bat --no-daemon --console=plain migrationIntegrationTest --tests com.vibehr.migration.FlywayOwnershipTransferIntegrationTest`: PASS.
- `node --test scripts/spring-migration/smoke-spring-compose.test.js scripts/spring-migration/deploy-security.test.js`, `node scripts/spring-migration/verify-delivery.js`, and `./scripts/spring-migration/smoke-spring-compose.ps1`: PASS.

### Remaining Risks
- PostgreSQL availability is now part of the login/social assertion path; the existing database health and deployment readiness gates remain required.

## TASK VH-R3-SPRING-ONLY-FLYWAY-CUTOVER-GATE-20260801
- Date: 2026-08-01
- Status: completed
- Mode: Execution / verification
- Risk Class: R3 (Flyway cutover configuration and deployment runtime)
- Approval Status: approved (user explicitly approved the full Java cutover and this bounded Spring-only correction)
- Owner: Terra implementation lane

### Scope
- Remove the retired legacy-writer startup gate from the Spring cutover profile, adoption runner, integration inputs, Compose-facing configuration, and active migration instructions.
- Keep Flyway disabled outside `flyway-cutover`; require explicit `vibehr.migration.owner=flyway` before the migration strategy can obtain a database connection or call Flyway.
- Preserve exact adoption confirmation and the existing V1/V2 history and catalog-tamper checks.

### Changed Files
- `backend-spring/src/main/java/com/vibehr/migration/FlywayCutoverConfiguration.java`
- `backend-spring/src/main/java/com/vibehr/migration/FlywayAdoptionRunner.java`
- `backend-spring/src/main/resources/application-flyway-cutover.yml`
- `backend-spring/src/test/java/com/vibehr/migration/FlywayCutoverConfigurationTest.java`
- `backend-spring/src/test/java/com/vibehr/migration/FreshFlywayWholeApplicationHibernateValidationIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/commoncode/IntegerPersistenceBindingIntegrationTest.java`
- `backend-spring/src/test/java/com/vibehr/platform/openapi/OpenApiDocsContractTest.java`
- `backend-spring/README.md`
- `backend-spring/docs/database-and-seed-migration.md`
- `docs/spring-migration/CUTOVER_RUNBOOK.md`
- `docs/spring-migration/flyway-adoption-and-seed.md`
- `docs/TASK_LEDGER.md`

### Evidence
- `backend-spring: .\\gradlew.bat --no-daemon --console=plain test --tests com.vibehr.migration.FlywayCutoverConfigurationTest --rerun-tasks`: PASS. Missing or wrong owner is rejected before connection/Flyway interaction; a legacy property cannot bypass the owner fence; the active cutover profile declares no legacy property.
- `backend-spring: .\\gradlew.bat --no-daemon --console=plain clean compileJava compileTestJava test --rerun-tasks`: PASS.
- `backend-spring: .\\gradlew.bat --no-daemon --console=plain migrationIntegrationTest --rerun-tasks`: PASS. PostgreSQL 16 adoption integrity, exact V1/V2 history rejection, schema-manifest validation, and fresh full-context `flyway-cutover` startup pass without a legacy writer property.
- `docker compose -f docker-compose.spring-smoke.yml config --quiet`: PASS.
- `docker compose -f docker-compose.deploy.yml --env-file .env.deploy config --quiet`: PASS with a temporary non-secret local validation file removed immediately after the command.
- `scripts/spring-migration/smoke-spring-compose.ps1 -ProjectName vibehr-spring-cutover-fix`: PASS. Flyway cutover reached readiness; image verification confirmed non-root, no Python runtime, and Nanum font support; live OpenAPI verified 281 application operations and 8 public documentation method contracts.
- Active configuration and docs search: PASS; no production/config/Compose/documentation reference to the retired legacy-writer key remains. Tests retain negative assertions only.
- `node scripts/spring-migration/verify-python-retirement.js` in an artifact-free mirror of the current source: PASS, 0 `.py` files and 0 active Python invocations across 1,082 active files.

### Remaining Risks
- V1/V2/V3 remain intentionally non-reversible; recovery continues to require the verified backup-and-stop procedure.
- The direct workspace retirement verifier currently sees the isolated `backend-spring/.gradle-cutover-fix` cache created by this verification lane. It is not source or runtime content, but it must be removed before that direct workspace command is green. The execution policy prevented its deletion during this task; the artifact-free mirror passed.
- An additional local Terra CLI review could not run because the installed CLI is too old for `gpt-5.6-terra`; runtime, integration, and static verification above completed successfully.

## TASK VH-R2-EMPLOYEE-EXPERIENCE-20260906
- Date: 2026-09-06
- Status: implementation verified and reviewed
- Type: frontend design and usability improvement
- Risk Class: R2 common UI, with authentication-facing feedback and session display safeguards
- Approval Status: user explicitly approved all critique recommendations, further score improvements, and push
- Branch: codex/employee-experience-design

### Scope
- Login brand composition, Korean labels, social consent/account-creation guidance, password visibility, and status-based error recovery.
- Header hierarchy, account/settings/help controls, touch and keyboard tab management, labeled navigation and responsive dialogs.
- Person-first profile, grouped facts, employment status, controlled scrolling, focus restoration, loading/error/empty states and request cancellation.
- Session retry and stale-read protection after successful renewal. Spring authentication, authorization, schema, payroll and deployment configuration remain unchanged.

### Evidence
- Baseline relevant unit suite: 22 tests passed before implementation.
- Final validate:grid: PASS for all registered screens.
- Final npm run lint: PASS, 0 errors and 15 existing warnings in unchanged business modules.
- Final npm run test: PASS, 19 files and 146 tests.
- Final npx tsc --noEmit: PASS.
- Dedicated Playwright experience suite: PASS, 30 tests, 0 failed/skipped/flaky. Includes existing business grids and tab navigation, mobile/short-height scrolling, focus, reduced motion, request failure and retry boundaries.
- Final npm run build: PASS, including TypeScript and 190 generated routes.
- Independent code review: APPROVE after regression fixes.
- Independent Nielsen review: 37/40; visual review: 94/100. Initial provisional score 22, intermediate 32. Details in frontend/docs/EMPLOYEE_EXPERIENCE_REVIEW.md.

### Changes And Simplification
- Frontend auth/login, app-shell/account/theme/session, sidebar/profile and their scoped styles; existing Dialog motion-reduction override.
- Replaced repeated profile tone cards and orphaned login CSS with focused components and grouped definition lists.
- Replaced brittle legacy style-string assertions with browser behavior coverage while retaining relevant existing contracts.
- Added isolated synthetic test backend/config and frontend/DESIGN.md. No new dependencies.

### Iteration And Recovery
- First browser pass exposed viewport, focus and transition issues; subsequent targeted regressions and full passes resolved them.
- A timing-sensitive renewal test was corrected to switch failure only after POST and use a controlled browser clock; its final case proves zero stale-countdown logouts and recovery.
- Local 8080 was identified as Oracle, so QA used owned loopback 3100/3101 fixtures without changing existing services or databases.

### Remaining Limits And Rollback
- QA uses synthetic backend data and does not certify production Spring/OAuth/security behavior or all real organization data.
- Existing lint warnings are outside the approved change scope.
- Publication is a reviewed feature branch and PR; no main merge or deployment is implied by this record.
- Rollback: revert the frontend change commit; no schema or infrastructure rollback is required.

### Publication CI Recovery
- The first PR check failed on the generated Spring schema inventory. The same failure was reproduced on untouched base commit b256036.
- Regenerated inventory changes only java_source_file_count from 138 to 140; table mappings and Java, SQL, migration and immutable snapshot sources are unchanged.
- Complete schema verification, mutation ledger and all Flyway verification checks passed against a Git archive exported with original LF bytes. This avoids Windows checkout line-ending conversion being misread as immutable evidence drift.
- Python retirement and BFF cutover audits also passed. This R0 documentation correction is included to restore the existing delivery check.

## TASK VH-R1-SCENIC-LOGIN-20260906
- Date: 2026-09-06
- Status: implemented, verified and independently reviewed
- Risk Class: R1 isolated frontend presentation
- Approval Status: user approved both selected background directions and requested implementation
- Branch: codex/reference-backgrounds

### Scope And Changed Files
- `frontend/src/app/login/page.tsx`: centered existing login form over the architectural scene.
- `frontend/src/components/auth/login-scene.tsx`: local image, native WebGL water distortion, pause, reduced motion, hidden-tab suspension and static fallback.
- `frontend/src/components/auth/login.module.css`: scene composition, readable form and responsive motion control.
- `frontend/src/components/auth/login-card.tsx`: display the existing monogram at desktop as well as mobile widths.
- `frontend/src/components/auth/login-brand.tsx`: removed the orphaned brand panel after the layout replacement.
- `frontend/public/images/conservatory-login.webp` and its JSON sidecar: new generated scene and generation provenance.
- `frontend/tests/e2e/employee-experience.spec.ts`: four browser regressions covering scene controls, reduced motion and WebGL fallback.
- `frontend/DESIGN.md` and this ledger: current design and completion evidence.

### Evidence
- `npm run validate:grid`: PASS for all registered screens.
- `npm run lint`: PASS, 0 errors and 15 existing warnings in unchanged modules.
- `npm run test`: PASS, 19 files and 146 tests.
- `npx tsc --noEmit`: PASS.
- Dedicated Playwright experience suite: PASS, 34 tests, 0 failed, skipped or flaky. Existing login, profile, navigation, grid, theme and session regressions remain green.
- `npm run build`: PASS, including TypeScript and 190 generated routes.
- Desktop and mobile screenshots reviewed after the control stacking correction. Visual verdict 92/100; independent code review APPROVE.
- Evidence: `.omx/reference-backgrounds/verification.md` and `.omx/reference-backgrounds/hr-final-results.json`.

### Simplification And Remaining Limits
- Replaced the split brand panel and its decorative geometry with one scene and the existing form. No new dependencies or authentication behavior changes.
- The background is a newly generated image with water distortion. It is not the original reference site's complete 3D environment.
- Browser coverage uses the isolated synthetic backend and does not certify production Spring/OAuth behavior. Hardware GPU performance was not measured.
- Companion landing hero work is verified separately in the landing-minseok91 repository; its existing unrelated work was preserved.
- Local implementation only. No PR publication, merge or deployment is implied by this entry.

## TASK VH-R1-REFERENCE-FIDELITY-20260906
- Date: 2026-09-06
- Status: implemented, independently accepted and verified; main publication authorized
- Risk Class: R1 presentation and scene rendering
- Approval: user set a persistent goal of at least90-percent similarity to Unseen and Igloo, including cursor interactions, and explicitly approved Three.js and all necessary packages.

### Implementation
- HR `login-scene.tsx` now loads an actual spatial renderer and title overlay; `conservatory-scene.ts` owns room geometry, real water reflection/refraction, pointer raycasts, wave propagation and camera parallax.
- `liquid-title.ts` renders actual glyph contours in a deforming shader. `login.module.css` places the form on the right at desktop and keeps a scrollable complete form on mobile over a viewport-sized scene.
- Three.js and its development types are added to the package/lock files. Local CC0 stone textures and provenance are under `frontend/public/images/conservatory/`.
- `playwright.scene.config.ts` and `scene-fidelity.spec.ts` add controlled rendered-pixel interaction evidence. The existing context-loss regression now targets the actual WebGL2 context.
- Static architectural GI is now an offline pathtrace of the independently authored actual geometry. The registered projection uses a depth visibility mask; a separately generated pearl matcap adds surface lighting. The discarded generated architecture-light experiment is preserved in the local research archive.

### Verified Checkpoint
- Before projected-lighting experiment: grid validator PASS; lint0errors/15existing warnings;146unit tests PASS; TypeScript PASS; production build PASS with190generated routes.
- Hardware Playwright combined suite:35tests PASS,0failed/skipped/flaky in `.omx/fidelity-90/hr-checkpoint-suite.json`.
- Real GTX1060 D3D11 probe: approximately60fps, actualcamera movement, pointer/water intersection and nonzero propagating wave energy. Software-headless timeouts were diagnosed separately; no test assertions were relaxed to hide them.
- Controlled screenshots prove title-outline and water-image changes due to cursor input. These checks prove behavior, not90-percent reference fidelity.

### Completion Gates
- Both actual3D scenes passed the same independent reference rubric at90/100. Earlier92/93image-background scores were not used for this acceptance.
- Current desktop/mobile, shifted camera, hover, movement and settled evidence was inspected. Original mobile references and candidate mobile traces use native browser touch events.
- Rendering lifecycle, asset provenance, TypeScript, lint, builds and relevant browser checks passed. Authentication semantics, backend, grid conventions and deployment configuration retain their existing contracts.
- On2026-09-07 the user explicitly requested both repositories be published to main after completion. GitHub PR/CI state and the fetched main commit are the publication source of truth.

### Earlier Optics Checkpoint
- An earlier independently reviewed HR scene scored86/100. Subsequent work corrected pearl iridescence, external rock detail, broader water undulation and ambient particle softness.
- `hr-materials-suite.json`:35 hardware browser tests passed,0failed/skipped/flaky, including loaded pearl texture, title-outline/water pixel comparison and visible pause-button position.
- `hr-software-scene-regressions.json`:4 default headless scene regressions passed, covering motion controls, reduced motion and WebGL fallback/context loss.
- `npm run build`:PASS on optics engine43A593F58F52B800 and lighting helperA4DC171F0034C368. Output is recorded in `.omx/fidelity-90/hr-optics-build.log`.
- Independent optics delta code review:APPROVE, no findings and zero TypeScript diagnostics. Evidence: `.omx/fidelity-90/hr-optics-runtime-review.json`.
- Hardware motion probe:60fps; isolated water energy decays from4.793479 at1second to0.159903 at8seconds with fixed camera. These are functional/performance measurements, not visual similarity percentages.
- This earlier checkpoint was superseded by the final acceptance below.

### Final Acceptance And Verification
- Independent final audit: HR90/100, companion landing90/100, every category at least80percent. The rubric covers composition/geometry, materials/light, cursor/camera response, continuous atmosphere and typography integration. Scores are visual judgments, not pixel equality percentages.
- Current HR scene uses measured architecture and camera framing, source-calibrated independent idle motion, an authored pearl matcap, detailed exterior/stone materials,84 soft motes and a propagating water heightfield. Squared vec2 offsets replace undefined negative-base GLSL pow in the pearl tint.
- `npm run validate:grid`, `npm run lint`, `npm run test`, `npx tsc --noEmit` and `npm run build`:PASS. Unit coverage is146tests across19files; lint has0errors and15existing warnings.
- Full UI/browser checkpoint:35passed. After the mathematically equivalent pearl shader repair, the rendered interaction test and production build passed again.
- Additional runtime probes on the actual Next app confirm hidden/offscreen suspension and resume, route-unmount GPU disposal, stopped draw work and harmless completion of a delayed pearl texture after navigation.
- Local GTX1060 D3D11 rendering measured approximately60fps. Source-calibrated camera range/speed and water decay were measured separately from visual scoring.
- Browser auth/profile/grid checks use synthetic backend fixtures. They do not certify production Spring/OAuth behavior. Mobile form input intentionally belongs to the form; exact original noise phases, mineral patterns and all optical details are not claimed.
- The companion landing includes actual70-piece igloo geometry,1200 snow particles, local hover displacement, continuously attached terrain material and low overlapping middle ridges. Its production build, lint,19 functional probes,3 resource lifecycle probes and6 portable Playwright cases passed.
- Implementation audit, current hash associations and named source/candidate captures are retained under the local `.omx/fidelity-90/` evidence archive. Public assets include source/license records and generation prompts with local absolute user paths removed.
- Rollback is a revert of the frontend presentation change; no database or infrastructure rollback is required.
