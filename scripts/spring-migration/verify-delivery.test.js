"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { verifyCutoverRunbook, verifyKoreanPdfFontWorkflow, verifyHostedUiGate } = require("./verify-delivery");

test("cutover runbook verifier rejects stale coexistence guidance", () => {
  const failures = verifyCutoverRunbook(`
## Preconditions
- Prove FastAPI coexistence mode with SHARED_DATABASE_MODE=true and AUTO_SEED_ON_START=false; the legacy runtime must emit zero DDL and zero automatic seed writes.

## Spring-Only Smoke
The script waits for Spring readiness, verifies the non-root/no-Python image contract, checks all public documentation GET/HEAD endpoints, and confirms that live \`/openapi.json\` documents every effective FastAPI application operations.
`);

  const message = failures.join("\n");
  assert.match(message, /SHARED_DATABASE_MODE=true/);
  assert.match(message, /AUTO_SEED_ON_START=false/);
  assert.match(message, /FastAPI coexistence mode/);
  assert.match(message, /FastAPI application operations/);
});

test("cutover runbook verifier requires the staged V1/V2 and V1-V6 checks", () => {
  const failures = verifyCutoverRunbook(`
The adoption command stops at the exact V1/V2 ownership transfer.

## Verification Stages
- Post-adoption: run the exact V1/V2 integrity check immediately after the adoption command completes.
`);

  const message = failures.join("\n");
  assert.match(message, /separate `flyway-cutover` stage applies V3, V4, V5, and V6/);
  assert.match(message, /After starting `flyway-cutover`/);
  assert.match(message, /106-table live schema check/);
});

test("workflow verifier requires a fail-closed Korean font setup before Gradle tests", () => {
  const failures = verifyKoreanPdfFontWorkflow("example.yml", `
steps:
  - name: Verify backend
    run: ./gradlew test
`);

  assert.match(failures.join("\n"), /without an earlier Korean PDF font setup step/);
});

test("workflow verifier accepts the required Korean font setup before Gradle tests", () => {
  const failures = verifyKoreanPdfFontWorkflow("example.yml", `
steps:
      - name: Install Korean PDF fonts
        shell: bash
        run: |
          set -euo pipefail
          sudo apt-get update
          sudo apt-get install --yes --no-install-recommends fontconfig fonts-nanum
          fc-match NanumGothic | grep -qi nanum
      - name: Verify backend
        run: ./gradlew test
`);

  assert.deepEqual(failures, []);
});

test("hosted UI gate keeps exact-SHA ownership and all distinct regression suites", () => {
  const root = path.resolve(__dirname, "../..");
  const deploy = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");
  const ui = fs.readFileSync(path.join(root, ".github/workflows/ui-validation.yml"), "utf8");
  assert.deepEqual(verifyHostedUiGate(deploy, ui), []);
  for (const changed of [
    deploy.replace("needs: [test, ui]", "needs: [test]"),
    deploy.replace("actions: read", "actions: none"),
    deploy.replace(' --sha "$GITHUB_SHA"', ' --sha "main"'),
    deploy.replace("      - name: Require successful standalone", "      - if: false\n        name: Require successful standalone"),
    deploy + "\nuses: ./.github/workflows/ui-validation.yml\n",
    deploy + "\n      - name: Frontend tests\n",
    deploy + "\nnode scripts/spring-migration/schema-ledger.test.js\n",
  ]) assert.ok(verifyHostedUiGate(changed, ui).length > 0);
  assert.ok(verifyHostedUiGate(deploy, ui.replace("--config playwright.experience.config.ts --reporter", "--config playwright.experience.config.ts --grep login --reporter")).length > 0);
  assert.ok(verifyHostedUiGate(deploy, ui.replace("--grep-invert '@ui-smoke'", "--grep-invert 'all-tests'")).length > 0);
});
