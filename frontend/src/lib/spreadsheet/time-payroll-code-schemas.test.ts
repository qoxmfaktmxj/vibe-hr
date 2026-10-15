import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import { parseSpreadsheet, type SpreadsheetColumn } from "@/lib/spreadsheet/workbook";
import {
  ATTENDANCE_CODE_COLUMNS,
  HOLIDAY_COLUMNS,
  PAYROLL_CODE_COLUMNS,
  TAX_RATE_COLUMNS,
  WORK_SCHEDULE_COLUMNS,
  validateAttendanceCodeImport,
  validateHolidayImport,
  validatePayrollCodeImport,
  validateTaxRateImport,
  validateWorkScheduleImport,
} from "@/lib/spreadsheet/time-payroll-code-schemas";

function workbook(columns: readonly SpreadsheetColumn[], records: Record<string, unknown>[], keys = false): ArrayBuffer {
  const book = utils.book_new();
  const values = records.map((record) => columns.map((column) => record[column.key] ?? null));
  utils.book_append_sheet(book, utils.aoa_to_sheet([columns.map((column) => keys ? column.key : column.label), ...values]), "입력");
  return write(book, { type: "array", bookType: "xlsx" });
}

const examples = [
  {
    name: "payroll codes",
    columns: PAYROLL_CODE_COLUMNS,
    record: { code: "pnew", name: "신규급여", pay_type: "급여", payment_day: "당월말일", tax_deductible: "Y", social_ins_deductible: "N", is_active: "Y" },
    validate: (rows: Record<string, unknown>[]) => validatePayrollCodeImport(rows, []),
    duplicate: (rows: Record<string, unknown>[]) => validatePayrollCodeImport(rows, [{ code: "PNEW" }]),
    invalid: { name: "" },
  },
  {
    name: "tax rates",
    columns: TAX_RATE_COLUMNS,
    record: { year: 2026, rate_type: "검증요율", employee_rate: 4.5, employer_rate: 4.5, min_limit: 390000, max_limit: 6170000 },
    validate: (rows: Record<string, unknown>[]) => validateTaxRateImport(rows, []),
    duplicate: (rows: Record<string, unknown>[]) => validateTaxRateImport(rows, [{ year: 2026, rate_type: "검증요율" }]),
    invalid: { min_limit: 0.5 },
  },
  {
    name: "holidays",
    columns: HOLIDAY_COLUMNS,
    record: { holiday_date: "2026-12-24", name: "회사휴일", holiday_type: "company", is_active: "Y" },
    validate: (rows: Record<string, unknown>[]) => validateHolidayImport(rows, [], 2026),
    duplicate: (rows: Record<string, unknown>[]) => validateHolidayImport(rows, [{ holiday_date: "2026-12-24" }], 2026),
    invalid: { holiday_date: "2026-02-30" },
  },
  {
    name: "attendance codes",
    columns: ATTENDANCE_CODE_COLUMNS,
    record: { code: "anew", name: "신규근태", category: "leave", unit: "am", is_requestable: "Y", min_days: 0.5, max_days: 1, deduct_annual: "Y", is_active: "Y", sort_order: 2, description: "오전휴가" },
    validate: (rows: Record<string, unknown>[]) => validateAttendanceCodeImport(rows, []),
    duplicate: (rows: Record<string, unknown>[]) => validateAttendanceCodeImport(rows, [{ code: "ANEW" }]),
    invalid: { category: "invalid" },
  },
  {
    name: "work schedules",
    columns: WORK_SCHEDULE_COLUMNS,
    record: { code: "wnew", name: "신규근무", work_start: "09:00", work_end: "18:00", break_minutes: 60, is_overnight: "N", work_hours: 8, is_active: "Y", sort_order: 2, description: "주간" },
    validate: (rows: Record<string, unknown>[]) => validateWorkScheduleImport(rows, []),
    duplicate: (rows: Record<string, unknown>[]) => validateWorkScheduleImport(rows, [{ code: "WNEW" }]),
    invalid: { work_start: "25:00" },
  },
];

