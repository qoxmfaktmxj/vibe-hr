"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  EXPECTED_OPERATIONAL_ROUTE_COUNT,
  buildManifest,
  pathMatches,
  parseFastApiFile,
  resolveBffMatches,
  resolveGlobalPrefix,
  verifyManifest,
} = require("./endpoint-manifest");

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function matches(candidatePath, endpointPath, catchAll = false) {
  return pathMatches(
    { backend_path: candidatePath, catch_all: catchAll },
    { full_path: endpointPath },
  );
}

assert.strictEqual(matches(
  "/api/v1/org/companies/dropdown",
  "/api/v1/org/companies/dropdown",
), true);
assert.strictEqual(matches(
  "/api/v1/org/companies/dropdown",
  "/api/v1/org/companies/{company_id}",
), false);

const parameterizedEndpoints = [
  { method: "GET", full_path: "/api/v1/mng/infra-configs/{master_id}" },
  { method: "POST", full_path: "/api/v1/mng/infra-configs/{master_id}" },
  { method: "DELETE", full_path: "/api/v1/mng/infra-configs/{config_id}" },
];
assert.deepStrictEqual(
  resolveBffMatches({
    backend_path: "/api/v1/mng/infra-configs/{param}",
    source_parameter_names: ["masterId"],
    catch_all: false,
  }, parameterizedEndpoints).matches.map((endpoint) => endpoint.method),
  ["GET", "POST"],
);
assert.deepStrictEqual(
  resolveBffMatches({
    backend_path: "/api/v1/mng/infra-configs/{param}",
    source_parameter_names: ["configId"],
    catch_all: false,
  }, parameterizedEndpoints).matches.map((endpoint) => endpoint.method),
  ["DELETE"],
);
assert.deepStrictEqual(
  resolveBffMatches({
    backend_path: "/api/v1/mng/infra-configs/{param}",
    source_parameter_names: [],
    catch_all: false,
  }, parameterizedEndpoints),
  {
    matches: [],
    ambiguous_backend_paths: [
      "/api/v1/mng/infra-configs/{master_id}",
      "/api/v1/mng/infra-configs/{config_id}",
    ],
  },
);
assert.strictEqual(matches(
  "/api/v1/org/companies/{param}",
  "/api/v1/org/companies/{company_id}",
), true);
assert.strictEqual(matches(
  "/api/v1/org/companies/{param}",
  "/api/v1/org/companies/dropdown",
), false);

assert.strictEqual(matches(
  "/api/v1/tra/{param}",
  "/api/v1/tra/courses/required",
  true,
), true);
assert.strictEqual(matches(
  "/api/v1/tra/{param}",
  "/api/v1/tra-admin/courses/required",
  true,
), false);
assert.strictEqual(matches(
  "/api/v1/org/{param}/proxy/{param}",
  "/api/v1/org/{company_id}/proxy/items",
  true,
), true);
assert.strictEqual(matches(
  "/api/v1/org/{param}/proxy/{param}",
  "/api/v1/org/acme/proxy/items",
  true,
), false);
assert.strictEqual(matches(
  "/api/v1/org/{param}/proxy/{param}",
  "/api/v1/org/{company_id}/proxy-sibling/items",
  true,
), false);
assert.strictEqual(matches(
  "/api/v1/org/{param}/proxy/{param}",
  "/api/v1/org/{company_id}/proxy",
  true,
), false);

const mainSource = `\
from fastapi import FastAPI
from app.api.example import router as example_router, targets_router as example_targets_router
app = FastAPI()
app.include_router(example_router, prefix="/api/v1")
app.include_router(example_targets_router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "ok"}
`;
const apiSource = `\
from fastapi import APIRouter, Depends
router = APIRouter(
    prefix="/example",
)

@router.get(
    "/items/{item_id}",
    response_model=ItemResponse,
    dependencies=[Depends(require_roles("admin"))],
)
async def read_item(item_id: int):
    return item_id

@router.post("/items")
def create_item():
    return None

targets_router = APIRouter(prefix="/ignored")
@targets_router.get("/targets")
def target_endpoint():
    return None

unused_router = APIRouter(prefix="/unused")
@unused_router.get("")
def unused_endpoint():
    return None

@router.get("/duplicate")
def first_duplicate():
    return None

@router.get("/duplicate")
def second_duplicate():
    return None
`;

