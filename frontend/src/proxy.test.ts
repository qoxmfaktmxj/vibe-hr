import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

vi.mock("@/app/api/_lib/backend-target", () => ({ backendApiUrl: (path: string) => `http://127.0.0.1:9999${path}` }));
afterEach(() => vi.unstubAllGlobals());

describe("public product entry", () => {
  it.each([undefined, "existing-session"])("keeps the product introduction public with cookie %s", async token => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await proxy(new NextRequest("https://example.test/", { headers: token ? { cookie: `vibe_hr_token=${token}` } : {} }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["/dashboard", "/hr/employee", "/settings/permissions", "/payroll/runs"])("keeps %s protected without a session", async path => {
    const response = await proxy(new NextRequest(`https://example.test${path}`));
    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("redirect")).toBe(path);
  });
  it("retains login and static poster access", async () => {
    for (const path of ["/login", "/images/product/01.webp"]) {
      const response = await proxy(new NextRequest(`https://example.test${path}`));
      expect(response.headers.get("location")).toBeNull();
    }
  });
});
