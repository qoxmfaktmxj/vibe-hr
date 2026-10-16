#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");

for (const [description, scriptName] of [
  ["deployment shell validator executes the real deploy.yml secret policy", "deploy-security.sh"],
  ["deployment dotenv parser rejects executable syntax and preserves literal values", "load-deploy-env.test.sh"],
]) {
  test(description, () => {
    let executable = "bash";
    let args = [path.join(__dirname, scriptName)];
    if (process.platform === "win32") {
      executable = "docker";
      args = [
        "run",
        "--rm",
        "--pull=never",
        "--network=none",
        "--mount",
        `type=bind,source=${root},target=/repo,readonly`,
        "--workdir",
        "/repo",
        "bash:5.2",
        "bash",
        `scripts/spring-migration/${scriptName}`,
      ];
    }
    const result = childProcess.spawnSync(executable, args, { cwd: root, encoding: "utf8" });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