const parsed = parseFastApiFile(apiSource, "backend/app/api/example.py", "/api/v1", new Set(["router"]));
assert.strictEqual(parsed.length, 4);
assert.deepStrictEqual(parsed[0], {
  domain: "example",
  source_file: "backend/app/api/example.py",
  source_line: 6,
  method: "GET",
  router_prefix: "/example",
  route_path: "/items/{item_id}",
  full_path: "/api/v1/example/items/{item_id}",
  function_name: "read_item",
  function_identity: "app.api.example.read_item",
  auth_clues: ["Depends(require_roles"],
  response_model_clue: "ItemResponse",
  bff_consumers: [],
});
assert.strictEqual(parsed[1].function_name, "create_item");
assert.ok(parsed.every((endpoint) => endpoint.full_path !== "/api/v1/targets"));
assert.strictEqual(resolveGlobalPrefix(mainSource), "/api/v1");

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "endpoint-manifest-"));
try {
  writeFile(temporaryRoot, "backend/app/main.py", mainSource);
  writeFile(temporaryRoot, "backend/app/api/example.py", apiSource);
  writeFile(temporaryRoot, "frontend/src/app/api/example/items/[itemId]/route.ts", "fetch(`${API_BASE_URL}/api/v1/example/items/${itemId}`);");
  const manifest = buildManifest(temporaryRoot, 5, { probeRuntime: false });
  assert.strictEqual(manifest.source_endpoint_count, 5);
  assert.strictEqual(manifest.operational_route_count, EXPECTED_OPERATIONAL_ROUTE_COUNT);
  assert.strictEqual(manifest.canonical_route_count, 13);
  assert.strictEqual(manifest.endpoints[0].bff_consumers.length, 1);
  assert.ok(manifest.endpoints.some((endpoint) => endpoint.full_path === "/api/v1/ignored/targets"));
  assert.ok(manifest.endpoints.every((endpoint) => endpoint.full_path !== "/api/v1/unused"));
  assert.strictEqual(manifest.canonical_routes["GET /health"].effective_handler.function_identity, "app.main.health");
  assert.ok(manifest.canonical_routes["HEAD /docs"]);
  assert.ok(!manifest.canonical_routes["HEAD /health"]);
  assert.strictEqual(manifest.duplicates.length, 1);
  assert.strictEqual(manifest.duplicates[0].resolution.status, "resolved");
  assert.strictEqual(manifest.duplicates[0].resolution.effective_handler.function_identity, "app.api.example.first_duplicate");
  assert.strictEqual(manifest.duplicates[0].resolution.shadowed_handlers[0].function_identity, "app.api.example.second_duplicate");
  assert.deepStrictEqual(verifyManifest(manifest), []);

  const duplicateManifest = { ...manifest };
  duplicateManifest.verification = {
    ...manifest.verification,
    source_count_matches_expected: false,
    missing_function_count: 1,
    missing_registration_order_count: 1,
    unresolved_bff_candidate_count: 1,
    ambiguous_bff_candidate_count: 1,
    operational_route_count_matches_expected: false,
    missing_operational_routes: ["GET /health"],
    unresolved_duplicate_count: 1,
  };
  assert.match(verifyManifest(duplicateManifest).join(" "), /expected 5 endpoint decorators/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /no function identity/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /no registration order/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /unresolved BFF candidates/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /ambiguous BFF candidates/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /operational\/framework method routes/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /missing operational\/framework routes/);
  assert.match(verifyManifest(duplicateManifest).join(" "), /duplicate groups are unresolved/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("endpoint-manifest tests passed");
