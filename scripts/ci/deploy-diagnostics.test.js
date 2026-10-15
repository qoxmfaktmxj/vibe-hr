"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const workflow = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/deploy.yml"), "utf8").replace(/\r\n/g, "\n");
const diagnostics = [...workflow.matchAll(/          node <<'NODE'\n([\s\S]*?)          NODE/g)].map((match) =>
  match[1].split("\n").map((line) => line.replace(/^          /, "")).join("\n"));

for (const [index, script] of diagnostics.entries()) {
  test(`Spring ${index === 0 ? "unit" : "integration"} diagnostics read Gradle XML without relying on attribute order`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-ci-diagnostics-"));
    try {
      const results = path.join(directory, "backend-spring/build/test-results/test");
      fs.mkdirSync(results, { recursive: true });
      fs.writeFileSync(path.join(results, "TEST-example.xml"), `<?xml version="1.0"?>
<testsuite>
  <testcase name="passing()" classname="Example" time="0.1"/>
  <testcase name="utcPlan()" classname="TimeIntegration" time="0.2">
    <failure message="different time" type="AssertionError">expected midnight but was 15:00 password=example</failure>
  </testcase>
  <testcase classname="OtherIntegration" name="connection()"><error type="Exception">connection rejected</error></testcase>
</testsuite>`);
      const result = spawnSync(process.execPath, ["-e", script], {
        cwd: directory, env: { ...process.env, RUNNER_TEMP: directory }, encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /TimeIntegration#utcPlan\(\): expected midnight but was 15:00 password=\[REDACTED\]/);
      assert.match(result.stdout, /OtherIntegration#connection\(\): connection rejected/);
      assert.doesNotMatch(result.stdout, /#passing\(\)|before producing a JUnit failure report|password=example/);

      fs.unlinkSync(path.join(results, "TEST-example.xml"));
      const missing = spawnSync(process.execPath, ["-e", script], {
        cwd: directory, env: { ...process.env, RUNNER_TEMP: directory }, encoding: "utf8",
      });
      assert.equal(missing.status, 0, missing.stderr);
      assert.match(missing.stdout, /Gradle failed before producing a JUnit failure report/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("both existing Spring failure diagnostic blocks are covered", () => {
  assert.equal(diagnostics.length, 2);
});
