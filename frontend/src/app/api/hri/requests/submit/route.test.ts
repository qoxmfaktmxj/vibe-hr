import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { POST } from "./route";

beforeEach(() => vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://spring-test:8080"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(body: string, authenticated = true) {
  return new NextRequest("http://localhost/api/hri/requests/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authenticated ? { cookie: "vibe_hr_token=test-token" } : {}) },
    body,
  });
}

it("requires an authenticated session before forwarding a direct submission", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect((await POST(request("{}", false))).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects malformed JSON before forwarding", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect((await POST(request("{"))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([200, 403, 422])("preserves the atomic submission payload and upstream %i response", async (status) => {
  const payload = { request_id: null, form_type_id: 11, title: "Request", content_json: { reason: "test" } };
  const responseBody = status === 200
    ? { request_id: 42, status_code: "APPROVAL_IN_PROGRESS", current_step_order: 1 }
    : { detail: status === 403 ? "Forbidden." : [{ type: "missing", loc: ["body", "content_json", "work_date"] }] };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await POST(request(JSON.stringify(payload)));

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://spring-test:8080/api/v1/hri/requests/submit", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual(responseBody);
});
