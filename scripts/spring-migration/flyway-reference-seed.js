"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_SQL = path.join(REPOSITORY_ROOT, "backend-spring", "src", "main", "resources", "db", "migration", "V3__required_reference_data.sql");
const OUTPUT_MANIFEST = path.join(REPOSITORY_ROOT, "docs", "spring-migration", "flyway-reference-seed-manifest.json");
const SEED_LEDGER = path.join(REPOSITORY_ROOT, "docs", "spring-migration", "flyway-seed-ownership-ledger.json");
const SOURCE_SNAPSHOT = path.join(REPOSITORY_ROOT, "docs", "spring-migration", "flyway-required-reference-source.sql");
const SCHEMA_MANIFEST = path.join(REPOSITORY_ROOT, "docs", "spring-migration", "flyway-schema-metadata-manifest.json");
const FIXED_TIMESTAMP = "2026-01-01 00:00:00";
const ID_MAP_TABLE = "pg_temp.vibehr_reference_seed_ids";
const WELFARE_MENU_CODES = ["wel", "wel.requests", "wel.my-requests", "wel.benefit-types"];

// These fields deliberately mirror the Python bootstrap's existing-row assignments.
const TABLES = [
  config("auth_roles", ["code"]),
  config("org_departments", ["code"], ["name", "organization_type", "cost_center_code", "description", "is_active"], [foreign("parent_id", "org_departments")], true),
  config("org_corporations", ["enter_cd"], ["company_code", "corporation_name", "corporation_number", "business_number", "company_seal_url", "certificate_seal_url", "company_logo_url", "is_active"]),
  config("app_code_groups", ["code"], ["name", "description", "is_active", "sort_order"]),
  config("app_codes", ["group_id", "code"], ["name", "is_active", "sort_order"], [foreign("group_id", "app_code_groups")]),
  config("app_menus", ["code"], ["name", "parent_id", "path", "icon", "sort_order", "is_active"], [foreign("parent_id", "app_menus")], true),
  config("app_menu_roles", ["menu_id", "role_id"], [], [foreign("menu_id", "app_menus"), foreign("role_id", "auth_roles")]),
  config("app_menu_actions", ["menu_id", "action_code"], ["enabled_default"], [foreign("menu_id", "app_menus")]),
  config("app_system_settings", ["key"]),
  config("hr_retire_checklist_items", ["code"], ["title", "description", "is_required", "is_active", "sort_order"]),
  config("tim_attendance_codes", ["code"], ["name", "category", "sort_order"]),
  config("tim_work_schedule_codes", ["code"], ["name", "sort_order"]),
  config("tim_schedule_patterns", ["code"]),
  config("tim_schedule_pattern_days", ["pattern_id", "weekday"], [], [foreign("pattern_id", "tim_schedule_patterns")]),
  config("tim_department_schedule_assignments", ["department_id"], [], [foreign("department_id", "org_departments"), foreign("pattern_id", "tim_schedule_patterns")], false, 'target."is_active" = true'),
  config("tim_holidays", ["holiday_date"], ["name", "holiday_type"]),
  config("PAP_FINAL_RESULTS", ["result_code"], ["result_name", "score_grade", "is_active", "sort_order", "description"]),
  config("PAP_APPRAISAL_MASTERS", ["appraisal_year", "appraisal_code"], ["appraisal_name", "final_result_id", "appraisal_type", "start_date", "end_date", "is_active", "sort_order", "description"], [foreign("final_result_id", "PAP_FINAL_RESULTS")]),
  config("pay_payroll_codes", ["code"], ["name", "tax_deductible"]),
  config("pay_allowance_deductions", ["code"], ["name", "type", "tax_type", "calculation_type", "is_active", "sort_order"]),
  config("pay_item_groups", ["code"], ["name", "description", "is_active"]),
  config("gl_accounts", ["code"], ["name", "account_type", "is_net_pay_account", "is_active", "sort_order", "is_cash_account"]),
  config("pay_gl_mappings", ["pay_item_code", "effective_from"], ["gl_account_code", "is_active"]),
  config("pay_severance_item_rules", ["pay_item_code"], ["is_active"]),
  config("hri_form_types", ["form_code"], ["form_name_ko", "module_code", "is_active", "requires_receive", "default_priority"]),
  config("hri_form_type_policies", ["form_type_id", "policy_key", "effective_from"], ["policy_value"], [foreign("form_type_id", "hri_form_types")]),
  config("hri_approval_actor_rules", ["role_code"], ["resolve_method", "fallback_rule", "position_keywords_json", "is_active"]),
  config("hri_approval_line_templates", ["template_code"], ["template_name", "scope_type", "scope_id", "is_default", "is_active", "priority"]),
  config("hri_approval_line_steps", ["template_id", "step_order"], [], [foreign("template_id", "hri_approval_line_templates")]),
  config("hri_form_type_approval_maps", ["form_type_id", "template_id", "effective_from"], ["is_active"], [foreign("form_type_id", "hri_form_types"), foreign("template_id", "hri_approval_line_templates")]),
  config("pay_tax_rates", ["year", "rate_type"], ["employee_rate"]),
  config("pay_income_tax_brackets", ["year", "annual_taxable_from"], ["annual_taxable_to", "tax_rate", "quick_deduction"]),
  config("wel_benefit_types", ["code"], ["name", "module_path", "is_deduction", "pay_item_code", "is_active", "sort_order"]),
];

