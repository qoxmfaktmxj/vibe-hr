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
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { fetcher } from "@/lib/fetcher";
import { getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import { runConcurrentOrThrow } from "@/lib/utils/run-concurrent";
import type { HrAppointmentCodeItem, HrAppointmentCodeListResponse } from "@/types/hr-appointment-code";

type RowStatus = GridRowStatus;

type AppointmentCodeRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  mapping_key: string | null;
  mapping_value: string | null;
  created_at: string;
  updated_at: string;
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

type SearchFilters = {
  code: string;
  name: string;
  mappingKey: string;
};

const EMPTY_FILTERS: SearchFilters = {
  code: "",
  name: "",
  mappingKey: "",
};

const TRACKED_FIELDS: (keyof HrAppointmentCodeItem)[] = [
  "code",
  "name",
  "mapping_key",
  "mapping_value",
  "description",
  "sort_order",
  "is_active",
];

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

function isRevertedToOriginal(row: AppointmentCodeRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function HrAppointmentCodeManager() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AppointmentCodeRow[]>([]);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<AppointmentCodeRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);
  const rowsRef = useRef<AppointmentCodeRow[]>([]);

  const { data, isLoading, mutate } = useSWR<HrAppointmentCodeListResponse>(
    "/api/hr/appointment-codes",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  useEffect(() => {
    if (!data) return;
    const nextRows = (data.items ?? []).map((row) => ({
      ...row,
      _status: "clean" as const,
      _original: snapshotFields(row, TRACKED_FIELDS),
      _prevStatus: undefined,
    }));
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, [data]);

  const getRowKey = useCallback((row: AppointmentCodeRow) => String(row.id), []);

  const applyGridTransaction = useCallback(
    (prevRows: AppointmentCodeRow[], nextRows: AppointmentCodeRow[]) => {
      const api = gridApiRef.current;
      if (!api) return;

      const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
      const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
      const add: AppointmentCodeRow[] = [];
      const update: AppointmentCodeRow[] = [];
      const remove: AppointmentCodeRow[] = [];

      for (const row of nextRows) {
        const previous = prevMap.get(getRowKey(row));
        if (!previous) {
          add.push(row);
          continue;
        }
        if (previous !== row) {
          update.push(row);
        }
      }

      for (const row of prevRows) {
        if (!nextMap.has(getRowKey(row))) {
          remove.push(row);
        }
      }

      if (add.length === 0 && update.length === 0 && remove.length === 0) return;

      api.applyTransaction({
        add: add.length > 0 ? add : undefined,
        update: update.length > 0 ? update : undefined,
        remove: remove.length > 0 ? remove : undefined,
        addIndex: add.length > 0 ? 0 : undefined,
      });
    },
    [getRowKey],
  );

  const commitRows = useCallback(
    (updater: (prevRows: AppointmentCodeRow[]) => AppointmentCodeRow[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
      applyGridTransaction(prevRows, nextRows);
    },
    [applyGridTransaction],
  );

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const defaultColDef = useMemo<ColDef<AppointmentCodeRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: true,
    }),
    [],
  );

  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);

  const filteredRows = useMemo(() => {
    const code = appliedFilters.code.trim().toLowerCase();
    const name = appliedFilters.name.trim().toLowerCase();
    const mappingKey = appliedFilters.mappingKey.trim().toLowerCase();

    return rows.filter((row) => {
      if (code && !row.code.toLowerCase().includes(code)) return false;
      if (name && !row.name.toLowerCase().includes(name)) return false;
      if (mappingKey && !(row.mapping_key ?? "").toLowerCase().includes(mappingKey)) return false;
      return true;
    });
  }, [appliedFilters, rows]);

  const patchRowById = useCallback(
    (rowId: number, patch: Partial<AppointmentCodeRow>) => {
      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const merged: AppointmentCodeRow = {
            ...row,
            ...patch,
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

  const addRow = useCallback(() => {
    const newRow: AppointmentCodeRow = {
      id: issueTempId(),
      code: "",
      name: "",
      description: "",
      is_active: true,
      sort_order: 0,
      mapping_key: "",
      mapping_value: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };
    commitRows((prev) => [newRow, ...prev]);
  }, [commitRows, issueTempId]);

  const copyRows = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selected.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const clones = selected.map<AppointmentCodeRow>((row) => ({
      ...row,
      id: issueTempId(),
      code: `${row.code}_COPY`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
    (event: CellValueChangedEvent<AppointmentCodeRow>) => {
      const changed = event.data;
      if (!changed) return;
      patchRowById(changed.id, changed);
    },
    [patchRowById],
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
          const response = await fetch(`/api/hr/appointment-codes/${row.id}`, { method: "DELETE" });
          if (!response.ok) {
            throw new Error(await parseErrorDetail(response, `${row.code} 삭제 실패`));
          }
        }),
        6,
      );

      await runConcurrentOrThrow(
        "수정",
        toUpdate.map((row) => async () => {
          const response = await fetch(`/api/hr/appointment-codes/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code,
              name: row.name,
              description: row.description || null,
              is_active: row.is_active,
              sort_order: Number(row.sort_order || 0),
              mapping_key: row.mapping_key || null,
              mapping_value: row.mapping_value || null,
            }),
          });
          if (!response.ok) {
            throw new Error(await parseErrorDetail(response, `${row.code} 수정 실패`));
          }
        }),
        6,
      );

      await runConcurrentOrThrow(
        "입력",
        toInsert.map((row) => async () => {
          const response = await fetch("/api/hr/appointment-codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code,
              name: row.name,
              description: row.description || null,
              is_active: row.is_active,
              sort_order: Number(row.sort_order || 0),
              mapping_key: row.mapping_key || null,
              mapping_value: row.mapping_value || null,
            }),
          });
          if (!response.ok) {
            throw new Error(await parseErrorDetail(response, `${row.code || "(신규)"} 입력 실패`));
          }
        }),
        6,
      );

      toast.success(`저장 완료 (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [mutate, rows]);

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = ["코드", "코드명", "반영필드", "반영값", "설명", "정렬순서", "사용(Y/N)"];
      const sample = ["PROMOTION", "승진", "position_title", "과장", "정기 승진 코드", "10", "Y"];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "발령코드");
      writeFileXLSX(book, "appointment-codes-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, []);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = ["상태", "코드", "코드명", "반영필드", "반영값", "설명", "정렬순서", "사용"];
      const dataRows = rows.map((row) => [
        row._status,
        row.code,
        row.name,
        row.mapping_key ?? "",
        row.mapping_value ?? "",
        row.description ?? "",
        row.sort_order,
        row.is_active ? "Y" : "N",
      ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...dataRows]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "발령코드관리");
      writeFileXLSX(book, `appointment-codes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }, [rows]);

  const handleUploadFile = useCallback(
    async (file: File) => {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });
        if (!rowsAoa || rowsAoa.length <= 1) return;

        const parsed: AppointmentCodeRow[] = [];
        for (const cells of rowsAoa.slice(1)) {
          const c = cells.map((value) => String(value ?? "").trim());
          if (!c.some((value) => value.length > 0)) continue;

          const activeRaw = (c[6] ?? "").toLowerCase();
          const isActive = activeRaw === "y" || activeRaw === "true" || activeRaw === "1";

          parsed.push({
            id: issueTempId(),
            code: c[0] ?? "",
            name: c[1] ?? "",
            mapping_key: c[2] ?? "",
            mapping_value: c[3] ?? "",
            description: c[4] ?? "",
            sort_order: Number(c[5] || 0),
            is_active: isActive,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _status: "added",
            _original: undefined,
            _prevStatus: undefined,
          });
        }

        if (parsed.length === 0) {
          toast.error("업로드할 유효 데이터가 없습니다.");
          return;
        }

        commitRows((prev) => [...parsed, ...prev]);
        toast.success(`${parsed.length}건 업로드 반영 완료`);
      } catch {
        toast.error("업로드에 실패했습니다.");
      }
    },
    [commitRows, issueTempId],
  );

  const columnDefs = useMemo<ColDef<AppointmentCodeRow>[]>(() => {
    return [
      {
        headerName: "삭제",
        width: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams<AppointmentCodeRow>) => {
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
      {
        field: "code",
        headerName: "코드",
        minWidth: 140,
        pinned: "left",
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "name",
        headerName: "코드명",
        minWidth: 160,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "mapping_key",
        headerName: "반영필드",
        minWidth: 140,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "mapping_value",
        headerName: "반영값",
        minWidth: 140,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "description",
        headerName: "설명",
        flex: 1,
        minWidth: 180,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "sort_order",
        headerName: "정렬",
        width: 90,
        editable: (params) => params.data?._status !== "deleted",
        valueParser: (params) => Number(params.newValue || 0),
      },
      {
        field: "is_active",
        headerName: "사용",
        width: 90,
        editable: false,
        cellRenderer: (params: ICellRendererParams<AppointmentCodeRow>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={Boolean(row.is_active)}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-blue)]"
                disabled={row._status === "deleted"}
                onChange={(event) => patchRowById(row.id, { is_active: event.target.checked })}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          );
        },
      },
    ];
  }, [patchRowById, toggleDeleteById]);

  const getRowClass = useCallback((params: RowClassParams<AppointmentCodeRow>) => {
    return getGridRowClass(params.data?._status);
  }, []);

  const toolbarActions = [
    {
      key: "create",
      label: "입력",
      icon: Plus,
      onClick: addRow,
      disabled: isLoading || saving,
    },
    {
      key: "copy",
      label: "복사",
      icon: Copy,
      onClick: copyRows,
      disabled: isLoading || saving,
    },
    {
      key: "template",
      label: "양식 다운로드",
      icon: FileDown,
      onClick: () => void downloadTemplate(),
      disabled: isLoading || saving,
    },
    {
      key: "upload",
      label: "업로드",
      icon: Upload,
      onClick: () => uploadInputRef.current?.click(),
      disabled: isLoading || saving,
    },
    {
      key: "save",
      label: saving ? "저장중..." : "저장",
      icon: Save,
      onClick: () => void saveAll(),
      disabled: isLoading || saving,
      variant: "save" as const,
    },
    {
      key: "download",
      label: "다운로드",
      icon: Download,
      onClick: () => void downloadCurrentSheet(),
      disabled: isLoading || saving,
    },
  ];

  function onGridReady(event: GridReadyEvent<AppointmentCodeRow>) {
    gridApiRef.current = event.api;
  }

  function handleQuery() {
    setAppliedFilters({ ...searchFilters });
  }

  function handleSearchEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleQuery();
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="발령코드관리" onQuery={handleQuery} queryLabel="조회" queryDisabled={isLoading || saving}>
        <SearchFieldGrid className="xl:grid-cols-3">
          <SearchTextField
            value={searchFilters.code}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, code: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="코드"
          />
          <SearchTextField
            value={searchFilters.name}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="코드명"
          />
          <SearchTextField
            value={searchFilters.mappingKey}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, mappingKey: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="반영필드"
          />
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={(
          <>
            <span className="text-xs text-slate-400">조회 {filteredRows.length.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} className="ml-2" />
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
          <div className="ag-theme-quartz vibe-grid h-full w-full min-h-[420px] overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<AppointmentCodeRow>
              theme="legacy"
              rowData={filteredRows}
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
              loading={isLoading}
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