describe.each(examples)("$name XLSX import", ({ columns, record, validate, duplicate, invalid }) => {
  it("reads the actual Korean-header workbook and validates every field", async () => {
    const rows = validate(await parseSpreadsheet(workbook(columns, [record]), columns));
    expect(rows).toHaveLength(1);
    for (const [key, value] of Object.entries(record)) {
      expect((rows[0] as Record<string, unknown>)[key]).toEqual(key === "code" ? String(value).toUpperCase() : value === "Y" ? true : value === "N" ? false : value);
    }
  });

  it("also accepts field-key workbook headers", async () => {
    expect(validate(await parseSpreadsheet(workbook(columns, [record], true), columns))).toHaveLength(1);
  });

  it("rejects the full file when its second row is invalid", async () => {
    await expect(parseSpreadsheet(workbook(columns, [record, { ...record, ...invalid }]), columns)).rejects.toThrow();
  });

  it("rejects duplicates in the workbook before returning an import", async () => {
    const rows = await parseSpreadsheet(workbook(columns, [record, record]), columns);
    expect(() => validate(rows)).toThrow("중복");
  });

  it("rejects duplicates against existing unsaved or saved rows", async () => {
    const rows = await parseSpreadsheet(workbook(columns, [record]), columns);
    expect(() => duplicate(rows)).toThrow("중복");
  });

  it("rejects overlong names before returning any rows", async () => {
    const field = "rate_type" in record ? "rate_type" : "name";
    const max = field === "rate_type" ? 50 : 100;
    const rows = await parseSpreadsheet(workbook(columns, [{ ...record, [field]: "가".repeat(max + 1) }]), columns);
    expect(() => validate(rows)).toThrow(`${max}자`);
  });
});

describe("time and payroll defaults and backend validation boundaries", () => {
  it("keeps omitted switches absent so createEmptyRow defaults survive", async () => {
    const record = { code: "PNEW", name: "신규", pay_type: "급여", payment_day: "25" };
    const [row] = validatePayrollCodeImport(await parseSpreadsheet(workbook(PAYROLL_CODE_COLUMNS, [record]), PAYROLL_CODE_COLUMNS), []);
    expect({ tax_deductible: true, social_ins_deductible: true, is_active: true, ...row })
      .toEqual({ ...record, tax_deductible: true, social_ins_deductible: true, is_active: true });
  });

  it("preserves nullable tax values and rejects fractional amounts", async () => {
    const record = { year: 2026, rate_type: "신규요율" };
    const [row] = validateTaxRateImport(await parseSpreadsheet(workbook(TAX_RATE_COLUMNS, [record]), TAX_RATE_COLUMNS), []);
    expect(row).toEqual({ ...record, employee_rate: null, employer_rate: null, min_limit: null, max_limit: null });
    await expect(parseSpreadsheet(workbook(TAX_RATE_COLUMNS, [{ ...record, max_limit: 0.5 }]), TAX_RATE_COLUMNS)).rejects.toThrow("숫자");
  });

  it("normalizes real Excel date serials and checks the loaded holiday year", async () => {
    const rows = await parseSpreadsheet(workbook(HOLIDAY_COLUMNS, [{ holiday_date: new Date("2026-12-24T00:00:00Z"), name: "회사휴일" }]), HOLIDAY_COLUMNS);
    expect(validateHolidayImport(rows, [], 2026)[0].holiday_date).toBe("2026-12-24");
    expect(() => validateHolidayImport(rows, [], 2027)).toThrow("조회 연도 2027년");
  });

  it("checks attendance unit enums and retains nullable day and description values", async () => {
    const record = { code: "ANEW", name: "신규근태", category: "leave" };
    const [row] = validateAttendanceCodeImport(await parseSpreadsheet(workbook(ATTENDANCE_CODE_COLUMNS, [record]), ATTENDANCE_CODE_COLUMNS), []);
    expect(row).toEqual({ ...record, min_days: null, max_days: null, description: null });
    await expect(parseSpreadsheet(workbook(ATTENDANCE_CODE_COLUMNS, [{ ...record, unit: "week" }]), ATTENDANCE_CODE_COLUMNS)).rejects.toThrow("허용 값");
  });

  it("normalizes Excel time fractions and enforces the existing break and hours minima", async () => {
    const record = { code: "WNEW", name: "신규근무", work_start: 9 / 24, work_end: 18 / 24 };
    const [row] = validateWorkScheduleImport(await parseSpreadsheet(workbook(WORK_SCHEDULE_COLUMNS, [record]), WORK_SCHEDULE_COLUMNS), []);
    expect(row.work_start).toBe("09:00");
    expect(row.work_end).toBe("18:00");
    expect(row).not.toHaveProperty("work_hours");
    await expect(parseSpreadsheet(workbook(WORK_SCHEDULE_COLUMNS, [{ ...record, break_minutes: -1 }]), WORK_SCHEDULE_COLUMNS)).rejects.toThrow("0 이상");
    await expect(parseSpreadsheet(workbook(WORK_SCHEDULE_COLUMNS, [{ ...record, work_hours: 0 }]), WORK_SCHEDULE_COLUMNS)).rejects.toThrow("0.01 이상");
  });
});
