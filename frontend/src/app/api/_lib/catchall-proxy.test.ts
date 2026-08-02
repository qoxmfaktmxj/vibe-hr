import { NextRequest } from "next/server";
import { afterEach, expect, test, vi } from "vitest";
import { GET as papGet } from "../pap/[...path]/route";
import { GET as payGet } from "../pay/[...path]/route";
import { GET as traGet } from "../tra/[...path]/route";

const handlers = [
  ["pap", papGet],
  ["pay", payGet],
  ["tra", traGet],
] as const;

function requestFor(path: string): NextRequest {
  return new NextRequest(`http://frontend.test${path}?download=1`, {
    headers: {
      cookie: "vibe_hr_token=test-token",
      "if-range": "\"export-v1\"",
      range: "bytes=0-20",
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test.each(handlers)("%s catch-all rejects traversal before calling upstream", async (_domain, handler) => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const response = await handler(requestFor("/api/test"), { params: Promise.resolve({ path: ["%252Fauth"] }) });

  expect(response.status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(handlers)("%s catch-all streams the upstream response unchanged", async (domain, handler) => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response("employee_id,amount\\n42,1000", {
      status: 206,
      headers: {
        "cache-control": "private, max-age=60",
        "content-disposition": "attachment; filename=export.csv",
        "content-range": "bytes 0-20/21",
        "content-type": "text/csv",
        etag: "\"export-v1\"",
      },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const response = await handler(requestFor("/api/test"), { params: Promise.resolve({ path: ["exports", "current"] }) });

  expect(fetchMock).toHaveBeenCalledWith(
    `http://backend:8080/api/v1/${domain}/exports/current?download=1`,
    expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ get: expect.any(Function) }),
    }),
  );
  const options = fetchMock.mock.calls[0][1] as RequestInit;
  const requestHeaders = options.headers as Headers;
  expect(requestHeaders.get("range")).toBe("bytes=0-20");
  expect(requestHeaders.get("if-range")).toBe("\"export-v1\"");
  expect(response.status).toBe(206);
  expect(response.headers.get("content-disposition")).toBe("attachment; filename=export.csv");
  expect(response.headers.get("content-range")).toBe("bytes 0-20/21");
  expect(response.headers.get("etag")).toBe("\"export-v1\"");
  expect(await response.text()).toBe("employee_id,amount\\n42,1000");
});
