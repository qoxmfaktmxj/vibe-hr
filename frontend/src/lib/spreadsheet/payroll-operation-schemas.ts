import type { PayEmployeeProfileItem, PayVariableInputItem } from "@/types/pay";
import type { SpreadsheetColumn } from "@/lib/spreadsheet/workbook";

const PROFILE_SCHEDULE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "payment_day_type", label: "지급일유형", type: "string", required: true, choices: ["fixed_day", "month_end"] },
  { key: "payment_day_value", label: "지급일", type: "integer", nullable: true, min: 1, max: 31 },
  { key: "holiday_adjustment", label: "휴일보정", type: "string", required: true, choices: ["previous_business_day", "next_business_day", "none"] },
  { key: "effective_from", label: "적용시작", type: "date", required: true },
  { key: "effective_to", label: "적용종료", type: "date", nullable: true },
  { key: "is_active", label: "활성", type: "boolean", required: true },
];

export const EMPLOYEE_PROFILE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "id", label: "ID", type: "integer", nullable: true, min: 1 },
  { key: "employee_id", label: "직원ID", type: "integer", required: true, min: 1 },
  { key: "payroll_code_id", label: "급여코드ID", type: "integer", required: true, min: 1 },
  { key: "item_group_id", label: "항목그룹ID", type: "integer", nullable: true, min: 1 },
  { key: "base_salary", label: "기본급", type: "number", required: true, min: 0 },
  { key: "pay_type_code", label: "지급유형", type: "string", required: true },
  ...PROFILE_SCHEDULE_COLUMNS,
];

export const PAYMENT_SCHEDULE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "id", label: "ID", type: "integer", nullable: true, min: 1 },
  { key: "employee_id", label: "직원ID", type: "integer", nullable: true, min: 1 },
  ...PROFILE_SCHEDULE_COLUMNS,
];

export const VARIABLE_INPUT_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "id", label: "ID", type: "integer", nullable: true, min: 1 },
  { key: "year_month", label: "귀속월", type: "string", required: true },
  { key: "employee_id", label: "직원ID", type: "integer", required: true, min: 1 },
  { key: "item_code", label: "항목코드", type: "string", required: true },
  { key: "direction", label: "구분", type: "string", required: true, choices: ["earning", "deduction"] },
  { key: "amount", label: "금액", type: "number", required: true },
  { key: "memo", label: "비고", type: "string", nullable: true },
];

export const PAYROLL_RUN_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "id", label: "ID", type: "integer" },
  { key: "year_month", label: "급여월", type: "string" },
  { key: "payroll_code_name", label: "급여코드", type: "string", nullable: true },
  { key: "status", label: "진행상태", type: "string" },
  { key: "total_employees", label: "대상자", type: "integer" },
  { key: "total_gross", label: "총지급", type: "number" },
  { key: "total_deductions", label: "총공제", type: "number" },
  { key: "total_net", label: "실지급", type: "number" },
  { key: "run_name", label: "Run명", type: "string", nullable: true },
];

type ScheduleValues = Pick<PayEmployeeProfileItem, "payment_day_type" | "payment_day_value" | "holiday_adjustment" | "effective_from" | "effective_to" | "is_active">;
type ProfileUpload = ScheduleValues & Pick<PayEmployeeProfileItem, "employee_id" | "payroll_code_id" | "item_group_id" | "base_salary" | "pay_type_code"> & { id?: number };
type VariableUpload = Pick<PayVariableInputItem, "year_month" | "employee_id" | "item_code" | "direction" | "amount" | "memo"> & { id?: number };
type ExistingProfile = Pick<PayEmployeeProfileItem, "id" | "employee_id" | "effective_from"> & { _status?: string };
type ExistingVariable = Pick<PayVariableInputItem, "id" | "year_month" | "employee_id" | "item_code"> & { _status?: string };

function requireRows(records: readonly Record<string, unknown>[]) {
  if (records.length === 0) throw new Error("업로드할 데이터가 없습니다.");
}

