export type CellPoint = { row: number; column: number };
export type CellRange = { start: CellPoint; end: CellPoint };

export function serializeClipboardTable(rows: string[][]): string {
  return rows.map((row) => row.map((value) => /[\t\r\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join("\t")).join("\r\n");
}

export function fillSeries(values: string[], index: number): string {
  if (index < values.length) return values[index];
  const dates = values.map((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN);
  if (dates.every(Number.isFinite)) return new Date(dates[0] + index * (dates.length > 1 ? dates[1] - dates[0] : 86400000)).toISOString().slice(0, 10);
  if (values.length > 1 && values.every((value) => /^-?\d+(\.\d+)?$/.test(value))) return String(Number(values[0]) + index * (Number(values[1]) - Number(values[0])));
  return values[index % values.length];
}

export function rangeBounds(range: CellRange) {
  return { top: Math.min(range.start.row, range.end.row), bottom: Math.max(range.start.row, range.end.row), left: Math.min(range.start.column, range.end.column), right: Math.max(range.start.column, range.end.column) };
}

// Excel quotes fields containing tabs/newlines and escapes quotes by doubling them.
export function parseClipboardTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && (quoted || value === "")) {
      if (quoted && input[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === "\t" || char === "\n")) {
      row.push(value); value = "";
      if (char === "\n") { rows.push(row); row = []; }
    } else value += char;
  }
  if (quoted) throw new Error("복사한 값의 따옴표가 닫히지 않았습니다.");
  if (value || row.length || !input.endsWith("\n")) rows.push([...row, value]);
  if (!rows.length || rows.some((item) => item.length !== rows[0].length)) throw new Error("복사한 데이터의 열 수가 일정하지 않습니다.");
  return rows;
}

export function planRangePaste(table: string[][], range: CellRange, rowCount: number, columnCount: number) {
  const { top, bottom, left, right } = rangeBounds(range);
  const selectedRows = bottom - top + 1, selectedColumns = right - left + 1;
  const fill = table.length === 1 && table[0].length === 1;
  const anchorOnly = selectedRows === 1 && selectedColumns === 1;
  if (!fill && !anchorOnly && (table.length !== selectedRows || table[0].length !== selectedColumns)) {
    throw new Error("선택 범위와 복사한 데이터의 크기가 다릅니다. 시작 셀 하나를 선택하거나 같은 크기의 범위를 선택하세요.");
  }
  const height = fill ? selectedRows : table.length, width = fill ? selectedColumns : table[0].length;
  if (top < 0 || left < 0 || top + height > rowCount || left + width > columnCount) {
    throw new Error("현재 페이지의 행 또는 표시된 열을 벗어납니다. 필요한 행을 입력 버튼으로 추가하거나 열 보기를 조정하세요.");
  }
  return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => ({ row: top + r, column: left + c, text: fill ? table[0][0] : table[r][c] }))).flat();
}
