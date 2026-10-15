import type { PayPayrollCodeItem, PayTaxRateItem } from "@/types/pay";
import type { TimAttendanceCodeItem, TimHolidayItem, TimWorkScheduleCodeItem } from "@/types/tim";
import type { SpreadsheetColumn } from "@/lib/spreadsheet/workbook";

const INT_MIN = -2_147_483_648;
const INT_MAX = 2_147_483_647;

export const PAYROLL_CODE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "code", label: "급여코드", type: "string", required: true },
  { key: "name", label: "코드명", type: "string", required: true },
  { key: "pay_type", label: "지급성격", type: "string", required: true },
  { key: "payment_day", label: "지급기준일", type: "string", required: true },
  { key: "tax_deductible", label: "소득세공제", type: "boolean" },
  { key: "social_ins_deductible", label: "사대보험공제", type: "boolean" },
  { key: "is_active", label: "사용여부", type: "boolean" },
];

export const TAX_RATE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "year", label: "연도", type: "integer", required: true, min: INT_MIN, max: INT_MAX },
  { key: "rate_type", label: "이름", type: "string", required: true },
  { key: "employee_rate", label: "근로자요율", type: "number", nullable: true },
  { key: "employer_rate", label: "사업주요율", type: "number", nullable: true },
  { key: "min_limit", label: "하한액", type: "integer", nullable: true, min: INT_MIN, max: INT_MAX },
  { key: "max_limit", label: "상한액", type: "integer", nullable: true, min: INT_MIN, max: INT_MAX },
];

export const HOLIDAY_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "holiday_date", label: "날짜", type: "date", required: true },
  { key: "name", label: "공휴일명", type: "string", required: true },
  { key: "holiday_type", label: "유형", type: "string", choices: ["legal", "company", "substitute"] },
  { key: "is_active", label: "사용여부", type: "boolean" },
];

export const ATTENDANCE_CODE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "code", label: "근태코드", type: "string", required: true },
  { key: "name", label: "근태명", type: "string", required: true },
  { key: "category", label: "분류", type: "string", required: true, choices: ["leave", "work", "special"] },
  { key: "unit", label: "단위", type: "string", choices: ["day", "am", "pm", "hour"] },
  { key: "is_requestable", label: "신청가능", type: "boolean" },
  { key: "min_days", label: "최소일수", type: "number", nullable: true },
  { key: "max_days", label: "최대일수", type: "number", nullable: true },
  { key: "deduct_annual", label: "연차차감", type: "boolean" },
  { key: "is_active", label: "사용여부", type: "boolean" },
  { key: "sort_order", label: "순서", type: "integer", min: INT_MIN, max: INT_MAX },
  { key: "description", label: "설명", type: "string", nullable: true },
];

export const WORK_SCHEDULE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "code", label: "근무코드", type: "string", required: true },
  { key: "name", label: "근무명", type: "string", required: true },
  { key: "work_start", label: "출근시간", type: "time", required: true },
  { key: "work_end", label: "퇴근시간", type: "time", required: true },
  { key: "break_minutes", label: "휴게시간(분)", type: "integer", min: 0, max: INT_MAX },
  { key: "is_overnight", label: "야간여부", type: "boolean" },
  { key: "work_hours", label: "소정시간", type: "number", min: 0.01 },
  { key: "is_active", label: "사용여부", type: "boolean" },
  { key: "sort_order", label: "순서", type: "integer", min: INT_MIN, max: INT_MAX },
  { key: "description", label: "설명", type: "string", nullable: true },
];

function validateRows(
  rows: Record<string, unknown>[],
  columns: readonly SpreadsheetColumn[],
  existingKeys: readonly string[],
  keyOf: (row: Record<string, unknown>) => string,
  maxLengths: Record<string, number>,
) {
  const keys = new Set(existingKeys);
  return rows.map((value, index) => {
    const row = { ...value };
    if (typeof row.code === "string") row.code = row.code.toUpperCase();
    for (const [field, max] of Object.entries(maxLengths)) {
      const text = row[field];
      if (typeof text === "string" && text.length > max) {
        const label = columns.find((column) => column.key === field)?.label ?? field;
        throw new Error(`${index + 2}행 ${label}: ${max}자 이내로 입력해 주세요.`);
      }
    }
    const key = keyOf(row);
    if (keys.has(key)) throw new Error(`${index + 2}행: 이미 존재하거나 파일 안에서 중복된 항목입니다. (${key})`);
    keys.add(key);
    return row;
  });
}

export function validatePayrollCodeImport(rows: Record<string, unknown>[], existing: readonly Pick<PayPayrollCodeItem, "code">[]) {
  return validateRows(rows, PAYROLL_CODE_COLUMNS, existing.map((row) => row.code.trim().toUpperCase()),
    (row) => String(row.code), { code: 20, name: 100, pay_type: 20, payment_day: 20 }) as Partial<PayPayrollCodeItem>[];
}

export function validateTaxRateImport(rows: Record<string, unknown>[], existing: readonly Pick<PayTaxRateItem, "year" | "rate_type">[]) {
  const keyOf = (row: { year?: unknown; rate_type?: unknown }) => JSON.stringify([row.year, row.rate_type]);
  return validateRows(rows, TAX_RATE_COLUMNS, existing.map((row) => keyOf({ ...row, rate_type: row.rate_type.trim() })),
    keyOf, { rate_type: 50 }) as Partial<PayTaxRateItem>[];
}

export function validateHolidayImport(rows: Record<string, unknown>[], existing: readonly Pick<TimHolidayItem, "holiday_date">[], year: number) {
  for (const [index, row] of rows.entries()) {
    if (Number(String(row.holiday_date).slice(0, 4)) !== year) {
      throw new Error(`${index + 2}행 날짜: 조회 연도 ${year}년의 날짜를 입력해 주세요.`);
    }
  }
  return validateRows(rows, HOLIDAY_COLUMNS, existing.map((row) => row.holiday_date),
    (row) => String(row.holiday_date), { name: 100 }) as Partial<TimHolidayItem>[];
}

export function validateAttendanceCodeImport(rows: Record<string, unknown>[], existing: readonly Pick<TimAttendanceCodeItem, "code">[]) {
  return validateRows(rows, ATTENDANCE_CODE_COLUMNS, existing.map((row) => row.code.trim().toUpperCase()),
    (row) => String(row.code), { code: 20, name: 100, description: 200 }) as Partial<TimAttendanceCodeItem>[];
}

export function validateWorkScheduleImport(rows: Record<string, unknown>[], existing: readonly Pick<TimWorkScheduleCodeItem, "code">[]) {
  return validateRows(rows, WORK_SCHEDULE_COLUMNS, existing.map((row) => row.code.trim().toUpperCase()),
    (row) => String(row.code), { code: 20, name: 100, description: 200 }) as Partial<TimWorkScheduleCodeItem>[];
}
