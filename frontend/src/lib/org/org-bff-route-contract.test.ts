import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as GET_DEPARTMENT_OPTIONS } from "@/app/api/org/department-options/route";
import {
  DELETE as DELETE_MAPPING_ASSIGNMENT,
  PUT as PUT_MAPPING_ASSIGNMENT,
} from "@/app/api/org/mapping-assignments/[assignmentId]/route";
import {
  GET as GET_MAPPING_ASSIGNMENTS,
  POST as POST_MAPPING_ASSIGNMENTS,
} from "@/app/api/org/mapping-assignments/route";
import { GET as GET_MAPPING_ITEM_OPTIONS } from "@/app/api/org/mapping-item-options/route";
import { GET as GET_MAPPING_TYPE_OPTIONS } from "@/app/api/org/mapping-type-options/route";
import { GET as GET_MAPPING_TYPES } from "@/app/api/org/mapping-types/route";
import {
  DELETE as DELETE_MAPPING_TYPE_ITEM,
  PUT as PUT_MAPPING_TYPE_ITEM,
} from "@/app/api/org/mapping-type-items/[itemId]/route";
import {
  GET as GET_MAPPING_TYPE_ITEMS,
  POST as POST_MAPPING_TYPE_ITEMS,
} from "@/app/api/org/mapping-type-items/route";
import { GET as GET_MAPPING_PERSONAL_STATUS } from "@/app/api/org/mapping-personal-status/route";
import { POST as POST_UPLOAD_CONFIRM } from "@/app/api/org/mapping-assignments/upload-confirm/route";
import { POST as POST_UPLOAD_PREVIEW } from "@/app/api/org/mapping-assignments/upload-preview/route";
import { GET as GET_UPLOAD_TEMPLATE } from "@/app/api/org/mapping-assignments/upload-template/route";

type RouteCase = {
  name: string;
  handler: (request: NextRequest, context?: RouteContext) => Promise<Response>;
  requestUrl: string;
  upstreamUrl: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  upstreamStatus?: number;
  expect204?: boolean;
  context?: RouteContext;
};

type RouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

const basePayload = {
  assignment_id: 7,
  department_code: "D001",
  department_name: "인사팀",
  type_code: "COST",
  item_code: "CC-100",
  item_name: "원가센터 A",
  effective_from: "2026-01-31",
  effective_to: null,
  is_active: true,
};

const typeItemPayload = {
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

const uploadPayload = {
  mode: "atomic",
  rows: [{
    department_code: "D001",
    type_code: "COST",
    item_code: "CC-100",
    effective_from: "2026-01-31",
    effective_to: null,
  }],
};

const ROUTES: RouteCase[] = [
  {
    name: "mapping-assignments upload-template",
    handler: GET_UPLOAD_TEMPLATE,
    requestUrl: "http://localhost/api/org/mapping-assignments/upload-template",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments/upload-template",
    method: "GET",
    expect204: true,
  },
  {
    name: "mapping-assignments upload-preview",
    handler: POST_UPLOAD_PREVIEW,
    requestUrl: "http://localhost/api/org/mapping-assignments/upload-preview",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments/upload-preview",
    method: "POST",
    body: uploadPayload,
    expect204: true,
  },
  {
    name: "mapping-assignments upload-confirm",
    handler: POST_UPLOAD_CONFIRM,
    requestUrl: "http://localhost/api/org/mapping-assignments/upload-confirm",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments/upload-confirm",
    method: "POST",
    body: uploadPayload,
    expect204: true,
  },
  {
    name: "mapping-personal-status",
    handler: GET_MAPPING_PERSONAL_STATUS,
    requestUrl: "http://localhost/api/org/mapping-personal-status?reference_date=2026-07-31&page=1&limit=100",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-personal-status?reference_date=2026-07-31&page=1&limit=100",
    method: "GET",
    expect204: true,
  },
  {
    name: "mapping-type-options",
    handler: GET_MAPPING_TYPE_OPTIONS,
    requestUrl: "http://localhost/api/org/mapping-type-options",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-type-options",
    method: "GET",
  },
  {
    name: "mapping-item-options",
    handler: GET_MAPPING_ITEM_OPTIONS,
    requestUrl: "http://localhost/api/org/mapping-item-options?type_code=COST",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-item-options?type_code=COST",
    method: "GET",
  },
  {
    name: "department-options",
    handler: GET_DEPARTMENT_OPTIONS,
    requestUrl: "http://localhost/api/org/department-options",
    upstreamUrl: "http://localhost:8000/api/v1/org/department-options",
    method: "GET",
  },
  {
    name: "mapping-assignments GET",
    handler: GET_MAPPING_ASSIGNMENTS,
    requestUrl: "http://localhost/api/org/mapping-assignments",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments",
    method: "GET",
  },
  {
    name: "mapping-assignments POST",
    handler: POST_MAPPING_ASSIGNMENTS,
    requestUrl: "http://localhost/api/org/mapping-assignments",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments",
    method: "POST",
    body: basePayload,
  },
  {
    name: "mapping-assignments PUT",
    handler: PUT_MAPPING_ASSIGNMENT,
    requestUrl: "http://localhost/api/org/mapping-assignments/7",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments/7",
    method: "PUT",
    body: basePayload,
    context: { params: { assignmentId: "7" } },
  },
  {
    name: "mapping-assignments DELETE",
    handler: DELETE_MAPPING_ASSIGNMENT,
    requestUrl: "http://localhost/api/org/mapping-assignments/7",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-assignments/7",
    method: "DELETE",
    context: { params: { assignmentId: "7" } },
    expect204: true,
  },
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
    body: typeItemPayload,
  },
  {
    name: "mapping-type-items PUT",
    handler: PUT_MAPPING_TYPE_ITEM,
    requestUrl: "http://localhost/api/org/mapping-type-items/42",
    upstreamUrl: "http://localhost:8000/api/v1/org/mapping-type-items/42",
    method: "PUT",
    body: typeItemPayload,
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

  const init: ConstructorParameters<typeof NextRequest>[1] = {
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

  it("forwards nested 422 detail for mapping-assignments upload-confirm", async () => {
    const routeCase = ROUTES.find((candidate) => candidate.name === "mapping-assignments upload-confirm");
    if (!routeCase) throw new Error("Upload-confirm route contract is missing.");
    const payload = { detail: { message: "upload validation failed", rows: [], valid_count: 0, invalid_count: 1 } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

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

  it("forwards 403 JSON responses for mapping-personal-status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Forbidden." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET_MAPPING_PERSONAL_STATUS(
      new NextRequest("http://localhost/api/org/mapping-personal-status?reference_date=2026-07-31", {
        headers: { cookie: "vibe_hr_token=token-123" },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ detail: "Forbidden." });
  });
});
