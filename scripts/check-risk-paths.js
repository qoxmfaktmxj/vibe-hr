#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");

const DOCS = {
  governance: "docs/GOVERNANCE.md",
  architecture: "docs/ARCHITECTURE.md",
  test: "docs/TEST_STRATEGY.md",
  grid: "docs/GRID_SCREEN_STANDARD.md",
  permission: "docs/MENU_ACTION_PERMISSION_PLAN.md",
  ledger: "docs/TASK_LEDGER.md",
};

const RULES = [
  { key: "grid_changed", title: "Shared Grid / registry change", patterns: ["frontend/src/components/grid/**", "frontend/src/lib/grid/**", "config/grid-screens.json"], risk: "R2", why: "Shared Grid contracts and screen registry changes can affect multiple screens.", how_to_fix: "Run frontend grid validation and record regression evidence. Recommended: cd frontend && npm run validate:grid && npm run lint && npm run build", docs: [DOCS.grid, DOCS.test, DOCS.governance] },
  { key: "permission_changed", title: "Menu / permission path change", patterns: ["backend-spring/src/main/java/com/vibehr/menu/**", "backend-spring/src/main/java/com/vibehr/**/Authorization.java", "frontend/src/app/api/menus/**"], risk: "R2", why: "Permission-related changes must be checked on both UI and server sides.", how_to_fix: "Confirm approval if scope is broader than local behavior, then verify both UI behavior and server-side enforcement.", docs: [DOCS.permission, DOCS.governance, DOCS.test] },
  { key: "auth_changed", title: "Authentication / authorization change", patterns: ["backend-spring/src/main/java/com/vibehr/auth/**", "backend-spring/src/main/java/com/vibehr/platform/security/**", "backend-spring/src/main/java/com/vibehr/**/Authorization.java", "backend-spring/src/test/java/com/vibehr/**/*AuthorizationTest.java", "backend-spring/src/test/java/com/vibehr/platform/security/**"], risk: "R3", why: "Authentication and authorization are high-risk protected areas.", how_to_fix: "Require explicit approval, run auth/permission regression checks, and attach evidence before merging.", docs: [DOCS.governance, DOCS.test, DOCS.ledger] },
  { key: "payroll_changed", title: "Payroll semantic path change", patterns: ["backend-spring/src/main/java/com/vibehr/payroll/**", "backend-spring/src/main/java/com/vibehr/time/**", "backend-spring/src/main/resources/mybatis/**", "backend-spring/src/test/java/com/vibehr/payroll/**", "backend-spring/src/test/java/com/vibehr/time/**"], risk: "R3", why: "Payroll-related changes can affect financial meaning and require stronger review.", how_to_fix: "Require explicit approval, verify representative seed cases, and document rollback or stop conditions.", docs: [DOCS.governance, DOCS.test, DOCS.ledger] },
  { key: "flyway_changed", title: "Flyway schema or reference-data change", patterns: ["backend-spring/src/main/resources/db/migration/**", "docs/spring-migration/flyway-*.json", "docs/spring-migration/flyway-*.md", "docs/spring-migration/flyway-*.sql", "scripts/spring-migration/flyway-*.js"], risk: "R3", why: "Flyway migration and reference-data ownership changes alter production schema or seeded permissions.", how_to_fix: "Require explicit approval, run frozen evidence and Flyway verification, and record candidate/rollback gates.", docs: [DOCS.governance, DOCS.test, DOCS.ledger] },
  { key: "deploy_changed", title: "Deploy / infra path change", patterns: [".github/workflows/**", "docker-compose*.yml", "backend-spring/Dockerfile", "frontend/Dockerfile", "backend-spring/src/main/resources/db/migration/**", ".env.deploy", "scripts/spring-migration/**"], risk: "R3", why: "Deploy, Flyway, and infrastructure changes directly affect the Java operating flow.", how_to_fix: "Require explicit approval, describe main impact, and prepare a health-check or rollback note.", docs: [DOCS.governance, DOCS.ledger] },
];

