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
production credentials and SSH secrets are not supplied. Functional UI screenshots temporarily pause motion and restore the previous
preference after capture; dedicated scene/motion assertions remain unchanged.
Browser evidence is retained for 7 days. These fixtures do not certify real backend authorization or
hardware GPU fidelity; relevant backend/migration checks remain required.

## Daily 08:00 Asia/Seoul deployment gate

After safe fetch / checkout main / pull --ff-only, capture the full target SHA.
Before building images or modifying production, run from repository root:

```sh
release_sha=$(git rev-parse HEAD)
python3 scripts/ci/require-ui-validation.py --sha "$release_sha" --wait-seconds 1200
```

Require exit 0 and retain the JSON SHA/run URL as deployment evidence. The gate
requires a clean checkout, exact SHA, main branch, canonical repository and
workflow, a push/manual-dispatch event, the newest matching run's success, and
an actually successful `ui-regression` job. PR merge SHA, stale success followed
by failure, skipped/cancelled/missing/pending jobs, API errors, and dirty or
changed local code fail closed. Check the same SHA and a clean tree immediately
before build and promotion as well. Serialize deployment and do not pull again
after approval. A missing script is a failure, never permission to skip UI.

The public repository's read-only Actions API works without a token or gh CLI.
The wait uses 30-second polls (at most about 42 API requests over 20 minutes,
plus other clients sharing the anonymous 60/hour budget). Rate limits fail
closed. If access becomes private or rate-limited, connect GitHub via OpenClaw
Settings → Agents → Tools / provision managed Actions-read credentials in the
execution environment; never paste a credential in chat. An existing `GH_TOKEN`
or `GITHUB_TOKEN` is accepted without printing it. The gate never dispatches
workflows, changes branch protection, or deploys anything itself.

No new commit: reuse the latest successful same-SHA UI run and still perform the
requested redeploy. Failed CI: repair the failure and push, or rerun the exact
main SHA using Actions UI with an authorized account. No local browser fallback,
RAM-limit increase, swap change, or automatic billing/permission change.

Preserve cron ID `e690ef61-7018-4998-a54b-507aef582c7f`, schedule, model, timeout,
and delivery policy: successful deployment + runtime checks returns exactly
`NO_REPLY`; failure/incomplete/blocked returns the short existing failure notice.
A passed UI gate alone is not deployment success. Continue existing backend,
backup, candidate, rollback-image and production health verification procedures.

## Recovery

Revert the CI/gate change only with an approved replacement validation path.
Keep deployment blocked if the replacement UI environment is unavailable; do not
restore the OOM-prone production browser job. No service restart is needed to
activate this split. A new main push automatically starts remote validation.

## Local gate tests

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v
```
