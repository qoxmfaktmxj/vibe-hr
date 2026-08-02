#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const script = path.join(root, "scripts", "spring-migration", "deploy-security.sh");

test("deployment shell validator executes the real deploy.yml secret policy", () => {
  let executable = "bash";
  let args = [script];
  if (process.platform === "win32") {
    executable = "docker";
    args = [
      "run",
      "--rm",
      "--mount",
      `type=bind,source=${root},target=/repo,readonly`,
      "--workdir",
      "/repo",
      "bash:5.2",
      "bash",
      "scripts/spring-migration/deploy-security.sh",
    ];
  }
  const result = childProcess.spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
