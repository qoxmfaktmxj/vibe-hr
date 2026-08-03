#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SNAPSHOT_RELATIVE_PATH = "docs/spring-migration/python-retirement-snapshot.json";
const SNAPSHOT_STATUS = "immutable_historical_evidence";
const SNAPSHOT_PURPOSE = "Frozen pre-retirement FastAPI and Alembic parity evidence. These historical source references are not executable instructions and must be verified by checksum after Python removal.";
const REQUIRED_FACTS = Object.freeze({
  source_decorator_routes: 287,
  source_effective_routes: 281,
  operational_routes: 9,
  canonical_routes: 290,
  tables: 105,
  state_changing_records: 166,
  mutation_decisions: 1162,
  default_factory_decisions: 193,
  alembic_revisions: 7,
  reference_data_rows: 1377,
});
const REQUIRED_ALEMBIC_LINEAGE = Object.freeze([
  "46507f02680a",
  "470095da5995",
  "75d1c0e7dd53",
  "7e248ebed919",
  "ea501237b804",
  "ffc17a622333",
  "org_mapping_foundation_20260722",
]);
const REQUIRED_REFERENCE_DATA = Object.freeze({
  required_tables: 33,
  ownership_records: 66,
  required_ledger_functions: 33,
  source_dump_sha256: "454731a3499d0c687b4150e9dff9317aa14dc3e3d5ad046f622838aa0cd6766d",
});
const REQUIRED_ARTIFACTS = Object.freeze([
  ["docs/spring-migration/endpoint-manifest.json", "3f85ee1e4da5bf5e9627ff8388d5558fcf6aa122a5dadf81b080293e6afeef46"],
  ["docs/spring-migration/endpoint-manifest.md", "db9d5a767d80e7919336f1c09ab6462580348d94ab7c57bd06509e23229b7d59"],
  ["docs/spring-migration/mutation-ledger.json", "e96e587e7d3dca9054a100438e56ab14259e0eb11e8a727772437f92e37d7633"],
  ["docs/spring-migration/mutation-ledger.md", "bf811e8389a38deab7100a1b6387d7baf9b90ac5cd27aae16540c52b65b0c113"],
  ["docs/spring-migration/mutation-decision-registry.json", "593af126b09ba84fdda2f5a85617ee359f11b996befc47a694bbc559b6e38c85"],
  ["docs/spring-migration/schema-ledger.json", "e124a10c16b5f12fa1d579d4eccf48a2a1e0c81b164010c803e81e8f22ad7e34"],
  ["docs/spring-migration/schema-ledger.md", "27743512b11bc88ee867b6dcd312a66484620c57acc4e9defeaca6646d63821d"],
  ["docs/spring-migration/schema-default-decision-registry.json", "720bdfe5760b250c2cbb8996f2fa82568765b72a4dff05d6b76bb62c3004c1a9"],
  ["docs/spring-migration/flyway-baseline-manifest.json", "894c502b41d2133b5d0efdd6a89c70d5238ea9a45d69dd3bdf151d5250c11748"],
  ["docs/spring-migration/flyway-reference-seed-manifest.json", "ea9ab1e883bc626bab758ca527201263e770dfe01ac7769c4eabeefe6a1cf4ff"],
  ["docs/spring-migration/flyway-required-reference-source.sql", "454731a3499d0c687b4150e9dff9317aa14dc3e3d5ad046f622838aa0cd6766d"],
  ["docs/spring-migration/flyway-seed-ownership-ledger.json", "8763eb0208741dd8f91ff44284de1c7dbe15824d51ad24e9cc667748c12f1fab"],
  ["docs/spring-migration/flyway-seed-ownership-ledger.md", "96258d78b125ae7b114bd8e158e9881157a2f7582b19cba9c1cd9867d1e526d6"],
  ["backend-spring/src/main/resources/db/migration/V1__alembic_head_baseline.sql", "e96d705057fb595d1bfd9ca21a8e97b6fa562a1096083c191468e4bddb59aa36"],
  ["backend-spring/src/main/resources/db/migration/V2__retire_alembic_version_marker.sql", "198202661fca40cfe4036cb4488a6b4b354cafaf35e22b53c08b5dcb75b6f192"],
  ["backend-spring/src/main/resources/db/migration/V3__required_reference_data.sql", "9e964bf96d864a7ef8f0a3114d3a6f27a6c187fed94031c8e0d92a6da51f0dcc"],
].map(([pathValue, sha256Value]) => Object.freeze({ path: pathValue, sha256: sha256Value })));

