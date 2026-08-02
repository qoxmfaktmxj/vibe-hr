"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { verifyCutoverRunbook, verifyKoreanPdfFontWorkflow } = require("./verify-delivery");

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

test("cutover runbook verifier requires the staged V1/V2 and V1-V5 checks", () => {
  const failures = verifyCutoverRunbook(`
The adoption command stops at the exact V1/V2 ownership transfer.

## Verification Stages
- Post-adoption: run the exact V1/V2 integrity check immediately after the adoption command completes.
`);

  const message = failures.join("\n");
  assert.match(message, /separate `flyway-cutover` stage applies V3, V4, and V5/);
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
