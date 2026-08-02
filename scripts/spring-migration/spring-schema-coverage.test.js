"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildCoverage,
  parseJavaSource,
  staleOutputs,
  verifyCoverage,
  writeCoverage,
} = require("./spring-schema-coverage");

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function column(name, options = {}) {
  return {
    name,
    sqlalchemy_type: { value: options.type || "Integer()" },
    nullable: { value: options.nullable === undefined ? false : options.nullable },
    primary_key: options.primary_key === true,
    foreign_keys: options.foreign_keys || [],
    precision: options.precision === undefined ? null : options.precision,
    scale: options.scale === undefined ? null : options.scale,
    max_length: options.max_length === undefined ? null : options.max_length,
  };
}

function referenceLedger() {
  return {
    schema_version: 1,
    expected_table_count: 2,
    source_table_count: 2,
    tables: [
      {
        table_name: "owners",
        class_name: "OwnerRecord",
        source_file: "backend/app/models/example.py",
        source_line: 1,
        columns: [column("id", { primary_key: true })],
      },
      {
        table_name: "people",
        class_name: "PersonRecord",
        source_file: "backend/app/models/example.py",
        source_line: 10,
        columns: [
          column("tenant_id", { primary_key: true }),
          column("person_id", { primary_key: true }),
          column("name", { type: "AutoString(length=80)", max_length: 80 }),
          column("created_at", { type: "DateTime()" }),
          column("amount", { type: "Numeric(12, 2)", precision: 12, scale: 2, nullable: true }),
          column("owner_id", { foreign_keys: [{ target: "owners.id" }] }),
          column("required_col"),
        ],
      },
    ],
  };
}

// Canonical Flyway SERIAL/INTEGER IDs must use Java Integer end-to-end.
const integerEntityContracts = [
  ["app_code_groups", "id"],
  ["app_codes", "id"], ["app_codes", "group_id"],
  ["app_menu_actions", "id"], ["app_menu_actions", "menu_id"],
  ["app_menu_roles", "menu_id"], ["app_menu_roles", "role_id"],
  ["app_menus", "id"], ["app_menus", "parent_id"],
  ["app_role_menu_actions", "id"], ["app_role_menu_actions", "menu_id"], ["app_role_menu_actions", "role_id"],
  ["app_system_setting_history", "id"], ["app_system_setting_history", "setting_id"], ["app_system_setting_history", "changed_by"],
  ["app_system_settings", "id"], ["app_system_settings", "updated_by"],
  ["auth_roles", "id"],
  ["auth_user_roles", "user_id"], ["auth_user_roles", "role_id"],
  ["auth_users", "id"],
  ["org_corporations", "id"],
  ["org_departments", "id"], ["org_departments", "parent_id"],
  ["org_dept_change_histories", "id"], ["org_dept_change_histories", "department_id"], ["org_dept_change_histories", "changed_by"],
  ["org_mapping_assignments", "id"], ["org_mapping_assignments", "department_id"], ["org_mapping_assignments", "item_id"], ["org_mapping_assignments", "created_by"], ["org_mapping_assignments", "updated_by"],
  ["org_mapping_type_items", "id"], ["org_mapping_type_items", "created_by"], ["org_mapping_type_items", "updated_by"],
  ["org_restructure_plan_items", "id"], ["org_restructure_plan_items", "plan_id"], ["org_restructure_plan_items", "target_dept_id"], ["org_restructure_plan_items", "new_parent_id"],
  ["org_restructure_plans", "id"], ["org_restructure_plans", "applied_by"], ["org_restructure_plans", "created_by"],
];

const productionCoverage = buildCoverage(path.resolve(__dirname, "../.."));
assert.strictEqual(productionCoverage.coverage.reference_table_count, 105);
assert.strictEqual(productionCoverage.coverage.mapped_reference_table_count, 105);
for (const [tableName, columnName] of integerEntityContracts) {
  const table = productionCoverage.tables.find((candidate) => candidate.table_name === tableName);
  assert.ok(table, `missing canonical table ${tableName}`);
  const sourceColumn = table.sqlmodel.columns.find((column) => column.name === columnName);
  assert.match(sourceColumn.sqlalchemy_type.value, /Integer/i, `${tableName}.${columnName} is no longer canonical INTEGER`);
  const mappedColumn = table.mapped_entities
    .flatMap((entity) => entity.mapped_columns)
    .find((column) => column.name === columnName);
  assert.ok(mappedColumn, `missing Java mapping ${tableName}.${columnName}`);
  assert.strictEqual(mappedColumn.java_type, "Integer", `${tableName}.${columnName} must use Java Integer`);
  assert.strictEqual(mappedColumn.jdbc_type_code, null, `${tableName}.${columnName} must not rely on a JDBC type override`);
}
assert.strictEqual(integerEntityContracts.length, 42);

