"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildCoverage,
  normalizePath,
  parseSpringSource,
  routeKey,
  verifyCoverage,
} = require("./spring-route-coverage");

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

const controllerSource = `package fixture;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = ROOT, method = { RequestMethod.GET, RequestMethod.POST })
class FixtureController {
    private static final String API = "/api/v1";
    private static final String ROOT = API + "/fixtures";
    private static final String ITEM = "/items";

    @GetMapping(path = { ITEM + "/{itemId}", ITEM + "/{legacyItemId}" })
    String getItem() { return "ok"; }

    @RequestMapping(value = "/mutations/{mutationId:[0-9]+}", method = { RequestMethod.POST, RequestMethod.PATCH })
    String mutate() { return "ok"; }

    @PostMapping
    String root() { return "ok"; }
}
`;

const parsed = parseSpringSource(controllerSource, "backend-spring/src/main/java/fixture/FixtureController.java");
assert.strictEqual(parsed.controller_count, 1);
assert.deepStrictEqual(parsed.unresolved_annotations, []);
assert.deepStrictEqual(parsed.mappings.map((mapping) => mapping.key), [
  "GET /api/v1/fixtures/items/{param}",
  "POST /api/v1/fixtures",
  "POST /api/v1/fixtures/mutations/{param}",
]);
assert.strictEqual(parsed.mappings[0].source_line, 12);
assert.strictEqual(parsed.mappings[0].handler, "getItem");
assert.strictEqual(normalizePath("/api/v1/items/{itemId}"), "/api/v1/items/{param}");
assert.strictEqual(routeKey("get", "/api/v1/items/{itemId}"), "GET /api/v1/items/{param}");

const unresolvedSource = `package fixture;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ROOT)
class UnresolvedController {
    private static final String ROOT = dynamicRoot();
    @GetMapping(UNKNOWN_PATH)
    String endpoint() { return "ok"; }
}
`;
const unresolved = parseSpringSource(unresolvedSource, "UnresolvedController.java");
assert.strictEqual(unresolved.mappings.length, 0);
assert.match(unresolved.unresolved_annotations[0].detail, /unsupported path expression dynamicRoot\(\)/);

const nestedConstantSource = `package fixture;
import org.springframework.web.bind.annotation.*;
@RestController
class NestedConstantController {
    static class Paths { static final String HIDDEN = "/not-in-controller-scope"; }
    @GetMapping(HIDDEN)
    String endpoint() { return "ok"; }
}
`;
const nestedConstant = parseSpringSource(nestedConstantSource, "NestedConstantController.java");
assert.strictEqual(nestedConstant.mappings.length, 0);
assert.match(nestedConstant.unresolved_annotations[0].detail, /unresolved constant HIDDEN/);
assert.match(verifyCoverage({
  parser_source_integrity_errors: [],
  routes: { unresolved_annotations: nestedConstant.unresolved_annotations, duplicate_spring_mappings: [] },
}).join(" "), /could not be resolved deterministically/);

const duplicateSource = `package fixture;
import org.springframework.web.bind.annotation.*;
@RestController
class DuplicateController {
    @GetMapping("/same") String first() { return "ok"; }
    @GetMapping("/same") String second() { return "ok"; }
}
`;

function canonicalRoute(method, normalizedPath, shadowedHandlers = []) {
  return {
    method,
    normalized_path: normalizedPath,
    effective_handler: {
      record_kind: "source_decorator",
      source_file: "backend/app/api/example.py",
      source_line: 1,
    },
    shadowed_handlers: shadowedHandlers,
  };
}

function testManifest() {
  const canonicalRoutes = {
    "GET /api/v1/fixtures/items/{param}": canonicalRoute("GET", "/api/v1/fixtures/items/{param}"),
    "POST /api/v1/fixtures": canonicalRoute("POST", "/api/v1/fixtures"),
    "POST /api/v1/fixtures/mutations/{param}": canonicalRoute("POST", "/api/v1/fixtures/mutations/{param}"),
  };
  for (let index = 1; index <= 6; index += 1) {
    canonicalRoutes[`GET /api/v1/tra/shadow-${index}`] = canonicalRoute(
      "GET",
      `/api/v1/tra/shadow-${index}`,
      [{
        source_file: "backend/app/api/tra.py",
        source_line: index,
        function_name: `shadow${index}`,
        function_identity: `app.api.tra.shadow${index}`,
      }]
    );
  }
  return {
    schema_version: 2,
    canonical_route_count: Object.keys(canonicalRoutes).length,
    canonical_routes: canonicalRoutes,
  };
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spring-route-coverage-"));
try {
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/FixtureController.java", controllerSource);
  writeFile(temporaryRoot, "backend-spring/src/main/java/fixture/DuplicateController.java", duplicateSource);
  writeFile(temporaryRoot, "docs/spring-migration/endpoint-manifest.json", JSON.stringify(testManifest()));
  const coverage = buildCoverage(temporaryRoot);
  assert.strictEqual(coverage.completion.required_route_count, 9);
  assert.strictEqual(coverage.completion.implemented_route_count, 3);
  assert.strictEqual(coverage.completion.missing_route_count, 6);
  assert.strictEqual(coverage.completion.completion_percentage, 33.33);
  assert.strictEqual(coverage.routes.shadowed_python_tra_handlers.length, 6);
  assert.strictEqual(coverage.routes.duplicate_spring_mappings.length, 1);
  assert.match(verifyCoverage(coverage).join(" "), /duplicate Spring route mapping/);
  assert.match(verifyCoverage(coverage, true).join(" "), /required canonical route/);

const repeated = buildCoverage(temporaryRoot);
assert.deepStrictEqual(repeated, coverage);

writeFile(temporaryRoot, "backend-spring/src/main/resources/application.yml", `springdoc:\n  api-docs:\n    path: /openapi.json\n`);
const springdocCoverage = buildCoverage(temporaryRoot);
assert(springdocCoverage.routes.extra_spring_mappings.some((mapping) => mapping.key === "GET /openapi.json"));
assert(springdocCoverage.routes.extra_spring_mappings.some((mapping) => mapping.key === "HEAD /openapi.json"));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("spring-route-coverage tests passed");
