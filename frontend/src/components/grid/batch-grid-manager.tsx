"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi } from "ag-grid-community";
import { Copy, Plus, Save } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { SearchTextField } from "@/components/grid/search-controls";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses, type GridStatus } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useUnsavedNavigation } from "@/lib/grid/use-unsaved-navigation";
import { stringifyErrorDetail } from "@/lib/hr/hr-basic";

export type BatchGridRow<T> = T & { _status: GridStatus; _original?: Record<string, unknown>; _prevStatus?: GridStatus };
function DeleteMark({ data, title, disabled, toggle }: { data?: { id: number; _status: GridStatus }; title: string; disabled: boolean; toggle: (id: number, checked: boolean) => boolean }) {
  const checked = data?._status === "deleted";
  const [pending, setPending] = useState<{ source: boolean; value: boolean } | null>(null);
  if (pending && pending.source !== checked) setPending(null);
  if (!data) return null;
  return <input type="checkbox" aria-label={`${title} ${data.id} 삭제 표시`} checked={pending?.source === checked ? pending.value : checked} disabled={disabled}
    onChange={event => { const value = event.target.checked; if (toggle(data.id, value)) setPending({ source: checked, value }); }} />;
}
type Props<T extends { id: number }> = {
  title: string; listUrl: string; saveUrl: string; columns: ColDef<BatchGridRow<T>>[];
  newRow: (id: number) => T; toItem: (row: T) => Record<string, unknown>; validate: (row: T) => string | null;
  canQuery?: boolean; canSave: boolean; createDisabled?: boolean;
  searchText: (row: T) => string; searchPlaceholder: string; beforeGrid?: ReactNode;
  copyRow?: (row: T, id: number) => T;
  detailComponent?: ComponentType<{ row: BatchGridRow<T>; change: (patch: Partial<T>) => void; disabled: boolean }>;
};

