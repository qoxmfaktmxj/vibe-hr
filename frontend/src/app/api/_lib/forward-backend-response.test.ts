import { expect, test } from "vitest";
import { forwardBackendResponse } from "./forward-backend-response";

test("forwards binary bodies, status, cache, and content metadata", async () => {
  const response = forwardBackendResponse(
    new Response(new Uint8Array([37, 80, 68, 70]), {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=60",
        "content-disposition": "attachment; filename=payslip.pdf",
        "content-encoding": "gzip",
        "content-length": "4",
        "content-range": "bytes 0-3/4",
        "content-type": "application/pdf",
        etag: "\"payslip-v1\"",
        "last-modified": "Fri, 01 Aug 2026 00:00:00 GMT",
      },
    }),
  );

  expect(response.status).toBe(206);
  expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([37, 80, 68, 70]);
  expect(response.headers.get("content-disposition")).toBe("attachment; filename=payslip.pdf");
  expect(response.headers.get("content-range")).toBe("bytes 0-3/4");
  expect(response.headers.get("etag")).toBe("\"payslip-v1\"");
  expect(response.headers.get("cache-control")).toBe("private, max-age=60");
  expect(response.headers.get("content-length")).toBeNull();
  expect(response.headers.get("content-encoding")).toBeNull();
});

test.each([
  ["text/csv", "attachment; filename=payroll.csv", "employee_id,amount\n42,1000"],
  ["text/plain", null, "non-json upstream failure"],
])("preserves non-JSON %s bodies without re-serializing them", async (contentType, disposition, body) => {
  const response = forwardBackendResponse(
    new Response(body, {
      status: 422,
      headers: {
        "cache-control": "no-store",
        "content-disposition": disposition ?? "",
        "content-type": contentType,
        etag: "\"upstream-v1\"",
      },
    }),
  );

  expect(response.status).toBe(422);
  expect(response.headers.get("content-type")).toContain(contentType);
  expect(response.headers.get("etag")).toBe("\"upstream-v1\"");
  expect(await response.text()).toBe(body);
});
