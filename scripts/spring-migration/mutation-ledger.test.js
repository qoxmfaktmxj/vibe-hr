"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  DECISION_FIELDS,
  buildMutationLedger,
  checkMutationLedgerArtifacts,
  renderMarkdown,
  verifyCompleteMutationLedger,
  verifyMutationLedger,
  writeMutationLedger,
} = require("./mutation-ledger");

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function fixtureManifest() {
  return {
    schema_version: 1,
    expected_source_count: 4,
    source_endpoint_count: 4,
    endpoints: [
      { method: "POST", full_path: "/api/v1/example/items", domain: "example", source_file: "backend/app/api/example.py", source_line: 5, function_name: "create_item", auth_clues: ["Depends(require_roles"] },
      { method: "POST", full_path: "/api/v1/example/items", domain: "example", source_file: "backend/app/api/example.py", source_line: 8, function_name: "create_item_shadow", auth_clues: [] },
      { method: "PATCH", full_path: "/api/v1/example/items/{item_id}", domain: "example", source_file: "backend/app/api/example.py", source_line: 11, function_name: "update_item", auth_clues: [] },
      { method: "GET", full_path: "/api/v1/example/items", domain: "example", source_file: "backend/app/api/example.py", source_line: 14, function_name: "list_items", auth_clues: [] },
    ],
    canonical_routes: {
      "POST /api/v1/example/items": {
        method: "POST",
        normalized_path: "/api/v1/example/items",
        effective_handler: { source_file: "backend/app/api/example.py", source_line: 5 },
      },
    },
  };
}

const apiSource = `\
from fastapi import APIRouter, Depends, status
from app.core.auth import get_current_user, require_roles
from app.services.example_service import create_item_service, update_item_service
router = APIRouter(prefix="/example")
@router.post("/items", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("admin"))])
def create_item(current_user = Depends(get_current_user)):
    return create_item_service()
@router.post("/items")
def create_item_shadow():
    return create_item_service()
@router.patch("/items/{item_id}")
def update_item(item_id: int):
    return update_item_service(item_id)
@router.get("/items")
def list_items():
    return []
`;

const serviceSource = `\
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.models import ExampleItem
def create_item_service(session: Session):
    duplicate = session.exec(select(ExampleItem)).first()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already exists")
    row = ExampleItem()
    session.add(row)
    session.commit()
    return row
def update_item_service(item_id: int, session: Session):
    row = session.get(ExampleItem, item_id)
    row.name = "updated"
    session.add(row)
    session.flush()
    return row
`;

function reviewedField(value, sourceHandler, handler) {
  return {
    value,
    rationale: `The FastAPI ${sourceHandler} mutation is reviewed against the mapped Spring ${handler} handler rather than inferred from the decision label.`,
    source_ref: { source_file: "backend/app/api/example.py", handler: sourceHandler },
    implementation_ref: { source_file: "backend-spring/src/main/java/com/example/ExampleController.java", handler },
  };
}