function sha256(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function snapshotPath(repositoryRoot) {
  return path.join(repositoryRoot, SNAPSHOT_RELATIVE_PATH);
}

function hasSnapshot(repositoryRoot) {
  return fs.existsSync(snapshotPath(repositoryRoot));
}

function readSnapshot(repositoryRoot) {
  const file = snapshotPath(repositoryRoot);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactObjectValue(actual, expected) {
  if (!isPlainObject(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
    && expectedKeys.every((key) => actual[key] === expected[key]);
}

function verifySnapshot(repositoryRoot, options = {}) {
  let snapshot;
  try {
    snapshot = readSnapshot(repositoryRoot);
  } catch (error) {
    return { snapshot: null, failures: [`Python retirement snapshot is not valid JSON: ${error.message}`] };
  }

  const failures = [];
  if (!isPlainObject(snapshot)) {
    return { snapshot, failures: ["Python retirement snapshot is missing or malformed."] };
  }
  const requiredTopLevelKeys = ["schema_version", "status", "purpose", "facts", "alembic_lineage", "reference_data", "artifacts"].sort();
  if (JSON.stringify(Object.keys(snapshot).sort()) !== JSON.stringify(requiredTopLevelKeys)) {
    failures.push("Python retirement snapshot has an unexpected top-level shape.");
  }
  if (snapshot.schema_version !== 1 || snapshot.status !== SNAPSHOT_STATUS || snapshot.purpose !== SNAPSHOT_PURPOSE) {
    failures.push("Python retirement snapshot has an unsupported immutable contract.");
  }
  if (!hasExactObjectValue(snapshot.facts, REQUIRED_FACTS)) {
    failures.push("retirement snapshot facts must exactly match the frozen source facts");
  }
  if (JSON.stringify(snapshot.alembic_lineage) !== JSON.stringify(REQUIRED_ALEMBIC_LINEAGE)) {
    failures.push("retirement snapshot Alembic lineage must exactly match the frozen ordered lineage");
  }
  if (!hasExactObjectValue(snapshot.reference_data, REQUIRED_REFERENCE_DATA)) {
    failures.push("retirement snapshot reference-data facts and ownership must exactly match the frozen contract");
  }

  const expectedArtifacts = new Map(REQUIRED_ARTIFACTS.map((artifact) => [artifact.path, artifact.sha256]));
  const seenPaths = new Set();
  if (!Array.isArray(snapshot.artifacts)) {
    failures.push("retirement snapshot artifacts must be an array.");
  } else {
    for (const artifact of snapshot.artifacts) {
      if (!isPlainObject(artifact) || JSON.stringify(Object.keys(artifact).sort()) !== JSON.stringify(["path", "sha256"])) {
        failures.push("retirement snapshot has a malformed artifact entry");
        continue;
      }
      if (typeof artifact.path !== "string" || typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
        failures.push("retirement snapshot has a malformed artifact entry or non-lowercase SHA-256");
        continue;
      }
      if (seenPaths.has(artifact.path)) {
        failures.push(`retirement snapshot has a duplicate artifact entry: ${artifact.path}`);
        continue;
      }
      seenPaths.add(artifact.path);
      const expectedHash = expectedArtifacts.get(artifact.path);
      if (!expectedHash) {
        failures.push(`retirement snapshot has an extra artifact entry: ${artifact.path}`);
        continue;
      }
      if (artifact.sha256 !== expectedHash) {
        failures.push(`retirement snapshot checksum contract changed: ${artifact.path}`);
        continue;
      }
      if (options.checkArtifacts !== false) {
        const file = path.join(repositoryRoot, artifact.path);
        if (!fs.existsSync(file)) failures.push(`retirement evidence artifact is missing: ${artifact.path}`);
        else if (sha256(fs.readFileSync(file)) !== artifact.sha256) failures.push(`retirement evidence artifact checksum drifted: ${artifact.path}`);
      }
    }
    for (const expectedPath of expectedArtifacts.keys()) {
      if (!seenPaths.has(expectedPath)) failures.push(`retirement snapshot is missing required artifact entry: ${expectedPath}`);
    }
  }
  return { snapshot, failures };
}

function readHistoricalJson(repositoryRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

module.exports = {
  REQUIRED_ALEMBIC_LINEAGE,
  REQUIRED_ARTIFACTS,
  REQUIRED_FACTS,
  REQUIRED_REFERENCE_DATA,
  SNAPSHOT_RELATIVE_PATH,
  hasSnapshot,
  readHistoricalJson,
  readSnapshot,
  sha256,
  snapshotPath,
  verifySnapshot,
};
