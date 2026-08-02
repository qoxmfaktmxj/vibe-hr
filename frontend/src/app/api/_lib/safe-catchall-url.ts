import { backendApiBaseUrl } from "./backend-target";

export class InvalidCatchallPathError extends Error {
  constructor() {
    super("Invalid API path.");
  }
}

function assertSafeSegment(segment: string): void {
  if (!segment || segment === "." || segment === ".." || /[\\/\u0000-\u001f\u007f]/.test(segment)) {
    throw new InvalidCatchallPathError();
  }
}

const MAX_DECODE_PASSES = 4;
const PERCENT_ESCAPE = /%[0-9a-f]{2}/i;

function decodeForValidation(segment: string): string {
  let candidate = segment;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    assertSafeSegment(candidate);
    if (!PERCENT_ESCAPE.test(candidate)) return candidate;
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) return decoded;
      candidate = decoded;
    } catch {
      throw new InvalidCatchallPathError();
    }
  }

  assertSafeSegment(candidate);
  // Reject remaining escapes so downstream URL processing cannot reveal traversal.
  if (PERCENT_ESCAPE.test(candidate)) throw new InvalidCatchallPathError();
  return candidate;
}

/** Builds a fixed-domain upstream URL without allowing catch-all path traversal. */
export function safeCatchallUrl(domain: "pay" | "pap" | "tra", segments: string[], search: string): URL {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new InvalidCatchallPathError();
  }

  const encodedSegments = segments.map((segment) => {
    if (typeof segment !== "string") throw new InvalidCatchallPathError();
    return encodeURIComponent(decodeForValidation(segment));
  });
  const target = new URL(backendApiBaseUrl());
  target.pathname = `/api/v1/${domain}/${encodedSegments.join("/")}`;
  target.search = search;
  return target;
}
