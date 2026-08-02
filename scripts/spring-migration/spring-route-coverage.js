#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE"];
const MAPPING_METHODS = {
  RequestMapping: null,
  GetMapping: ["GET"],
  PostMapping: ["POST"],
  PutMapping: ["PUT"],
  PatchMapping: ["PATCH"],
  DeleteMapping: ["DELETE"],
};
const EXPECTED_TRA_SHADOWED_HANDLER_COUNT = 6;

// This is deliberately small. Add an entry only with an explicit migration decision.
const COMPLETE_ALLOWLIST = Object.freeze({
  missing: Object.freeze({}),
  extra: Object.freeze({}),
});

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function normalizePath(value) {
  const normalized = `/${String(value || "")
    .replace(/\{[^}]*\}/g, "{param}")
    .replace(/^\/+|\/+$/g, "")}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/$/, "");
}

function joinPath(...parts) {
  return normalizePath(parts.filter((part) => part !== "" && part != null).join("/"));
}

function routeKey(method, routePath) {
  return `${method.toUpperCase()} ${normalizePath(routePath)}`;
}

function listJavaFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listJavaFiles(fullPath);
      return entry.isFile() && entry.name.endsWith(".java") ? [fullPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function maskJava(source) {
  const characters = source.split("");
  let index = 0;
  let state = "code";

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (character === "/" && next === "/") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 2;
        state = "line-comment";
        continue;
      }
      if (character === "/" && next === "*") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 2;
        state = "block-comment";
        continue;
      }
      if (character === '"' || character === "'") {
        characters[index] = " ";
        index += 1;
        state = character === '"' ? "string" : "char";
        continue;
      }
      index += 1;
      continue;
    }
    if (state === "line-comment") {
      if (character !== "\n") characters[index] = " ";
      if (character === "\n") state = "code";
      index += 1;
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 2;
        state = "code";
        continue;
      }
      if (character !== "\n") characters[index] = " ";
      index += 1;
      continue;
    }

    characters[index] = character === "\n" ? "\n" : " ";
    if (character === "\\") {
      if (index + 1 < source.length) {
        characters[index + 1] = source[index + 1] === "\n" ? "\n" : " ";
      }
      index += 2;
      continue;
    }
    if ((state === "string" && character === '"') || (state === "char" && character === "'")) {
      state = "code";
    }
    index += 1;
  }
  return characters.join("");
}

function findClosingDelimiter(source, openOffset, openCharacter, closeCharacter) {
  let depth = 0;
  let state = "code";

  for (let index = openOffset; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "string" || state === "char") {
      if (character === "\\") {
        index += 1;
      } else if ((state === "string" && character === '"') || (state === "char" && character === "'")) {
        state = "code";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      state = "line-comment";
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }
    if (character === '"') {
      state = "string";
      continue;
    }
    if (character === "'") {
      state = "char";
      continue;
    }
    if (character === openCharacter) depth += 1;
    if (character === closeCharacter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function skipTrivia(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "/") {
      const nextLine = source.indexOf("\n", index + 2);
      index = nextLine < 0 ? source.length : nextLine + 1;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "*") {
      const endComment = source.indexOf("*/", index + 2);
      index = endComment < 0 ? source.length : endComment + 2;
      continue;
    }
    break;
  }
  return index;
}

function scanAnnotations(source) {
  const annotations = [];
  let index = 0;
  let state = "code";

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      index += 1;
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "string" || state === "char") {
      if (character === "\\") {
        index += 2;
      } else {
        if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
        index += 1;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      state = "line-comment";
      index += 2;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index += 2;
      continue;
    }
    if (character === '"') {
      state = "string";
      index += 1;
      continue;
    }
    if (character === "'") {
      state = "char";
      index += 1;
      continue;
    }
    if (character !== "@") {
      index += 1;
      continue;
    }

    const match = source.slice(index + 1).match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/);
    if (!match) {
      index += 1;
      continue;
    }
    const name = match[1];
    const shortName = name.split(".").pop();
    const afterName = skipTrivia(source, index + 1 + name.length);
    const hasArguments = source[afterName] === "(";
    const closeOffset = hasArguments ? findClosingDelimiter(source, afterName, "(", ")") : afterName;
    const annotationEnd = hasArguments ? (closeOffset < 0 ? source.length : closeOffset + 1) : index + 1 + name.length;
    annotations.push({
      name,
      short_name: shortName,
      start: index,
      end: annotationEnd,
      arguments_source: hasArguments && closeOffset >= 0 ? source.slice(afterName + 1, closeOffset) : "",
      malformed: hasArguments && closeOffset < 0,
      source_line: lineAt(source, index),
    });
    index = annotationEnd;
  }
  return annotations;
}

function splitTopLevel(value, separator) {
  const parts = [];
  let start = 0;
  let parens = 0;
  let brackets = 0;
  let braces = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parens += 1;
    else if (character === ")") parens -= 1;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (character === "{") braces += 1;
    else if (character === "}") braces -= 1;
    else if (character === separator && parens === 0 && brackets === 0 && braces === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function topLevelEquals(value) {
  const parts = splitTopLevel(value, "=");
  if (parts.length !== 2) return null;
  return [parts[0].trim(), parts[1].trim()];
}

function unwrapArray(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return [trimmed];
  const closing = findClosingDelimiter(trimmed, 0, "{", "}");
  if (closing !== trimmed.length - 1) return [trimmed];
  return splitTopLevel(trimmed.slice(1, -1), ",");
}

function decodeJavaString(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return null;
  let result = "";
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const character = trimmed[index];
    if (character !== "\\") {
      result += character;
      continue;
    }
    const escaped = trimmed[index + 1];
    if (escaped === "u" && /^[0-9A-Fa-f]{4}$/.test(trimmed.slice(index + 2, index + 6))) {
      result += String.fromCharCode(parseInt(trimmed.slice(index + 2, index + 6), 16));
      index += 5;
      continue;
    }
    const escapes = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", '"': '"', "'": "'", "\\": "\\" };
    if (!(escaped in escapes)) return null;
    result += escapes[escaped];
    index += 1;
  }
  return result;
}

function isWrappedInParens(value) {
  const trimmed = value.trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") && findClosingDelimiter(trimmed, 0, "(", ")") === trimmed.length - 1;
}

function readStringConstants(source, clean, classStart, classEnd) {
  const constants = new Map();
  const scope = clean.slice(classStart, classEnd);
  const expressionPattern = /\bstatic\s+final\s+String\s+([A-Za-z_$][\w$]*)\s*=/g;
  let match;
  while ((match = expressionPattern.exec(scope))) {
    const name = match[1];
    const expressionStart = classStart + match.index + match[0].lastIndexOf("=") + 1;
    const expressionEnd = clean.indexOf(";", expressionStart);
    if (expressionEnd >= 0 && expressionEnd < classEnd && braceDepthAt(clean, classStart, expressionStart) === 1) {
      constants.set(name, source.slice(expressionStart, expressionEnd).trim());
    }
  }
  return constants;
}

function braceDepthAt(source, start, end) {
  let depth = 0;
  for (let index = start; index < end; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") depth -= 1;
  }
  return depth;
}

function resolveStringExpression(expression, constants, resolving = new Set()) {
  let value = expression.trim();
  while (isWrappedInParens(value)) value = value.slice(1, -1).trim();
  const stringValue = decodeJavaString(value);
  if (stringValue != null) return { value: stringValue };

  const concatenated = splitTopLevel(value, "+");
  if (concatenated.length > 1) {
    const values = [];
    for (const part of concatenated) {
      const resolved = resolveStringExpression(part, constants, new Set(resolving));
      if (resolved.error) return resolved;
      values.push(resolved.value);
    }
    return { value: values.join("") };
  }

  if (/^[A-Za-z_$][\w$]*$/.test(value)) {
    if (!constants.has(value)) return { error: `unresolved constant ${value}` };
    if (resolving.has(value)) return { error: `cyclic constant ${value}` };
    resolving.add(value);
    return resolveStringExpression(constants.get(value), constants, resolving);
  }
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(value)) {
    return { error: `unresolved external constant ${value}` };
  }
  return { error: `unsupported path expression ${value}` };
}

function parseAttributes(argumentsSource) {
  const attributes = new Map();
  let positionalIndex = 0;
  for (const part of splitTopLevel(argumentsSource, ",")) {
    const assignment = topLevelEquals(part);
    if (assignment) {
      attributes.set(assignment[0], assignment[1]);
    } else {
      attributes.set(positionalIndex === 0 ? "value" : `__positional_${positionalIndex}`, part);
      positionalIndex += 1;
    }
  }
  return attributes;
}

function resolvePaths(attributes, constants) {
  const value = attributes.get("value");
  const pathValue = attributes.get("path");
  if (value != null && pathValue != null && value !== pathValue) {
    return { error: "both value and path are present with different expressions" };
  }
  const rawPaths = value != null ? value : pathValue;
  if (rawPaths == null) return { values: [""] };

  const values = [];
  for (const expression of unwrapArray(rawPaths)) {
    const resolved = resolveStringExpression(expression, constants);
    if (resolved.error) return resolved;
    values.push(normalizePath(resolved.value));
  }
  return { values: [...new Set(values)].sort((left, right) => left.localeCompare(right)) };
}

function resolveRequestMethods(value) {
  if (value == null) return { values: [...HTTP_METHODS] };
  const values = [];
  for (const expression of unwrapArray(value)) {
    const match = expression.trim().match(/^(?:RequestMethod\.)?(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|TRACE)$/);
    if (!match) return { error: `unsupported request method expression ${expression.trim()}` };
    values.push(match[1]);
  }
  return { values: [...new Set(values)].sort((left, right) => HTTP_METHODS.indexOf(left) - HTTP_METHODS.indexOf(right)) };
}

function parseMappingAnnotation(annotation, constants) {
  if (!(annotation.short_name in MAPPING_METHODS)) return null;
  if (annotation.malformed) return { error: `malformed @${annotation.short_name} annotation` };
  const attributes = parseAttributes(annotation.arguments_source);
  const paths = resolvePaths(attributes, constants);
  if (paths.error) return paths;
  const mappedMethods = MAPPING_METHODS[annotation.short_name];
  const methods = mappedMethods ? { values: mappedMethods } : resolveRequestMethods(attributes.get("method"));
  if (methods.error) return methods;
  return { paths: paths.values, methods: methods.values };
}

function findDeclaration(clean, start) {
  let parens = 0;
  for (let index = start; index < clean.length; index += 1) {
    const character = clean[index];
    if (character === "(") parens += 1;
    else if (character === ")") parens -= 1;
    else if ((character === "{" || character === ";") && parens === 0) {
      const header = clean.slice(start, index);
      const classMatch = header.match(/\b(?:class|interface|record|enum)\s+([A-Za-z_$][\w$]*)/);
      if (classMatch && character === "{") {
        return { kind: "class", name: classMatch[1], start, body_start: index, end: index };
      }
      const parenOffset = header.indexOf("(");
      if (parenOffset < 0) return { kind: "unknown", start, end: index };
      const methodName = header.slice(0, parenOffset).match(/([A-Za-z_$][\w$]*)\s*$/);
      return methodName ? { kind: "method", name: methodName[1], start, end: index } : { kind: "unknown", start, end: index };
    }
  }
  return { kind: "unknown", start, end: clean.length };
}

function annotationGroups(source, clean, annotations) {
  const groups = [];
  let index = 0;
  while (index < annotations.length) {
    const group = [annotations[index]];
    let cursor = annotations[index].end;
    let next = index + 1;
    while (next < annotations.length && annotations[next].start === skipTrivia(source, cursor)) {
      group.push(annotations[next]);
      cursor = annotations[next].end;
      next += 1;
    }
    groups.push({ annotations: group, declaration: findDeclaration(clean, skipTrivia(source, cursor)) });
    index = next;
  }
  return groups;
}

function parseSpringSource(source, sourceFile) {
  const clean = maskJava(source);
  const annotations = scanAnnotations(source);
  const groups = annotationGroups(source, clean, annotations);
  const controllers = [];

  for (const group of groups) {
    if (group.declaration.kind !== "class") continue;
    const controller = group.annotations.some((annotation) => annotation.short_name === "RestController" || annotation.short_name === "Controller");
    if (!controller) continue;
    const bodyEnd = findClosingDelimiter(clean, group.declaration.body_start, "{", "}");
    controllers.push({
      ...group.declaration,
      body_end: bodyEnd < 0 ? clean.length : bodyEnd,
      annotations: group.annotations,
    });
  }

  const mappings = [];
  const unresolved = [];
  for (const controller of controllers) {
    const constants = readStringConstants(source, clean, controller.body_start, controller.body_end);
    const classMappingAnnotations = controller.annotations.filter((annotation) => annotation.short_name in MAPPING_METHODS);
    if (classMappingAnnotations.length > 1) {
      unresolved.push({
        source_file: sourceFile,
        source_line: classMappingAnnotations[1].source_line,
        annotation: classMappingAnnotations[1].short_name,
        detail: `multiple request mappings on controller ${controller.name}`,
      });
      continue;
    }
    const classMapping = classMappingAnnotations.length === 0
      ? { paths: [""], methods: [...HTTP_METHODS] }
      : parseMappingAnnotation(classMappingAnnotations[0], constants);
    if (classMapping.error) {
      unresolved.push({
        source_file: sourceFile,
        source_line: classMappingAnnotations[0].source_line,
        annotation: classMappingAnnotations[0].short_name,
        detail: classMapping.error,
      });
      continue;
    }

    for (const group of groups) {
      if (group.declaration.kind !== "method" || group.declaration.start <= controller.body_start || group.declaration.start >= controller.body_end) continue;
      const mappingAnnotations = group.annotations.filter((annotation) => annotation.short_name in MAPPING_METHODS);
      if (mappingAnnotations.length === 0) continue;
      if (mappingAnnotations.length > 1) {
        unresolved.push({
          source_file: sourceFile,
          source_line: mappingAnnotations[1].source_line,
          annotation: mappingAnnotations[1].short_name,
          detail: `multiple request mappings on method ${group.declaration.name}`,
        });
        continue;
      }
      const annotation = mappingAnnotations[0];
      const methodMapping = parseMappingAnnotation(annotation, constants);
      if (methodMapping.error) {
        unresolved.push({
          source_file: sourceFile,
          source_line: annotation.source_line,
          annotation: annotation.short_name,
          detail: methodMapping.error,
        });
        continue;
      }
      const methods = classMapping.methods.filter((method) => methodMapping.methods.includes(method));
      if (methods.length === 0) {
        unresolved.push({
          source_file: sourceFile,
          source_line: annotation.source_line,
          annotation: annotation.short_name,
          detail: `class and method HTTP methods do not intersect on ${group.declaration.name}`,
        });
        continue;
      }
      for (const classPath of classMapping.paths) {
        for (const methodPath of methodMapping.paths) {
          for (const method of methods) {
            mappings.push({
              key: routeKey(method, joinPath(classPath, methodPath)),
              method,
              normalized_path: joinPath(classPath, methodPath),
              source_file: sourceFile,
              source_line: annotation.source_line,
              controller: controller.name,
              handler: group.declaration.name,
              annotation: annotation.short_name,
              class_path: normalizePath(classPath),
              method_path: normalizePath(methodPath),
            });
          }
        }
      }
    }
  }
  return {
    mappings: mappings.sort(compareMappings),
    unresolved_annotations: unresolved.sort(compareDiagnostics),
    controller_count: controllers.length,
  };
}

function compareMappings(left, right) {
  return left.key.localeCompare(right.key)
    || left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line
    || left.handler.localeCompare(right.handler);
}

function compareDiagnostics(left, right) {
  return left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line
    || left.annotation.localeCompare(right.annotation);
}

function parseSpringControllers(repositoryRoot, springSourceRoot) {
  const sourceRoot = springSourceRoot || path.join(repositoryRoot, "backend-spring", "src", "main", "java");
  const files = listJavaFiles(sourceRoot);
  const result = {
    mappings: [],
    unresolved_annotations: [],
    controller_count: 0,
    source_file_count: files.length,
    source_root_exists: fs.existsSync(sourceRoot),
  };
  for (const file of files) {
    const parsed = parseSpringSource(fs.readFileSync(file, "utf8"), toPosix(path.relative(repositoryRoot, file)));
    result.mappings.push(...parsed.mappings);
    result.unresolved_annotations.push(...parsed.unresolved_annotations);
    result.controller_count += parsed.controller_count;
  }
  result.mappings.push(...parseSpringDocApiMappings(repositoryRoot));
  result.mappings.sort(compareMappings);
  result.unresolved_annotations.sort(compareDiagnostics);
  return result;
}

function parseSpringDocApiMappings(repositoryRoot) {
  const configPath = path.join(repositoryRoot, "backend-spring", "src", "main", "resources", "application.yml");
  if (!fs.existsSync(configPath)) return [];
  const source = fs.readFileSync(configPath, "utf8");
  const match = source.match(/^\s{2}api-docs:\s*\r?\n\s{4}path:\s*([^\s#]+)\s*$/m);
  if (!match) return [];
  const normalizedPath = normalizePath(match[1]);
  const sourceFile = toPosix(path.relative(repositoryRoot, configPath));
  const sourceLine = lineAt(source, match.index);
  return ["GET", "HEAD"].map((method) => ({
    key: routeKey(method, normalizedPath),
    method,
    normalized_path: normalizedPath,
    source_file: sourceFile,
    source_line: sourceLine,
    controller: "springdoc",
    handler: "apiDocs",
    annotation: "springdoc.api-docs.path",
    class_path: "",
    method_path: normalizedPath,
  }));
}

function mappingGroups(mappings) {
  const groups = new Map();
  for (const mapping of mappings) {
    if (!groups.has(mapping.key)) groups.set(mapping.key, []);
    groups.get(mapping.key).push(mapping);
  }
  return groups;
}

function normalizeCanonicalKey(key) {
  const match = String(key).match(/^([A-Z]+)\s+(.+)$/);
  return match ? routeKey(match[1], match[2]) : null;
}

function manifestIntegrity(manifest, expectedTraShadowedHandlerCount = EXPECTED_TRA_SHADOWED_HANDLER_COUNT) {
  const errors = [];
  const canonicalRoutes = manifest && manifest.canonical_routes;
  if (!canonicalRoutes || typeof canonicalRoutes !== "object" || Array.isArray(canonicalRoutes)) {
    return { errors: ["endpoint manifest has no canonical_routes object"], shadowed_python_handlers: [] };
  }
  const keys = Object.keys(canonicalRoutes).sort((left, right) => left.localeCompare(right));
  if (manifest.canonical_route_count !== keys.length) {
    errors.push(`endpoint manifest canonical_route_count is ${manifest.canonical_route_count}, expected ${keys.length}`);
  }
  const shadowed = [];
  for (const key of keys) {
    const canonical = canonicalRoutes[key];
    const normalizedKey = normalizeCanonicalKey(key);
    if (!normalizedKey) {
      errors.push(`invalid canonical route key ${key}`);
      continue;
    }
    if (canonical.method !== normalizedKey.split(" ")[0] || normalizePath(canonical.normalized_path) !== normalizedKey.slice(normalizedKey.indexOf(" ") + 1)) {
      errors.push(`canonical route metadata does not match ${key}`);
    }
    if (!canonical.effective_handler || !canonical.effective_handler.source_file) {
      errors.push(`canonical route ${key} has no effective handler`);
    }
    for (const handler of canonical.shadowed_handlers || []) {
      if (handler.source_file === "backend/app/api/tra.py") {
        shadowed.push({
          key: normalizedKey,
          source_file: handler.source_file,
          source_line: handler.source_line,
          function_name: handler.function_name,
          function_identity: handler.function_identity,
          non_required: true,
        });
      }
    }
  }
  shadowed.sort((left, right) => left.key.localeCompare(right.key) || left.source_line - right.source_line);
  if (expectedTraShadowedHandlerCount != null && shadowed.length !== expectedTraShadowedHandlerCount) {
    errors.push(`endpoint manifest has ${shadowed.length} shadowed TRA handlers, expected ${expectedTraShadowedHandlerCount}`);
  }
  return { errors, shadowed_python_handlers: shadowed };
}

function domainForPath(routePath) {
  const parts = normalizePath(routePath).split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "v1") return parts[2] || "api-root";
  return parts[0] || "root";
}

function groupByDomain(routes) {
  const counts = new Map();
  for (const route of routes) {
    const domain = domainForPath(route.normalized_path);
    counts.set(domain, (counts.get(domain) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function countRouteKinds(routes) {
  return routes.reduce((counts, route) => {
    const kind = route.record_kind || "source_decorator";
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, {});
}

function buildCoverage(repositoryRoot = process.cwd(), options = {}) {
  const manifestPath = options.manifestPath || path.join(repositoryRoot, "docs", "spring-migration", "endpoint-manifest.json");
  const manifest = options.manifest || JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const manifestCheck = manifestIntegrity(manifest, options.expectedTraShadowedHandlerCount);
  const canonical = Object.entries(manifest.canonical_routes || {})
    .map(([key, value]) => ({
      key: normalizeCanonicalKey(key),
      method: value.method,
      normalized_path: normalizePath(value.normalized_path),
      record_kind: value.effective_handler && value.effective_handler.record_kind,
      effective_handler: value.effective_handler,
    }))
    .filter((route) => route.key)
    .sort((left, right) => left.key.localeCompare(right.key));
  const spring = parseSpringControllers(repositoryRoot, options.springSourceRoot);
  const springByKey = mappingGroups(spring.mappings);
  const canonicalKeys = new Set(canonical.map((route) => route.key));
  const implemented = [];
  const missing = [];
  for (const route of canonical) {
    const springMappings = springByKey.get(route.key) || [];
    const result = { ...route, spring_mappings: springMappings };
    if (springMappings.length > 0) implemented.push(result);
    else missing.push(result);
  }
  const extra = spring.mappings.filter((mapping) => !canonicalKeys.has(mapping.key));
  const duplicateSpringMappings = [...springByKey.entries()]
    .filter(([, mappings]) => mappings.length > 1)
    .map(([key, mappings]) => ({ key, mappings }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const requiredRouteCount = canonical.length;
  const implementedRouteCount = implemented.length;

  return {
    schema_version: 1,
    generated_by: "scripts/spring-migration/spring-route-coverage.js",
    manifest: {
      source_file: toPosix(path.relative(repositoryRoot, manifestPath)),
      schema_version: manifest.schema_version,
      canonical_route_count: manifest.canonical_route_count,
    },
    spring_source_root: toPosix(path.relative(repositoryRoot, options.springSourceRoot || path.join(repositoryRoot, "backend-spring", "src", "main", "java"))),
    completion: {
      state: missing.length === 0 && extra.length === 0 && duplicateSpringMappings.length === 0 && spring.unresolved_annotations.length === 0 && manifestCheck.errors.length === 0
        ? "complete_candidate"
        : "partial_migration",
      required_route_count: requiredRouteCount,
      implemented_route_count: implementedRouteCount,
      missing_route_count: missing.length,
      extra_spring_mapping_count: extra.length,
      duplicate_spring_mapping_count: duplicateSpringMappings.length,
      completion_percentage: requiredRouteCount === 0 ? 0 : Number(((implementedRouteCount / requiredRouteCount) * 100).toFixed(2)),
      required_route_kinds: countRouteKinds(canonical),
    },
    source_inventory: {
      spring_source_file_count: spring.source_file_count,
      spring_controller_count: spring.controller_count,
      spring_mapping_count: spring.mappings.length,
      unresolved_annotation_count: spring.unresolved_annotations.length,
    },
    routes: {
      implemented,
      missing,
      extra_spring_mappings: extra,
      duplicate_spring_mappings: duplicateSpringMappings,
      shadowed_python_tra_handlers: manifestCheck.shadowed_python_handlers,
      unresolved_annotations: spring.unresolved_annotations,
    },
    domains: {
      implemented: groupByDomain(implemented),
      missing: groupByDomain(missing),
    },
    approved_complete_allowlist: COMPLETE_ALLOWLIST,
    parser_source_integrity_errors: [
      ...manifestCheck.errors,
      ...(spring.source_root_exists ? [] : [`Spring source root is missing: ${toPosix(path.relative(repositoryRoot, options.springSourceRoot || path.join(repositoryRoot, "backend-spring", "src", "main", "java")))}`]),
    ],
  };
}

function verifyCoverage(coverage, complete = false) {
  const errors = [...coverage.parser_source_integrity_errors];
  if (coverage.routes.unresolved_annotations.length > 0) {
    errors.push(`${coverage.routes.unresolved_annotations.length} Spring mapping annotation(s) could not be resolved deterministically`);
  }
  if (coverage.routes.duplicate_spring_mappings.length > 0) {
    errors.push(`${coverage.routes.duplicate_spring_mappings.length} duplicate Spring route mapping group(s) found`);
  }
  if (!complete) return errors;

  const missing = coverage.routes.missing.filter((route) => !Object.prototype.hasOwnProperty.call(COMPLETE_ALLOWLIST.missing, route.key));
  const extra = coverage.routes.extra_spring_mappings.filter((mapping) => !Object.prototype.hasOwnProperty.call(COMPLETE_ALLOWLIST.extra, mapping.key));
  if (missing.length > 0) errors.push(`${missing.length} required canonical route(s) are missing from Spring`);
  if (extra.length > 0) errors.push(`${extra.length} unapproved extra Spring mapping(s) found`);
  return errors;
}

function markdownCoverage(coverage) {
  const lines = [
    "# Spring Route Coverage",
    "",
    "This report is generated deterministically by `scripts/spring-migration/spring-route-coverage.js` from the FastAPI endpoint manifest and Spring controller annotations.",
    "",
    "## Current Status",
    "",
    `- State: \`${coverage.completion.state}\``,
    `- Required canonical routes: ${coverage.completion.required_route_count}`,
    `- Implemented in Spring: ${coverage.completion.implemented_route_count}`,
    `- Missing from Spring: ${coverage.completion.missing_route_count}`,
    `- Extra Spring mappings: ${coverage.completion.extra_spring_mapping_count}`,
    `- Duplicate Spring mapping groups: ${coverage.completion.duplicate_spring_mapping_count}`,
    `- Completion: ${coverage.completion.completion_percentage.toFixed(2)}%`,
    "",
    "This migration remains in progress while required canonical routes are missing. The percentage is coverage evidence, not a completeness claim.",
    "",
    "## Verification",
    "",
    "- `node scripts/spring-migration/spring-route-coverage.js --verify` checks manifest/parser integrity and fails for unresolved Spring mapping annotations or duplicate Spring mappings. It permits missing routes during migration.",
    "- `node scripts/spring-migration/spring-route-coverage.js --verify-complete` adds a strict missing/extra route gate. It must not pass until every required route is migrated or explicitly approved below.",
    "",
    "## Complete Allowlist",
    "",
    "The hard-coded complete-mode allowlist is intentionally empty. Add only explicit, reviewed migration exceptions in `COMPLETE_ALLOWLIST` in the generator; never use it to hide a domain still in progress.",
    "",
    "## Route Summary",
    "",
    `- Canonical source routes: ${coverage.completion.required_route_kinds.source_decorator || 0}`,
    `- Canonical operational routes: ${coverage.completion.required_route_kinds.operational || 0}`,
    `- Spring Java files scanned: ${coverage.source_inventory.spring_source_file_count}`,
    `- Spring controllers found: ${coverage.source_inventory.spring_controller_count}`,
    `- Unresolved Spring annotations: ${coverage.source_inventory.unresolved_annotation_count}`,
    "",
    "## Domain Progress",
    "",
    "| Domain | Implemented | Missing |",
    "| --- | ---: | ---: |",
  ];
  const domains = [...new Set([...Object.keys(coverage.domains.implemented), ...Object.keys(coverage.domains.missing)])].sort((left, right) => left.localeCompare(right));
  for (const domain of domains) {
    lines.push(`| ${domain} | ${coverage.domains.implemented[domain] || 0} | ${coverage.domains.missing[domain] || 0} |`);
  }
  lines.push(
    "",
    "## Shadowed Python TRA Handlers",
    "",
    `The ${coverage.routes.shadowed_python_tra_handlers.length} handlers below are source-level FastAPI shadows recorded by the canonical manifest. They are informational and do not create additional required Spring mappings.`,
    "",
    "| Route | Source | Handler |",
    "| --- | --- | --- |",
  );
  for (const handler of coverage.routes.shadowed_python_tra_handlers) {
    lines.push(`| ${handler.key} | ${handler.source_file}:${handler.source_line} | ${handler.function_name || "unknown"} |`);
  }
  lines.push(
    "",
    "## Detailed Data",
    "",
    "The companion JSON file contains deterministic, source-linked lists of implemented, missing, extra, duplicate, unresolved, and shadowed mappings.",
    ""
  );
  return lines.join("\n");
}

