import { describe, expect, it } from "vitest";
import { fillSeries, parseClipboardTable, planRangePaste, serializeClipboardTable } from "./range-paste";
import { parseEmployeePasteValue } from "../hr/employee-paste";

describe("clipboard range mapping", () => {
  it("round trips selected text and extends date, numeric and repeated values", () => {
    const values = [['a\tb', 'say "yes"'], ['new\nline', '']];
    expect(parseClipboardTable(serializeClipboardTable(values))).toEqual(values);
    expect(fillSeries(['2024-02-28'], 1)).toBe('2024-02-29');
    expect(fillSeries(['2024-02-28'], 2)).toBe('2024-03-01');
    expect(fillSeries(['2', '4'], 3)).toBe('8');
    expect(fillSeries(['팀장'], 3)).toBe('팀장');
  });
  it("preserves blanks, quoted tabs/newlines and escaped quotes without adding a trailing row", () => {
    expect(parseClipboardTable('a\t\t"b\tc"\r\n"d\ne"\t"say ""hi"""\t\r\n')).toEqual([["a", "", "b\tc"], ["d\ne", 'say "hi"', ""]]);
    expect(parseClipboardTable("\t\n")).toEqual([["", ""]]);
  });
  it("rejects malformed tables", () => {
    expect(() => parseClipboardTable('"open')).toThrow();
    expect(() => parseClipboardTable("a\tb\nc")).toThrow();
  });
  it("fills a reverse-selected rectangle with a scalar", () => {
    const cells = planRangePaste([["x"]], { start: { row: 2, column: 2 }, end: { row: 1, column: 1 } }, 3, 3);
    expect(cells).toEqual([{ row: 1, column: 1, text: "x" }, { row: 1, column: 2, text: "x" }, { row: 2, column: 1, text: "x" }, { row: 2, column: 2, text: "x" }]);
  });
  it("expands an anchor and does not compress source positions", () => {
    expect(planRangePaste([["locked", "name"]], { start: { row: 1, column: 0 }, end: { row: 1, column: 0 } }, 3, 3)).toEqual([{ row: 1, column: 0, text: "locked" }, { row: 1, column: 1, text: "name" }]);
  });
  it("rejects mismatch and overflow rather than silently truncating", () => {
    const range = { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } };
    expect(() => planRangePaste([["a", "b"]], range, 3, 3)).toThrow(/크기/);
    expect(() => planRangePaste([["a"]], range, 1, 1)).toThrow(/벗어/);
  });
});

describe("employee pasted values", () => {
  const departments = [{ id: 1, code: "HR", name: "인사부" }];
  const parse = (field: string, text: string) => parseEmployeePasteValue(field, text, departments, ["팀장", "사원"]);
  it("resolves department labels, codes and IDs and validates choices", () => {
    for (const name of ["인사부", "hr", "1"]) expect(parse("department_id", name)).toBe(1);
    expect(() => parse("department_id", "없는부서")).toThrow();
    expect(parse("employment_status", "휴직")).toBe("leave");
    expect(() => parse("employment_status", "모름")).toThrow();
    expect(parse("is_active", "N")).toBe(false);
    expect(() => parse("is_active", "모름")).toThrow();
    expect(() => parse("position_title", "없는직책")).toThrow();
  });
  it("rejects impossible dates and invalid names without coercing", () => {
    expect(parse("hire_date", "2024-02-29")).toBe("2024-02-29");
    for (const value of ["2025-02-29", "2025-13-01", "2025-2-1", ""]) expect(() => parse("hire_date", value)).toThrow();
    expect(() => parse("display_name", " ")).toThrow();
    expect(parse("email", "")).toBe("");
    expect(parse("password", " a ")).toBe(" a ");
  });
});
