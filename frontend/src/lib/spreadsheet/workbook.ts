export type SpreadsheetColumn = {
  key: string;
  label: string;
  type: "string" | "number" | "integer" | "boolean" | "date" | "time";
  required?: boolean;
  nullable?: boolean;
  choices?: readonly (string | number)[];
  min?: number;
  max?: number;
};

function invalid(row: number, column: SpreadsheetColumn, reason: string): never {
  throw new Error(`${row}행 ${column.label}: ${reason}`);
}

function clock(value: unknown): string | null {
  const text = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::00)?$/.exec(text);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export async function parseSpreadsheet(
  buffer: ArrayBuffer,
  columns: readonly SpreadsheetColumn[],
): Promise<Record<string, unknown>[]> {
  const { read, utils, SSF } = await import("xlsx");
  const workbook = read(buffer, { type: "array", cellDates: false, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("첫 번째 시트가 없습니다.");
  const table = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
  const range = utils.decode_range(sheet["!ref"] ?? "A1");
  const header = (table[0] ?? []).map((value) => String(value ?? "").trim());
  const indices = columns.map((column) => {
    const matches = header.flatMap((name, index) => name === column.key || name === column.label ? [index] : []);
    if (matches.length !== 1) throw new Error(`${column.label} 열이 없거나 중복되었습니다. 다운로드한 양식을 사용해주세요.`);
    return matches[0];
  });

  const result: Record<string, unknown>[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const cell = sheet[utils.encode_cell({ r: range.s.r + index, c: range.s.c + indices[columnIndex] })];
      if (cell?.t === "e" || (cell?.f && cell.v == null)) invalid(range.s.r + index + 1, columns[columnIndex], "수식 오류가 있거나 계산 결과가 없습니다. 값을 확인해주세요.");
    }
    if (!cells.some((value) => value !== null && value !== undefined && String(value).trim() !== "")) continue;
    const record: Record<string, unknown> = {};
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex];
      const raw = cells[indices[columnIndex]];
      const text = String(raw ?? "").trim();
      if (text === "") {
        if (column.required) invalid(index + 1, column, "필수 값입니다.");
        if (column.nullable) record[column.key] = null;
        continue;
      }
      let value: string | number | boolean;
      if (column.type === "number" || column.type === "integer") {
        const numericText = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text) ? text.replaceAll(",", "") : text;
        if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(numericText)) invalid(index + 1, column, "숫자를 입력해주세요.");
        value = Number(numericText);
        if (!Number.isFinite(value) || (column.type === "integer" && !Number.isSafeInteger(value))) invalid(index + 1, column, "올바른 숫자를 입력해주세요.");
        if (column.min !== undefined && value < column.min) invalid(index + 1, column, `${column.min} 이상이어야 합니다.`);
        if (column.max !== undefined && value > column.max) invalid(index + 1, column, `${column.max} 이하여야 합니다.`);
      } else if (column.type === "boolean") {
        const normalized = text.toUpperCase();
        if (!["TRUE", "FALSE", "Y", "N", "1", "0"].includes(normalized)) invalid(index + 1, column, "Y 또는 N을 입력해주세요.");
        value = ["TRUE", "Y", "1"].includes(normalized);
      } else if (column.type === "date") {
        const excel = typeof raw === "number" ? SSF.parse_date_code(raw, { date1904: workbook.Workbook?.WBProps?.date1904 }) : null;
        value = excel ? `${String(excel.y).padStart(4, "0")}-${String(excel.m).padStart(2, "0")}-${String(excel.d).padStart(2, "0")}` : text;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) invalid(index + 1, column, "YYYY-MM-DD 형식의 실제 날짜를 입력해주세요.");
      } else if (column.type === "time") {
        const excel = typeof raw === "number" && raw >= 0 && raw < 1 ? SSF.parse_date_code(raw) : null;
        const parsed = clock(excel ? `${excel.H}:${String(excel.M).padStart(2, "0")}${excel.S ? ":invalid" : ""}` : text);
        if (!parsed) invalid(index + 1, column, "HH:MM 형식의 시간을 입력해주세요.");
        value = parsed;
      } else {
        value = text;
      }
      if (column.choices && !column.choices.includes(value as string | number)) invalid(index + 1, column, `허용 값: ${column.choices.join(", ")}`);
      record[column.key] = value;
    }
    result.push(record);
  }
  if (result.length === 0) throw new Error("업로드할 데이터가 없습니다.");
  return result;
}

export async function readSpreadsheet(
  file: Pick<File, "arrayBuffer">,
  columns: readonly SpreadsheetColumn[],
): Promise<Record<string, unknown>[]> {
  return parseSpreadsheet(await file.arrayBuffer(), columns);
}

export async function downloadSpreadsheet(
  filename: string,
  columns: readonly SpreadsheetColumn[],
  rows: readonly object[],
  sheetName = "data",
): Promise<void> {
  const { utils, writeFileXLSX } = await import("xlsx");
  const values = rows.map((row) => columns.map((column) => {
    const value = (row as Record<string, unknown>)[column.key];
    if (typeof value === "boolean") return value ? "Y" : "N";
    return value ?? "";
  }));
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([columns.map((column) => column.label), ...values]), sheetName);
  writeFileXLSX(workbook, filename);
}

export function pickSpreadsheetFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.hidden = true;
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
