"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { hasSnapshot, readHistoricalJson, verifySnapshot } = require("./retirement-snapshot");

const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");
const FROZEN_LEDGER_RELATIVE_PATH = "docs/spring-migration/flyway-seed-ownership-ledger.json";
const FROZEN_LEDGER_MARKDOWN_RELATIVE_PATH = "docs/spring-migration/flyway-seed-ownership-ledger.md";
const OUTPUT_JSON = path.join(REPOSITORY_ROOT, FROZEN_LEDGER_RELATIVE_PATH);
const OUTPUT_MD = path.join(REPOSITORY_ROOT, FROZEN_LEDGER_MARKDOWN_RELATIVE_PATH);
const CATEGORIES = new Set(["schema", "required-reference-permission-menu-data", "dev-fixture", "large-demo-fixture", "archive-or-retire"]);
const EXECUTIONS = new Set(["retire", "versioned", "explicit"]);
const FROZEN_COUNTS = Object.freeze({
  "archive-or-retire": 23,
  "dev-fixture": 4,
  "large-demo-fixture": 5,
  "required-reference-permission-menu-data": 33,
  schema: 1,
});
const FROZEN_EXECUTION_COUNTS = Object.freeze({ explicit: 9, retire: 24, versioned: 33 });
const FROZEN_SOURCE_FILE = "backend/app/bootstrap.py";
const FROZEN_SOURCE_FUNCTION_COUNT = 66;