function normalize(value) { return String(value).replace(/\\/g, "/"); }
function patternMatches(value, pattern) {
  const escaped = normalize(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(normalize(value));
}
function matchesAny(value, patterns) { return patterns.some((pattern) => patternMatches(value, pattern)); }
function git(...args) {
  const result = childProcess.spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || "git command failed").trim());
  return result.stdout.trim();
}
function resolveBaseHead(base, head) {
  const resolvedHead = head || git("rev-parse", "HEAD");
  if (base) return [base, resolvedHead];
  try { return [git("merge-base", "HEAD", "origin/main"), resolvedHead]; }
  catch { return [git("rev-parse", `${resolvedHead}~1`), resolvedHead]; }
}
function changedFiles(base, head) {
  const output = git("diff", "--name-only", base, head);
  return output ? output.split(/\r?\n/).filter(Boolean).map(normalize) : [];
}
function writeOutput(file, key, value) { if (file) fs.appendFileSync(file, `${key}=${value}\n`, "utf8"); }
function parseArguments(argumentsList) {
  const options = { base: null, head: null, githubOutput: null, failOnR3: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--fail-on-r3") options.failOnR3 = true;
    else if (["--base", "--head", "--github-output"].includes(argument)) {
      if (!argumentsList[index + 1]) throw new Error(`${argument} requires a value`);
      const field = argument === "--github-output" ? "githubOutput" : argument.slice(2);
      options[field] = argumentsList[++index];
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}
function classify(files) {
  const hits = Object.fromEntries(RULES.map((rule) => [rule.key, []]));
  for (const file of files) for (const rule of RULES) if (matchesAny(file, rule.patterns)) hits[rule.key].push(file);
  return { hits, backend_changed: files.some((file) => matchesAny(file, ["backend-spring/**"])), r3_changed: Boolean(hits.auth_changed.length || hits.payroll_changed.length || hits.flyway_changed.length || hits.deploy_changed.length) };
}
function run(options) {
  const [base, head] = resolveBaseHead(options.base, options.head);
  const files = changedFiles(base, head);
  const result = classify(files);
  console.log("# Risk Path Classification");
  console.log(`- Base: ${base}`); console.log(`- Head: ${head}`); console.log(`- Changed file count: ${files.length}`); console.log("\n## Changed Files");
  console.log(files.length ? files.map((file) => `- ${file}`).join("\n") : "- none");
  console.log("\n## Rule Summary");
  for (const rule of RULES) {
    const matched = result.hits[rule.key];
    console.log(`- ${rule.key}: ${Boolean(matched.length)}`);
    if (matched.length) {
      console.log(`  - title: ${rule.title}`); console.log(`  - risk: ${rule.risk}`); console.log(`  - matched paths: ${matched.join(", ")}`); console.log(`  - why: ${rule.why}`); console.log(`  - how to fix: ${rule.how_to_fix}`); console.log(`  - docs: ${rule.docs.join(", ")}`);
      if (process.env.GITHUB_ACTIONS === "true") console.log(`::warning::${rule.title} detected (${rule.risk}). Why: ${rule.why} How to fix: ${rule.how_to_fix} Docs: ${rule.docs.join(", ")}`);
    }
  }
  console.log(`- backend_changed: ${result.backend_changed}`); console.log(`- r3_changed: ${result.r3_changed}`);
  for (const [key, value] of Object.entries({ grid_changed: Boolean(result.hits.grid_changed.length), permission_changed: Boolean(result.hits.permission_changed.length), auth_changed: Boolean(result.hits.auth_changed.length), payroll_changed: Boolean(result.hits.payroll_changed.length), flyway_changed: Boolean(result.hits.flyway_changed.length), deploy_changed: Boolean(result.hits.deploy_changed.length), backend_changed: result.backend_changed, r3_changed: result.r3_changed })) writeOutput(options.githubOutput, key, String(value));
  return result.r3_changed && options.failOnR3 ? 1 : 0;
}
function main() { try { process.exitCode = run(parseArguments(process.argv.slice(2))); } catch (error) { console.error(`[error] failed to classify changed files: ${error.message}`); process.exitCode = 2; } }
if (require.main === module) main();
module.exports = { RULES, classify, matchesAny, parseArguments, patternMatches, resolveBaseHead, run };
