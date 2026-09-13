"use client";

import { useCallback, useEffect, useState } from "react";
import { useGridFilter, type CustomFilterProps } from "ag-grid-react";
import type { IDoesFilterPassParams } from "ag-grid-community";

export function CheckListFilter({ model, onModelChange, api, getValue, column }: CustomFilterProps<unknown, unknown, string[]> ) {
  const [query, setQuery] = useState("");
  const readValues = useCallback(() => {
    const found = new Map<string, string>();
    api.forEachNode((node) => { const value = getValue(node); found.set(String(value ?? ""), String(api.getCellValue({ rowNode: node, colKey: column, useFormatter: true }) ?? "(빈 값)")); });
    return [...found.entries()].sort((a, b) => a[1].localeCompare(b[1], "ko"));
  }, [api, getValue, column]);
  const [values, setValues] = useState(readValues);
  const refreshValues = useCallback(() => setValues(readValues()), [readValues]);
  useEffect(() => { api.addEventListener("rowDataUpdated", refreshValues); return () => api.removeEventListener("rowDataUpdated", refreshValues); }, [api, refreshValues]);
  const doesFilterPass = useCallback(({ node }: IDoesFilterPassParams) => model === null || model.includes(String(getValue(node) ?? "")), [model, getValue]);
  useGridFilter({ doesFilterPass, afterGuiAttached: refreshValues });
  const visible = values.filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()));
  return <div className="w-60 space-y-3 p-3">
    <p className="text-xs text-muted-foreground">현재 페이지 값에서 선택</p>
    <input aria-label="필터 값 검색" placeholder="값 검색" className="h-8 w-full rounded border px-2" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="flex gap-3 text-xs"><button type="button" onClick={() => onModelChange(null)}>전체 선택</button><button type="button" onClick={() => onModelChange([])}>전체 해제</button></div>
    <div className="max-h-56 space-y-2 overflow-y-auto">{visible.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={model === null || model.includes(value)} onChange={(event) => { const selected = new Set(model ?? values.map(([key]) => key)); if (event.target.checked) selected.add(value); else selected.delete(value); onModelChange(selected.size === values.length ? null : [...selected]); }} />{label}</label>)}</div>
    {!visible.length && <p className="text-sm">일치하는 값이 없습니다.</p>}
  </div>;
}
