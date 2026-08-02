"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildLedger,
  checkSchemaLedgerArtifacts,
  findClosingParen,
  parseMigrations,
  parseModelFile,
  scanAccesses,
  verifyCompleteLedger,
  verifyLedger,
  writeLedger,
} = require("./schema-ledger");

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

const modelSource = `\
from typing import Optional
from sqlalchemy import CheckConstraint, Column, ForeignKey, ForeignKeyConstraint, Index, Integer, Numeric, UniqueConstraint, text
from sqlmodel import Field, SQLModel

class LedgerItem(SQLModel, table=True):
    __tablename__ = "ledger_items"
    __table_args__ = (
        UniqueConstraint("code", "period", name="uq_ledger_item_code_period"),
        CheckConstraint("amount >= 0 AND note != ')'", name="ck_ledger_item_amount"),
        Index("ix_ledger_item_period_code", "period", "code"),
        ForeignKeyConstraint(["owner_id", "owner_type"], ["owners.id", "owners.type"], name="fk_ledger_owner"),
    )

    id: Optional[int] = Field(default=None, sa_column=Column(Integer, primary_key=True, nullable=False))
    owner_id: int
    owner_type: str
    amount: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True, server_default=text("0")),
    )
    required_from_migration: Optional[str] = Field(default=None)
    code: str = Field(index=True, unique=True, max_length=30)
    created_at: str = Field(default_factory=utc_now)

class MissingName(SQLModel, table=True):
    id: int = Field(primary_key=True)
`;

