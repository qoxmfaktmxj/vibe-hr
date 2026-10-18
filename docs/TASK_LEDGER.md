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

## 2026-09-13 Image-led login meadow
- Task ID: pink-meadow-image-layers. Type: frontend presentation. Risk: R1.
- User approved continuous image coverage, a few gently swaying layers, and publication. The earlier 24,000-instance preview was superseded.
- Changed: conservatory-scene.ts, vegetation-quality.ts and existing unit/browser tier tests, login-scene.tsx performance threshold, poster renderer, generated assets/posters and DESIGN.md.
- Final implementation: unlit image color covers the distant hillside. Three depth groups of alpha-tested feathered images add crest detail and subtle wind, capped at 900 desktop or 450 conservative/mobile instances. Two groups scatter across the hillside and one follows the crest. World-space texture sampling and mirrored wrapping retain spatial stability.
- Simplification: removed cloned exterior rock color and normal maps. Existing load/dispose, frame-driven density reduction and title/water cursor interaction remain.
- Asset provenance: built-in image_gen; exact prompts in frontend/public/images/conservatory/pink-meadow-assets.json. Added WebP assets total 536,184 bytes. Alpha-tested fragment work means instance reduction alone is not an FPS claim.
- Validation: lint passed with 15 existing warnings and no errors; 155 unit tests passed; TypeScript and production build passed, including grid prebuild validation. Current poster renderer completed 900-instance desktop and 450-instance mobile without console errors. Final rendered title/water interaction test passed in 18.0 seconds.
- Browser evidence: .omx/state/pink-meadow/login-final.png. A synthetic backend was used for UI checks; production authentication is not certified. The separately reported attendance authentication issue remains pending environment details and has no changes in this diff.
- Retry: initial browser launch found the earlier owned preview server lock; that preview was stopped and the isolated tests rerun.
- Root inspected the scoped shader, lifecycle, tier and visual diff. The optional specialist lane could not start because its configured model is unavailable; no independent approval is claimed.
- Repository has no VERSION convention; its existing package version is retained for this presentation patch.
- Risks: close inspection can reveal repeated tuft forms; existing image-position and GPU precision warnings remain. Rollback is a revert of the frontend presentation commit, with no database or infrastructure work.
- Final browser verification: 42/42 existing UI regression tests passed in 2.2 minutes with D3D11 Chromium. A temporary config extended playwright.experience.config.ts with launch arguments --use-angle=d3d11, --enable-gpu, --ignore-gpu-blocklist; retained in .omx/state/pink-meadow/playwright.meadow.local.ts. Basic headless mode had 40 passed and 2 timeouts (density reduction and live motion preference). Both targeted retries and the complete hardware run passed unchanged code. The environment distinction remains a known validation limit.

## 2026-09-13 Sidebar home and group controls
- Task ID: sidebar-home-controls. Risk: R2, explicitly authorized by the user's request to remove only the dashboard menu and verify/relocate the plus/minus controls.
- The sidebar filters the /dashboard entry for presentation only. The menu provider, access checks, dashboard page, Home tab and logo route retain their contracts.
- The scoped expand/collapse button now sits next to the domain title and is omitted when no collapsible groups exist. Its icon derives from actual open group codes. Toggling changes only the current domain's group codes, preserving other domain state.
- Changed: dashboard-sidebar.tsx and synthetic browser fixture/tests. Removed the separate menuExpanded state and redundant toolbar row.
- Verification: lint passed with 15 existing warnings; unit tests 155 passed; production build and TypeScript passed. Two new desktop/mobile scenarios passed in default headless mode. Two existing scenarios timed out during login in default mode; all four targeted browser scenarios passed with Windows D3D11 in 59.9 seconds.
- Browser checks cover hidden dashboard rail entries, Home return to /dashboard, title-adjacent control location, manual and aggregate toggles, keyboard activation, other-domain state preservation, existing menu panel keyboard behavior, and mobile profile/menu flow. Screenshots retained under .omx/state/sidebar-controls/.
- Design detector returned no findings; desktop/mobile visual review passed. No backend or grid module changed. Rollback is a revert of this sidebar presentation diff.

## 2026-09-13 Faster local UI validation
- Task ID: faster-ui-validation. Risk: R2. User approved the recommended smaller UI validation path and publication to main.
- Added test:ui (two existing tagged desktop/mobile flows with static login), test:ui:full (all 44 existing regression cases), test:gpu (dedicated scene pixel-response test), and check:ui (lint, unit, smoke, one production build).
- UI smoke explicitly asserts that no 3D scene textures download. GPU configuration defaults to D3D11 on Windows; PLAYWRIGHT_HARDWARE_GPU=0 opts into default headless rendering.
- AGENTS.md, TEST_STRATEGY.md and DESIGN.md now define affected checks during implementation, one final build including TypeScript, and reuse of unchanged passing evidence. Feature-specific and protected-change validation remains required; CI workflows and all existing test cases are retained.
- Validation: UI smoke 2 passed; list confirms exactly 2 smoke tests and 44 full-suite tests; GPU test 1 passed in 16.4s; all 155 unit tests passed in 1.53s; lint passed with 15 existing warnings and no errors. Final production build run once after browser tests.
- Scope review: scripts, test selection and documentation only; no runtime product, authentication, dependency or backend change. No benchmark speedup claimed beyond measured runs. Rollback: revert this validation configuration commit.
- Configuration correction: the first build caught reducedMotion at the wrong Playwright option level. Moved it to use.contextOptions using the installed Playwright type definition, then reran only UI smoke, the changed config's lint, and build. Unchanged unit and GPU results were reused.
- Final corrected UI smoke: 2 passed in 16.4s with no scene texture requests. Corrected config lint and production build (including TypeScript and 190 routes) passed.

## 2026-09-13 Compact desktop work tabs
- Risk: R2 shared navigation presentation; user explicitly requested removal of redundant three-dot controls.
- Desktop tab management buttons are hidden at the existing lg breakpoint, reclaiming their width. Right-click and Shift+F10 continue to open the same menu; mobile buttons remain for touch access.
- Updated keyboard tab-order regression expectation to focus the close button after the desktop tab title. Extended the existing two UI smoke flows to verify desktop hidden/mobile visible management actions, right-click, keyboard context menu and focus. No new test cases or GPU checks added.
- Validation: npm run check:ui passed: lint with 15 existing warnings, 155 unit tests, 2 static UI flows in 17.6 seconds and one production build including TypeScript. Desktop/mobile screenshots inspected; DESIGN.md updated. No grid, backend or permission-policy changes.
- Rollback: revert this tab presentation diff. Current change is local and not published.

## 2026-09-13 HRI inbox grid actions and export
- Risk: R2 shared grid/workflow presentation. User explicitly requested approval/receive inbox grid alignment, bulk approval, no upload, working download and publication.
- Inspection: both routes already use ReadonlyGridManager/AG Grid with standard-v2 page metadata. Download was disconnected and the shared manager displayed disabled CRUD/upload controls. Live URLs redirect to login in the available browser session; no production documents were read or acted upon.
- Changes: two thin inbox entry components share HriTaskBoard; the grid manager gains opt-in toolbar actions, multi-row selection and grid-ready access with existing defaults preserved. Both grid registry entries point to the shared implementation with approval-variant actions.
- Capabilities: select current-page documents and confirm one bulk approve/receive-complete operation with a frozen list and comment. IDs are deduplicated, requests are sequential, and a synchronous in-flight guard prevents duplicate confirmation. Individual reject/receive-reject actions are retained with confirmation. Existing BFF and backend APIs continue actor/order/state checks and individual transactions; no new backend bulk endpoint or permission bypass.
- Results are per document: successes remain committed if another request fails. Failures are listed, successful documents are refreshed, and comments remain after partial failure. No automatic mutation retry is performed.
- Download: XLSX includes current-page rows after keyword and grid filtering/sorting, with business labels and without action/status-tracking internals. The button and page explain current-page scope (up to 50 rows); upload, input, copy/template and save controls are absent from these inboxes.
- Verification: grid validation before lint passed; lint has 0 errors/15 existing warnings; 155 unit tests passed; two static navigation/tab smoke tests passed in 20.7s; one final production build including TypeScript and 190 routes passed. Two HRI browser flows passed in 32.7s, verifying actual XLSX contents, column-filtered exports, cancel with zero calls, partial processing, exact action/comment forwarding, refresh, individual rejection and empty download state. A pre-existing /tim/status consumer retains its default toolbar without checkboxes.
- Initial HRI test retry corrected the synthetic regression route from /tim/attendance-status to the real /tim/status. No production backend changes or tests were needed. Targeted reproduction: from frontend run node node_modules/@playwright/test/cli.js test --config playwright.hri.config.ts.
- Screenshots and logs are retained in frontend/test-results/hri-tasks and .omx/state/hri-tasks. Rollback: revert this frontend/registry change; no schema or infrastructure rollback.

## 2026-09-13 HRI grid visual parity
- Risk: R2 shared grid presentation, explicitly approved by the user's request to align the two inboxes with established grid screens.
- Reference: company-manager.tsx and employee-master-manager.tsx. Opt-in inset presentation uses their table padding/border, 34px rows and 420px minimum grid height; other readonly consumers preserve defaults.
- Removed the separate opinion search field, duplicate toolbar query button, row action column and page-level result/footer additions. Query stays in the search card; selected approval/receive completion and single-selection rejection stay in the toolbar. Opinion editing moved into the confirmation dialog and is disabled during submission; the submitted snapshot is trimmed.
- Existing bulk outcomes, cancel, filter-aware XLSX download and backend authority remain unchanged. Selection count and compact result feedback live within the grid section.
- Verification: validate:grid before lint passed; full lint retained 15 existing warnings with 0 errors; 155 unit tests and 2 static UI checks passed. HRI checks assert 34px rows, absence of the row action column and outside-dialog opinion input, and cover cancel/opinion persistence, partial bulk processing, selected single rejection, filtered XLSX and a pre-existing readonly screen.
- Visual correction: widened the search field to two standard columns and aligned dialog body padding after screenshot inspection. Only the affected HRI file lint, 2 HRI flows and final build were repeated; unrelated unit/smoke results were reused. Final HRI flows passed in 56.0 seconds. Final screenshots retained under frontend/test-results/hri-tasks and .omx/state/hri-design.
- No backend, schema or permission-policy changes. Rollback: revert this presentation diff and its matching toolbar metadata/test expectations.
- Final corrected production build and TypeScript passed. No checks were repeated for the documentation-only update.

## 2026-09-13 Retirement approval layout repair
- Risk: R2 shared grid presentation; user requested repair of the clipped form and detached list heading on /hr/retire/approvals. No retirement business logic changed.
- Cause: a fixed-height ManagerPageShell with its own padding was nested inside the retirement page, and searchFields=null still created an empty search card. Form select intrinsic width could expand the grid tracks.
- Fix: opt-in embedded readonly grid layout removes nested viewport height/padding, places the list heading within its grid card and gives the table a definite 420px viewport. Inset styling keeps 34px rows. Existing non-embedded consumers retain their defaults.
- The creation form now uses shrinkable minmax tracks, switches to two/one columns at smaller widths, and aligns its padding with the list. Toolbar now follows the existing registry's query/download actions instead of disabled CRUD/upload placeholders. Case selection and the lower approval panel remain.
- Verification: validate:grid passed before lint; lint 0 errors/15 existing warnings; unit tests 155 passed; final-code TypeScript and production build passed. Two targeted desktop/mobile browser checks passed in 35.7s, including long employee labels, input/button containment, no page horizontal overflow, title alignment, real row clicking, approval-panel availability and an existing /tim/status grid. Tests assert zero retirement write requests and use synthetic data only.
- Initial check caught mobile heading padding and indefinite embedded-grid height; both were corrected before final verification. Only the two targeted layout checks and affected-file lint were repeated after toolbar alignment; final build included that code. No GPU tests.
- Screenshot evidence: .omx/state/retire-layout/desktop.png and frontend/test-results/retire-layout. Rollback: revert this layout/fixture change. Production retirement actions were not performed.