const OWNERSHIP = {
  ensure_auth_user_login_id_schema: ["schema", "Flyway V1__alembic_head_baseline", "retire"],
  ensure_roles: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_departments: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_corporations: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_department: ["dev-fixture", "com.vibehr.seed.DevSeedRunner", "explicit"],
  ensure_user: ["dev-fixture", "com.vibehr.seed.DevSeedRunner", "explicit"],
  ensure_user_roles: ["dev-fixture", "com.vibehr.seed.DevSeedRunner", "explicit"],
  ensure_employee: ["dev-fixture", "com.vibehr.seed.DevSeedRunner", "explicit"],
  _build_korean_name: ["large-demo-fixture", "com.vibehr.seed.DemoSeedRunner", "explicit"],
  _build_dev_login_id: ["large-demo-fixture", "com.vibehr.seed.DemoSeedRunner", "explicit"],
  _build_position_title: ["large-demo-fixture", "com.vibehr.seed.DemoSeedRunner", "explicit"],
  _build_department_distribution: ["large-demo-fixture", "com.vibehr.seed.DemoSeedRunner", "explicit"],
  ensure_bulk_korean_employees: ["large-demo-fixture", "com.vibehr.seed.DemoSeedRunner", "explicit"],
  ensure_sample_records: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  _get_or_create_menu: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  _link_menu_roles: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_menus: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_menu_actions: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_system_settings: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_common_codes: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  _count_rows: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  _seed_record_date: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  _recent_business_days: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  _build_legacy_hr_basic_seed_fields: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  ensure_hr_basic_domain_migration: ["archive-or-retire", "retired after Alembic-to-Flyway cutover", "retire"],
  ensure_hr_basic_seed_data: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_hr_retire_checklist_seed: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_remove_legacy_appointment_records: ["archive-or-retire", "retired after Alembic-to-Flyway cutover", "retire"],
  ensure_hr_basic_category_mapping: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_attendance_codes: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_work_schedule_codes: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_schedule_foundations: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_holidays: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_annual_leave_seed: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_tim_transaction_samples: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_pap_final_results: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pap_appraisal_masters: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pay_payroll_codes: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pay_allowance_deductions: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pay_item_groups: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_gl_seeds: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_severance_item_rule_seeds: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pay_phase2_samples: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  _month_start_offset: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  _build_wel_benefit_request_seed_rows: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  ensure_payroll_detail_visual_samples: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_hri_form_types: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_hri_form_type_policies: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_hri_approval_actor_rules: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_hri_approval_templates: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_hri_form_type_template_maps: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_hr_recruitment_cycle_seed: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_org_mapping_type_group: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pay_welfare_allowance_definitions: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_schedule_operational_samples: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_payroll_run_result_samples: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  _serialize_seed_content: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  _upsert_hri_request_sample: ["archive-or-retire", "legacy transactional sample helper", "retire"],
  ensure_hri_request_samples: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_pay_tax_rates: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_pay_income_tax_brackets: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_wel_benefit_types: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_wel_benefit_requests: ["archive-or-retire", "legacy transactional sample data is not carried across the Java cutover", "retire"],
  ensure_welfare_menu_overrides: ["required-reference-permission-menu-data", "Flyway V3__required_reference_data", "versioned"],
  ensure_tra_seed_data: ["archive-or-retire", "legacy training sample data is not carried across the Java cutover", "retire"],
  seed_initial_data: ["archive-or-retire", "replaced by Flyway V3 plus explicit dev-seed and demo-seed profiles", "retire"],
};

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function sourceFunctions(source) {
  return [...source.matchAll(/^def\s+([A-Za-z_]\w*)\s*\(/gm)].map((match) => ({ name: match[1], line: source.slice(0, match.index).split("\n").length }));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function sourceFromOptions(options = {}) {
  const hasSource = hasOwn(options, "source");
  const hasSourcePath = hasOwn(options, "sourcePath");
  if (hasSource === hasSourcePath) {
    throw new Error("Source parser mode requires exactly one explicit source or sourcePath option.");
  }
  if (hasSource) {
    if (typeof options.source !== "string") throw new Error("Source parser mode requires source to be a string.");
    return { source: options.source, sourceFile: options.sourceFile || "<provided-source>" };
  }

  if (typeof options.sourcePath !== "string" || options.sourcePath.length === 0) {
    throw new Error("Source parser mode requires sourcePath to be a non-empty path.");
  }
  const sourcePath = path.resolve(options.sourcePath);
  const repositoryRoot = options.repositoryRoot || REPOSITORY_ROOT;
  const relative = path.relative(repositoryRoot, sourcePath).replace(/\\/g, "/");
  return {
    source: fs.readFileSync(sourcePath, "utf8"),
    sourceFile: options.sourceFile || (relative && !relative.startsWith("../") ? relative : sourcePath),
  };
}

function buildLedger(options = {}) {
  const { source, sourceFile } = sourceFromOptions(options);
  const functions = sourceFunctions(source);
  const functionNames = new Set(functions.map((entry) => entry.name));
  const duplicates = [...new Set(functions.map((entry) => entry.name).filter((name, index, names) => names.indexOf(name) !== index))]
    .filter((name) => hasOwn(OWNERSHIP, name));
  const missing = functions.filter((entry) => !OWNERSHIP[entry.name]).map((entry) => entry.name);
  const stale = Object.keys(OWNERSHIP).filter((name) => !functionNames.has(name));
  if (duplicates.length) throw new Error(`Duplicate bootstrap functions: ${duplicates.join(", ")}.`);
  if (missing.length || stale.length) throw new Error(`Unclassified bootstrap functions: ${missing.concat(stale).join(", ") || "none"}.`);
  const entries = functions.map((entry) => {
    const [category, javaOwner, execution] = OWNERSHIP[entry.name];
    if (!CATEGORIES.has(category) || !javaOwner || !execution) throw new Error(`Unsafe seed ownership for ${entry.name}.`);
    return { ...entry, category, java_owner: javaOwner, execution };
  });
  const counts = Object.fromEntries([...CATEGORIES].sort().map((category) => [category, entries.filter((entry) => entry.category === category).length]));
  return {
    schema_version: 1,
    source_file: sourceFile,
    source_sha256: sha256(source),
    source_function_count: entries.length,
    verification: { all_functions_classified: missing.length === 0 && stale.length === 0, deterministic_ownership: entries.every((entry) => entry.java_owner && entry.execution) },
    counts,
    entries,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function countBy(entries, property) {
  return Object.fromEntries([...new Set(entries.map((entry) => entry[property]))].sort().map((value) => [value, entries.filter((entry) => entry[property] === value).length]));
}

function hasExactCounts(actual, expected) {
  return hasExactKeys(actual, Object.keys(expected))
    && Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function verifyFrozenLedger(ledger) {
  const failures = [];
  if (!hasExactKeys(ledger, ["schema_version", "source_file", "source_sha256", "source_function_count", "verification", "counts", "entries"])) {
    return ["frozen seed ownership ledger has an unexpected top-level shape"];
  }
  if (ledger.schema_version !== 1) failures.push("frozen seed ownership ledger has an unsupported schema version");
  if (ledger.source_file !== FROZEN_SOURCE_FILE) failures.push("frozen seed ownership ledger has an unexpected source file");
  if (typeof ledger.source_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(ledger.source_sha256)) failures.push("frozen seed ownership ledger has an invalid source SHA-256");
  if (ledger.source_function_count !== FROZEN_SOURCE_FUNCTION_COUNT) failures.push(`frozen seed ownership ledger must contain ${FROZEN_SOURCE_FUNCTION_COUNT} source functions`);
  if (!hasExactKeys(ledger.verification, ["all_functions_classified", "deterministic_ownership"])
    || ledger.verification.all_functions_classified !== true
    || ledger.verification.deterministic_ownership !== true) {
    failures.push("frozen seed ownership ledger is not completely classified");
  }
  if (!hasExactCounts(ledger.counts, FROZEN_COUNTS)) failures.push("frozen seed ownership ledger category counts do not match the immutable contract");
  if (!Array.isArray(ledger.entries)) return [...failures, "frozen seed ownership ledger entries must be an array"];
  if (ledger.entries.length !== FROZEN_SOURCE_FUNCTION_COUNT) failures.push(`frozen seed ownership ledger entries must contain ${FROZEN_SOURCE_FUNCTION_COUNT} records`);

  const entriesByName = new Map();
  for (const entry of ledger.entries) {
    if (!hasExactKeys(entry, ["name", "line", "category", "java_owner", "execution"])) {
      failures.push("frozen seed ownership ledger has an entry with an unexpected shape");
      continue;
    }
    if (typeof entry.name !== "string" || !/^[A-Za-z_]\w*$/.test(entry.name)) failures.push("frozen seed ownership ledger has an invalid function name");
    if (!Number.isSafeInteger(entry.line) || entry.line < 1) failures.push(`frozen seed ownership ledger has an invalid source line for ${entry.name}`);
    if (!CATEGORIES.has(entry.category)) failures.push(`frozen seed ownership ledger has an invalid category for ${entry.name}`);
    if (!EXECUTIONS.has(entry.execution)) failures.push(`frozen seed ownership ledger has an invalid execution for ${entry.name}`);
    if (typeof entry.java_owner !== "string" || entry.java_owner.length === 0) failures.push(`frozen seed ownership ledger has an invalid Java owner for ${entry.name}`);
    if (entriesByName.has(entry.name)) failures.push(`frozen seed ownership ledger has a duplicate function: ${entry.name}`);
    else entriesByName.set(entry.name, entry);
  }

  for (const [name, expected] of Object.entries(OWNERSHIP)) {
    const entry = entriesByName.get(name);
    if (!entry) {
      failures.push(`frozen seed ownership ledger is missing function: ${name}`);
      continue;
    }
    const [category, javaOwner, execution] = expected;
    if (entry.category !== category || entry.java_owner !== javaOwner || entry.execution !== execution) {
      failures.push(`frozen seed ownership ledger ownership drifted for ${name}`);
    }
  }
  for (const name of entriesByName.keys()) {
    if (!OWNERSHIP[name]) failures.push(`frozen seed ownership ledger has an unclassified function: ${name}`);
  }
  if (!hasExactCounts(countBy(ledger.entries, "category"), FROZEN_COUNTS)) failures.push("frozen seed ownership ledger entry categories do not match the immutable contract");
  if (!hasExactCounts(countBy(ledger.entries, "execution"), FROZEN_EXECUTION_COUNTS)) failures.push("frozen seed ownership ledger execution counts do not match the immutable contract");
  return failures;
}

function verifyRetiredLedger(repositoryRoot = REPOSITORY_ROOT, options = {}) {
  const snapshotVerifier = options.verifySnapshot || verifySnapshot;
  const ledgerReader = options.readLedger || ((root) => readHistoricalJson(root, FROZEN_LEDGER_RELATIVE_PATH));
  const failures = [];
  try {
    const snapshot = snapshotVerifier(repositoryRoot);
    if (!snapshot || !Array.isArray(snapshot.failures)) failures.push("Python retirement snapshot verifier returned an invalid result");
    else failures.push(...snapshot.failures);
  } catch (error) {
    failures.push(`Python retirement snapshot verification failed: ${error.message}`);
  }

  let ledger;
  try {
    ledger = ledgerReader(repositoryRoot);
  } catch (error) {
    failures.push(`frozen seed ownership ledger cannot be read: ${error.message}`);
    return { ledger: null, failures };
  }
  failures.push(...verifyFrozenLedger(ledger));
  return { ledger, failures };
}

function markdown(ledger) {
  const lines = ["# Flyway Seed Ownership Ledger", "", `- Source: \`${ledger.source_file}\``, `- Source SHA-256: \`${ledger.source_sha256}\``, `- Classified functions: ${ledger.source_function_count}`, "", "| Function | Category | Java owner | Execution |", "| --- | --- | --- | --- |"];
  for (const entry of ledger.entries) lines.push(`| \`${entry.name}\` | ${entry.category} | \`${entry.java_owner}\` | ${entry.execution} |`);
  return `${lines.join("\n")}\n`;
}

function sourcePathFromArguments(argumentsList, repositoryRoot) {
  const sourceIndex = argumentsList.indexOf("--source");
  if (sourceIndex < 0) return null;
  const sourcePath = argumentsList[sourceIndex + 1];
  if (!sourcePath || sourcePath.startsWith("--")) throw new Error("Source parser mode requires --source <bootstrap.py>.");
  return path.resolve(repositoryRoot, sourcePath);
}

function main(argumentsList = process.argv.slice(2), repositoryRoot = REPOSITORY_ROOT) {
  const verify = argumentsList.includes("--verify");
  if (hasSnapshot(repositoryRoot)) {
    if (!verify) throw new Error("Python source is retired; frozen Flyway seed ownership evidence is verification-only. Use --verify.");
    const { ledger, failures } = verifyRetiredLedger(repositoryRoot);
    if (failures.length > 0) throw new Error(failures.join("; "));
    process.stdout.write(`Verified ${ledger.source_function_count} frozen bootstrap seed ownership records.\n`);
    return;
  }
  const sourcePath = sourcePathFromArguments(argumentsList, repositoryRoot);
  if (!sourcePath) throw new Error("Source parser mode requires --source <bootstrap.py>.");
  const ledger = buildLedger({ sourcePath, repositoryRoot });
  const json = `${JSON.stringify(ledger, null, 2)}\n`;
  const md = markdown(ledger);
  if (verify) {
    if (!fs.existsSync(OUTPUT_JSON) || !fs.existsSync(OUTPUT_MD)) throw new Error("Missing generated Flyway seed ownership ledger.");
    if (fs.readFileSync(OUTPUT_JSON, "utf8") !== json || fs.readFileSync(OUTPUT_MD, "utf8") !== md) throw new Error("Bootstrap seed ownership drifted; regenerate and review the Flyway seed ledger.");
    process.stdout.write(`Verified ${ledger.source_function_count} bootstrap seed ownership records.\n`);
    return;
  }
  fs.writeFileSync(OUTPUT_JSON, json, "utf8");
  fs.writeFileSync(OUTPUT_MD, md, "utf8");
  process.stdout.write(`Generated ${ledger.source_function_count} bootstrap seed ownership records.\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = {
  FROZEN_COUNTS,
  FROZEN_EXECUTION_COUNTS,
  FROZEN_LEDGER_RELATIVE_PATH,
  FROZEN_LEDGER_MARKDOWN_RELATIVE_PATH,
  FROZEN_SOURCE_FUNCTION_COUNT,
  OWNERSHIP,
  buildLedger,
  main,
  sourceFunctions,
  verifyFrozenLedger,
  verifyRetiredLedger,
};