function activeDecision(ledgerKey, handler, sourceHandler) {
  return {
    ledger_key: ledgerKey,
    status: "active",
    canonical_handler_key: ledgerKey,
    spring_mapping: { source_file: "backend-spring/src/main/java/com/example/ExampleController.java", handler },
    migration_doc: { path: "backend-spring/docs/example-migration.md", anchor: "Example migration" },
    migration_decisions: {
      transaction_boundary: reviewedField("service_transactional", sourceHandler, handler),
      jpa_mybatis_owner: reviewedField("jpa", sourceHandler, handler),
      isolation: reviewedField("read_committed", sourceHandler, handler),
      lock_version_strategy: reviewedField("no_version", sourceHandler, handler),
      retry_deadlock: reviewedField("no_automatic_retry", sourceHandler, handler),
      idempotency: reviewedField("non_idempotent", sourceHandler, handler),
      http_conflict_mapping: reviewedField("conflict_409", sourceHandler, handler),
    },
  };
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mutation-ledger-"));
try {
  writeFile(temporaryRoot, "docs/spring-migration/endpoint-manifest.json", `${JSON.stringify(fixtureManifest(), null, 2)}\n`);
  writeFile(temporaryRoot, "backend/app/api/example.py", apiSource);
  writeFile(temporaryRoot, "backend/app/services/example_service.py", serviceSource);
  writeFile(temporaryRoot, "backend-spring/src/main/java/com/example/ExampleController.java", "class ExampleController { void createItem() {} void updateItem() {} }\n");
  writeFile(temporaryRoot, "backend-spring/docs/example-migration.md", "# Example migration\n");

  const canonicalKey = "POST /api/v1/example/items @ backend/app/api/example.py:5";
  const shadowedKey = "POST /api/v1/example/items @ backend/app/api/example.py:8";
  const registry = {
    schema_version: 1,
    decisions: [
      activeDecision(canonicalKey, "createItem", "create_item"),
      activeDecision("PATCH /api/v1/example/items/{item_id} @ backend/app/api/example.py:11", "updateItem", "update_item"),
      {
        ledger_key: shadowedKey,
        status: "retired_shadowed",
        canonical_handler_key: canonicalKey,
        migration_decisions: Object.fromEntries(DECISION_FIELDS.map((field) => [field, reviewedField("retired_shadowed", "create_item_shadow", "createItem")])),
      },
    ],
  };
  writeFile(temporaryRoot, "docs/spring-migration/mutation-decision-registry.json", `${JSON.stringify(registry, null, 2)}\n`);

  const ledger = buildMutationLedger(temporaryRoot);
  assert.strictEqual(ledger.records.length, 3);
  assert.strictEqual(ledger.verification.passed, true);
  assert.strictEqual(ledger.complete_verification.passed, true);
  assert.deepStrictEqual(buildMutationLedger(temporaryRoot), ledger);
  assert.strictEqual(ledger.records[0].ledger_key, "PATCH /api/v1/example/items/{item_id} @ backend/app/api/example.py:11");
  assert.ok(ledger.records[1].service_call_clues.some((clue) => clue.service_function === "create_item_service" && clue.resolved));
  assert.ok(ledger.records[1].transaction_call_clues.some((clue) => clue.clue.includes("session.commit()")));
  assert.ok(ledger.records[1].status_conflict_clues.some((clue) => clue.clue.includes("HTTP_409_CONFLICT")));
  assert.ok(ledger.records[1].touched_model_table_clues.some((clue) => clue.model_or_table === "ExampleItem"));
  assert.ok(ledger.records[1].current_permission_auth_clues.some((clue) => clue.clue.includes("require_roles")));
  assert.strictEqual(ledger.records[2].review_status, "retired_shadowed");
  assert.match(renderMarkdown(ledger), /Reviewed decisions are merged/);

  const missing = structuredClone(ledger);
  missing.records = missing.records.slice(1);
  assert.match(verifyMutationLedger(missing).failures.join(" "), /missing from the ledger/);

  const duplicate = structuredClone(ledger);
  duplicate.records.push(structuredClone(duplicate.records[0]));
  duplicate.source_counts.ledger_record_count += 1;
  assert.match(verifyMutationLedger(duplicate).failures.join(" "), /duplicate ledger keys/);

  const unresolved = structuredClone(ledger);
  unresolved.records[0].source_function.resolved = false;
  assert.match(verifyMutationLedger(unresolved).failures.join(" "), /source functions could not be resolved/);

  const missingDecision = structuredClone(ledger);
  missingDecision.decision_registry.decisions.pop();
  assert.match(verifyCompleteMutationLedger(missingDecision, temporaryRoot).failures.join(" "), /missing reviewed decisions/);

  const extraDecision = structuredClone(ledger);
  extraDecision.decision_registry.decisions.push(activeDecision("POST /api/v1/example/extra @ backend/app/api/example.py:99", "createItem", "create_item"));
  assert.match(verifyCompleteMutationLedger(extraDecision, temporaryRoot).failures.join(" "), /do not map/);

  const duplicateDecision = structuredClone(ledger);
  duplicateDecision.decision_registry.decisions.push(structuredClone(duplicateDecision.decision_registry.decisions[0]));
  assert.match(verifyCompleteMutationLedger(duplicateDecision, temporaryRoot).failures.join(" "), /duplicate decision-registry keys/);

  const placeholderDecision = structuredClone(ledger);
  placeholderDecision.decision_registry.decisions[0].migration_decisions.transaction_boundary.implementation_ref = "TODO";
  assert.match(verifyCompleteMutationLedger(placeholderDecision, temporaryRoot).failures.join(" "), /placeholder/);

  const tautologicalDecision = structuredClone(ledger);
  tautologicalDecision.decision_registry.decisions[0].migration_decisions.idempotency.rationale = "Repeat-call behavior is non_idempotent.";
  assert.match(verifyCompleteMutationLedger(tautologicalDecision, temporaryRoot).failures.join(" "), /tautological/);

  for (const malformedEntry of [null, {}, { ledger_key: "   " }, { ledger_key: 7 }]) {
    const malformedRegistry = structuredClone(ledger);
    malformedRegistry.decision_registry.decisions.push(malformedEntry);
    assert.match(verifyMutationLedger(malformedRegistry).failures.join(" "), /malformed decision-registry entries/);
    assert.match(verifyCompleteMutationLedger(malformedRegistry, temporaryRoot).failures.join(" "), /malformed decision-registry entries/);
  }

  writeMutationLedger(temporaryRoot, ledger);
  assert.deepStrictEqual(checkMutationLedgerArtifacts(temporaryRoot, ledger), []);
  const stalePath = path.join(temporaryRoot, "docs/spring-migration/mutation-ledger.md");
  fs.writeFileSync(stalePath, "stale\n");
  const beforeCheck = fs.readFileSync(stalePath, "utf8");
  assert.match(checkMutationLedgerArtifacts(temporaryRoot, ledger).join(" "), /mutation-ledger\.md is stale/);
  assert.strictEqual(fs.readFileSync(stalePath, "utf8"), beforeCheck);

  const activeShadow = structuredClone(ledger);
  activeShadow.decision_registry.decisions.find((decision) => decision.status === "retired_shadowed").status = "active";
  assert.match(verifyCompleteMutationLedger(activeShadow, temporaryRoot).failures.join(" "), /invalid shadowed review status/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("mutation-ledger tests passed");
