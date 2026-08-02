#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { hasSnapshot, readHistoricalJson, verifySnapshot } = require("./retirement-snapshot");

const EXPECTED_SOURCE_COUNT = 287;
const EXPECTED_OPERATIONAL_ROUTE_COUNT = 9;
const REQUIRED_OPERATIONAL_ROUTE_KEYS = [
  "GET /health",
  "GET /openapi.json",
  "HEAD /openapi.json",
  "GET /docs",
  "HEAD /docs",
  "GET /docs/oauth2-redirect",
  "HEAD /docs/oauth2-redirect",
  "GET /redoc",
  "HEAD /redoc",
];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function listFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath, predicate);
      return predicate(fullPath) ? [fullPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function findClosingParen(source, openOffset) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openOffset; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function normalizePath(value) {
  const normalized = `/${String(value || "").replace(/^\/+|\/+$/g, "")}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/$/, "");
}

function joinPath(...parts) {
  return normalizePath(parts.filter(Boolean).join("/"));
}

function routeKey(method, routePath) {
  return `${method.toUpperCase()} ${normalizePath(routePath)}`;
}

function sourceRecordKey(endpoint) {
  return `${endpoint.source_file}:${endpoint.source_line}:${routeKey(endpoint.method, endpoint.full_path)}`;
}

function moduleForSourceFile(sourceFile) {
  return sourceFile
    .replace(/^backend\//, "")
    .replace(/\.py$/, "")
    .split("/")
    .join(".");
}

function functionIdentity(sourceFile, functionName) {
  return functionName ? `${moduleForSourceFile(sourceFile)}.${functionName}` : null;
}

function firstStringArgument(argumentsSource) {
  const match = argumentsSource.match(/^\s*(['"])(.*?)\1/s);
  return match ? match[2] : "";
}

function responseModel(argumentsSource) {
  const match = argumentsSource.match(/\bresponse_model\s*=\s*([A-Za-z_][A-Za-z0-9_.]*(?:\[[^\]\n]+\])?)/);
  return match ? match[1].trim() : null;
}

function authClues(decoratorSource, functionSource) {
  const combined = `${decoratorSource}\n${functionSource}`;
  return ["Depends(get_current_user", "Depends(require_roles", "require_menu_action_for_user", "AuthUser"]
    .filter((clue) => combined.includes(clue));
}

function routerPrefixes(source) {
  const prefixes = new Map();
  const routerPattern = /\b([A-Za-z_]\w*)\s*=\s*APIRouter\s*\(/g;
  let match;
  while ((match = routerPattern.exec(source))) {
    const closeOffset = findClosingParen(source, source.indexOf("(", match.index));
    if (closeOffset < 0) continue;
    const argumentsSource = source.slice(source.indexOf("(", match.index) + 1, closeOffset);
    const prefixMatch = argumentsSource.match(/\bprefix\s*=\s*(['"])(.*?)\1/s);
    prefixes.set(match[1], prefixMatch ? prefixMatch[2] : "");
    routerPattern.lastIndex = closeOffset + 1;
  }
  return prefixes;
}

function resolveGlobalPrefix(mainSource) {
  const prefixes = [...mainSource.matchAll(/\.include_router\s*\([\s\S]*?\bprefix\s*=\s*(['"])(.*?)\1/g)]
    .map((match) => match[2]);
  const apiV1Prefix = prefixes.find((prefix) => normalizePath(prefix) === "/api/v1");
  if (!apiV1Prefix) throw new Error("Could not resolve the /api/v1 include_router prefix from backend/app/main.py.");
  return normalizePath(apiV1Prefix);
}

function resolveIncludedRouters(repositoryRoot, mainSource) {
  const imports = new Map();
  const importPattern = /^from\s+app\.api\.([A-Za-z0-9_.]+)\s+import\s+([^\n]+)$/gm;
  let importMatch;
  while ((importMatch = importPattern.exec(mainSource))) {
    for (const binding of importMatch[2].split(",")) {
      const bindingMatch = binding.trim().match(/^([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?$/);
      if (!bindingMatch) continue;
      const exportedName = bindingMatch[1];
      const localName = bindingMatch[2] || exportedName;
      imports.set(localName, {
        source_file: `backend/app/api/${importMatch[1].replace(/\./g, "/")}.py`,
        router_name: exportedName,
      });
    }
  }

  const includedRouters = [];
  const includePattern = /\.include_router\s*\(\s*([A-Za-z_]\w*)\b/g;
  let includeMatch;
  while ((includeMatch = includePattern.exec(mainSource))) {
    const binding = imports.get(includeMatch[1]);
    if (!binding) continue;
    const sourcePath = path.join(repositoryRoot, binding.source_file);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Router ${includeMatch[1]} resolves to missing source file ${binding.source_file}.`);
    }
    includedRouters.push(binding);
  }
  if (includedRouters.length === 0) throw new Error("Could not resolve any app.include_router aliases from backend/app/main.py.");
  return includedRouters;
}