export function BatchGridManager<T extends { id: number }>({ title, listUrl, saveUrl, columns, newRow, toItem, validate, canQuery = true, canSave, createDisabled = false, searchText, searchPlaceholder, beforeGrid, copyRow, detailComponent: DetailComponent }: Props<T>) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ items: T[]; total_count: number }>(canQuery ? listUrl : null, fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });
  const [working, setWorking] = useState<BatchGridRow<T>[] | null>(null);
  const cleanRows = useCallback((items: T[]): BatchGridRow<T>[] => items.map(item => ({ ...item, _status: "clean", _original: structuredClone(toItem(item)) })), [toItem]);
  const rows = useMemo(() => working ?? cleanRows(data?.items ?? []), [cleanRows, data, working]);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const api = useRef<GridApi<BatchGridRow<T>> | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const nextId = useRef(-1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const locked = saving || isLoading || isValidating;
  const shouldBeClean = useCallback((row: BatchGridRow<T>) => JSON.stringify(toItem(row)) === JSON.stringify(row._original), [toItem]);
  const commit = useCallback((next: BatchGridRow<T>[]) => { rowsRef.current = next; setWorking(next); setNotice(null); }, []);
  const dirty = useCallback(() => { api.current?.stopEditing(); return rowsRef.current.some(row => row._status !== "clean"); }, []);
  const blocked = useCallback(() => inFlight.current, []);
  const { requestLeave, dialog } = useUnsavedNavigation(dirty, blocked);
  const summary = summarizeGridStatuses(rows, row => row._status);
  const changed = summary.added + summary.updated + summary.deleted;
  const filtered = rows.filter(row => !appliedQuery || searchText(row).toLowerCase().includes(appliedQuery.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 50)));
  const pagination = useGridPagination({ page: currentPage, totalCount: filtered.length, pageSize: 50, onPageChange: next => requestLeave(() => { setWorking(null); setPage(next); }) });
  const selected = rows.find(row => row.id === selectedId) ?? rows[0] ?? null;
  const rowClassRules = useMemo(() => buildGridRowClassRules<BatchGridRow<T>>(), []);
  const columnDefs = useMemo<ColDef<BatchGridRow<T>>[]>(() => [
    { colId: "delete", headerName: "삭제", width: 64, minWidth: 64, pinned: "left", editable: false, sortable: false, filter: false,
      cellRenderer: DeleteMark, cellRendererParams: { title, disabled: !canSave || locked, toggle: (id: number, checked: boolean) => { if (!canSave || inFlight.current) return false; commit(toggleDeletedStatus(rowsRef.current, id, checked, { removeAddedRow: true, shouldBeClean })); return true; } } },
    { colId: "status", headerName: "변경", width: 70, minWidth: 70, editable: false, valueGetter: ({ data: row }) => ({ clean: "", added: "입력", updated: "수정", deleted: "삭제" })[row?._status ?? "clean"] },
    ...columns.map(column => ({ ...column, editable: column.editable === false ? false : (params: Parameters<Exclude<ColDef<BatchGridRow<T>>["editable"], boolean | undefined>>[0]) => canSave && !locked && params.data?._status !== "deleted" && (typeof column.editable === "function" ? column.editable(params) : true) })),
  ], [canSave, columns, commit, locked, shouldBeClean, title]);
  const defaultColDef = useMemo<ColDef<BatchGridRow<T>>>(() => ({ minWidth: 80, resizable: true, sortable: true, filter: true, cellClass: params => getGridStatusCellClass(params.data?._status) }), []);

  function changeRow(id: number, patch: Partial<T>) {
    if (!canSave || locked) return;
    commit(rowsRef.current.map(row => row.id === id ? reconcileUpdatedStatus({ ...row, ...patch }, { shouldBeClean }) : row));
  }
  function add(row: T) {
    api.current?.stopEditing();
    commit([{ ...row, _status: "added" }, ...rowsRef.current]);
    setSelectedId(row.id); setPage(1); setAppliedQuery(""); setQuery("");
  }
  function reload() {
    if (!canQuery || locked) return;
    requestLeave(() => { setWorking(null); setAppliedQuery(query.trim()); setPage(1); setNotice(null); void mutate(); });
  }
  async function save() {
    if (!canSave || inFlight.current || isValidating) return;
    api.current?.stopEditing();
    const edits = rowsRef.current.filter(row => row._status !== "clean");
    if (!edits.length) return;
    const changes = summarizeGridStatuses(edits, row => row._status);
    for (const row of edits.filter(item => item._status !== "deleted")) {
      const message = validate(row);
      if (message) { setNotice({ error: true, text: message }); setSelectedId(row.id); return; }
    }
    inFlight.current = true; setSaving(true); setNotice(null);
    try {
      const response = await fetch(saveUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: edits.filter(row => row._status !== "deleted").map(row => ({ ...toItem(row), id: row._status === "added" ? null : row.id })), delete_ids: edits.filter(row => row._status === "deleted").map(row => row.id) }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(stringifyErrorDetail(body) ?? "저장에 실패했습니다.");
      if (!Array.isArray(body?.items)) throw new Error("저장 응답을 확인하지 못했습니다. 입력 내용은 유지됩니다.");
      await mutate(body, { revalidate: false });
      const saved = cleanRows(body.items); rowsRef.current = saved; setWorking(saved); setPage(1);
      setNotice({ error: false, text: `저장 완료: 입력 ${changes.added}건, 수정 ${changes.updated}건, 삭제 ${changes.deleted}건` });
    } catch (failure) { setNotice({ error: true, text: failure instanceof Error ? failure.message : "저장에 실패했습니다. 입력 내용은 유지됩니다." }); }
    finally { inFlight.current = false; setSaving(false); }
  }

  return <section aria-label={title} className="min-w-0">
    <ManagerPageShell className="h-auto min-w-0 gap-3 p-0 md:p-0">
      <ManagerSearchSection title={title} onQuery={reload} queryDisabled={!canQuery || locked} queryButtonClassName="h-9" className="business-search"><SearchTextField value={query} onChange={setQuery} placeholder={searchPlaceholder} onKeyDown={event => { if (event.key === "Enter") reload(); }} /></ManagerSearchSection>
      {beforeGrid}
      {(!canQuery || error) && <p role="alert" className="text-sm text-destructive">{!canQuery ? "조회 권한이 없습니다." : "목록을 불러오지 못했습니다. 조회를 눌러 다시 시도해 주세요."}</p>}
      {notice && <p role={notice.error ? "alert" : "status"} className={`text-sm ${notice.error ? "text-destructive" : "text-muted-foreground"}`}>{notice.text}</p>}
      <ManagerGridSection className="shadow-none" headerClassName="flex-wrap [&>div:first-child]:flex-wrap" headerLeft={<><GridPaginationControls page={currentPage} totalPages={pagination.totalPages} pageInput={pagination.pageInput} setPageInput={pagination.setPageInput} goPrev={pagination.goPrev} goNext={pagination.goNext} goToPage={pagination.goToPage} disabled={locked} className="mt-0" /><span className="whitespace-nowrap text-xs text-muted-foreground">총 {filtered.length}건</span><GridChangeSummaryBadges summary={summary} /></>} headerRight={<GridToolbarActions actions={canSave ? [{ key: "create", label: "입력", icon: Plus, onClick: () => add(newRow(nextId.current--)), disabled: locked || createDisabled }, ...(copyRow ? [{ key: "copy", label: "복사", icon: Copy, onClick: () => { if (selected) add(copyRow(selected, nextId.current--)); }, disabled: locked || !selected || selected._status === "deleted" }] : [])] : []} saveAction={canSave ? { key: "save", label: saving ? "저장 중..." : changed ? `변경 ${changed}건 저장` : "저장", icon: Save, onClick: () => void save(), disabled: locked || !changed } : undefined} />}>
        <div className="ag-theme-quartz vibe-grid h-[360px] min-w-0 border-t border-border"><AgGridReact<BatchGridRow<T>> theme="legacy" rowData={filtered.slice((currentPage - 1) * 50, currentPage * 50)} columnDefs={columnDefs} defaultColDef={defaultColDef} getRowId={params => String(params.data.id)} rowClassRules={rowClassRules} getRowClass={params => getGridRowClass(params.data?._status)} onGridReady={event => { api.current = event.api; }} onGridPreDestroyed={() => { api.current = null; }} onCellValueChanged={event => { if (event.data) changeRow(event.data.id, event.data); }} onRowClicked={event => { if (event.data) setSelectedId(event.data.id); }} onCellKeyDown={event => { if (event.data && (event.event as KeyboardEvent)?.key === "Enter") setSelectedId(event.data.id); }} loading={isLoading} singleClickEdit={false} animateRows={false} rowHeight={34} headerHeight={36} overlayNoRowsTemplate="<span>조회된 항목이 없습니다.</span>" /></div>
      </ManagerGridSection>
      {selected && DetailComponent && <DetailComponent row={selected} change={patch => changeRow(selected.id, patch)} disabled={!canSave || locked || selected._status === "deleted"} />}
      {dialog}
    </ManagerPageShell>
  </section>;
}