function config(table, naturalKey, updateColumns = [], foreignKeys = [], rowByRow = false, matchExtra = null) {
  return { table, naturalKey, updateColumns, foreignKeys, rowByRow, matchExtra };
}

function foreign(column, table) {
  return { column, table };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function quote(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function qualified(table) {
  return `public.${quote(table)}`;
}

function sqlStatements(source) {
  const statements = [];
  let start = 0;
  let quoteCharacter = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoteCharacter) {
      if (character === quoteCharacter) {
        if (quoteCharacter === "'" && source[index + 1] === "'") index += 1;
        else quoteCharacter = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quoteCharacter = character;
      continue;
    }
    if (character === ";") {
      statements.push(source.slice(start, index + 1));
      start = index + 1;
    }
  }
  return statements;
}

function splitValues(values) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quoteCharacter = null;
  for (let index = 0; index < values.length; index += 1) {
    const character = values[index];
    if (quoteCharacter) {
      if (character === quoteCharacter) {
        if (quoteCharacter === "'" && values[index + 1] === "'") index += 1;
        else quoteCharacter = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quoteCharacter = character;
    } else if (character === "(" || character === "[") {
      depth += 1;
    } else if (character === ")" || character === "]") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      result.push(values.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(values.slice(start).trim());
  return result;
}

function normalizeValue(value) {
  return value.replace(/'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d\d)?'/g, `'${FIXED_TIMESTAMP}'`);
}

function parseInsert(statement, metadata) {
  const insertOffset = statement.indexOf("INSERT INTO public.");
  if (insertOffset < 0) return null;
  const compact = statement.slice(insertOffset).trim();
  const match = compact.match(/^INSERT INTO public\.("[^"]+"|[^\s(]+) VALUES \((.*)\);$/s);
  if (!match) return null;
  const table = match[1].replace(/^"|"$/g, "");
  const schema = metadata.get(table);
  if (!schema) throw new Error(`Required-reference source contains an unregistered table: ${table}.`);
  const values = splitValues(match[2]).map(normalizeValue);
  if (values.length !== schema.columns.length) {
    throw new Error(`Source row for ${table} has ${values.length} values; schema requires ${schema.columns.length}.`);
  }
  return { table, values };
}

function loadMetadata() {
  const manifest = JSON.parse(fs.readFileSync(SCHEMA_MANIFEST, "utf8"));
  return new Map(manifest.metadata.tables.map((table) => [
    table.name,
    {
      columns: table.columns.map((column) => column.name),
      types: Object.fromEntries(table.columns.map((column) => [column.name, column.data_type])),
    },
  ]));
}

function value(columnIndex, column, row) {
  return row.values[columnIndex.get(column)];
}

function sourceRows(rawDump, metadata) {
  const rows = sqlStatements(rawDump).map((statement) => parseInsert(statement, metadata)).filter(Boolean);
  if (rows.length === 0) throw new Error("No required-reference INSERT statements were found in the PostgreSQL dump.");
  return rows;
}

function sourceForTable(rows, table) {
  return rows.filter((row) => row.table === table);
}

function seedCte(rows, columns, types) {
  const values = rows
    .map((row) => `    (${row.values.map((value, index) => `CAST(${value} AS ${types[columns[index]]})`).join(", ")})`)
    .join(",\n");
  return `WITH source_rows (${columns.map(quote).join(", ")}) AS (\n  VALUES\n${values}\n),\nresolved AS (\n`;
}

function resolvedSelect(configuration, columns) {
  const foreignByColumn = new Map(configuration.foreignKeys.map((entry) => [entry.column, entry]));
  const select = columns.map((column) => {
    const relation = foreignByColumn.get(column);
    return relation ? `    ${quote(`${relation.table}_ids`)}.actual_id AS ${quote(column)}` : `    source_rows.${quote(column)} AS ${quote(column)}`;
  });
  const joins = configuration.foreignKeys.map((relation) => `  LEFT JOIN ${ID_MAP_TABLE} AS ${quote(`${relation.table}_ids`)}\n    ON ${quote(`${relation.table}_ids`)}.source_table = '${relation.table}'\n   AND ${quote(`${relation.table}_ids`)}.source_id = source_rows.${quote(relation.column)}`);
  return `  SELECT ${select.join(",\n").trimStart()}\n  FROM source_rows${joins.length ? `\n${joins.join("\n")}` : ""}\n)`;
}

function matchPredicate(configuration, target = "target", source = "source") {
  const terms = configuration.naturalKey.map((column) => `${target}.${quote(column)} IS NOT DISTINCT FROM ${source}.${quote(column)}`);
  if (configuration.matchExtra) terms.push(configuration.matchExtra);
  return terms.join("\n  AND ");
}

function renderUpsert(configuration, rows, metadata) {
  const schema = metadata.get(configuration.table);
  const columns = schema.columns;
  const insertColumns = columns.filter((column) => column !== "id");
  const seed = seedCte(rows, columns, schema.types);
  const resolved = resolvedSelect(configuration, columns);
  const target = qualified(configuration.table);
  const update = configuration.updateColumns.length === 0
    ? ""
    : `${seed}${resolved}\nUPDATE ${target} AS target\nSET ${configuration.updateColumns.map((column) => `${quote(column)} = source.${quote(column)}`).join(", ")}\nFROM resolved AS source\nWHERE ${matchPredicate(configuration)};\n\n`;
  const insert = `${seed}${resolved}\nINSERT INTO ${target} (${insertColumns.map(quote).join(", ")})\nSELECT ${insertColumns.map((column) => `source.${quote(column)}`).join(", ")}\nFROM resolved AS source\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM ${target} AS target\n  WHERE ${matchPredicate(configuration)}\n);\n\n`;
  const mapping = columns.includes("id")
    ? `${seed}${resolved}\nINSERT INTO ${ID_MAP_TABLE} (source_table, source_id, actual_id)\nSELECT '${configuration.table}', source.${quote("id")}, target.${quote("id")}\nFROM resolved AS source\nJOIN ${target} AS target\n  ON ${matchPredicate(configuration)}\nON CONFLICT (source_table, source_id) DO UPDATE\nSET actual_id = EXCLUDED.actual_id;`
    : "";
  return `${update}${insert}${mapping}`;
}

function menuCodes(rows, metadata) {
  const columns = metadata.get("app_menus").columns;
  const indexes = new Map(columns.map((column, index) => [column, index]));
  return sourceForTable(rows, "app_menus").map((row) => value(indexes, "code", row)).filter(Boolean);
}

function emitStaleMenuRetirement(rows, metadata) {
  const codes = menuCodes(rows, metadata);
  return `-- Python ensure_menus retires stale menu definitions but preserves their rows.\nUPDATE ${qualified("app_menus")}\nSET ${quote("is_active")} = false\nWHERE ${quote("is_active")} = true\n  AND ${quote("code")} NOT IN (${codes.join(", ")});`;
}

function emitTemplateStepReplacement(rows, metadata) {
  const columns = metadata.get("hri_approval_line_templates").columns;
  const indexes = new Map(columns.map((column, index) => [column, index]));
  const codes = sourceForTable(rows, "hri_approval_line_templates").map((row) => value(indexes, "template_code", row));
  return `-- Python replaces steps only for canonical templates; noncanonical templates remain untouched.\nDELETE FROM ${qualified("hri_approval_line_steps")} AS step\nUSING ${qualified("hri_approval_line_templates")} AS template\nWHERE step.${quote("template_id")} = template.${quote("id")}\n  AND template.${quote("template_code")} IN (${codes.join(", ")});`;
}

function emitWelfareRoleReplacement(rows, metadata) {
  const menuColumns = metadata.get("app_menus").columns;
  const menuIndexes = new Map(menuColumns.map((column, index) => [column, index]));
  const menuIdsByCode = new Map(sourceForTable(rows, "app_menus").map((row) => [value(menuIndexes, "code", row), value(menuIndexes, "id", row)]));
  const roleColumns = metadata.get("app_menu_roles").columns;
  const roleIndexes = new Map(roleColumns.map((column, index) => [column, index]));
  const welfareIds = new Set(WELFARE_MENU_CODES.map((code) => menuIdsByCode.get(`'${code}'`)).filter(Boolean));
  const desired = sourceForTable(rows, "app_menu_roles")
    .filter((row) => welfareIds.has(value(roleIndexes, "menu_id", row)))
    .map((row) => `    (${value(roleIndexes, "menu_id", row)}, ${value(roleIndexes, "role_id", row)})`);
  if (desired.length === 0) throw new Error("Required welfare menu-role source rows are missing.");
  return `-- Python welfare overrides replace role links only for the four canonical welfare menus.\nWITH desired (menu_source_id, role_source_id) AS (\n  VALUES\n${desired.join(",\n")}\n),\nresolved AS (\n  SELECT menu_ids.actual_id AS menu_id, role_ids.actual_id AS role_id\n  FROM desired\n  JOIN ${ID_MAP_TABLE} AS menu_ids\n    ON menu_ids.source_table = 'app_menus' AND menu_ids.source_id = desired.menu_source_id\n  JOIN ${ID_MAP_TABLE} AS role_ids\n    ON role_ids.source_table = 'auth_roles' AND role_ids.source_id = desired.role_source_id\n)\nDELETE FROM ${qualified("app_menu_roles")} AS link\nUSING ${qualified("app_menus")} AS menu\nWHERE link.${quote("menu_id")} = menu.${quote("id")}\n  AND menu.${quote("code")} IN (${WELFARE_MENU_CODES.map((code) => `'${code}'`).join(", ")})\n  AND NOT EXISTS (\n    SELECT 1 FROM resolved\n    WHERE resolved.menu_id = link.${quote("menu_id")}\n      AND resolved.role_id = link.${quote("role_id")}\n  );`;
}

function emitSequenceAdvance(tables) {
  return [
    "-- Reference rows never reuse source primary keys; advance only sequences owned by an id column.",
    "DO $$",
    "DECLARE",
    "    target_table text;",
    "    sequence_name text;",
    "    max_id bigint;",
    `    target_tables text[] := ARRAY[${tables.map((table) => `'${table}'`).join(", ")}];`,
    "BEGIN",
    "    FOREACH target_table IN ARRAY target_tables LOOP",
    "        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = target_table AND column_name = 'id') THEN",
    "            SELECT pg_get_serial_sequence(format('public.%I', target_table), 'id') INTO sequence_name;",
    "            IF sequence_name IS NOT NULL THEN",
    "                EXECUTE format('SELECT max(id) FROM public.%I', target_table) INTO max_id;",
    "                PERFORM setval(sequence_name, GREATEST(COALESCE(max_id, 1), 1), true);",
    "            END IF;",
    "        END IF;",
    "    END LOOP;",
    "END $$;",
  ].join("\n");
}

function buildArtifact(rawDump) {
  const metadata = loadMetadata();
  const rows = sourceRows(rawDump, metadata);
  const configured = new Set(TABLES.map((configuration) => configuration.table));
  const sourceTables = [...new Set(rows.map((row) => row.table))];
  if (sourceTables.some((table) => !configured.has(table)) || TABLES.some((configuration) => !sourceTables.includes(configuration.table))) {
    throw new Error("Required-reference source and natural-key reconciliation configuration are out of sync.");
  }

  const statements = [
    "-- Generated from the classified Python bootstrap reference-data snapshot. Do not hand-edit.",
    "-- V3 reconciles canonical rows by Python natural keys and never overwrites noncanonical business rows.",
    "CREATE TEMP TABLE pg_temp.vibehr_reference_seed_ids (source_table text not null, source_id bigint not null, actual_id bigint not null, primary key (source_table, source_id)) ON COMMIT DROP;",
  ];
  for (const configuration of TABLES) {
    const tableRows = sourceForTable(rows, configuration.table);
    if (configuration.rowByRow) {
      for (const row of tableRows) statements.push(renderUpsert(configuration, [row], metadata));
    } else {
      statements.push(renderUpsert(configuration, tableRows, metadata));
    }
    if (configuration.table === "app_menus") statements.push(emitStaleMenuRetirement(rows, metadata));
    if (configuration.table === "app_menu_roles") statements.push(emitWelfareRoleReplacement(rows, metadata));
    if (configuration.table === "hri_approval_line_templates") statements.push(emitTemplateStepReplacement(rows, metadata));
  }
  statements.push(emitSequenceAdvance(sourceTables.sort()));
  const tables = sourceTables.sort();
  return { sql: `${statements.join("\n\n")}\n`, tables, rowCount: rows.length };
}

function manifest(sql, sourceDump, tables, rowCount) {
  const ledger = JSON.parse(fs.readFileSync(SEED_LEDGER, "utf8"));
  const requiredEntries = ledger.entries.filter((entry) => entry.category === "required-reference-permission-menu-data");
  if (requiredEntries.length === 0 || requiredEntries.some((entry) => entry.java_owner !== "Flyway V3__required_reference_data")) {
    throw new Error("Required reference ownership is not deterministically assigned to Flyway V3.");
  }
  return {
    schema_version: 2,
    source_bootstrap_sha256: ledger.source_sha256,
    source_dump_sha256: sha256(sourceDump),
    required_ledger_function_count: requiredEntries.length,
    fixed_timestamp: FIXED_TIMESTAMP,
    required_reference_table_count: tables.length,
    required_reference_row_count: rowCount,
    reconciliation: {
      strategy: "python-bootstrap-natural-key-upsert",
      stale_menu_retirement: true,
      table_natural_keys: Object.fromEntries(TABLES.map((configuration) => [configuration.table, configuration.naturalKey])),
    },
    tables,
    sql_sha256: sha256(sql),
  };
}

function verifyArtifact() {
  if (!fs.existsSync(OUTPUT_SQL) || !fs.existsSync(OUTPUT_MANIFEST) || !fs.existsSync(SOURCE_SNAPSHOT)) throw new Error("Missing generated required-reference Flyway artifacts or source snapshot.");
  const sourceDump = fs.readFileSync(SOURCE_SNAPSHOT, "utf8");
  const artifact = buildArtifact(sourceDump);
  const expectedManifest = manifest(artifact.sql, sourceDump, artifact.tables, artifact.rowCount);
  const currentManifest = JSON.parse(fs.readFileSync(OUTPUT_MANIFEST, "utf8"));
  const currentLedger = JSON.parse(fs.readFileSync(SEED_LEDGER, "utf8"));
  if (currentManifest.source_bootstrap_sha256 !== currentLedger.source_sha256) throw new Error("Bootstrap source drifted; regenerate and review the required-reference Flyway seed.");
  if (fs.readFileSync(OUTPUT_SQL, "utf8") !== artifact.sql) throw new Error("Required-reference Flyway SQL does not match the generated natural-key reconciliation artifact.");
  if (JSON.stringify(currentManifest) !== JSON.stringify(expectedManifest)) throw new Error("Required-reference Flyway manifest does not match the generated natural-key reconciliation artifact.");
  process.stdout.write(`Verified ${currentManifest.required_reference_row_count} required reference rows.\n`);
}

function writeAtomically(output, contents) {
  const temporary = path.join(path.dirname(output), `.${path.basename(output)}.${process.pid}.tmp`);
  fs.writeFileSync(temporary, contents, "utf8");
  fs.renameSync(temporary, output);
}

function main() {
  const verify = process.argv.includes("--verify");
  if (verify) return verifyArtifact();
  const inputIndex = process.argv.indexOf("--input");
  const input = inputIndex < 0 ? SOURCE_SNAPSHOT : path.resolve(process.argv[inputIndex + 1] || "");
  if (!input || !fs.existsSync(input)) throw new Error("Generation requires the checked-in required-reference source snapshot or --input <pg_dump data-only inserts file>.");
  const sourceDump = fs.readFileSync(input, "utf8");
  const artifact = buildArtifact(sourceDump);
  const outputManifest = manifest(artifact.sql, sourceDump, artifact.tables, artifact.rowCount);
  writeAtomically(OUTPUT_SQL, artifact.sql);
  writeAtomically(OUTPUT_MANIFEST, `${JSON.stringify(outputManifest, null, 2)}\n`);
  process.stdout.write(`Generated ${artifact.rowCount} source-reconciled required-reference rows for ${artifact.tables.length} tables.\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { buildArtifact, normalizeValue, parseInsert, splitValues, sqlStatements };
