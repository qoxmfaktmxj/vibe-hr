# VIBE-HR employee experience

The login, navigation and account surfaces use the existing VIBE monogram, Cobalt, Steel and Ink identity. The login makes the brand visible; common application controls emphasize location, readable labels and predictable interaction. Business grids retain their established density and behavior.

## Visual foundation

- Typeface: self-hosted Pretendard Variable from the existing package.
- Brand colors: Cobalt `#3C6DEE`, Steel `#A8B3C5`, Ink `#0E1B31`.
- Application colors: existing semantic tokens in `src/app/globals.css`. New account and profile text uses navigation foreground tokens for both light and dark themes.
- Login scene: independently authored Three.js architecture, stairs, pearl, rocks and outdoor terrain guided by Unseen Studio. Registered offline GI illuminates actual room meshes; a generated matcap lights the pearl. Water uses live reflection/refraction and a propagating heightfield. The original VIBE monogram remains in the form. Local texture provenance and generation prompts are stored in `public/images/conservatory/`.
- Layout: the desktop form sits on the right, leaving room for the scene and its deforming VIBE-HR title. Mobile stacks the title and complete form with vertical scrolling. The background camera uses viewport dimensions even when the form is taller than the screen.
- Background motion: pointer input affects the actual camera, water simulation and title outlines. Visible pause, reduced-motion preference and hidden/offscreen handling stop animation. A static image remains available when WebGL is unavailable or its context is lost. Repeated slow frames lower rendering resolution while preserving geometry and interactions.
- Depth: solid readable form and profile surfaces. Profile details use two definition-list sections on desktop and one column on mobile.

## Component responsibilities

| Surface | Owner | Behavior |
|---|---|---|
| Login | `components/auth/login-card.tsx`, `login-scene.tsx`, `conservatory-scene.ts`, `liquid-title.ts`, `login.module.css` | Actual 3D scene and deforming title, motion control, company selection, password visibility, named social buttons, disclosed help and safe error recovery |
| Header | `components/layout/app-shell.tsx` | Current location, recent work tabs and consistent active indicator |
| Account | `components/layout/account-menu.tsx` | Profile, appearance, contextual help and logout |
| Appearance | `components/layout/theme-settings-popover.tsx` | Draft settings with explicit apply and cancel |
| Session | `components/layout/session-countdown.tsx` | Visible renewal action, expiry warning and renewal failure feedback |
| Navigation | `components/dashboard/dashboard-sidebar.tsx` | Labeled domains, contextual groups, persisted menu/scroll context and accessible mobile drawer |
| Profile | `components/dashboard/employee-profile-dialog.tsx` | Current employee identity, basic/account facts, loading, error retry, empty state and readonly guidance |

## Interaction rules

- Disabled tab actions reflect whether tabs exist in that direction. Closing the active page from another tab also selects a retained page. The visible tab management button supports touch as well as the context-menu shortcut.
- Menu and profile dialogs return focus to their actual entry control. Mobile menu closes before opening a profile and when crossing into the desktop layout.
- Collapsed menu groups and panels are inert. Group control IDs remain unique when mobile and desktop navigation coexist.
- Profile requests, including retries, are cancelled on close and account changes. Displayed records are bound to the current user ID.
- Profile header and close control remain reachable while the details scroll inside a short viewport.
- Motion reduction also covers portaled overlays, popovers and loading indicators. It must override state-specific enter and exit animation utilities.
- The existing demo input defaults are retained and explicitly described as trial values. They do not imply a signed-in session or successful authentication.
- Authentication errors use HTTP status categories and recovery guidance. Internal server details are not shown to users.
- Social sign-in explains email consent and account creation for an unregistered email, matching the existing Spring flow.
- Failed session time reads have an explicit retry. A successful renewal invalidates older time reads and suspends expiry decisions from the old countdown until the new time is confirmed.

## Validation

Run from `frontend`:

```powershell
npm run validate:grid
npm run lint
npm run test
npx tsc --noEmit
node node_modules/@playwright/test/cli.js test --config playwright.experience.config.ts --reporter=list
npm run build
```

The dedicated Playwright configuration starts loopback-only Next and synthetic backend servers on 3100 and 3101 with ephemeral test secrets. It exercises the real frontend and BFF cookie lifecycle without changing an existing database or service. It is UI regression coverage, not a substitute for Spring authentication, authorization or production infrastructure tests.

Coverage includes desktop and mobile login, background pause/resume and static fallback, safe error recovery, profile focus/scroll/retry, reduced motion, theme apply/cancel/persistence, normal member controls, session warnings and renewal, menu responsiveness, and existing business grid/tab navigation. Captures wait for fonts, loaded content and finite animations to finish.

The separate `playwright.scene.config.ts` exercises rendered title and water differences under identical virtual animation time. On Windows, `PLAYWRIGHT_HARDWARE_GPU=1` selects the verified D3D11 hardware path for that suite; default headless Chromium may use SwiftShader. Functional tests and frame rate are separate from reference fidelity. The final HR scene and companion landing each passed the fixed independent90-point visual/interaction rubric. This is not a pixel equality claim. Public asset JSON files record source licenses and exact generation prompts.
