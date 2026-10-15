import type { SpreadsheetColumn } from "@/lib/spreadsheet/workbook";
import type { PayAllowanceDeductionItem, PayItemGroupItem } from "@/types/pay";
import type { GlAccountItem, PayGlMappingItem } from "@/types/pay-voucher";
import type { PaySeveranceItemRuleItem } from "@/types/hr-severance";

export const GL_ACCOUNT_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "code", label: "계정코드", type: "string", required: true },
  { key: "name", label: "계정명", type: "string", required: true },
  { key: "account_type", label: "계정유형", type: "string", required: true, choices: ["expense", "liability", "asset", "equity", "revenue"] },
  { key: "is_net_pay_account", label: "실지급계정", type: "boolean", required: true },
  { key: "is_cash_account", label: "현금계정", type: "boolean", required: true },
  { key: "is_active", label: "사용여부", type: "boolean", required: true },
  { key: "sort_order", label: "순서", type: "integer", required: true, min: -2147483648, max: 2147483647 },
];

export const GL_MAPPING_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "pay_item_code", label: "급여항목코드", type: "string", required: true },
  { key: "gl_account_code", label: "GL계정", type: "string", required: true },
  { key: "effective_from", label: "적용시작일", type: "date", required: true },
  { key: "note", label: "비고", type: "string", nullable: true },
  { key: "is_active", label: "사용여부", type: "boolean", required: true },
];

export const ITEM_GROUP_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "code", label: "그룹코드", type: "string", required: true },
  { key: "name", label: "그룹명", type: "string", required: true },
  { key: "description", label: "설명", type: "string", nullable: true },
  { key: "is_active", label: "사용여부", type: "boolean", required: true },
];

export const ALLOWANCE_DEDUCTION_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "code", label: "항목코드", type: "string", required: true },
  { key: "name", label: "항목명", type: "string", required: true },
  { key: "type", label: "항목유형", type: "string", required: true, choices: ["allowance", "deduction"] },
  { key: "tax_type", label: "과세유형", type: "string", required: true, choices: ["taxable", "non-taxable", "tax", "insurance"] },
  { key: "calculation_type", label: "계산방식", type: "string", required: true, choices: ["fixed", "hourly", "formula"] },
  { key: "is_active", label: "사용여부", type: "boolean", required: true },
  { key: "sort_order", label: "정렬순서", type: "integer", required: true, min: -2147483648, max: 2147483647 },
];

export const SEVERANCE_ITEM_RULE_COLUMNS: readonly SpreadsheetColumn[] = [
  { key: "pay_item_code", label: "급여항목코드", type: "string", required: true },
  { key: "include_type", label: "산입구분", type: "string", required: true, choices: ["full", "prorate_12", "exclude"] },
  { key: "note", label: "비고", type: "string", nullable: true },
  { key: "is_active", label: "사용여부", type: "boolean", required: true },
];

function text(row: Record<string, unknown>, key: string, label: string, max: number, index: number): string {
  const value = String(row[key] ?? "").trim();
  if (value.length > max) throw new Error(`${index + 2}행 ${label}은 ${max}자 이내로 입력해 주세요.`);
  return value;
}

function code(row: Record<string, unknown>, key: string, max: number, index: number): string {
  const value = text(row, key, key, max, index).toUpperCase();
  if (value.length > max) throw new Error(`${index + 2}행 ${key}은 ${max}자 이내로 입력해 주세요.`);
  return value;
}

function assertUnique(keys: readonly string[], existingKeys: readonly string[]): void {
  const seen = new Set(existingKeys.map((key) => key.trim().toUpperCase()));
  keys.forEach((key, index) => {
    if (seen.has(key)) throw new Error(`${index + 2}행 코드가 파일 또는 현재 목록과 중복됩니다: ${key}`);
    seen.add(key);
  });
}

export function validateGlAccountRows(rows: readonly Record<string, unknown>[], existingCodes: readonly string[] = []) {
  const items = rows.map((row, index) => ({
    code: code(row, "code", 20, index),
    name: text(row, "name", "계정명", 100, index),
    account_type: row.account_type as GlAccountItem["account_type"],
    is_net_pay_account: row.is_net_pay_account as boolean,
    is_cash_account: row.is_cash_account as boolean,
    is_active: row.is_active as boolean,
    sort_order: row.sort_order as number,
  }));
  assertUnique(items.map((row) => row.code), existingCodes);
  return items;
}

export function glMappingKey(row: Pick<PayGlMappingItem, "pay_item_code" | "effective_from">): string {
  return `${row.pay_item_code.trim().toUpperCase()}|${row.effective_from}`;
}

export function validateGlMappingRows(rows: readonly Record<string, unknown>[], accountCodes: readonly string[], existingKeys: readonly string[] = []) {
  const accounts = new Set(accountCodes);
  const items = rows.map((row, index) => {
    const accountCode = text(row, "gl_account_code", "GL계정", 20, index);
    if (!accounts.has(accountCode)) throw new Error(`${index + 2}행 GL계정이 계정 목록에 없습니다: ${accountCode}`);
    return {
      pay_item_code: code(row, "pay_item_code", 30, index),
      gl_account_code: accountCode,
      effective_from: row.effective_from as string,
      note: text(row, "note", "비고", 200, index) || null,
      is_active: row.is_active as boolean,
    };
  });
  assertUnique(items.map(glMappingKey), existingKeys);
  return items;
}

export function validateItemGroupRows(rows: readonly Record<string, unknown>[], existingCodes: readonly string[] = []) {
  const items = rows.map((row, index) => ({
    code: code(row, "code", 20, index),
    name: text(row, "name", "그룹명", 100, index),
    description: text(row, "description", "설명", 200, index) || null,
    is_active: row.is_active as PayItemGroupItem["is_active"],
  }));
  assertUnique(items.map((row) => row.code), existingCodes);
  return items;
}

export function validateAllowanceDeductionRows(rows: readonly Record<string, unknown>[], existingCodes: readonly string[] = []) {
  const items = rows.map((row, index) => ({
    code: code(row, "code", 20, index),
    name: text(row, "name", "항목명", 100, index),
    type: row.type as PayAllowanceDeductionItem["type"],
    tax_type: row.tax_type as PayAllowanceDeductionItem["tax_type"],
    calculation_type: row.calculation_type as string,
    is_active: row.is_active as boolean,
    sort_order: row.sort_order as number,
  }));
  assertUnique(items.map((row) => row.code), existingCodes);
  return items;
}

export function validateSeveranceItemRuleRows(rows: readonly Record<string, unknown>[], existingCodes: readonly string[] = []) {
  const items = rows.map((row, index) => ({
    pay_item_code: code(row, "pay_item_code", 30, index),
    include_type: row.include_type as PaySeveranceItemRuleItem["include_type"],
    note: text(row, "note", "비고", 200, index) || null,
    is_active: row.is_active as boolean,
  }));
  assertUnique(items.map((row) => row.pay_item_code), existingCodes);
  return items;
}
