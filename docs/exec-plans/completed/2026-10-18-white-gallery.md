# Full-height white product gallery

Status: implemented and verified locally. No commit, push or deployment.

Scope/risk: R1 isolated landing UI. The user requested a larger white canvas, the main slogan beside the VIBE-HR logo, and the former introduction area reassigned to the gallery. The existing 17 exhibits, login CTA, navigation, enlargement, water autoplay and static alternatives remain the acceptance baseline.

Cleanup plan before code:
1. Move the existing h1 into the compact header, preserve the product description for accessible reading, and remove the now-redundant hero block and duplicate gallery/footer branding. Delete only styles/imports made unused by that move.
2. Expand the desktop canvas to the full viewport below the header. Place instructions and compact controls over the white stage. Preserve normal document scrolling for the mobile/reduced-motion list.
3. Remove the gray floor/wall meshes and fog from the gallery only. Retain the poster planes, their 3D positions and camera/input logic. The existing water scene is untouched.
4. Verify header/title alignment, white rendered canvas, one-viewport desktop layout, 17-frame navigation and hits, water autoplay, narrow/tall/wide layouts and static alternatives. Run scoped and global frontend checks plus the final build; reuse unchanged internal-screen evidence.

Files: frontend/src/components/landing/{product-landing.tsx,landing.module.css,gallery-world.ts}, frontend/tests/e2e/product-landing.spec.ts and the current design/evidence documentation. Existing unrelated local work is preserved. No dependency, backend, authentication or deployment change.

Results: all17 landing browser cases passed, including three new actual-pixel and viewport-layout checks. At1440x1000 the canvas is1440x936 below the64px header, compared with the former520px canvas height. Header alignment, white pixels, unclipped controls and no desktop document overflow pass at900x720,1440x1000 and1175x1252. Mobile/list/keyboard/17-frame clicks and water autoplay continue to pass. Final check:ui passed global lint,312 unit tests,2 existing UI smoke cases, grid validation and production build/TypeScript. A separate production render reports zero page errors and zero gallery API calls. Evidence: frontend/output/landing-20261018/white-gallery-verification.json and white-gallery-production.png. Original water source/poster hashes remain identical.
