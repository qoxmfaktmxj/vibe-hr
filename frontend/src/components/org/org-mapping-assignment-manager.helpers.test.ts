import { describe, expect, it, vi } from "vitest";

import type { OrgMappingAssignmentItem } from "@/types/organization";

import {
  buildLookupEditorOptions,
  createSavePayload,
  loadDepartmentLookupOptions,
  loadMappingItemLookupOptions,
} from "./org-mapping-assignment-manager.helpers";

describe("org-mapping-assignment-manager helpers", () => {
  it("builds protected lookup editor options from ids", () => {
    expect(
      buildLookupEditorOptions([
        { id: 7, code: "HQ", name: "본사" },
        { id: null, code: "SKIP", name: "무시" },
      ]),
    ).toEqual([{ value: "7", label: "HQ / 본사" }]);
  });

  it("creates a save payload from the selected protected option ids", () => {
    const row = {
      department_id: 7,
      type_code: "cost",
      item_id: 19,
      effective_from: "2026-07-01T00:00:00.000Z",
      effective_to: "",
    } as Pick<
      OrgMappingAssignmentItem,
      "department_id" | "type_code" | "item_id" | "effective_from" | "effective_to"
    >;

    expect(createSavePayload(row)).toEqual({
      department_id: 7,
      type_code: "COST",
      item_id: 19,
      effective_from: "2026-07-01",
      effective_to: null,
    });
  });

  it("loads department lookup options only from the protected endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 7, code: "HQ", name: "본사" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(loadDepartmentLookupOptions(fetchMock)).resolves.toEqual([
      { id: 7, code: "HQ", name: "본사" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/org/department-options", { cache: "no-store" });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/org/departments?all=true"), expect.anything());
  });

  it("loads mapping item lookup options only from the protected endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 19, code: "CC-100", name: "원가센터 A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(loadMappingItemLookupOptions("cost", fetchMock)).resolves.toEqual([
      { id: 19, code: "CC-100", name: "원가센터 A" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/org/mapping-item-options?type_code=COST", {
      cache: "no-store",
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/org/mapping-type-items"),
      expect.anything(),
    );
  });
});
