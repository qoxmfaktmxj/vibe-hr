# Product scene motion

Status: complete and verified locally. No commit, push or deployment.

Approval: the user requested motion for every product exhibit, showing query/edit/save where supported and playing only the scene being viewed.

Scope/risk: R1 isolated public landing and synthetic media preparation. Keep the approved white full-height gallery,17 scenes, login entry and existing water autoplay. No production business writes, application contracts, shared grids, authentication or dependency changes.

Motion thesis: actual product state changes communicate the workflow. Prepare real UI state images from the isolated application, then animate a cursor and transition between these states in the existing browser/Three.js runtime. This deliverable is an interactive application feature rather than an exported film, so the HyperFrames video-output workflow is not the owning implementation. No new video framework is installed.

1. Reuse the existing synthetic scene setup by extracting it from the still-capture spec. This is the only planned cleanup; preserve the current capture contract and fixtures. Prepare query, edit, draft and actual synthetic save-result states for editable scenes. For readonly/workflow exceptions, show supported query, selection, detail and confirmation actions instead of inventing Save.
2. Share one deterministic canvas playback implementation across the selected 3D frame, enlarged exhibit and visible list item. It loads only the active scene's state images, preserves a poster on failure and stops on pause, hidden tab, reduced motion, offscreen state or unmount.
3. Keep only one playback owner: opening details pauses the background frame; list visibility chooses one scene; overview retains posters. Restore posters when the selected scene changes. Keep the original water renderer and make it mutually exclusive with product playback.
4. Verify all16 product sequences and their true UI outcomes, synthetic write boundaries, one-player ownership, interruption, tab/offscreen pause, reduced motion, load failure, navigation and Korean rendering. Run applicable frontend checks and a final production build, then update the local preview.

Ownership: frontend/src/components/landing; frontend/tests/e2e/landing-media and motion fixtures/capture specs; frontend/public/images/product/motion; docs and frontend/output evidence. No subagents or unrelated cleanup.

Discovered workflow defect: an unchanged HR history requery reset rowsRef to an empty array while SWR retained the same detail identity. The next cell edit mapped that empty ref and cleared the grid. Reproduced twice in scene03 preparation and preserved the failing trace. The minimal R1 screen fix resets the ref from the current source rows; a dedicated query/edit/save regression joins common-design.spec.ts. No shared grid contract or backend change.

Completion:16 scenes with65 verified UI states totaling2,179,158 bytes. All16 demos load in the real gallery. Playback ownership, pause, visibility, mobile, reduced motion and failure handling are covered by8 motion cases; a timing assertion was corrected after the caption's phase semantics changed and passed twice. Existing landing17 and common-design19 pass. Final check:ui passes312 unit tests, lint,2 existing smoke cases and one build including TypeScript/grid validation. Production verification confirms no business API calls, no page errors and one active player. Original16 posters and5 water files are unchanged. Full report: docs/design/2026-10-18-product-scene-motion.md.