function domainFor(routePath, sourceFile) {
  const firstSegment = normalizePath(routePath).split("/").filter(Boolean)[0];
  return firstSegment || path.basename(sourceFile, ".py").split("_")[0];
}

function parseFastApiFile(source, sourceFile, globalPrefix, includedRouterNames = new Set(routerPrefixes(source).keys())) {
  const prefixes = routerPrefixes(source);
  const endpoints = [];
  const decoratorPattern = /@([A-Za-z_]\w*)\.(get|post|put|patch|delete)\s*\(/g;
  let match;
  while ((match = decoratorPattern.exec(source))) {
    const openOffset = source.indexOf("(", match.index);
    const closeOffset = findClosingParen(source, openOffset);
    if (closeOffset < 0) continue;
    if (!includedRouterNames.has(match[1]) || !prefixes.has(match[1])) {
      decoratorPattern.lastIndex = closeOffset + 1;
      continue;
    }
    const decoratorSource = source.slice(match.index, closeOffset + 1);
    const argumentsSource = source.slice(openOffset + 1, closeOffset);
    const afterDecorator = source.slice(closeOffset + 1);
    const functionMatch = afterDecorator.match(/^\s*(?:@[\s\S]*?\n\s*)*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    const functionName = functionMatch ? functionMatch[1] : null;
    const functionSource = functionMatch ? afterDecorator.slice(0, functionMatch.index + functionMatch[0].length) : "";
    const routerPrefix = normalizePath(prefixes.get(match[1]) || "");
    const routePath = normalizePath(firstStringArgument(argumentsSource));
    const joinedRoutePath = joinPath(routerPrefix, routePath);
    endpoints.push({
      domain: domainFor(joinedRoutePath, sourceFile),
      source_file: toPosix(sourceFile),
      source_line: lineAt(source, match.index),
      method: match[2].toUpperCase(),
      router_prefix: routerPrefix,
      route_path: routePath,
      full_path: joinPath(globalPrefix, joinedRoutePath),
      function_name: functionName,
      function_identity: functionIdentity(toPosix(sourceFile), functionName),
      auth_clues: authClues(decoratorSource, functionSource),
      response_model_clue: responseModel(argumentsSource),
      bff_consumers: [],
    });
    decoratorPattern.lastIndex = closeOffset + 1;
  }
  return endpoints;
}

function candidatePathDetails(value) {
  const sourceParameterNames = [];
  const replaceParameter = (_match, expression) => {
    const name = expression.trim().match(/^[A-Za-z_$][A-Za-z0-9_$]*$/)?.[0] || null;
    sourceParameterNames.push(name);
    return "{param}";
  };
  return {
    backend_path: normalizePath(
      value
        .replace(/\$\{([^}]+)\}/g, replaceParameter)
        .replace(/\{\{([^}]+)\}\}/g, replaceParameter),
    ),
    source_parameter_names: sourceParameterNames,
  };
}

