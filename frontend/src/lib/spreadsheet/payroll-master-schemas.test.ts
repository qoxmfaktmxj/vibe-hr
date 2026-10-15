import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import { parseSpreadsheet, type SpreadsheetColumn } from "@/lib/spreadsheet/workbook";
import {
  ALLOWANCE_DEDUCTION_COLUMNS,
  GL_ACCOUNT_COLUMNS,
  GL_MAPPING_COLUMNS,
  ITEM_GROUP_COLUMNS,
  SEVERANCE_ITEM_RULE_COLUMNS,
  glMappingKey,
  validateAllowanceDeductionRows,
  validateGlAccountRows,
  validateGlMappingRows,
  validateItemGroupRows,
  validateSeveranceItemRuleRows,
} from "@/lib/spreadsheet/payroll-master-schemas";

function workbook(columns: readonly SpreadsheetColumn[], rows: readonly Record<string, unknown>[]): ArrayBuffer {
  const sheet = utils.aoa_to_sheet([
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => row[column.key] ?? null)),
  ]);
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "업로드");
  return write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

type Screen = {
  name: string;
  columns: readonly SpreadsheetColumn[];
  row: Record<string, unknown>;
  codeKey: string;
  key: string;
  validate: (rows: Record<string, unknown>[], existing: string[]) => unknown;
};

const screens: Screen[] = [
  {
    name: "GL accounts",
    columns: GL_ACCOUNT_COLUMNS,
    row: { code: "NEW_GL", name: "급여비용", account_type: "expense", is_net_pay_account: false, is_cash_account: true, is_active: true, sort_order: 10 },
    codeKey: "code",
    key: "NEW_GL",
    validate: validateGlAccountRows,
  },
  {
    name: "GL mappings",
    columns: GL_MAPPING_COLUMNS,
    row: { pay_item_code: "NEW_PAY", gl_account_code: "GL100", effective_from: "2026-10-01", note: "신규 매핑", is_active: true },
    codeKey: "pay_item_code",
    key: "NEW_PAY|2026-10-01",
    validate: (rows, existing) => validateGlMappingRows(rows, ["GL100"], existing),
  },
  {
    name: "item groups",
    columns: ITEM_GROUP_COLUMNS,
    row: { code: "NEW_GROUP", name: "월급제", description: "신규 그룹", is_active: true },
    codeKey: "code",
    key: "NEW_GROUP",
    validate: validateItemGroupRows,
  },
  {
    name: "allowance/deduction items",
    columns: ALLOWANCE_DEDUCTION_COLUMNS,
    row: { code: "NEW_ITEM", name: "기본급", type: "allowance", tax_type: "taxable", calculation_type: "fixed", is_active: true, sort_order: 1 },
    codeKey: "code",
    key: "NEW_ITEM",
    validate: validateAllowanceDeductionRows,
  },
  {
    name: "severance item rules",
    columns: SEVERANCE_ITEM_RULE_COLUMNS,
    row: { pay_item_code: "NEW_RULE", include_type: "prorate_12", note: "상여금", is_active: true },
    codeKey: "pay_item_code",
    key: "NEW_RULE",
    validate: validateSeveranceItemRuleRows,
  },
];