const tables = parseModelFile(modelSource, "backend/app/models/sample.py");
assert.strictEqual(tables.length, 2);
assert.strictEqual(tables[0].table_name, "ledger_items");
assert.strictEqual(tables[0].columns.find((column) => column.name === "amount").precision, 12);
assert.strictEqual(tables[0].columns.find((column) => column.name === "amount").scale, 2);
assert.strictEqual(tables[0].columns.find((column) => column.name === "owner_id").foreign_keys[0].target, "owners.id");
assert.strictEqual(tables[0].check_constraints[0].expression, "amount >= 0 AND note != ')'");
assert.ok(tables[0].indexes.some((index) => index.name === "ix_ledger_item_period_code"));
assert.ok(tables[0].unique_constraints.some((constraint) => constraint.name === "uq_ledger_item_code_period"));
assert.strictEqual(findClosingParen("Column(text(\")\"), nullable=False)", 6), 32);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "schema-ledger-"));
try {
  writeFile(temporaryRoot, "backend/app/models/sample.py", modelSource.replace(/class MissingName[\s\S]*/, ""));
  writeFile(temporaryRoot, "backend/app/services/sample.py", "from app.models.sample import LedgerItem\n\ndef load(session):\n    return session.exec(select(LedgerItem))\n\ndef save():\n    return LedgerItem(code='A')\n");
  writeFile(temporaryRoot, "backend-spring/src/main/java/com/example/ExampleService.java", "class ExampleService { }\n");
  writeFile(temporaryRoot, "backend-spring/src/main/resources/db/migration/V1__alembic_head_baseline.sql", "CREATE TABLE ledger_items (created_at timestamp not null);\n");
  writeFile(temporaryRoot, "backend/migrations/versions/001_sample.py", `\
revision = "001"
def upgrade():
    op.create_table(
        "ledger_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("owner_type", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=True, server_default=sa.text("0")),
        sa.Column("required_from_migration", sa.String(length=12), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("amount >= 0", name="ck_ledger_item_amount"),
    )
    op.create_index("ix_ledger_items_code", "ledger_items", ["code"], unique=True)
    op.create_unique_constraint("uq_ledger_items_period", "ledger_items", ["period"])
`);

  const migrations = parseMigrations(temporaryRoot);
  assert.strictEqual(migrations.records.get("ledger_items").columns.get("amount").precision, 12);
  assert.strictEqual(migrations.records.get("ledger_items").indexes[0].columns[0], "code");
  assert.strictEqual(migrations.records.get("ledger_items").unique_constraints[0].name, "uq_ledger_items_period");

  const accesses = scanAccesses(temporaryRoot, "LedgerItem");
  assert.strictEqual(accesses.readers.length, 1);
  assert.strictEqual(accesses.writers.length, 1);

  const unreviewedLedger = buildLedger(temporaryRoot, 1);
  const defaultFactory = unreviewedLedger.default_factory_items[0];
  const registry = {
    schema_version: 1,
    decisions: [{
      default_factory_key: defaultFactory.default_factory_key,
      source_default_factory: defaultFactory.source_default_factory,
      behavior: { value: "service_instant_now", detail: "ExampleService assigns the current instant." },
      source_ref: { source_file: "backend/app/models/sample.py", source_line: defaultFactory.source_line, factory: "utc_now" },
      implementation_ref: { source_file: "backend-spring/src/main/java/com/example/ExampleService.java", symbol: "ExampleService" },
      java_owner: { source_file: "backend-spring/src/main/java/com/example/ExampleService.java", symbol: "ExampleService" },
      flyway: { source_file: "backend-spring/src/main/resources/db/migration/V1__alembic_head_baseline.sql", table_name: "ledger_items", default_strategy: "application_service" },
    }],
  };
  writeFile(temporaryRoot, "docs/spring-migration/schema-default-decision-registry.json", `${JSON.stringify(registry, null, 2)}\n`);

  const ledger = buildLedger(temporaryRoot, 1);
  assert.deepStrictEqual(verifyLedger(ledger), []);
  assert.strictEqual(ledger.complete_verification.passed, true);
  assert.strictEqual(ledger.tables[0].columns.find((column) => column.name === "amount").sqlalchemy_type.value, "Numeric(12, 2)");
  assert.strictEqual(ledger.tables[0].columns.find((column) => column.name === "id").primary_key, true);
  assert.deepStrictEqual(ledger.tables[0].columns.find((column) => column.name === "required_from_migration").nullable, { value: false, source: "Alembic migration" });
  const codeIndex = ledger.tables[0].indexes.find((index) => index.name === "ix_ledger_items_code");
  assert.strictEqual(codeIndex.evidence.length, 2);

  const invalidLedger = {
    ...ledger,
    source_table_count: 2,
    verification: {
      source_count_matches_expected: false,
      missing_table_names: [{ class_name: "MissingName" }],
      duplicate_table_names: [{ table_name: "ledger_items" }],
      unresolved_source_locations: [{ class_name: "LedgerItem" }],
    },
  };
  const failures = verifyLedger(invalidLedger).join(" ");
  assert.match(failures, /expected 1 SQLModel table classes/);
  assert.match(failures, /no table name/);
  assert.match(failures, /duplicate table-name groups/);
  assert.match(failures, /source locations/);

  const missingDecision = structuredClone(ledger);
  missingDecision.decision_registry.decisions = [];
  assert.match(verifyCompleteLedger(missingDecision, temporaryRoot).failures.join(" "), /missing reviewed decisions/);

  const extraDecision = structuredClone(ledger);
  extraDecision.decision_registry.decisions.push({ ...structuredClone(extraDecision.decision_registry.decisions[0]), default_factory_key: "ledger_items.extra @ backend/app/models/sample.py:999" });
  assert.match(verifyCompleteLedger(extraDecision, temporaryRoot).failures.join(" "), /stale or do not map/);

  const duplicateDecision = structuredClone(ledger);
  duplicateDecision.decision_registry.decisions.push(structuredClone(duplicateDecision.decision_registry.decisions[0]));
  assert.match(verifyCompleteLedger(duplicateDecision, temporaryRoot).failures.join(" "), /duplicate default-factory decision keys/);

  const placeholderDecision = structuredClone(ledger);
  placeholderDecision.decision_registry.decisions[0].java_owner.symbol = "TODO";
  assert.match(verifyCompleteLedger(placeholderDecision, temporaryRoot).failures.join(" "), /placeholder/);

  const tautologicalDecision = structuredClone(ledger);
  tautologicalDecision.decision_registry.decisions[0].behavior.detail = "The default behavior is service_instant_now.";
  assert.match(verifyCompleteLedger(tautologicalDecision, temporaryRoot).failures.join(" "), /tautological/);

  for (const malformedEntry of [null, {}, { default_factory_key: "   " }, { default_factory_key: 7 }]) {
    const malformedRegistry = structuredClone(ledger);
    malformedRegistry.decision_registry.decisions.push(malformedEntry);
    assert.match(verifyLedger(malformedRegistry).join(" "), /malformed default-decision registry entries/);
    assert.match(verifyCompleteLedger(malformedRegistry, temporaryRoot).failures.join(" "), /malformed default-decision registry entries/);
  }

  writeLedger(temporaryRoot, ledger);
  assert.deepStrictEqual(checkSchemaLedgerArtifacts(temporaryRoot, ledger), []);
  const stalePath = path.join(temporaryRoot, "docs/spring-migration/schema-ledger.md");
  fs.writeFileSync(stalePath, "stale\n");
  const beforeCheck = fs.readFileSync(stalePath, "utf8");
  assert.match(checkSchemaLedgerArtifacts(temporaryRoot, ledger).join(" "), /schema-ledger\.md is stale/);
  assert.strictEqual(fs.readFileSync(stalePath, "utf8"), beforeCheck);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("schema-ledger tests passed");
