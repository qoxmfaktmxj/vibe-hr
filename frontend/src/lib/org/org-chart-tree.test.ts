import { describe, expect, it } from "vitest";

import { buildOrgChartForest } from "@/lib/org/org-chart-tree";
import type { OrganizationDepartmentItem } from "@/types/organization";

function dept(id: number, parent_id: number | null): OrganizationDepartmentItem {
  return {
    id,
    code: `D${id}`,
    name: `부서 ${id}`,
    parent_id,
    parent_name: parent_id == null ? null : `부서 ${parent_id}`,
    organization_type: "본부",
    cost_center_code: `CC${id}`,
    description: null,
    employee_count: id * 10,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildOrgChartForest", () => {
  it.each([
    ["duplicate", [dept(1, null), dept(1, null)], [1]],
    ["self", [dept(1, 1)], [1]],
    ["orphan", [dept(1, 99)], [1]],
    ["cycle", [dept(1, 2), dept(2, 1)], [1, 2]],
  ])("keeps each %s node visible once", (_name, rows, expectedRoots) => {
    expect(buildOrgChartForest(rows).map((node) => node.department.id)).toEqual(expectedRoots);
  });
});