## 2026-09-13 Retirement checklist design alignment
- Risk: R2 grid/workflow presentation; user named employee management as the design baseline.
- Removed the always-expanded registration card. Input in the standard toolbar opens a common confirmation dialog containing labeled code/title/description/sort fields and required/active checkboxes. Existing create payload, validation, reset and refresh behavior are retained; cancellation preserves the draft and failed registration remains open.
- The default screen now contains standard search and inset grid cards, 34px rows and only supported Input/Download toolbar actions. Query remains in the search card. Grid registry variant now accurately identifies the registration workflow. No new edit/update capability or backend policy change.
- DESIGN.md records employee management as the visual reference for subsequent grid work.
- Validation: validate:grid before lint passed; lint 0 errors/15 existing warnings; 155 unit tests passed; final TypeScript and production build passed. Two static desktop/mobile flows passed in 33.0s, covering no permanent registration form, no upload placeholders, row height, viewport containment, cancel/draft preservation, registration refresh, search and real XLSX field values.
- A final visible-label adjustment was rechecked with only affected-file lint, the two relevant browser flows and build. No GPU or unrelated full UI regression. Synthetic backend registration only; no production data modified.
- Evidence: .omx/state/checklist-design/desktop.png and frontend/test-results/checklist-layout. Rollback: revert this screen/registry/fixture change.

## 2026-09-13 Employee workspace UI/UX
- Scope: R2 shared frontend and additive employee query contract, authorized by the user's request to implement the proposed UI/UX improvements. White workspace, progressive filters, selection/deletion separation, column chooser, detail panel, save state and quick navigation implemented.
- Runtime behavior: preserved atomic employee batch endpoint and backend authority. Added query-only positions, multi-status and hire-date filters after discovering their existing controls were not transmitted. List and count SQL use bound parameters; the all-row export shares these conditions. No schema, payroll or authentication changes. Existing default-password policy remains out of scope.
- Save improvements capture the current editor value before validation/payload creation, prevent duplicate submissions, retain failed edits and focus the first invalid row. Initial column sizing avoids resetting user widths on save-state changes. Selection never itself marks deletion; confirmation names the target records and distinguishes local new-row discard from persisted deletion.
- Quick navigation filters through permitted menus, finds open tabs and stores only pinned paths under a user-specific key. Keyboard search, focusable results, empty state and reload persistence verified. Existing theme accent and dark-mode tokens retained.
- Validation: grid validation and full lint passed (15 existing warnings), 156 frontend unit cases passed, targeted employee desktop/mobile flows passed in 24.4s, existing static UI smoke 2 cases passed in 19.0s. Targeted Spring tests: HrControllerTest 4 and HrGridFilterTest 2 passed; route coverage 290/290 and schema coverage 105/105 verified. Bound-filter tests assert pagination/count parity and no interpolation of a malicious filter value.
- Browser evidence covers advanced position filtering, details, column visibility, selection/mark/cancel, save failure/retry, exact update payload including normalized date, invalid-row rejection with zero writes, unsaved query guard, reset, menu pin persistence, keyboard navigation and no-save permission behavior. Synthetic services only. GPU tests were not needed. Real PostgreSQL integration and production data mutation were not performed.
- Corrections during verification: scoped external-grid synchronization lint exceptions, nullable initialFlex typing, duplicate accessible filter label, nested viewport sizing and stale validation feedback. Only affected checks were repeated after corrections. Generated Spring coverage evidence refreshed for the additive read contract.
- Evidence under .omx/employee-ux-*.log and frontend/test-results/employee-ux. Frontend/backend must be deployed together for advanced filters. Rollback: revert this feature; no data migration reversal required.

### Employee column chooser show-all follow-up
- User requested a one-click way to enable all columns. R1 employee screen only: added a standard dropdown action that reveals hidden columns, clears hidden-column state, and disables itself when none are hidden. Individual toggles remain intact; no new dependency or shared module change.
- Validation: validate:grid, affected-file ESLint and TypeScript noEmit passed. Local browser confirmed initial hidden columns become checked, Show all becomes disabled, and hiding Email individually re-enables it. Screenshot verified Korean labels and menu layout. Build and full suites deferred to the final release gate for this preview-only change.

### 2026-09-14 Employee-only Community range paste
- Expanded-tools release verification: full lint passed with the same 15 existing warnings, 164 unit tests passed, all 8 employee browser scenarios passed (45 seconds), and final production build/TypeScript passed. The final reverse-selection fill adjustment and reload-history ordering each received targeted browser regression and a fresh build. Browser checks cover bulk and single-cell undo/redo, successful-save history reset, range/context clipboard, fill dates and two-date intervals, clicked-row detail, group detail, current-page filters/pivot/chart, permissions and existing employee save/reload flows. No GPU checks needed. Review was performed in the root lane; no independent review claim. User authorized main publication; rollback is a feature-commit revert with no database migration.
- Follow-up scope explicitly expanded by the user to all recommended employee tools and main publication: undo/redo, range copy, selection statistics, context menu, check-list filters, fill handle, expandable group/subtotal view, pivot and charts. All are implemented on employee management only, without Enterprise code, new packages or backend changes. Analysis and check-list values are explicitly current-page scoped. Baseline range-paste work is included in this release.
- Undo covers local row mutations as 30 bounded snapshots and preserves the old value of AG Grid's already-mutated cell. Successful save/accepted reload reset history; unchanged SWR data no longer overwrites a clean undo result and destroys redo. Group/pivot/chart reuse a filtered row snapshot rather than inventing server aggregates. Password values are excluded from clipboard copy and fill. Existing permission checks and delete confirmation are retained.
- Final validation: grid registry check passed; full lint passed with 15 existing warnings and final hook lint passed; 163 unit tests passed; all 5 employee UX browser tests passed in 1 minute; production build and TypeScript passed. Browser coverage includes reverse drag/scalar fill, 2x2 values and original-value restore, locked column offsets, hidden columns, sorted row IDs, atomic invalid-value rejection, read-only denial and native editor/search paste. Writes used synthetic fixtures only. Screenshot: .omx/state/employee-range-paste/range-selection.png, self-reviewed visual verdict 94/pass. No GPU or backend tests needed for this frontend-only change.
- Scope: R2, explicitly authorized to implement shared drag-selection and clipboard helpers but enable them only in employee management. No dependency, backend, permission contract or other screen changed. Main remains at the previously published employee UX release; this follow-up is on codex/employee-range-paste.
- Added opt-in range parsing/planning and a grid hook. Employee parsing converts departments/status/active/date values before one local batch, reuses original snapshots and shared dirty-row reconciliation, respects per-cell editability, and retains explicit Save. Source positions are preserved across locked columns; hidden columns and action/status columns are omitted. Scalar fill, table-from-anchor and exact-size rectangles are supported. Invalid tables/values and current-page overflow are rejected without partial writes.
- Removed the employee page's implicit clipboard-to-new-row path. Input creates rows; paste fills cells. Active editors and search inputs retain normal text paste. Rectangular selection clears on sorting/filtering/reload/column changes. No multi-range, fill handle or edge autoscroll in this first scope.
- Browser iterations found a retained drag flag after mouseup and layout movement when clearing feedback during selection; release capture/button-state checks and stable feedback fixed those issues. Validation totals are recorded after the final gate below. Existing UI/lifecycle coverage remains in the employee UX suite, including customer-screen navigation.

### Employee double-click editing evidence
- Final production build passed on 2026-09-14 after archiving a malformed generated .next/dev type directory. No product source fix was required. Parent review found no release-blocking issue in the scoped diff; independent review remains unavailable as noted below.
- Release gate on 2026-09-14: user approved push. Full frontend lint passed with 15 existing warnings; all 156 unit tests and both employee UX browser cases passed, including double-click editing. Focused Spring controller/filter tests passed; route coverage 290/290 and schema coverage 105/105 verified. Show-all behavior was additionally verified in the local browser. Independent review could not run because its configured gpt-5.4 model is unsupported; parent performed the scoped code review. Build status is recorded below after completion. No version bump: this application repository has no root VERSION or CHANGELOG release convention.
- User accepted the local visual direction and requested double-click editing before rollout. R1 screen-local change: employee-master-manager now sets singleClickEdit=false; the existing employee UX test now checks that single click does not create an editor and double click does.
- Validation: validate:grid, affected-file ESLint and TypeScript noEmit passed. A separate local browser tab verified single-click focus, double-click editor and tab-separated synthetic clipboard text creating a new unsaved row; closed without saving. No production writes. The amended automated suite and production build were not rerun for this preview-only follow-up; previous build evidence predates this boolean change.
- DESIGN.md records the accepted visual reference, intended GPT-5.6 Terra rollout and current clipboard limitations. Rectangular drag selection and overwrite paste are not implemented; Community versus Enterprise/custom implementation is awaiting the user's choice. No dependency, shared grid implementation or other screen changed in this follow-up.

## 2026-09-14 Hosted UI validation / memory isolation
- Task: UI-CI-20260914; R3 CI/deployment change explicitly authorized by the request to implement separation and same-commit gating. Scope: hosted workflow, read-only gate, manual/daily deploy integration; no application/backend/schema change.
- Diagnosis: kernel CONSTRAINT_MEMCG at 2026-09-13 23:04:10 UTC killed Next PID2420726 inside vibehr-cron-20260914-ui.service, not a global host OOM. systemd Result=oom-kill, MemoryMax=1468006400, MemoryPeak=1468026880 bytes. No limit/swap/service changes.
- Implementation: retain all eight employee UX cases and full experience suite on GitHub Ubuntu with synthetic backend. Exact-SHA main push/dispatch result + successful ui-regression job required; no local browser fallback. Manual deploy depends on reusable UI workflow, checks tested SHA, preserves dirty work instead of git reset --hard. Daily cron integration documented in UI_VALIDATION_CI.md.
- Local validation: eight gate regression tests pass (wrong SHA/event/repo/workflow, dirty/drift, newest failure, skipped/missing/pending, API failure, job success); git diff --check passes. Live hosted result and operational cron readback recorded separately after publication. No frontend/backend code changed; browser/build execution intentionally remote.
- Review: root-lane implementation and separate verification pass; native child-agent tool unavailable, no independent-agent review claimed. Recovery: revert only with replacement UI gate; leave deployment fail-closed if CI unavailable.

- Live follow-up: 6d21e01 hosted run34800015649 passed grid/lint/unit and all eight employee UX cases (94s). Additional full experience suite remained running beyond the 20-minute server gate, which correctly exited1 without local browser fallback or deployment. Public API credentials absent; detailed logs require GitHub sign-in. Added first-failure stop and GitHub reporter annotations (no test filters/waivers), plus same-workflow/ref concurrency cancellation to make future failures diagnosable and bounded.

