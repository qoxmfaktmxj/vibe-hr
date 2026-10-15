"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");

function integrationRunBlock() {
  const lines = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8").split(/\r?\n/);
  const stepStart = lines.indexOf("      - name: Verify Spring Testcontainers integration");
  assert.notEqual(stepStart, -1, "deployment must retain its integration verification step");
  const nextStep = lines.findIndex((line, index) => index > stepStart && line.startsWith("      - name:"));
  const step = lines.slice(stepStart, nextStep === -1 ? lines.length : nextStep);
  const runStart = step.indexOf("        run: |");
  assert.notEqual(runStart, -1, "integration verification must run its Bash wrapper");
  return step.slice(runStart + 1).map((line) => line.slice(10)).join("\n");
}

function runIntegrationFixture(integrationStatus, migrationStatus) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-deploy-integration-"));
  try {
    const bin = path.join(fixture, "bin");
    const logs = path.join(fixture, "logs");
    fs.mkdirSync(bin);
    fs.mkdirSync(logs);
    fs.mkdirSync(path.join(fixture, "backend-spring"));
    fs.writeFileSync(path.join(fixture, "backend-spring", "gradlew"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> ../gradle-invocations.log
for task in "$@"; do
  case "$task" in
    integrationTest)
      echo ':integrationTest'
      if [ "$MOCK_INTEGRATION_STATUS" -ne 0 ]; then exit "$MOCK_INTEGRATION_STATUS"; fi
      ;;
    migrationIntegrationTest)
      echo ':migrationIntegrationTest'
      if [ "$MOCK_MIGRATION_STATUS" -ne 0 ]; then exit "$MOCK_MIGRATION_STATUS"; fi
      ;;
  esac
done
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "docker"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> ../docker-invocations.log
echo "mock docker $*"
`, { mode: 0o755 });

    let executable = "bash";
    let args = ["--noprofile", "--norc"];
    let input = integrationRunBlock();
    const env = {
      ...process.env,
      RUNNER_TEMP: logs,
      MOCK_INTEGRATION_STATUS: String(integrationStatus),
      MOCK_MIGRATION_STATUS: String(migrationStatus),
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    };
    if (process.platform === "win32") {
      executable = "docker";
      args = [
        "run", "--rm", "--interactive", "--pull=never", "--network=none",
        "--mount", `type=bind,source=${fixture},target=/fixture`,
        "--workdir", "/fixture",
        "--env", "RUNNER_TEMP=/fixture/logs",
        "--env", `MOCK_INTEGRATION_STATUS=${integrationStatus}`,
        "--env", `MOCK_MIGRATION_STATUS=${migrationStatus}`,
        "bash:5.2", "bash", "--noprofile", "--norc",
      ];
      input = `export PATH=/fixture/bin:"$PATH"\n${input}`;
    }
    const result = childProcess.spawnSync(executable, args, {
      cwd: fixture, env, input, encoding: "utf8", timeout: 30000,
    });
    assert.equal(result.error, undefined, result.error?.message);
    const invocations = fs.readFileSync(path.join(fixture, "gradle-invocations.log"), "utf8").trim().split("\n");
    const dockerInvocations = fs.readFileSync(path.join(fixture, "docker-invocations.log"), "utf8");
    const log = fs.readFileSync(path.join(logs, "spring-integration-gradle.log"), "utf8");
    return { ...result, invocations, dockerInvocations, log };
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

for (const [name, integrationStatus, migrationStatus, expectedStatus] of [
  ["generic integration failure cannot be masked by migration success", 17, 0, 17],
  ["migration integration failure fails deployment", 0, 23, 23],
  ["successful integration and migration tasks pass deployment", 0, 0, 0],
]) {
  test(name, () => {
    const result = runIntegrationFixture(integrationStatus, migrationStatus);
    assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
    assert.deepEqual(result.invocations, ["--no-daemon --console=plain integrationTest migrationIntegrationTest"]);
    assert.match(result.dockerInvocations, /^version /m);
    assert.match(result.dockerInvocations, /^info /m);
    assert.match(result.dockerInvocations, /^events /m);
    assert.match(result.log, /Docker compatibility diagnostics \(sanitized\)/);
    assert.match(result.log, /:integrationTest/);
    if (integrationStatus === 0) assert.match(result.log, /:migrationIntegrationTest/);
  });
}
