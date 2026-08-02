"use strict";

const fs = require("fs");
const path = require("path");
const { hasSnapshot, readHistoricalJson, verifySnapshot } = require("./retirement-snapshot");

const EXPECTED_TABLE_COUNT = 105;
const DEFAULT_DECISION_REGISTRY_PATH = "docs/spring-migration/schema-default-decision-registry.json";
const SUPPORTED_DEFAULT_BEHAVIORS = new Set([
  "service_instant_now",
  "service_kst_local_date_now",
  "service_empty_json_object",
  "database_flyway_default",
  "explicit_request_default",
  "retired",
]);
const SUPPORTED_FLYWAY_STRATEGIES = new Set(["application_service", "database_default", "retired"]);
const PLACEHOLDER_PATTERN = /^(?:unassigned|tbd|todo|placeholder|n\/a|fill(?:\s|-)?me|unknown)$/i;
const TAUTOLOGICAL_DETAIL_PATTERN = /^(?:(?:the|this) )?(?:default|behavior|decision).{0,160}\b(?:is|equals|remains)\s+[`"']?[a-z_]+[`"']?\.?$/i;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function defaultFactoryKey(table, column) {
  return `${table.table_name}.${column.name} @ ${column.source_file}:${column.source_line}`;
}

function isPlaceholder(value) {
  return typeof value === "string" && (!value.trim() || PLACEHOLDER_PATTERN.test(value.trim()));
}

function hasPlaceholder(value) {
  if (isPlaceholder(value)) return true;
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(hasPlaceholder);
  return false;
}

function nonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function malformedDefaultDecisionEntry(decision, index) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return `registry default decision at index ${index} must be an object`;
  }
  if (!Object.prototype.hasOwnProperty.call(decision, "default_factory_key")) {
    return `registry default decision at index ${index} is missing default_factory_key`;
  }
  if (typeof decision.default_factory_key !== "string") {
    return `registry default decision at index ${index} has a non-string default_factory_key`;
  }
  if (!decision.default_factory_key.trim()) {
    return `registry default decision at index ${index} has a blank default_factory_key`;
  }
  return null;
}

function readDefaultDecisionRegistry(repositoryRoot, registryPath = DEFAULT_DECISION_REGISTRY_PATH) {
  const absolutePath = path.join(repositoryRoot, registryPath);
  if (!fs.existsSync(absolutePath)) return { path: registryPath, exists: false, decisions: [] };
  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const decisionsAreArray = Array.isArray(parsed.decisions);
  return {
    ...parsed,
    path: registryPath,
    exists: true,
    decisions: decisionsAreArray ? parsed.decisions : [],
    registry_structure_errors: decisionsAreArray ? [] : ["registry decisions must be an array"],
  };
}

function indexDefaultDecisionRegistry(decisions) {
  const byKey = new Map();
  const duplicateKeys = [];
  const malformedEntries = [];
  for (const [index, decision] of decisions.entries()) {
    const malformed = malformedDefaultDecisionEntry(decision, index);
    if (malformed) {
      malformedEntries.push(malformed);
      continue;
    }
    if (byKey.has(decision.default_factory_key)) duplicateKeys.push(decision.default_factory_key);
    else byKey.set(decision.default_factory_key, decision);
  }
  return {
    byKey,
    duplicateKeys: [...new Set(duplicateKeys)].sort(compareText),
    malformedEntries,
  };
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function listFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => compareText(left.name, right.name))) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(entryPath, predicate));
    else if (predicate(entryPath)) files.push(entryPath);
  }
  return files;
}

