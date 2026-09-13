# VIBE-HR employee experience

The login, navigation and account surfaces use the existing VIBE monogram, Cobalt, Steel and Ink identity. The login makes the brand visible; common application controls emphasize location, readable labels and predictable interaction. Business grids retain their established density and behavior.

## Visual foundation

- Typeface: self-hosted Pretendard Variable from the existing package.
- Brand colors: Cobalt `#3C6DEE`, Steel `#A8B3C5`, Ink `#0E1B31`.
- Application colors: existing semantic tokens in `src/app/globals.css`. New account and profile text uses navigation foreground tokens for both light and dark themes.
- Login scene: independently authored Three.js architecture, stairs, pearl, rocks and outdoor terrain guided by Unseen Studio. Registered offline GI illuminates actual room meshes; a generated matcap lights the pearl. Water uses live reflection/refraction and a propagating heightfield. The original VIBE monogram remains in the form. Local texture provenance and generation prompts are stored in `public/images/conservatory/`.
- Layout: the desktop form sits on the right, leaving room for the scene and its deforming VIBE-HR title. Mobile stacks the title and complete form with vertical scrolling. The background camera uses viewport dimensions even when the form is taller than the screen.
- 배경 표현: 계단의 윗면과 앞면은 명암을 구분하고, 진주의 방향성 그림자는 구운 조명 위에 합성한다. 벽은 표면 굴곡을 표현하고, 바위는 기존 노멀맵과 형상 변형을 사용한다. 식생은 군집별 크기와 색을 가진 인스턴스로 배치한다.
- 식생 품질: 모바일, 터치 기기, 좁은 화면, Intel 내장 GPU와 GPU 판별이 어려운 환경은 30,000개를 사용한다. NVIDIA RTX/GTX 또는 Radeon RX가 확인되고 논리 코어가 8개 이상이며 보고된 메모리가 8GB 이상인 PC는 48,000개로 시작한다. 메모리 API가 없는 경우에는 나머지 조건으로 판별한다. 고밀도 상태에서 24ms보다 느린 프레임이 반복되면 30,000개로 낮추고, 이후에도 36ms보다 느린 프레임이 반복되면 해상도를 낮춘다. 같은 로그인 화면에서는 밀도를 다시 올리지 않는다.
- 배경 움직임: 커서에 따른 카메라와 물의 반응은 유지하고, 자동 카메라 흔들림과 발광 입자는 사용하지 않는다. 글자는 128x128 속도장과 압력 보정으로 변형되며, 입력이 멈추면 감쇠한 뒤 계산을 중단한다. 모션 감소 설정과 화면 비활성화는 애니메이션을 중단한다. 재생 버튼은 숨긴 상태를 유지한다.
- 정적 배경: `node scripts/render-conservatory-posters.mjs`로 실제 장면의 첫 프레임을 데스크톱과 모바일 구도에 맞춰 렌더링한다. 파일과 소스 해시는 `public/images/conservatory-login-posters.json`에 기록한다. 장면의 재질, 카메라 또는 조명이 바뀌면 다시 생성한다. 처음부터 모션 감소 설정이 켜져 있거나 WebGL 사용이 불가능하면 이 이미지를 표시한다. 반복해서 느린 프레임이 발생하면 렌더링 해상도를 낮춘다.
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

- Disabled tab actions reflect whether tabs exist in that direction. Closing the active page from another tab also selects a retained page. Desktop tabs use right-click or Shift+F10 for management; the visible management button is retained below the desktop breakpoint for touch access.
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

The login meadow uses a generated image for continuous distant coverage. Three depth layers of alpha-tested muhly images add subtle wind and crest detail, with at most 900 instances on capable desktops and 450 on conservative or mobile devices. The meadow does not react directly to the cursor; the water and title remain the interactive focus. Static posters are rendered from this same scene. Generation prompts are recorded in `public/images/conservatory/pink-meadow-assets.json`.

Run from `frontend`:

```powershell
npm run check:ui
```

For small navigation changes this selects two static-background browser flows and builds once. Use `npm run test:gpu` for scene or shader changes, and `npm run test:ui:full` for broad UI regression work. Other feature changes still need focused behavior tests; see `docs/TEST_STRATEGY.md`.

