import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import { EMPLOYEE_PROFILE_COLUMNS, PAYMENT_SCHEDULE_COLUMNS, PAYROLL_RUN_COLUMNS, VARIABLE_INPUT_COLUMNS, validateEmployeeProfileUpload, validatePaymentScheduleUpload, validateVariableInputUpload } from "@/lib/spreadsheet/payroll-operation-schemas";
import { parseSpreadsheet, type SpreadsheetColumn } from "@/lib/spreadsheet/workbook";

function workbook(columns: readonly SpreadsheetColumn[], rows: Record<string, unknown>[], koreanHeaders = true): ArrayBuffer {
  const book = utils.book_new();
  const sheet = utils.aoa_to_sheet([
    columns.map((column) => koreanHeaders ? column.label : column.key),
    ...rows.map((row) => columns.map((column) => row[column.key] ?? null)),
  ]);
  utils.book_append_sheet(book, sheet, "data");
  return write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const schedule = {
  payment_day_type: "fixed_day", payment_day_value: 25, holiday_adjustment: "previous_business_day",
  effective_from: "2026-01-01", effective_to: null, is_active: true,
};
const profile = {
  employee_id: 6018, payroll_code_id: 1, item_group_id: null, base_salary: 4_200_000, pay_type_code: "regular", ...schedule,
};
const variable = { year_month: "2026-10", employee_id: 6018, item_code: "BONUS", direction: "earning", amount: 100_000, memo: null };

describe("employee profile XLSX upload", () => {
  it("reads Korean template columns, dates and boolean values into one validated new row", async () => {
    const records = await parseSpreadsheet(workbook(EMPLOYEE_PROFILE_COLUMNS, [profile]), EMPLOYEE_PROFILE_COLUMNS);
    expect(validateEmployeeProfileUpload(records, [])).toEqual([{ ...profile, id: undefined }]);
  });

  it("allows a known ID update while rejecting unknown and repeated IDs", async () => {
    const existing = [{ id: 301, employee_id: 6018, effective_from: "2026-01-01" }];
    const records = await parseSpreadsheet(workbook(EMPLOYEE_PROFILE_COLUMNS, [{ id: 301, ...profile }], false), EMPLOYEE_PROFILE_COLUMNS);
    expect(validateEmployeeProfileUpload(records, existing)[0].id).toBe(301);
    expect(() => validateEmployeeProfileUpload(records, [])).toThrow("ID");
    expect(() => validateEmployeeProfileUpload([...records, ...records], existing)).toThrow("중복");
  });

  it.each([
    ["base_salary", -1], ["employee_id", 0], ["payroll_code_id", 0], ["item_group_id", 1.5],
    ["payment_day_type", "weekly"], ["payment_day_value", 32], ["holiday_adjustment", "skip"],
    ["effective_from", "2026-02-30"], ["is_active", "maybe"],
  ])("rejects invalid %s before any row can be applied", async (key, value) => {
    await expect(parseSpreadsheet(workbook(EMPLOYEE_PROFILE_COLUMNS, [profile, { ...profile, [key]: value }]), EMPLOYEE_PROFILE_COLUMNS)).rejects.toThrow();
  });

  it("rejects duplicate employee/effective date keys and overlong pay type codes", async () => {
    const records = await parseSpreadsheet(workbook(EMPLOYEE_PROFILE_COLUMNS, [profile, profile]), EMPLOYEE_PROFILE_COLUMNS);
    expect(() => validateEmployeeProfileUpload(records, [])).toThrow("중복");
    const longCode = await parseSpreadsheet(workbook(EMPLOYEE_PROFILE_COLUMNS, [{ ...profile, pay_type_code: "x".repeat(21) }]), EMPLOYEE_PROFILE_COLUMNS);
    expect(() => validateEmployeeProfileUpload(longCode, [])).toThrow("20자");
  });
});

describe("variable input XLSX upload", () => {
  it("keeps the backend-supported negative adjustment amount and nullable memo", async () => {
    const records = await parseSpreadsheet(workbook(VARIABLE_INPUT_COLUMNS, [{ ...variable, amount: -10_000 }]), VARIABLE_INPUT_COLUMNS);
    expect(validateVariableInputUpload(records, [], "2026-10")).toEqual([{ ...variable, id: undefined, amount: -10_000 }]);
  });

  it("rejects an invalid or different applied month", async () => {
    for (const month of ["2026-13", "2026-09"]) {
      const records = await parseSpreadsheet(workbook(VARIABLE_INPUT_COLUMNS, [{ ...variable, year_month: month }]), VARIABLE_INPUT_COLUMNS);
      expect(() => validateVariableInputUpload(records, [], "2026-10")).toThrow("귀속월");
    }
  });

  it.each([["item_code", "X".repeat(21)], ["memo", "X".repeat(201)]])("enforces backend %s length", async (key, value) => {
    const records = await parseSpreadsheet(workbook(VARIABLE_INPUT_COLUMNS, [{ ...variable, [key]: value }]), VARIABLE_INPUT_COLUMNS);
    expect(() => validateVariableInputUpload(records, [], "2026-10")).toThrow("이하");
  });

  it("rejects nonnumeric amounts and unsupported directions in an actual workbook", async () => {
    for (const override of [{ amount: "100원" }, { direction: "allowance" }]) {
      await expect(parseSpreadsheet(workbook(VARIABLE_INPUT_COLUMNS, [{ ...variable, ...override }]), VARIABLE_INPUT_COLUMNS)).rejects.toThrow();
    }
  });

  it("rejects duplicate natural keys without mutating existing rows", async () => {
    const existing = [{ id: 401, ...variable }];
    const before = JSON.stringify(existing);
    const records = await parseSpreadsheet(workbook(VARIABLE_INPUT_COLUMNS, [{ ...variable, employee_id: 6019 }, variable]), VARIABLE_INPUT_COLUMNS);
    expect(() => validateVariableInputUpload(records, existing, "2026-10")).toThrow("중복");
    expect(JSON.stringify(existing)).toBe(before);
  });

  it("allows editing a known ID but rejects deleted and unknown targets", async () => {
    const records = await parseSpreadsheet(workbook(VARIABLE_INPUT_COLUMNS, [{ id: 401, ...variable, amount: 50_000 }]), VARIABLE_INPUT_COLUMNS);
    expect(validateVariableInputUpload(records, [{ id: 401, ...variable }], "2026-10")[0].amount).toBe(50_000);
    expect(() => validateVariableInputUpload(records, [], "2026-10")).toThrow("ID");
    expect(() => validateVariableInputUpload(records, [{ id: 401, ...variable, _status: "deleted" }], "2026-10")).toThrow("ID");
  });
});

describe("payment schedule XLSX upload", () => {
  const existing = [{ id: 301, employee_id: 6018, effective_from: "2026-01-01" }];

  it("resolves an existing ID or an unambiguous employee ID without creating profiles", async () => {
    for (const identity of [{ id: 301 }, { employee_id: 6018 }, { id: 301, employee_id: 6018 }]) {
      const records = await parseSpreadsheet(workbook(PAYMENT_SCHEDULE_COLUMNS, [{ ...identity, ...schedule }]), PAYMENT_SCHEDULE_COLUMNS);
      expect(validatePaymentScheduleUpload(records, existing)).toEqual([{ id: 301, ...schedule }]);
    }
  });

  it.each([{}, { id: 999 }, { employee_id: 999 }, { id: 301, employee_id: 999 }])("rejects missing, unmatched or inconsistent identity %j", async (identity) => {
    const records = await parseSpreadsheet(workbook(PAYMENT_SCHEDULE_COLUMNS, [{ ...identity, ...schedule }]), PAYMENT_SCHEDULE_COLUMNS);
    expect(() => validatePaymentScheduleUpload(records, existing)).toThrow();
  });

  it("rejects an employee with multiple profiles unless the exact ID is provided", async () => {
    const multiple = [...existing, { id: 302, employee_id: 6018, effective_from: "2025-01-01" }];
    const records = await parseSpreadsheet(workbook(PAYMENT_SCHEDULE_COLUMNS, [{ employee_id: 6018, ...schedule }]), PAYMENT_SCHEDULE_COLUMNS);
    expect(() => validatePaymentScheduleUpload(records, multiple)).toThrow("식별");
  });

  it("rejects duplicate resolved IDs in the entire workbook and leaves input unchanged", async () => {
    const before = JSON.stringify(existing);
    const records = await parseSpreadsheet(workbook(PAYMENT_SCHEDULE_COLUMNS, [{ id: 301, ...schedule }, { employee_id: 6018, ...schedule }]), PAYMENT_SCHEDULE_COLUMNS);
    expect(() => validatePaymentScheduleUpload(records, existing)).toThrow("중복");
    expect(JSON.stringify(existing)).toBe(before);
  });
});

it("reads payroll Run download as numeric totals and preserves names and statuses", async () => {
  const run = { id: 2, year_month: "2026-10", payroll_code_name: "정규급여", status: "calculated", total_employees: 1, total_gross: 4_200_000, total_deductions: 518_000, total_net: 3_682_000, run_name: "10월 급여" };
  expect(await parseSpreadsheet(workbook(PAYROLL_RUN_COLUMNS, [run]), PAYROLL_RUN_COLUMNS)).toEqual([run]);
});