function writeCoverage(coverage, repositoryRoot = process.cwd(), outputPaths = {}) {
  const jsonPath = outputPaths.jsonPath || path.join(repositoryRoot, "docs", "spring-migration", "spring-route-coverage.json");
  const markdownPath = outputPaths.markdownPath || path.join(repositoryRoot, "docs", "spring-migration", "spring-route-coverage.md");
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(coverage, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdownCoverage(coverage));
  return { jsonPath, markdownPath };
}

function main() {
  const argumentsList = process.argv.slice(2);
  const complete = argumentsList.includes("--verify-complete");
  const verify = complete || argumentsList.includes("--verify");
  const unknown = argumentsList.filter((argument) => argument !== "--verify" && argument !== "--verify-complete");
  if (unknown.length > 0) {
    console.error(`Unsupported argument(s): ${unknown.join(", ")}`);
    process.exitCode = 2;
    return;
  }
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const coverage = buildCoverage(repositoryRoot);
  const output = writeCoverage(coverage, repositoryRoot);
  const errors = verify ? verifyCoverage(coverage, complete) : [];
  console.log(`Spring route coverage: ${coverage.completion.implemented_route_count}/${coverage.completion.required_route_count} (${coverage.completion.completion_percentage.toFixed(2)}%)`);
  console.log(`Wrote ${toPosix(path.relative(repositoryRoot, output.jsonPath))} and ${toPosix(path.relative(repositoryRoot, output.markdownPath))}`);
  if (errors.length > 0) {
    console.error(`${complete ? "Complete" : "Default"} verification failed:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  COMPLETE_ALLOWLIST,
  EXPECTED_TRA_SHADOWED_HANDLER_COUNT,
  buildCoverage,
  joinPath,
  manifestIntegrity,
  markdownCoverage,
  normalizePath,
  parseSpringControllers,
  parseSpringSource,
  routeKey,
  verifyCoverage,
  writeCoverage,
};
