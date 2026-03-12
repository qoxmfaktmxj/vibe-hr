"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams, RowClassParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Copy, Download, FileDown, Plus, RefreshCw, Save, Upload, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { clearSavedStatuses, reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type { HrRecruitFinalistItem, HrRecruitFinalistListResponse } from "@/types/hr-recruit";

type ProgressStatus = "draft" | "ready" | "appointed";
type SearchFilters = { keyword: string; status: "" | ProgressStatus };
type PendingReloadAction = { type: "page"; page: number } | { type: "query"; filters: SearchFilters };
type RecruitGridRow = HrRecruitFinalistItem & { _status: GridRowStatus; _original?: Record<string, unknown>; _prevStatus?: GridRowStatus };

const EMPTY_FILTERS: SearchFilters = { keyword: "", status: "" };
const TRACKED_FIELDS: (keyof HrRecruitFinalistItem)[] = ["source_type", "external_key", "full_name", "resident_no_masked", "birth_date", "phone_mobile", "email", "hire_type", "career_years", "login_id", "employee_no", "expected_join_date", "status_code", "note", "is_active"];
const STATUS_LABELS: Record<GridRowStatus, string> = { clean: "", added: "신규", updated: "수정", deleted: "삭제" };
const SOURCE_LABELS = { if: "IF", manual: "수기" } as const;
const HIRE_TYPE_LABELS = { new: "신입", experienced: "경력" } as const;
const PROCESS_STATUS_LABELS = { draft: "초안", ready: "발령준비", appointed: "발령완료" } as const;
const AG_GRID_LOCALE_KO: Record<string, string> = { page: "페이지", more: "더보기", to: "~", of: "/", next: "다음", last: "마지막", first: "처음", previous: "이전", loadingOoo: "불러오는 중...", noRowsToShow: "표시할 데이터가 없습니다.", searchOoo: "검색..." };

const normalizeText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};
const normalizeDate = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 10) : null;
};
const normalizeCareerYears = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const snapshotOriginal = (row: HrRecruitFinalistItem) => snapshotFields(row, TRACKED_FIELDS);
const isRevertedToOriginal = (row: RecruitGridRow) => isRowRevertedToOriginal(row, TRACKED_FIELDS);
const toGridRow = (row: HrRecruitFinalistItem): RecruitGridRow => ({ ...row, _status: "clean", _original: snapshotOriginal(row), _prevStatus: undefined });

async function parseErrorDetail(response: Response, fallback: string) {
  const json = (await response.json().catch(() => null)) as { detail?: string | { msg?: string }[] } | null;
  if (typeof json?.detail === "string") return json.detail;
  if (Array.isArray(json?.detail) && typeof json.detail[0]?.msg === "string") return json.detail[0].msg!;
  return fallback;
}

