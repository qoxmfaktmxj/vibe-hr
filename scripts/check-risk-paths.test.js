"use strict";

const assert = require("assert");
const test = require("node:test");
const { classify, parseArguments, patternMatches } = require("./check-risk-paths");

test("classifies Spring auth, menu, payroll, Flyway, and grid paths", () => {
  const result = classify([
    "backend-spring/src/main/java/com/vibehr/platform/security/JwtAuthenticationFilter.java",
    "backend-spring/src/main/java/com/vibehr/menu/MenuController.java",
    "backend-spring/src/main/java/com/vibehr/payroll/PayrollService.java",
    "backend-spring/src/main/resources/db/migration/V4__safe_change.sql",
    "frontend/src/components/grid/toolbar.tsx",
  ]);
  assert.equal(result.hits.auth_changed.length, 1);
  assert.equal(result.hits.permission_changed.length, 1);
  assert.equal(result.hits.payroll_changed.length, 1);
  assert.equal(result.hits.flyway_changed.length, 1);
  assert.equal(result.hits.deploy_changed.length, 1);
  assert.equal(result.hits.grid_changed.length, 1);
  assert.equal(result.backend_changed, true);
  assert.equal(result.r3_changed, true);
});

test("does not classify a retired backend path and rejects malformed CLI", () => {
  assert.equal(classify(["retired-backend/core/auth.txt"]).r3_changed, false);
  assert.throws(() => parseArguments(["--base"]), /requires a value/);
  assert.equal(patternMatches("backend-spring/src/main/java/com/vibehr/menu/MenuController.java", "backend-spring/src/main/java/com/vibehr/menu/**"), true);
  assert.equal(patternMatches("backend-spring\\src\\test\\java\\com\\vibehr\\auth\\HrAuthorizationTest.java", "backend-spring/src/test/java/com/vibehr/**/*AuthorizationTest.java"), true);
});