const source = `
package fixture;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

// @Entity class IgnoredComment { }
@Embeddable
class PersonKey {
    @Column(name = "tenant_id", nullable = false) Long tenant;
    @Column(name = "person_id", nullable = false) Long person;
}

@MappedSuperclass
abstract class AuditFields {
    @Column(name = "created_at", nullable = false) Instant createdAt;
}

@Entity
@Table(name = "people")
class Person extends AuditFields {
    @EmbeddedId
    @AttributeOverrides({
        @AttributeOverride(name = "tenant", column = @Column(name = "tenant_id")),
        @AttributeOverride(name = "person", column = @Column(name = "person_id"))
    })
    PersonKey id;
    @Column(name = "name", nullable = false, length = 80) String name;
    @Column(name = "amount", precision = 12, scale = 2) BigDecimal amount;
    @ManyToOne @JoinColumn(name = "owner_id", nullable = false, referencedColumnName = "id") Owner owner;
    @Column(name = "extra_col") Integer extra;
}

class Holder {
    @Entity
    @Table(name = "owners")
    public static class Owner {
        @Id Long id;
    }
}

@Entity
@Table(name = "people")
class DuplicatePerson {
    @Id Long id;
}

@Entity
class NoStaticTableName {
    @Id Long id;
}
`;

const parsed = parseJavaSource(source, "backend-spring/src/main/java/fixture/PeopleEntities.java");
const personType = parsed.types.find((type) => type.simple_name === "Person");
assert.ok(personType.is_entity);
assert.strictEqual(personType.visibility, "package-private");
assert.strictEqual(parsed.types.find((type) => type.simple_name === "Owner").is_nested, true);
assert.strictEqual(parsed.errors.length, 0);

