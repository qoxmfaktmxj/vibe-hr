"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/deploy.yml"), "utf8");
const remote = workflow.split("<<'REMOTE'\n")[1].split("\n          REMOTE")[0]
  .split("\n").map(line => line.slice(10)).join("\n");
const gates = remote.match(/for stage in preflight migrate verify-schema; do[\s\S]*?\ndone/)[0];
const exitHandler = remote.slice(remote.indexOf("on_exit() {"), remote.indexOf("trap on_exit EXIT"));
const identities = remote.match(/for container in vibehr-backend-rust vibehr-frontend; do[\s\S]*?\ndone/)[0];

function run(script) {
  const result = spawnSync("bash", ["--noprofile", "--norc", "-s"], {
    input: script, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.error, undefined);
  return result;
}

// Simulate an attached child that drains the same input stream bash uses for code.
const consumingDocker = `docker() { cat >/dev/null; echo "gate:$*"; }\n`;

test("regression fixture reproduces zero-exit truncation without stdin isolation", () => {
  const result = run(consumingDocker + gates.replace("</dev/null", "") + '\necho PROMOTION_REACHED\n');
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /PROMOTION_REACHED/);
});

test("all database gates preserve subsequent promotion code on SSH stdin", () => {
  const result = run(consumingDocker + gates + '\necho PROMOTION_REACHED\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/gate:/g) || []).length, 3);
  assert.match(result.stdout, /PROMOTION_REACHED/);
});

test("a failed database gate prevents promotion and exits nonzero", () => {
  const result = run('docker() { return 23; }\nfail() { echo "$*" >&2; exit 1; }\n' + gates + '\necho PROMOTION_REACHED\n');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /database gate failed during preflight/);
  assert.doesNotMatch(result.stdout, /PROMOTION_REACHED/);
});

for (const [verified, initialStatus, expectedStatus] of [[false, 0, 1], [true, 0, 0], [false, 23, 23]]) {
  test(`EXIT rejects incomplete success: verified=${verified}, status=${initialStatus}`, () => {
    const result = run(`promotion_verified=${verified}
cleanup_candidate() { :; }
cleanup_release_archive() { :; }
restore_operator_config() { echo restored; }
${exitHandler}
trap on_exit EXIT
exit ${initialStatus}
`);
    assert.equal(result.status, expectedStatus, result.stderr);
    if (expectedStatus !== 0) assert.match(result.stdout, /restored/);
  });
}

for (const mismatch of ["none", "image", "revision", "stopped"]) {
  test(`live image proof: ${mismatch}`, () => {
    const result = run(`set -euo pipefail
expected_sha=approved-sha
backend_release=backend-release
frontend_release=frontend-release
fail() { echo "$*" >&2; exit 1; }
docker() {
  case "$*" in
    *State.Running*) echo ${mismatch === "stopped" ? "false" : "true"} ;;
    *"{{.Image}}"*) echo ${mismatch === "image" ? "wrong-image" : "expected-image"} ;;
    *"{{.Id}}"*) echo expected-image ;;
    *org.opencontainers.image.revision*) echo ${mismatch === "revision" ? "wrong-sha" : "approved-sha"} ;;
    *) return 99 ;;
  esac
}
${identities}
echo VERIFIED
`);
    assert.equal(result.status, mismatch === "none" ? 0 : 1, result.stderr);
    if (mismatch === "none") assert.match(result.stdout, /VERIFIED/);
    else assert.doesNotMatch(result.stdout, /VERIFIED/);
  });
}
