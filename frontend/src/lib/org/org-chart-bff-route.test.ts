import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/org/chart/route";

const SPRING_TEST_URL = "http://spring-test:8080";

describe("/api/org/chart BFF route", () => {
  beforeEach(() => {
    vi.stubEnv("VIBEHR_BFF_BACKEND_URL", SPRING_TEST_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 401 JSON when the auth cookie is missing", async () => {
    const request = new NextRequest("http://localhost/api/org/chart");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Not authenticated." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards 200 JSON responses from upstream", async () => {
    const request = new NextRequest("http://localhost/api/org/chart", {
      headers: { cookie: "vibe_hr_token=token-123" },
    });
    const payload = { departments: [{ id: 1, code: "D001" }], total_count: 1 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://spring-test:8080/api/v1/org/chart",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer token-123" },
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it("forwards 403 JSON responses from upstream", async () => {
    const request = new NextRequest("http://localhost/api/org/chart", {
      headers: { cookie: "vibe_hr_token=token-123" },
    });
    const payload = { detail: "Action not allowed." };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(payload);
  });

  it("returns an empty 204 response when upstream is 204", async () => {
    const request = new NextRequest("http://localhost/api/org/chart", {
      headers: { cookie: "vibe_hr_token=token-123" },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});