const propertyAccess = parseJavaSource(`
  import jakarta.persistence.*;
  @Entity @Table(name = "property_access")
  class PropertyAccess {
      @Id Long id;
      @Column(name = "name") String getName() { return "name"; }
  }
`, "backend-spring/src/main/java/fixture/PropertyAccess.java");
assert.match(propertyAccess.errors.map((error) => error.reason).join(" "), /property-access mappings/);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spring-schema-coverage-"));
try {
  writeFile(temporaryRoot, "docs/spring-migration/schema-ledger.json", `${JSON.stringify(referenceLedger(), null, 2)}\n`);
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", source);

  const coverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  const people = coverage.tables.find((table) => table.table_name === "people");
  const person = people.mapped_entities.find((entity) => entity.entity_name === "Person");
  assert.strictEqual(coverage.coverage.mapped_reference_table_count, 2);
  assert.strictEqual(people.owner_status, "duplicate_owners");
  assert.deepStrictEqual(person.missing_columns, ["required_col"]);
  assert.deepStrictEqual(person.extra_columns, ["extra_col"]);
  assert.strictEqual(person.mapped_columns.find((mapped) => mapped.name === "tenant_id").primary_key, true);
  assert.strictEqual(person.mapped_columns.find((mapped) => mapped.name === "created_at").inherited_from, "AuditFields");
  assert.strictEqual(person.mapped_columns.find((mapped) => mapped.name === "amount").precision, 12);
  assert.strictEqual(person.mapped_columns.find((mapped) => mapped.name === "amount").scale, 2);
  assert.strictEqual(person.mapped_columns.find((mapped) => mapped.name === "owner_id").foreign_key.target_table, "owners");
  assert.strictEqual(person.source.visibility, "package-private");
  assert.strictEqual(person.source.source_file_type_count, 7);
  assert.strictEqual(person.source.source_file_entity_count, 4);
  assert.strictEqual(coverage.verification.duplicate_java_table_mappings.length, 1);
  assert.strictEqual(coverage.verification.unresolved_java_table_names.length, 1);

  writeCoverage(temporaryRoot, coverage);
  const generatedMarkdown = fs.readFileSync(path.join(temporaryRoot, "docs/spring-migration/spring-schema-coverage.md"), "utf8");
  assert.ok(generatedMarkdown.endsWith("\n"));
  assert.ok(!generatedMarkdown.endsWith("\n\n"));
  const normalFailures = verifyCoverage(coverage, temporaryRoot);
  assert.match(normalFailures.join(" "), /duplicate Java table mappings/);
  assert.match(normalFailures.join(" "), /unresolved table names/);
  assert.match(normalFailures.join(" "), /mapped column type differences/);
  assert.match(verifyCoverage(coverage, temporaryRoot, { complete: true }).join(" "), /per-owner missing columns/);
  assert.match(verifyCoverage(coverage, temporaryRoot, { complete: true }).join(" "), /per-owner extra columns/);
  assert.match(verifyCoverage(coverage, temporaryRoot, { complete: true }).join(" "), /mapped column type differences/);

  fs.appendFileSync(path.join(temporaryRoot, "docs/spring-migration/spring-schema-coverage.md"), "stale\n");
  assert.strictEqual(staleOutputs(temporaryRoot, coverage).length, 1);
  assert.match(verifyCoverage(coverage, temporaryRoot).join(" "), /generated output is stale/);

  const cleanSource = source
    .replace(/\n@Entity\n@Table\(name = "people"\)\nclass DuplicatePerson \{[\s\S]*?\n\}\n/, "\n")
    .replace(/\n@Entity\nclass NoStaticTableName \{[\s\S]*?\n\}\n/, "\n")
    .replace('    @Column(name = "extra_col") Integer extra;\n', '    @Column(name = "required_col") Integer required;\n')
    .replace(/\bLong\b/g, "Integer");
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", cleanSource);
  const completeCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  writeCoverage(temporaryRoot, completeCoverage);
  assert.deepStrictEqual(verifyCoverage(completeCoverage, temporaryRoot), []);
  assert.deepStrictEqual(verifyCoverage(completeCoverage, temporaryRoot, { complete: true }), []);

  const jdbcTypedSource = cleanSource.replace("@Id Integer id;", "@Id @JdbcTypeCode(SqlTypes.INTEGER) Long id;");
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", jdbcTypedSource);
  const jdbcTypedCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  writeCoverage(temporaryRoot, jdbcTypedCoverage);
  assert.deepStrictEqual(verifyCoverage(jdbcTypedCoverage, temporaryRoot, { complete: true }), []);

  const precisionScaleMismatch = cleanSource.replace("precision = 12, scale = 2", "precision = 11, scale = 3");
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", precisionScaleMismatch);
  const precisionScaleCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  writeCoverage(temporaryRoot, precisionScaleCoverage);
  const precisionScaleFailures = verifyCoverage(precisionScaleCoverage, temporaryRoot).join(" ");
  assert.match(precisionScaleFailures, /mapped column precision differences/);
  assert.match(precisionScaleFailures, /mapped column scale differences/);

  const missingPrecisionScale = cleanSource.replace("precision = 12, scale = 2", "");
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", missingPrecisionScale);
  const missingPrecisionScaleCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  writeCoverage(temporaryRoot, missingPrecisionScaleCoverage);
  const missingPrecisionScaleFailures = verifyCoverage(missingPrecisionScaleCoverage, temporaryRoot).join(" ");
  assert.match(missingPrecisionScaleFailures, /mapped column precision values are unresolved/);
  assert.match(missingPrecisionScaleFailures, /mapped column scale values are unresolved/);

  const smallIntSource = `import org.hibernate.annotations.JdbcTypeCode;\nimport org.hibernate.type.SqlTypes;\n${cleanSource}`
    .replace("@Id Integer id;", "@Id @JdbcTypeCode(SqlTypes.SMALLINT) Integer id;");
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", smallIntSource);
  const smallIntCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  writeCoverage(temporaryRoot, smallIntCoverage);
  assert.match(verifyCoverage(smallIntCoverage, temporaryRoot).join(" "), /mapped column type differences/);

  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PeopleEntities.java", cleanSource);
  writeCoverage(temporaryRoot, buildCoverage(temporaryRoot, { expectedTableCount: 2 }));

  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/PropertyAccess.java", `
    import jakarta.persistence.*;
    @Entity @Table(name = "property_access")
    class PropertyAccess {
        @Id Long id;
        @Column(name = "name") String getName() { return "name"; }
    }
  `);
  const parserFailureCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 2 });
  writeCoverage(temporaryRoot, parserFailureCoverage);
  assert.match(verifyCoverage(parserFailureCoverage, temporaryRoot).join(" "), /parser\/source inconsistencies/);

  fs.rmSync(path.join(temporaryRoot, "backend-spring/src/main/java/fixture/PropertyAccess.java"));
  const gappedLedger = referenceLedger();
  gappedLedger.expected_table_count = 3;
  gappedLedger.source_table_count = 3;
  gappedLedger.tables.push({
    table_name: "missing_table",
    class_name: "MissingRecord",
    source_file: "backend/app/models/example.py",
    source_line: 20,
    columns: [column("id", { primary_key: true })],
  });
  writeFile(temporaryRoot, "docs/spring-migration/schema-ledger.json", `${JSON.stringify(gappedLedger, null, 2)}\n`);
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/ExtraTable.java", `
    import jakarta.persistence.*;
    @Entity @Table(name = "extra_table")
    class ExtraTable { @Id Long id; }
  `);
  const tableGapCoverage = buildCoverage(temporaryRoot, { expectedTableCount: 3 });
  writeCoverage(temporaryRoot, tableGapCoverage);
  const tableGapFailures = verifyCoverage(tableGapCoverage, temporaryRoot, { complete: true }).join(" ");
  assert.match(tableGapFailures, /SQLModel tables have no Java owner/);
  assert.match(tableGapFailures, /Java tables are absent from schema-ledger/);
  assert.match(tableGapFailures, /required table owners are unresolved/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("spring-schema-coverage tests passed");
