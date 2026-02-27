"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Copy, Download, FileDown, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type {
  HrAppointmentOrderConfirmResponse,
  HrAppointmentRecordListResponse,
  HrAppointmentRecordItem,
} from "@/types/hr-appointment-record";

let modulesRegistered = false;
if (!modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  modulesRegistered = true;
}

type RowStatus = GridRowStatus;
type SearchFilters = {
  appointmentNo: string;
  employeeNo: string;
  name: string;
  department: string;
  orderStatus: "" | "draft" | "confirmed" | "cancelled";
};
type AppointmentRecordRow = HrAppointmentRecordItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const EMPTY_FILTERS: SearchFilters = {
  appointmentNo: "",
  employeeNo: "",
  name: "",
  department: "",
  orderStatus: "",
};

const TRACKED_FIELDS: (keyof HrAppointmentRecordItem)[] = [
  "appointment_no",
  "order_title",
  "effective_date",
  "appointment_kind",
  "action_type",
  "start_date",
  "end_date",
  "to_department_id",
  "to_position_title",
  "to_employment_status",
  "temporary_reason",
  "note",
];

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

const ORDER_STATUS_LABELS = {
  draft: "확정전",
  confirmed: "확정",
  cancelled: "취소",
} as const;

function normalizeDate(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function HrAppointmentRecordManager() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AppointmentRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<number | null>(null);

  const gridApiRef = useRef<GridApi<AppointmentRecordRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);

  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);

  const defaultColDef = useMemo<ColDef<AppointmentRecordRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: true,
    }),
    [],
  );

  const redrawRows = useCallback(() => {
    gridApiRef.current?.redrawRows();
  }, []);

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const refresh = useCallback(async (filters: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.appointmentNo.trim()) params.set("appointment_no", filters.appointmentNo.trim());
      if (filters.employeeNo.trim()) params.set("employee_no", filters.employeeNo.trim());
      if (filters.name.trim()) params.set("name", filters.name.trim());
      if (filters.department.trim()) params.set("department", filters.department.trim());
      if (filters.orderStatus) params.set("order_status", filters.orderStatus);

      const response = await fetch(`/api/hr/appointments/records?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await parseErrorDetail(response, "발령처리 조회에 실패했습니다."));

      const data = (await response.json()) as HrAppointmentRecordListResponse;
      const nextRows = (data.items ?? []).map((row) => ({
        ...row,
        effective_date: normalizeDate(row.effective_date),
        start_date: normalizeDate(row.start_date),
        end_date: normalizeDate(row.end_date),
        _status: "clean" as const,
        _original: snapshotFields(row, TRACKED_FIELDS),
        _prevStatus: undefined,
      }));
      setRows(nextRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "발령처리 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(appliedFilters);
  }, [appliedFilters, refresh]);

  const handleQuery = useCallback(() => {
    setAppliedFilters({ ...searchFilters });
  }, [searchFilters]);

  const addRow = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().find((row) => row._status !== "deleted");
    if (!selected) {
      toast.error("기준 행(직원)을 먼저 선택해 주세요.");
      return;
    }
    const tempId = issueTempId();
    const today = new Date().toISOString().slice(0, 10);
    const newRow: AppointmentRecordRow = {
      ...selected,
      id: tempId,
      order_id: tempId,
      appointment_no: "",
      order_title: "",
      order_description: "",
      order_status: "draft",
      confirmed_at: null,
      confirmed_by: null,
      appointment_kind: "permanent",
      action_type: "",
      effective_date: today,
      start_date: today,
      end_date: null,
      apply_status: "pending",
      applied_at: null,
      temporary_reason: "",
      note: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };
    setRows((prev) => [newRow, ...prev]);
    setTimeout(redrawRows, 0);
  }, [issueTempId, redrawRows]);

  const copyRows = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selected.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }
    const clones = selected.map<AppointmentRecordRow>((row) => {
      const tempId = issueTempId();
      return {
        ...row,
        id: tempId,
        order_id: tempId,
        appointment_no: "",
        order_status: "draft",
        confirmed_at: null,
        confirmed_by: null,
        apply_status: "pending",
        applied_at: null,
        _status: "added",
        _original: undefined,
        _prevStatus: undefined,
      };
    });
    setRows((prev) => [...clones, ...prev]);
    setTimeout(redrawRows, 0);
  }, [issueTempId, redrawRows]);

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      setRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRowRevertedToOriginal(candidate, TRACKED_FIELDS),
        }),
      );
      setTimeout(redrawRows, 0);
    },
    [redrawRows],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<AppointmentRecordRow>) => {
      const changed = event.data;
      if (!changed) return;
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== changed.id) return row;
          const merged: AppointmentRecordRow = { ...row, ...changed, _original: row._original, _prevStatus: row._prevStatus };
          return reconcileUpdatedStatus(merged, {
            shouldBeClean: (candidate) => isRowRevertedToOriginal(candidate, TRACKED_FIELDS),
          });
        }),
      );
      setTimeout(redrawRows, 0);
    },
    [redrawRows],
  );

  const saveAll = useCallback(async () => {
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated" && row.id > 0);
    if (toDelete.length + toInsert.length + toUpdate.length === 0) return;

    setSaving(true);
    try {
      for (const row of toDelete) {
        const response = await fetch(`/api/hr/appointments/records/${row.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await parseErrorDetail(response, "삭제에 실패했습니다."));
      }
      for (const row of toUpdate) {
        const response = await fetch(`/api/hr/appointments/records/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_no: row.appointment_no || null,
            order_title: row.order_title || "발령",
            order_description: row.order_description || null,
            effective_date: row.effective_date || row.start_date,
            appointment_kind: row.appointment_kind,
            action_type: row.action_type || "변경",
            start_date: row.start_date || row.effective_date,
            end_date: row.end_date || null,
            to_department_id: row.to_department_id || null,
            to_position_title: row.to_position_title || null,
            to_employment_status: row.to_employment_status || null,
            temporary_reason: row.temporary_reason || null,
            note: row.note || null,
          }),
        });
        if (!response.ok) throw new Error(await parseErrorDetail(response, "수정에 실패했습니다."));
      }
      for (const row of toInsert) {
        const response = await fetch("/api/hr/appointments/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: row.employee_id,
            appointment_no: row.appointment_no || null,
            order_title: row.order_title || "발령",
            order_description: row.order_description || null,
            effective_date: row.effective_date || row.start_date,
            appointment_kind: row.appointment_kind,
            action_type: row.action_type || "변경",
            start_date: row.start_date || row.effective_date,
            end_date: row.end_date || null,
            to_department_id: row.to_department_id || null,
            to_position_title: row.to_position_title || null,
            to_employment_status: row.to_employment_status || null,
            temporary_reason: row.temporary_reason || null,
            note: row.note || null,
          }),
        });
        if (!response.ok) throw new Error(await parseErrorDetail(response, "입력에 실패했습니다."));
      }
      toast.success(`저장 완료 (입력 ${toInsert.length} / 수정 ${toUpdate.length} / 삭제 ${toDelete.length})`);
      await refresh(appliedFilters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [appliedFilters, refresh, rows]);

  const confirmOrder = useCallback(async (orderId: number) => {
    setConfirmingOrderId(orderId);
    try {
      const response = await fetch(`/api/hr/appointments/orders/${orderId}/confirm`, { method: "POST" });
      if (!response.ok) throw new Error(await parseErrorDetail(response, "발령 확정에 실패했습니다."));
      const data = (await response.json()) as HrAppointmentOrderConfirmResponse;
      toast.success(`발령 확정 완료 (적용 ${data.applied_count}건)`);
      await refresh(appliedFilters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "발령 확정에 실패했습니다.");
    } finally {
      setConfirmingOrderId(null);
    }
  }, [appliedFilters, refresh]);

  const columnDefs = useMemo<ColDef<AppointmentRecordRow>[]>(() => [
    {
      headerName: "삭제",
      width: 56,
      pinned: "left",
      sortable: false,
      filter: false,
      suppressMenu: true,
      editable: false,
      cellRenderer: (params: ICellRendererParams<AppointmentRecordRow>) => {
        const row = params.data;
        if (!row) return null;
        const disabled = row.order_status !== "draft";
        return (
          <div className="flex h-full items-center justify-center">
            <input
              type="checkbox"
              checked={row._status === "deleted"}
              disabled={disabled}
              className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
              onChange={(event) => toggleDeleteById(row.id, event.target.checked)}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        );
      },
    },
    {
      field: "_status",
      headerName: "상태",
      width: 84,
      pinned: "left",
      editable: false,
      cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
      valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
    },
    {
      headerName: "확정",
      width: 84,
      editable: false,
      sortable: false,
      filter: false,
      suppressMenu: true,
      cellRenderer: (params: ICellRendererParams<AppointmentRecordRow>) => {
        const row = params.data;
        if (!row) return null;
        const canConfirm = row.order_status === "draft" && row.order_id > 0 && row._status === "clean";
        return (
          <div className="flex h-full items-center justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={!canConfirm || confirmingOrderId === row.order_id || loading || saving}
              onClick={(event) => {
                event.stopPropagation();
                if (canConfirm) void confirmOrder(row.order_id);
              }}
            >
              확정
            </Button>
          </div>
        );
      },
    },
    { field: "order_status", headerName: "발령상태", width: 94, editable: false, valueFormatter: (p) => ORDER_STATUS_LABELS[(p.value as keyof typeof ORDER_STATUS_LABELS) ?? "draft"] },
    {
      field: "appointment_no",
      headerName: "발령번호",
      width: 130,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    { field: "employee_no", headerName: "사번", width: 120, editable: false },
    { field: "display_name", headerName: "이름", width: 120, editable: false },
    { field: "department_name", headerName: "현부서", width: 130, editable: false },
    {
      field: "order_title",
      headerName: "발령명",
      minWidth: 150,
      flex: 1,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "action_type",
      headerName: "발령유형",
      width: 120,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "appointment_kind",
      headerName: "발령구분",
      width: 110,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "effective_date",
      headerName: "시행일",
      width: 110,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "start_date",
      headerName: "시작일",
      width: 110,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "end_date",
      headerName: "종료일",
      width: 110,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "to_department_id",
      headerName: "변경부서ID",
      width: 120,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "to_position_title",
      headerName: "변경직책",
      width: 120,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "to_employment_status",
      headerName: "변경재직상태",
      width: 130,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "temporary_reason",
      headerName: "임시발령사유",
      minWidth: 140,
      flex: 1,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
    {
      field: "note",
      headerName: "비고",
      minWidth: 140,
      flex: 1,
      editable: (params) => params.data?._status !== "deleted" && params.data?.order_status === "draft",
    },
  ], [confirmOrder, confirmingOrderId, loading, saving, toggleDeleteById]);

  const getRowClass = useCallback((params: RowClassParams<AppointmentRecordRow>) => getGridRowClass(params.data?._status), []);

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = ["사번", "발령명", "시행일", "발령유형", "시작일", "종료일", "변경부서ID", "변경직책", "변경재직상태", "비고"];
      const sample = ["HR-0001", "부서이동", "2026-03-01", "DEPT_TRANSFER", "2026-03-01", "", "2", "대리", "active", "샘플"];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, "appointment-records-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, []);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = ["상태", "발령상태", "발령번호", "사번", "이름", "발령명", "발령유형", "시행일", "시작일", "종료일", "비고"];
      const data = rows.map((row) => [
        STATUS_LABELS[row._status],
        ORDER_STATUS_LABELS[row.order_status],
        row.appointment_no,
        row.employee_no,
        row.display_name,
        row.order_title,
        row.action_type,
        row.effective_date,
        row.start_date,
        row.end_date || "",
        row.note || "",
      ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...data]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "발령처리관리");
      writeFileXLSX(book, `appointment-records-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }, [rows]);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const { read, utils } = await import("xlsx");
      const workbook = read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });
      if (!rowsAoa || rowsAoa.length <= 1) return;

      const parsed: AppointmentRecordRow[] = [];
      const baseByEmployeeNo = new Map<string, AppointmentRecordRow>();
      for (const row of rows) {
        if (!baseByEmployeeNo.has(row.employee_no)) {
          baseByEmployeeNo.set(row.employee_no, row);
        }
      }
      let skipped = 0;
      for (const cells of rowsAoa.slice(1)) {
        const c = cells.map((value) => String(value ?? "").trim());
        if (!c.some((value) => value.length > 0)) continue;
        const base = baseByEmployeeNo.get(c[0] || "");
        if (!base) {
          skipped += 1;
          continue;
        }
        const tempId = issueTempId();
        parsed.push({
          id: tempId,
          order_id: tempId,
          appointment_no: "",
          order_title: c[1] || "발령",
          order_description: "",
          effective_date: normalizeDate(c[2]) || new Date().toISOString().slice(0, 10),
          order_status: "draft",
          confirmed_at: null,
          confirmed_by: null,
          employee_id: base.employee_id,
          employee_no: base.employee_no,
          display_name: base.display_name,
          department_name: base.department_name,
          employment_status: base.employment_status,
          appointment_code_id: null,
          appointment_code_name: null,
          appointment_kind: "permanent",
          action_type: c[3] || "변경",
          start_date: normalizeDate(c[4]) || new Date().toISOString().slice(0, 10),
          end_date: normalizeDate(c[5]) || null,
          from_department_id: base.from_department_id ?? null,
          to_department_id: c[6] ? Number(c[6]) : null,
          from_position_title: base.from_position_title ?? null,
          to_position_title: c[7] || null,
          from_employment_status: base.from_employment_status ?? null,
          to_employment_status: (c[8] as "active" | "leave" | "resigned" | undefined) || base.employment_status,
          apply_status: "pending",
          applied_at: null,
          temporary_reason: "",
          note: c[9] || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _status: "added",
          _original: undefined,
          _prevStatus: undefined,
        });
      }
      if (parsed.length === 0) {
        toast.error("업로드할 데이터가 없습니다.");
        return;
      }
      setRows((prev) => [...parsed, ...prev]);
      setTimeout(redrawRows, 0);
      if (skipped > 0) {
        toast.info(`업로드 ${parsed.length}건 반영, 사번 미일치 ${skipped}건 제외`);
      } else {
        toast.success(`${parsed.length}건 업로드 반영`);
      }
    } catch {
      toast.error("업로드에 실패했습니다.");
    }
  }, [issueTempId, redrawRows, rows]);

  const toolbarActions = [
    { key: "create", label: "입력", icon: Plus, onClick: addRow, disabled: loading || saving },
    { key: "copy", label: "복사", icon: Copy, onClick: copyRows, disabled: loading || saving },
    { key: "template", label: "양식 다운로드", icon: FileDown, onClick: () => void downloadTemplate(), disabled: loading || saving },
    { key: "upload", label: "업로드", icon: Upload, onClick: () => uploadInputRef.current?.click(), disabled: loading || saving },
    { key: "save", label: saving ? "저장중..." : "저장", icon: Save, onClick: () => void saveAll(), disabled: loading || saving, variant: "save" as const },
    { key: "download", label: "다운로드", icon: Download, onClick: () => void downloadCurrentSheet(), disabled: loading || saving },
  ];

  function onGridReady(event: GridReadyEvent<AppointmentRecordRow>) {
    gridApiRef.current = event.api;
  }

  function handleSearchEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleQuery();
    }
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="발령처리관리" onQuery={handleQuery} queryLabel="조회" queryDisabled={loading || saving}>
        <SearchFieldGrid className="xl:grid-cols-5">
          <SearchTextField value={searchFilters.appointmentNo} onChange={(value) => setSearchFilters((prev) => ({ ...prev, appointmentNo: value }))} onKeyDown={handleSearchEnter} placeholder="발령번호" />
          <SearchTextField value={searchFilters.employeeNo} onChange={(value) => setSearchFilters((prev) => ({ ...prev, employeeNo: value }))} onKeyDown={handleSearchEnter} placeholder="사번" />
          <SearchTextField value={searchFilters.name} onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))} onKeyDown={handleSearchEnter} placeholder="이름" />
          <SearchTextField value={searchFilters.department} onChange={(value) => setSearchFilters((prev) => ({ ...prev, department: value }))} onKeyDown={handleSearchEnter} placeholder="부서" />
          <select value={searchFilters.orderStatus} onChange={(event) => setSearchFilters((prev) => ({ ...prev, orderStatus: event.target.value as SearchFilters["orderStatus"] }))} onKeyDown={handleSearchEnter} className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground">
            <option value="">전체 상태</option>
            <option value="draft">확정전</option>
            <option value="confirmed">확정</option>
            <option value="cancelled">취소</option>
          </select>
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={<><span className="text-xs text-slate-400">총 {rows.length.toLocaleString()}건</span><GridChangeSummaryBadges summary={changeSummary} className="ml-2" /></>}
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
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 px-3 pb-4 pt-2 md:px-6 md:pt-0">
          <div className="ag-theme-quartz vibe-grid h-full w-full min-h-[420px] overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<AppointmentRecordRow>
              theme="legacy"
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="multiple"
              suppressRowClickSelection={false}
              singleClickEdit
              animateRows={false}
              getRowClass={getRowClass}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              loading={loading}
              headerHeight={36}
              rowHeight={34}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">데이터가 없습니다.</span>'
            />
          </div>
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
