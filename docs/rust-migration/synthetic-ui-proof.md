# Synthetic browser verification

On 2026-11-19 the production Next.js build passed 247 Playwright executions across the 19 synthetic screen, rendering and asset-capture configurations below. Some specifications intentionally run in multiple configurations. All three asset-generation suites ran with their explicit opt-in flags in disposable frontend copies. The repository's product images and videos were unchanged.

| Playwright configuration | Passed | Environment |
|---|---:|---|
| ui | 2 | Linux Chromium |
| employee-ux | 8 | Linux Chromium |
| audit | 36 | Linux Chromium |
| checklist | 2 | Linux Chromium |
| common-design | 19 | Linux Chromium |
| grid-rollout | 21 | Linux Chromium |
| hri | 5 | Linux Chromium |
| appraisal-targets | 4 | Linux Chromium |
| retirement-selection | 2 | Linux Chromium |
| training | 5 | Linux Chromium |
| retire | 2 | Linux Chromium |
| spreadsheet | 18 | Linux Chromium |
| experience | 58 | Windows Chromium |
| landing | 20 | Windows Chromium |
| product-motion | 11 | Windows Chromium |
| scene | 1 | Windows Chromium |
| landing-capture | 16 | Linux Chromium |
| landing-motion-capture | 16 | Linux Chromium |
| water-preview | 1 | Windows Chromium |

The synthetic server serves fixtures on loopback. Next.js and the browser exercise their usual UI and BFF paths. Business API behavior that requires Rust, PostgreSQL or the complete production-style login chain is verified separately under the real-backend suites.

## Verified rendering

- The Windows WebGL2 renderer identified the NVIDIA GeForce GTX 1060 3GB through ANGLE Direct3D 11. Pointer-driven animation, keyboard focus, bounded navigation, rendered pixel differences and responsive fallback assertions used the existing thresholds.
- The opt-in still capture produced 16 WebP images at 1320 by 825 pixels. All 65 generated workflow frames and all 16 stills matched their captured SHA-256 digests and byte counts. Each motion scenario included at least four interaction frames.
- The independently generated water preview passed the frame-count assertion. FFprobe reported one H.264 video stream at 1280 by 800 pixels, 30 fps and 12 seconds. The output had no audio stream.
- Retirement layout assertions passed at 390 and 1440 pixels. The inspected mobile screenshot showed the Korean form fields, create button, grid title and selected synthetic row.

## Resolved failures

- The development issue overlay intercepted the click before the sidebar profile focus test could open its dialog. A focused development rerun and the full production-build run passed the original click, Escape and return-focus assertions.
- Development effect replay started two initial synthetic list requests in spreadsheet tests that assert the production request count. The full standalone spreadsheet and audit suites ran against the production build, retaining the exact counts and all write-race assertions.
- Repeated logins from independent contexts shared the fixed loopback client identity. A traced test received a genuine HTTP 429. The experience fixture now spaces independent login attempts within the BFF budget. The rate limiter and its policy were unchanged.
- The read-only attendance grid is registered with query and download actions. Both widths showed those controls and no upload action. The retirement suite now checks that concrete toolbar contract after its retirement assertions.
- Cross-process delays of 193, 368 and 317 milliseconds separated wheel ticks in a test intended to simulate one continuous gesture. The product resets its buffered gesture after 180 milliseconds. The test now delivers the original eight ticks together in the browser and checks the same navigation result. The Linux software-rendering run also timed out while advancing water animation frames. The hardware renderer passed the full landing, motion and fidelity suites.
- Synthetic welfare and payroll query responses finished while unrelated Next.js route prefetches kept the page busy. Motion capture now waits for the successful GET belonging to each screen's query, and still checks the expected visible rows, actions and write counts.

## Reproduction

Build `frontend` with `npm run build`. Set `PLAYWRIGHT_USE_PRODUCTION_BUILD=1` and run `npx playwright test -c playwright.<configuration>.config.ts --reporter=line` for the configurations above. Use an isolated copy for capture suites because they deliberately produce public artwork. Their respective flags are `VIBEHR_CAPTURE_LANDING=1`, `VIBEHR_CAPTURE_MOTION=1` and `VIBEHR_CAPTURE_WATER=1`. The water capture also requires FFmpeg.

Linux ran the repository's Playwright 1.58.2 image with an isolated loopback fixture. The Windows copy used loopback ports 18261 and 18262 because the host's excluded range contained the synthetic defaults 3100 and 3101. The copy changed only these fixture ports for the native run. The one-time dependency advisory emitted by the first Windows build was preserved in its log. The same pinned source built successfully on retry.

Combined local evidence for this run is under `%TEMP%\vibehr-rust-render-qa-b3d315ea77d04df2b81dec0117db3303\proof-combined` and includes one log per configuration, the media verification summary and the two retirement screenshots.
