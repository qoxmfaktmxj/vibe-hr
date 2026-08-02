"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { hasSnapshot, readHistoricalJson, verifySnapshot } = require("./retirement-snapshot");

const EXPECTED_ALEMBIC_HEAD = "org_mapping_foundation_20260722";
const EXPECTED_APP_TABLE_COUNT = 105;
const NORMALIZATIONS = [
  {
    source: "DROP TABLE users;",
    canonical: "DROP TABLE IF EXISTS users;",
    reason: "The Alembic cleanup revision assumes the pre-Alembic legacy table exists; a Flyway clean install must reach the same final schema without that historical prerequisite.",
  },
  {
    source: "DROP INDEX ix_pap_appraisal_masters_appraisal_code;",
    canonical: "DROP INDEX IF EXISTS ix_pap_appraisal_masters_appraisal_code;",
    reason: "The baseline already uses the replacement quoted index name, so this historical cleanup drop is absent on a clean install.",
  },
  {
    source: "DROP INDEX ix_pap_appraisal_masters_appraisal_year;",
    canonical: "DROP INDEX IF EXISTS ix_pap_appraisal_masters_appraisal_year;",
    reason: "The baseline already uses the replacement quoted index name, so this historical cleanup drop is absent on a clean install.",
  },
  {
    source: "DROP INDEX ux_auth_users_login_id;",
    canonical: "DROP INDEX IF EXISTS ux_auth_users_login_id;",
    reason: "The obsolete duplicate unique index exists only on pre-baseline databases.",
  },
  {
    source: "CREATE INDEX \"ix_PAP_APPRAISAL_MASTERS_appraisal_code\" ON \"PAP_APPRAISAL_MASTERS\" (appraisal_code);",
    canonical: "CREATE INDEX IF NOT EXISTS \"ix_PAP_APPRAISAL_MASTERS_appraisal_code\" ON \"PAP_APPRAISAL_MASTERS\" (appraisal_code);",
    reason: "The baseline snapshot already owns this final index name.",
  },
  {
    source: "CREATE INDEX \"ix_PAP_APPRAISAL_MASTERS_appraisal_year\" ON \"PAP_APPRAISAL_MASTERS\" (appraisal_year);",
    canonical: "CREATE INDEX IF NOT EXISTS \"ix_PAP_APPRAISAL_MASTERS_appraisal_year\" ON \"PAP_APPRAISAL_MASTERS\" (appraisal_year);",
    reason: "The baseline snapshot already owns this final index name.",
  },
];
const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_SQL = path.join(
  REPOSITORY_ROOT,
  "backend-spring",
  "src",
  "main",
  "resources",
  "db",
  "migration",
  "V1__alembic_head_baseline.sql",
);
const OUTPUT_MANIFEST = path.join(
  REPOSITORY_ROOT,
  "docs",
  "spring-migration",
  "flyway-baseline-manifest.json",
);

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeOfflineSql(sql) {
  let normalized = sql.replace(/\r\n/g, "\n");
  normalized = normalized.replace(/^-- Running upgrade.*\n/gm, "");
  normalized = normalized.replace(/^\s*(?:BEGIN|COMMIT);\s*\n/gm, "");
  normalized = normalized.replace(/CREATE TABLE alembic_version\s*\([\s\S]*?\);\s*/m, "");
  normalized = normalized.replace(/(?:INSERT INTO|UPDATE) alembic_version[\s\S]*?;\s*/g, "");
  normalized = normalized.replace(/DROP TABLE users;/g, "DROP TABLE IF EXISTS users;");
  normalized = normalized.replace(/DROP INDEX ix_pap_appraisal_masters_appraisal_code;/g, "DROP INDEX IF EXISTS ix_pap_appraisal_masters_appraisal_code;");
  normalized = normalized.replace(/DROP INDEX ix_pap_appraisal_masters_appraisal_year;/g, "DROP INDEX IF EXISTS ix_pap_appraisal_masters_appraisal_year;");
  normalized = normalized.replace(/DROP INDEX ux_auth_users_login_id;/g, "DROP INDEX IF EXISTS ux_auth_users_login_id;");
  normalized = normalized.replace(/CREATE INDEX "ix_PAP_APPRAISAL_MASTERS_appraisal_code" ON "PAP_APPRAISAL_MASTERS" \(appraisal_code\);/g, "CREATE INDEX IF NOT EXISTS \"ix_PAP_APPRAISAL_MASTERS_appraisal_code\" ON \"PAP_APPRAISAL_MASTERS\" (appraisal_code);");
  normalized = normalized.replace(/CREATE INDEX "ix_PAP_APPRAISAL_MASTERS_appraisal_year" ON "PAP_APPRAISAL_MASTERS" \(appraisal_year\);/g, "CREATE INDEX IF NOT EXISTS \"ix_PAP_APPRAISAL_MASTERS_appraisal_year\" ON \"PAP_APPRAISAL_MASTERS\" (appraisal_year);");
  normalized = normalized.split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n");
  normalized = normalized.replace(/\n{3,}/g, "\n\n").trim();
  return `${normalized}\n`;
}

