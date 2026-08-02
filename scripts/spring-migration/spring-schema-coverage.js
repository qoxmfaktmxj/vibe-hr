"use strict";

const fs = require("fs");
const path = require("path");

const EXPECTED_TABLE_COUNT = 105;
const GENERATED_BY = "scripts/spring-migration/spring-schema-coverage.js";

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
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

function skipQuoted(source, offset) {
  const quote = source[offset];
  let index = offset + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index;
    index += 1;
  }
  return source.length - 1;
}

// Comments are blanked instead of removed so source offsets and line numbers stay valid.
function stripComments(source) {
  let result = "";
  let index = 0;
  while (index < source.length) {
    if (source[index] === '"' || source[index] === "'") {
      const end = skipQuoted(source, index);
      result += source.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (source.slice(index, index + 2) === "//") {
      const end = source.indexOf("\n", index);
      const stop = end < 0 ? source.length : end;
      result += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    if (source.slice(index, index + 2) === "/*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end < 0 ? source.length : end + 2;
      result += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    result += source[index];
    index += 1;
  }
  return result;
}

function findMatching(source, openOffset, openCharacter, closeCharacter) {
  let depth = 0;
  for (let index = openOffset; index < source.length; index += 1) {
    if (source[index] === '"' || source[index] === "'") {
      index = skipQuoted(source, index);
      continue;
    }
    if (source[index] === openCharacter) depth += 1;
    if (source[index] === closeCharacter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findOpeningBrace(source, offset) {
  for (let index = offset; index < source.length; index += 1) {
    if (source[index] === '"' || source[index] === "'") {
      index = skipQuoted(source, index);
      continue;
    }
    if (source[index] === "{") return index;
  }
  return -1;
}

function splitTopLevel(source) {
  const parts = [];
  let start = 0;
  let parens = 0;
  let braces = 0;
  let brackets = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '"' || source[index] === "'") {
      index = skipQuoted(source, index);
      continue;
    }
    if (source[index] === "(") parens += 1;
    else if (source[index] === ")") parens -= 1;
    else if (source[index] === "{") braces += 1;
    else if (source[index] === "}") braces -= 1;
    else if (source[index] === "[") brackets += 1;
    else if (source[index] === "]") brackets -= 1;
    else if (source[index] === "," && parens === 0 && braces === 0 && brackets === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function readAnnotationAt(source, offset) {
  const match = source.slice(offset).match(/^@(?:(?:[A-Za-z_$][\w$]*\.)*)([A-Za-z_$][\w$]*)/);
  if (!match) return null;
  const name = match[1];
  let end = offset + match[0].length;
  while (/\s/.test(source[end] || "")) end += 1;
  let argumentsSource = null;
  if (source[end] === "(") {
    const close = findMatching(source, end, "(", ")");
    if (close < 0) return { name, offset, end, arguments_source: null, malformed: true };
    argumentsSource = source.slice(end + 1, close);
    end = close + 1;
  }
  return { name, offset, end, arguments_source: argumentsSource, malformed: false };
}

// This intentionally skips nested annotation calls. Nested @JoinColumn and
// @AttributeOverride values are parsed by their dedicated readers below.
function parseAnnotations(source, start = 0, end = source.length) {
  const annotations = [];
  for (let index = start; index < end; index += 1) {
    if (source[index] !== "@") continue;
    const annotation = readAnnotationAt(source, index);
    if (!annotation || annotation.end > end) continue;
    annotations.push(annotation);
    index = Math.max(index, annotation.end - 1);
  }
  return annotations;
}

function annotationsNamed(annotations, name) {
  return annotations.filter((annotation) => annotation.name === name);
}

function annotationNamed(annotations, name) {
  return annotations.find((annotation) => annotation.name === name) || null;
}

function argumentValue(annotation, name) {
  if (!annotation || annotation.arguments_source === null) return null;
  const argument = splitTopLevel(annotation.arguments_source)
    .find((part) => new RegExp(`^${name}\\s*=`).test(part));
  return argument ? argument.replace(new RegExp(`^${name}\\s*=`), "").trim() : null;
}

function javaString(value) {
  if (!value || !/^"[\s\S]*"$/.test(value.trim())) return null;
  try {
    return JSON.parse(value.trim());
  } catch {
    return value.trim().slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function stringArgument(annotation, name) {
  return javaString(argumentValue(annotation, name));
}

function booleanArgument(annotation, name) {
  const value = argumentValue(annotation, name);
  return value === "true" ? true : value === "false" ? false : null;
}

function numberArgument(annotation, name) {
  const value = argumentValue(annotation, name);
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

function normalizeIdentifier(value) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("`") && trimmed.endsWith("`")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function typeVisibility(modifiers) {
  if (/\bpublic\b/.test(modifiers)) return "public";
  if (/\bprotected\b/.test(modifiers)) return "protected";
  if (/\bprivate\b/.test(modifiers)) return "private";
  return "package-private";
}

function leadingTypeAnnotations(source, typeOffset) {
  const annotations = parseAnnotations(source, 0, typeOffset);
  let leading = [];
  for (let start = annotations.length - 1; start >= 0; start -= 1) {
    const cluster = annotations.slice(start);
    const header = removeAnnotations(source.slice(cluster[0].offset, typeOffset), cluster.map((annotation) => ({
      ...annotation,
      offset: annotation.offset - cluster[0].offset,
      end: annotation.end - cluster[0].offset,
    })))
      .replace(/\b(?:public|protected|private|abstract|final|static|sealed|non-sealed)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!header) {
      leading = cluster;
      continue;
    }
    break;
  }
  return leading;
}

function parseTypes(source, sourceFile) {
  const types = [];
  const declaration = /\b((?:(?:public|protected|private|abstract|final|static|sealed|non-sealed)\s+)*)class\s+([A-Za-z_$][\w$]*)\b/g;
  let match;
  while ((match = declaration.exec(source))) {
    const headerOffset = match.index;
    const className = match[2];
    const bodyOpen = findOpeningBrace(source, declaration.lastIndex);
    if (bodyOpen < 0) {
      types.push({ source_file: sourceFile, source_line: lineAt(source, headerOffset), simple_name: className, parse_error: "class declaration has no opening body brace" });
      continue;
    }
    const bodyClose = findMatching(source, bodyOpen, "{", "}");
    if (bodyClose < 0) {
      types.push({ source_file: sourceFile, source_line: lineAt(source, headerOffset), simple_name: className, parse_error: "class body has no closing brace" });
      continue;
    }
    const annotations = leadingTypeAnnotations(source, headerOffset);
    const declarationSource = source.slice(headerOffset, bodyOpen);
    const extendsMatch = declarationSource.match(/\bextends\s+([A-Za-z_$][\w$]*(?:\s*<[^>{}()]+>)?)/);
    types.push({
      source_file: sourceFile,
      source_line: lineAt(source, headerOffset),
      offset: headerOffset,
      body_open: bodyOpen,
      body_close: bodyClose,
      simple_name: className,
      modifiers: match[1].trim().split(/\s+/).filter(Boolean),
      visibility: typeVisibility(match[1]),
      annotations,
      extends_name: extendsMatch ? extendsMatch[1].replace(/<.*$/, "").trim() : null,
      parse_error: null,
    });
  }
  for (const type of types.filter((candidate) => candidate.body_open !== undefined)) {
    const enclosing = types.filter((candidate) => candidate !== type && candidate.body_open < type.offset && candidate.body_close > type.body_close)
      .sort((left, right) => left.body_open - right.body_open);
    type.enclosing_types = enclosing.map((candidate) => candidate.simple_name);
    type.is_nested = enclosing.length > 0;
  }
  return types;
}

function removeAnnotations(statement, annotations) {
  let result = "";
  let index = 0;
  for (const annotation of annotations) {
    result += statement.slice(index, annotation.offset);
    result += " ".repeat(annotation.end - annotation.offset);
    index = annotation.end;
  }
  return result + statement.slice(index);
}

function parseMemberFields(source, type) {
  const fields = [];
  const errors = [];
  let statementStart = type.body_open + 1;
  let braces = 0;
  let parens = 0;
  for (let index = type.body_open + 1; index < type.body_close; index += 1) {
    if (source[index] === '"' || source[index] === "'") {
      index = skipQuoted(source, index);
      continue;
    }
    if (source[index] === "{") {
      if (braces === 0 && parens === 0) {
        const candidate = source.slice(statementStart, index);
        const annotations = parseAnnotations(candidate);
        const jpaAnnotations = annotations.filter((annotation) => ["Column", "Id", "EmbeddedId", "JoinColumn", "JoinColumns", "ManyToOne", "OneToOne"].includes(annotation.name));
        if (jpaAnnotations.length > 0 && !/\bclass\s+[A-Za-z_$][\w$]*\s*$/.test(candidate)) {
          errors.push({
            source_file: type.source_file,
            source_line: lineAt(source, statementStart),
            entity: type.simple_name,
            reason: "JPA annotation is on a non-field member; property-access mappings are not statically parsed",
          });
        }
      }
      braces += 1;
    }
    else if (source[index] === "}") {
      braces -= 1;
      if (braces === 0 && parens === 0) statementStart = index + 1;
    } else if (source[index] === "(") parens += 1;
    else if (source[index] === ")") parens -= 1;
    else if (source[index] === ";" && braces === 0 && parens === 0) {
      const statement = source.slice(statementStart, index + 1);
      const annotations = parseAnnotations(statement);
      const jpaAnnotations = annotations.filter((annotation) => ["Column", "Id", "EmbeddedId", "JoinColumn", "JoinColumns", "ManyToOne", "OneToOne", "Transient"].includes(annotation.name));
      if (jpaAnnotations.length > 0) {
        const declaration = removeAnnotations(statement, annotations)
          .replace(/\b(?:public|protected|private|static|final|transient|volatile)\b/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const beforeInitializer = declaration.split("=")[0].replace(/;\s*$/, "").trim();
        const fieldMatch = beforeInitializer.match(/^(.*?)\s+([A-Za-z_$][\w$]*)$/);
        if (!fieldMatch || /[()]/.test(beforeInitializer)) {
          errors.push({
            source_file: type.source_file,
            source_line: lineAt(source, statementStart),
            entity: type.simple_name,
            reason: "JPA field annotation could not be associated with a direct field declaration",
          });
        } else {
          fields.push({
            source_file: type.source_file,
            source_line: lineAt(source, statementStart),
            source_offset: statementStart,
            field_name: fieldMatch[2],
            java_type: fieldMatch[1].trim(),
            annotations,
            is_static: /\bstatic\b/.test(statement),
            is_transient: /\btransient\b/.test(statement) || annotations.some((annotation) => annotation.name === "Transient"),
          });
        }
      } else {
        const declaration = statement.replace(/\b(?:public|protected|private|static|final|transient|volatile)\b/g, " ").replace(/\s+/g, " ").trim();
        const beforeInitializer = declaration.split("=")[0].replace(/;\s*$/, "").trim();
        const fieldMatch = beforeInitializer.match(/^(.*?)\s+([A-Za-z_$][\w$]*)$/);
        if (fieldMatch && !/[()]/.test(beforeInitializer)) {
          fields.push({
            source_file: type.source_file,
            source_line: lineAt(source, statementStart),
            source_offset: statementStart,
            field_name: fieldMatch[2],
            java_type: fieldMatch[1].trim(),
            annotations,
            is_static: /\bstatic\b/.test(statement),
            is_transient: /\btransient\b/.test(statement) || annotations.some((annotation) => annotation.name === "Transient"),
          });
        }
      }
      statementStart = index + 1;
    }
  }
  return { fields, errors };
}

function nestedJoinColumns(annotation) {
  if (!annotation || annotation.arguments_source === null) return [];
  const joins = [];
  const pattern = /@(?:(?:[A-Za-z_$][\w$]*\.)*)JoinColumn\b/g;
  let match;
  while ((match = pattern.exec(annotation.arguments_source))) {
    const joined = readAnnotationAt(annotation.arguments_source, match.index);
    if (joined) joins.push(joined);
    pattern.lastIndex = joined ? joined.end : pattern.lastIndex;
  }
  return joins;
}

function attributeOverrides(annotation) {
  if (!annotation || annotation.arguments_source === null) return new Map();
  const overrides = new Map();
  const pattern = /@(?:(?:[A-Za-z_$][\w$]*\.)*)AttributeOverride\b/g;
  let match;
  while ((match = pattern.exec(annotation.arguments_source))) {
    const override = readAnnotationAt(annotation.arguments_source, match.index);
    if (!override) continue;
    const property = stringArgument(override, "name");
    const columnStart = (override.arguments_source || "").indexOf("@Column");
    const column = columnStart >= 0 ? readAnnotationAt(override.arguments_source, columnStart) : null;
    const columnName = stringArgument(column, "name");
    if (property && columnName) overrides.set(property, normalizeIdentifier(columnName));
    pattern.lastIndex = override.end;
  }
  return overrides;
}

function nullableClue(field, columnAnnotation) {
  const explicit = booleanArgument(columnAnnotation, "nullable");
  if (explicit !== null) return { value: explicit, source: "@Column.nullable" };
  return { value: null, source: "not explicitly declared" };
}

function columnFromField(field, extra = {}) {
  const column = annotationNamed(field.annotations, "Column");
  const join = annotationNamed(field.annotations, "JoinColumn");
  const jdbcTypeCode = annotationNamed(field.annotations, "JdbcTypeCode");
  const nameValue = stringArgument(join || column, "name");
  const rawName = nameValue || field.field_name;
  const normalizedName = normalizeIdentifier(rawName);
  const relation = annotationNamed(field.annotations, "ManyToOne") || annotationNamed(field.annotations, "OneToOne");
  return {
    name: normalizedName,
    raw_name: rawName,
    name_source: nameValue ? `@${join ? "JoinColumn" : "Column"}.name` : "field name",
    source_file: field.source_file,
    source_line: field.source_line,
    field_name: field.field_name,
    java_type: field.java_type,
    jdbc_type_code: jdbcTypeCode && jdbcTypeCode.arguments_source ? jdbcTypeCode.arguments_source.trim() : null,
    primary_key: annotationsNamed(field.annotations, "Id").length > 0 || extra.primary_key === true,
    embedded_id: extra.embedded_id || null,
    inherited_from: extra.inherited_from || field.inherited_from || null,
    nullable: nullableClue(field, join || column),
    length: numberArgument(column, "length"),
    precision: numberArgument(column, "precision"),
    scale: numberArgument(column, "scale"),
    column_definition: stringArgument(column, "columnDefinition"),
    foreign_key: relation || join ? {
      relation: relation ? relation.name : "JoinColumn",
      target_entity: field.java_type.replace(/<.*$/, "").trim(),
      target_table: null,
      referenced_column_name: normalizeIdentifier(stringArgument(join, "referencedColumnName")),
    } : null,
  };
}

function columnsFromFields(fields, typeIndex, entityIndex, options = {}) {
  const columns = [];
  const errors = [];
  for (const field of fields) {
    if (field.is_static || field.is_transient) continue;
    const embedded = annotationNamed(field.annotations, "EmbeddedId");
    if (embedded) {
      const embeddedType = typeIndex.get(field.java_type.replace(/<.*$/, "").trim());
      if (!embeddedType || !embeddedType.is_embeddable) {
        errors.push({ source_file: field.source_file, source_line: field.source_line, entity: options.entity_name, reason: `@EmbeddedId type ${field.java_type} is not a parsed @Embeddable class` });
        continue;
      }
      const overrides = attributeOverrides(annotationNamed(field.annotations, "AttributeOverrides"));
      for (const embeddedColumn of columnsFromFields(embeddedType.fields, typeIndex, entityIndex, { entity_name: options.entity_name }).columns) {
        columns.push({
          ...embeddedColumn,
          name: overrides.get(embeddedColumn.field_name) || embeddedColumn.name,
          raw_name: overrides.get(embeddedColumn.field_name) || embeddedColumn.raw_name,
          name_source: overrides.has(embeddedColumn.field_name) ? "@AttributeOverride.column.name" : embeddedColumn.name_source,
          primary_key: true,
          embedded_id: field.field_name,
        });
      }
      continue;
    }
    const joins = [
      ...annotationsNamed(field.annotations, "JoinColumn"),
      ...annotationsNamed(field.annotations, "JoinColumns").flatMap(nestedJoinColumns),
    ];
    if (joins.length > 1) {
      for (const join of joins) {
        const joinedField = { ...field, annotations: [...field.annotations.filter((annotation) => annotation.name !== "JoinColumns" && annotation.name !== "JoinColumn"), join] };
        columns.push(columnFromField(joinedField));
      }
    } else {
      columns.push(columnFromField(field));
    }
  }
  for (const column of columns) {
    if (column.foreign_key) {
      const target = entityIndex.get(column.foreign_key.target_entity);
      if (target && target.table_name) column.foreign_key.target_table = target.table_name;
    }
  }
  return { columns, errors };
}

function parseJavaSource(source, sourceFile) {
  const uncommented = stripComments(source);
  const types = parseTypes(uncommented, sourceFile);
  const errors = [];
  for (const type of types) {
    if (type.parse_error) {
      errors.push({ source_file: type.source_file, source_line: type.source_line, entity: type.simple_name, reason: type.parse_error });
      continue;
    }
    type.is_entity = annotationsNamed(type.annotations, "Entity").length > 0;
    type.is_mapped_superclass = annotationsNamed(type.annotations, "MappedSuperclass").length > 0;
    type.is_embeddable = annotationsNamed(type.annotations, "Embeddable").length > 0;
    const parsed = parseMemberFields(uncommented, type);
    type.fields = parsed.fields;
    errors.push(...parsed.errors);
  }
  return { types, errors };
}

function sourceRecord(entity, fileTypeCounts, fileEntityCounts) {
  return {
    source_file: entity.source_file,
    source_line: entity.source_line,
    class_name: entity.simple_name,
    qualified_class_name: [...entity.enclosing_types, entity.simple_name].join("."),
    visibility: entity.visibility,
    modifiers: entity.modifiers,
    nested: entity.is_nested,
    enclosing_types: entity.enclosing_types,
    source_file_type_count: fileTypeCounts.get(entity.source_file) || 0,
    source_file_entity_count: fileEntityCounts.get(entity.source_file) || 0,
  };
}

function parseJavaEntities(repositoryRoot) {
  const javaRoot = path.join(repositoryRoot, "backend-spring", "src", "main", "java");
  const files = listFiles(javaRoot, (candidate) => candidate.endsWith(".java"));
  const allTypes = [];
  const errors = [];
  for (const filePath of files) {
    const sourceFile = toPosix(path.relative(repositoryRoot, filePath));
    const parsed = parseJavaSource(fs.readFileSync(filePath, "utf8"), sourceFile);
    allTypes.push(...parsed.types);
    errors.push(...parsed.errors);
  }
  const fileTypeCounts = new Map();
  const fileEntityCounts = new Map();
  for (const type of allTypes) {
    fileTypeCounts.set(type.source_file, (fileTypeCounts.get(type.source_file) || 0) + 1);
    if (type.is_entity) fileEntityCounts.set(type.source_file, (fileEntityCounts.get(type.source_file) || 0) + 1);
  }
  const typeIndex = new Map();
  for (const type of allTypes) {
    if (!typeIndex.has(type.simple_name)) typeIndex.set(type.simple_name, type);
  }
  const entities = allTypes.filter((type) => type.is_entity).map((type) => {
    const table = annotationNamed(type.annotations, "Table");
    const rawTableName = stringArgument(table, "name");
    const tableName = normalizeIdentifier(rawTableName);
    const entityAnnotation = annotationNamed(type.annotations, "Entity");
    return {
      entity_name: stringArgument(entityAnnotation, "name") || type.simple_name,
      table_name: tableName || null,
      raw_table_name: rawTableName || null,
      table_name_status: tableName ? "explicit" : "unresolved",
      table_name_reason: tableName ? null : table ? "@Table.name is not a string literal" : "@Entity has no explicit @Table.name",
      source: sourceRecord(type, fileTypeCounts, fileEntityCounts),
      _type: type,
    };
  });
  const entityIndex = new Map();
  for (const entity of entities) {
    if (!entityIndex.has(entity.source.class_name)) entityIndex.set(entity.source.class_name, entity);
  }
  for (const entity of entities) {
    const inherited = [];
    let parent = entity._type.extends_name ? typeIndex.get(entity._type.extends_name) : null;
    while (parent && parent.is_mapped_superclass) {
      inherited.unshift(...parent.fields.map((field) => ({ ...field, inherited_from: parent.simple_name })));
      parent = parent.extends_name ? typeIndex.get(parent.extends_name) : null;
    }
    const mapped = columnsFromFields([...inherited, ...entity._type.fields], typeIndex, entityIndex, { entity_name: entity.entity_name });
    entity.columns = mapped.columns.sort((left, right) => compareText(left.name, right.name) || left.source_line - right.source_line);
    errors.push(...mapped.errors);
    delete entity._type;
  }
  return {
    java_root: toPosix(path.relative(repositoryRoot, javaRoot)),
    source_files: files.map((filePath) => toPosix(path.relative(repositoryRoot, filePath))),
    entities: entities.sort((left, right) => compareText(left.table_name || "", right.table_name || "") || compareText(left.source.source_file, right.source.source_file) || left.source.source_line - right.source.source_line),
    parser_source_inconsistencies: errors.sort((left, right) => compareText(left.source_file, right.source_file) || left.source_line - right.source_line || compareText(left.reason, right.reason)),
  };
}

function readReferenceLedger(repositoryRoot, expectedTableCount) {
  const ledgerFile = path.join(repositoryRoot, "docs", "spring-migration", "schema-ledger.json");
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
  const inconsistencies = [];
  if (!Array.isArray(ledger.tables)) inconsistencies.push({ reason: "schema-ledger.tables is not an array" });
  const tables = Array.isArray(ledger.tables) ? ledger.tables : [];
  if (tables.length !== expectedTableCount) inconsistencies.push({ reason: `expected ${expectedTableCount} SQLModel tables, found ${tables.length}` });
  if (ledger.source_table_count !== undefined && ledger.source_table_count !== tables.length) inconsistencies.push({ reason: `schema-ledger.source_table_count is ${ledger.source_table_count}, but contains ${tables.length} tables` });
  const names = new Map();
  for (const table of tables) {
    if (!table.table_name) inconsistencies.push({ reason: `SQLModel table ${table.class_name || "unknown"} has no table_name` });
    else names.set(table.table_name, [...(names.get(table.table_name) || []), table]);
    for (const column of table.columns || []) {
      if (!column.name) inconsistencies.push({ reason: `SQLModel table ${table.table_name || table.class_name || "unknown"} has a column without name` });
    }
  }
  for (const [tableName, records] of names) {
    if (records.length > 1) inconsistencies.push({ reason: `schema-ledger has ${records.length} records for table ${tableName}` });
  }
  return {
    file: toPosix(path.relative(repositoryRoot, ledgerFile)),
    tables: [...tables].sort((left, right) => compareText(left.table_name || "", right.table_name || "")),
    inconsistencies: inconsistencies.sort((left, right) => compareText(left.reason, right.reason)),
  };
}

function sqlModelTypeFamily(column) {
  const value = String(column.sqlalchemy_type && column.sqlalchemy_type.value || "").toLowerCase();
  if (/(numeric|decimal)/.test(value)) return "decimal";
  if (/bigint/.test(value)) return "long";
  if (/tinyint/.test(value)) return "tinyint";
  if (/smallint/.test(value)) return "smallint";
  if (/integer/.test(value)) return "integer";
  if (/boolean/.test(value)) return "boolean";
  if (/datetime|timestamp/.test(value)) return "datetime";
  if (/date\(/.test(value)) return "date";
  if (/time\(/.test(value)) return "time";
  if (/(string|text|varchar|char)/.test(value)) return "string";
  return null;
}

function javaTypeFamily(javaType) {
  const simple = String(javaType || "").replace(/.*\./, "").replace(/<.*$/, "").trim();
  if (["BigDecimal", "Double", "double", "Float", "float"].includes(simple)) return "decimal";
  if (["Long", "long", "BigInteger"].includes(simple)) return "long";
  if (["Integer", "int"].includes(simple)) return "integer";
  if (["Short", "short"].includes(simple)) return "smallint";
  if (["Byte", "byte"].includes(simple)) return "tinyint";
  if (["Boolean", "boolean"].includes(simple)) return "boolean";
  if (["Instant", "LocalDateTime", "OffsetDateTime", "ZonedDateTime", "Timestamp"].includes(simple)) return "datetime";
  if (["LocalDate", "Date"].includes(simple)) return "date";
  if (["LocalTime", "Time"].includes(simple)) return "time";
  if (["String", "Character", "char", "Character[]"].includes(simple)) return "string";
  return null;
}

function jdbcTypeCodeFamily(jdbcTypeCode) {
  const value = String(jdbcTypeCode || "").replace(/\s+/g, "").toUpperCase();
  if (!value) return null;
  if (/(?:SQLTYPES|TYPES)\.BIGINT/.test(value)) return "long";
  if (/(?:SQLTYPES|TYPES)\.INTEGER/.test(value)) return "integer";
  if (/(?:SQLTYPES|TYPES)\.SMALLINT/.test(value)) return "smallint";
  if (/(?:SQLTYPES|TYPES)\.TINYINT/.test(value)) return "tinyint";
  if (/(?:SQLTYPES|TYPES)\.(?:DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL)/.test(value)) return "decimal";
  if (/(?:SQLTYPES|TYPES)\.BOOLEAN/.test(value)) return "boolean";
  if (/(?:SQLTYPES|TYPES)\.(?:TIMESTAMP|TIMESTAMP_WITH_TIMEZONE)/.test(value)) return "datetime";
  if (/(?:SQLTYPES|TYPES)\.DATE/.test(value)) return "date";
  if (/(?:SQLTYPES|TYPES)\.TIME/.test(value)) return "time";
  if (/(?:SQLTYPES|TYPES)\.(?:VARCHAR|CHAR|LONGVARCHAR|CLOB)/.test(value)) return "string";
  return null;
}

function clueStatus(reference, java) {
  if (reference === null || reference === undefined || java === null || java === undefined) return "unresolved";
  return reference === java ? "matches" : "differs";
}

function compareColumns(referenceColumn, javaColumn) {
  const sqlFamily = sqlModelTypeFamily(referenceColumn);
  const jdbcFamily = jdbcTypeCodeFamily(javaColumn.jdbc_type_code);
  const javaFamily = jdbcFamily || javaTypeFamily(javaColumn.java_type);
  const referenceForeignKeys = (referenceColumn.foreign_keys || []).map((foreignKey) => foreignKey.target).sort(compareText);
  const javaForeignKey = javaColumn.foreign_key && javaColumn.foreign_key.target_table
    ? `${javaColumn.foreign_key.target_table}.${javaColumn.foreign_key.referenced_column_name || "id"}`
    : null;
  return {
    name: referenceColumn.name,
    primary_key: { reference: referenceColumn.primary_key === true, java: javaColumn.primary_key === true, status: clueStatus(referenceColumn.primary_key === true, javaColumn.primary_key === true) },
    nullable: { reference: referenceColumn.nullable ? referenceColumn.nullable.value : null, java: javaColumn.nullable.value, status: clueStatus(referenceColumn.nullable ? referenceColumn.nullable.value : null, javaColumn.nullable.value) },
    type: {
      reference: referenceColumn.sqlalchemy_type ? referenceColumn.sqlalchemy_type.value : null,
      java: javaColumn.java_type,
      jdbc_type_code: javaColumn.jdbc_type_code,
      reference_family: sqlFamily,
      java_family: javaFamily,
      status: clueStatus(sqlFamily, javaFamily),
    },
    precision: { reference: referenceColumn.precision, java: javaColumn.precision, status: clueStatus(referenceColumn.precision, javaColumn.precision) },
    scale: { reference: referenceColumn.scale, java: javaColumn.scale, status: clueStatus(referenceColumn.scale, javaColumn.scale) },
    max_length: { reference: referenceColumn.max_length, java: javaColumn.length, status: clueStatus(referenceColumn.max_length, javaColumn.length) },
    foreign_key: { reference: referenceForeignKeys, java: javaForeignKey, status: referenceForeignKeys.length === 0 && !javaForeignKey ? "matches" : javaForeignKey ? "partially_determined" : "unresolved" },
  };
}

function compareOwner(referenceTable, entity) {
  const referenceColumns = new Map((referenceTable.columns || []).map((column) => [column.name, column]));
  const javaColumns = new Map();
  for (const column of entity.columns) javaColumns.set(column.name, [...(javaColumns.get(column.name) || []), column]);
  const duplicateColumnNames = [...javaColumns.entries()].filter(([, columns]) => columns.length > 1).map(([name]) => name).sort(compareText);
  const missingColumns = [...referenceColumns.keys()].filter((name) => !javaColumns.has(name)).sort(compareText);
  const extraColumns = [...javaColumns.keys()].filter((name) => !referenceColumns.has(name)).sort(compareText);
  const columnClues = [...referenceColumns.keys()].filter((name) => javaColumns.has(name)).sort(compareText)
    .map((name) => compareColumns(referenceColumns.get(name), javaColumns.get(name)[0]));
  return {
    entity_name: entity.entity_name,
    source: entity.source,
    mapped_columns: entity.columns,
    mapped_column_count: entity.columns.length,
    missing_columns: missingColumns,
    extra_columns: extraColumns,
    duplicate_java_column_names: duplicateColumnNames,
    column_clues: columnClues,
  };
}

function duplicateTableOwners(entities) {
  const groups = new Map();
  for (const entity of entities) {
    if (!entity.table_name) continue;
    groups.set(entity.table_name, [...(groups.get(entity.table_name) || []), entity]);
  }
  return [...groups.entries()].filter(([, owners]) => owners.length > 1).map(([table_name, owners]) => ({
    table_name,
    owners: owners.map((owner) => ({ entity_name: owner.entity_name, source: owner.source })),
  })).sort((left, right) => compareText(left.table_name, right.table_name));
}

function buildCoverage(repositoryRoot, options = {}) {
  const expectedTableCount = options.expectedTableCount || EXPECTED_TABLE_COUNT;
  const reference = readReferenceLedger(repositoryRoot, expectedTableCount);
  const java = parseJavaEntities(repositoryRoot);
  const ownersByTable = new Map();
  for (const entity of java.entities) {
    if (entity.table_name) ownersByTable.set(entity.table_name, [...(ownersByTable.get(entity.table_name) || []), entity]);
  }
  const referenceNames = new Set(reference.tables.map((table) => table.table_name));
  const tables = reference.tables.map((referenceTable) => {
    const owners = ownersByTable.get(referenceTable.table_name) || [];
    const ownerComparisons = owners.map((owner) => compareOwner(referenceTable, owner));
    return {
      table_name: referenceTable.table_name,
      sqlmodel: {
        class_name: referenceTable.class_name,
        source_file: referenceTable.source_file,
        source_line: referenceTable.source_line,
        columns: referenceTable.columns || [],
      },
      mapped_entities: ownerComparisons,
      owner_status: owners.length === 0 ? "unmapped" : owners.length === 1 ? "mapped" : "duplicate_owners",
      mapped_column_count: ownerComparisons.length === 1 ? ownerComparisons[0].mapped_column_count : null,
      missing_columns: ownerComparisons.length === 1 ? ownerComparisons[0].missing_columns : [],
      extra_columns: ownerComparisons.length === 1 ? ownerComparisons[0].extra_columns : [],
    };
  });
  const extraJavaTables = [...ownersByTable.entries()].filter(([tableName]) => !referenceNames.has(tableName)).map(([table_name, owners]) => ({
    table_name,
    owners: owners.map((owner) => ({ entity_name: owner.entity_name, source: owner.source, mapped_columns: owner.columns })),
  })).sort((left, right) => compareText(left.table_name, right.table_name));
  const unmappedTables = tables.filter((table) => table.owner_status === "unmapped").map((table) => table.table_name);
  const missingColumns = tables.flatMap((table) => table.mapped_entities.flatMap((owner) => owner.missing_columns.map((column_name) => ({ table_name: table.table_name, entity_name: owner.entity_name, column_name }))));
  const extraColumns = tables.flatMap((table) => table.mapped_entities.flatMap((owner) => owner.extra_columns.map((column_name) => ({ table_name: table.table_name, entity_name: owner.entity_name, column_name }))));
  const differenceRecords = (property) => tables.flatMap((table) => table.mapped_entities.flatMap((owner) => owner.column_clues
    .filter((column) => column[property].status === "differs")
    .map((column) => ({ table_name: table.table_name, entity_name: owner.entity_name, column_name: column.name }))))
    .sort((left, right) => compareText(left.table_name, right.table_name) || compareText(left.entity_name, right.entity_name) || compareText(left.column_name, right.column_name));
  const unresolvedKnownNumericFacetRecords = (property) => tables.flatMap((table) => table.mapped_entities.flatMap((owner) => owner.column_clues
    .filter((column) => column[property].reference !== null && column[property].reference !== undefined && column[property].status === "unresolved")
    .map((column) => ({ table_name: table.table_name, entity_name: owner.entity_name, column_name: column.name }))))
    .sort((left, right) => compareText(left.table_name, right.table_name) || compareText(left.entity_name, right.entity_name) || compareText(left.column_name, right.column_name));
  const unresolvedJavaTableNames = java.entities.filter((entity) => !entity.table_name).map((entity) => ({ entity_name: entity.entity_name, source: entity.source, reason: entity.table_name_reason }));
  const duplicateOwners = duplicateTableOwners(java.entities);
  const mappedReferenceTableCount = tables.filter((table) => table.owner_status !== "unmapped").length;
  return {
    schema_version: 1,
    generated_by: GENERATED_BY,
    source: {
      schema_ledger_file: reference.file,
      java_source_root: java.java_root,
      expected_sqlmodel_table_count: expectedTableCount,
      java_source_file_count: java.source_files.length,
    },
    coverage: {
      status: "partial_migration_inventory",
      reference_table_count: tables.length,
      mapped_reference_table_count: mappedReferenceTableCount,
      unmapped_reference_table_count: unmappedTables.length,
      mapped_reference_table_percent: Number(((mappedReferenceTableCount / Math.max(1, tables.length)) * 100).toFixed(2)),
      java_entity_count: java.entities.length,
      java_table_mapping_count: ownersByTable.size,
    },
    verification: {
      reference_ledger_inconsistencies: reference.inconsistencies,
      parser_source_inconsistencies: java.parser_source_inconsistencies,
      duplicate_java_table_mappings: duplicateOwners,
      unresolved_java_table_names: unresolvedJavaTableNames,
      unresolved_required_ownership: unmappedTables.map((table_name) => ({ table_name, reason: "no Java @Entity/@Table owner" })),
      mapped_column_type_differences: differenceRecords("type"),
      mapped_column_precision_differences: differenceRecords("precision"),
      mapped_column_scale_differences: differenceRecords("scale"),
      mapped_column_precision_unresolved: unresolvedKnownNumericFacetRecords("precision"),
      mapped_column_scale_unresolved: unresolvedKnownNumericFacetRecords("scale"),
    },
    tables,
    extra_java_tables: extraJavaTables,
    missing_java_tables: unmappedTables,
    column_gaps: {
      missing_columns: missingColumns.sort((left, right) => compareText(left.table_name, right.table_name) || compareText(left.entity_name, right.entity_name) || compareText(left.column_name, right.column_name)),
      extra_columns: extraColumns.sort((left, right) => compareText(left.table_name, right.table_name) || compareText(left.entity_name, right.entity_name) || compareText(left.column_name, right.column_name)),
    },
    java_entities: java.entities,
  };
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/`/g, "\\`");
}

function entityLabel(owner) {
  return `\`${owner.entity_name}\` ([${owner.source.source_file}:${owner.source.source_line}](../../${owner.source.source_file}))`;
}

function renderMarkdown(coverage) {
  const { verification } = coverage;
  const lines = [
    "# Spring JPA Schema Coverage",
    "",
    `Generated by \`${GENERATED_BY}\`. Do not edit generated output manually.`,
    "",
    "## Status",
    "",
    "This is a partial-migration inventory. It does not claim that the Spring migration is complete.",
    "",
    `- SQLModel reference tables: ${coverage.coverage.reference_table_count} (expected ${coverage.source.expected_sqlmodel_table_count})`,
    `- Reference tables with one or more Java mappings: ${coverage.coverage.mapped_reference_table_count} (${coverage.coverage.mapped_reference_table_percent}%)`,
    `- Reference tables without a Java owner: ${coverage.coverage.unmapped_reference_table_count}`,
    `- Parsed Java entities: ${coverage.coverage.java_entity_count}`,
    `- Distinct explicit Java table names: ${coverage.coverage.java_table_mapping_count}`,
    `- Duplicate Java table-owner groups: ${verification.duplicate_java_table_mappings.length}`,
    `- Java entities without a statically resolved table name: ${verification.unresolved_java_table_names.length}`,
    `- Mapped column type differences: ${verification.mapped_column_type_differences.length}`,
    `- Mapped column precision differences: ${verification.mapped_column_precision_differences.length}`,
    `- Mapped column scale differences: ${verification.mapped_column_scale_differences.length}`,
    `- Mapped column unresolved required precision values: ${verification.mapped_column_precision_unresolved.length}`,
    `- Mapped column unresolved required scale values: ${verification.mapped_column_scale_unresolved.length}`,
    "",
    "## Verification Modes",
    "",
    "- `--verify` checks reference-ledger consistency, parser/source consistency, duplicate explicit Java table mappings, unresolved Java table names, concrete type/precision/scale differences, missing Java precision/scale for known source facets, and whether both generated files are stale.",
    "- `--verify-complete` runs `--verify` and additionally fails on unmapped or extra tables, missing or extra columns, and unresolved required ownership.",
    "",
    "## Static Analysis Boundaries",
    "",
    "- This dependency-free scanner reads annotations and direct field declarations. It is not a Java compiler or a Hibernate metadata bootstrap.",
    "- `@MappedSuperclass` fields and parsed `@EmbeddedId` components are included. Runtime naming strategies, XML mappings, method/property access, and dynamically constructed annotation values are not assumed.",
    "- Package-private and nested entities are recorded with their visibility and enclosing types. A Java source file can own multiple classes or entities; filenames are never treated as unique entity identities.",
    "- Column type, nullability, primary-key, foreign-key, length, precision, and scale data are compared only when source annotations or declarations make them static. `@JdbcTypeCode` is interpreted as the physical Hibernate type. The JSON artifact contains the complete per-column evidence.",
    "",
    "## Table Coverage",
    "",
    "| SQLModel table | Java entity/source | Mapped columns | Missing columns | Extra columns | Ownership |",
    "| --- | --- | ---: | --- | --- | --- |",
  ];
  for (const table of coverage.tables) {
    const owners = table.mapped_entities;
    const sources = owners.length ? owners.map(entityLabel).join("<br>") : "unmapped";
    const mappedColumns = owners.length === 1 ? owners[0].mapped_column_count : owners.length ? owners.map((owner) => `${owner.entity_name}: ${owner.mapped_column_count}`).join("; ") : 0;
    const missing = owners.length === 1 ? owners[0].missing_columns.join(", ") || "none" : owners.length ? "per-owner JSON evidence" : "all reference columns";
    const extra = owners.length === 1 ? owners[0].extra_columns.join(", ") || "none" : owners.length ? "per-owner JSON evidence" : "none";
    lines.push(`| \`${markdownCell(table.table_name)}\` | ${sources} | ${markdownCell(mappedColumns)} | ${markdownCell(missing)} | ${markdownCell(extra)} | ${table.owner_status} |`);
  }
  lines.push("", "## Duplicate Java Table Owners", "");
  if (verification.duplicate_java_table_mappings.length === 0) lines.push("No duplicate explicit Java table mappings.");
  else {
    lines.push("| Table | Java owners |", "| --- | --- |");
    for (const duplicate of verification.duplicate_java_table_mappings) {
      lines.push(`| \`${markdownCell(duplicate.table_name)}\` | ${duplicate.owners.map(entityLabel).join("<br>")} |`);
    }
  }
  lines.push("", "## Unresolved Java Table Names", "");
  if (verification.unresolved_java_table_names.length === 0) lines.push("No unresolved Java table names.");
  else {
    for (const unresolved of verification.unresolved_java_table_names) lines.push(`- ${entityLabel(unresolved)}: ${unresolved.reason}.`);
  }
  lines.push("", "## Complete-Mode Gaps", "");
  lines.push(`- Unmapped SQLModel tables: ${coverage.missing_java_tables.length}`);
  lines.push(`- Extra Java tables: ${coverage.extra_java_tables.length}`);
  lines.push(`- Per-owner missing columns: ${coverage.column_gaps.missing_columns.length}`);
  lines.push(`- Per-owner extra columns: ${coverage.column_gaps.extra_columns.length}`);
  lines.push("", "See `spring-schema-coverage.json` for all entity sources, mapped columns, and statically determined comparison clues.", "");
  return lines.join("\n");
}

function outputPaths(repositoryRoot) {
  const directory = path.join(repositoryRoot, "docs", "spring-migration");
  return {
    directory,
    json: path.join(directory, "spring-schema-coverage.json"),
    markdown: path.join(directory, "spring-schema-coverage.md"),
  };
}

function withSingleTrailingNewline(contents) {
  return `${contents.replace(/\n+$/, "")}\n`;
}

function writeCoverage(repositoryRoot, coverage) {
  const outputs = outputPaths(repositoryRoot);
  fs.mkdirSync(outputs.directory, { recursive: true });
  fs.writeFileSync(outputs.json, `${JSON.stringify(coverage, null, 2)}\n`);
  fs.writeFileSync(outputs.markdown, withSingleTrailingNewline(renderMarkdown(coverage)));
}

function staleOutputs(repositoryRoot, coverage) {
  const outputs = outputPaths(repositoryRoot);
  const expected = {
    json: `${JSON.stringify(coverage, null, 2)}\n`,
    markdown: withSingleTrailingNewline(renderMarkdown(coverage)),
  };
  return Object.entries(expected).filter(([kind, contents]) => !fs.existsSync(outputs[kind]) || fs.readFileSync(outputs[kind], "utf8") !== contents)
    .map(([kind]) => toPosix(path.relative(repositoryRoot, outputs[kind])));
}

function verifyCoverage(coverage, repositoryRoot, options = {}) {
  const failures = [];
  const verification = coverage.verification;
  if (verification.reference_ledger_inconsistencies.length > 0) failures.push(`${verification.reference_ledger_inconsistencies.length} reference-ledger inconsistencies found`);
  if (verification.parser_source_inconsistencies.length > 0) failures.push(`${verification.parser_source_inconsistencies.length} parser/source inconsistencies found`);
  if (verification.duplicate_java_table_mappings.length > 0) failures.push(`${verification.duplicate_java_table_mappings.length} duplicate Java table mappings found`);
  if (verification.unresolved_java_table_names.length > 0) failures.push(`${verification.unresolved_java_table_names.length} Java entities have unresolved table names`);
  if (verification.mapped_column_type_differences.length > 0) failures.push(`${verification.mapped_column_type_differences.length} mapped column type differences found`);
  if (verification.mapped_column_precision_differences.length > 0) failures.push(`${verification.mapped_column_precision_differences.length} mapped column precision differences found`);
  if (verification.mapped_column_scale_differences.length > 0) failures.push(`${verification.mapped_column_scale_differences.length} mapped column scale differences found`);
  if (verification.mapped_column_precision_unresolved.length > 0) failures.push(`${verification.mapped_column_precision_unresolved.length} mapped column precision values are unresolved`);
  if (verification.mapped_column_scale_unresolved.length > 0) failures.push(`${verification.mapped_column_scale_unresolved.length} mapped column scale values are unresolved`);
  if (options.checkOutput !== false) {
    const stale = staleOutputs(repositoryRoot, coverage);
    if (stale.length > 0) failures.push(`generated output is stale: ${stale.join(", ")}`);
  }
  if (options.complete) {
    if (coverage.missing_java_tables.length > 0) failures.push(`${coverage.missing_java_tables.length} SQLModel tables have no Java owner`);
    if (coverage.extra_java_tables.length > 0) failures.push(`${coverage.extra_java_tables.length} Java tables are absent from schema-ledger`);
    if (coverage.column_gaps.missing_columns.length > 0) failures.push(`${coverage.column_gaps.missing_columns.length} per-owner missing columns found`);
    if (coverage.column_gaps.extra_columns.length > 0) failures.push(`${coverage.column_gaps.extra_columns.length} per-owner extra columns found`);
    if (verification.unresolved_required_ownership.length > 0) failures.push(`${verification.unresolved_required_ownership.length} required table owners are unresolved`);
  }
  return failures;
}

function main() {
  const argumentsList = process.argv.slice(2);
  const verify = argumentsList.includes("--verify") || argumentsList.includes("--verify-complete");
  const complete = argumentsList.includes("--verify-complete");
  const unknown = argumentsList.filter((argument) => !["--verify", "--verify-complete"].includes(argument));
  if (unknown.length > 0 || (argumentsList.includes("--verify") && argumentsList.includes("--verify-complete"))) {
    console.error("Usage: node scripts/spring-migration/spring-schema-coverage.js [--verify | --verify-complete]");
    process.exitCode = 2;
    return;
  }
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const coverage = buildCoverage(repositoryRoot);
  if (!verify) {
    writeCoverage(repositoryRoot, coverage);
    console.log(`Spring schema coverage generated: ${coverage.coverage.mapped_reference_table_count}/${coverage.coverage.reference_table_count} reference tables mapped (${coverage.coverage.mapped_reference_table_percent}%).`);
    return;
  }
  const failures = verifyCoverage(coverage, repositoryRoot, { complete });
  if (failures.length > 0) {
    console.error(`Spring schema coverage verification failed: ${failures.join("; ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Spring schema coverage verification passed${complete ? " (complete)" : ""}.`);
}

if (require.main === module) main();

module.exports = {
  EXPECTED_TABLE_COUNT,
  buildCoverage,
  findMatching,
  parseJavaSource,
  renderMarkdown,
  staleOutputs,
  verifyCoverage,
  writeCoverage,
};
