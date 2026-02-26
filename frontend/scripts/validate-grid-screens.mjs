#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const registryPath = path.join(repoRoot, 'config', 'grid-screens.json');

function fail(message) {
  console.error(`❌ validate:grid - ${message}`);
  process.exitCode = 1;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
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

  if (!page.includes('export const GRID_SCREEN')) {
    fail(`[${key}] GRID_SCREEN metadata missing in ${screen.pageFile}`);
  }
  if (!page.includes(`registryKey: "${key}"`) && !page.includes(`registryKey: '${key}'`)) {
    fail(`[${key}] registryKey mismatch in ${screen.pageFile}`);
  }
  if (!component.includes('AgGridReact')) {
    fail(`[${key}] AgGridReact missing in ${screen.componentFile}`);
  }

}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ validate:grid - all registered AG Grid screens passed');
