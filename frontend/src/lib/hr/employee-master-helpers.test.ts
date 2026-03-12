import { describe, expect, test } from "vitest";

import {
  buildEmployeeQuery,
  cloneFilters,
  EMPTY_SEARCH_FILTERS,
  normalizeEmploymentStatus,
  parseBoolean,
} from "@/lib/hr/employee-master-helpers";

describe("employee-master-helpers", () => {
  test("normalizeEmploymentStatus maps localized and canonical values", () => {
    expect(normalizeEmploymentStatus("휴직")).toBe("leave");
    expect(normalizeEmploymentStatus("resigned")).toBe("resigned");
    expect(normalizeEmploymentStatus("unknown")).toBe("active");
  });

  test("parseBoolean accepts common truthy flags", () => {
    expect(parseBoolean("Y")).toBe(true);
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("0")).toBe(false);
  });

  test("buildEmployeeQuery includes only supported filters", () => {
    const params = buildEmployeeQuery({
      ...EMPTY_SEARCH_FILTERS,
      employeeNo: " EMP-001 ",
      name: "Kim",
      employmentStatuses: ["active"],
      active: "N",
      positions: ["manager"],
    });

    expect(params.get("employee_no")).toBe("EMP-001");
    expect(params.get("name")).toBe("Kim");
    expect(params.get("employment_status")).toBe("active");
    expect(params.get("active")).toBe("false");
    expect(params.get("department")).toBeNull();
  });

  test("cloneFilters copies array fields defensively", () => {
    const source = {
      ...EMPTY_SEARCH_FILTERS,
      positions: ["사원"],
      employmentStatuses: ["active" as const],
    };

    const cloned = cloneFilters(source);
    cloned.positions.push("대리");
    cloned.employmentStatuses.push("leave");

    expect(source.positions).toEqual(["사원"]);
    expect(source.employmentStatuses).toEqual(["active"]);
  });
});
