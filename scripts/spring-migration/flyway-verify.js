#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const scripts = [
  ["flyway-baseline.test.js"],
  ["flyway-seed-ledger.test.js"],
  ["flyway-reference-seed.test.js"],
  ["flyway-baseline.js", "--verify"],
  ["flyway-seed-ledger.js", "--verify"],
  ["flyway-reference-seed.js", "--verify"],
];

for (const [script, ...args] of scripts) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, script), ...args], { cwd: root, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status || 1);
}
process.stdout.write("All Flyway source and ownership verification checks passed.\n");
