"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, FileDown, Search, Upload } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { toast } from "sonner";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  OrgMappingAssignmentUploadConfirmResponse,
  OrgMappingAssignmentUploadPreviewResponse,
  OrgMappingAssignmentUploadPreviewRow,
  OrgMappingAssignmentUploadRequest,
  OrgMappingAssignmentUploadRow,
  OrgMappingAssignmentUploadTemplateResponse,
} from "@/types/organization";

const UPLOAD_HEADERS = ["조직코드", "유형코드", "항목코드", "시작일", "종료일"] as const;
const PAGE_SIZE = 100;

type GridRow = OrgMappingAssignmentUploadPreviewRow & OrgMappingAssignmentUploadRow & {
  _status: "clean";
  _original: Record<string, unknown>;
  _prevStatus?: "clean";
};

// Upload preview rows are read-only, but keep the standard shared status APIs wired for Grid consistency.
void reconcileUpdatedStatus;
void toggleDeletedStatus;

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지", more: "더보기", to: "~", of: "/", next: "다음", last: "마지막", first: "처음", previous: "이전",
  loadingOoo: "로딩 중...", noRowsToShow: "데이터가 없습니다.", searchOoo: "검색...", blanks: "(빈값)",
  filterOoo: "필터...", applyFilter: "적용", equals: "같음", notEqual: "같지 않음", contains: "포함",
  notContains: "포함하지 않음", startsWith: "시작", endsWith: "끝", andCondition: "그리고", orCondition: "또는",
  selectAll: "전체 선택", noMatches: "일치 항목 없음",
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function isExactHeaderRow(row: readonly unknown[]): boolean {
  return row.length === UPLOAD_HEADERS.length && row.every((value, index) => asText(value) === UPLOAD_HEADERS[index]);
}

function toGridRow(
  previewRow: OrgMappingAssignmentUploadPreviewRow,
  sourceRows: readonly OrgMappingAssignmentUploadRow[],
): GridRow {
  const source = sourceRows[previewRow.row_number - 1];
  const normalized = previewRow.normalized ?? source;
  const row = {
    ...previewRow,
    department_code: normalized?.department_code ?? "",
    type_code: normalized?.type_code ?? "",
    item_code: normalized?.item_code ?? "",
    effective_from: normalized?.effective_from ?? "",
    effective_to: normalized?.effective_to ?? null,
  };
  return { ...row, _status: "clean", _original: { ...row } };
}

