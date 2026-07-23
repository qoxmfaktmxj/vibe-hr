import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as GET_MAPPING_TYPES } from "@/app/api/org/mapping-types/route";
import {
  DELETE as DELETE_MAPPING_TYPE_ITEM,
  PUT as PUT_MAPPING_TYPE_ITEM,
} from "@/app/api/org/mapping-type-items/[itemId]/route";
import {
  GET as GET_MAPPING_TYPE_ITEMS,
  POST as POST_MAPPING_TYPE_ITEMS,
} from "@/app/api/org/mapping-type-items/route";

type RouteCase = {
  name: string;
  handler: (...args: any[]) => Promise<Response>;
  requestUrl: string;
  upstreamUrl: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  context?: any;
  upstreamStatus?: number;
  expect204?: boolean;
};

const basePayload = {
  type_code: "COST",
  item_code: "CC-100",
  name: "원가센터 A",
  effective_from: "2026-01-31",
  effective_to: null,
  erp_employee_code: "ERP-001",
  cost_center_type: "CC",
  remark: "메모",
  sort_order: 1,
  is_active: true,
};

const ROUTES: RouteCase[] = [
  {
    name: "mapping-types",
    handler: GET_MAPPING_TYPES,
    requestUrl: "http://localhost/api/org/mapping-types?reference_date=2026-01-31",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-types?reference_date=2026-01-31",
    method: "GET",
  },
  {
    name: "mapping-type-items GET",
    handler: GET_MAPPING_TYPE_ITEMS,
    requestUrl: "http://localhost/api/org/mapping-type-items?page=1&limit=1&type_code=COST&reference_date=2026-01-31",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-type-items?page=1&limit=1&type_code=COST&reference_date=2026-01-31",
    method: "GET",
  },
  {
    name: "mapping-type-items POST",
    handler: POST_MAPPING_TYPE_ITEMS,
    requestUrl: "http://localhost/api/org/mapping-type-items",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-type-items",
    method: "POST",
    body: basePayload,
  },
  {
    name: "mapping-type-items PUT",
    handler: PUT_MAPPING_TYPE_ITEM,
    requestUrl: "http://localhost/api/org/mapping-type-items/42",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-type-items/42",
    method: "PUT",
    body: basePayload,
    context: { params: { itemId: "42" } },
  },
  {
    name: "mapping-type-items DELETE",
    handler: DELETE_MAPPING_TYPE_ITEM,
    requestUrl: "http://localhost/api/org/mapping-type-items/42",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-type-items/42",
    method: "DELETE",
    context: { params: { itemId: "42" } },
    expect204: true,
  },
];

function buildRequest(routeCase: RouteCase, withCookie: boolean) {
  const headers: Record<string, string> = {};
  if (withCookie) {
    headers.cookie = "vibe_hr_token=token-123";
  }
  if (routeCase.body) {
    headers["content-type"] = "application/json";
  }

  const init: any = {
    method: routeCase.method,
    headers,
  };
  if (routeCase.body) {
    init.body = JSON.stringify(routeCase.body);
  }

  return new NextRequest(routeCase.requestUrl, init);
}

describe("/api/org mapping BFF routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ROUTES)("returns 401 JSON when the auth cookie is missing for $name", async (routeCase) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await routeCase.handler(buildRequest(routeCase, false), routeCase.context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Not authenticated." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(ROUTES)("forwards 200 JSON responses for $name", async (routeCase) => {
    const payload = routeCase.body ?? {
      items: [
        {
          id: 1,
          type_code: "COST",
          item_code: "CC-100",
          name: "원가센터 A",
          effective_from: "2026-01-31",
          effective_to: null,
          erp_employee_code: "ERP-001",
          cost_center_type: "CC",
          remark: "메모",
          sort_order: 1,
          is_active: true,
          created_at: "2026-01-31T00:00:00.000Z",
          updated_at: "2026-01-31T00:00:00.000Z",
        },
      ],
      total_count: 1,
      page: 1,
      limit: 100,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await routeCase.handler(buildRequest(routeCase, true), routeCase.context);

    expect(fetchMock).toHaveBeenCalledWith(
      routeCase.upstreamUrl,
      expect.objectContaining({
        method: routeCase.method,
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        cache: "no-store",
      }),
    );
    if (routeCase.body) {
      expect(fetchMock).toHaveBeenCalledWith(
        routeCase.upstreamUrl,
        expect.objectContaining({ body: JSON.stringify(routeCase.body) }),
      );
    }
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
  });

  it.each(ROUTES)("forwards 422 JSON responses for $name", async (routeCase) => {
    const payload = { detail: "Validation failed." };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await routeCase.handler(buildRequest(routeCase, true), routeCase.context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(payload);
  });

  it.each(ROUTES.filter((routeCase) => routeCase.expect204))(
    "returns an empty 204 response when upstream is 204 for $name",
    async (routeCase) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await routeCase.handler(buildRequest(routeCase, true), routeCase.context);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    },
  );
});
