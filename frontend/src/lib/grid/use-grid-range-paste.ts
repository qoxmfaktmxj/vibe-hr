"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type RefObject } from "react";
import type { CellClassParams, CellFocusedEvent, CellMouseDownEvent, CellMouseOverEvent, GridApi } from "ag-grid-community";
import { parseClipboardTable, planRangePaste, rangeBounds, serializeClipboardTable, fillSeries, type CellRange } from "./range-paste";

export type RangePasteChange = { id: string; field: string; value: unknown };

export function useGridRangePaste<T>({ apiRef, enabled, parseValue, applyChanges }: {
  apiRef: RefObject<GridApi<T> | null>;
  enabled: boolean;
  parseValue: (field: string, text: string, row: T) => unknown;
  applyChanges: (changes: RangePasteChange[]) => void;
}) {
  const selection = useRef<CellRange | null>(null);
  const dragging = useRef(false);
  const fillSeed = useRef<{ range: CellRange; table: string[][] } | null>(null);
  const [summary, setSummary] = useState("선택한 셀이 없습니다.");
  const [message, setMessage] = useState("");
  const columns = useCallback(() => apiRef.current?.getAllDisplayedColumns().filter((column) => {
    const field = column.getColDef().field;
    return field && !field.startsWith("_");
  }) ?? [], [apiRef]);
  const selectedTable = useCallback(() => {
    const api = apiRef.current;
    if (!api || !selection.current) return [];
    const { top, bottom, left, right } = rangeBounds(selection.current);
    return Array.from({ length: bottom - top + 1 }, (_, r) => columns().slice(left, right + 1).map((column) => {
      const node = api.getDisplayedRowAtIndex(top + r);
      if (!node || column.getColDef().field === "password") return "";
      return String(api.getCellValue({ rowNode: node, colKey: column, useFormatter: true }) ?? "");
    }));
  }, [apiRef, columns]);
  const paint = useCallback(() => {
    const api = apiRef.current;
    if (api && !api.isDestroyed()) {
      api.refreshCells({ force: true });
      if (!selection.current) { setSummary("선택한 셀이 없습니다."); return; }
      const cells = selectedTable().flat();
      const { top, bottom, left, right } = rangeBounds(selection.current);
      const numbers: number[] = [];
      for (let r = top; r <= bottom; r++) for (const column of columns().slice(left, right + 1)) {
        const field = column.getColDef().field ?? "";
        const node = api.getDisplayedRowAtIndex(r);
        const value = node ? api.getCellValue({ rowNode: node, colKey: column }) : null;
        if (typeof value === "number" && Number.isFinite(value) && field !== "id" && !field.endsWith("_id")) numbers.push(value);
      }
      const sum = numbers.reduce((a, b) => a + b, 0);
      setSummary(`선택 ${cells.length}셀 / 값 ${cells.filter(Boolean).length}개 / 숫자 ${numbers.length}개 / 합계 ${numbers.length ? sum.toLocaleString() : "-"} / 평균 ${numbers.length ? (sum / numbers.length).toLocaleString() : "-"}`);
    }
  }, [apiRef, selectedTable, columns]);
  const clear = useCallback(() => { selection.current = null; dragging.current = false; fillSeed.current = null; paint(); }, [paint]);
  const onCellMouseDown = useCallback((event: CellMouseDownEvent<T>) => {
    const mouse = event.event as MouseEvent | undefined;
    if (!mouse || ![0, 2].includes(mouse.button) || event.rowIndex === null || event.node.rowPinned) return;
    if ((mouse.target as HTMLElement).closest("input,button,select,textarea,[contenteditable=true]")) return;
    const column = columns().findIndex((item) => item.getColId() === event.column.getColId());
    if (column < 0) { clear(); return; }
    const point = { row: event.rowIndex, column };
    if (mouse.button === 2) {
      const bounds = selection.current ? rangeBounds(selection.current) : null;
      if (!bounds || point.row < bounds.top || point.row > bounds.bottom || point.column < bounds.left || point.column > bounds.right) selection.current = { start: point, end: point };
      dragging.current = false; apiRef.current?.setFocusedCell(event.rowIndex, event.column); paint(); return;
    }
    const cell = (mouse.target as HTMLElement).closest(".ag-cell");
    const rect = cell?.getBoundingClientRect();
    if (enabled && selection.current && cell?.classList.contains("vibe-range-end") && rect && mouse.clientX >= rect.right - 12 && mouse.clientY >= rect.bottom - 12) {
      const bounds = rangeBounds(selection.current);
      selection.current = { start: { row: bounds.top, column: bounds.left }, end: { row: bounds.bottom, column: bounds.right } };
      fillSeed.current = { range: selection.current, table: selectedTable() };
      dragging.current = true;
      return;
    }
    fillSeed.current = null;
    selection.current = { start: mouse.shiftKey && selection.current ? selection.current.start : point, end: point };
    dragging.current = mouse.detail < 2;
    paint();
  }, [clear, columns, paint, enabled, selectedTable, apiRef]);
  const onCellMouseOver = useCallback((event: CellMouseOverEvent<T>) => {
    if (((event.event as MouseEvent | undefined)?.buttons ?? 0) !== 1) { dragging.current = false; return; }
    if (!dragging.current || !selection.current || event.rowIndex === null || event.node.rowPinned) return;
    const column = columns().findIndex((item) => item.getColId() === event.column.getColId());
    if (column < 0) return;
    selection.current = { ...selection.current, end: { row: event.rowIndex, column } };
    paint();
  }, [columns, paint]);
  const onCellFocused = useCallback((event: CellFocusedEvent<T>) => {
    if (dragging.current || selection.current || event.rowIndex === null) return;
    const columnId = typeof event.column === "string" ? event.column : event.column?.getColId();
    const column = columns().findIndex((item) => item.getColId() === columnId);
    selection.current = event.rowIndex !== null && column >= 0 ? { start: { row: event.rowIndex, column }, end: { row: event.rowIndex, column } } : null;
    paint();
  }, [columns, paint]);
  const isSelected = useCallback((params: CellClassParams<T>) => {
    if (!selection.current || params.node.rowIndex === null) return false;
    const { top, bottom, left, right } = rangeBounds(selection.current);
    const column = columns().findIndex((item) => item.getColId() === params.column.getColId());
    return params.node.rowIndex >= top && params.node.rowIndex <= bottom && column >= left && column <= right;
  }, [columns]);
  const pasteText = useCallback((text: string) => {
    const api = apiRef.current;
    if (!enabled || !api || api.isDestroyed()) { setMessage("현재 붙여넣기를 할 수 없습니다. 저장 권한과 로딩 상태를 확인하세요."); return; }
    if (!selection.current) { setMessage("붙여넣을 시작 셀 또는 범위를 먼저 선택하세요."); return; }
    try {
      const visibleColumns = columns();
      const table = parseClipboardTable(text);
      const targets = planRangePaste(table, selection.current, api.getDisplayedRowCount(), visibleColumns.length);
      const changes: RangePasteChange[] = [];
      let locked = 0;
      for (const target of targets) {
        const node = api.getDisplayedRowAtIndex(target.row), column = visibleColumns[target.column];
        if (!node?.data || node.id === undefined) throw new Error("목록이 변경되었습니다. 범위를 다시 선택하세요.");
        if (!column.isCellEditable(node)) { locked++; continue; }
        const field = column.getColDef().field!;
        try { changes.push({ id: node.id, field, value: parseValue(field, target.text, node.data) }); }
        catch (error) { throw new Error(`${target.row + 1}행 ${column.getColDef().headerName ?? field}: ${error instanceof Error ? error.message : "값을 확인하세요."}`); }
      }
      // Resolve every target and validate every value before mutating any row.
      if (changes.length) applyChanges(changes);
      clear();
      setMessage(`${changes.length}개 셀에 붙여넣었습니다.${locked ? ` 잠금 셀 ${locked}개는 유지했습니다.` : ""} 저장 버튼을 눌러 반영하세요.`);
    } catch (error) { setMessage(`${error instanceof Error ? error.message : "붙여넣기에 실패했습니다."} 변경하지 않았습니다.`); }
  }, [apiRef, enabled, columns, parseValue, applyChanges, clear]);
  const onPaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
    if (!(event.target as HTMLElement).closest(".ag-cell") || !event.clipboardData.types.includes("text/plain")) return;
    event.preventDefault(); event.stopPropagation(); pasteText(event.clipboardData.getData("text/plain"));
  }, [pasteText]);
  const onCopy = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("input,textarea,[contenteditable=true]")) return;
    if (!selection.current) return;
    event.preventDefault(); event.clipboardData.setData("text/plain", serializeClipboardTable(selectedTable()));
    setMessage("선택 범위를 복사했습니다. 비밀번호 입력 값은 복사하지 않습니다.");
  }, [selectedTable]);
  const copy = useCallback(async () => {
    if (!selection.current) { setMessage("복사할 범위를 선택하세요."); return; }
    try { await navigator.clipboard.writeText(serializeClipboardTable(selectedTable())); setMessage("선택 범위를 복사했습니다. 비밀번호 입력 값은 복사하지 않습니다."); }
    catch { setMessage("클립보드 접근이 허용되지 않았습니다. 표에서 Ctrl+C를 사용하세요."); }
  }, [selectedTable]);
  const paste = useCallback(async () => {
    try { pasteText(await navigator.clipboard.readText()); }
    catch { setMessage("클립보드 접근이 허용되지 않았습니다. 표에서 Ctrl+V를 사용하세요."); }
  }, [pasteText]);
  const finishFill = useCallback(() => {
    dragging.current = false;
    const seed = fillSeed.current; fillSeed.current = null;
    if (!seed || !selection.current || !seed.table.length) return;
    const before = rangeBounds(seed.range), after = rangeBounds(selection.current);
    if (columns().slice(before.left, before.right + 1).some((column) => column.getColDef().field === "password")) { setMessage("비밀번호 입력 열은 자동 채우기를 지원하지 않습니다."); clear(); return; }
    if (after.top !== before.top || after.left !== before.left || (after.right !== before.right && after.bottom !== before.bottom)) { setMessage("자동 채우기는 아래 또는 오른쪽 한 방향으로 드래그하세요."); clear(); return; }
    const vertical = after.bottom !== before.bottom;
    const table = Array.from({ length: after.bottom - after.top + 1 }, (_, r) => Array.from({ length: after.right - after.left + 1 }, (_, c) => vertical ? fillSeries(seed.table.map((row) => row[c]), r) : fillSeries(seed.table[r], c)));
    pasteText(serializeClipboardTable(table));
  }, [pasteText, clear, columns]);
  useEffect(() => {
    window.addEventListener("mouseup", finishFill, true);
    const blur = () => { dragging.current = false; fillSeed.current = null; };
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("mouseup", finishFill, true); window.removeEventListener("blur", blur); };
  }, [finishFill]);
  const isEnd = useCallback((params: CellClassParams<T>) => {
    if (!enabled || !selection.current || !isSelected(params)) return false;
    const bounds = rangeBounds(selection.current);
    return params.node.rowIndex === bounds.bottom && params.column.getColId() === columns()[bounds.right]?.getColId();
  }, [enabled, isSelected, columns]);
  return { onCellMouseDown, onCellMouseOver, onCellFocused, isSelected, isEnd, onPaste, onCopy, copy, paste, clear, message, summary };

}
