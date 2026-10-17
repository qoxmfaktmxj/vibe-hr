"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/deploy.yml"), "utf8").replace(/\r\n/g, "\n");
const remote = workflow.split("<<'REMOTE'\n")[1]?.split(/\r?\n          REMOTE/)[0]
  ?.split(/\r?\n/).map(line => line.slice(10)).join("\n");
assert.ok(remote, "deployment must retain its remote shell");
const recovery = remote.slice(remote.indexOf("rollback_release() {"), remote.indexOf("require_env() {"));

function runFixture({ promoted = true, changed = true, composeFailure = false, readinessFailure = false, unknownRevision = false } = {}) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-deploy-recovery-"));
  try {
    let input = `set -euo pipefail
backup_dir="$PWD"
rollback_backend=previous-backend
rollback_frontend=previous-frontend
previous_backend=previous-image
backend_release=tested-new-backend
rollback_ready=true
promotion_started=${promoted}
schema_changed=${changed}
restore_operator_config() { echo restore-config >> actions; }
wait_for_candidate() { echo "probe $1" >> actions; return ${readinessFailure ? 1 : 0}; }
docker() { echo "docker $*" >> actions; return ${composeFailure ? 1 : 0}; }
${recovery}
`;
    if (unknownRevision) {
      const inventory = remote.match(/previous_backend_sha=\$\(docker image inspect[\s\S]+?(?=\nrollback_backend=)/)?.[0];
      assert.ok(inventory, "previous image revision and migration inventory must be checked before candidate startup");
      input += `docker() { echo unknown; }\ngit() { echo unexpected-git-call >> actions; return 0; }\n${inventory}\nexit 0\n`;
    } else {
      input += 'fail "fixture failure"\n';
    }
    let executable = "bash";
    let args = ["--noprofile", "--norc"];
    if (process.platform === "win32") {
      executable = "docker";
      args = ["run", "--rm", "--interactive", "--pull=never", "--network=none", "--mount",
        `type=bind,source=${fixture},target=/fixture`, "--workdir", "/fixture", "bash:5.2", "bash", "--noprofile", "--norc"];
    }
    const result = spawnSync(executable, args, { cwd: fixture, input, encoding: "utf8", timeout: 30000 });
    assert.equal(result.error, undefined, result.error?.message);
    const read = name => fs.existsSync(path.join(fixture, name)) ? fs.readFileSync(path.join(fixture, name), "utf8") : "";
    return { ...result, actions: read("actions"), override: read("rollback.override.yml") };
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

test("candidate failure preserves the running release before promotion", () => {
  const result = runFixture({ promoted: false });
  assert.equal(result.status, 1);
  assert.equal(result.actions, "restore-config\n");
  assert.equal(result.override, "");
  assert.match(remote, /git diff --quiet "\$previous_backend_sha" "\$expected_sha" -- backend-spring\/src\/main\/resources\/db\/migration/);
  assert.ok(remote.indexOf("previous_backend_sha=") < remote.indexOf("docker run --detach --rm"));
  assert.match(remote, /promotion_started=true\n\s*docker compose[^\n]+release\.override\.yml/);
});

test("partial promotion after schema migration recovers the tested backend with the previous frontend", () => {
  const result = runFixture();
  assert.equal(result.status, 1);
  assert.match(result.override, /image: tested-new-backend/);
  assert.match(result.override, /image: previous-frontend/);
  assert.equal((result.actions.match(/^probe /gm) || []).length, 3);
});

test("unchanged migration inventory permits the previous backend and frontend", () => {
  const result = runFixture({ changed: false });
  assert.equal(result.status, 1);
  assert.match(result.override, /image: previous-backend/);
  assert.match(result.override, /image: previous-frontend/);
  assert.equal((result.actions.match(/^probe /gm) || []).length, 3);
});

test("recovery compose failure remains a failed deployment without readiness claims", () => {
  const result = runFixture({ composeFailure: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /recovery failed/);
  assert.doesNotMatch(result.actions, /^probe /m);
});

test("recovery readiness failure remains visible and stops subsequent probes", () => {
  const result = runFixture({ readinessFailure: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /recovery failed/);
  assert.equal((result.actions.match(/^probe /gm) || []).length, 1);
});

test("unknown previous image revision stops before migration or container recreation", () => {
  const result = runFixture({ promoted: false, unknownRevision: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /revision is invalid; refusing migration/);
  assert.equal(result.actions, "restore-config\n");
  assert.equal(result.override, "");
});
