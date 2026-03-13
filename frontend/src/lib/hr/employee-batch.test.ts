import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEmployeeBatchPayload } from "@/lib/hr/employee-batch";

describe("employee-batch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes typed employee_no for inserted rows", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456);

    const payload = buildEmployeeBatchPayload([
      {
        id: -1,
        employee_no: " 1234 ",
        login_id: "hong1234",
        display_name: "홍길동",
        email: "hong1234@example.com",
        department_id: 10,
        position_title: "사원",
        hire_date: "2026-03-12",
        employment_status: "active",
        is_active: true,
        password: "admin1234",
        _status: "added",
      },
    ]);

    expect(payload.insert).toEqual([
      {
        employee_no: "1234",
        display_name: "홍길동",
        department_id: 10,
        position_title: "사원",
        hire_date: "2026-03-12",
        employment_status: "active",
        login_id: "hong1234",
        email: "hong1234@example.com",
        password: "admin1234",
      },
    ]);
  });
});