function tableNames(sql) {
  const names = [];
  const pattern = /^CREATE TABLE\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*\(/gm;
  let match;
  while ((match = pattern.exec(sql))) names.push(match[1] || match[2]);
  return names.sort((left, right) => left.localeCompare(right));
}

function capture() {
  throw new Error("Alembic capture is retired. Verify the immutable Python retirement snapshot instead.");
}

function writeFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, "utf8");
}

function verifyFile(file, expected) {
  if (!fs.existsSync(file)) throw new Error(`Missing generated artifact: ${path.relative(REPOSITORY_ROOT, file)}.`);
  const actual = fs.readFileSync(file, "utf8");
  if (actual !== expected) {
    throw new Error(`Alembic offline SQL drifted. Run node scripts/spring-migration/flyway-baseline.js and review ${path.relative(REPOSITORY_ROOT, file)}.`);
  }
}

function verifyRetiredBaseline(repositoryRoot = REPOSITORY_ROOT) {
  const snapshotResult = verifySnapshot(repositoryRoot);
  const failures = [...snapshotResult.failures];
  const manifest = readHistoricalJson(repositoryRoot, "docs/spring-migration/flyway-baseline-manifest.json");
  if (manifest.expected_alembic_head !== EXPECTED_ALEMBIC_HEAD) failures.push("frozen Alembic head does not match the required Flyway baseline head");
  if (manifest.expected_app_table_count !== EXPECTED_APP_TABLE_COUNT) failures.push("frozen Alembic table count does not match the required Flyway baseline table count");
  const revisions = (manifest.alembic_revisions || []).map((revision) => revision.revision);
  if (JSON.stringify(revisions) !== JSON.stringify(snapshotResult.snapshot?.alembic_lineage || [])) {
    failures.push("frozen Alembic revision lineage does not match the retirement snapshot");
  }
  const v1 = path.join(repositoryRoot, "backend-spring", "src", "main", "resources", "db", "migration", "V1__alembic_head_baseline.sql");
  if (fs.existsSync(v1) && sha256(fs.readFileSync(v1, "utf8")) !== manifest.canonical_sql_sha256) {
    failures.push("Flyway V1 checksum does not match the frozen Alembic baseline evidence");
  }
  return { failures, manifest };
}

function main() {
  const verify = process.argv.includes("--verify");
  if (hasSnapshot(REPOSITORY_ROOT)) {
    const { failures, manifest } = verifyRetiredBaseline();
    if (failures.length > 0) throw new Error(failures.join("; "));
    process.stdout.write(`Verified frozen Flyway V1 baseline against historical Alembic head ${EXPECTED_ALEMBIC_HEAD} (${manifest.canonical_sql_sha256}).\n`);
    return;
  }
  const { sql, manifest } = capture();
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  if (verify) {
    verifyFile(OUTPUT_SQL, sql);
    verifyFile(OUTPUT_MANIFEST, manifestJson);
    process.stdout.write(`Verified Flyway V1 against Alembic head ${EXPECTED_ALEMBIC_HEAD} (${manifest.canonical_sql_sha256}).\n`);
    return;
  }
  writeFile(OUTPUT_SQL, sql);
  writeFile(OUTPUT_MANIFEST, manifestJson);
  process.stdout.write(`Generated Flyway V1 and manifest for ${EXPECTED_ALEMBIC_HEAD}.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { EXPECTED_ALEMBIC_HEAD, EXPECTED_APP_TABLE_COUNT, normalizeOfflineSql, tableNames, capture, verifyRetiredBaseline };
