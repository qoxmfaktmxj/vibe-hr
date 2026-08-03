import "server-only";

const TARGET_VARIABLE = "VIBEHR_BFF_BACKEND_URL";
const ROOT_HTTP_URL = /^https?:\/\/[^/?#@]+$/;
const API_PREFIX = "/api/v1";

export function backendApiBaseUrl(): string {
  const value = process.env.VIBEHR_BFF_BACKEND_URL;
  if (!value || value.trim() !== value || !ROOT_HTTP_URL.test(value)) {
    throw new Error(`${TARGET_VARIABLE} must point to the Spring backend for BFF requests.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${TARGET_VARIABLE} must be an absolute HTTP(S) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${TARGET_VARIABLE} must be an HTTP(S) URL.`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${TARGET_VARIABLE} must contain only a scheme, host, and optional port.`);
  }
  return url.toString().replace(/\/$/, "");
}

function assertBackendPath(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Backend path must start with a single slash.");
  }
  if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
    throw new Error("Backend path must be versionless.");
  }
}

export function backendApiPath(path: string): string {
  assertBackendPath(path);
  return `${API_PREFIX}${path}`;
}

export function backendApiUrl(path: string): string {
  return `${backendApiBaseUrl()}${backendApiPath(path)}`;
}
