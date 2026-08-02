#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");
const HISTORICAL_EVIDENCE = new Set([
  "docs/spring-migration/python-retirement-snapshot.json",
  "docs/spring-migration/endpoint-manifest.json",
  "docs/spring-migration/endpoint-manifest.md",
  "docs/spring-migration/mutation-ledger.json",
  "docs/spring-migration/mutation-ledger.md",
  "docs/spring-migration/mutation-decision-registry.json",
  "docs/spring-migration/schema-ledger.json",
  "docs/spring-migration/schema-ledger.md",
  "docs/spring-migration/schema-default-decision-registry.json",
  "docs/spring-migration/flyway-baseline-manifest.json",
  "docs/spring-migration/flyway-reference-seed-manifest.json",
  "docs/spring-migration/flyway-required-reference-source.sql",
  "docs/spring-migration/flyway-seed-ownership-ledger.json",
  "docs/spring-migration/flyway-seed-ownership-ledger.md",
]);
const IMMUTABLE_ARCHIVE_HEADER = "<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->";
const TASK_LEDGER_ARCHIVE = "docs/TASK_LEDGER_ARCHIVE.md";
const IMMUTABLE_ARCHIVE_FILES = new Set([
  "CPN_MODULE_PLAN.md",
  "HRI_REQUEST_MODULE_PLAN.md",
  "HRI_TEST_SCENARIO.md",
  "PAYROLL_TEST_GUIDE.md",
  "REFACTORING_PLAN.md",
  "TIM_MODULE_PLAN.md",
  "TIM_PHASE2_TEST.md",
  "TIM_PHASE3_PLAN.md",
  "TIM_PHASE3_TEST.md",
  "WELFARE_MODULE_PLAN.md",
  ".claude/plans/code-quality-improvements.md",
  "docs/design-docs/ALEMBIC_ADOPTION_PLAN.md",
  "docs/design-docs/HR_SEVERANCE_DESIGN.md",
  "docs/design-docs/PAY_VOUCHER_GL_DESIGN.md",
  "docs/ehr-modernization-cycle-audit-2026-03-13.md",
  "docs/evals/EVAL_SUMMARY.md",
  "docs/exec-plans/active/menu-action-permission-pilot-v0.1.md",
  "docs/hri-form-registry-phase1-draft.md",
  "docs/MIG-SSMS-TO-VIBE-HR.md",
  "docs/MNG-DB-TEST-PLAN.md",
  "docs/NON_SECURITY_IMPROVEMENT_PLAN.md",
  "docs/PAP_MODULE_RULES.md",
  "docs/perf-ux-improvement-plan.md",
  "docs/superpowers/plans/2026-07-22-grid-retirement-mutation-regression.md",
  "docs/superpowers/plans/2026-07-22-org-mapping-foundation.md",
  TASK_LEDGER_ARCHIVE,
  "docs/TRA_MODULE_PLAN.md",
  "docs/unified-application-approval-cross-check.md",
  "docs/vibe-hr-gap-matrix-execution-backlog.md",
  "docs/vibe-hr-modernization-gap-plan.md",
  "docs/wave1-appointment-event-dictionary.md",
  "docs/wave1-payroll-target-selection-design.md",
]);
const IGNORED_DIRECTORIES = new Set([".git", ".next", "build", "node_modules", "target"]);
const ACTIVE_ROOTS = [".claude", ".github", "scripts", "orchestration", "backend-spring", "frontend", "docs"];
const ACTIVE_FILE_NAMES = new Set(["Dockerfile", ".env.deploy", ".env.deploy.secret.example"]);
const ACTIVE_ROOT_DOCUMENT = /\.md$/i;
const INVOCATION_PATTERNS = [
  /(?:^|[|`>"'(\[])\s*(?:python|python3|py)(?:\.exe)?\s+(?:-m\s+[A-Za-z0-9_.-]+|[A-Za-z0-9_./\\-]+\.py)\b/im,
  /(?:^|[|`>"'(\[])\s*(?:pytest|uvicorn)\b/im,
  /(?:^|[|`>"'(\[])\s*alembic\s+(?:revision|upgrade|downgrade|current|history|stamp|check)\b/im,
  /(?:^|[|`>"'(\[])\s*(?:pip|pip3)\s+(?:install|uninstall|freeze)\b/im,
  /^\s*FROM\s+python(?::|\s|$)/im,
  /(?:apt(?:-get)?|apk)\s+(?:add|install)\b[^\n]*\bpython(?:3)?\b/im,
  /(?:^|\n)\s*(?:export\s+)?(?:PYTHON[A-Z0-9_]*|ALEMBIC[A-Z0-9_]*)\s*=/im,
];

function relative(root, file) { return path.relative(root, file).split(path.sep).join("/"); }
function isIgnoredDirectory(name) {
  return IGNORED_DIRECTORIES.has(name) || name.startsWith(".gradle");
}
function walk(root, directory = root, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && isIgnoredDirectory(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(root, file, files);
    else if (entry.isFile()) files.push(file);
  }
  return files;
}
function isTextFile(file) {
  return !fs.readFileSync(file).subarray(0, 8192).includes(0);
}
function scanPythonFiles(repositoryRoot = REPOSITORY_ROOT) {
  return walk(repositoryRoot).filter((file) => file.toLowerCase().endsWith(".py")).map((file) => relative(repositoryRoot, file)).sort();
}
function isImmutableHistoricalEvidence(repositoryRoot, file) {
  const filePath = relative(repositoryRoot, file);
  if (HISTORICAL_EVIDENCE.has(filePath)) return true;
  if (!IMMUTABLE_ARCHIVE_FILES.has(filePath)) return false;
  return fs.readFileSync(file, "utf8").startsWith(IMMUTABLE_ARCHIVE_HEADER);
}
function activeFiles(repositoryRoot = REPOSITORY_ROOT) {
  const files = [];
  for (const candidate of ACTIVE_ROOTS) {
    const root = path.join(repositoryRoot, candidate);
    if (fs.existsSync(root)) files.push(...walk(repositoryRoot, root));
  }
  for (const entry of fs.readdirSync(repositoryRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (ACTIVE_FILE_NAMES.has(entry.name) || ACTIVE_ROOT_DOCUMENT.test(entry.name) || /^docker-compose.*\.ya?ml$/i.test(entry.name)) {
      files.push(path.join(repositoryRoot, entry.name));
    }
  }
  return [...new Set(files)].filter((file) => {
    const filePath = relative(repositoryRoot, file);
    return !isImmutableHistoricalEvidence(repositoryRoot, file)
      && isTextFile(file)
      && !/\.test\.js$/i.test(filePath)
      && filePath !== "scripts/spring-migration/verify-python-retirement.js";
  }).sort();
}
function findActiveInvocations(repositoryRoot = REPOSITORY_ROOT) {
  const violations = [];
  for (const file of activeFiles(repositoryRoot)) {
    const contents = fs.readFileSync(file, "utf8");
    for (const pattern of INVOCATION_PATTERNS) {
      const match = pattern.exec(contents);
      if (match) violations.push({ path: relative(repositoryRoot, file), match: match[0].trim() });
    }
  }
  return violations;
}
function verifyPythonRetirement(repositoryRoot = REPOSITORY_ROOT) {
  const pythonFiles = scanPythonFiles(repositoryRoot);
  const invocations = findActiveInvocations(repositoryRoot);
  return {
    python_file_count: pythonFiles.length,
    active_python_invocation_count: invocations.length,
    active_files_scanned: activeFiles(repositoryRoot).length,
    pythonFiles,
    invocations,
  };
}
function main() {
  const result = verifyPythonRetirement();
  process.stdout.write(`Python retirement: ${result.python_file_count} .py files, ${result.active_python_invocation_count} active Python invocations across ${result.active_files_scanned} active files.\n`);
  if (result.pythonFiles.length) process.stderr.write(`Python files: ${result.pythonFiles.join(", ")}\n`);
  if (result.invocations.length) process.stderr.write(`Python invocations: ${result.invocations.map((item) => `${item.path}: ${item.match}`).join("; ")}\n`);
  if (result.python_file_count || result.active_python_invocation_count) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { ACTIVE_FILE_NAMES, ACTIVE_ROOTS, HISTORICAL_EVIDENCE, IMMUTABLE_ARCHIVE_FILES, IMMUTABLE_ARCHIVE_HEADER, activeFiles, findActiveInvocations, isImmutableHistoricalEvidence, scanPythonFiles, verifyPythonRetirement };
