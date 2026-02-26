#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const registryPath = path.join(repoRoot, "config", "grid-screens.json");

function fail(message) {
  console.error(`[validate:grid] ${message}`);
  process.exitCode = 1;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractProfile(pageSource) {
  const match = pageSource.match(/profile:\s*["']([^"']+)["']/);
  return match?.[1] ?? null;
}

if (!fs.existsSync(registryPath)) {
  fail(`Missing registry: ${registryPath}`);
  process.exit(process.exitCode ?? 1);
}

const registry = JSON.parse(readText(registryPath));
const screens = registry?.screens ?? {};

for (const [key, screen] of Object.entries(screens)) {
  const pageFile = path.join(repoRoot, screen.pageFile);
  const componentFile = path.join(repoRoot, screen.componentFile);
  const expectedProfile = screen.profile ?? "standard-v1";

  if (!fs.existsSync(pageFile)) {
    fail(`[${key}] page file not found: ${screen.pageFile}`);
    continue;
  }
  if (!fs.existsSync(componentFile)) {
    fail(`[${key}] component file not found: ${screen.componentFile}`);
    continue;
  }

  const page = readText(pageFile);
  const component = readText(componentFile);

  if (!page.includes("export const GRID_SCREEN")) {
    fail(`[${key}] GRID_SCREEN metadata missing in ${screen.pageFile}`);
  }
  if (!page.includes(`registryKey: "${key}"`) && !page.includes(`registryKey: '${key}'`)) {
    fail(`[${key}] registryKey mismatch in ${screen.pageFile}`);
  }
  if (!component.includes("AgGridReact")) {
    fail(`[${key}] AgGridReact missing in ${screen.componentFile}`);
  }

  const pageProfile = extractProfile(page);
  if (!pageProfile) {
    fail(`[${key}] GRID_SCREEN.profile missing in ${screen.pageFile}`);
    continue;
  }

  if (pageProfile !== expectedProfile) {
    fail(
      `[${key}] profile mismatch: page=${pageProfile}, registry=${expectedProfile} (${screen.pageFile})`,
    );
  }

  if (pageProfile === "standard-v2") {
    const requiredTokens = [
      "ManagerPageShell",
      "ManagerSearchSection",
      "ManagerGridSection",
      "GridToolbarActions",
      "toggleDeletedStatus",
      "getGridRowClass",
      "getGridStatusCellClass",
      "_status",
      "_original",
      "_prevStatus",
    ];

    for (const token of requiredTokens) {
      if (!component.includes(token)) {
        fail(`[${key}] standard-v2 requires "${token}" in ${screen.componentFile}`);
      }
    }

    const looksPaged = component.includes("totalCount") && component.includes("pageSize");
    if (looksPaged) {
      if (!component.includes("useGridPagination")) {
        fail(`[${key}] paged standard-v2 screen must use useGridPagination`);
      }
      if (!component.includes("GridPaginationControls")) {
        fail(`[${key}] paged standard-v2 screen must use GridPaginationControls`);
      }
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[validate:grid] all registered AG Grid screens passed");