function scanBffCandidates(frontendRoot, repositoryRoot) {
  const files = listFiles(frontendRoot, (filePath) => filePath.endsWith("route.ts"));
  const candidates = [];
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const pathPattern = /\/api\/v1(?:\/(?:[A-Za-z0-9_.{}-]+|\$\{[^}]+\}))*/g;
    let match;
    while ((match = pathPattern.exec(source))) {
      const candidatePath = candidatePathDetails(match[0]);
      if (candidatePath.backend_path === "/api/v1") continue;
      candidates.push({
        source_file: toPosix(path.relative(repositoryRoot, filePath)),
        source_line: lineAt(source, match.index),
        ...candidatePath,
        catch_all: filePath.includes("[..."),
      });
    }
  }
  return candidates.sort((left, right) => (
    left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line
    || left.backend_path.localeCompare(right.backend_path)
  ));
}

function isPathParameter(segment) {
  return /^\{[^}/]+\}$/.test(segment);
}

function pathSegmentsMatch(candidateSegment, endpointSegment) {
  if (isPathParameter(candidateSegment)) return isPathParameter(endpointSegment);
  return !isPathParameter(endpointSegment) && candidateSegment === endpointSegment;
}

function pathMatches(candidate, endpoint) {
  const candidateSegments = candidate.backend_path.split("/").filter(Boolean);
  const endpointSegments = endpoint.full_path.split("/").filter(Boolean);
  if (candidate.catch_all) {
    const prefixSegments = isPathParameter(candidateSegments.at(-1))
      ? candidateSegments.slice(0, -1)
      : candidateSegments;
    return endpointSegments.length > prefixSegments.length
      && prefixSegments.every((segment, index) => pathSegmentsMatch(segment, endpointSegments[index]));
  }
  return candidateSegments.length === endpointSegments.length
    && candidateSegments.every((segment, index) => pathSegmentsMatch(segment, endpointSegments[index]));
}

