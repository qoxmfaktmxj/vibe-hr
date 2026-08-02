#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const bffRoot = path.join(repositoryRoot, "frontend", "src", "app", "api");
const manifestPath = path.join(repositoryRoot, "docs", "spring-migration", "endpoint-manifest.json");
const minimumBffRouteCount = 156;

function routeFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return routeFiles(target);
    return entry.isFile() && entry.name === "route.ts" ? [target] : [];
  });
}

function frontendSourceFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return frontendSourceFiles(target);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

function fail(message) {
  process.stderr.write(`BFF cutover audit failed: ${message}\n`);
  process.exitCode = 1;
}

const files = routeFiles(bffRoot).sort();
if (files.length < minimumBffRouteCount) fail(`expected at least ${minimumBffRouteCount} BFF route files, found ${files.length}`);

const legacyTarget = /localhost:8000|NEXT_PUBLIC_API_BASE_URL|process\.env\.API_BASE_URL/;
for (const file of frontendSourceFiles(path.join(repositoryRoot, "frontend", "src"))) {
  const source = fs.readFileSync(file, "utf8");
  if (legacyTarget.test(source)) fail(`${path.relative(repositoryRoot, file).split(path.sep).join("/")} still contains a Python-era API target`);
}

const proxyFiles = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(repositoryRoot, file).split(path.sep).join("/");
  if (legacyTarget.test(source)) fail(`${relative} still contains a Python-era API target`);
  if (!source.includes("backendApiBaseUrl()") && !source.includes("safeCatchallUrl")) continue;
  proxyFiles.push(relative);
  if (source.includes("backendApiBaseUrl()") && !source.includes('from "@/app/api/_lib/backend-target"')) {
    fail(`${relative} does not import the central BFF target`);
  }
}

for (const relative of [
  "frontend/src/app/api/tim/schedules/me/today/route.ts",
  "frontend/src/app/api/tim/annual-leave/employee/[employeeId]/route.ts",
]) {
  const source = fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
  if (!source.includes("backendApiBaseUrl()") || !source.includes('export async function GET')) {
    fail(`${relative} is not a Spring-targeted GET proxy`);
  }
}

const welfareBatch = fs.readFileSync(path.join(bffRoot, "wel", "benefit-types", "route.ts"), "utf8");
if (!welfareBatch.includes("/api/v1/wel/benefit-types/batch") || !welfareBatch.includes("export async function POST")) {
  fail("WEL benefit-type batch proxy is missing");
}

for (const relative of [
  "frontend/src/app/api/pay/[...path]/route.ts",
  "frontend/src/app/api/tra/[...path]/route.ts",
  "frontend/src/app/api/pap/[...path]/route.ts",
]) {
  const source = fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
  if (!source.includes("forwardBackendResponse") || !source.includes("safeCatchallUrl")) {
    fail(`${relative} does not use the safe streaming catch-all proxy contract`);
  }
  if (!source.includes('status: 400')) fail(`${relative} does not reject an invalid catch-all path`);
  if (!source.includes('"range", "if-range"')) fail(`${relative} does not forward range download requests`);
  if (source.includes("new URL(") || source.includes("arrayBuffer()") || source.includes("upstream.json()")) {
    fail(`${relative} bypasses the safe streaming catch-all proxy contract`);
  }
}

const forwarder = fs.readFileSync(path.join(bffRoot, "_lib", "forward-backend-response.ts"), "utf8");
for (const required of ["upstream.body", "upstream.status", "content-disposition", "content-type"]) {
  if (!forwarder.includes(required)) fail(`response forwarder does not preserve ${required}`);
}
for (const prohibited of ["content-length", "content-encoding"]) {
  if (forwarder.includes(`"${prohibited}"`)) fail(`response forwarder forwards unsafe ${prohibited}`);
}

const catchallUrl = fs.readFileSync(path.join(bffRoot, "_lib", "safe-catchall-url.ts"), "utf8");
for (const required of ["InvalidCatchallPathError", "decodeURIComponent", "encodeURIComponent", 'domain: "pay" | "pap" | "tra"']) {
  if (!catchallUrl.includes(required)) fail(`safe catch-all URL builder is missing ${required}`);
}

const backendTarget = fs.readFileSync(path.join(bffRoot, "_lib", "backend-target.ts"), "utf8");
for (const required of ['import "server-only"', "url.username", "url.password", "url.pathname", "url.search", "url.hash"]) {
  if (!backendTarget.includes(required)) fail(`central BFF target is missing server-only URL hardening: ${required}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.verification.unresolved_bff_candidate_count !== 0 || manifest.verification.ambiguous_bff_candidate_count !== 0) {
  fail("endpoint manifest has unresolved or ambiguous BFF candidates");
}

if (process.exitCode) process.exit(process.exitCode);
process.stdout.write(`BFF cutover audit: ${files.length} route files, ${proxyFiles.length} Spring-targeted proxies, no legacy Python target.\n`);
