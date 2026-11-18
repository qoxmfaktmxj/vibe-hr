import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

// Exercise the same HTTP requests against two independent, seeded local databases.
// VIBEHR_PARITY_TOKEN is an access token issued through a legitimate fixture login.
const [left, right, identity, ...requestedDomains] = process.argv.slice(2);
if (!left || !right || !["anonymous", "admin", "employee"].includes(identity)) {
  throw new Error("Usage: node read-parity.mjs REFERENCE_URL CANDIDATE_URL anonymous|admin|employee [domain ...]");
}
function localOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Expected a loopback test origin");
  }
  return url.origin;
}
const reference = localOrigin(left);
const candidate = localOrigin(right);
if (reference === candidate) throw new Error("Reference and candidate must be distinct");
const headers = {};
if (identity !== "anonymous") {
  if (!process.env.VIBEHR_PARITY_TOKEN) throw new Error("Missing VIBEHR_PARITY_TOKEN issued for the isolated fixture");
  headers.authorization = `Bearer ${process.env.VIBEHR_PARITY_TOKEN}`;
  const me = await fetch(reference + "/api/v1/auth/me", { headers, redirect: "error" });
  if (me.status !== 200) throw new Error("Reference did not accept this fixture identity");
  const principal = await me.json();
  const validFixture = identity === "admin"
    ? ["admin@vibe-hr.local", "admin2@vibe-hr.local"].includes(principal.email) && principal.roles.includes("admin")
    : principal.email === "kr-0001@vibe-hr.local" && !principal.roles.includes("admin");
  if (!validFixture) throw new Error(`Expected the ${identity} seeded account`);
}

const rows = readFileSync(new URL("../../docs/rust-migration/spring-handlers.tsv", import.meta.url), "utf8")
  .trimEnd().split(/\r?\n/).slice(1).map(line => line.split("\t"));
const cases = rows.filter(([, method, path]) => method === "GET" && (path.startsWith("/api/v1/") || path === "/health"))
  .map(([domain, , path]) => [domain, path.replace(/\{[^}]+\}/g, "1")]);
cases.push(["platform", "/actuator/health/liveness"], ["platform", "/actuator/health/readiness"],
  ["hr", "/api/v1/employees?page=1&limit=1&positions=HR%20Director&positions=HR%20Manager&employment_statuses=active&hire_date_to=2026-12-31"],
  ["commoncode", "/api/v1/codes/groups/by-code/DOES_NOT_EXIST/active"]);

const selected = cases.filter(([domain]) => !requestedDomains.length || requestedDomains.includes(domain));
for (const domain of requestedDomains) {
  if (!selected.some(([key]) => key === domain)) throw new Error(`No read cases for domain ${domain}`);
}
const comparedHeaders = ["content-type", "content-disposition", "cache-control", "www-authenticate", "retry-after"];
async function read(origin, path) {
  const response = await fetch(origin + path, { headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
  const media = response.headers.get("content-type") ?? "";
  const body = media.includes("json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, body };
}
const counts = { matched_success: 0, matched_non_success: 0, verified_commoncode_repairs: 0, mismatch: 0, reference_server_error: 0 };
for (const [domain, path] of selected) {
  let [a, b] = await Promise.all([read(reference, path), read(candidate, path)]);
  let repaired = false;
  if (identity === "admin" && ["/api/v1/codes/groups", "/api/v1/codes/groups/1/items"].includes(path) &&
      a.status === 500 && a.body?.status === 500 && a.body.path === path && b.status === 200) {
    // These codes and names are NOT NULL. Explicit SQL LIKE wildcards on the reference
    // select the same set as omitted filters and avoid Hibernate's untyped null argument.
    a = await read(reference, path + "?code=%25&name=%25");
    if (a.status !== 200) throw new Error("Explicit wildcard reference did not recover " + path);
    repaired = true;
  }
  const different = [];
  if (a.status !== b.status) different.push("status");
  if (!isDeepStrictEqual(a.body, b.body)) different.push("body");
  for (const key of comparedHeaders) {
    if (a.headers.get(key) !== b.headers.get(key)) different.push(key);
  }
  if (a.status >= 500) counts.reference_server_error++;
  if (different.length) {
    counts.mismatch++;
    console.log(`${domain} GET ${path} ${a.status}/${b.status} differs: ${different.join(", ")}`);
  } else if (repaired) counts.verified_commoncode_repairs++;
  else if (a.status < 300) counts.matched_success++;
  else counts.matched_non_success++;
}
console.log(JSON.stringify({ identity, requests: selected.length, ...counts }));
if (counts.mismatch || counts.reference_server_error) process.exitCode = 1;
