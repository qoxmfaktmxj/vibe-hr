#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "docs", "spring-migration", "endpoint-manifest.json"), "utf8"));
const baseFlag = process.argv.indexOf("--base-url");
const baseUrl = baseFlag >= 0 ? process.argv[baseFlag + 1] : null;
if (!baseUrl) throw new Error("Usage: node scripts/spring-migration/verify-spring-openapi.js --base-url http://localhost:8080");

function normalizedPath(value) {
  return `/${value.replace(/^\/+|\/+$/g, "").replace(/\{[^}]+\}/g, "{param}")}`.replace(/\/$/, "") || "/";
}

async function request(route, method) {
  const response = await fetch(new URL(route, baseUrl), { method, redirect: "manual" });
  const body = method === "HEAD" ? "" : await response.text();
  if (!response.ok) throw new Error(`${method} ${route} returned ${response.status}: ${body.slice(0, 200)}`);
  return { response, body };
}

async function main() {
  const openapi = await request("/openapi.json", "GET");
  if (!openapi.response.headers.get("content-type")?.includes("application/json")) throw new Error("GET /openapi.json is not JSON");
  const document = JSON.parse(openapi.body);
  if (!document.openapi || !document.paths) throw new Error("GET /openapi.json did not return an OpenAPI document");

  for (const route of ["/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"]) {
    const get = route === "/openapi.json" ? openapi : await request(route, "GET");
    const head = await request(route, "HEAD");
    if (!head.response.headers.get("content-type")) throw new Error(`HEAD ${route} did not return a content type`);
    if (route !== "/openapi.json" && !get.response.headers.get("content-type")?.includes("text/html")) {
      throw new Error(`GET ${route} is not HTML`);
    }
    if (route === "/docs" && !get.body.includes("swagger")) throw new Error("GET /docs did not render Swagger UI");
    if (route === "/docs/oauth2-redirect" && !get.body.includes("oauth2")) throw new Error("GET /docs/oauth2-redirect did not render the OAuth redirect page");
    if (route === "/redoc" && !get.body.includes("redoc")) throw new Error("GET /redoc did not render ReDoc");
  }

  const documented = new Set();
  for (const [routePath, item] of Object.entries(document.paths)) {
    for (const method of Object.keys(item)) {
      if (["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(method)) {
        documented.add(`${method.toUpperCase()} ${normalizedPath(routePath)}`);
      }
    }
  }
  const required = Object.values(manifest.canonical_routes)
    .filter((route) => route.effective_handler.record_kind === "source_decorator")
    .map((route) => `${route.method} ${normalizedPath(route.normalized_path)}`);
  const missing = required.filter((key) => !documented.has(key));
  if (missing.length) throw new Error(`OpenAPI is missing ${missing.length} application operation(s): ${missing.join(", ")}`);
  process.stdout.write(`Spring OpenAPI verified: ${required.length} application operations and 8 public docs method contracts.\n`);
}

main().catch((error) => {
  process.stderr.write(`Spring OpenAPI verification failed: ${error.message}\n`);
  process.exit(1);
});
