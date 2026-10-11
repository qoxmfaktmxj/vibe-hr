# UI validation outside the production host

## Execution contract

The production host must not launch Playwright/Chromium or a Next development
server as part of the daily deployment. `ui-validation.yml` runs on GitHub-hosted
Ubuntu for every main push (no path filters), PR, or manual dispatch; the manual
deploy workflow also requires this reusable UI workflow. It runs the unchanged
8-case employee UX suite and full employee-experience suite, sequentially with
one worker, plus grid validation, lint, unit tests and one production build.
Browser suites fail fast on their first failure and emit GitHub annotations;
no test is filtered out, and an interrupted suite fails the entire gate. New
runs of the same workflow/ref cancel superseded validation attempts.
Synthetic services and generated ephemeral test secrets stay on the runner;
production credentials and SSH secrets are not supplied. Browser evidence is
retained for 7 days. These fixtures do not certify real backend authorization or
hardware GPU fidelity; relevant backend/migration checks remain required.

## Daily 08:00 Asia/Seoul deployment

`deploy.yml` runs at 23:00 UTC every day, equivalent to 08:00 Asia/Seoul.
GitHub Actions scheduled runs use the default branch's current commit. The same
workflow also runs on main pushes and manual dispatch. Its deploy job requires
both the reusable same-SHA UI job and Spring/test job to succeed. Release images
are built on the hosted runner; strict SSH promotion checks the fixed commit,
retains rollback images and verifies production health. A failed job does not
promote a release. GitHub may delay a scheduled start beyond the nominal time.

The former OpenClaw daily deployment automation is disabled. The production host
does not dispatch workflows or run scheduled builds/browser tests. For a manual
same-SHA redeploy, use the Deploy Vibe-HR workflow's Run workflow action on main;
GitHub Actions retains the same gates. A passed UI job alone is not deployment
success: check the whole Deploy workflow and live revision/health.

`scripts/ci/require-ui-validation.py` remains a read-only gate for other manual
host-side diagnostics; it is not part of the daily deployment path. No local
browser fallback, RAM-limit increase, swap change or automatic permission change.

## Recovery

Revert the CI/gate change only with an approved replacement validation path.
Keep deployment blocked if the replacement UI environment is unavailable; do not
restore the OOM-prone production browser job. No service restart is needed to
activate this split. A new main push automatically starts remote validation.

## Local gate tests

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v
```

## Observed rollout blocker (2026-09-14)

Hosted employee UX8 passes, but the additional full experience suite timed out
in the first login test, once on screenshot and once on a stable password
visibility button. A screenshot-only change did not resolve the latter and was
reverted. Do not treat this as proven host OOM or proven GPU failure. Preserve
the failing gate and inspect uploaded Playwright traces with an authorized
GitHub account before selecting a renderer/runner correction. Public run status
and annotations are readable, but detailed logs/artifact downloads require
authentication in the current environment. No tests were removed or waived.