export function HrRecruitFinalistManager() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<RecruitGridRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [saving, setSaving] = useState(false);
  const [generatingNo, setGeneratingNo] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingReloadAction, setPendingReloadAction] = useState<PendingReloadAction | null>(null);
  const gridApiRef = useRef<GridApi<RecruitGridRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const rowsRef = useRef<RecruitGridRow[]>([]);
  const tempIdRef = useRef(-1);

  const { data, isLoading, mutate } = useSWR<HrRecruitFinalistListResponse>("/api/hr/recruit/finalists", fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 });

  useEffect(() => {
    if (!data) return;
    const nextRows = (data.items ?? []).map(toGridRow);
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, [data]);

  const filteredRows = useMemo(() => {
    const keyword = appliedFilters.keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (appliedFilters.status && row.status_code !== appliedFilters.status) return false;
      if (!keyword) return true;
      return row.full_name.toLowerCase().includes(keyword) || row.candidate_no.toLowerCase().includes(keyword) || (row.employee_no ?? "").toLowerCase().includes(keyword) || (row.login_id ?? "").toLowerCase().includes(keyword);
    });
  }, [appliedFilters, rows]);
  const totalCount = filteredRows.length;
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize]);
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const hasDirtyRows = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);

  const runReloadAction = useCallback((action: PendingReloadAction, discardDirtyRows: boolean) => {
    gridApiRef.current?.stopEditing();
    gridApiRef.current?.deselectAll();
    if (discardDirtyRows) {
      rowsRef.current = [];
      setRows([]);
    }
    if (action.type === "page") setPage(action.page);
    else {
      setAppliedFilters(action.filters);
      setPage(1);
    }
  }, []);
  const requestReloadAction = useCallback((action: PendingReloadAction) => {
    if (action.type === "page" && action.page === page) return;
    if (hasDirtyRows) {
      setPendingReloadAction(action);
      setDiscardDialogOpen(true);
      return;
    }
    runReloadAction(action, false);
  }, [hasDirtyRows, page, runReloadAction]);

  const { totalPages, pageInput, setPageInput, goPrev, goNext, goToPage } = useGridPagination({
    page,
    totalCount,
    pageSize,
    onPageChange: (nextPage) => requestReloadAction({ type: "page", page: nextPage }),
  });
  const defaultColDef = useMemo<ColDef<RecruitGridRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: true,
      minWidth: 100,
      editable: false,
    }),
    [],
  );

  const commitRows = useCallback((updater: (prevRows: RecruitGridRow[]) => RecruitGridRow[]) => {
    const nextRows = updater(rowsRef.current);
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, []);

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const patchRowById = useCallback((rowId: number, patch: Partial<RecruitGridRow>) => {
    commitRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      const merged: RecruitGridRow = { ...row, ...patch, _original: row._original, _prevStatus: row._prevStatus };
      return reconcileUpdatedStatus(merged, { shouldBeClean: (candidate) => isRevertedToOriginal(candidate) });
    }));
  }, [commitRows]);

  const addRow = useCallback(() => {
    const now = new Date().toISOString();
    commitRows((prev) => [{ id: issueTempId(), candidate_no: "", source_type: "manual", external_key: null, full_name: "", resident_no_masked: null, birth_date: null, phone_mobile: null, email: null, hire_type: "new", career_years: null, login_id: null, employee_no: null, expected_join_date: new Date().toISOString().slice(0, 10), status_code: "draft", note: null, is_active: true, created_at: now, updated_at: now, _status: "added", _original: undefined, _prevStatus: undefined }, ...prev]);
  }, [commitRows, issueTempId]);

  const copyRows = useCallback(() => {
    const selectedRows = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selectedRows.length === 0) {
      toast.error("복사할 행을 먼저 선택하세요.");
      return;
    }
    const now = new Date().toISOString();
    const clones = selectedRows.map<RecruitGridRow>((row) => ({ ...row, id: issueTempId(), candidate_no: "", external_key: null, employee_no: null, login_id: null, status_code: "draft", source_type: "manual", created_at: now, updated_at: now, _status: "added", _original: undefined, _prevStatus: undefined }));
    commitRows((prev) => [...clones, ...prev]);
  }, [commitRows, issueTempId]);

  const toggleDeleteById = useCallback((rowId: number, checked: boolean) => {
    commitRows((prev) => toggleDeletedStatus(prev, rowId, checked, { removeAddedRow: true, shouldBeClean: (candidate) => isRevertedToOriginal(candidate) }));
  }, [commitRows]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent<RecruitGridRow>) => {
    const row = event.data;
    const field = event.colDef.field as keyof RecruitGridRow | undefined;
    if (!row || !field || event.newValue === event.oldValue) return;
    const patch: Partial<RecruitGridRow> = {};
    if (field === "source_type") patch.source_type = String(event.newValue) as RecruitGridRow["source_type"];
    else if (field === "hire_type") patch.hire_type = String(event.newValue) as RecruitGridRow["hire_type"];
    else if (field === "status_code") patch.status_code = String(event.newValue) as RecruitGridRow["status_code"];
    else if (field === "career_years") patch.career_years = normalizeCareerYears(event.newValue);
    else if (field === "birth_date" || field === "expected_join_date") patch[field] = normalizeDate(event.newValue) as never;
    else patch[field] = normalizeText(event.newValue) as never;
    patchRowById(row.id, patch);
  }, [patchRowById]);

  const downloadTemplate = useCallback(async () => {
    try {
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([["이름", "주민등록번호(마스킹)", "생년월일", "휴대전화", "이메일", "채용유형(new/experienced)", "경력연차", "입사예정일", "비고"], ["홍길동", "900101-1******", "1990-01-01", "010-1234-5678", "hong@example.com", "new", "0", "2026-04-01", "메모 예시"]]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, "hr-recruit-finalists-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, []);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const { utils, writeFileXLSX } = await import("xlsx");
      const rowsForExport = rows.map((row) => [STATUS_LABELS[row._status], row.candidate_no, SOURCE_LABELS[row.source_type], row.full_name, row.resident_no_masked ?? "", row.birth_date ?? "", row.phone_mobile ?? "", row.email ?? "", HIRE_TYPE_LABELS[row.hire_type], row.career_years ?? "", row.login_id ?? "", row.employee_no ?? "", row.expected_join_date ?? "", PROCESS_STATUS_LABELS[row.status_code], row.note ?? ""]);
      const sheet = utils.aoa_to_sheet([["상태", "후보번호", "등록구분", "이름", "주민번호", "생년월일", "휴대전화", "이메일", "채용유형", "경력연차", "로그인ID", "사번", "입사예정일", "진행상태", "비고"], ...rowsForExport]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "채용합격자");
      writeFileXLSX(book, `hr-recruit-finalists-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }, [rows]);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });
      if (!rowsAoa || rowsAoa.length <= 1) return;
      const parsed = rowsAoa.slice(1).map((cells) => cells.map((value) => String(value ?? "").trim())).filter((cells) => cells.some((value) => value.length > 0)).map<RecruitGridRow>((c) => ({ id: issueTempId(), candidate_no: "", source_type: "manual", external_key: null, full_name: c[0] ?? "", resident_no_masked: normalizeText(c[1]), birth_date: normalizeDate(c[2]), phone_mobile: normalizeText(c[3]), email: normalizeText(c[4]), hire_type: c[5] === "experienced" ? "experienced" : "new", career_years: normalizeCareerYears(c[6]), login_id: null, employee_no: null, expected_join_date: normalizeDate(c[7]), status_code: "draft", note: normalizeText(c[8]), is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), _status: "added", _original: undefined, _prevStatus: undefined }));
      if (parsed.length === 0) {
        toast.error("업로드할 데이터가 없습니다.");
        return;
      }
      commitRows((prev) => [...parsed, ...prev]);
      toast.success(`${parsed.length}건을 추가했습니다.`);
    } catch {
      toast.error("엑셀 파일을 읽지 못했습니다.");
    }
  }, [commitRows, issueTempId]);

  const saveAll = useCallback(async () => {
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated" && row.id > 0);
    if (toDelete.length + toInsert.length + toUpdate.length === 0) {
      toast.info("저장할 변경사항이 없습니다.");
      return;
    }
    setSaving(true);
    try {
      for (const row of [...toInsert, ...toUpdate]) if (!row.full_name.trim()) throw new Error("이름은 필수입니다.");
      if (toDelete.length > 0) {
        const response = await fetch("/api/hr/recruit/finalists", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: toDelete.map((row) => row.id) }) });
        if (!response.ok) throw new Error(await parseErrorDetail(response, "삭제에 실패했습니다."));
      }
      for (const row of toUpdate) {
        const response = await fetch(`/api/hr/recruit/finalists/${row.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_type: row.source_type, external_key: row.external_key ?? null, full_name: row.full_name.trim(), resident_no_masked: row.resident_no_masked ?? null, birth_date: row.birth_date ?? null, phone_mobile: row.phone_mobile ?? null, email: row.email ?? null, hire_type: row.hire_type, career_years: row.career_years ?? null, login_id: row.login_id ?? null, employee_no: row.employee_no ?? null, expected_join_date: row.expected_join_date ?? null, status_code: row.status_code, note: row.note ?? null, is_active: row.is_active }) });
        if (!response.ok) throw new Error(await parseErrorDetail(response, `${row.full_name} 수정에 실패했습니다.`));
      }
      for (const row of toInsert) {
        const response = await fetch("/api/hr/recruit/finalists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_type: "manual", external_key: null, full_name: row.full_name.trim(), resident_no_masked: row.resident_no_masked ?? null, birth_date: row.birth_date ?? null, phone_mobile: row.phone_mobile ?? null, email: row.email ?? null, hire_type: row.hire_type, career_years: row.career_years ?? null, login_id: row.login_id ?? null, employee_no: row.employee_no ?? null, expected_join_date: row.expected_join_date ?? null, status_code: row.status_code, note: row.note ?? null, is_active: row.is_active }) });
        if (!response.ok) throw new Error(await parseErrorDetail(response, `${row.full_name} 등록에 실패했습니다.`));
      }
      commitRows((prev) => clearSavedStatuses(prev, { removeDeleted: true, buildOriginal: (row) => snapshotOriginal(row) }));
      await mutate();
      toast.success(`변경사항을 저장했습니다. (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [commitRows, mutate, rows]);

  const syncFromIf = useCallback(async () => {
    toast.info("IF 동기화는 아직 연결되지 않았습니다.");
  }, []);

  const generateEmployeeNoForSelected = useCallback(async () => {
    const selected = gridApiRef.current?.getSelectedRows() ?? [];
    const targetIds = selected.filter((row) => row._status !== "deleted" && row.id > 0).map((row) => row.id);
    if (targetIds.length === 0) {
      toast.error("사번을 채번할 행을 선택하세요.");
      return;
    }
    setGeneratingNo(true);
    try {
      const response = await fetch("/api/hr/recruit/finalists/generate-employee-no", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: targetIds }) });
      if (!response.ok) throw new Error(await parseErrorDetail(response, "사번 채번에 실패했습니다."));
      await mutate();
      toast.success("사번 채번을 완료했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "사번 채번에 실패했습니다.");
    } finally {
      setGeneratingNo(false);
    }
  }, [mutate]);

  const columnDefs = useMemo<ColDef<RecruitGridRow>[]>(() => [
    { headerName: "??", width: 62, pinned: "left", sortable: false, filter: false, suppressHeaderMenuButton: true, editable: false, cellRenderer: (params: ICellRendererParams<RecruitGridRow>) => { const row = params.data; if (!row) return null; return <div className="flex h-full items-center justify-center"><input type="checkbox" checked={row._status === "deleted"} className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]" onChange={(event) => toggleDeleteById(row.id, event.target.checked)} onClick={(event) => event.stopPropagation()} /></div>; } },
    { field: "_status", headerName: "??", width: 84, pinned: "left", editable: false, sortable: false, filter: false, valueFormatter: (params) => STATUS_LABELS[(params.value as GridRowStatus) ?? "clean"], cellClass: (params) => getGridStatusCellClass(params.value as GridRowStatus) },
    { field: "candidate_no", headerName: "?????", minWidth: 130, editable: false },
    { field: "source_type", headerName: "????", minWidth: 100, editable: (params) => params.data?._status === "added", cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["manual", "if"] }, valueFormatter: (params) => SOURCE_LABELS[(params.value as keyof typeof SOURCE_LABELS) ?? "manual"] },
    { field: "full_name", headerName: "??", minWidth: 120, editable: (params) => params.data?._status !== "deleted" },
    { field: "resident_no_masked", headerName: "????", minWidth: 130, editable: (params) => params.data?._status !== "deleted" },
    { field: "birth_date", headerName: "????", minWidth: 115, editable: (params) => params.data?._status !== "deleted" },
    { field: "phone_mobile", headerName: "????", minWidth: 130, editable: (params) => params.data?._status !== "deleted" },
    { field: "email", headerName: "???", minWidth: 190, editable: (params) => params.data?._status !== "deleted" },
    { field: "hire_type", headerName: "????", minWidth: 110, editable: (params) => params.data?._status !== "deleted", cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["new", "experienced"] }, valueFormatter: (params) => HIRE_TYPE_LABELS[(params.value as keyof typeof HIRE_TYPE_LABELS) ?? "new"] },
    { field: "career_years", headerName: "????", minWidth: 100, editable: (params) => params.data?._status !== "deleted" },
    { field: "login_id", headerName: "???ID", minWidth: 120, editable: (params) => params.data?._status !== "deleted" },
    { field: "employee_no", headerName: "??", minWidth: 120, editable: false },
    { field: "expected_join_date", headerName: "?????", minWidth: 120, editable: (params) => params.data?._status !== "deleted" },
    { field: "status_code", headerName: "????", minWidth: 110, editable: (params) => params.data?._status !== "deleted", cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["draft", "ready", "appointed"] }, valueFormatter: (params) => PROCESS_STATUS_LABELS[(params.value as keyof typeof PROCESS_STATUS_LABELS) ?? "draft"] },
    { field: "note", headerName: "비고", minWidth: 180, flex: 1.2, editable: (params) => params.data?._status !== "deleted" },
    { field: "updated_at", headerName: "????", minWidth: 170, editable: false, valueFormatter: (params) => (params.value ? new Date(params.value as string).toLocaleString() : "") },
  ], [toggleDeleteById]);

  const rowClassRules = useMemo(() => buildGridRowClassRules<RecruitGridRow>(), []);
  const getRowClass = useCallback((params: RowClassParams<RecruitGridRow>) => getGridRowClass(params.data?._status), []);
  const selectionColumnDef = useMemo<ColDef<RecruitGridRow>>(() => ({ width: 44, pinned: "left", sortable: false, filter: false, editable: false, resizable: false, suppressHeaderMenuButton: true }), []);

  const toolbarActions = [
    { key: "create", label: "??", icon: Plus, onClick: addRow, disabled: isLoading || saving || generatingNo },
    { key: "copy", label: "복사", icon: Copy, onClick: copyRows, disabled: isLoading || saving || generatingNo },
    { key: "template", label: "?? ????", icon: FileDown, onClick: () => void downloadTemplate(), disabled: isLoading || saving || generatingNo },
    { key: "upload", label: "???", icon: Upload, onClick: () => uploadInputRef.current?.click(), disabled: isLoading || saving || generatingNo },
    { key: "download", label: "????", icon: Download, onClick: () => void downloadCurrentSheet(), disabled: isLoading || saving || generatingNo },
  ];

  const toolbarSaveAction = { key: "save", label: saving ? "?? ?..." : "??", icon: Save, onClick: () => void saveAll(), disabled: isLoading || saving || generatingNo, variant: "save" as const };

  const handleQuery = () => requestReloadAction({ type: "query", filters: { ...searchFilters } });
  const handleSearchEnter = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => { if (event.key === "Enter") { event.preventDefault(); handleQuery(); } };
  const handleDiscardDialogOpenChange = (open: boolean) => { setDiscardDialogOpen(open); if (!open) setPendingReloadAction(null); };
  const handleDiscardAndContinue = () => { if (!pendingReloadAction) return setDiscardDialogOpen(false); runReloadAction(pendingReloadAction, true); setPendingReloadAction(null); setDiscardDialogOpen(false); };

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="???????" onQuery={handleQuery} queryLabel="??" queryDisabled={isLoading || saving || generatingNo}>
        <SearchFieldGrid className="xl:grid-cols-3">
          <SearchTextField value={searchFilters.keyword} onChange={(value) => setSearchFilters((prev) => ({ ...prev, keyword: value }))} onKeyDown={handleSearchEnter} placeholder="?? / ????? / ?? / ???ID" />
          <select value={searchFilters.status} onChange={(event) => setSearchFilters((prev) => ({ ...prev, status: event.target.value as SearchFilters["status"] }))} onKeyDown={handleSearchEnter} aria-label="????" className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground">
            <option value="">???? ??</option>
            <option value="draft">??</option>
            <option value="ready">????</option>
            <option value="appointed">????</option>
          </select>
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={<><GridPaginationControls page={page} totalPages={totalPages} pageInput={pageInput} setPageInput={setPageInput} goPrev={goPrev} goNext={goNext} goToPage={goToPage} disabled={isLoading || saving || generatingNo} className="mt-0 justify-start" /><span className="text-xs text-slate-500">? {totalCount.toLocaleString()}?</span><GridChangeSummaryBadges summary={changeSummary} /></>}
        headerRight={<><GridToolbarActions actions={toolbarActions} saveAction={toolbarSaveAction} /><Button size="sm" variant="action" onClick={() => void syncFromIf()} disabled><RefreshCw className="h-3.5 w-3.5" />IF ?? ???</Button><Button size="sm" variant="action" onClick={() => void generateEmployeeNoForSelected()} disabled={isLoading || saving || generatingNo}><UserRoundPlus className="h-3.5 w-3.5" />{generatingNo ? "?????..." : "????"}</Button><input ref={uploadInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadFile(file); event.currentTarget.value = ""; }} /></>}
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 px-3 pb-4 pt-2 md:px-6 md:pt-0">
          <div className="ag-theme-quartz vibe-grid h-full w-full min-h-[420px] overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<RecruitGridRow> theme="legacy" rowData={pagedRows} columnDefs={columnDefs} defaultColDef={defaultColDef} rowSelection={{ mode: "multiRow", enableClickSelection: true }} selectionColumnDef={selectionColumnDef} singleClickEdit animateRows={false} localeText={AG_GRID_LOCALE_KO} rowClassRules={rowClassRules} getRowClass={getRowClass} getRowId={(params) => String(params.data.id)} onGridReady={(event: GridReadyEvent<RecruitGridRow>) => { gridApiRef.current = event.api; }} onCellValueChanged={onCellValueChanged} loading={isLoading} headerHeight={36} rowHeight={34} overlayNoRowsTemplate='<span class="text-sm text-slate-400">???? ????.</span>' />
          </div>
        </div>
      </ManagerGridSection>

      <ConfirmDialog open={discardDialogOpen} onOpenChange={handleDiscardDialogOpenChange} title="???? ?? ?? ??? ????." description="?? ?? ??? ???? ?? ???? ?? ??? ?????. ?? ?????????" confirmLabel="???? ??" cancelLabel="??" confirmVariant="destructive" onConfirm={handleDiscardAndContinue} />
    </ManagerPageShell>
  );
}