- Final diagnosis checkpoint: run34801636733 (24fb3f1) again passed UX8, but full experience failed before capture at the visible/stable password-hide button click (60000ms). Thus screenshot-only causation is unproven; the speculative capture helper change was reverted, leaving all original frontend test/application sources intact. Hosted browser traces were uploaded, but download/detail logs require GitHub authentication (currently unavailable). No UI cases waived; full gate remains fail-closed pending trace-based environment/renderer diagnosis. Do not infer host OOM or declare a GPU root cause from these timeouts alone.
- Split execution is implemented/published; successful eight-case remote regression and actual pending/failed-CI rejection are proven. Full release validation is BLOCKED, not successful; build after the failed full suite was skipped and production was not redeployed. Cron success/failure policy is unchanged.
## TASK VH-R3-DEPLOY-IMAGE-REVISION-TEMPLATE-20261008
- Date: 2026-10-08
- Risk Class: R3 (deployment workflow)
- Approval: user requested resolution of the recurring deployment failure and supplied the failed job log after the proposed fix.
- Scope: remove shell-escaped quotes from the Go templates used to verify backend/frontend image revision labels. No runtime, data, credential, or deployment-gate change.
- Cause: the 2026-09-22 same-SHA Deploy run passed UI, tests, SSH, and image transfer, then `docker image inspect` rejected the escaped label key with `template parsing error: unexpected "\\" in operand`; rollback restored the prior containers.
- Verification: `git diff --check`, extracted remote script `bash -n`, `node --test scripts/spring-migration/deploy-security.test.js`, `node scripts/spring-migration/verify-delivery.js`, and both corrected SHA comparisons against the existing release images passed.
- Release gate: hosted same-SHA UI and test jobs remain required; deployment outcome must be checked after push. Existing production release was healthy before this change.

## TASK VH-R3-ACTIONS-DAILY-DEPLOY-20261011
- Date: 2026-10-11
- Risk Class: R3 (CI deployment schedule and operating automation).
- Approval: user explicitly requested moving the recurring VIBE-HR deployment to GitHub Actions and stopping it in OpenClaw.
- Scope: add a 23:00 UTC (08:00 Asia/Seoul) schedule to the existing Deploy Vibe-HR workflow, document hosted ownership, and disable the former OpenClaw daily deployment automation. No application, database, secret, gate, or rollback change.
- Validation: YAML trigger and `deploy.needs`/reusable UI job assertions passed; eight same-SHA gate tests, deployment secret validation, deployment security test, delivery verification, and `git diff --check` passed. Hosted run and scheduler readback are verified after publication.
- Recovery: revert the schedule commit if the hosted timer is unsuitable; re-enable the former OpenClaw automation only after a working authenticated dispatch path is supplied. Existing running containers remain untouched by the scheduling change itself.


