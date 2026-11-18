import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const baseline = new URL("../../backend-rust/resources/openapi.json", import.meta.url);
const handlers = new URL("../../docs/rust-migration/spring-handlers.tsv", import.meta.url);
const [mode, address] = process.argv.slice(2);
if (!["capture", "verify"].includes(mode) || !address) {
  throw new Error("Usage: node scripts/rust-migration/openapi-contract.mjs capture|verify http://127.0.0.1:PORT");
}
const origin = new URL(address);
if (origin.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(origin.hostname) ||
    origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("Supply the origin of an isolated loopback backend");
}
const response = await fetch(new URL("/openapi.json", origin), { redirect: "error" });
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type") ?? "", /application\/json/);
const document = await response.json();
assert.equal(document.openapi, "3.1.0");
for (const server of document.servers ?? []) {
  if (server.url === origin.origin) server.url = "/";
}

const operations = new Set();
for (const [path, item] of Object.entries(document.paths)) {
  for (const method of Object.keys(item)) {
    if (/^(get|put|post|delete|options|head|patch|trace)$/.test(method)) {
      operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
}
const exposed = readFileSync(handlers, "utf8").trimEnd().split(/\r?\n/).slice(1)
  .map(row => row.split("\t"))
  .filter(([, , , controller]) => controller !== "DocumentationController")
  .map(([, method, path]) => `${method} ${path}`);
assert.deepEqual(operations, new Set(exposed), "Published operations differ from compiled Spring routes");

if (mode === "capture") {
  writeFileSync(baseline, JSON.stringify(document, null, 2) + "\n");
} else {
  const expected = JSON.parse(readFileSync(baseline, "utf8"));
  if (!isDeepStrictEqual(expected, document)) {
    const changes = [];
    for (const name of new Set([...Object.keys(expected), ...Object.keys(document)])) {
      if (isDeepStrictEqual(expected[name], document[name])) continue;
      if (name === "paths") {
        for (const path of Object.keys(document.paths)) {
          if (!isDeepStrictEqual(expected.paths[path], document.paths[path])) changes.push(path);
        }
      } else changes.push(name);
    }
    throw new Error(`OpenAPI contract differs: ${changes.join(", ")}`);
  }
}
console.log(`OpenAPI ${mode}: ${operations.size} operations, ${Object.keys(document.components.schemas).length} schemas`);
