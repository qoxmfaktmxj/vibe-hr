"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import useSWR from "swr";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { fetcher } from "@/lib/fetcher";
import { getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import { runConcurrentOrThrow } from "@/lib/utils/run-concurrent";
import type { EmployeeItem } from "@/types/employee";
import type { HrInfoRow } from "@/types/hr-employee-profile";

// AG Grid modules are provided by ManagerPageShell via AgGridModulesProvider.

type Props = {
  category:
    | "appointment"
    | "reward_punish"
    | "contact_points"
    | "education"
    | "careers"
    | "licenses"
    | "military"
    | "evaluation";
  title: string;
};

type SearchFilters = {
  employeeNo: string;
  name: string;
  department: string;
  employmentStatus: "" | EmployeeItem["employment_status"];
};

type RowStatus = GridRowStatus;

type AdminGridRow = HrInfoRow & {
  employee_id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
  employment_status: EmployeeItem["employment_status"];
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const EMPTY_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
  employmentStatus: "",
};

const TRACKED_FIELDS: (keyof HrInfoRow)[] = ["record_date", "type", "title", "organization", "value", "note"];
const PAGE_SIZE = 50;

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

function snapshotOriginal(row: HrInfoRow): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isRevertedToOriginal(row: AdminGridRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as unknown;
  return stringifyErrorDetail(json) ?? fallback;
}

function stringifyErrorDetail(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyErrorDetail(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(" / ") : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.msg === "string") {
    const loc = Array.isArray(record.loc)
      ? record.loc.map((part) => String(part)).join(".")
      : "";
    return loc ? `${loc}: ${record.msg}` : record.msg;
  }

  return (
    stringifyErrorDetail(record.detail) ??
    stringifyErrorDetail(record.message) ??
    stringifyErrorDetail(record.error)
  );
}

export function HrAdminRecordManager({ category, title }: Props) {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AdminGridRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<AdminGridRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);
  const rowsRef = useRef<AdminGridRow[]>([]);

  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const employees = useMemo(() => employeeData?.employees ?? [], [employeeData?.employees]);
  const employeeByNo = useMemo(() => {
    const map = new Map<string, EmployeeItem>();
    for (const employee of employees) {
      map.set(employee.employee_no, employee);
    }
    return map;
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const options = new Set<string>();
    for (const employee of employees) {
      if (employee.department_name) options.add(employee.department_name);
    }
    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [employees]);

  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);

  const defaultColDef = useMemo<ColDef<AdminGridRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: true,
    }),
    [],
  );

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const commitRows = useCallback(
    (updater: (prevRows: AdminGridRow[]) => AdminGridRow[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
    },
    [],
  );

  const {
    totalPages,
    pageInput,
    setPageInput,
    goPrev,
    goNext,
    goToPage,
  } = useGridPagination({
    page,
    totalCount: rows.length,
    pageSize: PAGE_SIZE,
    onPageChange: setPage,
  });

  const pagedRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return rows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, rows]);

  useEffect(() => {
    if (page <= totalPages) return;
    setPage(totalPages);
  }, [page, totalPages]);

  const refresh = useCallback(
    async (filters: SearchFilters) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ category });
        if (filters.employeeNo.trim()) params.set("employee_no", filters.employeeNo.trim());
        if (filters.name.trim()) params.set("name", filters.name.trim());
        if (filters.department.trim()) params.set("department", filters.department.trim());
        if (filters.employmentStatus) params.set("employment_status", filters.employmentStatus);

        const response = await fetch(`/api/hr/basic/admin-records?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, "데이터 조회에 실패했습니다."));
        }
        const data = (await response.json()) as { items?: AdminGridRow[] };
        const nextRows = (data.items ?? []).map((row) => ({
          ...row,
          _status: "clean" as const,
          _original: snapshotOriginal(row),
          _prevStatus: undefined,
        }));
        rowsRef.current = nextRows;
        setRows(nextRows);
        setPage(1);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "데이터 조회에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [category],
  );

  useEffect(() => {
    void refresh(appliedFilters);
  }, [appliedFilters, refresh]);

  const handleQuery = useCallback(() => {
    const nextFilters = { ...searchFilters };
    setAppliedFilters(nextFilters);
    setPage(1);
  }, [searchFilters]);

  const addRow = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    const base = selected[0];
    if (!base) {
      toast.error("입력할 기준 행(직원)을 먼저 선택해 주세요.");
      return;
    }

    const newRow: AdminGridRow = {
      id: issueTempId(),
      category,
      employee_id: base.employee_id,
      employee_no: base.employee_no,
      display_name: base.display_name,
      department_name: base.department_name,
      employment_status: base.employment_status,
      record_date: new Date().toISOString().slice(0, 10),
      type: "",
      title: "",
      organization: "",
      value: "",
      note: "",
      created_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };

    commitRows((prev) => [newRow, ...prev]);
  }, [category, commitRows, issueTempId]);

  const copyRows = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selected.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const clones = selected.map<AdminGridRow>((row) => ({
      ...row,
      id: issueTempId(),
      created_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    }));

    commitRows((prev) => [...clones, ...prev]);
  }, [commitRows, issueTempId]);

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      commitRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
        }),
      );
    },
    [commitRows],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<AdminGridRow>) => {
      const changed = event.data;
      if (!changed) return;

      commitRows((prev) =>
        prev.map((row) => {
          if (row.employee_id !== changed.employee_id || row.id !== changed.id) {
            return row;
          }
          const merged: AdminGridRow = {
            ...row,
            ...changed,
            _original: row._original,
            _prevStatus: row._prevStatus,
          };
          return reconcileUpdatedStatus(merged, {
            shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
          });
        }),
      );
    },
    [commitRows],
  );

  const saveAll = useCallback(async () => {
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated" && row.id > 0);

    if (toDelete.length + toInsert.length + toUpdate.length === 0) {
      toast.info("변경된 데이터가 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await runConcurrentOrThrow(
        "삭제",
        toDelete.map((row) => async () => {
          const rowCategory = row.category || category;
          const response = await fetch(
            `/api/hr/basic/${row.employee_id}/records/${row.id}?category=${encodeURIComponent(rowCategory)}`,
            { method: "DELETE" },
          );
          if (!response.ok) {
            throw new Error(await parseErrorDetail(response, `${row.employee_no} 삭제 실패`));
          }
        }),
        6,
      );

      await runConcurrentOrThrow(
        "수정",
        toUpdate.map((row) => async () => {
          const rowCategory = row.category || category;
          const response = await fetch(`/api/hr/basic/${row.employee_id}/records/${row.id}?category=${encodeURIComponent(rowCategory)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              record_date: row.record_date || null,
              type: row.type || null,
              title: row.title || null,
              organization: row.organization || null,
              value: row.value || null,
              note: row.note || null,
            }),
          });
          if (!response.ok) {
            throw new Error(await parseErrorDetail(response, `${row.employee_no} 수정 실패`));
          }
        }),
        6,
      );

      await runConcurrentOrThrow(
        "입력",
        toInsert.map((row) => async () => {
          const response = await fetch(`/api/hr/basic/${row.employee_id}/records`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: row.category || category,
              record_date: row.record_date || null,
              type: row.type || null,
              title: row.title || null,
              organization: row.organization || null,
              value: row.value || null,
              note: row.note || null,
            }),
          });
          if (!response.ok) {
            throw new Error(await parseErrorDetail(response, `${row.employee_no} 입력 실패`));
          }
        }),
        6,
      );

      toast.success(`저장 완료 (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`);
      await refresh(appliedFilters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [appliedFilters, category, refresh, rows]);

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = ["사번", "일자", "구분", "제목", "기관/부서", "값", "비고"];
      const sample = ["EMP0001", "2026-01-01", "예시구분", "예시제목", "예시기관", "예시값", "메모"];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, `${category}-records-template.xlsx`);
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, [category]);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = [
        "상태",
        "사번",
        "이름",
        "부서",
        "재직상태",
        "일자",
        "구분",
        "제목",
        "기관/부서",
        "값",
        "비고",
      ];
      const data = rows.map((row) => [
        row._status,
        row.employee_no,
        row.display_name,
        row.department_name,
        row.employment_status,
        row.record_date ?? "",
        row.type ?? "",
        row.title ?? "",
        row.organization ?? "",
        row.value ?? "",
        row.note ?? "",
      ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...data]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "관리시트");
      writeFileXLSX(book, `${category}-records-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }, [category, rows]);

  const handleUploadFile = useCallback(
    async (file: File) => {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });

        if (!rowsAoa || rowsAoa.length <= 1) return;

        const parsed: AdminGridRow[] = [];
        let skipped = 0;

        for (const cells of rowsAoa.slice(1)) {
          const c = cells.map((value) => String(value ?? "").trim());
          if (!c.some((value) => value.length > 0)) continue;

          const employeeNo = c[0] ?? "";
          const employee = employeeByNo.get(employeeNo);
          if (!employee) {
            skipped += 1;
            continue;
          }

          parsed.push({
            id: issueTempId(),
            category,
            employee_id: employee.id,
            employee_no: employee.employee_no,
            display_name: employee.display_name,
            department_name: employee.department_name,
            employment_status: employee.employment_status,
            record_date: c[1] || null,
            type: c[2] || null,
            title: c[3] || null,
            organization: c[4] || null,
            value: c[5] || null,
            note: c[6] || null,
            created_at: new Date().toISOString(),
            _status: "added",
            _original: undefined,
            _prevStatus: undefined,
          });
        }

        if (parsed.length === 0) {
          toast.error("유효한 업로드 행이 없습니다. 사번 값을 확인해 주세요.");
          return;
        }

        commitRows((prev) => [...parsed, ...prev]);

        if (skipped > 0) {
          toast.info(`업로드 ${parsed.length}건, 사번 불일치 ${skipped}건 제외`);
        }
      } catch {
        toast.error("업로드에 실패했습니다.");
      }
    },
    [category, commitRows, employeeByNo, issueTempId],
  );

  const columnDefs = useMemo<ColDef<AdminGridRow>[]>(() => {
    return [
      {
        headerName: "삭제",
        width: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams<AdminGridRow>) => {
          const row = params.data;
          if (!row) return null;
          const checked = row._status === "deleted";
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
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
      { field: "employee_no", headerName: "사번", width: 130, pinned: "left", editable: false },
      { field: "display_name", headerName: "이름", width: 130, pinned: "left", editable: false },
      { field: "department_name", headerName: "부서", width: 150, pinned: "left", editable: false },
      {
        field: "employment_status",
        headerName: "재직상태",
        width: 110,
        editable: false,
        valueFormatter: (params) =>
          params.value === "leave" ? "휴직" : params.value === "resigned" ? "퇴직" : "재직",
      },
      {
        field: "record_date",
        headerName: "일자",
        flex: 1,
        minWidth: 130,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "type",
        headerName: "구분",
        flex: 1,
        minWidth: 130,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "title",
        headerName: "제목",
        flex: 1.2,
        minWidth: 150,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "organization",
        headerName: "기관/부서",
        flex: 1.2,
        minWidth: 150,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "value",
        headerName: "값",
        flex: 1,
        minWidth: 150,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "note",
        headerName: "비고",
        flex: 1.5,
        minWidth: 180,
        editable: (params) => params.data?._status !== "deleted",
      },
    ];
  }, [toggleDeleteById]);

  const getRowClass = useCallback((params: RowClassParams<AdminGridRow>) => {
    return getGridRowClass(params.data?._status);
  }, []);

  const toolbarActions = [
    {
      key: "create",
      label: "입력",
      icon: Plus,
      onClick: addRow,
      disabled: loading || saving,
    },
    {
      key: "copy",
      label: "복사",
      icon: Copy,
      onClick: copyRows,
      disabled: loading || saving,
    },
    {
      key: "template",
      label: "양식 다운로드",
      icon: FileDown,
      onClick: () => void downloadTemplate(),
      disabled: loading || saving,
    },
    {
      key: "upload",
      label: "업로드",
      icon: Upload,
      onClick: () => uploadInputRef.current?.click(),
      disabled: loading || saving,
    },
    {
      key: "save",
      label: saving ? "저장중..." : "저장",
      icon: Save,
      onClick: () => void saveAll(),
      disabled: loading || saving,
      variant: "save" as const,
    },
    {
      key: "download",
      label: "다운로드",
      icon: Download,
      onClick: () => void downloadCurrentSheet(),
      disabled: loading || saving,
    },
  ];

  function onGridReady(event: GridReadyEvent<AdminGridRow>) {
    gridApiRef.current = event.api;
  }

  function handleSearchEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleQuery();
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title={title} onQuery={handleQuery} queryLabel="조회" queryDisabled={loading || saving}>
        <SearchFieldGrid className="xl:grid-cols-4">
          <div>
            <SearchTextField
              value={searchFilters.employeeNo}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, employeeNo: value }))}
              onKeyDown={handleSearchEnter}
              placeholder={SEARCH_PLACEHOLDERS.employeeNo}
            />
          </div>
          <div>
            <SearchTextField
              value={searchFilters.name}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))}
              onKeyDown={handleSearchEnter}
              placeholder={SEARCH_PLACEHOLDERS.employeeName}
            />
          </div>
          <div>
            <select
              value={searchFilters.department}
              onChange={(event) => setSearchFilters((prev) => ({ ...prev, department: event.target.value }))}
              onKeyDown={handleSearchEnter}
              aria-label={SEARCH_PLACEHOLDERS.departmentName}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">전체 부서</option>
              {departmentOptions.map((departmentName) => (
                <option key={departmentName} value={departmentName}>
                  {departmentName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={searchFilters.employmentStatus}
              onChange={(event) =>
                setSearchFilters((prev) => ({
                  ...prev,
                  employmentStatus: event.target.value as SearchFilters["employmentStatus"],
                }))
              }
              onKeyDown={handleSearchEnter}
              aria-label={SEARCH_PLACEHOLDERS.employmentStatus}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">전체 재직상태</option>
              <option value="active">재직</option>
              <option value="leave">휴직</option>
              <option value="resigned">퇴직</option>
            </select>
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
              disabled={loading || saving}
              className="mt-0 justify-start"
            />
            <span className="text-xs text-slate-500">총 {rows.length.toLocaleString()}건</span>
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
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 px-3 pb-4 pt-2 md:px-6 md:pt-0">
          <div className="ag-theme-quartz vibe-grid vibe-grid-no-pinned-divider h-full w-full min-h-[420px] overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<AdminGridRow>
              theme="legacy"
              rowData={pagedRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="multiple"
              suppressRowClickSelection={false}
              singleClickEdit
              animateRows={false}
              getRowClass={getRowClass}
              getRowId={(params) => `${params.data.employee_id}-${params.data.id}`}
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

