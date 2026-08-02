#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { hasSnapshot, readHistoricalJson, verifySnapshot } = require("./retirement-snapshot");

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const UNASSIGNED = "UNASSIGNED";
const DECISION_REGISTRY_PATH = "docs/spring-migration/mutation-decision-registry.json";
const DECISION_FIELDS = [
  "transaction_boundary",
  "jpa_mybatis_owner",
  "isolation",
  "lock_version_strategy",
  "retry_deadlock",
  "idempotency",
  "http_conflict_mapping",
];
const SUPPORTED_DECISION_VALUES = {
  transaction_boundary: new Set(["service_transactional", "retired_shadowed"]),
  jpa_mybatis_owner: new Set(["jpa", "jpa_with_mybatis_projection", "retired_shadowed"]),
  isolation: new Set(["read_committed", "retired_shadowed"]),
  lock_version_strategy: new Set(["no_version", "pessimistic_write", "natural_key_lock", "retired_shadowed"]),
  retry_deadlock: new Set(["no_automatic_retry", "retired_shadowed"]),
  idempotency: new Set(["non_idempotent", "state_idempotent", "key_idempotent", "repeat_not_found", "repeat_conflict", "retired_shadowed"]),
  http_conflict_mapping: new Set(["conflict_409", "not_found_404", "no_content_204", "retired_shadowed"]),
};
const PLACEHOLDER_PATTERN = /^(?:unassigned|tbd|todo|placeholder|n\/a|fill(?:\s|-)?me|unknown)$/i;
const TAUTOLOGICAL_RATIONALE_PATTERN = /^(?:(?:the|this) )?(?:decision|behavior|repeat(?:-call)? behavior).{0,160}\b(?:is|equals|remains)\s+[`"']?[a-z_]+[`"']?\.?$/i;

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function offsetForLine(source, lineNumber) {
  let offset = 0;
  for (let line = 1; line < lineNumber && offset < source.length; line += 1) {
    offset = source.indexOf("\n", offset) + 1;
    if (offset === 0) return source.length;
  }
  return offset;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = JSON.stringify(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countBy(records, key) {
  const counts = {};
  for (const record of records) counts[record[key]] = (counts[record[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function sourceEndpointKey(endpoint) {
  return `${endpoint.method} ${endpoint.full_path} @ ${endpoint.source_file}:${endpoint.source_line}`;
}

function ledgerKey(endpoint) {
  return sourceEndpointKey(endpoint);
}

function findPythonFunction(source, functionName, afterLine = 1) {
  const pattern = new RegExp(`^(?:async\\s+)?def\\s+${escapeRegExp(functionName)}\\s*\\(`, "gm");
  pattern.lastIndex = offsetForLine(source, afterLine);
  const match = pattern.exec(source);
  if (!match) return null;

  const nextDefinition = /^(?:(?:async\s+)?def\s+|class\s+|@)/gm;
  nextDefinition.lastIndex = match.index + match[0].length;
  const next = nextDefinition.exec(source);
  return {
    name: functionName,
    start_index: match.index,
    source_line: lineAt(source, match.index),
    body: source.slice(match.index, next ? next.index : source.length),
  };
}

function parseImportedNames(source) {
  const direct = new Map();
  const modules = new Map();
  const directImport = /^\s*from\s+app\.services\.([A-Za-z_]\w*)\s+import\s*(?:\(([\s\S]*?)\)|([^\n]+))/gm;
  let match;
  while ((match = directImport.exec(source))) {
    const moduleName = match[1];
    const names = (match[2] || match[3]).replace(/#.*$/gm, "").split(",");
    for (const name of names) {
      const binding = name.trim().match(/^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (!binding) continue;
      direct.set(binding[2] || binding[1], {
        service_file: `backend/app/services/${moduleName}.py`,
        service_function: binding[1],
      });
    }
  }

  const moduleImport = /^\s*import\s+app\.services\.([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?\s*$/gm;
  while ((match = moduleImport.exec(source))) {
    modules.set(match[2] || match[1], `backend/app/services/${match[1]}.py`);
  }

  const packageImport = /^\s*from\s+app\.services\s+import\s+([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?\s*$/gm;
  while ((match = packageImport.exec(source))) {
    modules.set(match[2] || match[1], `backend/app/services/${match[1]}.py`);
  }
  return { direct, modules };
}

function parseModelNames(source) {
  const models = new Set();
  const importPattern = /^\s*from\s+app\.models(?:\.[A-Za-z_]\w*)?\s+import\s*(?:\(([\s\S]*?)\)|([^\n]+))/gm;
  let match;
  while ((match = importPattern.exec(source))) {
    for (const name of (match[1] || match[2]).replace(/#.*$/gm, "").split(",")) {
      const binding = name.trim().match(/^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (binding) models.add(binding[2] || binding[1]);
    }
  }
  return models;
}

function lineRecords(unit, predicate, transform) {
  return unit.body.split("\n").flatMap((line, offset) => (
    predicate(line)
      ? [{ source_file: unit.source_file, source_line: unit.source_line + offset, clue: transform(line.trim()) }]
      : []
  ));
}

function findServiceCalls(repositoryRoot, apiSource, endpointUnit, sourceCache) {
  const imports = parseImportedNames(apiSource);
  const calls = [];
  const addCalls = (pattern, bindingForMatch) => {
    let match;
    while ((match = pattern.exec(endpointUnit.body))) {
      const before = endpointUnit.body.slice(Math.max(0, match.index - 5), match.index);
      if (/\bdef\s*$/.test(before)) continue;
      const binding = bindingForMatch(match);
      if (!binding) continue;
      const resolution = resolveServiceFunction(repositoryRoot, binding, sourceCache);
      calls.push({
        source_file: endpointUnit.source_file,
        source_line: lineAt(apiSource, endpointUnit.start_index + match.index),
        expression: match[0].replace(/\s+/g, " ").trim(),
        service_file: binding.service_file,
        service_function: binding.service_function,
        resolved: Boolean(resolution),
        resolved_source_file: resolution ? resolution.service_file : null,
        resolved_service_function: resolution ? resolution.service_function : null,
        resolved_source_line: resolution ? resolution.function_info.source_line : null,
        reexport_chain: resolution ? resolution.reexport_chain : [],
      });
    }
  };

  for (const [localName, binding] of imports.direct) {
    addCalls(new RegExp(`\\b${escapeRegExp(localName)}\\s*\\(`, "g"), () => binding);
  }
  for (const [localName, serviceFile] of imports.modules) {
    addCalls(new RegExp(`\\b${escapeRegExp(localName)}\\.([A-Za-z_]\\w*)\\s*\\(`, "g"), (match) => ({
      service_file: serviceFile,
      service_function: match[1],
    }));
  }

  return calls
    .sort((left, right) => left.source_line - right.source_line || left.expression.localeCompare(right.expression));
}

function readSource(filePath, sourceCache) {
  if (!sourceCache.has(filePath)) sourceCache.set(filePath, fs.readFileSync(filePath, "utf8"));
  return sourceCache.get(filePath);
}

function resolveServiceFunction(repositoryRoot, binding, sourceCache, visited = new Set()) {
  const resolutionKey = `${binding.service_file}#${binding.service_function}`;
  if (visited.has(resolutionKey)) return null;
  visited.add(resolutionKey);
  const servicePath = path.join(repositoryRoot, binding.service_file);
  if (!fs.existsSync(servicePath)) return null;
  const source = readSource(servicePath, sourceCache);
  const functionInfo = findPythonFunction(source, binding.service_function);
  if (functionInfo) {
    return {
      service_file: binding.service_file,
      service_function: binding.service_function,
      source,
      function_info: functionInfo,
      reexport_chain: [binding.service_file],
    };
  }
  const reexport = parseImportedNames(source).direct.get(binding.service_function);
  if (!reexport) return null;
  const target = resolveServiceFunction(repositoryRoot, reexport, sourceCache, visited);
  if (!target) return null;
  return { ...target, reexport_chain: [binding.service_file, ...target.reexport_chain] };
}

function transactionClues(units) {
  return uniqueRecords(units.flatMap((unit) => lineRecords(
    unit,
    (line) => /\b(?:session|db)\.(?:commit|rollback|flush|begin|begin_nested)\s*\(|\bwith\s+(?:session|db)\.begin\s*\(/.test(line),
    (line) => line,
  ))).sort((left, right) => (
    left.source_file.localeCompare(right.source_file) || left.source_line - right.source_line || left.clue.localeCompare(right.clue)
  ));
}

function statusConflictClues(units) {
  return uniqueRecords(units.flatMap((unit) => lineRecords(
    unit,
    (line) => /HTTPException|status\.HTTP_|status_code\s*=|\b(?:Conflict|IntegrityError|OperationalError|duplicate|already exists|deadlock)\b/i.test(line),
    (line) => line,
  ))).sort((left, right) => (
    left.source_file.localeCompare(right.source_file) || left.source_line - right.source_line || left.clue.localeCompare(right.clue)
  ));
}

function modelTableClues(units) {
  const clues = [];
  for (const unit of units) {
    const models = parseModelNames(unit.source);
    const variables = new Map();
    const assignmentPattern = /\b([A-Za-z_]\w*)\s*=\s*([A-Z][A-Za-z0-9_]*)\s*\(/g;
    let match;
    while ((match = assignmentPattern.exec(unit.body))) {
      if (models.has(match[2])) variables.set(match[1], match[2]);
    }

    const capture = (pattern, operation, resolveModel) => {
      let candidate;
      while ((candidate = pattern.exec(unit.body))) {
        const model = resolveModel(candidate);
        if (!model || !models.has(model)) continue;
        const sourceLine = lineAt(unit.source, unit.start_index + candidate.index);
        const sourceText = unit.source.split("\n")[sourceLine - 1].trim();
        clues.push({
          source_file: unit.source_file,
          source_line: sourceLine,
          operation: typeof operation === "function" ? operation(candidate) : operation,
          model_or_table: model,
          clue: sourceText,
        });
      }
    };

    capture(/\b(?:session|db)\.(add|delete|get)\s*\(\s*([A-Za-z_]\w*)/g, (candidate) => `session_${candidate[1]}`, (candidate) => (
      models.has(candidate[2]) ? candidate[2] : variables.get(candidate[2])
    ));
    capture(/\b(?:select|sa_delete|delete|update)\s*\(\s*([A-Z][A-Za-z0-9_]*)/g, (candidate) => `static_${candidate[0].match(/[A-Za-z_]\w*/)[0]}`, (candidate) => candidate[1]);
  }
  return uniqueRecords(clues).sort((left, right) => (
    left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line
    || left.operation.localeCompare(right.operation)
    || left.model_or_table.localeCompare(right.model_or_table)
  ));
}

function permissionAuthClues(manifestEndpoint, units) {
  const clues = units.flatMap((unit) => lineRecords(
    unit,
    (line) => /Depends\((?:get_current_user|require_roles)|require_menu_action_for_user|\bAuthUser\b|\brequire_[A-Za-z_]\w*\s*\(/.test(line),
    (line) => line,
  ));
  for (const clue of manifestEndpoint.auth_clues || []) {
    clues.push({
      source_file: manifestEndpoint.source_file,
      source_line: manifestEndpoint.source_line,
      clue: `manifest auth clue: ${clue}`,
    });
  }
  return uniqueRecords(clues).sort((left, right) => (
    left.source_file.localeCompare(right.source_file) || left.source_line - right.source_line || left.clue.localeCompare(right.clue)
  ));
}

function unassignedDecisions() {
  return Object.fromEntries(DECISION_FIELDS.map((field) => [field, UNASSIGNED]));
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

function malformedDecisionEntry(decision, index) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return `registry decision at index ${index} must be an object`;
  }
  if (!Object.prototype.hasOwnProperty.call(decision, "ledger_key")) {
    return `registry decision at index ${index} is missing ledger_key`;
  }
  if (typeof decision.ledger_key !== "string") {
    return `registry decision at index ${index} has a non-string ledger_key`;
  }
  if (!decision.ledger_key.trim()) {
    return `registry decision at index ${index} has a blank ledger_key`;
  }
  return null;
}

function readDecisionRegistry(repositoryRoot, registryPath = DECISION_REGISTRY_PATH) {
  const absolutePath = path.join(repositoryRoot, registryPath);
  if (!fs.existsSync(absolutePath)) {
    return { path: registryPath, exists: false, decisions: [] };
  }
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

function indexDecisionRegistry(decisions) {
  const byKey = new Map();
  const duplicateKeys = [];
  const malformedEntries = [];
  for (const [index, decision] of decisions.entries()) {
    const malformed = malformedDecisionEntry(decision, index);
    if (malformed) {
      malformedEntries.push(malformed);
      continue;
    }
    if (byKey.has(decision.ledger_key)) duplicateKeys.push(decision.ledger_key);
    else byKey.set(decision.ledger_key, decision);
  }
  return {
    byKey,
    duplicateKeys: [...new Set(duplicateKeys)].sort(),
    malformedEntries,
  };
}

function canonicalHandlerKeys(manifest, endpoints) {
  const canonicalByKey = new Map(endpoints.map((endpoint) => [sourceEndpointKey(endpoint), sourceEndpointKey(endpoint)]));
  for (const canonicalRoute of Object.values(manifest.canonical_routes || {})) {
    const effective = canonicalRoute.effective_handler;
    if (!effective) continue;
    const canonicalEndpoint = endpoints.find((endpoint) => (
      endpoint.method === canonicalRoute.method
      && endpoint.source_file === effective.source_file
      && endpoint.source_line === effective.source_line
    ));
    if (!canonicalEndpoint) continue;
    const canonicalKey = sourceEndpointKey(canonicalEndpoint);
    for (const endpoint of endpoints) {
      if (endpoint.method === canonicalRoute.method && endpoint.full_path === canonicalRoute.normalized_path) {
        canonicalByKey.set(sourceEndpointKey(endpoint), canonicalKey);
      }
    }
  }
  return Object.fromEntries([...canonicalByKey.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function assignedDecisionCount(records) {
  return records.reduce((count, record) => count + DECISION_FIELDS.filter((field) => {
    const decision = record.migration_decisions && record.migration_decisions[field];
    return decision && decision !== UNASSIGNED;
  }).length, 0);
}

function routeCollisionGroups(endpoints) {
  const groups = new Map();
  for (const endpoint of endpoints) {
    const methodPath = `${endpoint.method} ${endpoint.full_path}`;
    groups.set(methodPath, [...(groups.get(methodPath) || []), sourceEndpointKey(endpoint)]);
  }
  return [...groups.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([method_path, source_endpoint_keys]) => ({ method_path, source_endpoint_keys }))
    .sort((left, right) => left.method_path.localeCompare(right.method_path));
}

function buildMutationLedger(repositoryRoot, options = {}) {
  const manifestPath = path.join(repositoryRoot, "docs", "spring-migration", "endpoint-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const stateChangingEndpoints = (manifest.endpoints || [])
    .filter((endpoint) => STATE_CHANGING_METHODS.has(endpoint.method))
    .sort((left, right) => sourceEndpointKey(left).localeCompare(sourceEndpointKey(right)));
  const decisionRegistry = readDecisionRegistry(repositoryRoot, options.registryPath);
  const registryIndex = indexDecisionRegistry(decisionRegistry.decisions);
  const canonicalByLedgerKey = canonicalHandlerKeys(manifest, stateChangingEndpoints);
  const sourceCache = new Map();
  const records = stateChangingEndpoints.map((endpoint) => {
    const apiPath = path.join(repositoryRoot, endpoint.source_file);
    const apiSource = fs.existsSync(apiPath) ? readSource(apiPath, sourceCache) : null;
    const functionInfo = apiSource && endpoint.function_name
      ? findPythonFunction(apiSource, endpoint.function_name, endpoint.source_line)
      : null;
    const endpointUnit = functionInfo && {
      source_file: endpoint.source_file,
      source: apiSource,
      source_line: functionInfo.source_line,
      start_index: functionInfo.start_index,
      body: functionInfo.body,
    };
    const decoratorUnit = functionInfo && {
      source_file: endpoint.source_file,
      source: apiSource,
      source_line: endpoint.source_line,
      start_index: offsetForLine(apiSource, endpoint.source_line),
      body: apiSource.slice(offsetForLine(apiSource, endpoint.source_line), functionInfo.start_index),
    };
    const calls = endpointUnit ? findServiceCalls(repositoryRoot, apiSource, endpointUnit, sourceCache) : [];
    const serviceUnits = calls.flatMap((call) => {
      if (!call.resolved) return [];
      const serviceSource = readSource(path.join(repositoryRoot, call.resolved_source_file), sourceCache);
      const serviceFunction = findPythonFunction(serviceSource, call.resolved_service_function);
      return serviceFunction ? [{
        source_file: call.resolved_source_file,
        source: serviceSource,
        source_line: serviceFunction.source_line,
        start_index: serviceFunction.start_index,
        body: serviceFunction.body,
      }] : [];
    });
    const units = [decoratorUnit, endpointUnit, ...serviceUnits].filter(Boolean);
    return {
      ledger_key: ledgerKey(endpoint),
      manifest_source_endpoint_key: sourceEndpointKey(endpoint),
      method: endpoint.method,
      path: endpoint.full_path,
      domain: endpoint.domain,
      source_file: endpoint.source_file,
      source_line: endpoint.source_line,
      function_name: endpoint.function_name,
      source_function: {
        resolved: Boolean(functionInfo),
        source_file: endpoint.source_file,
        source_line: functionInfo ? functionInfo.source_line : null,
      },
      service_call_clues: calls,
      transaction_call_clues: transactionClues(units),
      status_conflict_clues: statusConflictClues(units),
      touched_model_table_clues: modelTableClues(units),
      current_permission_auth_clues: permissionAuthClues(endpoint, [decoratorUnit, endpointUnit].filter(Boolean)),
      review_status: registryIndex.byKey.get(ledgerKey(endpoint))?.status || "unassigned",
      canonical_handler_key: registryIndex.byKey.get(ledgerKey(endpoint))?.canonical_handler_key || null,
      spring_mapping: registryIndex.byKey.get(ledgerKey(endpoint))?.spring_mapping || null,
      migration_doc: registryIndex.byKey.get(ledgerKey(endpoint))?.migration_doc || null,
      migration_decisions: registryIndex.byKey.get(ledgerKey(endpoint))?.migration_decisions || unassignedDecisions(),
    };
  });

  const assignedMigrationDecisions = assignedDecisionCount(records);

  const ledger = {
    schema_version: 1,
    generated_by: "scripts/spring-migration/mutation-ledger.js",
    input_manifest: {
      path: "docs/spring-migration/endpoint-manifest.json",
      schema_version: manifest.schema_version,
      expected_source_endpoint_count: manifest.expected_source_count,
      source_endpoint_count: manifest.source_endpoint_count,
    },
    source_counts: {
      manifest_endpoint_count: (manifest.endpoints || []).length,
      manifest_expected_endpoint_count: manifest.expected_source_count,
      manifest_state_changing_endpoint_count: stateChangingEndpoints.length,
      ledger_record_count: records.length,
    },
    state_changing_source_endpoint_keys: stateChangingEndpoints.map(sourceEndpointKey),
    canonical_handler_by_ledger_key: canonicalByLedgerKey,
    decision_registry: {
      path: decisionRegistry.path,
      exists: decisionRegistry.exists,
      decision_count: decisionRegistry.decisions.length,
      decisions: decisionRegistry.decisions,
      duplicate_ledger_keys: registryIndex.duplicateKeys,
      malformed_entries: [
        ...(decisionRegistry.registry_structure_errors || []),
        ...registryIndex.malformedEntries,
      ],
    },
    route_collision_groups: routeCollisionGroups(stateChangingEndpoints),
    counts: {
      by_domain: countBy(records, "domain"),
      assigned_migration_decisions: assignedMigrationDecisions,
      unassigned_migration_decisions: records.length * DECISION_FIELDS.length - assignedMigrationDecisions,
    },
    records,
  };
  ledger.verification = verifyMutationLedger(ledger);
  ledger.complete_verification = verifyCompleteMutationLedger(ledger, repositoryRoot);
  return ledger;
}

function verifyMutationLedger(ledger) {
  const failures = [];
  const registryIndex = indexDecisionRegistry(Array.isArray(ledger.decision_registry?.decisions) ? ledger.decision_registry.decisions : []);
  const malformedRegistryEntries = [...new Set([
    ...(ledger.decision_registry?.malformed_entries || []),
    ...registryIndex.malformedEntries,
  ])];
  const expectedKeys = new Set(ledger.state_changing_source_endpoint_keys || []);
  const recordKeys = new Set((ledger.records || []).map((record) => record.manifest_source_endpoint_key));
  const missingStateChangingEndpoints = [...expectedKeys].filter((key) => !recordKeys.has(key)).sort();
  const unexpectedStateChangingEndpoints = [...recordKeys].filter((key) => !expectedKeys.has(key)).sort();
  const ledgerKeyCounts = new Map();
  for (const record of ledger.records || []) {
    ledgerKeyCounts.set(record.ledger_key, (ledgerKeyCounts.get(record.ledger_key) || 0) + 1);
  }
  const duplicateLedgerKeys = [...ledgerKeyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
  const unresolvedEndpointSourceFunctions = (ledger.records || [])
    .filter((record) => !record.source_function || !record.source_function.resolved)
    .map((record) => record.ledger_key)
    .sort();
  const unresolvedServiceFunctions = (ledger.records || [])
    .flatMap((record) => (record.service_call_clues || [])
      .filter((clue) => !clue.resolved)
      .map((clue) => `${record.ledger_key} => ${clue.service_file}#${clue.service_function}`))
    .sort();
  const unresolvedSourceFunctions = [...unresolvedEndpointSourceFunctions, ...unresolvedServiceFunctions].sort();
  const counts = ledger.source_counts || {};
  const sourceCountMismatches = [];
  if (counts.manifest_endpoint_count !== counts.manifest_expected_endpoint_count) {
    sourceCountMismatches.push(`manifest endpoint count ${counts.manifest_endpoint_count} does not match expected ${counts.manifest_expected_endpoint_count}`);
  }
  if (counts.manifest_endpoint_count !== ledger.input_manifest?.source_endpoint_count) {
    sourceCountMismatches.push(`manifest endpoint array count ${counts.manifest_endpoint_count} does not match declared source count ${ledger.input_manifest?.source_endpoint_count}`);
  }
  if (counts.manifest_state_changing_endpoint_count !== counts.ledger_record_count) {
    sourceCountMismatches.push(`state-changing source count ${counts.manifest_state_changing_endpoint_count} does not match ledger record count ${counts.ledger_record_count}`);
  }
  if (expectedKeys.size !== counts.manifest_state_changing_endpoint_count) {
    sourceCountMismatches.push(`state-changing source key count ${expectedKeys.size} does not match source count ${counts.manifest_state_changing_endpoint_count}`);
  }
  if (missingStateChangingEndpoints.length > 0) {
    failures.push(`${missingStateChangingEndpoints.length} state-changing endpoints are missing from the ledger`);
  }
  if (unexpectedStateChangingEndpoints.length > 0) {
    failures.push(`${unexpectedStateChangingEndpoints.length} ledger records do not map to state-changing source endpoints`);
  }
  if (duplicateLedgerKeys.length > 0) failures.push(`${duplicateLedgerKeys.length} duplicate ledger keys found`);
  if (unresolvedSourceFunctions.length > 0) failures.push(`${unresolvedSourceFunctions.length} source functions could not be resolved`);
  if (sourceCountMismatches.length > 0) failures.push(`source count mismatch: ${sourceCountMismatches.join("; ")}`);
  if (malformedRegistryEntries.length > 0) {
    failures.push(`${malformedRegistryEntries.length} malformed decision-registry entries: ${malformedRegistryEntries.join("; ")}`);
  }
  return {
    passed: failures.length === 0,
    missing_state_changing_endpoint_count: missingStateChangingEndpoints.length,
    missing_state_changing_endpoints: missingStateChangingEndpoints,
    unexpected_state_changing_endpoint_count: unexpectedStateChangingEndpoints.length,
    duplicate_ledger_key_count: duplicateLedgerKeys.length,
    duplicate_ledger_keys: duplicateLedgerKeys,
    unresolved_source_function_count: unresolvedSourceFunctions.length,
    unresolved_source_functions: unresolvedSourceFunctions,
    unresolved_endpoint_source_function_count: unresolvedEndpointSourceFunctions.length,
    unresolved_service_function_count: unresolvedServiceFunctions.length,
    source_count_match: sourceCountMismatches.length === 0,
    source_count_mismatches: sourceCountMismatches,
    failures,
  };
}

function verifyReference(repositoryRoot, reference, kind, failures, ledgerKey) {
  if (!reference || typeof reference !== "object") {
    failures.push(`${ledgerKey} has no ${kind} reference`);
    return;
  }
  if (hasPlaceholder(reference)) {
    failures.push(`${ledgerKey} has a blank or placeholder ${kind} reference`);
    return;
  }
  const sourceFile = reference.source_file || reference.path;
  if (typeof sourceFile !== "string" || !sourceFile) {
    failures.push(`${ledgerKey} has no ${kind} source file`);
    return;
  }
  const absolutePath = path.join(repositoryRoot, sourceFile);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${ledgerKey} ${kind} source is missing: ${sourceFile}`);
    return;
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  const anchor = reference.handler || reference.anchor;
  if (typeof anchor !== "string" || !anchor || !source.includes(anchor)) {
    failures.push(`${ledgerKey} ${kind} drifted: ${sourceFile} no longer contains its recorded anchor`);
  }
}

function verifyDecisionEvidence(repositoryRoot, evidence, kind, failures, ledgerKey) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    failures.push(`${ledgerKey} has no structured ${kind} evidence`);
    return;
  }
  const sourceFile = evidence.source_file;
  const handler = evidence.handler;
  if (!nonBlankString(sourceFile) || !nonBlankString(handler) || hasPlaceholder(evidence)) {
    failures.push(`${ledgerKey} has blank or placeholder structured ${kind} evidence`);
    return;
  }
  verifyReference(repositoryRoot, evidence, `${kind} evidence`, failures, ledgerKey);
}

function hasTautologicalRationale(rationale) {
  return !nonBlankString(rationale) || TAUTOLOGICAL_RATIONALE_PATTERN.test(rationale.trim());
}

function verifyHistoricalEvidence(evidence, kind, failures, ledgerKey) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    failures.push(`${ledgerKey} has no structured historical ${kind} evidence`);
    return;
  }
  if (!nonBlankString(evidence.source_file) || !nonBlankString(evidence.handler) || hasPlaceholder(evidence)) {
    failures.push(`${ledgerKey} has blank or placeholder historical ${kind} evidence`);
  }
}

function verifyCompleteMutationLedger(ledger, repositoryRoot, options = {}) {
  const failures = [];
  const registry = ledger.decision_registry || {};
  const decisions = Array.isArray(registry.decisions) ? registry.decisions : [];
  const expectedKeys = new Set(ledger.state_changing_source_endpoint_keys || []);
  const { byKey, duplicateKeys, malformedEntries } = indexDecisionRegistry(decisions);
  const actualKeys = new Set(byKey.keys());
  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key)).sort();
  const extra = [...actualKeys].filter((key) => !expectedKeys.has(key)).sort();

  if (!registry.exists) failures.push(`decision registry is missing: ${registry.path || DECISION_REGISTRY_PATH}`);
  const malformedRegistryEntries = [...new Set([...(registry.malformed_entries || []), ...malformedEntries])];
  if (malformedRegistryEntries.length > 0) {
    failures.push(`${malformedRegistryEntries.length} malformed decision-registry entries: ${malformedRegistryEntries.join("; ")}`);
  }
  if (duplicateKeys.length > 0 || (registry.duplicate_ledger_keys || []).length > 0) {
    failures.push(`${duplicateKeys.length || registry.duplicate_ledger_keys.length} duplicate decision-registry keys found`);
  }
  if (missing.length > 0) failures.push(`${missing.length} state-changing ledger keys are missing reviewed decisions`);
  if (extra.length > 0) failures.push(`${extra.length} reviewed decisions do not map to a state-changing ledger key`);

  for (const record of ledger.records || []) {
    const expectedCanonicalKey = ledger.canonical_handler_by_ledger_key?.[record.ledger_key] || record.ledger_key;
    const shadowed = expectedCanonicalKey !== record.ledger_key;
    const decision = byKey.get(record.ledger_key);
    if (!decision) continue;

    if (hasPlaceholder(decision)) failures.push(`${record.ledger_key} contains a blank or placeholder reviewed decision`);
    if (decision.canonical_handler_key !== expectedCanonicalKey) {
      failures.push(`${record.ledger_key} has a canonical/source collision mismatch`);
    }
    if (shadowed ? decision.status !== "retired_shadowed" : decision.status !== "active") {
      failures.push(`${record.ledger_key} has an invalid ${shadowed ? "shadowed" : "active"} review status`);
    }

    for (const field of DECISION_FIELDS) {
      const value = decision.migration_decisions?.[field];
      if (!value || typeof value !== "object" || typeof value.value !== "string") {
        failures.push(`${record.ledger_key} has no reviewed ${field} decision`);
        continue;
      }
      if (!SUPPORTED_DECISION_VALUES[field].has(value.value)) {
        failures.push(`${record.ledger_key} has unsupported ${field} value ${value.value}`);
      }
      if (shadowed && value.value !== "retired_shadowed") {
        failures.push(`${record.ledger_key} shadowed decision does not retire ${field}`);
      }
      if (!shadowed && value.value === "retired_shadowed") {
        failures.push(`${record.ledger_key} active decision incorrectly retires ${field}`);
      }
      if (hasPlaceholder(value)) failures.push(`${record.ledger_key} has a blank or placeholder ${field} decision`);
      if (hasTautologicalRationale(value.rationale)) {
        failures.push(`${record.ledger_key} has a missing or tautological ${field} rationale`);
      }
      if (options.historicalEvidence) verifyHistoricalEvidence(value.source_ref, "source", failures, record.ledger_key);
      else verifyDecisionEvidence(repositoryRoot, value.source_ref, "source", failures, record.ledger_key);
      verifyDecisionEvidence(repositoryRoot, value.implementation_ref, "implementation", failures, record.ledger_key);
    }

    if (shadowed) {
      if (!byKey.has(expectedCanonicalKey)) {
        failures.push(`${record.ledger_key} points to a missing canonical handler decision`);
      }
    } else {
      verifyReference(repositoryRoot, decision.spring_mapping, "Spring implementation", failures, record.ledger_key);
      verifyReference(repositoryRoot, decision.migration_doc, "migration document", failures, record.ledger_key);
    }
  }

  return {
    passed: failures.length === 0,
    registry_record_count: decisions.length,
    missing_decision_count: missing.length,
    missing_decision_keys: missing,
    extra_decision_count: extra.length,
    extra_decision_keys: extra,
    duplicate_decision_key_count: duplicateKeys.length,
    duplicate_decision_keys: duplicateKeys,
    assigned_migration_decisions: ledger.counts?.assigned_migration_decisions || 0,
    unassigned_migration_decisions: ledger.counts?.unassigned_migration_decisions || 0,
    failures,
  };
}

function markdownCell(value) {
  return String(value || "-").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function compactClues(clues, mapper) {
  if (!clues.length) return "-";
  return clues.map(mapper).join("<br>");
}

function renderMarkdown(ledger) {
  const verification = ledger.verification || verifyMutationLedger(ledger);
  const completeVerification = ledger.complete_verification || verifyCompleteMutationLedger(ledger, process.cwd());
  const decisionFields = DECISION_FIELDS.map((field) => "`" + field + "`").join(", ");
  const verificationMessage = verification.passed
    ? "All required coverage, key, function-resolution, and source-count checks passed."
    : verification.failures.map((failure) => "- " + failure).join("\n");
  const lines = [
    "# Mutation Migration Ledger",
    "",
    "Generated by `scripts/spring-migration/mutation-ledger.js` from `docs/spring-migration/endpoint-manifest.json` and statically read Python API/service sources. Do not edit generated output manually.",
    "",
    "## Summary",
    "",
    "- Manifest endpoints: " + ledger.source_counts.manifest_endpoint_count + " (expected " + ledger.source_counts.manifest_expected_endpoint_count + ")",
    "- State-changing endpoint records: " + ledger.source_counts.manifest_state_changing_endpoint_count,
    "- Ledger records: " + ledger.source_counts.ledger_record_count,
    "- Source route-collision groups: " + ledger.route_collision_groups.length,
    "- Verification: " + (verification.passed ? "PASS" : "FAIL"),
    "- Reviewed assigned migration decisions: " + ledger.counts.assigned_migration_decisions,
    "- Explicitly UNASSIGNED migration decisions: " + ledger.counts.unassigned_migration_decisions,
    "- Complete verification: " + (completeVerification.passed ? "PASS" : "FAIL"),
    "",
    "## Migration Decisions",
    "",
    "Reviewed decisions are merged from `" + ledger.decision_registry.path + "` by exact `ledger_key`. Every decision field records its value, non-tautological rationale, and structured source/implementation evidence. Every active record cites its Spring mapping and domain migration document; a shadowed TRA decorator is explicitly retired and points to its canonical source handler. Fields: " + decisionFields + ".",
    "",
    "## Verification",
    "",
    verificationMessage,
    "",
    "## Complete Verification",
    "",
    completeVerification.passed ? "All reviewed keys, values, canonical handlers, implementation references, and documentation anchors passed." : completeVerification.failures.map((failure) => "- " + failure).join("\n"),
    "",
    "## Source Route Collisions",
    "",
  ];
  if (ledger.route_collision_groups.length === 0) {
    lines.push("No state-changing method/path collision groups found.");
  } else {
    lines.push("These source routes share a method/path but remain separately inventoried by source location.", "", "| Method + path | Source records |", "| --- | --- |");
    for (const group of ledger.route_collision_groups) {
      const sourceRecords = group.source_endpoint_keys.map((key) => "`" + key + "`").join("<br>");
      lines.push("| " + markdownCell(group.method_path) + " | " + markdownCell(sourceRecords) + " |");
    }
  }
  lines.push("", "## Records", "", "| Key | Domain | Source function | Service calls | Transaction clues | Status/conflict clues | Touched models/tables | Permission/auth clues | Decisions | Reviewed evidence |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const record of ledger.records) {
    const services = compactClues(record.service_call_clues, (clue) => "`" + clue.service_file + "#" + clue.service_function + "` " + (clue.resolved ? "resolved" : "UNRESOLVED"));
    const transactions = compactClues(record.transaction_call_clues, (clue) => "`" + clue.source_file + ":" + clue.source_line + "` " + clue.clue);
    const statuses = compactClues(record.status_conflict_clues, (clue) => "`" + clue.source_file + ":" + clue.source_line + "` " + clue.clue);
    const models = compactClues(record.touched_model_table_clues, (clue) => "`" + clue.model_or_table + "` (" + clue.operation + ")");
    const auth = compactClues(record.current_permission_auth_clues, (clue) => "`" + clue.source_file + ":" + clue.source_line + "` " + clue.clue);
    const sourceFunction = record.source_file + ":" + record.source_line + "#" + record.function_name;
    const decisions = DECISION_FIELDS.map((field) => record.migration_decisions?.[field]?.value || record.migration_decisions?.[field] || UNASSIGNED).join(", ");
    const evidence = DECISION_FIELDS.map((field) => {
      const decision = record.migration_decisions?.[field];
      if (!decision || typeof decision !== "object") return `${field}: ${UNASSIGNED}`;
      const source = decision.source_ref?.source_file && decision.source_ref?.handler
        ? `${decision.source_ref.source_file}#${decision.source_ref.handler}` : "MISSING SOURCE";
      const implementation = decision.implementation_ref?.source_file && decision.implementation_ref?.handler
        ? `${decision.implementation_ref.source_file}#${decision.implementation_ref.handler}` : "MISSING IMPLEMENTATION";
      return `${field}: source=${source}; implementation=${implementation}; rationale=${decision.rationale || "MISSING"}`;
    }).join("<br>");
    lines.push("| `" + markdownCell(record.ledger_key) + "` | " + markdownCell(record.domain) + " | `" + markdownCell(sourceFunction) + "` | " + markdownCell(services) + " | " + markdownCell(transactions) + " | " + markdownCell(statuses) + " | " + markdownCell(models) + " | " + markdownCell(auth) + " | " + markdownCell(decisions) + " | " + markdownCell(evidence) + " |");
  }
  return lines.join("\n") + "\n";
}

function mutationLedgerArtifacts(ledger) {
  return {
    "mutation-ledger.json": `${JSON.stringify(ledger, null, 2)}\n`,
    "mutation-ledger.md": renderMarkdown(ledger),
  };
}

function writeMutationLedger(repositoryRoot, ledger) {
  const outputDirectory = path.join(repositoryRoot, "docs", "spring-migration");
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const [fileName, contents] of Object.entries(mutationLedgerArtifacts(ledger))) {
    fs.writeFileSync(path.join(outputDirectory, fileName), contents);
  }
}

function checkMutationLedgerArtifacts(repositoryRoot, ledger) {
  const outputDirectory = path.join(repositoryRoot, "docs", "spring-migration");
  const failures = [];
  for (const [fileName, expected] of Object.entries(mutationLedgerArtifacts(ledger))) {
    const outputPath = path.join(outputDirectory, fileName);
    if (!fs.existsSync(outputPath)) {
      failures.push(`${fileName} is missing; run mutation-ledger.js to generate it`);
    } else if (fs.readFileSync(outputPath, "utf8") !== expected) {
      failures.push(`${fileName} is stale; run mutation-ledger.js to regenerate it`);
    }
  }
  return failures;
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
    ? readHistoricalJson(repositoryRoot, "docs/spring-migration/mutation-ledger.json")
    : buildMutationLedger(repositoryRoot);
  const verification = snapshotMode ? verifyMutationLedger(ledger) : ledger.verification;
  const completeVerification = snapshotMode
    ? verifyCompleteMutationLedger(ledger, repositoryRoot, { historicalEvidence: true })
    : ledger.complete_verification;
  const checkFailures = snapshotMode ? snapshotFailures : (check ? checkMutationLedgerArtifacts(repositoryRoot, ledger) : []);
  console.log(`Mutation ledger: ${ledger.records.length} records, ${ledger.counts.assigned_migration_decisions} assigned decisions, ${ledger.counts.unassigned_migration_decisions} UNASSIGNED decisions.`);
  if (verify && !verification.passed) {
    console.error(`Verification failed: ${verification.failures.join("; ")}`);
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
  if (!check && !snapshotMode) writeMutationLedger(repositoryRoot, ledger);
}

if (require.main === module) main();

module.exports = {
  DECISION_FIELDS,
  STATE_CHANGING_METHODS,
  UNASSIGNED,
  buildMutationLedger,
  checkMutationLedgerArtifacts,
  findPythonFunction,
  readDecisionRegistry,
  renderMarkdown,
  SUPPORTED_DECISION_VALUES,
  verifyCompleteMutationLedger,
  verifyMutationLedger,
  writeMutationLedger,
};
