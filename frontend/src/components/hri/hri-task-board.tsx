"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ColDef, GridApi } from "ag-grid-community";
import { Check, Download, X } from "lucide-react";
import useSWR from "swr";
import { ReadonlyGridManager, createReadonlyGridRows, type ReadonlyGridRow } from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { HriTaskItem, HriTaskListResponse } from "@/types/hri";

type TaskRow = HriTaskItem & ReadonlyGridRow;
type Action = "approve" | "reject" | "receive-complete" | "receive-reject";
const STATUS_LABELS: Record<string, string> = { APPROVAL_IN_PROGRESS: "결재 진행중", RECEIVE_IN_PROGRESS: "수신 진행중" };
const STEP_LABELS: Record<string, string> = { APPROVAL: "결재", RECEIVE: "수신", REFERENCE: "참조" };

export function HriTaskBoard({ kind }: { kind: "approvals" | "receives" }) {
  const approval = kind === "approvals";
  const title = approval ? "결재함" : "수신함";
  const primaryAction: Action = approval ? "approve" : "receive-complete";
  const rejectAction: Action = approval ? "reject" : "receive-reject";
  const primaryLabel = approval ? "승인" : "수신 완료";
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<TaskRow[]>([]);
  const [pending, setPending] = useState<{ action: Action; rows: TaskRow[]; comment: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const acting = useRef(false);
  const gridApi = useRef<GridApi<TaskRow> | null>(null);
  const [result, setResult] = useState<{ summary: string; failures: string[] } | null>(null);
  const pageSize = 50;
  const query = `/api/hri/tasks/my-${kind}?page=${page}&limit=${pageSize}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<HriTaskListResponse>(query, fetcher, { revalidateOnFocus: false });
  const rows = useMemo(() => {
    const value = appliedKeyword.trim().toLowerCase();
    return createReadonlyGridRows((data?.items ?? [])
      .filter((row) => !value || [row.request_no, row.title, row.form_name ?? ""].some((text) => text.toLowerCase().includes(value)))
      .map((row) => ({ ...row, id: `${row.request_id}:${row.step_type}:${row.step_order}` })));
  }, [data, appliedKeyword]);
  const locked = busy || pending !== null || isValidating;
  const eligible = useCallback((row: TaskRow) => row.step_type === (approval ? "APPROVAL" : "RECEIVE")
    && row.status_code === (approval ? "APPROVAL_IN_PROGRESS" : "RECEIVE_IN_PROGRESS"), [approval]);
  const selectedRows = selected.filter((row) => rows.some((current) => current.id === row.id) && eligible(row));

  function prepare(action: Action, targets: TaskRow[]) {
    if (acting.current || locked || targets.length === 0) return;
    const unique = Array.from(new Map(targets.map((row) => [row.request_id, row])).values());
    setPending({ action, rows: unique, comment: comment.trim() });
  }

  async function confirmAction() {
    if (!pending || acting.current) return;
    acting.current = true;
    setBusy(true);
    const failures: string[] = [];
    let succeeded = 0;
    // Each document keeps the existing server-side actor, state, order and transaction checks.
    for (const row of pending.rows) {
      try {
        const response = await fetch(`/api/hri/requests/${row.request_id}/${pending.action}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: pending.comment.trim() || null }),
        });
        const body = await response.json().catch(() => null) as { detail?: string } | null;
        if (!response.ok) throw new Error(body?.detail || "처리 실패");
        succeeded++;
      } catch (failure) {
        failures.push(`${row.request_no}: ${failure instanceof Error ? failure.message : "응답 확인 실패"}`);
      }
    }
    setResult({ summary: `${pending.rows.length}건 중 ${succeeded}건 완료, ${failures.length}건 실패`, failures });
    setPending(null);
    setSelected([]);
    if (!failures.length) setComment("");
    try { await mutate(); } catch { /* SWR exposes the refresh error above the grid. */ }
    finally { acting.current = false; setBusy(false); }
  }

  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const { utils, writeFileXLSX } = await import("xlsx");
      const book = utils.book_new();
      const displayedRows: TaskRow[] = [];
      gridApi.current?.forEachNodeAfterFilterAndSort((node) => { if (node.data) displayedRows.push(node.data); });
      const sheet = utils.json_to_sheet(displayedRows.map((row) => ({
        "문서번호": row.request_no, "신청서 유형": row.form_name ?? "", "제목": row.title,
        "상태": STATUS_LABELS[row.status_code] ?? row.status_code,
        "현재 단계": STEP_LABELS[row.step_type] ?? row.step_type, "차수": row.step_order,
        "요청일": row.requested_at.slice(0, 10),
      })));
      utils.book_append_sheet(book, sheet, title);
      writeFileXLSX(book, `${title}-현재페이지-${page}.xlsx`);
    } catch {
      setResult({ summary: "다운로드에 실패했습니다. 다시 시도해 주세요.", failures: [] });
    } finally { setDownloading(false); }
  }

  const columns: ColDef<TaskRow>[] = [
    { field: "request_no", headerName: "문서번호", width: 160 },
    { field: "form_name", headerName: "신청서 유형", minWidth: 150, flex: 1 },
    { field: "title", headerName: "제목", minWidth: 220, flex: 2 },
    { field: "status_code", headerName: "상태", width: 130, valueFormatter: ({ value }) => STATUS_LABELS[value] ?? value },
    { field: "step_type", headerName: "현재 단계", width: 110, valueFormatter: ({ value }) => STEP_LABELS[value] ?? value },
    { field: "step_order", headerName: "차수", width: 80 },
    { field: "requested_at", headerName: "요청일", width: 120, valueFormatter: ({ value }) => String(value ?? "").slice(0, 10) },
  ];

  return <>
    <ReadonlyGridManager<TaskRow>
      title={title}
      inset gridHeight={420}
      headerNote={selectedRows.length > 0 ? <span className="text-xs text-primary">선택 {selectedRows.length}건</span> : null}
      searchFields={<SearchFieldGrid className="xl:grid-cols-4"><SearchTextField className="md:col-span-2" value={keyword} onChange={setKeyword} placeholder="문서번호, 제목, 신청서명 (현재 페이지)"
        onKeyDown={(event) => { if (event.key === "Enter" && !locked) { setSelected([]); setAppliedKeyword(keyword); void mutate(); } }} />
      </SearchFieldGrid>}
      feedback={<>{error && <p role="alert" className="px-3 pb-3 text-sm text-destructive md:px-6">목록을 불러오지 못했습니다. 조회를 눌러 다시 시도해 주세요.</p>}
        {result && <div role="status" className="px-3 pb-3 text-xs md:px-6"><p>{result.summary}</p>{result.failures.length > 0 && <ul className="text-destructive">{result.failures.map((message) => <li key={message}>{message}</li>)}</ul>}</div>}</>}
      rowData={rows} columnDefs={columns} totalCount={data?.total_count ?? 0} page={page} pageSize={pageSize}
      onPageChange={(next) => { if (!locked) { setSelected([]); setPage(next); } }}
      onQuery={() => { if (!locked) { setSelected([]); setAppliedKeyword(keyword); void mutate(); } }}
      queryDisabled={locked || isValidating} loading={isLoading}
      onSelectionChange={setSelected} isRowSelectable={eligible}
      onReady={(api) => { gridApi.current = api; }}
      actions={[
        { key: "approve", label: `선택 ${primaryLabel}`, icon: Check, onClick: () => prepare(primaryAction, selectedRows), disabled: locked || !selectedRows.length },
        { key: "reject", label: "반려", icon: X, onClick: () => prepare(rejectAction, selectedRows), disabled: locked || selectedRows.length !== 1 },
        { key: "download", label: downloading ? "다운로드 중..." : "현재 페이지 다운로드", icon: Download, onClick: () => void download(), disabled: locked || downloading || !rows.length },
      ]}
      emptyText={`${title} 대기 문서가 없습니다.`}
    />
    <ConfirmDialog open={pending !== null} onOpenChange={(open) => { if (!open && !acting.current) setPending(null); }}
      title={`${pending?.action === rejectAction ? "반려" : primaryLabel} ${pending?.rows.length ?? 0}건을 처리할까요?`}
      description="각 문서는 개별 처리됩니다. 일부 문서가 실패해도 다른 문서의 처리 결과는 유지됩니다."
      confirmLabel="처리 확인" confirmVariant="save" busy={busy} onConfirm={confirmAction}>
      <div className="space-y-3 px-6">
      <ul className="max-h-48 overflow-y-auto text-sm">{pending?.rows.map((row) => <li key={row.request_id}>{row.request_no} / {row.title}</li>)}</ul>
      <label className="space-y-1 text-sm">처리 의견
        <Input aria-label="처리 의견" value={pending?.comment ?? ""} disabled={busy}
          onChange={(event) => { const value = event.target.value; setComment(value); setPending((current) => current ? { ...current, comment: value } : null); }}
          placeholder="선택한 문서에 동일하게 적용할 의견" />
      </label>
      </div>
    </ConfirmDialog>
  </>;
}

// standard-v2: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls totalCount pageSize
