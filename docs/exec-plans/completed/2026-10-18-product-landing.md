# Product landing implementation

Status: complete and validated locally. No commit, push or deployment.

Approval: the user explicitly requested implementation of the approved 17-scene plan, public product-first entry, login CTA, scroll navigation, primary-pointer drag and click enlargement on 2026-10-18.

Risk: R2 public UI with a narrowly scoped R3 entry-route change. Only `/` becomes public; protected business routes, session validation, API authorization and login behavior stay intact. The explicit request authorizes this boundary. No backend, deployment or dependency changes.

1. Prepare 16 synthetic product captures from the current application, with source route and theme provenance. Reuse the existing water poster and renderer without editing their source. Verify no session controls or real employee information enter public assets.
2. Build the room gallery, accessible HTML introduction and login entry. Keep the two walls of eight frames and the water scene at the end. Load Three.js on capable desktop clients only; retain a complete static gallery before enhancement.
3. Add wheel navigation, bounded primary-pointer look, click/drag discrimination, keyboard controls and enlarged views with focus restoration. Mobile, reduced-motion and WebGL failures use the same 17-scene list. Pause work when hidden and release resources on unmount.
4. Verify all 17 assets, desktop/mobile layout, input behavior, failure fallback, public/protected route separation, login continuity and unchanged water assets. Run feature browser tests, GPU checks, frontend lint/unit tests and one final production build.

Implementation ownership: `frontend/src/components/landing/`, `frontend/src/app/page.tsx`, the `/` handling in `frontend/src/proxy.ts` and menu-provider refresh exclusion, synthetic capture/test files and `frontend/public/images/product/`. Existing unrelated local changes are preserved.

Simplification: static product captures are loaded once, never 16 live business iframes. The existing water renderer is mounted only on demand. No video pipeline or new animation dependency is needed for the interactive site.

Rollback: revert these landing files and the two public-entry exceptions together. Existing internal screen work and login assets remain untouched.

Evidence: 312 unit tests; 13 landing browser cases, 58 existing experience cases and 1 original water GPU case. Unique browser total 72. Final check:ui passed lint, unit tests, two repeated smoke cases and a production build including TypeScript. The final aspect-ratio camera correction passed scoped lint, all 13 landing cases and a new production build. Sixteen synthetic captures total 605,830 bytes and make zero business writes. Five original water source/poster hashes are unchanged. The loopback production preview and its login transition were verified with synthetic services. Full detail: `docs/design/2026-10-18-landing-implementation.md`.