describe.each(screens)("$name XLSX import", (screen) => {
  async function load(rows: Record<string, unknown>[], existing: string[] = []) {
    return screen.validate(await parseSpreadsheet(workbook(screen.columns, rows), screen.columns), existing);
  }

  it("parses a real workbook into the fields saved by the screen", async () => {
    await expect(load([screen.row])).resolves.toEqual([screen.row]);
  });

  it("normalizes the code consistently with Save", async () => {
    const row = { ...screen.row, [screen.codeKey]: ` ${String(screen.row[screen.codeKey]).toLowerCase()} ` };
    await expect(load([row])).resolves.toEqual([screen.row]);
  });

  it("rejects a later invalid row before the file can be applied", async () => {
    const invalid = { ...screen.row, [screen.codeKey]: "" };
    await expect(load([screen.row, invalid])).rejects.toThrow();
  });

  it("rejects duplicate codes in the file after normalization", async () => {
    const duplicate = { ...screen.row, [screen.codeKey]: ` ${String(screen.row[screen.codeKey]).toLowerCase()} ` };
    await expect(load([screen.row, duplicate])).rejects.toThrow("중복");
  });

  it("rejects a code already in a nondeleted grid row", async () => {
    await expect(load([screen.row], [screen.key])).rejects.toThrow("중복");
  });

  it("enforces the server's code length limit", async () => {
    const max = screen.codeKey === "code" ? 20 : 30;
    await expect(load([{ ...screen.row, [screen.codeKey]: "X".repeat(max + 1) }])).rejects.toThrow(`${max}자`);
  });

  it("rejects an invalid boolean instead of treating it as true", async () => {
    await expect(load([{ ...screen.row, is_active: "maybe" }])).rejects.toThrow();
  });
});

describe("payroll master constraints", () => {
  it.each([
    [GL_ACCOUNT_COLUMNS, screens[0].row, "account_type", "invalid"],
    [ALLOWANCE_DEDUCTION_COLUMNS, screens[3].row, "type", "invalid"],
    [ALLOWANCE_DEDUCTION_COLUMNS, screens[3].row, "tax_type", "invalid"],
    [ALLOWANCE_DEDUCTION_COLUMNS, screens[3].row, "calculation_type", "invalid"],
    [SEVERANCE_ITEM_RULE_COLUMNS, screens[4].row, "include_type", "invalid"],
  ] as const)("rejects an unknown enum in %s", async (columns, row, key, value) => {
    await expect(parseSpreadsheet(workbook(columns, [{ ...row, [key]: value }]), columns)).rejects.toThrow();
  });

  it.each([0, 3])("rejects fractional sort order for screen %i", async (index) => {
    const screen = screens[index];
    await expect(parseSpreadsheet(workbook(screen.columns, [{ ...screen.row, sort_order: 1.5 }]), screen.columns)).rejects.toThrow();
  });

  it("validates GL account codes against the loaded lookup", async () => {
    const rows = await parseSpreadsheet(workbook(GL_MAPPING_COLUMNS, [screens[1].row]), GL_MAPPING_COLUMNS);
    expect(() => validateGlMappingRows(rows, ["OTHER"])).toThrow("계정 목록");
  });

  it("allows a new mapping for a different effective date", async () => {
    const rows = await parseSpreadsheet(workbook(GL_MAPPING_COLUMNS, [screens[1].row]), GL_MAPPING_COLUMNS);
    expect(validateGlMappingRows(rows, ["GL100"], ["NEW_PAY|2026-09-01"])).toEqual([screens[1].row]);
    expect(glMappingKey({ pay_item_code: " new_pay ", effective_from: "2026-10-01" })).toBe("NEW_PAY|2026-10-01");
  });

  it("accepts Excel dates and validates impossible dates", async () => {
    const rows = await parseSpreadsheet(workbook(GL_MAPPING_COLUMNS, [{ ...screens[1].row, effective_from: new Date("2026-10-01T00:00:00Z") }]), GL_MAPPING_COLUMNS);
    expect(rows[0].effective_from).toBe("2026-10-01");
    await expect(parseSpreadsheet(workbook(GL_MAPPING_COLUMNS, [{ ...screens[1].row, effective_from: "2026-02-30" }]), GL_MAPPING_COLUMNS)).rejects.toThrow();
  });

  it.each([
    [0, "name", 100],
    [1, "note", 200],
    [2, "description", 200],
    [3, "name", 100],
    [4, "note", 200],
  ] as const)("enforces server text length for screen %i", async (index, key, max) => {
    const screen = screens[index];
    const rows = await parseSpreadsheet(workbook(screen.columns, [{ ...screen.row, [key]: "가".repeat(max + 1) }]), screen.columns);
    expect(() => screen.validate(rows, [])).toThrow(`${max}자`);
  });
});