function validateId(id: number | undefined, existing: readonly { id: number; _status?: string }[], seen: Set<number>, rowNumber: number) {
  if (id == null) return;
  const match = existing.find((row) => row.id === id);
  if (!match || match._status === "deleted") throw new Error(`${rowNumber}행: 수정할 ID를 현재 목록에서 찾을 수 없습니다.`);
  if (seen.has(id)) throw new Error(`${rowNumber}행: 같은 ID가 중복되었습니다.`);
  seen.add(id);
}

export function validateEmployeeProfileUpload(records: readonly Record<string, unknown>[], existing: readonly ExistingProfile[]): ProfileUpload[] {
  requireRows(records);
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();
  return records.map((record, index) => {
    const row = record as ProfileUpload;
    const rowNumber = index + 2;
    validateId(row.id, existing, seenIds, rowNumber);
    if (row.pay_type_code.length > 20) throw new Error(`${rowNumber}행: 지급유형은 20자 이하여야 합니다.`);
    const key = `${row.employee_id}|${row.effective_from}`;
    if (seenKeys.has(key) || existing.some((item) => item.id !== row.id && item._status !== "deleted" && item.employee_id === row.employee_id && item.effective_from === row.effective_from)) {
      throw new Error(`${rowNumber}행: 같은 직원의 적용시작일이 중복되었습니다. 기존 행 수정은 ID를 입력해 주세요.`);
    }
    seenKeys.add(key);
    return { ...row, id: row.id ?? undefined, item_group_id: row.item_group_id ?? null, payment_day_value: row.payment_day_value ?? null, effective_to: row.effective_to ?? null };
  });
}

export function validateVariableInputUpload(records: readonly Record<string, unknown>[], existing: readonly ExistingVariable[], yearMonth: string): VariableUpload[] {
  requireRows(records);
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();
  return records.map((record, index) => {
    const row = record as VariableUpload;
    const rowNumber = index + 2;
    validateId(row.id, existing, seenIds, rowNumber);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.year_month)) throw new Error(`${rowNumber}행: 귀속월은 YYYY-MM 형식이어야 합니다.`);
    if (yearMonth && row.year_month !== yearMonth) throw new Error(`${rowNumber}행: 귀속월은 현재 조회월(${yearMonth})과 같아야 합니다.`);
    if (row.item_code.length > 20 || (row.memo?.length ?? 0) > 200) throw new Error(`${rowNumber}행: 항목코드는 20자, 비고는 200자 이하여야 합니다.`);
    const key = `${row.year_month}|${row.employee_id}|${row.item_code}`;
    if (seenKeys.has(key) || existing.some((item) => item.id !== row.id && item._status !== "deleted" && `${item.year_month}|${item.employee_id}|${item.item_code}` === key)) {
      throw new Error(`${rowNumber}행: 귀속월, 직원, 항목코드가 중복되었습니다. 기존 행 수정은 ID를 입력해 주세요.`);
    }
    seenKeys.add(key);
    return { ...row, id: row.id ?? undefined, memo: row.memo ?? null };
  });
}

export function validatePaymentScheduleUpload(records: readonly Record<string, unknown>[], existing: readonly ExistingProfile[]): (ScheduleValues & { id: number })[] {
  requireRows(records);
  const seenIds = new Set<number>();
  return records.map((record, index) => {
    const row = record as ScheduleValues & { id?: number; employee_id?: number };
    const rowNumber = index + 2;
    if (row.id == null && row.employee_id == null) throw new Error(`${rowNumber}행: ID 또는 직원ID를 입력해 주세요.`);
    const matches = existing.filter((item) => item._status !== "deleted" && (row.id != null ? item.id === row.id : item.employee_id === row.employee_id));
    if (matches.length !== 1 || (row.employee_id != null && matches[0].employee_id !== row.employee_id)) {
      throw new Error(`${rowNumber}행: 기존 급여프로필을 하나로 식별할 수 없습니다. 정확한 ID를 입력해 주세요.`);
    }
    const id = matches[0].id;
    validateId(id, existing, seenIds, rowNumber);
    return { id, payment_day_type: row.payment_day_type, payment_day_value: row.payment_day_value ?? null, holiday_adjustment: row.holiday_adjustment, effective_from: row.effective_from, effective_to: row.effective_to ?? null, is_active: row.is_active };
  });
}
