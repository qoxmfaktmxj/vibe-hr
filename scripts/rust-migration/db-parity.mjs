import { execFileSync, spawnSync } from "node:child_process";

const [container, reference, candidate, ...tables] = process.argv.slice(2);
const user = process.env.VIBEHR_PARITY_DB_USER;
if (!container || !reference || !candidate || !user || candidate === reference) {
  throw new Error("Set VIBEHR_PARITY_DB_USER and use db-parity.mjs CONTAINER REFERENCE_DB CANDIDATE_DB [relation ...]");
}
for (const identifier of [container, reference, candidate, user]) {
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(identifier)) throw new Error("Invalid test container/database identifier");
}
const details = JSON.parse(execFileSync("docker", ["inspect", container], {encoding: "utf8"}))[0];
const binding = details.NetworkSettings.Ports["5432/tcp"];
if (!details.Config.Labels?.["codex.task"]?.startsWith("vibehr-rust-") ||
    !binding?.length || binding.some(entry => !["127.0.0.1", "::1"].includes(entry.HostIp))) {
  throw new Error("Expected a labeled, loopback-only Rust parity container");
}

// Only object names, counts and fingerprints leave PostgreSQL. Sort row digests so physical
// order does not affect equality. This deliberately includes timestamps and sequence state.
const sql = String.raw`
BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL datestyle = 'ISO, YMD';
SELECT format(
  'SELECT json_build_array(%L, count(*), encode(sha256(convert_to(coalesce(string_agg(hash, '''' ORDER BY hash COLLATE "C"), ''''), ''UTF8'')), ''hex'')) FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text, ''UTF8'')), ''hex'') AS hash FROM %I.%I AS t) AS rows',
  tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SELECT format('SELECT json_build_array(%L, last_value, is_called) FROM %I.%I', sequencename, schemaname, sequencename)
FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename
\gexec
COMMIT;
`;
function fingerprints(database) {
  const run = spawnSync("docker", ["exec", "-i", container, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1",
    "-U", user, "-d", database], { input: sql, encoding: "utf8" });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`Read-only inventory failed for ${database}: ${run.stderr}`);
  const records = new Map();
  for (const line of run.stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const [name, value, state] = JSON.parse(line);
    records.set(name, JSON.stringify([value, state]));
  }
  if (!records.has("flyway_schema_history")) throw new Error(`Uninitialized test database ${database}`);
  return records;
}
const a = fingerprints(reference);
const b = fingerprints(candidate);
const selected = tables.length ? new Set(tables) : new Set([...a.keys(), ...b.keys()]);
let mismatches = 0;
for (const name of selected) {
  if (!a.has(name) && !b.has(name)) throw new Error(`Unknown relation ${name}`);
  if (a.get(name) === b.get(name)) continue;
  mismatches++;
  console.log(`${name}: ${a.has(name) && b.has(name) ? "data or sequence state differs" : "missing relation"}`);
}
console.log(`Compared ${selected.size} public relations including selected sequence states; ${mismatches} differ`);
if (mismatches) process.exitCode = 1;