function previewFromPayload(value: unknown): OrgMappingAssignmentUploadPreviewResponse | null {
  const candidate = value && typeof value === "object" && "detail" in value
    ? (value as { detail?: unknown }).detail
    : value;
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Partial<OrgMappingAssignmentUploadPreviewResponse>;
  if (!Array.isArray(record.rows) || typeof record.valid_count !== "number" || typeof record.invalid_count !== "number") {
    return null;
  }
  return record as OrgMappingAssignmentUploadPreviewResponse;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function OrgMappingUploadManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/org/type-upload");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [sourceRows, setSourceRows] = useState<OrgMappingAssignmentUploadRow[]>([]);
  const [preview, setPreview] = useState<OrgMappingAssignmentUploadPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => (preview?.rows ?? []).map((row) => toGridRow(row, sourceRows)), [preview, sourceRows]);
  const pagedRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page, rows]);
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const rowClassRules = useMemo(() => buildGridRowClassRules<GridRow>(), []);
  const getRowClass = useCallback((params: { data?: GridRow }) => getGridRowClass(params.data?._status), []);
  const { totalPages, pageInput, setPageInput, goPrev, goNext, goToPage } = useGridPagination({
    page,
    totalCount: rows.length,
    pageSize: PAGE_SIZE,
    onPageChange: setPage,
  });

  const defaultColDef = useMemo<ColDef<GridRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false, suppressMovable: true, minWidth: 110 }),
    [],
  );
  const columnDefs = useMemo<ColDef<GridRow>[]>(() => [
    { headerName: "행", field: "row_number", pinned: "left", width: 80 },
    { headerName: "조직코드", field: "department_code", width: 130 },
    { headerName: "유형코드", field: "type_code", width: 120 },
    { headerName: "항목코드", field: "item_code", width: 130 },
    { headerName: "시작일", field: "effective_from", width: 120 },
    { headerName: "종료일", field: "effective_to", width: 120, valueFormatter: (params) => params.value ?? "" },
    {
      headerName: "검증 결과",
      field: "errors",
      minWidth: 240,
      flex: 1,
      valueFormatter: (params) => (params.data?.valid ? "정상" : (params.value ?? []).join(" / ")),
      cellClass: (params) => (params.data?.valid ? "" : getGridStatusCellClass("deleted")),
    },
  ], []);

  const applyPreview = useCallback((nextPreview: OrgMappingAssignmentUploadPreviewResponse) => {
    setPreview(nextPreview);
    setPage(1);
  }, []);

  const requestPreview = useCallback(async (nextRows: OrgMappingAssignmentUploadRow[]) => {
    if (nextRows.length === 0) {
      toast.error("업로드할 행이 없습니다.");
      return;
    }

    setLoading(true);
    try {
      const payload: OrgMappingAssignmentUploadRequest = { mode: "atomic", rows: nextRows };
      const response = await fetch("/api/org/mapping-assignments/upload-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as unknown;
      const nextPreview = previewFromPayload(body);
      if (nextPreview) {
        applyPreview(nextPreview);
        if (nextPreview.invalid_count > 0) toast.error(`${nextPreview.invalid_count}건의 오류를 확인하세요.`);
        else toast.success(`${nextPreview.valid_count}건의 검증이 완료되었습니다.`);
      }
      if (!response.ok) throw new Error(errorMessage(body, "업로드 검증에 실패했습니다."));
      if (!nextPreview) throw new Error("업로드 미리보기 응답이 올바르지 않습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "업로드 검증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [applyPreview]);

  const downloadTemplate = useCallback(async () => {
    try {
      const response = await fetch("/api/org/mapping-assignments/upload-template", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as OrgMappingAssignmentUploadTemplateResponse | null;
      if (!response.ok || !payload || !isExactHeaderRow(payload.headers)) {
        throw new Error("업로드 양식 정보를 불러오지 못했습니다.");
      }
      const { utils, writeFileXLSX } = await import("xlsx");
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, utils.aoa_to_sheet([payload.headers]), "조직구분업로드");
      writeFileXLSX(workbook, "org-mapping-upload-template.xlsx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "양식 다운로드에 실패했습니다.");
    }
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsAoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
      if (!rowsAoa.length || !isExactHeaderRow(rowsAoa[0])) {
        throw new Error(`엑셀 헤더는 ${UPLOAD_HEADERS.join(", ")} 순서와 정확히 일치해야 합니다.`);
      }
      const nextRows = rowsAoa.slice(1)
        .map((cells) => cells.map(asText))
        .filter((cells) => cells.some(Boolean))
        .map<OrgMappingAssignmentUploadRow>((cells) => ({
          department_code: cells[0] ?? "",
          type_code: cells[1] ?? "",
          item_code: cells[2] ?? "",
          effective_from: cells[3] ?? "",
          effective_to: cells[4] || null,
        }));
      if (!nextRows.length) throw new Error("업로드할 데이터 행이 없습니다.");
      setSourceRows(nextRows);
      setPreview(null);
      await requestPreview(nextRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "엑셀 파일을 읽지 못했습니다.");
    }
  }, [requestPreview]);

  const downloadErrors = useCallback(async () => {
    if (!preview || preview.invalid_count === 0) return;
    const errorRows = rows.filter((row) => !row.valid);
    const { utils, writeFileXLSX } = await import("xlsx");
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([
      [...UPLOAD_HEADERS, "오류"],
      ...errorRows.map((row) => [
        row.department_code,
        row.type_code,
        row.item_code,
        row.effective_from,
        row.effective_to ?? "",
        row.errors.join(" / "),
      ]),
    ]);
    utils.book_append_sheet(workbook, sheet, "오류목록");
    writeFileXLSX(workbook, "org-mapping-upload-errors.xlsx");
  }, [preview, rows]);

  const confirmUpload = useCallback(async () => {
    if (!preview || preview.invalid_count > 0 || sourceRows.length === 0 || !can("upload")) return;
    setConfirming(true);
    try {
      const payload: OrgMappingAssignmentUploadRequest = { mode: "atomic", rows: sourceRows };
      const response = await fetch("/api/org/mapping-assignments/upload-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as unknown;
      const failedPreview = previewFromPayload(body);
      if (failedPreview) applyPreview(failedPreview);
      if (!response.ok) throw new Error(errorMessage(body, "업로드 저장에 실패했습니다."));
      const result = body as OrgMappingAssignmentUploadConfirmResponse;
      toast.success(`저장이 완료되었습니다. 입력 ${result.inserted_count}건 / 수정 ${result.updated_count}건`);
      setSourceRows([]);
      setPreview(null);
      setPage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "업로드 저장에 실패했습니다.");
    } finally {
      setConfirming(false);
    }
  }, [applyPreview, can, preview, sourceRows]);

  const canConfirm = Boolean(
    preview && preview.rows.length > 0 && preview.invalid_count === 0 && sourceRows.length > 0 && can("upload"),
  );
  const toolbarActions = [
    {
      key: "query",
      label: "조회",
      icon: Search,
      onClick: () => void requestPreview(sourceRows),
      disabled: loading || confirming || menuActionLoading || sourceRows.length === 0 || !can("query"),
    },
    {
      key: "template",
      label: "양식",
      icon: FileDown,
      onClick: () => void downloadTemplate(),
      disabled: loading || confirming || menuActionLoading || !can("template_download"),
    },
    {
      key: "upload",
      label: "업로드",
      icon: Upload,
      onClick: () => uploadInputRef.current?.click(),
      disabled: loading || confirming || menuActionLoading || !can("upload"),
    },
    {
      key: "download",
      label: "오류 다운로드",
      icon: Download,
      onClick: () => void downloadErrors(),
      disabled: loading || confirming || !preview || preview.invalid_count === 0 || !can("download"),
    },
  ];

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title="조직구분업로드"
        onQuery={() => void requestPreview(sourceRows)}
        queryLabel="조회"
        queryDisabled={loading || confirming || menuActionLoading || sourceRows.length === 0 || !can("query")}
      >
        <SearchFieldGrid className="xl:grid-cols-1">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2 text-sm">
            <span>전체 행 원자성: 오류가 한 행이라도 있으면 저장하지 않습니다.</span>
            <Button size="sm" variant="save" onClick={() => void confirmUpload()} disabled={!canConfirm || confirming || loading}>
              {confirming ? "저장 중..." : "확정 저장"}
            </Button>
          </div>
        </SearchFieldGrid>
      </ManagerSearchSection>
      <ManagerGridSection
        headerLeft={(
          <>
            <GridPaginationControls
              page={page}
              totalPages={totalPages}
              pageInput={pageInput}
              setPageInput={setPageInput}
              goPrev={goPrev}
              goNext={goNext}
              goToPage={goToPage}
              disabled={loading || confirming}
              className="mt-0 justify-start"
            />
            <span className="text-xs text-muted-foreground">총 {rows.length.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        )}
        headerRight={(
          <>
            <GridToolbarActions actions={toolbarActions} />
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUploadFile(file);
                event.currentTarget.value = "";
              }}
            />
          </>
        )}
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-0"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-border">
          <AgGridReact<GridRow>
            theme="legacy"
            rowData={pagedRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.row_number)}
            animateRows={false}
            loading={loading || confirming}
            rowClassRules={rowClassRules}
            getRowClass={getRowClass}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate='<span class="text-sm text-muted-foreground">업로드 미리보기 데이터가 없습니다.</span>'
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