The dedicated Playwright configuration starts loopback-only Next and synthetic backend servers on 3100 and 3101 with ephemeral test secrets. It exercises the real frontend and BFF cookie lifecycle without changing an existing database or service. It is UI regression coverage, not a substitute for Spring authentication, authorization or production infrastructure tests.

Coverage includes desktop and mobile login, background pause/resume and static fallback, safe error recovery, profile focus/scroll/retry, reduced motion, theme apply/cancel/persistence, normal member controls, session warnings and renewal, menu responsiveness, and existing business grid/tab navigation. Captures wait for fonts, loaded content and finite animations to finish.

The separate `playwright.scene.config.ts` exercises rendered title and water differences under identical virtual animation time. It uses D3D11 on Windows by default; `PLAYWRIGHT_HARDWARE_GPU=0` selects the default headless path, which may use SwiftShader. Functional tests and frame rate are separate from reference fidelity. The final HR scene and companion landing each passed the fixed independent90-point visual/interaction rubric. This is not a pixel equality claim. Public asset JSON files record source licenses and exact generation prompts.

## HRI inbox presentation

The approval and receive inboxes use the same inset grid padding, rounded border, 34px rows and standard search controls as company management. Search is separate from processing: opinions are edited in the confirmation dialog, and selection-based approval/receive completion plus single-document rejection live in the toolbar. Result feedback remains inside the grid card rather than adding a separate page-level card. Other read-only grid consumers retain their existing presentation defaults.

## AG Grid visual reference

Employee management (`src/components/hr/employee-master-manager.tsx`) is the default visual reference for grid screens: standard search card, pagination/count/action header, inset rounded table border, 36px column header and 34px data rows. Preserve each screen's supported operations rather than filling its toolbar with unavailable controls. Retirement checklist registration opens from the Input action in a labeled dialog, keeping the default view focused on search and the grid.

## Employee workspace UX

The user approved the local employee workspace on 2026-09-13, including the column chooser and advanced search. Use it as the visual reference for subsequent screens. Repetitive implementation is assigned to GPT-5.6 Terra after the interaction contract is settled; preserve each screen's permissions, supported actions and data rules.

Employee cells use single click for focus and double click for mouse editing. Existing keyboard editing remains available. Double-click editing does not enable rectangular cell selection: the current Community implementation still pastes tabular text as new employee rows. Range selection and overwrite paste remain pending a separate implementation decision and must not be advertised as supported.

The column chooser begins with a Show all action (전체 표시) that reveals every currently hidden optional column and synchronizes the checkmarks. Disable it when all optional columns are visible. Individual column toggles remain available.

Authenticated light-mode workspaces use a continuous white canvas and a warm near-white sidebar; the chosen primary accent and dark palette are preserved. Employee management combines search and grid into a flatter work surface. No per-row animation is added to AG Grid.

- Basic search exposes employee number, name, department and employment status. Advanced search contains position, hire-date upper bound and account activity. Applied conditions are distinct from draft fields; reset and query continue through the unsaved-change guard.
- Checkboxes select rows. Explicit selected deletion first confirms identities and marks persisted rows for deletion; saving applies the existing atomic batch. Unsaved inserted rows can be discarded locally. Delete cancellation restores persisted rows before save.
- Dates display as YYYY-MM-DD and fetched dates are normalized before entering the editable working copy. Name, department and email use flexible widths with full-value tooltips. Login ID, account activity and password columns are initially hidden but remain available through the column chooser. The backend password policy is unchanged.
- An explicit details button opens a read-only right panel without replacing the list. It displays the working copy and identifies unsaved changes. Password values are not included in this panel.
- Save shows the changed count, prevents duplicate submission and edits during an active save, captures the latest cell edit, preserves failed edits, and focuses the first invalid row. New queries clear previous save feedback.
- Quick navigation (Ctrl/Cmd+K) searches only the current permitted menu tree, can restrict results to open tabs, and stores menu pins per user. Enter opens the first result; arrow keys move through results. It does not grant access or create a separate employee-search API.
- Short CSS transitions are limited to controls and disclosure; reduced-motion preferences disable them. No additional animation library is required for this phase.