function normalizedParameterName(name) {
  return String(name || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function sourceParametersMatch(candidate, endpoint) {
  const candidateNames = (candidate.source_parameter_names || []).filter(Boolean);
  const endpointNames = endpoint.full_path
    .split("/")
    .filter(isPathParameter)
    .map((segment) => segment.slice(1, -1));
  return candidateNames.length > 0
    && candidateNames.length === endpointNames.length
    && candidateNames.every((name, index) => (
      normalizedParameterName(name) === normalizedParameterName(endpointNames[index])
    ));
}

function resolveBffMatches(candidate, endpoints) {
  const structuralMatches = endpoints.filter((endpoint) => pathMatches(candidate, endpoint));
  const structuralPaths = [...new Set(structuralMatches.map((endpoint) => endpoint.full_path))];
  if (candidate.catch_all || structuralPaths.length <= 1) {
    return { matches: structuralMatches, ambiguous_backend_paths: [] };
  }

  const evidencedMatches = structuralMatches.filter((endpoint) => sourceParametersMatch(candidate, endpoint));
  const evidencedPaths = [...new Set(evidencedMatches.map((endpoint) => endpoint.full_path))];
  if (evidencedPaths.length === 1) {
    return { matches: evidencedMatches, ambiguous_backend_paths: [] };
  }
  return { matches: [], ambiguous_backend_paths: structuralPaths };
}

function duplicateGroups(endpoints, canonicalRoutes, registrationEvidence) {
  const groups = new Map();
  for (const endpoint of endpoints) {
    const key = routeKey(endpoint.method, endpoint.full_path);
    groups.set(key, [...(groups.get(key) || []), endpoint]);
  }
  return [...groups.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([method_path, records]) => {
      const resolution = canonicalRoutes[method_path];
      const effectiveRecordKey = resolution?.effective_handler?.source_record_key;
      const orderedRecords = [...records].sort((left, right) => left.registration_order - right.registration_order);
      const resolved = Boolean(
        resolution
        && resolution.handler_count === records.length
        && records.every((record) => Number.isInteger(record.registration_order) && record.function_identity)
        && effectiveRecordKey === sourceRecordKey(orderedRecords[0])
        && resolution.effective_handler?.function_identity
        && resolution.shadowed_handlers.length === records.length - 1,
      );
      return {
        method_path,
        resolution: {
          status: resolved ? "resolved" : "unresolved",
          evidence: registrationEvidence,
          effective_handler: resolution?.effective_handler || null,
          shadowed_handlers: resolution?.shadowed_handlers || [],
        },
        records: records.map((record) => ({
          ...record,
          route_match: !resolved ? "unresolved" : sourceRecordKey(record) === effectiveRecordKey ? "effective" : "shadowed",
        })),
      };
    })
    .sort((left, right) => left.method_path.localeCompare(right.method_path));
}

function countBy(records, key) {
  const counts = {};
  for (const record of records) counts[record[key]] = (counts[record[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function fastApiConstructorArguments(mainSource) {
  const match = /\bapp\s*=\s*FastAPI\s*\(/.exec(mainSource);
  if (!match) return null;
  const openOffset = mainSource.indexOf("(", match.index);
  const closeOffset = findClosingParen(mainSource, openOffset);
  if (closeOffset < 0) return null;
  return {
    source_line: lineAt(mainSource, match.index),
    arguments_source: mainSource.slice(openOffset + 1, closeOffset),
  };
}

function fastApiOption(argumentsSource, optionName, defaultValue) {
  const pattern = new RegExp(`\\b${optionName}\\s*=\\s*(None|(['"])(.*?)\\2)`, "s");
  const match = argumentsSource.match(pattern);
  if (!match) return defaultValue;
  return match[1] === "None" ? null : match[3];
}

function findRootHealthRoute(mainSource) {
  const match = /@app\.get\s*\(\s*(['"])\/health\1[^)]*\)\s*\n\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/s.exec(mainSource);
  if (!match) return null;
  return {
    source_file: "backend/app/main.py",
    source_line: lineAt(mainSource, match.index),
    function_name: match[2],
    function_identity: functionIdentity("backend/app/main.py", match[2]),
  };
}

function frameworkOperationalRoutes(mainSource) {
  const fastApi = fastApiConstructorArguments(mainSource);
  if (!fastApi) return [];
  const openapiUrl = fastApiOption(fastApi.arguments_source, "openapi_url", "/openapi.json");
  const docsUrl = fastApiOption(fastApi.arguments_source, "docs_url", "/docs");
  const redocUrl = fastApiOption(fastApi.arguments_source, "redoc_url", "/redoc");
  const oauthRedirectUrl = fastApiOption(
    fastApi.arguments_source,
    "swagger_ui_oauth2_redirect_url",
    docsUrl ? `${docsUrl}/oauth2-redirect` : null,
  );
  if (!openapiUrl) return [];

  const routes = [
    [openapiUrl, "openapi", "fastapi.applications.FastAPI.setup.<locals>.openapi"],
    ...(docsUrl ? [[docsUrl, "swagger_ui_html", "fastapi.applications.FastAPI.setup.<locals>.swagger_ui_html"]] : []),
    ...(docsUrl && oauthRedirectUrl ? [[oauthRedirectUrl, "swagger_ui_redirect", "fastapi.applications.FastAPI.setup.<locals>.swagger_ui_redirect"]] : []),
    ...(redocUrl ? [[redocUrl, "redoc_html", "fastapi.applications.FastAPI.setup.<locals>.redoc_html"]] : []),
  ];
  return routes.flatMap(([routePath, functionName, functionIdentityValue], registrationOrder) => ["GET", "HEAD"].map((method) => ({
    source_file: "backend/app/main.py",
    source_line: fastApi.source_line,
    method,
    full_path: normalizePath(routePath),
    function_name: functionName,
    function_identity: functionIdentityValue,
    route_kind: "framework",
    registration_order: registrationOrder,
    head_behavior: method === "HEAD" ? "FastAPI documentation Route registers HEAD with GET." : null,
  })));
}

function operationalRoutes(mainSource, sourceRouteCount) {
  const routes = frameworkOperationalRoutes(mainSource);
  const rootHealth = findRootHealthRoute(mainSource);
  if (rootHealth) {
    routes.push({
      ...rootHealth,
      method: "GET",
      full_path: "/health",
      route_kind: "application",
      registration_order: routes.length === 0 ? 0 : sourceRouteCount + (routes.length / 2),
      head_behavior: "FastAPI APIRoute does not add HEAD for @app.get routes.",
    });
  }
  return routes.sort((left, right) => (
    left.registration_order - right.registration_order
    || left.method.localeCompare(right.method)
  ));
}

function fallbackRegistrationAssignments(repositoryRoot, mainSource, globalPrefix, includedRouters) {
  const assignments = new Map();
  let registrationOrder = frameworkOperationalRoutes(mainSource).length / 2;
  for (const includedRouter of includedRouters) {
    const source = fs.readFileSync(path.join(repositoryRoot, includedRouter.source_file), "utf8");
    const routerEndpoints = parseFastApiFile(
      source,
      includedRouter.source_file,
      globalPrefix,
      new Set([includedRouter.router_name]),
    );
    for (const endpoint of routerEndpoints) {
      assignments.set(sourceRecordKey(endpoint), registrationOrder);
      registrationOrder += 1;
    }
  }
  return assignments;
}

function probeApplicationRoutes() {
  return {
    available: false,
    detail: "Historical source parsing is intentionally static; the retirement verifier never starts a legacy runtime.",
  };
}

function applyRuntimeRegistration(endpoints, probe, fallbackAssignments) {
  if (!probe.available) {
    return {
      mode: "source_derived_main_include_order",
      detail: `Runtime app.routes probe unavailable: ${probe.detail}. Used main.py include_router order and decorator source order.`,
      assignments: fallbackAssignments,
    };
  }
  const byRouteKey = new Map();
  for (const endpoint of endpoints) {
    const key = routeKey(endpoint.method, endpoint.full_path);
    byRouteKey.set(key, [...(byRouteKey.get(key) || []), endpoint]);
  }
  const assignments = new Map();
  for (const route of probe.routes) {
    for (const method of route.methods) {
      const candidates = byRouteKey.get(routeKey(method, route.path)) || [];
      const candidate = candidates.find((endpoint) => (
        !assignments.has(sourceRecordKey(endpoint))
        && endpoint.function_identity === route.function_identity
      )) || candidates.find((endpoint) => !assignments.has(sourceRecordKey(endpoint)));
      if (candidate) assignments.set(sourceRecordKey(candidate), route.route_index);
    }
  }
  return {
    mode: "runtime_app_routes",
    detail: "Imported app.main:app and inspected app.routes without entering the lifespan context.",
    assignments,
  };
}

function canonicalHandler(record, recordKind) {
  return {
    record_kind: recordKind,
    source_record_key: recordKind === "source_decorator" ? sourceRecordKey(record) : null,
    source_file: record.source_file,
    source_line: record.source_line,
    function_name: record.function_name,
    function_identity: record.function_identity,
    registration_order: record.registration_order,
    ...(record.head_behavior ? { head_behavior: record.head_behavior } : {}),
  };
}

function buildCanonicalRoutes(endpoints, operationalRouteRecords) {
  const handlersByKey = new Map();
  for (const endpoint of endpoints) {
    const key = routeKey(endpoint.method, endpoint.full_path);
    handlersByKey.set(key, [...(handlersByKey.get(key) || []), { record: endpoint, record_kind: "source_decorator" }]);
  }
  for (const route of operationalRouteRecords) {
    const key = routeKey(route.method, route.full_path);
    handlersByKey.set(key, [...(handlersByKey.get(key) || []), { record: route, record_kind: "operational" }]);
  }
  return Object.fromEntries([...handlersByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, handlers]) => {
      const ordered = handlers.sort((left, right) => (
        left.record.registration_order - right.record.registration_order
        || left.record.source_file.localeCompare(right.record.source_file)
        || left.record.source_line - right.record.source_line
      ));
      const [effective, ...shadowed] = ordered;
      const [method, normalizedPath] = key.split(" ");
      return [key, {
        method,
        normalized_path: normalizedPath,
        handler_count: ordered.length,
        effective_handler: canonicalHandler(effective.record, effective.record_kind),
        shadowed_handlers: shadowed.map(({ record, record_kind }) => canonicalHandler(record, record_kind)),
      }];
    }));
}

function buildManifest(repositoryRoot, expectedCount = EXPECTED_SOURCE_COUNT, options = {}) {
  const mainPath = path.join(repositoryRoot, "backend", "app", "main.py");
  const mainSource = fs.readFileSync(mainPath, "utf8");
  const globalPrefix = resolveGlobalPrefix(mainSource);
  const includedRouters = resolveIncludedRouters(repositoryRoot, mainSource);
  const endpointBySourceRecord = new Map();
  for (const includedRouter of includedRouters) {
    const parsedEndpoints = parseFastApiFile(
      fs.readFileSync(path.join(repositoryRoot, includedRouter.source_file), "utf8"),
      includedRouter.source_file,
      globalPrefix,
      new Set([includedRouter.router_name]),
    );
    for (const endpoint of parsedEndpoints) endpointBySourceRecord.set(sourceRecordKey(endpoint), endpoint);
  }
  const fallbackAssignments = fallbackRegistrationAssignments(repositoryRoot, mainSource, globalPrefix, includedRouters);
  const registrationEvidence = applyRuntimeRegistration(
    [...endpointBySourceRecord.values()],
    options.probeRuntime === false ? { available: false, detail: "runtime probe disabled for deterministic unit test" } : probeApplicationRoutes(repositoryRoot),
    fallbackAssignments,
  );
  const endpoints = [...endpointBySourceRecord.values()]
    .map((endpoint) => ({
      ...endpoint,
      registration_order: registrationEvidence.assignments.get(sourceRecordKey(endpoint)) ?? null,
      registration_evidence: registrationEvidence.mode,
    }))
    .sort((left, right) => (
      left.domain.localeCompare(right.domain)
      || left.source_file.localeCompare(right.source_file)
      || left.source_line - right.source_line
    ));
  const bffCandidates = scanBffCandidates(path.join(repositoryRoot, "frontend", "src", "app", "api"), repositoryRoot);
  const unresolvedBffCandidates = [];
  const ambiguousBffCandidates = [];
  for (const candidate of bffCandidates) {
    const resolution = resolveBffMatches(candidate, endpoints);
    const matches = resolution.matches;
    if (resolution.ambiguous_backend_paths.length > 0) {
      ambiguousBffCandidates.push({
        ...candidate,
        matching_backend_paths: resolution.ambiguous_backend_paths,
      });
    } else if (matches.length === 0) {
      unresolvedBffCandidates.push(candidate);
    }
    for (const endpoint of matches) endpoint.bff_consumers.push(candidate);
  }
  for (const endpoint of endpoints) {
    endpoint.bff_consumers.sort((left, right) => left.source_file.localeCompare(right.source_file) || left.source_line - right.source_line);
  }
  const operationalRouteRecords = operationalRoutes(mainSource, fallbackAssignments.size)
    .map((route) => ({ ...route, registration_evidence: registrationEvidence.mode }));
  const canonicalRoutes = buildCanonicalRoutes(endpoints, operationalRouteRecords);
  const duplicates = duplicateGroups(endpoints, canonicalRoutes, registrationEvidence);
  const missingFunctions = endpoints.filter((endpoint) => !endpoint.function_name || !endpoint.function_identity);
  const unresolvedDuplicates = duplicates.filter((duplicate) => duplicate.resolution.status !== "resolved");
  const operationalRouteKeys = new Set(operationalRouteRecords.map((route) => routeKey(route.method, route.full_path)));
  const missingOperationalRoutes = REQUIRED_OPERATIONAL_ROUTE_KEYS.filter((key) => !operationalRouteKeys.has(key));
  return {
    schema_version: 2,
    generated_by: "scripts/spring-migration/endpoint-manifest.js",
    global_prefix: globalPrefix,
    expected_source_count: expectedCount,
    source_endpoint_count: endpoints.length,
    expected_operational_route_count: EXPECTED_OPERATIONAL_ROUTE_COUNT,
    operational_route_count: operationalRouteRecords.length,
    canonical_route_count: Object.keys(canonicalRoutes).length,
    route_registration_evidence: {
      mode: registrationEvidence.mode,
      detail: registrationEvidence.detail,
    },
    verification: {
      source_count_matches_expected: endpoints.length === expectedCount,
      missing_function_count: missingFunctions.length,
      missing_registration_order_count: endpoints.filter((endpoint) => !Number.isInteger(endpoint.registration_order)).length,
      unresolved_bff_candidate_count: unresolvedBffCandidates.length,
      ambiguous_bff_candidate_count: ambiguousBffCandidates.length,
      operational_route_count_matches_expected: operationalRouteRecords.length === EXPECTED_OPERATIONAL_ROUTE_COUNT,
      missing_operational_routes: missingOperationalRoutes,
      unresolved_duplicate_count: unresolvedDuplicates.length,
    },
    counts: { by_domain: countBy(endpoints, "domain"), by_file: countBy(endpoints, "source_file") },
    endpoints,
    operational_routes: operationalRouteRecords,
    canonical_routes: canonicalRoutes,
    duplicates,
    bff_candidates: bffCandidates,
    unresolved_bff_candidates: unresolvedBffCandidates,
    ambiguous_bff_candidates: ambiguousBffCandidates,
  };
}

function renderMarkdown(manifest) {
  const lines = [
    "# Endpoint Migration Manifest",
    "",
    "Generated by `scripts/spring-migration/endpoint-manifest.js`. Do not edit generated output manually.",
    "",
    "## Summary",
    "",
    `- Global prefix: \`${manifest.global_prefix}\``,
    `- Backend endpoint decorators: ${manifest.source_endpoint_count} (expected ${manifest.expected_source_count})`,
    `- Operational/framework method routes: ${manifest.operational_route_count} (expected ${manifest.expected_operational_route_count})`,
    `- Canonical method + normalized-path entries: ${manifest.canonical_route_count}`,
    `- BFF path candidates: ${manifest.bff_candidates.length}`,
    `- Unresolved BFF candidates: ${manifest.unresolved_bff_candidates.length}`,
    `- Ambiguous BFF candidates: ${manifest.ambiguous_bff_candidates.length}`,
    `- Method + path duplicate groups: ${manifest.duplicates.length}`,
    `- Unresolved duplicate groups: ${manifest.verification.unresolved_duplicate_count}`,
    `- Endpoints without a function: ${manifest.verification.missing_function_count}`,
    "",
    "## Route Registration Evidence",
    "",
    `- Method: \`${manifest.route_registration_evidence.mode}\``,
    `- Detail: ${manifest.route_registration_evidence.detail}`,
    "",
    "## Operational And Framework Routes",
    "",
    "| Method + path | Kind | Handler | Registration order | HEAD behavior |",
    "| --- | --- | --- | ---: | --- |",
    ...manifest.operational_routes.map((route) => `| ${routeKey(route.method, route.full_path)} | ${route.route_kind} | \`${route.function_identity}\` | ${route.registration_order} | ${route.head_behavior || ""} |`),
    "",
    "## Counts By Domain",
    "",
    "| Domain | Endpoints |",
    "| --- | ---: |",
    ...Object.entries(manifest.counts.by_domain).map(([domain, count]) => `| ${domain} | ${count} |`),
    "",
    "## Counts By File",
    "",
    "| Source file | Endpoints |",
    "| --- | ---: |",
    ...Object.entries(manifest.counts.by_file).map(([file, count]) => `| \`${file}\` | ${count} |`),
    "",
    "## Explicit Duplicate Report",
    "",
  ];
  if (manifest.duplicates.length === 0) {
    lines.push("No method + path duplicates found.");
  } else {
    lines.push("| Method + path | Effective first-match handler | Shadowed handler(s) | Evidence |", "| --- | --- | --- | --- |");
    for (const duplicate of manifest.duplicates) {
      const effective = duplicate.resolution.effective_handler;
      const shadowed = duplicate.resolution.shadowed_handlers;
      const effectiveLabel = effective ? `\`${effective.function_identity}\` (\`${effective.source_file}:${effective.source_line}\`)` : "unresolved";
      const shadowedLabel = shadowed.map((record) => `\`${record.function_identity}\` (\`${record.source_file}:${record.source_line}\`)`).join(", ") || "none";
      lines.push(`| ${duplicate.method_path} | ${effectiveLabel} | ${shadowedLabel} | ${duplicate.resolution.status}; ${duplicate.resolution.evidence.mode} |`);
    }
  }
  lines.push("", "## Unresolved BFF Candidates", "");
  if (manifest.unresolved_bff_candidates.length === 0) {
    lines.push("No unresolved statically visible BFF backend paths found.");
  } else {
    lines.push("| Backend path | BFF source |", "| --- | --- |");
    for (const candidate of manifest.unresolved_bff_candidates) {
      lines.push(`| ${candidate.backend_path} | \`${candidate.source_file}:${candidate.source_line}\` |`);
    }
  }
  lines.push("", "## Ambiguous BFF Candidates", "");
  if (manifest.ambiguous_bff_candidates.length === 0) {
    lines.push("No BFF candidates match multiple backend parameter paths after source-parameter reconciliation.");
  } else {
    lines.push("| Backend path | BFF source | Matching backend parameter paths |", "| --- | --- | --- |");
    for (const candidate of manifest.ambiguous_bff_candidates) {
      lines.push(`| ${candidate.backend_path} | \`${candidate.source_file}:${candidate.source_line}\` | ${candidate.matching_backend_paths.map((routePath) => `\`${routePath}\``).join(", ")} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function writeManifest(repositoryRoot, manifest) {
  const outputDirectory = path.join(repositoryRoot, "docs", "spring-migration");
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "endpoint-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, "endpoint-manifest.md"), renderMarkdown(manifest));
}

function verifyManifest(manifest) {
  const failures = [];
  if (!manifest.verification.source_count_matches_expected) {
    failures.push(`expected ${manifest.expected_source_count} endpoint decorators, found ${manifest.source_endpoint_count}`);
  }
  if (manifest.verification.missing_function_count > 0) {
    failures.push(`${manifest.verification.missing_function_count} endpoint records have no function identity`);
  }
  if (manifest.verification.missing_registration_order_count > 0) {
    failures.push(`${manifest.verification.missing_registration_order_count} endpoint records have no registration order`);
  }
  if (manifest.verification.unresolved_bff_candidate_count > 0) {
    failures.push(`${manifest.verification.unresolved_bff_candidate_count} unresolved BFF candidates`);
  }
  if (manifest.verification.ambiguous_bff_candidate_count > 0) {
    failures.push(`${manifest.verification.ambiguous_bff_candidate_count} ambiguous BFF candidates`);
  }
  if (!manifest.verification.operational_route_count_matches_expected) {
    failures.push(`expected ${manifest.expected_operational_route_count} operational/framework method routes, found ${manifest.operational_route_count}`);
  }
  if (manifest.verification.missing_operational_routes.length > 0) {
    failures.push(`missing operational/framework routes: ${manifest.verification.missing_operational_routes.join(", ")}`);
  }
  if (manifest.verification.unresolved_duplicate_count > 0) {
    failures.push(`${manifest.verification.unresolved_duplicate_count} duplicate groups are unresolved`);
  }
  return failures;
}

function main() {
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const verify = process.argv.includes("--verify");
  const snapshotMode = hasSnapshot(repositoryRoot);
  const snapshotFailures = snapshotMode ? verifySnapshot(repositoryRoot).failures : [];
  const manifest = snapshotMode
    ? readHistoricalJson(repositoryRoot, "docs/spring-migration/endpoint-manifest.json")
    : buildManifest(repositoryRoot);
  if (!snapshotMode) writeManifest(repositoryRoot, manifest);
  const failures = [...snapshotFailures, ...verifyManifest(manifest)];
  console.log(`Endpoint manifest: ${manifest.source_endpoint_count} source decorators, ${manifest.operational_route_count} operational routes, ${manifest.canonical_route_count} canonical routes, ${manifest.duplicates.length} duplicate groups, ${manifest.unresolved_bff_candidates.length} unresolved BFF candidates.`);
  if (failures.length > 0) {
    console.error(`Verification failed: ${failures.join("; ")}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  EXPECTED_SOURCE_COUNT,
  EXPECTED_OPERATIONAL_ROUTE_COUNT,
  buildManifest,
  buildCanonicalRoutes,
  operationalRoutes,
  parseFastApiFile,
  pathMatches,
  resolveBffMatches,
  renderMarkdown,
  resolveGlobalPrefix,
  resolveIncludedRouters,
  verifyManifest,
};
