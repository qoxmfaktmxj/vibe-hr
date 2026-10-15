import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseSpreadsheet, type SpreadsheetColumn } from "./workbook";

const columns: SpreadsheetColumn[] = [
  { key: "employee_id", label: "사원 ID", type: "integer", required: true, min: 1 },
  { key: "amount", label: "금액", type: "number", required: true, min: 0 },
  { key: "active", label: "사용 여부", type: "boolean", required: true },
  { key: "date", label: "시작일", type: "date", required: true },
  { key: "time", label: "출근시간", type: "time", required: true },
  { key: "note", label: "비고", type: "string", nullable: true },
];

function file(rows: unknown[][], header = columns.map((column) => column.label)): ArrayBuffer {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([header, ...rows]), "template");
  return write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("spreadsheet whole-file parsing", () => {
  it("reads real XLSX bytes with Korean headings and typed values", async () => {
    await expect(parseSpreadsheet(file([[7, "1,234.50", "Y", "2026-10-16", "9:05", ""]]), columns)).resolves.toEqual([
      { employee_id: 7, amount: 1234.5, active: true, date: "2026-10-16", time: "09:05", note: null },
    ]);
  });

  it("accepts canonical headers and Excel serial dates and times", async () => {
    const buffer = file([[7, 10, false, 1, 0.375, "표시"]], columns.map((column) => column.key));
    await expect(parseSpreadsheet(buffer, columns)).resolves.toEqual([
      { employee_id: 7, amount: 10, active: false, date: "1900-01-01", time: "09:00", note: "표시" },
    ]);
  });

  it("rejects a later invalid row instead of returning a partial batch", async () => {
    await expect(parseSpreadsheet(file([[7, 10, "Y", "2026-10-16", "09:00"], [8, "잘못된 금액", "N", "2026-10-16", "09:00"]]), columns)).rejects.toThrow("3행 금액");
  });

  it.each([
    ["date", "2026-02-30"], ["time", "24:01"], ["active", "yes"], ["employee_id", 1.2], ["amount", "1,2"], ["amount", -1],
  ])("rejects invalid %s values", async (key, value) => {
    const row: unknown[] = [7, 10, "Y", "2026-10-16", "09:00", null];
    row[columns.findIndex((column) => column.key === key)] = value;
    await expect(parseSpreadsheet(file([row]), columns)).rejects.toThrow();
  });

  it("rejects missing or duplicated headers and header-only files", async () => {
    await expect(parseSpreadsheet(file([], ["잘못된 양식"]), columns)).rejects.toThrow("열이 없거나 중복");
    await expect(parseSpreadsheet(file([], [...columns.map((column) => column.label), "사원 ID"]), columns)).rejects.toThrow("중복");
    await expect(parseSpreadsheet(file([]), columns)).rejects.toThrow("데이터가 없습니다");
  });

  it("preserves optional defaults and validates enum membership", async () => {
    const fields: SpreadsheetColumn[] = [
      { key: "status", label: "상태", type: "string", required: true, choices: ["active", "leave"] },
      { key: "optional", label: "선택", type: "number" },
    ];
    await expect(parseSpreadsheet(file([["active", null]], ["상태", "선택"]), fields)).resolves.toEqual([{ status: "active" }]);
    await expect(parseSpreadsheet(file([["unknown", null]], ["상태", "선택"]), fields)).rejects.toThrow("허용 값");
  });

  it("preserves leading zeros and date-like string codes in CSV", async () => {
    const csv = new TextEncoder().encode('code,month,amount\n"000123","2026-10",12.5\n');
    await expect(parseSpreadsheet(csv.buffer, [
      { key: "code", label: "코드", type: "string", required: true },
      { key: "month", label: "월", type: "string", required: true },
      { key: "amount", label: "금액", type: "number", required: true },
    ])).resolves.toEqual([{ code: "000123", month: "2026-10", amount: 12.5 }]);
  });

  it("rejects an Excel error in a nullable field instead of clearing its value", async () => {
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([columns.map((column) => column.label), [7, 10, "Y", "2026-10-16", "09:00", null]]);
    sheet.F2 = { t: "e", v: 15 };
    utils.book_append_sheet(workbook, sheet, "template");
    const buffer = write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    await expect(parseSpreadsheet(buffer, columns)).rejects.toThrow("2행 비고: 수식 오류");
  });
});
