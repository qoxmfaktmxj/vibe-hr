"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const {
  FROZEN_LEDGER_RELATIVE_PATH,
  FROZEN_LEDGER_MARKDOWN_RELATIVE_PATH,
  OWNERSHIP,
  buildLedger,
  main,
  verifyRetiredLedger,
} = require("./flyway-seed-ledger");
const { SNAPSHOT_RELATIVE_PATH } = require("./retirement-snapshot");

const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");

function fixtureSource(excluded = []) {
  return Object.keys(OWNERSHIP)
    .filter((name) => !excluded.includes(name))
    .map((name) => `def ${name}():\n    pass\n`)
    .join("\n");
}

function temporarySource(source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-seed-ledger-source-"));
  const sourcePath = path.join(root, "bootstrap.py");
  fs.writeFileSync(sourcePath, source, "utf8");
  return { root, sourcePath };
}

function copyRetiredFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-seed-ledger-retired-"));
  const snapshot = JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, SNAPSHOT_RELATIVE_PATH), "utf8"));
  fs.mkdirSync(path.dirname(path.join(root, SNAPSHOT_RELATIVE_PATH)), { recursive: true });
  fs.writeFileSync(path.join(root, SNAPSHOT_RELATIVE_PATH), JSON.stringify(snapshot), "utf8");
  for (const artifact of snapshot.artifacts) {
    const source = path.join(REPOSITORY_ROOT, artifact.path);
    const target = path.join(root, artifact.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return root;
}

function captureStdout(action) {
  const output = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    output.push(String(chunk));
    return true;
  };
  try {
    action();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output.join("");
}

test("source parser requires an explicit fixture source and preserves complete classification", () => {
  assert.throws(() => buildLedger(), /requires exactly one explicit source or sourcePath option/);
  const { sourcePath } = temporarySource(fixtureSource());
  const ledger = buildLedger({ sourcePath, sourceFile: "fixture/bootstrap.py" });
  assert.strictEqual(ledger.source_file, "fixture/bootstrap.py");
  assert.strictEqual(ledger.source_function_count, 66);
  assert.strictEqual(ledger.verification.all_functions_classified, true);
  assert.strictEqual(ledger.verification.deterministic_ownership, true);
  assert.strictEqual(ledger.counts["dev-fixture"], 4);
  assert.strictEqual(ledger.counts["large-demo-fixture"], 5);
  assert.strictEqual(ledger.entries.filter((entry) => entry.category === "required-reference-permission-menu-data").length, 33);
});

test("source parser rejects unclassified and stale fixture functions", () => {
  assert.throws(
    () => buildLedger({ source: `${fixtureSource()}\ndef unexpected_seed():\n    pass\n` }),
    /unexpected_seed/,
  );
  assert.throws(
    () => buildLedger({ source: fixtureSource(["ensure_roles"]) }),
    /ensure_roles/,
  );
});

test("source parser rejects duplicate known function declarations", () => {
  assert.throws(
    () => buildLedger({ source: `${fixtureSource()}\ndef ensure_roles():\n    pass\n` }),
    /Duplicate bootstrap functions: ensure_roles/,
  );
});

test("retired CLI verifies immutable evidence without a Python source tree", () => {
  const root = copyRetiredFixture();
  assert.strictEqual(fs.existsSync(path.join(root, "backend", "app", "bootstrap.py")), false);
  const output = captureStdout(() => main(["--verify"], root));
  assert.match(output, /Verified 66 frozen bootstrap seed ownership records/);
});

test("retired verification rejects a missing frozen ledger", () => {
  const root = copyRetiredFixture();
  fs.rmSync(path.join(root, FROZEN_LEDGER_RELATIVE_PATH));
  const failures = verifyRetiredLedger(root).failures.join("\n");
  assert.match(failures, /retirement evidence artifact is missing/);
  assert.match(failures, /frozen seed ownership ledger cannot be read/);
});

test("retired verification rejects a frozen ledger tampered after the snapshot", () => {
  const root = copyRetiredFixture();
  fs.appendFileSync(path.join(root, FROZEN_LEDGER_RELATIVE_PATH), "\n");
  assert.match(verifyRetiredLedger(root).failures.join("\n"), /retirement evidence artifact checksum drifted/);
});

test("retired verification rejects a missing frozen Markdown ledger", () => {
  const root = copyRetiredFixture();
  fs.rmSync(path.join(root, FROZEN_LEDGER_MARKDOWN_RELATIVE_PATH));
  assert.match(verifyRetiredLedger(root).failures.join("\n"), /retirement evidence artifact is missing/);
});

test("retired verification rejects a frozen Markdown ledger tampered after the snapshot", () => {
  const root = copyRetiredFixture();
  fs.appendFileSync(path.join(root, FROZEN_LEDGER_MARKDOWN_RELATIVE_PATH), "\nTampered evidence.\n");
  assert.match(verifyRetiredLedger(root).failures.join("\n"), /retirement evidence artifact checksum drifted/);
});

test("retired verification enforces ownership and counts even when snapshot verification is stubbed", () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, FROZEN_LEDGER_RELATIVE_PATH), "utf8"));
  ledger.counts["required-reference-permission-menu-data"] = 32;
  ledger.entries[0].java_owner = "incorrect-owner";
  ledger.entries.pop();
  const failures = verifyRetiredLedger(REPOSITORY_ROOT, {
    verifySnapshot: () => ({ failures: [] }),
    readLedger: () => ledger,
  }).failures.join("\n");
  assert.match(failures, /category counts do not match/);
  assert.match(failures, /must contain 66 records/);
  assert.match(failures, /ownership drifted for ensure_auth_user_login_id_schema/);
  assert.match(failures, /missing function/);
});

test("retired verification rejects valid execution modes with drifted aggregate counts", () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, FROZEN_LEDGER_RELATIVE_PATH), "utf8"));
  const entry = ledger.entries.find((candidate) => candidate.name === "ensure_auth_user_login_id_schema");
  entry.execution = "versioned";
  const failures = verifyRetiredLedger(REPOSITORY_ROOT, {
    verifySnapshot: () => ({ failures: [] }),
    readLedger: () => ledger,
  }).failures.join("\n");
  assert.match(failures, /execution counts do not match/);
});
