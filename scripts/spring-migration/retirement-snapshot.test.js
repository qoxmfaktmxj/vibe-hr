"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { SNAPSHOT_RELATIVE_PATH, verifySnapshot } = require("./retirement-snapshot");

const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");

function copySnapshotFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-retirement-"));
  const sourceSnapshotPath = path.join(REPOSITORY_ROOT, SNAPSHOT_RELATIVE_PATH);
  const snapshot = JSON.parse(fs.readFileSync(sourceSnapshotPath, "utf8"));
  fs.mkdirSync(path.dirname(path.join(root, SNAPSHOT_RELATIVE_PATH)), { recursive: true });
  fs.writeFileSync(path.join(root, SNAPSHOT_RELATIVE_PATH), JSON.stringify(snapshot));
  for (const artifact of snapshot.artifacts) {
    const source = path.join(REPOSITORY_ROOT, artifact.path);
    const target = path.join(root, artifact.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return root;
}

function readFixtureSnapshot(root) {
  return JSON.parse(fs.readFileSync(path.join(root, SNAPSHOT_RELATIVE_PATH), "utf8"));
}

function writeFixtureSnapshot(root, snapshot) {
  fs.writeFileSync(path.join(root, SNAPSHOT_RELATIVE_PATH), JSON.stringify(snapshot));
}

test("retirement snapshot accepts the complete immutable evidence set", () => {
  const root = copySnapshotFixture();
  assert.deepEqual(verifySnapshot(root).failures, []);
});

test("retirement snapshot rejects artifact checksum drift", () => {
  const root = copySnapshotFixture();
  const snapshot = readFixtureSnapshot(root);
  fs.appendFileSync(path.join(root, snapshot.artifacts[0].path), "\nchanged");
  assert.match(verifySnapshot(root).failures.join("\n"), /checksum drifted/);
});

test("retirement snapshot rejects duplicate and missing artifact entries", () => {
  const root = copySnapshotFixture();
  const snapshot = readFixtureSnapshot(root);
  snapshot.artifacts[1] = { ...snapshot.artifacts[0] };
  writeFixtureSnapshot(root, snapshot);
  const failures = verifySnapshot(root, { checkArtifacts: false }).failures.join("\n");
  assert.match(failures, /duplicate artifact entry/);
  assert.match(failures, /missing required artifact entry/);
});

test("retirement snapshot rejects extra and malformed artifact entries", () => {
  const root = copySnapshotFixture();
  const snapshot = readFixtureSnapshot(root);
  snapshot.artifacts.push({ path: "docs/spring-migration/extra.json", sha256: "a".repeat(64) });
  snapshot.artifacts[0] = { path: snapshot.artifacts[0].path, sha256: snapshot.artifacts[0].sha256.toUpperCase() };
  writeFixtureSnapshot(root, snapshot);
  const failures = verifySnapshot(root, { checkArtifacts: false }).failures.join("\n");
  assert.match(failures, /extra artifact entry/);
  assert.match(failures, /non-lowercase SHA-256/);
});

test("retirement snapshot rejects frozen fact, lineage, and reference ownership tampering", () => {
  const root = copySnapshotFixture();
  const snapshot = readFixtureSnapshot(root);
  snapshot.facts.canonical_routes = 289;
  snapshot.alembic_lineage.reverse();
  snapshot.reference_data.ownership_records = 65;
  writeFixtureSnapshot(root, snapshot);
  const failures = verifySnapshot(root, { checkArtifacts: false }).failures.join("\n");
  assert.match(failures, /facts must exactly match/);
  assert.match(failures, /ordered lineage/);
  assert.match(failures, /reference-data facts and ownership/);
});