// SQLModel and Alembic declarations are Python, so this scanner only needs to
// understand delimiter and string boundaries; it never executes Python.
function findClosingParen(source, openOffset) {
  let depth = 0;
  for (let index = openOffset; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" || char === '"') {
      const triple = source.slice(index, index + 3) === char.repeat(3);
      const end = triple ? char.repeat(3) : char;
      index += triple ? 3 : 1;
      while (index < source.length) {
        if (!triple && source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source.slice(index, index + end.length) === end) {
          index += end.length - 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevel(source) {
  const values = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" || char === '"') {
      const triple = source.slice(index, index + 3) === char.repeat(3);
      const end = triple ? char.repeat(3) : char;
      index += triple ? 3 : 1;
      while (index < source.length) {
        if (!triple && source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source.slice(index, index + end.length) === end) {
          index += end.length - 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    if ("([{\"".includes(char)) depth += 1;
    if (")] }".replace(" ", "").includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      values.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const finalValue = source.slice(start).trim();
  if (finalValue) values.push(finalValue);
  return values;
}

function stringLiteral(value) {
  const match = value && value.trim().match(/^(['"])([\s\S]*)\1$/);
  return match ? match[2] : null;
}

function firstString(value) {
  const direct = stringLiteral(value);
  if (direct !== null) return direct;
  const match = value && value.match(/(?:op\.f\()?(['"])(.*?)\1\)?/);
  return match ? match[2] : null;
}

function stringLiterals(value) {
  const values = [];
  const pattern = /(['"])(.*?)\1/g;
  let match;
  while ((match = pattern.exec(value))) values.push(match[2]);
  return values;
}

function namedArgument(argumentsSource, name) {
  const match = splitTopLevel(argumentsSource).find((argument) => argument.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1).trim() : null;
}

function boolArgument(argumentsSource, name) {
  const value = namedArgument(argumentsSource, name);
  return value === "True" ? true : value === "False" ? false : null;
}

function callOccurrences(source, callee) {
  const pattern = new RegExp(`\\b${callee.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*\\(`, "g");
  const calls = [];
  let match;
  while ((match = pattern.exec(source))) {
    const openOffset = source.indexOf("(", match.index);
    const closeOffset = findClosingParen(source, openOffset);
    if (closeOffset < 0) continue;
    calls.push({
      offset: match.index,
      line: lineAt(source, match.index),
      arguments_source: source.slice(openOffset + 1, closeOffset),
      source: source.slice(match.index, closeOffset + 1),
    });
    pattern.lastIndex = closeOffset + 1;
  }
  return calls;
}

function typeClues(typeSource) {
  if (!typeSource) return { value: null, precision: null, scale: null };
  const value = typeSource.trim().replace(/^sa\./, "");
  const positional = value.match(/(?:Numeric|DECIMAL|Decimal)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  const namedPrecision = value.match(/precision\s*=\s*(\d+)/i);
  const namedScale = value.match(/scale\s*=\s*(\d+)/i);
  return {
    value,
    precision: positional ? Number(positional[1]) : namedPrecision ? Number(namedPrecision[1]) : null,
    scale: positional ? Number(positional[2]) : namedScale ? Number(namedScale[1]) : null,
  };
}

function parseColumnCall(call, source, sourceFile, revision) {
  const argumentsList = splitTopLevel(call.arguments_source);
  const name = firstString(argumentsList[0]);
  const type = typeClues(argumentsList[1]);
  const nullable = boolArgument(call.arguments_source, "nullable");
  const foreignKeys = callOccurrences(call.arguments_source, "ForeignKey").map((foreignKey) => {
    const foreignKeyArguments = splitTopLevel(foreignKey.arguments_source);
    return {
      target: firstString(foreignKeyArguments[0]),
      name: firstString(namedArgument(foreignKey.arguments_source, "name")),
      ondelete: firstString(namedArgument(foreignKey.arguments_source, "ondelete")),
      source: "migration ForeignKey",
    };
  }).filter((foreignKey) => foreignKey.target);
  return {
    name,
    sqlalchemy_type: type.value,
    nullable,
    server_default: namedArgument(call.arguments_source, "server_default"),
    primary_key: boolArgument(call.arguments_source, "primary_key"),
    foreign_keys: foreignKeys,
    precision: type.precision,
    scale: type.scale,
    source_file: sourceFile,
    source_line: lineAt(source, call.offset),
    revision,
  };
}

function parseModelColumns(classSource, classLine, sourceFile) {
  const columns = [];
  const lines = classSource.split("\n");
  let offset = 0;
  for (const line of lines) {
    const match = line.match(/^ {4}([A-Za-z_]\w*)\s*:\s*([^=:#]+?)(?:\s*=\s*(.*?))?\s*(?:#.*)?\r?$/);
    const lineOffset = offset;
    offset += line.length + 1;
    if (!match || match[1].startsWith("__")) continue;
    const [, name, pythonTypeRaw, rhsRaw] = match;
    const pythonType = pythonTypeRaw.trim();
    const rhs = (rhsRaw || "").trim();
    let fieldArguments = "";
    let statementEnd = lineOffset + line.length;
    const fieldStart = rhs.match(/^Field\s*\(/);
    if (fieldStart) {
      const openOffset = classSource.indexOf("(", lineOffset + line.indexOf("Field"));
      const closeOffset = findClosingParen(classSource, openOffset);
      if (closeOffset >= 0) {
        fieldArguments = classSource.slice(openOffset + 1, closeOffset);
        statementEnd = closeOffset;
      }
    }
    const explicitTypeCall = callOccurrences(fieldArguments, "Column")[0];
    const explicitTypeArguments = explicitTypeCall ? splitTopLevel(explicitTypeCall.arguments_source) : [];
    const explicitType = typeClues(explicitTypeArguments[0]);
    const explicitNullable = boolArgument(fieldArguments, "nullable");
    const optional = /(?:^|\b)(?:Optional\s*\[|None\s*\|)/.test(pythonType);
    const defaultValue = fieldArguments ? namedArgument(fieldArguments, "default") : null;
    const defaultFactory = fieldArguments ? namedArgument(fieldArguments, "default_factory") : null;
    const rawDefault = !fieldArguments && rhs ? rhs : null;
    const directForeignKey = firstString(namedArgument(fieldArguments, "foreign_key"));
    const columnForeignKeys = explicitTypeCall ? callOccurrences(explicitTypeCall.arguments_source, "ForeignKey") : [];
    const foreignKeys = [
      ...(directForeignKey ? [{ target: directForeignKey, name: null, ondelete: null, source: "model Field.foreign_key" }] : []),
      ...columnForeignKeys.map((foreignKey) => {
        const args = splitTopLevel(foreignKey.arguments_source);
        return {
          target: firstString(args[0]),
          name: firstString(namedArgument(foreignKey.arguments_source, "name")),
          ondelete: firstString(namedArgument(foreignKey.arguments_source, "ondelete")),
          source: "model sa_column ForeignKey",
        };
      }).filter((foreignKey) => foreignKey.target),
    ];
    const primaryKey = boolArgument(fieldArguments, "primary_key");
    const columnPrimaryKey = explicitTypeCall ? boolArgument(explicitTypeCall.arguments_source, "primary_key") : null;
    const columnNullable = explicitTypeCall ? boolArgument(explicitTypeCall.arguments_source, "nullable") : null;
    const serverDefault = explicitTypeCall ? namedArgument(explicitTypeCall.arguments_source, "server_default") : null;
    columns.push({
      name,
      source_file: sourceFile,
      source_line: classLine + lineAt(classSource, lineOffset) - 1,
      python_type: pythonType,
      sqlalchemy_type: { value: explicitType.value, source: explicitType.value ? "model sa_column" : null },
      nullable: {
        value: columnNullable === null ? explicitNullable : columnNullable,
        source: columnNullable !== null ? "model sa_column" : explicitNullable !== null ? "model Field" : optional ? "python Optional inference" : "unresolved",
      },
      default: {
        value: defaultFactory || defaultValue || rawDefault,
        kind: defaultFactory ? "default_factory" : defaultValue ? "default" : rawDefault ? "assignment" : "not_declared",
        server_default: serverDefault,
      },
      primary_key: primaryKey === null ? columnPrimaryKey === true : primaryKey === true || columnPrimaryKey === true,
      foreign_keys: foreignKeys,
      precision: explicitType.precision,
      scale: explicitType.scale,
      index: boolArgument(fieldArguments, "index") === true,
      unique: boolArgument(fieldArguments, "unique") === true,
      max_length: (() => {
        const value = namedArgument(fieldArguments, "max_length");
        return value && /^\d+$/.test(value) ? Number(value) : null;
      })(),
      model_statement: classSource.slice(lineOffset, statementEnd + 1).trim(),
    });
  }
  return columns;
}

function constraintsFromModel(classSource, sourceFile, classLine, columns) {
  const indexes = [];
  const uniqueConstraints = [];
  const checkConstraints = [];
  const sequences = [];
  for (const call of callOccurrences(classSource, "Index")) {
    const argumentsList = splitTopLevel(call.arguments_source);
    const values = stringLiterals(argumentsList.slice(1).join(","));
    indexes.push({
      name: firstString(argumentsList[0]),
      columns: values,
      unique: boolArgument(call.arguments_source, "unique") === true,
      source_file: sourceFile,
      source_line: classLine + lineAt(classSource, call.offset) - 1,
      source: "model Index",
    });
  }
  for (const column of columns.filter((item) => item.index)) {
    indexes.push({ name: null, columns: [column.name], unique: column.unique, source_file: sourceFile, source_line: column.source_line, source: "model Field.index" });
  }
  for (const call of callOccurrences(classSource, "UniqueConstraint")) {
    const argumentsList = splitTopLevel(call.arguments_source);
    uniqueConstraints.push({
      name: firstString(namedArgument(call.arguments_source, "name")),
      columns: stringLiterals(argumentsList.filter((argument) => !argument.startsWith("name=")).join(",")),
      source_file: sourceFile,
      source_line: classLine + lineAt(classSource, call.offset) - 1,
      source: "model UniqueConstraint",
    });
  }
  for (const column of columns.filter((item) => item.unique)) {
    uniqueConstraints.push({ name: null, columns: [column.name], source_file: sourceFile, source_line: column.source_line, source: "model Field.unique" });
  }
  for (const call of callOccurrences(classSource, "CheckConstraint")) {
    const argumentsList = splitTopLevel(call.arguments_source);
    checkConstraints.push({
      name: firstString(namedArgument(call.arguments_source, "name")),
      expression: firstString(argumentsList[0]),
      source_file: sourceFile,
      source_line: classLine + lineAt(classSource, call.offset) - 1,
      source: "model CheckConstraint",
    });
  }
  for (const call of callOccurrences(classSource, "Sequence")) {
    const argumentsList = splitTopLevel(call.arguments_source);
    sequences.push({ name: firstString(argumentsList[0]), source_file: sourceFile, source_line: classLine + lineAt(classSource, call.offset) - 1, source: "model Sequence" });
  }
  for (const call of callOccurrences(classSource, "ForeignKeyConstraint")) {
    const argumentsList = splitTopLevel(call.arguments_source);
    const localColumns = stringLiterals(argumentsList[0] || "");
    const remoteColumns = stringLiterals(argumentsList[1] || "");
    localColumns.forEach((columnName, index) => {
      const column = columns.find((item) => item.name === columnName);
      if (column && remoteColumns[index]) {
        column.foreign_keys.push({
          target: remoteColumns[index],
          name: firstString(namedArgument(call.arguments_source, "name")),
          ondelete: firstString(namedArgument(call.arguments_source, "ondelete")),
          source: "model ForeignKeyConstraint",
        });
      }
    });
  }
  return { indexes, uniqueConstraints, checkConstraints, sequences };
}

function parseModelFile(source, sourceFile) {
  const tables = [];
  const tablePattern = /^class\s+([A-Za-z_]\w*)\s*\(\s*SQLModel\s*,\s*table\s*=\s*True\s*\)\s*:/gm;
  let match;
  while ((match = tablePattern.exec(source))) {
    const nextClassPattern = /^class\s+/gm;
    nextClassPattern.lastIndex = tablePattern.lastIndex;
    const nextClass = nextClassPattern.exec(source);
    const classEnd = nextClass ? nextClass.index : source.length;
    const classSource = source.slice(match.index, classEnd);
    const tableNameMatch = classSource.match(/^ {4}__tablename__\s*=\s*(['"])(.*?)\1/m);
    const classLine = lineAt(source, match.index);
    const columns = parseModelColumns(classSource, classLine, sourceFile);
    const constraints = constraintsFromModel(classSource, sourceFile, classLine, columns);
    tables.push({
      class_name: match[1],
      source_file: sourceFile,
      source_line: classLine,
      table_name: tableNameMatch ? tableNameMatch[2] : null,
      columns,
      indexes: constraints.indexes,
      unique_constraints: constraints.uniqueConstraints,
      check_constraints: constraints.checkConstraints,
      sequences: constraints.sequences,
    });
  }
  return tables;
}

function parseMigrations(repositoryRoot) {
  const migrationRoot = path.join(repositoryRoot, "backend", "migrations", "versions");
  const records = new Map();
  const migrationFiles = [];
  for (const filePath of listFiles(migrationRoot, (candidate) => candidate.endsWith(".py"))) {
    const source = fs.readFileSync(filePath, "utf8");
    const sourceFile = toPosix(path.relative(repositoryRoot, filePath));
    const revisionMatch = source.match(/^revision(?:\s*:\s*[^=]+)?\s*=\s*(['"])(.*?)\1/m);
    const revision = revisionMatch ? revisionMatch[2] : null;
    migrationFiles.push({ source_file: sourceFile, revision });
    const ensure = (tableName) => {
      if (!records.has(tableName)) records.set(tableName, { columns: new Map(), indexes: [], unique_constraints: [], check_constraints: [], sequences: [], evidence: [] });
      return records.get(tableName);
    };
    for (const call of callOccurrences(source, "op.create_table")) {
      const argumentsList = splitTopLevel(call.arguments_source);
      const tableName = firstString(argumentsList[0]);
      if (!tableName) continue;
      const table = ensure(tableName);
      table.evidence.push({ revision, source_file: sourceFile, source_line: call.line, operation: "create_table" });
      for (const columnCall of callOccurrences(call.arguments_source, "sa.Column")) {
        const column = parseColumnCall(columnCall, call.arguments_source, sourceFile, revision);
        if (column.name) table.columns.set(column.name, column);
      }
      for (const primaryKey of callOccurrences(call.arguments_source, "sa.PrimaryKeyConstraint")) {
        for (const columnName of stringLiterals(primaryKey.arguments_source)) {
          const column = table.columns.get(columnName);
          if (column) column.primary_key = true;
        }
      }
      for (const constraint of callOccurrences(call.arguments_source, "sa.UniqueConstraint")) {
        const argumentsForConstraint = splitTopLevel(constraint.arguments_source);
        table.unique_constraints.push({ name: firstString(namedArgument(constraint.arguments_source, "name")), columns: stringLiterals(argumentsForConstraint.filter((argument) => !argument.startsWith("name=")).join(",")), source_file: sourceFile, source_line: call.line, source: "migration create_table UniqueConstraint", revision });
      }
      for (const constraint of callOccurrences(call.arguments_source, "sa.CheckConstraint")) {
        const argumentsForConstraint = splitTopLevel(constraint.arguments_source);
        table.check_constraints.push({ name: firstString(namedArgument(constraint.arguments_source, "name")), expression: firstString(argumentsForConstraint[0]), source_file: sourceFile, source_line: call.line, source: "migration create_table CheckConstraint", revision });
      }
    }
    for (const call of callOccurrences(source, "op.add_column")) {
      const argumentsList = splitTopLevel(call.arguments_source);
      const tableName = firstString(argumentsList[0]);
      const columnCall = callOccurrences(call.arguments_source, "sa.Column")[0];
      if (!tableName || !columnCall) continue;
      const table = ensure(tableName);
      const column = parseColumnCall(columnCall, call.arguments_source, sourceFile, revision);
      if (column.name) table.columns.set(column.name, column);
      table.evidence.push({ revision, source_file: sourceFile, source_line: call.line, operation: "add_column" });
    }
    for (const call of callOccurrences(source, "op.create_index")) {
      const argumentsList = splitTopLevel(call.arguments_source);
      const tableName = firstString(argumentsList[1]);
      if (!tableName) continue;
      const table = ensure(tableName);
      table.indexes.push({ name: firstString(argumentsList[0]), columns: stringLiterals(argumentsList[2] || ""), unique: boolArgument(call.arguments_source, "unique") === true, source_file: sourceFile, source_line: call.line, source: "migration create_index", revision });
      table.evidence.push({ revision, source_file: sourceFile, source_line: call.line, operation: "create_index" });
    }
    for (const call of callOccurrences(source, "op.create_unique_constraint")) {
      const argumentsList = splitTopLevel(call.arguments_source);
      const tableName = firstString(argumentsList[1]);
      if (!tableName) continue;
      const table = ensure(tableName);
      table.unique_constraints.push({ name: firstString(argumentsList[0]), columns: stringLiterals(argumentsList[2] || ""), source_file: sourceFile, source_line: call.line, source: "migration create_unique_constraint", revision });
    }
    for (const call of callOccurrences(source, "op.create_check_constraint")) {
      const argumentsList = splitTopLevel(call.arguments_source);
      const tableName = firstString(argumentsList[1]);
      if (!tableName) continue;
      const table = ensure(tableName);
      table.check_constraints.push({ name: firstString(argumentsList[0]), expression: firstString(argumentsList[2]), source_file: sourceFile, source_line: call.line, source: "migration create_check_constraint", revision });
    }
    for (const call of callOccurrences(source, "op.create_sequence")) {
      const argumentsList = splitTopLevel(call.arguments_source);
      const tableName = firstString(namedArgument(call.arguments_source, "table_name"));
      if (!tableName) continue;
      const table = ensure(tableName);
      table.sequences.push({ name: firstString(argumentsList[0]), source_file: sourceFile, source_line: call.line, source: "migration create_sequence", revision });
    }
  }
  return { migration_files: migrationFiles, records };
}

function sameConstraintShape(left, right) {
  return JSON.stringify([left.columns || [], left.expression || null, left.unique === true]) === JSON.stringify([right.columns || [], right.expression || null, right.unique === true]);
}

function mergeSchemaObjects(records) {
  const merged = [];
  for (const record of records) {
    const candidate = merged.find((existing) => (
      (record.name && existing.name === record.name)
      || ((!record.name || !existing.name) && sameConstraintShape(existing, record))
    ));
    const evidence = { source_file: record.source_file, source_line: record.source_line, source: record.source, revision: record.revision || null };
    if (!candidate) {
      merged.push({ ...record, evidence: [evidence] });
      continue;
    }
    if (!candidate.name && record.name) candidate.name = record.name;
    if (!candidate.evidence.some((item) => JSON.stringify(item) === JSON.stringify(evidence))) candidate.evidence.push(evidence);
  }
  return merged;
}

function applyMigrationMetadata(table, migrationRecord) {
  if (!migrationRecord) {
    table.migration_evidence = [];
    return;
  }
  table.migration_evidence = migrationRecord.evidence.sort((left, right) => compareText(left.source_file, right.source_file) || left.source_line - right.source_line);
  for (const column of table.columns) {
    const migrationColumn = migrationRecord.columns.get(column.name);
    if (!migrationColumn) continue;
    if (!column.sqlalchemy_type.value && migrationColumn.sqlalchemy_type) {
      column.sqlalchemy_type = { value: migrationColumn.sqlalchemy_type, source: "Alembic migration" };
    }
    if ((column.nullable.value === null || column.nullable.source === "python Optional inference") && migrationColumn.nullable !== null) {
      column.nullable = { value: migrationColumn.nullable, source: "Alembic migration" };
    }
    if (!column.default.server_default && migrationColumn.server_default) column.default.server_default = migrationColumn.server_default;
    if (!column.primary_key && migrationColumn.primary_key) column.primary_key = true;
    if (column.precision === null) column.precision = migrationColumn.precision;
    if (column.scale === null) column.scale = migrationColumn.scale;
    for (const foreignKey of migrationColumn.foreign_keys) {
      if (!column.foreign_keys.some((existing) => existing.target === foreignKey.target)) column.foreign_keys.push(foreignKey);
    }
  }
  table.indexes = mergeSchemaObjects([...table.indexes, ...migrationRecord.indexes]);
  table.unique_constraints = mergeSchemaObjects([...table.unique_constraints, ...migrationRecord.unique_constraints]);
  table.check_constraints = mergeSchemaObjects([...table.check_constraints, ...migrationRecord.check_constraints]);
  table.sequences = mergeSchemaObjects([...table.sequences, ...migrationRecord.sequences]);
}

function inferDomain(tableName) {
  return tableName ? tableName.split("_")[0].toLowerCase() : "unresolved";
}

function scanAccesses(repositoryRoot, className) {
  const roots = [path.join(repositoryRoot, "backend", "app", "services"), path.join(repositoryRoot, "backend", "app", "api")];
  const readers = [];
  const writers = [];
  for (const root of roots) {
    for (const filePath of listFiles(root, (candidate) => candidate.endsWith(".py"))) {
      const source = fs.readFileSync(filePath, "utf8");
      const sourceFile = toPosix(path.relative(repositoryRoot, filePath));
      source.split("\n").forEach((line, index) => {
        if (!new RegExp(`\\b${className}\\b`).test(line) || /^\s*(?:from|import)\s+/.test(line)) return;
        const evidence = line.trim();
        const reader = new RegExp(`\\b(?:select|get)\\s*\\(\\s*${className}\\b`).test(line);
        const writer = new RegExp(`\\b(?:delete|update)\\s*\\(\\s*${className}\\b|\\b${className}\\s*\\(`).test(line);
        const record = { source_file: sourceFile, source_line: index + 1, evidence };
        if (reader) readers.push(record);
        if (writer) writers.push(record);
      });
    }
  }
  const sortAccesses = (records) => records.sort((left, right) => compareText(left.source_file, right.source_file) || left.source_line - right.source_line);
  return { readers: sortAccesses(readers), writers: sortAccesses(writers) };
}

function sourceLocationFailures(repositoryRoot, tables) {
  return tables.flatMap((table) => {
    const absolutePath = path.join(repositoryRoot, table.source_file);
    if (!fs.existsSync(absolutePath)) return [{ class_name: table.class_name, source_file: table.source_file, source_line: table.source_line, reason: "source file does not exist" }];
    const line = fs.readFileSync(absolutePath, "utf8").split("\n")[table.source_line - 1] || "";
    return new RegExp(`^class\\s+${table.class_name}\\s*\\(`).test(line) ? [] : [{ class_name: table.class_name, source_file: table.source_file, source_line: table.source_line, reason: "class declaration not found at recorded line" }];
  });
}

function duplicateGroups(tables) {
  const groups = new Map();
  for (const table of tables) {
    if (!table.table_name) continue;
    groups.set(table.table_name, [...(groups.get(table.table_name) || []), table]);
  }
  return [...groups.entries()]
    .filter(([, tablesForName]) => tablesForName.length > 1)
    .map(([table_name, tablesForName]) => ({ table_name, records: tablesForName.map((table) => ({ class_name: table.class_name, source_file: table.source_file, source_line: table.source_line })) }))
    .sort((left, right) => compareText(left.table_name, right.table_name));
}

function applyDefaultDecisions(tables, decisionsByKey) {
  for (const table of tables) {
    for (const column of table.columns) {
      if (column.default.kind !== "default_factory") continue;
      const key = defaultFactoryKey(table, column);
      column.default_factory_key = key;
      column.default_decision = decisionsByKey.get(key) || null;
    }
  }
}

function defaultFactoryItems(tables) {
  return tables.flatMap((table) => table.columns
    .filter((column) => column.default.kind === "default_factory")
    .map((column) => ({
      default_factory_key: column.default_factory_key || defaultFactoryKey(table, column),
      table_name: table.table_name,
      column_name: column.name,
      source_file: column.source_file,
      source_line: column.source_line,
      source_default_factory: column.default.value,
    })))
    .sort((left, right) => compareText(left.default_factory_key, right.default_factory_key));
}

function unresolvedMetadata(tables) {
  const unresolved = [];
  for (const table of tables) {
    if (!table.table_name) unresolved.push({ scope: "table", class_name: table.class_name, reason: "__tablename__ is not statically declared" });
    for (const column of table.columns) {
      if (!column.sqlalchemy_type.value) unresolved.push({ scope: "column", table_name: table.table_name, column_name: column.name, reason: "no explicit SQLAlchemy type in model or Alembic migration" });
      if (column.nullable.value === null) unresolved.push({ scope: "column", table_name: table.table_name, column_name: column.name, reason: "nullability is not explicit in model or Alembic migration" });
      if (column.default.kind === "default_factory" && !column.default_decision) {
        unresolved.push({ scope: "column", table_name: table.table_name, column_name: column.name, reason: `application default factory ${column.default.value} requires a Java equivalent decision` });
      }
    }
  }
  return unresolved.sort((left, right) => compareText(left.table_name || left.class_name, right.table_name || right.class_name) || compareText(left.column_name || "", right.column_name || "") || compareText(left.reason, right.reason));
}

function countByDomain(tables) {
  const counts = {};
  for (const table of tables) counts[table.domain] = (counts[table.domain] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compareText(left, right)));
}

function buildLedger(repositoryRoot, expectedTableCount = EXPECTED_TABLE_COUNT, options = {}) {
  const modelRoot = path.join(repositoryRoot, "backend", "app", "models");
  const modelFiles = listFiles(modelRoot, (candidate) => candidate.endsWith(".py"));
  const tables = modelFiles.flatMap((filePath) => parseModelFile(fs.readFileSync(filePath, "utf8"), toPosix(path.relative(repositoryRoot, filePath))));
  const migrations = parseMigrations(repositoryRoot);
  const decisionRegistry = readDefaultDecisionRegistry(repositoryRoot, options.registryPath);
  const registryIndex = indexDefaultDecisionRegistry(decisionRegistry.decisions);
  for (const table of tables) {
    applyMigrationMetadata(table, migrations.records.get(table.table_name));
    table.domain = inferDomain(table.table_name);
    const accesses = scanAccesses(repositoryRoot, table.class_name);
    table.readers = accesses.readers;
    table.writers = accesses.writers;
    table.java_owner = { status: "unassigned", value: null };
    table.flyway_baseline = {
      status: "unmapped",
      version: null,
      source_alembic_revisions: [...new Set(table.migration_evidence.map((evidence) => evidence.revision).filter(Boolean))].sort(compareText),
    };
  }
  tables.sort((left, right) => compareText(left.table_name || left.class_name, right.table_name || right.class_name));
  applyDefaultDecisions(tables, registryIndex.byKey);
  const missingTableNames = tables.filter((table) => !table.table_name).map((table) => ({ class_name: table.class_name, source_file: table.source_file, source_line: table.source_line }));
  const duplicates = duplicateGroups(tables);
  const unresolvedSourceLocations = sourceLocationFailures(repositoryRoot, tables);
  const unresolved = unresolvedMetadata(tables);
  const defaultItems = defaultFactoryItems(tables);
  const assignedDefaultFactoryDecisions = defaultItems.filter((item) => registryIndex.byKey.has(item.default_factory_key)).length;
  const ledger = {
    schema_version: 1,
    generated_by: "scripts/spring-migration/schema-ledger.js",
    expected_table_count: expectedTableCount,
    source_table_count: tables.length,
    model_files: modelFiles.map((filePath) => toPosix(path.relative(repositoryRoot, filePath))),
    migration_files: migrations.migration_files,
    decision_registry: {
      path: decisionRegistry.path,
      exists: decisionRegistry.exists,
      decision_count: decisionRegistry.decisions.length,
      decisions: decisionRegistry.decisions,
      duplicate_default_factory_keys: registryIndex.duplicateKeys,
      malformed_entries: [
        ...(decisionRegistry.registry_structure_errors || []),
        ...registryIndex.malformedEntries,
      ],
    },
    verification: {
      source_count_matches_expected: tables.length === expectedTableCount,
      missing_table_names: missingTableNames,
      duplicate_table_names: duplicates,
      unresolved_source_locations: unresolvedSourceLocations,
    },
    counts: {
      by_domain: countByDomain(tables),
      assigned_default_factory_decisions: assignedDefaultFactoryDecisions,
      unresolved_default_factory_decisions: defaultItems.length - assignedDefaultFactoryDecisions,
      unresolved_metadata: unresolved.length,
    },
    tables,
    default_factory_items: defaultItems,
    unresolved_metadata: unresolved,
  };
  ledger.complete_verification = verifyCompleteLedger(ledger, repositoryRoot);
  return ledger;
}

function renderMarkdown(ledger) {
  const verification = ledger.verification;
  const completeVerification = ledger.complete_verification || verifyCompleteLedger(ledger, process.cwd());
  const lines = [
    "# Schema Migration Ledger",
    "",
    "Generated by `scripts/spring-migration/schema-ledger.js`. Do not edit generated output manually.",
    "",
    "## Summary",
    "",
    `- SQLModel table classes: ${ledger.source_table_count} (expected ${ledger.expected_table_count})`,
    `- Missing table names: ${verification.missing_table_names.length}`,
    `- Duplicate table-name groups: ${verification.duplicate_table_names.length}`,
    `- Unresolved source locations: ${verification.unresolved_source_locations.length}`,
    `- Reviewed default-factory decisions: ${ledger.counts.assigned_default_factory_decisions}`,
    `- Unresolved default-factory decisions: ${ledger.counts.unresolved_default_factory_decisions}`,
    `- Unresolved static metadata items: ${ledger.unresolved_metadata.length}`,
    `- Complete verification: ${completeVerification.passed ? "PASS" : "FAIL"}`,
    "",
    "## Domain Counts",
    "",
    "| Domain | Tables |",
    "| --- | ---: |",
    ...Object.entries(ledger.counts.by_domain).map(([domain, count]) => `| ${domain} | ${count} |`),
    "",
    "## Table Inventory",
    "",
    "| Table | Source class | Domain | Columns | Readers | Writers | Java owner | Flyway baseline |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ...ledger.tables.map((table) => `| \`${table.table_name || "UNRESOLVED"}\` | \`${table.class_name}\` ([${table.source_file}:${table.source_line}](../../${table.source_file})) | ${table.domain} | ${table.columns.length} | ${table.readers.length} | ${table.writers.length} | ${table.java_owner.status} | ${table.flyway_baseline.status} |`),
    "",
    "## Verification Failures",
    "",
  ];
  if (verification.missing_table_names.length + verification.duplicate_table_names.length + verification.unresolved_source_locations.length === 0 && verification.source_count_matches_expected) {
    lines.push("No verification failures.");
  } else {
    if (!verification.source_count_matches_expected) lines.push(`- Expected ${ledger.expected_table_count} table classes, found ${ledger.source_table_count}.`);
    for (const table of verification.missing_table_names) lines.push(`- Missing table name: \`${table.class_name}\` at \`${table.source_file}:${table.source_line}\`.`);
    for (const duplicate of verification.duplicate_table_names) lines.push(`- Duplicate table name: \`${duplicate.table_name}\` (${duplicate.records.map((record) => `${record.class_name} at ${record.source_file}:${record.source_line}`).join(", ")}).`);
    for (const location of verification.unresolved_source_locations) lines.push(`- Unresolved source: \`${location.class_name}\` at \`${location.source_file}:${location.source_line}\` (${location.reason}).`);
  }
  lines.push("", "## Default-Factory Decisions", "");
  lines.push(`Reviewed decisions are merged from \`${ledger.decision_registry.path}\` by exact \`default_factory_key\`. Each decision records the source factory, non-tautological behavior detail, structured source/implementation evidence, Java owner, and Flyway baseline owner.`);
  lines.push("", "## Reviewed Default Evidence", "", "| Default factory key | Behavior detail | Source evidence | Implementation evidence |", "| --- | --- | --- | --- |");
  for (const item of ledger.default_factory_items) {
    const decision = ledger.decision_registry.decisions.find((candidate) => candidate && candidate.default_factory_key === item.default_factory_key);
    const behavior = decision?.behavior?.detail || "MISSING";
    const source = decision?.source_ref?.source_file && decision?.source_ref?.source_line && decision?.source_ref?.factory
      ? `${decision.source_ref.source_file}:${decision.source_ref.source_line}#${decision.source_ref.factory}` : "MISSING";
    const implementation = decision?.implementation_ref?.source_file && decision?.implementation_ref?.symbol
      ? `${decision.implementation_ref.source_file}#${decision.implementation_ref.symbol}` : "MISSING";
    lines.push(`| \`${item.default_factory_key}\` | ${behavior.replace(/\|/g, "\\|")} | \`${source}\` | \`${implementation}\` |`);
  }
  lines.push("", "## Complete Verification", "");
  if (completeVerification.passed) lines.push("All reviewed default keys, values, Java/Flyway owners, and unresolved-metadata gates passed.");
  else lines.push(...completeVerification.failures.map((failure) => `- ${failure}`));
  lines.push("", "## Explicitly Unresolved Metadata", "");
  if (ledger.unresolved_metadata.length === 0) lines.push("No statically unresolved metadata.");
  else {
    lines.push("The JSON ledger contains the complete list; the first 25 items are shown here.", "", "| Scope | Table / column | Reason |", "| --- | --- | --- |");
    for (const item of ledger.unresolved_metadata.slice(0, 25)) {
      lines.push(`| ${item.scope} | \`${item.table_name || item.class_name}${item.column_name ? `.${item.column_name}` : ""}\` | ${item.reason} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function schemaLedgerArtifacts(ledger) {
  return {
    "schema-ledger.json": `${JSON.stringify(ledger, null, 2)}\n`,
    "schema-ledger.md": renderMarkdown(ledger),
  };
}

function writeLedger(repositoryRoot, ledger) {
  const outputDirectory = path.join(repositoryRoot, "docs", "spring-migration");
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const [fileName, contents] of Object.entries(schemaLedgerArtifacts(ledger))) {
    fs.writeFileSync(path.join(outputDirectory, fileName), contents);
  }
}

function checkSchemaLedgerArtifacts(repositoryRoot, ledger) {
  const outputDirectory = path.join(repositoryRoot, "docs", "spring-migration");
  const failures = [];
  for (const [fileName, expected] of Object.entries(schemaLedgerArtifacts(ledger))) {
    const outputPath = path.join(outputDirectory, fileName);
    if (!fs.existsSync(outputPath)) {
      failures.push(`${fileName} is missing; run schema-ledger.js to generate it`);
    } else if (fs.readFileSync(outputPath, "utf8") !== expected) {
      failures.push(`${fileName} is stale; run schema-ledger.js to regenerate it`);
    }
  }
  return failures;
}

function verifyLedger(ledger) {
  const failures = [];
  if (!ledger.verification.source_count_matches_expected) failures.push(`expected ${ledger.expected_table_count} SQLModel table classes, found ${ledger.source_table_count}`);
  if (ledger.verification.missing_table_names.length > 0) failures.push(`${ledger.verification.missing_table_names.length} table records have no table name`);
  if (ledger.verification.duplicate_table_names.length > 0) failures.push(`${ledger.verification.duplicate_table_names.length} duplicate table-name groups found`);
  if (ledger.verification.unresolved_source_locations.length > 0) failures.push(`${ledger.verification.unresolved_source_locations.length} source locations could not be resolved`);
  const registryIndex = indexDefaultDecisionRegistry(Array.isArray(ledger.decision_registry?.decisions) ? ledger.decision_registry.decisions : []);
  const malformedRegistryEntries = [...new Set([
    ...(ledger.decision_registry?.malformed_entries || []),
    ...registryIndex.malformedEntries,
  ])];
  if (malformedRegistryEntries.length > 0) {
    failures.push(`${malformedRegistryEntries.length} malformed default-decision registry entries: ${malformedRegistryEntries.join("; ")}`);
  }
  return failures;
}

function verifyDefaultReference(repositoryRoot, reference, kind, failures, key, requiredAnchor) {
  if (!reference || typeof reference !== "object") {
    failures.push(`${key} has no ${kind} reference`);
    return;
  }
  if (hasPlaceholder(reference)) {
    failures.push(`${key} has a blank or placeholder ${kind} reference`);
    return;
  }
  const sourceFile = reference.source_file;
  if (typeof sourceFile !== "string" || !sourceFile) {
    failures.push(`${key} has no ${kind} source file`);
    return;
  }
  const absolutePath = path.join(repositoryRoot, sourceFile);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${key} ${kind} source is missing: ${sourceFile}`);
    return;
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  const anchor = requiredAnchor || reference.symbol || reference.table_name;
  if (typeof anchor !== "string" || !anchor || !source.includes(anchor)) {
    failures.push(`${key} ${kind} drifted: ${sourceFile} no longer contains its recorded anchor`);
  }
}

function verifyDefaultSourceEvidence(repositoryRoot, reference, failures, key) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    failures.push(`${key} has no structured source evidence`);
    return;
  }
  if (!nonBlankString(reference.source_file) || !Number.isInteger(reference.source_line) || reference.source_line < 1 || !nonBlankString(reference.factory) || hasPlaceholder(reference)) {
    failures.push(`${key} has blank or placeholder structured source evidence`);
    return;
  }
  const absolutePath = path.join(repositoryRoot, reference.source_file);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${key} source evidence is missing: ${reference.source_file}`);
    return;
  }
  const sourceLines = fs.readFileSync(absolutePath, "utf8").split("\n");
  const sourceBlock = sourceLines.slice(reference.source_line - 1, reference.source_line + 12).join("\n");
  if (!sourceBlock.includes("default_factory") || !sourceBlock.includes(reference.factory)) {
    failures.push(`${key} source evidence drifted: ${reference.source_file}:${reference.source_line}`);
  }
}

function hasTautologicalDetail(detail) {
  return !nonBlankString(detail) || TAUTOLOGICAL_DETAIL_PATTERN.test(detail.trim());
}

function verifyHistoricalDefaultEvidence(reference, failures, key) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    failures.push(`${key} has no structured historical source evidence`);
    return;
  }
  if (!nonBlankString(reference.source_file) || !Number.isInteger(reference.source_line) || reference.source_line < 1 || !nonBlankString(reference.factory) || hasPlaceholder(reference)) {
    failures.push(`${key} has blank or placeholder structured historical source evidence`);
  }
}

function verifyCompleteLedger(ledger, repositoryRoot, options = {}) {
  const failures = [...verifyLedger(ledger)];
  const registry = ledger.decision_registry || {};
  const decisions = Array.isArray(registry.decisions) ? registry.decisions : [];
  const { byKey, duplicateKeys, malformedEntries } = indexDefaultDecisionRegistry(decisions);
  const expectedKeys = new Set((ledger.default_factory_items || []).map((item) => item.default_factory_key));
  const actualKeys = new Set(byKey.keys());
  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key)).sort(compareText);
  const extra = [...actualKeys].filter((key) => !expectedKeys.has(key)).sort(compareText);

  if (!registry.exists) failures.push(`default decision registry is missing: ${registry.path || DEFAULT_DECISION_REGISTRY_PATH}`);
  const malformedRegistryEntries = [...new Set([...(registry.malformed_entries || []), ...malformedEntries])];
  if (malformedRegistryEntries.length > 0) {
    failures.push(`${malformedRegistryEntries.length} malformed default-decision registry entries: ${malformedRegistryEntries.join("; ")}`);
  }
  if (duplicateKeys.length > 0 || (registry.duplicate_default_factory_keys || []).length > 0) {
    failures.push(`${duplicateKeys.length || registry.duplicate_default_factory_keys.length} duplicate default-factory decision keys found`);
  }
  if (missing.length > 0) failures.push(`${missing.length} default-factory ledger keys are missing reviewed decisions`);
  if (extra.length > 0) failures.push(`${extra.length} reviewed default decisions are stale or do not map to a default factory`);

  for (const item of ledger.default_factory_items || []) {
    const decision = byKey.get(item.default_factory_key);
    if (!decision) continue;
    if (hasPlaceholder(decision)) failures.push(`${item.default_factory_key} contains a blank or placeholder reviewed default decision`);
    if (decision.source_default_factory !== item.source_default_factory) {
      failures.push(`${item.default_factory_key} source default-factory drifted`);
    }
    const behavior = decision.behavior;
    if (!behavior || typeof behavior.value !== "string" || !SUPPORTED_DEFAULT_BEHAVIORS.has(behavior.value)) {
      failures.push(`${item.default_factory_key} has an unsupported default behavior`);
    }
    if (behavior && hasPlaceholder(behavior)) failures.push(`${item.default_factory_key} has a blank or placeholder default behavior`);
    if (hasTautologicalDetail(behavior?.detail)) {
      failures.push(`${item.default_factory_key} has a missing or tautological default behavior detail`);
    }
    if (options.historicalEvidence) verifyHistoricalDefaultEvidence(decision.source_ref, failures, item.default_factory_key);
    else verifyDefaultSourceEvidence(repositoryRoot, decision.source_ref, failures, item.default_factory_key);
    verifyDefaultReference(repositoryRoot, decision.implementation_ref, "implementation evidence", failures, item.default_factory_key);
    verifyDefaultReference(repositoryRoot, decision.java_owner, "Java owner", failures, item.default_factory_key);
    verifyDefaultReference(repositoryRoot, decision.flyway, "Flyway owner", failures, item.default_factory_key, item.table_name);
    if (!SUPPORTED_FLYWAY_STRATEGIES.has(decision.flyway?.default_strategy)) {
      failures.push(`${item.default_factory_key} has an unsupported Flyway default strategy`);
    }
  }

  const remainingDefaultFactories = (ledger.unresolved_metadata || [])
    .filter((item) => /application default factory/.test(item.reason));
  if (remainingDefaultFactories.length > 0) {
    failures.push(`${remainingDefaultFactories.length} default-factory decisions remain unresolved`);
  }
  const nonDefaultUnresolved = (ledger.unresolved_metadata || [])
    .filter((item) => !/application default factory/.test(item.reason));
  if (nonDefaultUnresolved.length > 0) {
    failures.push(`${nonDefaultUnresolved.length} type/nullability/source metadata item(s) remain unresolved`);
  }

  return {
    passed: failures.length === 0,
    registry_record_count: decisions.length,
    missing_default_decision_count: missing.length,
    missing_default_decision_keys: missing,
    extra_default_decision_count: extra.length,
    extra_default_decision_keys: extra,
    duplicate_default_decision_key_count: duplicateKeys.length,
    duplicate_default_decision_keys: duplicateKeys,
    assigned_default_factory_decisions: ledger.counts?.assigned_default_factory_decisions || 0,
    unresolved_default_factory_decisions: ledger.counts?.unresolved_default_factory_decisions || 0,
    failures,
  };
}

function main() {
  const argumentsList = process.argv.slice(2);
  const checkComplete = argumentsList.includes("--check-complete");
  const check = checkComplete || argumentsList.includes("--check");
  const complete = checkComplete || argumentsList.includes("--verify-complete");
  const verify = complete || check || argumentsList.includes("--verify");
  const supported = new Set(["--verify", "--verify-complete", "--check", "--check-complete"]);
  const unknown = argumentsList.filter((argument) => !supported.has(argument));
  if (unknown.length > 0) {
    console.error(`Unsupported argument(s): ${unknown.join(", ")}`);
    process.exitCode = 2;
    return;
  }
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const snapshotMode = hasSnapshot(repositoryRoot);
  const snapshotFailures = snapshotMode ? verifySnapshot(repositoryRoot).failures : [];
  const ledger = snapshotMode
    ? readHistoricalJson(repositoryRoot, "docs/spring-migration/schema-ledger.json")
    : buildLedger(repositoryRoot);
  const failures = verifyLedger(ledger);
  const completeVerification = snapshotMode
    ? verifyCompleteLedger(ledger, repositoryRoot, { historicalEvidence: true })
    : ledger.complete_verification;
  const checkFailures = snapshotMode ? snapshotFailures : (check ? checkSchemaLedgerArtifacts(repositoryRoot, ledger) : []);
  console.log(`Schema ledger: ${ledger.source_table_count} tables, ${ledger.counts.assigned_default_factory_decisions} assigned defaults, ${ledger.counts.unresolved_default_factory_decisions} unresolved default decisions.`);
  if (verify && failures.length > 0) {
    console.error(`Verification failed: ${failures.join("; ")}`);
    process.exitCode = 1;
  }
  if (complete && !completeVerification.passed) {
    console.error(`Complete verification failed: ${completeVerification.failures.join("; ")}`);
    process.exitCode = 1;
  }
  if (checkFailures.length > 0) {
    console.error(`Artifact check failed: ${checkFailures.join("; ")}`);
    process.exitCode = 1;
  }
  if (process.exitCode) return;
  if (!check && !snapshotMode) writeLedger(repositoryRoot, ledger);
}

if (require.main === module) main();

module.exports = {
  EXPECTED_TABLE_COUNT,
  buildLedger,
  checkSchemaLedgerArtifacts,
  findClosingParen,
  parseMigrations,
  parseModelFile,
  readDefaultDecisionRegistry,
  renderMarkdown,
  scanAccesses,
  schemaLedgerArtifacts,
  SUPPORTED_DEFAULT_BEHAVIORS,
  verifyCompleteLedger,
  verifyLedger,
  writeLedger,
};