## TASK VH-REPOSITORY-WORKFLOW-AUDIT-20261015
- Date: 2026-10-15 to 2026-10-16 (Asia/Seoul)
- Type: repository/runtime investigation, workflow bug fixes, real spreadsheet file actions
- Risk: R1/R2/R3, explicitly scoped by user approvals during this chat
- Approval: HRI inbox, LF preservation, HR appointment/retirement transitions, half-day/yearly leave accounting, V6 deduction snapshots, atomic HRI submit, appraisal validation, actual file processing on 14 screens, shared read-only grid repaint, and the exact hosted-UI Python support exceptions in the retirement scanner were approved.
- Status: completed and locally verified, including approved F17 CI guardrail correction. Publication and production deployment were not requested.
- First-Pass Validation: regressions and independent review exposed real failures; environmental startup and new-test locator/expectation errors were corrected separately.
- Retry Count: two production-browser correction/recheck batches after the initial production discovery run; targeted red/green evidence is retained.
- Review Needed: human diff/release review before rollout of the approved R3 changes; independent backend and spreadsheet findings have been resolved.
- Rollback: local source diff is reversible before release. After V6-backed approvals exist, do not serve approval/cancellation with old code; use the documented recovery controls.
- Simplifications: removed duplicate first-page selection queries, replaced HRI draft-then-submit waterfall with one atomic request, reused existing row mutations and one typed workbook parser without dependencies.
- Validation: frontend grid registry, full lint (0 errors, 14 existing warnings), 296 unit tests, production build/TypeScript; backend 199 default tests, 44 PostgreSQL workflow tests, 20 migration/replay/schema tests; 36 repository Node tests and 8 existing CI support-tool tests; active route/schema/BFF/delivery verification. All final applicable checks pass, including the real repository retirement CLI.
- Browser: 33 distinct cases have passing latest outcomes (26 initially passed plus 9 focused confirmations, with two selected-grid cases repeated for visible captures). Includes 18 real XLSX/import workflows and races, appraisal desktop/mobile, HRI desktop/mobile and task flows, training selection/busy states, retirement page-2 writes and existing shell smoke flows.
- REA: controlled local Chromium login observation, complete requested capture, no page errors/failed requests; evidence bundle is retained under .omx/state/repository-audit-20261015. No production-auth guarantee is inferred from synthetic browser services.
- Commands: npm run validate:grid; npm run lint; npm run test; npm run build; direct Playwright CLI using playwright.audit.config.ts; Gradle test, focused integrationTest and migrationIntegrationTest; node --test scripts/check-risk-paths.test.js scripts/spring-migration/*.test.js; active coverage and delivery verification.
- Notes: [full findings, changed files and evidence](audits/2026-10-15-repository-audit.md). Base main is be66845; pre-existing .impeccable/ and .playwright-mcp/ were preserved. No dependency, secret, production data, commit, push, or deployment change.


## TASK VH-AUDIT-PUBLICATION-20261016
- Date: 2026-10-16 (Asia/Seoul)
- Type: publish the verified repository workflow audit fixes
- Risk: existing approved R2/R3 scope; no additional application or deployment configuration changes
- Status: validated and explicitly authorized for publication to origin/main
- Approval: user requested push after the completed local audit and all scoped approvals.
- Scope: the 80 reviewed source, test and documentation paths; existing unrelated untracked folders are preserved.
- First-Pass Validation: reuse the unchanged application evidence from VH-REPOSITORY-WORKFLOW-AUDIT-20261015; verify staged paths, frozen checksums and remote branch state.
- Retry Count: 0 at publication preparation
- Review Needed: existing hosted same-commit CI and deployment gates remain enforced.
- Rollback: follow the V6 recovery restrictions in the cutover runbook; do not mix old leave cancellation with snapshot-backed approvals.
- Notes: the final commit and remote SHA are read back and reported in this chat; configured Actions run automatically on main push.

## TASK VH-CI-FAILURE-AND-DEDUPLICATION-20261016
- Date: 2026-10-16 (Asia/Seoul)
- Type: diagnose failed GitHub Actions, correct strict schema validation and remove proven duplicate execution
- Risk: R2 CI/shared guardrails and R3 deployment orchestration, explicitly approved for main publication and actual Actions verification
- Approval: user approved the exact V6 extension, standalone same-SHA UI gate, duplicate Node/frontend/Gradle execution removal, shell failure propagation correction and 31 additional business regressions.
- Status: locally verified; hosted workflow and production promotion results are pending publication and must be read back for the resulting commit.
- Cause: Deploy run 38763351853 failed before Gradle because complete-mode schema coverage rejected the approved V6 annual_charge_breakdown column. The previous local normal-mode check did not exercise this condition. The prior four scheduled releases succeeded; existing UI cases were not obsolete.
- Scope: two workflows, the Gradle integration partition, schema/delivery/retirement guardrails and focused regressions, generated schema evidence, test/CI documentation and this task record. No application source, existing migration, secret or dependency change.
- Simplifications: run frontend/UI checks once; reuse only the exact SHA's latest successful standalone UI result; remove four explicit Node reruns; give the 20 migration/security cases one Gradle owner; invoke both integration tasks together so any failure reaches CI.
- First-Pass Validation: reproduced the strict coverage rejection and masked Gradle failure; focused regression tests now reject unrelated columns/type drift and propagate generic/migration failures. All source test cases are retained.
- Retry Count: targeted test fixture and workflow-parser corrections were verified before the final complete pass; no test filtering or gate waiver was used to pass failures.
- Validation: 43 Node tests, eight Python gate tests, compose-smoke behavior, complete route/schema/mutation/Flyway/BFF/delivery checks and YAML parsing pass. Full container-enabled Gradle passes 199 default, 68 generic integration and 20 migration/security tests with no failures/errors/skips and no overlapping integration classes. Added Playwright command discovers exactly 31 cases; hosted total is 82 unique cases.
- Review Needed: read the new main SHA's standalone UI and Deploy outcomes after push; production deployment still requires successful test and exact-SHA UI jobs plus existing image/security/health checks.
- Rollback: revert orchestration only with an effective same-SHA UI gate retained. Existing application data and migration recovery rules remain unchanged.
- Notes: [cause, approved scope and evidence](audits/2026-10-16-ci-failure-analysis.md). Unrelated .impeccable/ and .playwright-mcp/ remain untracked and preserved.

## TASK VH-CI-PLANNED-TIME-FOLLOWUP-20261016
- Date: 2026-10-16 (Asia/Seoul)
- Risk: R3 attendance/payroll-related persistence mapping, with R2 CI diagnostics
- Approval: after hosted CI exposed the failure, the user explicitly approved planned-time mapping and related business regression corrections with stored-format verification first.
- Status: implementation and local verification complete; final same-SHA hosted validation and promotion pending publication.
- Cause: b5c6ead passes strict schema inventories and all UI validation, but correctly fails the formerly masked generic integration result. Plain LocalDateTime plus implicit JDBC conversion reads and writes planned times differently on UTC and Asia/Seoul JVMs. A separate diagnostic regex missed actual Gradle failures because it assumed XML attribute order.
- Scope: the two planned fields in TimeEntities.java, KstScheduleTimeConverter.java, TimePostgreSqlIntegrationTest.java, generated active schema evidence, both existing workflow diagnostic snippets, deploy-diagnostics.test.js, test guidance and audit evidence. No migration, global timezone override, dependency or data rewrite.
- First-Pass Validation: original read test fails on UTC; new generation regression fails on UTC storage 09:00 versus canonical 00:00 before the fix. All original assertions and test cases are retained.
- Validation: full UTC Gradle passes 199 default, 70 generic integration and 20 migration/security cases, all with zero failures/errors/skips. Separate Asia/Seoul time integration passes 14 cases. All 46 Node tests and strict 105/105 schema completeness pass. Existing same-SHA UI run 38767328884 passes 296 unit and 82 browser cases plus build/TypeScript.
- Stored Data: independent review required read-only production evidence before rollout. Manual-only temporary branch run 38769967506 confirms transaction_read_only=on, 186310 legacy schedule rows, all non-null plans matching UTC representation, zero KST-naive/unclassified plans and no Spring-tagged rows; final ROLLBACK. No individual employees or credentials are output. The first attempt stopped before querying because host psql was unavailable; the successful run reused an existing client image. No diagnostic workflow is merged into main.
- Retry Count: one explicit column-metadata correction for the static source parser; the subsequent full validation passes. The original test was not weakened and no production data repair was attempted.
- Simplifications: one converter shared only by the two fields preserves existing service code; diagnostic parsing reads testcase attributes independently instead of relying on serialization order.
- Review Needed: independent source and operational-query review found no blocker after the stored-format evidence; final hosted UI, backend/image gates and deployment health still require readback.
- Rollback: retain UTC storage interpretation and existing same-SHA gate. No data rollback is required because diagnosis and this correction do not rewrite stored rows.
- Notes: [failure, approval, storage evidence and validation](audits/2026-10-16-ci-failure-analysis.md). Temporary inspection branch/worktree is cleaned up after evidence capture; original unrelated untracked folders are preserved.

## TASK VH-FULL-RELEASE-READINESS-20261016
- Date: 2026-10-16 (Asia/Seoul)
- Status: the102-file release was published to main as01c3f5b; backend/image CI passed, while the UI rate-limit fixture collision blocked deployment. The scoped follow-up passes local validation and is authorized for publication with exact-SHA CI/deployment readback.
- Risk: R0 guidance/evidence, R1 isolated screen/test fixes, approved R2 dependency security corrections and approved R3 backend dependency/auth-runtime corrections. User approved the additional React source and calendar/Gradle-LF amendments with "다하고 푸시".
- Approval: user explicitly requested all applicable testing before push, approved the proposed frontend/backend dependency patches and approved the exact personal employee lookup and internal ERROR-dispatch fixes with authorization regressions. Existing unpatched development lint-chain advisory was disclosed and accepted with official lint preserved.
- Scope: current source/guidance drift, full distinct browser inventory, dependency security patches, real runtime failures and their regression checks. Preserve every existing case, meaningful assertion, role rule, payroll formula and migration.
- Simplifications: remove unused seven-screen code, eliminate obsolete shadcn CLI/to-ico dependency trees while preserving upstream CSS/MIT bytes and icon pixels, reuse Node discovery for the existing dotenv shell tests, replace a fragile shared lifecycle report with per-test evidence, and authenticate old browser helpers through the actual BFF.
- Verified checkpoint: frontend298 unit cases and grid validation; backend202 default +71 PostgreSQL +20 migration/security before the newly found HR initialization fix;47 script/orchestrator Node cases,8 CI gate Python cases, Compose behavior and strict inventories. Actual Linux image build/container readiness/OpenAPI checks pass after restoring existing tracked wrapper LF bytes locally. Employee experience43, layout4 and GPU1 pass. The single UX paste timing case now verifies single-cell selection before paste and passes3 focused repetitions.
- Actual runtime: approved time lookup fixes return200 for personal annual leave and both today-schedule APIs; real Tomcat public missing-resource ERROR dispatch returns404, normal unauthenticated /error and protected API return401.
- Open runtime finding: the additional47 browser run passes46 and finds a real finalist-to-employee500. Profile.updated_at was assigned after IDENTITY persist; the R1 initialization-order correction has real PostgreSQL red/green evidence and awaits the complete rebuilt backend/browser rerun.
- Independent review: backend source review found no additional blocker. Harness review required an owned Next server with explicit loopback BFF target and captured-ID/identity-checked employee cleanup; test changes are implemented and await final rerun.
- Release gate: all100 React diagnostics are resolved with official rules retained, global548-file lint is0/0 and frontend298 tests pass. The approved source/calendar/LF changes are implemented. All135 distinct browser cases and the production build pass. Same-SHA hosted delivery is verified after the authorized push, with actual run links in the final task report.
- Preservation: original .impeccable/ and .playwright-mcp/ untouched. Generated browser output, Next agent instructions and Python cache remain unstaged; an automatic approval review rejected a generated-output/cache cleanup command, so those files are preserved. No secret values are stored in tracked evidence.
- Evidence: [release-readiness audit](audits/2026-10-16-release-readiness.md); sanitized counts and red/green/runtime/browser logs under ignored .omx/state/release-readiness-20261016.
- Earlier checkpoint: the HR initialization correction is included in a fresh complete backend run,202 default +72 PostgreSQL +20 migration/security =294 cases, zero failures/errors/skips, bootJar passes. Rebuilt real HR browser workflow plus owned-server/common-code/organization regressions pass3/3. Config guards reject remote backend and shared secrets; independent source review confirms both harness hazards are closed. Final React shared-source approval, calendar/LF approval, lint/build/audit31 and complete final frontend rerun remain open. No commit or push.
- Approved continuation: user "다하고 푸시" explicitly approves both pending R2 amendments. Implement the54 diagnosed React files, CalendarCaption DOM prop filter and gradlew LF attribute, then complete local and same-SHA hosted verification before publication completion. No further confirmation is required for these scopes.

- Final local gate:294 backend,298 frontend unit,135 unique browser,47 Node and8 CI gate tests passed. Global548-file lint0/0, grid, strict inventories, Windows production build/TypeScript and both Linux image/runtime checks pass. The47 additional workflows comprise45 full-run passes and2 passing focused reruns after test-only selector/tab corrections; no assertion or case was removed. Generated runtime processes/fixtures are isolated. Known accepted upstream dependency qualifications remain in the audit. Explicit102-file publication manifest and90 source hashes exclude all temporary credentials and unrelated untracked work.
- Hosted follow-up: UI run38889195049 passes298 unit,8 UX,44 experience and build, then its25th production-audit login is correctly rate-limited because tests share one client. Deploy run38889195061 passes backend/image validation and blocks promotion on the failed exact-SHA UI result. Per-test loopback client identities isolate spreadsheet fixtures without changing the24-per-minute source limit. The two existing OAuth links disable automatic prefetch, and the fixture checks hover causes no social-login request and password login returns200. Independent review is clear; fresh scoped lint, grid,298 unit, production build/TypeScript and all31 production-audit cases pass, with zero failed/skipped/flaky cases. A107ms black-box probe confirms24 same-source200 responses, then429, with another source200. The follow-up exact-SHA release is read back after push. All existing tests/assertions are preserved; no additional dependency, security policy or workflow change.


## TASK VH-R0-PRODUCT-GALLERY-DESIGN-20261017
- Date: 2026-10-17 (Asia/Seoul)
- Status: analysis and reviewable design completed; implementation and media production deferred at the user's request.
- Risk: R0 documentation and design artifacts.
- User decisions: product introduction before login; preserve the existing water scene and include it as one exhibit; support wheel navigation, left-button drag look and frame focus; prepare compositions only because product UI may be redesigned.
- Scope: 17 exhibit compositions, 8 + 1 + 8 spatial layout, interaction states, mobile behavior, theme roles, and staged delivery after product design is settled.
- Evidence: reference site desktop/mobile rendering, wheel/drag behavior, 18 current media records, MP4 playback, supplied 41-second X video, and REA static JavaScript evidence ev_b636db1fa6694b5ece4ab9ae7a6949d4f922c810d755da46fd5b068a45973a18. Existing login and employee-theme/detail inspection used the repository's isolated synthetic fixture, with no production data. The owned fixture and Next processes were stopped after inspection.
- Deliverables: .omx/plans/product-gallery-design-20261017.md; product-gallery-layout-20261017.svg/png; product-gallery-storyboard-20261017.svg/png. Analysis evidence is under output/alim-analysis-20261017/.
- Simplification: separate stable scene intent and space navigation from replaceable product visuals; use one gallery and existing Three.js; preserve the current login scene; avoid starting video production before the product design is settled.
- Validation: all 15 proposed business route files and the shared theme-settings component exist; SVG XML parses; 17 storyboard scenes; generated boards visually reviewed; authored text checked for forbidden punctuation; application code and existing assets unchanged. Lint/build/browser test suites were not run because there is no executable change.
- Limits: representative current UI was inspected, not all future exhibits. Theme colors, final UI composition, filming details, performance budgets and production behavior remain to be validated after design approval. No new final showcase media was created.

## TASK VH-PRODUCTION-BUSINESS-FLOWS-20261017
- Date: 2026-10-17 (Asia/Seoul)
- Risk: R1 isolated frontend/date/confirmation corrections and MVC/browser regressions; explicitly approved R3 account-switch selection validation; R0 evidence and test-count guidance.
- Approval: user requested deployed-site workflow verification, authorized one dedicated test employee with October2026 and September fallback, explicitly approved P05 selection guards, then directed recommended actions, all tests, push and deployed-site readback through completion.
- Scope: restore AppShell on both month-close routes; search employees beyond the initial100 and resolve exact paginated deep links; submit the required training boolean and render structured errors safely; default manager leave queries to pending; clear obsolete account-switch selection and ignore stale lookups; use in-app leave/HRI confirmation; align leave/attendance defaults and export dates with Asia/Seoul. No production backend contract, role, token, migration, payroll formula, dependency or CI policy change.
- Validation:204 default +72 PostgreSQL +20 migration/security backend cases,305 fast frontend units,150 distinct browser cases,47 Node and8 Python gate cases,806 total; zero final failures/errors/skips/flaky cases. Grid validation precedes clean global lint and the final production build/TypeScript check. Strict inventories and Compose behavior pass. Interrupted overnight browser evidence is retained and the complete56-case suite is rerun without removing cases or assertions.
- Browser inventory:8 UX,56 experience,34 production-server audit,47 isolated actual-backend/mocked workflows,4 responsive layouts and1 rendered GPU case. Synthetic fixtures do not certify real production authorization.
- Red/green evidence: search beyond100, page-two exact match, stale/empty account candidates, training422 error recovery, default pending filter, confirmation cancel/close/busy behavior and KST day/month/year boundaries. Existing successful switching and row approval/rejection regressions pass.
- Independent review: reviewed17-file source manifest matches the final frozen files; no remaining correctness blocker. Exact lookup after100 older partial matches was added in response to review.
- Production inspection:85 distinct paths across10 domains visited, including completed rereads of20 initially loading pages. Dedicated profile value was saved, reloaded, restored and verified. Two uniquely marked half-day requests are cancelled/rejected, with no pending QA leave at the pre-publication checkpoint. Payroll inspection used existing draft/empty periods; no all-employee calculation, closure, payment or retirement confirmation.
- Simplifications: reuse AppShell, existing search filters, the existing error parser and ConfirmDialog; one small explicit KST date helper serves the affected date defaults. Preserve shared grid source and existing endpoints.
- Publication: push only this task's explicit22-file manifest after final local gates; verify the exact SHA's hosted UI and Deploy runs, live revision/readiness and actual training, leave, HRI and account-switch flows before the final report. Post-publication evidence is stored under ignored .omx/state/production-audit-20261016/.
- Preservation: unrelated gallery-design ledger entry and original untracked work are excluded from this commit. Owned temporary Java and database processes were stopped; the database is retained without destructive cleanup.
- Recovery: client-only production changes can be reverted and the previous successful images restored; no application-data migration or stored-data rewrite requires rollback.
- Evidence: [deployed business-flow audit](audits/2026-10-17-production-business-flow-audit.md), focused red/green reports and final per-suite JSON/logs in the ignored task evidence directory. Individual employee identity, original profile values and credentials are excluded from tracked evidence.

## TASK VH-ISOLATED-FINANCIAL-FINALIZATION-20261017
- Date: 2026-10-17 (Asia/Seoul)
- Risk: approved R3 payroll/retirement finalization verification, native-login prerequisite correction and reviewed-severance UI correction; R2 opt-in real-backend browser configuration; R0 evidence and test guidance.
- Approval: user explicitly requested payroll payment and retirement confirmation through completion with a test employee in a separate environment, correction of reproduced problems, push and deployment. Standing direction is to proceed with recommended fixes without repeated routine confirmation.
- Isolation: newly labelled loopback PostgreSQL database, existing Flyway cutover and minimal gated development seed, distinct OpenSSL-generated temporary auth/BFF secrets and owned loopback services. No production database credentials or records are copied. The real-browser scenario also requires explicit isolated-only opt-in and rejects employees outside development administrators and its synthetic FQ namespace.
- Scope: native login form uses POST before hydration; severance adjustment/recalculation/confirmation stays available in draft and reviewed states and remains disabled once confirmed. Add real payment-finalization PostgreSQL coverage, a complete isolated browser/HTTP workflow and accurate reviewed-state behavior in both existing mock workflows. Existing financial formulas, multipliers, migrations, role policy and production backend services are preserved.
- Finalization: three synthetic months reach paid with exactly one employee per Run, balanced and confirmed accrual/disbursement vouchers, matching owner payslip and valid Korean PDF. Required retirement checklist rejection, completed checklist, retirement confirmation, resigned status, audit history, automatic severance draft, three-month wage basis, reviewed state and final severance confirmation all pass. Repeated payment/confirmation and finalized-state edits are rejected.
- Red/green: native fallback originally navigates with GET; no-JavaScript regression now observes POST with no sensitive query keys and normal hydrated login still works. Real retirement workflow originally stalls after reviewed adjustment; the corrected UI and hosted selection regression now reach confirmation while retaining selection and immutable final controls.
- Validation:204 default +73 PostgreSQL +20 migration/security backend cases,305 frontend unit cases,152 distinct browser cases,47 Node and8 Python cases,809 total; zero final failures/errors/skips/flaky cases. Browser inventory includes the real financial scenario,47 additional workflows,8 UX,57 experience,34 production-build audit,4 responsive layouts and1 GPU case. Grid validation precedes clean global lint and one final build/TypeScript check. All existing test cases and assertions are retained.
- Evidence: SQL readback shows6 paid Runs,6 paid events,12 confirmed balanced vouchers,2 confirmed retirement cases and2 confirmed severance calculations across red/green synthetic attempts. The initial reviewed reproduction was completed after correction. No unbalanced voucher or multiple-employee target exists. The task Java process and labelled database are stopped with records preserved.
- Review: production diff is limited to the native form method and the two existing mutable severance states; the8 source/test files match the frozen manifest. One new-test record accessor typo was corrected and its failed compilation log retained. The normal local-development frontend retains existing production Secure-cookie policy.
- Simplifications: inherit the existing owned-server browser configuration and existing workflow fixtures; use one local editable-state predicate across existing controls. No new package or common-grid implementation.
- Publication: stage only the task's explicit13 files, preserving the unrelated agent/configuration cleanup and gallery ledger insertion. After push, verify the exact SHA's hosted UI and Deploy results and public production behavior without performing production financial or retirement mutations.
- Recovery: revert this task commit and restore the prior successful images. No production data repair or migration rollback is necessary because financial finalization occurred only in the isolated database.
- Evidence: [scope, findings and verification](audits/2026-10-17-isolated-financial-finalization.md); sanitized summaries, logs, red/green reports, synthetic screenshots and private runtime metadata under untracked output/financial-finalization-20261017/.

## TASK VH-ISOLATED-TIME-PAYROLL-CHAIN-20261017
- Date: 2026-10-17 (Asia/Seoul)
- Risk and approval: R3 TIM to PAY correction and isolated workflow verification, plus scoped UI/regression and evidence changes. The user explicitly requested leave approval and month-close verification through payroll, necessary fixes, passing tests, push and deployment in the same isolated environment.
- Isolation: reuse only the labelled disposable loopback PostgreSQL container, temporary local secrets and minimal administrators, with new dedicated synthetic FQ employees and payroll codes. Verify database ownership, loopback binding and the backend-created employee before historical punch fixtures. Production checks are read-only; no production business mutation or data copy.
- Findings: month-close ignores profile effective_to and can use an expired salary or leave stale generated amounts after reopening. Add payroll's inclusive period-overlap condition and stable ID ordering, using zero when no profile applies so existing upserts clear stale amounts. Fix invalid paragraph/block nesting in both month-close confirmations through existing description/children slots. Existing financial formulas, masters, multipliers, rounding, APIs, migrations and role policies are preserved.
- Red/green: three of four new profile regressions fail before the fix; all 19 time integration cases pass afterward. The reopen markup regression fails before the local markup fix; both dialogs and both hosted route aliases pass afterward. Existing global setup's authenticated session replaces duplicate administrator logins; no rate limiter or authentication control changes.
- Business flow: approved annual/half-day requests use 1.5 annual days, paid base remains 2,090,000 and five generated allowances total 515,000. Reclose updates the same input IDs, including clearing zero overtime. Explicit reviewed 10,000 deduction changes net by exactly 10,000. Gross 2,605,000, deductions 569,301.81 and net 2,035,698.19 agree through paid status, confirmed balanced vouchers, owner's payslip and PDF. Closed-period writes return 423 and paid-state mutations return 409.
- Policy boundary: existing unpaid leave becomes a payroll review event plus separately entered deduction. Historical punches are synthetic fixtures and leave attendance status uses the existing correction API. No automatic unpaid salary formula or approval-to-punch synchronization is claimed or introduced.
- Validation: 815 distinct cases pass, zero final failures/errors/skips/flaky cases: 204 default + 77 PostgreSQL + 20 migration/security, 305 frontend unit, 154 browser, 47 Node and 8 Python. Browser inventory is 3 financial/time + 47 additional + 8 UX + 57 experience + 34 production-build audit + 4 responsive + 1 GPU. The extended hosted month-close case also passes a focused rerun. Grid validation, global/affected lint, build/TypeScript, source hashes and diff checks pass.
- Evidence: preserved database has 19 paid runs/events, 38 confirmed balanced vouchers, 5 confirmed retirement/severance cases, 4 paid time-chain runs and closed October; one employee per run. Owned backend/database are stopped, records retained and owned ports closed. Production baseline confirmation is cancelled without changing January's open status.
- Simplifications: reuse existing period selection, upsert, dialog slots, BFF session and browser harness. No new dependency or shared UI abstraction. No existing test case is deleted.
- Publication: only the explicit ten-file task manifest is staged. Preserve unrelated agent/configuration edits and the gallery ledger insertion. Verify exact-SHA hosted UI/Deploy, image health/revision and read-only deployed screens after push; record results in ignored task evidence and final report.
- Recovery: revert the task commit and run the same release gates. No production data repair or schema rollback is required; finalized payroll snapshots remain immutable.
- Evidence: [scope, findings and verification](audits/2026-10-17-isolated-time-payroll-chain.md).

## TASK VH-LEAVE-AUTO-REFLECTION-20261017
- Date: 2026-10-17 (Asia/Seoul)
- Risk and approval: R3 TIM/PAY, exact forward migration and schema-aware deployment recovery. The user requested automatic approved-leave attendance and unpaid deductions, isolated end-to-end verification, passing tests, push and deployment, then explicitly selected the existing 209-hour base-salary formula. Standing authorization covers recommended scoped follow-through.
- Behavior: approval links attendance on scheduled workdays, falling back to the existing weekday/holiday policy. Half-day metadata preserves punches and work minutes while month close reports 0.5 days. Cancellation restores the underlying status, annual charge and automatic payroll source. Full-day work conflicts and closed/paid source mutations are rejected atomically under the shared 64-bit month lock.
- Payroll: freeze new unpaid approved scheduled minutes by month; calculate target snapshot base salary / 209 / 60 * monthly approved minutes, rounded to whole won HALF_EVEN. One reserved TIM_UNPAID deduction is added through the existing post-tax V1 path; taxable/statutory bases remain unchanged. Retain null-snapshot historical manual review. Reject both new and preexisting reserved manual inputs. Recheck changed automatic sources before closing calculated runs; preserve finalized results.
- Migration and screens: V7 adds five exact columns and one attendance-request FK plus required TIM_UNPAID/GL references, without business-data backfill. Preserve V1-V6 and frozen adoption references. Extend strict runtime/static schema checks and generated coverage. Existing attendance/dashboard/payroll/approval screens show half-day and automatic-source metadata; KST clock display is explicit.
- Additional findings: correct two XML-escaped comparisons in a raw report annotation, update fresh-install version assertions through V7, and prevent recreating a V6-only image after V7 migration. Candidate failure preserves running containers; partial promotion with changed migration inventory recovers the tested new backend plus prior frontend, retaining all health gates and failure evidence.
- Validation: 850 distinct passing cases, zero final failures/errors/skips/flaky cases: 216 default +94 PostgreSQL +20 migration/security backend, 305 frontend units,154 browser,53 Node and8 Python. Browser inventory is3 financial/time +47 additional +8 UX +57 experience +34 production-build audit +4 responsive +1 GPU. Grid validation precedes global lint and the final build/TypeScript check. Static delivery inventories, Compose failure behavior and real non-root/no-Python Docker image startup pass, including281 API operations and8 public-doc contracts. All existing cases/assertions are retained.
- Business proof: dedicated FQ employees in the preserved labelled loopback environment exercise annual/half/unpaid approval and cancellation, half-day work,2.5 leave days, close/reopen/reclose, overtime allowances,209-hour automatic80,000 deduction and independent10,000 deduction. Gross2,605,000, deductions649,301.81 and net1,955,698.19 agree through paid status, balanced confirmed vouchers and owner payslip/PDF. The existing retirement finalization scenario also passes. No production business record is used as a test fixture.
- Review and simplification: retain existing services, DTOs, grids, BFF and browser harness; no new dependency or shared UI abstraction. Independent read-only reviews find no remaining blocker after correcting lock-key and invalid-revision fixture defects. The29 source/workflow/test hashes remain frozen through final validation.
- Publication and preservation: publish only the explicit36-file manifest with this task's ledger addition; preserve unrelated agent/configuration cleanup and gallery ledger insertion. Verify exact-SHA hosted UI/Deploy, running release health and read-only deployed screens after push. Store sanitized results and private runtime metadata under untracked output/leave-auto-reflection-20261017/.
- Recovery and limits: keep V7 columns and source snapshots. Old V6-only images cannot restart against V7. A pre-promotion failure after migration requires a compatible forward release; a recovered deployment still reports failure. Historical null unpaid approvals retain manual review and tax/insurance treatment follows existing V1 policy.
- Evidence: [scope, policy, findings and verification](audits/2026-10-17-leave-auto-reflection.md).


## TASK VH-R0-INTERNAL-DESIGN-AUDIT-20261018
- Date: 2026-10-18 (Asia/Seoul)
- Status: reviewable whole-product design proposal completed; implementation not requested in this phase.
- Risk: R0 documentation and local research artifacts. Future shared grid/navigation implementation requires scoped R2 review.
- Source checkpoint: 9b4ab8fc8bbb62f6fcfd3d7dfa0b3a013095c62f. Production deployment SHA was not verified as identical.
- Coverage: 91 route sources and479 non-test TS/TSX files inspected by the static inventory;69 AG Grid paths and1 registered custom path;86 business-route first-view browser observations;6 mobile samples and3 dark-theme samples. Initial loading states are explicitly marked as incomplete data-state coverage, not functional passes. No business save/approval/payroll action was executed.
- Reference evidence: UIBOWL9 retained query groups,31 representative images,30 unique reference URLs;5 SaaSFrame detail images;3 Pageflows public flow previews/step lists;21st.dev table previews and Hugeicons/Lucide/Tabler People icon comparison in the user's authenticated browser;font support checked against Best Free Fonts and creator repositories. No icon copy allowance was consumed and no dependency was installed.
- Findings: literal HTML text observed in29 welfare status cells;work-schedule AG Grid/HTML-table mixture;common grid symbols imported but not rendered on selected pages;readonly tools permanently disabled;save/download order differences;15 routes missing a reachable common pagination JSX control;mobile control density and profile-card overuse. Intentional tree, matrix, payslip and monthly-close exceptions are separated from grid defects.
- Deliverables: docs/design/2026-10-18-internal-redesign-proposal.md;2026-10-18-screen-coverage.md;2026-10-18-reference-register.md;output/design-audit-20261018/review.html and its local evidence files.
- Simplification proposed: one visual system with six workflow layouts;retain AG Grid for data editing;use specific layouts for approval/detail/self-service/tree/matrix;standardize icon semantics and typography before adding packages.
- Validation: npm run validate:grid passes;Impeccable detector returns an empty array but is not treated as a visual pass;inventory verifies91 unique routes,69 AG routes and86 image paths;review-board filters return91 total,69 AG,14 HR AG and1 matching route;390px report has no document overflow;authored punctuation check passes;git diff confirms no application code, existing assets, grid registry or backend changes. No lint/build run for documentation-only work.
- Preservation: existing login/water scene and prior gallery plans preserved;unrelated agent/config cleanup and existing ledger work left intact. Research browser preferences were confined to an agent-owned browser;the user's original21st.dev icon tab URL was restored. Local report preview server is stopped before final delivery.
- Limits: no comprehensive role/state interaction test,contrast measurement,performance benchmark or backend diagnosis. Pageflows locked detailed screens are not counted as inspected. Remaining loading-state causes need separate investigation.


## TASK VH-R2-COMPACT-NAVIGATION-FOUNDATION-20261018
- Date: 2026-10-18 (Asia/Seoul)
- Status: requested sidebar and common-shape changes implemented and verified locally; three business-screen layouts delivered as comparison proposals. No commit, push or deployment.
- Risk and authorization: R2 shared grid appearance, with explicit user instruction to change sidebar scrolling, collapse-control placement, menu density, straight selection indicators, global scrollbar width and rounded corners. Authentication, permission policy, payroll and backend semantics remain outside this change.
- Changed files: frontend/src/components/dashboard/dashboard-sidebar.tsx;dashboard-sidebar.module.css;frontend/src/app/globals.css;frontend/src/components/grid/manager-layout.tsx;frontend/tests/e2e/employee-experience.spec.ts;frontend/DESIGN.md;docs/design/2026-10-18-common-foundation-and-comparison.md.
- Behavior: rail72px and domain rows56px;collapse control moved inside the rail and its24px separator removed;context pane remains208px;straight left indicators and4px menu corners;sidebar scrollbars hidden while scrolling remains available;transparent6px WebKit/Blink scrollbars elsewhere;6px shared search/grid corners scoped to the authenticated workspace.
- Simplification: reuse the existing2-level menu, session storage, theme tokens and Lucide icons;remove the dedicated toggle strip and obsolete toggle-icon style;no new package, configurable layout abstraction or business-screen behavior.
- Visual evidence: Timeoff live computed scrollbar6px and transparent track;local VIBE-HR computed rail72px,row56px,sidebar scrollbar-width none,body scrollbar6px and shared search-card radius6px. Light,red,dark,collapsed and mobile views are stored under frontend/output/common-design-20261018/.
- Tests: npm run validate:grid PASS;global npm run lint PASS;305 unit tests across28 files PASS;full employee-experience browser suite58/58 PASS, including both desktop/mobile smoke flows and the new short-height hidden-scrollbar wheel/keyboard regression;production npm run build and TypeScript PASS. The broader UI suite was used in place of only the two smoke flows, with one final production build.
- Test correction: the initial focused run had3 passes and one assertion failure because its locator kept the old collapse button name after the accessible label changed. The assertion was corrected to locate the expanded-state action;the final full suite passed with all original behavior assertions retained.
- Design inspection: Impeccable reports two side-tab warnings for the user-requested straight left selection indicators;these are intentional per the supplied reference. git diff --check passes. Login/scene/public assets and backend have no diff.
- Comparison artifacts: preview.html,proposal-employee.png,proposal-approval.png,proposal-profile.png and a dark profile view use illustrative data and existing local font/icons. All three render at1440x1000,DPR1 without horizontal document overflow;view/theme switching and sidebar collapse work. Their business actions are not connected and their content layouts are not implemented in the app.
- Boundaries: review the employee,approval and HR-basic proposals before applying their content layouts. Proceed to the prior17-scene landing plan after the internal design is decided. Existing water scene remains preserved. Owned visual fixture processes and static preview server are stopped;unrelated local edits are preserved.


## TASK VH-R1-SESSION-CONTROL-SHAPE-20261018
- Scope and authorization: user requested that the header remaining-time/renewal control match the new common design. R1 appearance-only change.
- Changed file: frontend/src/components/layout/session-countdown.tsx. Replace rounded-full with rounded-md, resolving to6px in the authenticated workspace. Preserve the44px target, text, warnings, retry behavior and all session logic.
- Validation: scoped ESLint PASS;existing renewal-failure/retry and mobile-expiry browser cases2/2 PASS;npm run check:ui PASS, including global lint,305 unit tests,2 desktop/mobile smoke flows,grid validation,build and TypeScript. Desktop rendered shape visually reviewed.
- Evidence: frontend/output/common-design-20261018/session-control-desktop.png and session-control-mobile.png.
- Simplification and limits: one class change, no new component or behavior. Local changes only;no deployment.


## TASK VH-R1-HEADER-HEIGHT-AND-GRID-SAVE-DESIGN-20261018
- Scope: user approved explicit batch-save UX and requested complete HTML-table classification in the common proposal;user requested the renewal button match Quick Move height and asked to compare sidebar-close alternatives.
- Risk: R1 appearance/test change and R0 planning. No HTML-table conversion, batch API, auth semantics, payroll or permission code was implemented.
- Implementation: session-countdown.tsx now uses h-8, matching Quick Move's32px height while retaining the shared6px radius. Existing desktop/mobile smoke cases assert equal positive rendered heights.
- Design: AST inventory finds19 native table declarations in14 product source files. Classify6 editable-grid targets,5 readonly/action-grid targets,7 dedicated-layout exceptions and1 currently unconnected declaration. Specify draft-only editing before Save, deletion restoration, save-unit atomicity, input preservation and unsaved navigation checks. Named approval/submission/close actions remain separate from data Save.
- Proposal updates: docs/design/2026-10-18-grid-save-contract.md;2026-10-18-common-foundation-and-comparison.md;2026-10-18-internal-redesign-proposal.md;2026-10-18-sidebar-toggle-options.md;frontend/DESIGN.md. Prior runtime observations remain historical evidence, while the new contract owns target classifications.
- Sidebar recommendation: remove the rail's dedicated toggle row, close from the context header and reopen on a domain click. Compare this with a24px rail toggle in frontend/output/common-design-20261018/sidebar-options.html/png. Application sidebar unchanged in this turn. Prototype close/reopen, selected-domain content and focus return verified in independent Chromium.
- References: current shadcn sidebar documentation/blocks,Linear's dated collapse article and UIBOWL desktop sidebar previews. Static references do not establish their interactive behavior. No new package installed.
- Validation: npm run check:ui PASS: lint,305 unit tests,2 desktop/mobile smoke cases including height equality,grid validation,build and TypeScript. All19 classification entries accounted for;source paths and authored punctuation checked. Screenshot session-height-matched-desktop.png reviewed. No deployment.
- Simplification/remaining decisions: one class height change;reuse existing buttons and session behavior. Sidebar alternative still awaits user choice. Backend batch contracts and migrations are future implementation scope. Owned static preview server is stopped before final delivery.

## TASK VH-R1-SIDEBAR-B-THEME-SELECTION-20261018
- Date: 2026-10-18 (Asia/Seoul)
- Authorization and scope: user approved sidebar option B and requested proceeding with the remaining common styling. Implement context-header close and domain-click reopen, plus the discussed theme-colored bold selection without persistent selection backgrounds or indicators. R1 frontend shell change; no permission, batch-save API, payroll or landing implementation.
- Changed source: frontend/src/components/dashboard/dashboard-sidebar.tsx;dashboard-sidebar.module.css;frontend/tests/e2e/employee-experience.spec.ts. Updated frontend/DESIGN.md, common-foundation-and-comparison.md, sidebar-toggle-options.md and the existing three-view comparison HTML/images.
- Behavior: remove the rail's dedicated toggle row;place a32px close control in the context header;retain group state;return keyboard focus to the selected domain when closing;expose expanded/controls on desktop domain items;reopen from the current or another domain. Retain inert collapsed content and the existing mobile drawer close action.
- Selection: domain/leaf labels use weight700 and theme-derived colors, with matching icons and transparent selection backgrounds. Remove side-indicator pseudo-elements and obsolete toggle CSS/icons. Preserve visible keyboard focus and neutral hover feedback. No new dependency or configurable navigation abstraction.
- Regression validation: focused panel/group keyboard and short-height scrolling tests2/2 PASS. Final npm run check:ui PASS: lint,305 unit tests across28 files,2 desktop/mobile smoke cases,grid validation,production build and TypeScript. Smoke cases additionally cover closing before selecting a different domain and retaining group expansion;existing header-height equality remains covered.
- Visual correction: initial20-combination inspection found light skyblue context selection below4.5:1 in two palettes. Adjusted only the context text mix from72% to65% primary, then reran the final gate and the20-combination inspection. Final minimum contrast is6.15:1 for rail text and4.62:1 for context text. All20 combinations have transparent active backgrounds,weight700,no selection pseudo-element and32px close height.
- Evidence: frontend/output/common-design-20261018/sidebar-b-theme-verification.json;sidebar-b-blue.png;sidebar-b-red.png;sidebar-b-dark.png;sidebar-b-detail.png;sidebar-b-closed.png;sidebar-b-mobile.png. Actual production build rendered with isolated synthetic backend data. Korean labels visually reviewed on desktop/mobile. Comparison screenshots regenerated;all three views have no horizontal document overflow,working close/reopen and focus return.
- Boundaries: HTML-table migration remains the approved design contract with11 conversion targets,7 layout exceptions and1 unconnected table. Three business content layouts remain comparison artifacts. The17-scene landing and existing water background are preserved. No commit,push or deployment. Owned preview processes stopped;unrelated worktree changes preserved.

## TASK VH-R0-THREE-SCREEN-COMPARISON-20261018
- Scope: user requested employee management,approval detail and HR basic proposals displayed side by side,with a recommended common design direction. Documentation and standalone comparison artifact only;no application source changes in this turn.
- Deliverable: frontend/output/common-design-20261018/comparison.html,comparison-side-by-side.png,comparison-overview.png,comparison-body.png,comparison-mobile.png and comparison-verification.json. Uses the existing1440x1000 proposal images and local Pretendard;does not alter the original images or business layouts. Updated the common-foundation-and-comparison design document with recommendations.
- Interaction: same-scale three-column overview,full-screen/body-focused comparison modes,individual enlarged views with Escape dismissal and focus return. On narrow screens only the comparison region scrolls horizontally.
- Recommendation: use employee management's restrained data styling as the shared foundation;retain approval's list/detail workflow and HR basic's information sections with grid-based history tabs. Standardize spacing,typography,control sizes and draft-save feedback;reduce repeated titles and excessive whitespace. Distinguish confirmed sidebar conventions from proposed content refinements.
- Validation: rendered and visually inspected in Chromium. Six viewport/mode checks at1920,1440 and390px pass with no document overflow,equal column widths and preserved image aspect ratios. Three enlargement dialogs and keyboard focus restoration pass;no page script errors. Initial comparison rendering exposed a fixed image-height distortion,corrected before final evidence. Authored punctuation check passes. No app lint/build rerun for the comparison-only artifact.
- Simplification and limits: reuse existing screenshots and a dependency-free HTML viewer. Data is illustrative;business actions are not connected. Opened the comparison artifact in the current Codex panel. No deployment or source behavior change.

## TASK VH-R2-THREE-SCREEN-IMPLEMENTATION-20261018
- Date: 2026-10-18 (Asia/Seoul)
- Status: requested three screens implemented and verified locally. No commit, push or deployment.
- Approval: user confirmed the recommended common design and explicitly requested employee management, approval detail and HR basic implementation in that order, with explicit batch save and landing work deferred until internal screens are ready.
- Risk: R2 common UI/grid and HR history API. Existing HR role enforcement, auth policy, payroll semantics, schema and deployment configuration preserved. No new dependency.
- Execution: completed plan at docs/exec-plans/completed/2026-10-18-common-screen-rollout.md. Full changed-file map and evidence at docs/design/2026-10-18-three-screen-implementation.md.
- Employee: visible search labels, aligned query, single content heading, reduced framing and separated secondary utilities. Preserve atomic save, changed count, range editing, undo/redo and permissions. Shared toolbar now places Save before Download.
- Approval: existing selectable grid beside the chosen document; shared detail-field renderer; click/Enter selection; mobile list/detail transition; explicit document actions and existing bulk confirmation. Keep processing feedback visible on mobile and reserve space above the menu/chat controls.
- HR basic: grouped profile sections plus eight history tabs using one standard grid. Local add/edit/delete/restore and one category batch at Save. BFF and Spring batch endpoint retain HR roles, employee lock, ownership/category and duplicate-ID checks, with all-or-nothing transaction rollback. Optional profile fields support explicit null clearing.
- Protection: shared confirmation for app menu links, work tabs and Quick Move, plus HR employee/category/page/query changes. Browser reload/close warning retained. Work-tab closure is deferred until confirmation, so cancellation preserves the tab.
- Simplification: remove two native history tables, colored profile cards and row-by-row immediate writes. Reuse shared grid status, toolbar, pagination and confirm dialog. Extract the existing form-detail renderer for reuse without redesigning unrelated application forms.
- Frontend validation: validate:grid PASS; lint PASS; 305 unit tests PASS; common-design browser suite 18/18 PASS; full employee-experience suite 58/58 PASS; final build and TypeScript PASS. Subsequent keyboard/detail changes had four focused passes and the final mobile footer correction had two focused passes plus scoped lint and a new final build. Unique browser cases: 76.
- Backend validation: 22 HR contract/unit tests PASS; 30 PostgreSQL integration tests PASS. Includes all eight history categories, mixed changes, rollback after an earlier write, category/duplicate rejection, JSON request decoding, role denial and optional profile clearing. Docker Desktop was started hidden to run isolated Testcontainers; task containers exited through the test harness.
- Corrections: updated new DTO inheritance and the route count contract; narrowed ambiguous alert/status test locators; moved mobile result feedback out of the hidden list and fixed action overlap observed in final screenshots. Intentional error/fallback regression cases still emit expected fixture errors while passing.
- Evidence: frontend/output/common-screen-rollout-20261018/index.html with actual production-build renders under synthetic data; desktop/dark/mobile captures, HR history grid and verification.json. Six viewport checks have no document overflow. Mobile approval-button hit test and viewer interactions pass. Owned frontend/backend preview processes stopped.
- Limits and next scope: frontend and Spring must deploy together. HR history uses documented local 50-row pagination over the employee aggregate. Browser back/forward interception and optimistic version-token conflict checks are not added. Nine other HTML-table conversion targets remain outside this three-screen slice. Landing and existing water scene remain untouched.
- Rollback: restore only this task's UI/API/registry changes together; no database migration to reverse. Unrelated local configuration and agent-file edits preserved.

## TASK VH-R2-REMAINING-TABLE-ROLLOUT-20261018
- Date: 2026-10-18 (Asia/Seoul)
- Status: all nine remaining table targets implemented and validated locally. No commit, push or deployment.
- Approval: user requested the remaining nine conversions with the same common design, explicit batch save, preserved exceptions and internal verification before moving to landing work.
- Risk/scope: R2 shared grid and existing batch integration. Four editable catalogs reuse existing HRI/TIM atomic endpoints. Five readonly/workflow areas retain their named business actions. No database schema, authorization policy, payroll calculation or schedule-generation algorithm change.
- Changed files and full evidence: docs/design/2026-10-18-remaining-table-implementation.md. Completed plan: docs/exec-plans/completed/2026-10-18-remaining-table-rollout.md.
- Editable behavior: BatchGridManager owns add/edit/delete drafts, restore/revert, changed counts, one explicit save, duplicate-save lock and error preservation. Template steps save with parent drafts. Personal schedule creation resolves an actual employee candidate rather than accepting an unverified typed ID.
- Shared navigation: all mounted editors contribute checks before app navigation. A clean grid cannot bypass another grid's dirty state. The existing work-code grid joins the same navigation guard. Multiple schedule panels now use full-width tables.
- Readonly behavior: stable data row IDs, supported query/download actions only, no inert editing placeholders. Leave history uses server paging; month closing retains12 months and separate close/reopen confirmation. Payslip documents, tax summary and other exceptions remain native tables.
- Additional verified fixes: render welfare status as React markup instead of literal HTML; resolve UTC-naive attendance columns as UTC in TimeGridMapper; calculate schedule-generator month boundaries from the Korea business day; show Korean leave-type labels while preserving submitted codes. The timestamp read correction was isolated from storage and calculation rules and tested in both UTC and Asia/Seoul.
- Verification: validate:grid PASS for76 registered AG Grid routes; global lint and305 frontend unit tests PASS; final build including TypeScript PASS. Final low-impact calendar/label changes received scoped lint, focused browser verification and a new final build.
- Browser coverage:19 new table/status cases,2 UTC/Korea month-boundary cases,18 existing employee/HRI/common-design cases,58 common experience cases,29 additional audit workflow cases. Unique total126. The audit's first run passed28/29; its remaining screenshot locator was scoped to the primary grid after a second detail grid was added, then the complete affected case passed. Original business assertions remained intact. Checkbox transition fixes passed three repeated runs plus source-revert/query-discard checks.
- Backend coverage:53 HRI/TIM unit/contract tests PASS and47 real PostgreSQL integration cases PASS. Existing attendance-grid timezone failure was reproduced in isolation, corrected, covered by two new timezone cases and included in the full passing integration run. Raw pre-fix evidence is output/grid-rollout-20261018/time-query-before-fix.xml.
- Inventory/preservation: AST scan of247 TSX files finds8 remaining native tables:7 approved exceptions and1 inactive declaration. All11 original conversion targets are complete. Exception table markup and untouched source-file hashes match output/grid-rollout-20261018/exception-baseline.json. No dependency manifest, migration, login scene, public asset or landing route changes.
- Visual evidence: frontend/output/grid-rollout-20261018/index.html shows all9 areas with27 light/dark/mobile captures from the real production build under synthetic data. Eighteen desktop/mobile viewport measurements have no document overflow; all viewer images, mode switching, zoom focus return and mobile width checks pass. Owned preview processes stopped.
- Simplification: remove native-table markup and immediate-write handlers from the nine targets, centralize repeated draft behavior and reuse the existing readonly renderer. Keep financial documents, analysis and permission matrices in their approved forms.
- Remaining limits: configuration catalogs and embedded details retain their existing whole-list APIs with documented local50-row pagination; no optimistic version-token conflict policy or browser back/forward interception added. Frontend and Spring should deploy together for the prior history batch and current timestamp correction.
- Landing transition: docs/design/2026-10-18-landing-17-scene-plan.md now maps16 current product views plus the existing water scene to17 compositions, themes and interactions. This follows the user's design-first/no-recording direction; no public landing implementation or final motion asset production is claimed.
- Rollback: restore scoped frontend/registry changes and the attendance SELECT conversion; no migration to reverse. Preserve unrelated user edits and existing local configuration cleanup.

## TASK VH-R2-PRODUCT-LANDING-20261018
- Date: 2026-10-18 (Asia/Seoul)
- Status: 17-scene landing implemented and verified locally. No commit, push or deployment.
- Approval: user explicitly requested implementation of the approved 17-scene design, preserving water as one scene, scroll movement, primary-pointer 3D drag, click enlargement and public introduction before login.
- Risk/scope: R2 public UI and narrowly scoped R3 public-entry exception. Only `/` now bypasses the old login/dashboard redirect and initial menu refresh. Protected business paths, BFF authorization, Spring, database and deployment rules are unchanged.
- Changed files: frontend/src/components/landing/{scenes.ts,product-landing.tsx,landing.module.css,gallery-world.ts,gallery-canvas.tsx,water-exhibit.tsx}; frontend/src/app/page.tsx; frontend/src/proxy.ts; frontend/src/components/auth/menu-provider.tsx; frontend/public/images/product; proxy.test.ts; product-landing.spec.ts and landing-capture.spec.ts with their dedicated Playwright configs; two new synthetic menu entries under the isolated landing-capture scenario. Full report: docs/design/2026-10-18-landing-implementation.md.
- Result: eight frames per side, existing water at the end, return sequence on the right wall, varied frame sizes, aspect-aware overview camera, bounded drag, wheel steps, drag/click discrimination, all-frame hit testing, keyboard equivalents, native modal focus and restoration, mobile/reduced-motion/WebGL fallback list.
- Simplification: sixteen static synthetic UI compositions instead of live grids or iframes. Three.js loads only for capable desktop users, the gallery stops when settled/hidden/enlarged, and water mounts only on explicit play. No new dependency. Login scene source and poster assets remain byte identical.
- Media: all sixteen real-UI compositions use isolated synthetic names and values, exclude session controls and contain no operational data. Total605,830 bytes; source metadata and SHA-256 are in frontend/public/images/product/provenance.json. Asset preparation made zero business writes. Per-scene workflow videos remain outside this implementation; spatial movement and water are live.
- Validation: npm run check:ui PASS, with lint,312 unit tests in29 files,2 static UI smoke flows and production build/TypeScript. Full experience58 PASS; landing13 PASS; original water GPU1 PASS. Unique browser count72, without counting the repeated smoke flows or capture checks. Grid registry76 entries PASS through the build hook. Final narrow aspect correction received scoped lint, the full landing13 and a new production build.
- Visual/runtime evidence: frontend/output/landing-20261018/index.html, poster-review.html, desktop/wide/tall/mobile/detail/water captures, verification.json, production-verification.json, source-snapshot.json and water-preservation.json. All17 exhibits load and enlarge. Local production page has no uncaught page errors or gallery API calls, and login works through the synthetic loopback relay. App browser preview is open at http://127.0.0.1:3102/.
- Corrections during verification: wait for full profile/document loading before preparing assets; use actual theme preference keys; correct fixture shape and tax labels; position financial details around their supporting rows; adjust overview distance to prevent cropping in tall desktop windows. Initial capture errors did not touch product or operational data.
- Limits: product exhibits are static images and must be refreshed after future internal UI changes. Local Chromium/D3D11 and synthetic service evidence does not certify every device or production authentication. The existing full Korean font contributes separate initial payload beyond the optimized image total.
- Rollback: restore the landing files and the root/menu refresh exceptions together; no database migration. Existing internal redesign changes and unrelated local deletions remain preserved. Completed plan: docs/exec-plans/completed/2026-10-18-product-landing.md.

## TASK VH-R1-WATER-EXHIBIT-AUTOPLAY-20261018
- Approval: user requested automatic water playback when clicking the center exhibit, without an additional play-button click.
- Scope/risk: R1 isolated landing interaction. Change the initial playing state in frontend/src/components/landing/water-exhibit.tsx and the corresponding scene description in scenes.ts. Original login renderer and assets are unchanged.
- Behavior/simplification: opening the enlarged exhibit starts playback unless reduced motion is enabled. Remove one required click. Retain stop/resume, automatic start on reopening, error fallback and resource disposal on close.
- Verification: global lint PASS;312 unit tests PASS;14 landing browser cases PASS; grid validation and production build/TypeScript PASS. New/updated browser coverage includes actual center-frame click, playback without a second click, stop/resume, close/reopen and reduced-motion static display without texture downloads. Original five water hashes match.
- Evidence: frontend/output/landing-20261018/water-autoplay-verification.json and water-autoplay.png. Local production build SQqH-qJOSeCsZKSsSJ6P2 starts water from a frame click with zero page errors. Preview service restarted with the new build; source-snapshot.json and verification.json updated.
- Browser limitation: the app browser URL policy rejected refreshing the already-open tab. No alternate browser-control workaround was attempted. The updated local preview is available after a user refresh.
- Remaining scope: no deployment or operational business writes. Reduced-motion users intentionally retain a static poster. Prior unrelated local edits remain preserved.

## TASK VH-R1-WHITE-FULLSCREEN-GALLERY-20261018
- Approval: user requested a wider white canvas, the existing slogan beside the VIBE-HR brand and the former introduction area reassigned to the gallery.
- Scope/risk: R1 isolated landing layout and gallery scene. Changed frontend/src/components/landing/product-landing.tsx, landing.module.css, gallery-world.ts and tests/e2e/product-landing.spec.ts. No authentication, backend, dependency, asset or deployment changes.
- Result:64px desktop header with inline slogan and login; canvas fills the remaining viewport; instructions/current scene/navigation float over white. Remove the large hero, duplicate branding, separate footer strip, four gray room meshes and fog. Thin the poster frames. Preserve mobile/list scrolling, all17 exhibits, keyboard controls, enlargement and water autoplay.
- Cleanup: a written plan preceded edits. Existing landing regression cases protect behavior; remove only styles/imports made unused by the hero/branding changes. Completed plan: docs/exec-plans/completed/2026-10-18-white-gallery.md.
- Verification:17 landing browser cases PASS, including new900x720,1440x1000 and1175x1252 checks for real white pixels, header alignment, full-height canvas, no desktop overflow and unobstructed controls. check:ui PASS with global lint,312 unit tests,2 existing static smoke cases, grid registry and production build/TypeScript. Original five water hashes match.
- Evidence: frontend/output/landing-20261018/white-gallery-verification.json, white-gallery-production.png and white-gallery-selected.png. Production build cHCluODqmi3CBPM1ILNjJ reports1440x936 canvas beneath a64px header, zero page errors and zero gallery API calls. The former1440x1000 composition used a520px canvas. Source snapshot and preview server updated.
- Limits: local preview remains synthetic and undeployed. Static product images and reduced-motion/mobile alternatives are retained. Current user browser tab is not controlled or redirected; the updated landing is available at http://127.0.0.1:3102/.

## TASK VH-R1-PRODUCT-SCENE-MOTION-20261018
- Approval: user requested motion for every product exhibit, including query/edit/save where supported and playback only for the viewed scene.
- Scope/risk: R1 isolated public landing, synthetic media preparation and one necessary HR history state fix. No new dependency, shared grid rule, API contract, backend, authentication or deployment change.
- Files: frontend/src/components/landing/{motion-player.ts,product-motion.tsx,gallery-world.ts,gallery-canvas.tsx,product-landing.tsx,landing.module.css}; frontend/src/components/hr/hr-basic-tabs.tsx; shared landing media fixture, motion fixture/capture spec and Playwright configs; product-motion.spec.ts; common-design.spec.ts; frontend/scripts/build-product-motion-manifests.mjs; public/images/product/motion. Exact map: docs/design/2026-10-18-product-scene-motion.md.
- Result:16 product workflows use65 actual UI state captures with cursor motion, state transitions and outcome captions. Editable scenes show drafts and saved results; readonly/workflow exceptions retain actual query/detail/approval/closing semantics. Existing water autoplay remains the17th scene.
- Playback: overview posters stay static; one selected and visible 3D frame plays. Enlarged view takes ownership, list visibility picks one item, and hidden/offscreen/reduced-motion/manual-pause paths stop playback. Old requests are aborted and bitmaps/resources released. Failed assets preserve the poster and can retry. Only the active scene's4~5 frames load, with a maximum30fps playback loop.
- Simplification: reuse one browser Canvas player rather than16 live business screens or videos. Extract existing synthetic setup for both still and motion capture without changing its contract. Preserve the original16 posters and5 water source/poster hashes. New frame assets total2,179,158 bytes.
- HR correction: unchanged requery left rowsRef empty because SWR retained the same detail reference. Two reproductions and a retained failure trace led to a one-line reset from current source rows. The new regression verifies query/edit/save, other-row preservation and the exact batch update.
- Validation: common-design19 PASS; landing17 PASS; product-motion8 covered successfully; final check:ui PASS with lint,312 unit tests in29 files,2 UI smoke cases and production build/TypeScript/grid registry. Unique browser cases this task46. The motion pixel assertion initially crossed a loop boundary after an obsolete1s wait; it now pauses on the actually displayed saved state and passed two repeated runs. Other7 motion cases passed with unchanged product code.
- Media safety: preparation made10 explicitly scoped synthetic writes and6 readonly workflows. None touched an operational backend. Public playback makes zero business API calls. Initial overview requests zero motion assets. Production build I-wIttYCwnDt4KmK7vsIA confirms one active player and zero page errors.
- Evidence: frontend/output/landing-20261018/motion-verification.json, motion-review.html and5 review sheets, motion-playback captures for all16 scenes, motion-query.png, motion-saved.png, motion-production-gallery.png, motion-production-saved.png and employee-workflow-proof.webm. The WebM is a recording of the implemented Canvas, not the app's playback medium. Source snapshot and local preview service updated.
- Limits: illustrative synthetic UI state animation, not live input. Refresh assets after product design changes. Existing welfare confirmation markup warnings were recorded without unrelated dialog refactoring. No commit, push or deployment; prior unrelated edits preserved. Completed plan: docs/exec-plans/completed/2026-10-18-product-scene-motion.md.

## TASK VH-R1-LANDING-LIST-HOVER-20261018
- Approval/scope: user requested the left list exhibit to use the same hover effect as the right. R1, isolated frontend CSS.
- Changed file: frontend/src/components/landing/landing.module.css. Extend the existing image transition and hover selectors to the active motion wrapper, including the reduced-motion override.
- Simplification: one shared hover rule for static posters and animated exhibits. Both scale to1.015 over0.3s ease-out; captions and the expand affordance stay fixed.
- Validation: npm run check:ui PASS with lint,312 unit tests,2 existing UI smoke cases and production build/TypeScript/grid registry. An independent production browser check confirms matching left/right transforms, mouseleave restoration, single-player/modal handoff,17 scenes, reduced-motion suppression and zero page errors.
- Evidence: frontend/output/landing-20261018/list-hover-verification.json, list-hover-left.png, list-hover-right.png and list-hover-check-ui.log. Source snapshot updated. Local preview uses build fdFgsIUjoDpGXd3WZIEtz at http://127.0.0.1:3102/.
- Remaining limits: browser evidence uses local Chromium and synthetic media. No new dependency, commit, push or deployment. Prior unrelated edits preserved.

## TASK VH-PUBLISH-DESIGN-AND-LANDING-20261018
- Authorization: user explicitly requested pushing the completed work from this conversation.
- Publication scope: compact navigation, common screen design, explicit batch-save grids and HR history endpoint, verified attendance timestamp correction, public17-scene gallery, synthetic motion assets and matching list hover. Include their tests, registry and design/execution documents.
- Preservation: exclude unrelated agent/tool configuration changes, generated frontend agent instructions, local browser state, preview servers, recordings, logs and caches from staging.
- Evidence reused: final check:ui passes lint,312 unit tests,2 UI smoke cases and build/TypeScript/grid validation. Current landing sources match the tested source snapshot. Existing scoped Spring XML reports contain53 unit/contract and47 PostgreSQL cases with no failures/errors/skips. Feature-specific browser evidence remains recorded in the preceding task entries.
- Publishing checks: origin/main and local main match before staging; inspect the explicit file manifest, media hashes and staged diff, then verify the remote SHA after push. Existing main-triggered CI and deployment workflows are separate from Git publication success.

## TASK VH-R1-WATER-BRAND-PREVIEW-20261018
- Authorization: user requested a flowing water and VIBE-HR motion preview, then explicitly chose automatic cursor demonstration before clicking for direct control.
- Scope/risk: R1 landing playback, existing liquid-title composition, local capture and tests. No login source, auth, internal business, API, dependency or deployment change.
- Files: frontend/src/components/landing/{motion-player.ts,product-motion.tsx,product-landing.tsx,gallery-world.ts,water-exhibit.tsx,scenes.ts,landing.module.css}; public/images/product/motion/09; product-motion.spec.ts, product-landing.spec.ts and opt-in water-preview-capture.spec.ts/config; DESIGN.md. Full report: docs/design/2026-10-18-water-brand-preview.md.
- Behavior: the selected 3D/list frame plays a silent12-second loop of water, the VIBE-HR cursor sweep and glyph recovery. Clicking pauses the video and opens the original renderer plus interactive liquid title in a centered composition. Hidden/offscreen/manual-pause/reduced-motion paths stop playback; the static accessible title remains available in the enlarged fallback.
- Simplification: extend the existing Canvas player for one MP4; reuse the original water and liquid-title modules instead of implementing another renderer. The preview requests no full-scene textures. Closing releases live title resources and restores the existing single-player ownership.
- Media: H.264,1280x800,30fps,1,265,406 bytes. SHA-256 and local-renderer provenance are stored alongside the asset. Automatic cursor input is illustrative; actual control begins in the enlarged scene. Source recording and contact sheet remain local evidence.
- Validation: motion11, landing17, original login GPU1 and static UI2 PASS,31 distinct browser cases. Final check:ui PASS with global lint,312 unit tests,build/TypeScript and grid registry. Pixel comparison verifies glyph deformation and recovery. An initial capture selected before gallery initialization and opened the wrong scene; its trace is retained and the corrected capture waits for data-ready.
- Production evidence: local build lVuFgQkO4ktNjEmBz4uQF verified in desktop and mobile with single playback owner, no page errors/business calls and no renderer textures requested by the preview. Screens, original preservation7-file check and water-preview-verification.json are under frontend/output/landing-20261018/. Preview restarted at http://127.0.0.1:3102/.
- Limits: local Chromium/D3D11 verification, with static fallback for unsupported decoding/rendering. Prior unrelated local edits remain preserved. Completed plan: docs/exec-plans/completed/2026-10-18-water-brand-preview.md.
- Publication authorization: user subsequently requested push. Local main matches origin/main before publication; tested source hashes and MP4 provenance match. Stage only this task's17 files, reuse unchanged successful checks, and verify the remote SHA after pushing. Automatic CI/deployment status remains separate from Git publication success.
