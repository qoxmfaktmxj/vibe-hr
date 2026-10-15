"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { IMMUTABLE_ARCHIVE_HEADER, verifyPythonRetirement } = require("./verify-python-retirement");

function write(root, relativePath, contents = "") {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function writeBinary(root, relativePath, contents) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

test("retirement verifier rejects executable Python files and invocations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "backend-spring/legacy.py", "print('retired')");
  write(root, ".claude/settings.local.json", '"Bash(python -m pytest)"');
  const result = verifyPythonRetirement(root);
  assert.equal(result.python_file_count, 1);
  assert.equal(result.active_python_invocation_count, 1);
});

test("retirement verifier scans root operational docs but permits only explicitly immutable archives", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "docs/spring-migration/endpoint-manifest.md", "historical python -m pytest");
  write(root, "TIM_PHASE3_TEST.md", "python -m pytest");
  const result = verifyPythonRetirement(root);
  assert.equal(result.python_file_count, 0);
  assert.equal(result.active_python_invocation_count, 1);
  assert.equal(result.invocations[0].path, "TIM_PHASE3_TEST.md");
});

test("retirement verifier permits the task ledger archive only with the exact immutable header", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "docs/TASK_LEDGER_ARCHIVE.md", `${IMMUTABLE_ARCHIVE_HEADER}\n\npython -m pytest`);
  write(root, "backend-spring/src/main/java/com/vibehr/migration/Example.java", "private static final String ALEMBIC_HEAD = \"x\";");
  write(root, "scripts/spring-migration/verify-python-retirement.js", "const parser = /|uvicorn/;");
  const result = verifyPythonRetirement(root);
  assert.equal(result.active_python_invocation_count, 0);
});

test("retirement verifier scans the active task ledger even when it misuses the archive marker", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "docs/TASK_LEDGER.md", `${IMMUTABLE_ARCHIVE_HEADER}\npython -m pytest`);
  write(root, "docs/TASK_LEDGER_ARCHIVE.md", `\n${IMMUTABLE_ARCHIVE_HEADER}\npython -m pytest`);
  write(root, ".env.deploy", "ALEMBIC_HEAD=legacy");
  const result = verifyPythonRetirement(root);
  assert.equal(result.active_python_invocation_count, 3);
  assert.deepEqual(result.invocations.map((item) => item.path), [
    ".env.deploy",
    "docs/TASK_LEDGER.md",
    "docs/TASK_LEDGER_ARCHIVE.md",
  ]);
});

test("retirement verifier ignores generated Gradle caches and binary artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "backend-spring/.gradle-cutover-fix/cache/legacy.py", "print('cache only')");
  writeBinary(root, "backend-spring/generated.jar", Buffer.from("python -m pytest\u0000binary"));
  write(root, "backend-spring/src/main/java/com/vibehr/App.java", "class App {}");

  const result = verifyPythonRetirement(root);

  assert.equal(result.python_file_count, 0);
  assert.equal(result.active_python_invocation_count, 0);
});

test("retirement verifier permits only the reviewed hosted UI gate support scripts and command", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "scripts/ci/require-ui-validation.py", "import json\n");
  write(root, "scripts/ci/test_require_ui_validation.py", "import unittest\n");
  const command = "PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v";
  write(root, "docs/UI_VALIDATION_CI.md", command);
  write(root, ".github/workflows/ui-validation.yml", "        run: " + command);
  write(root, ".github/workflows/deploy.yml", '        run: python3 scripts/ci/require-ui-validation.py --sha "$GITHUB_SHA" --wait-seconds 2100');

  const result = verifyPythonRetirement(root);

  assert.equal(result.python_file_count, 0);
  assert.equal(result.active_python_invocation_count, 0);
});

test("reviewed CI support does not allow extra Python files, changed commands or other document paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-python-retirement-"));
  write(root, "scripts/ci/unreviewed.py", "import json\n");
  write(root, "scripts/ci/require-ui-validation.py", "python -m uvicorn\n");
  write(root, "docs/UI_VALIDATION_CI.md", "PYTHONDONTWRITEBYTECODE=1 python3 -m pytest\n");
  write(root, "docs/OTHER.md", "PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v\n");
  write(root, ".github/workflows/ui-validation.yml", "        run: python3 -m uvicorn\n");
  write(root, ".github/workflows/deploy.yml", '        run: python3 scripts/ci/require-ui-validation.py --sha "$GITHUB_SHA" --wait-seconds 2100 && python3 -m uvicorn\n');

  const result = verifyPythonRetirement(root);

  assert.deepEqual(result.pythonFiles, ["scripts/ci/unreviewed.py"]);
  assert.deepEqual(result.invocations.map((item) => item.path), [
    ".github/workflows/deploy.yml", ".github/workflows/ui-validation.yml", "docs/OTHER.md", "docs/UI_VALIDATION_CI.md", "scripts/ci/require-ui-validation.py",
  ]);
});
