"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
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
import type {
  TraColumnConfig,
  TraResourceBatchPayload,
  TraResourceBatchResponse,
  TraResourceListResponse,
  TraResourceRow,
  TraScreenConfig,
} from "@/types/tra";

type RowStatus = GridRowStatus;

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "추가",
  updated: "수정",
  deleted: "삭제",
};

type TraResourceManagerProps = {
  config: TraScreenConfig;
};

function parseBooleanCell(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["y", "yes", "1", "true"].includes(value.toLowerCase().trim());
  return false;
}

function normalizeForApi(row: TraResourceRow): Record<string, unknown> {
  const payload = { ...row } as Record<string, unknown>;
  delete payload._original;
  delete payload._prevStatus;
  return payload;
}

function normalizeUploadedValue(column: TraColumnConfig, value: string): unknown {
  if (value.trim() === "") {
    return column.type === "boolean" ? false : null;
  }
  if (column.type === "number") return Number(value);
  if (column.type === "boolean") return parseBooleanCell(value);
  return value;
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
  return (
    stringifyErrorDetail(record.detail) ??
    stringifyErrorDetail(record.message) ??
    stringifyErrorDetail(record.error) ??
    null
  );
}

export function TraResourceManager({ config }: TraResourceManagerProps) {
  const [rows, setRows] = useState<TraResourceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>(
    Object.fromEntries(config.searchFields.map((field) => [field.key, ""])),
  );
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(
    Object.fromEntries(config.searchFields.map((field) => [field.key, ""])),
  );

  const gridApiRef = useRef<GridApi<TraResourceRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const rowsRef = useRef<TraResourceRow[]>([]);
  const tempIdRef = useRef(-1);

  const trackedFields = useMemo(
    () => config.columns.map((column) => column.field as keyof TraResourceRow),
    [config.columns],
  );

  const { data, isLoading, mutate } = useSWR<TraResourceListResponse>(`/api/tra/${config.resource}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    const nextRows = (data.items ?? []).map((item) => {
      const rawId = item.id;
      const normalizedId = typeof rawId === "number" ? rawId : Number(rawId ?? 0);
      const row = {
        ...item,
        id: Number.isNaN(normalizedId) ? 0 : normalizedId,
      } as TraResourceRow;
      row._status = "clean";
      row._original = snapshotFields(row, trackedFields);
      row._prevStatus = undefined;
      return row;
    });
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, [data, trackedFields]);

  const commitRows = useCallback((updater: (prevRows: TraResourceRow[]) => TraResourceRow[]) => {
    const prevRows = rowsRef.current;
    const nextRows = updater(prevRows);
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, []);

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (!value.trim()) continue;
        const rowValue = String(row[key] ?? "").toLowerCase();
        if (!rowValue.includes(value.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [appliedFilters, rows]);

  const patchRowById = useCallback(
    (rowId: number, patch: Partial<TraResourceRow>) => {
      commitRows((prevRows) =>
        prevRows.map((row) => {
          if (row.id !== rowId) return row;
          const merged: TraResourceRow = {
            ...row,
            ...patch,
            _original: row._original,
            _prevStatus: row._prevStatus,
          };
          return reconcileUpdatedStatus(merged, {
            shouldBeClean: (candidate) => isRowRevertedToOriginal(candidate, trackedFields),
          });
        }),
      );
    },
    [commitRows, trackedFields],
  );

  const addRow = useCallback(() => {
    const row: TraResourceRow = {
      id: issueTempId(),
      ...config.defaultRow,
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };
    commitRows((prevRows) => [row, ...prevRows]);
  }, [commitRows, config.defaultRow, issueTempId]);

  const copyRows = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selected.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const clones = selected.map<TraResourceRow>((row) => ({
      ...row,
      id: issueTempId(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    }));
    commitRows((prevRows) => [...clones, ...prevRows]);
  }, [commitRows, issueTempId]);

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      commitRows((prevRows) =>
        toggleDeletedStatus(prevRows, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRowRevertedToOriginal(candidate, trackedFields),
        }),
      );
    },
    [commitRows, trackedFields],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TraResourceRow>) => {
      const changed = event.data;
      if (!changed) return;
      patchRowById(changed.id, changed);
    },
    [patchRowById],
  );

  const saveAll = useCallback(async () => {
    const dirtyRows = rows
      .filter((row) => row._status !== "clean")
      .map((row) => normalizeForApi(row));

    if (dirtyRows.length === 0) {
      toast.info("변경된 행이 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const payload: TraResourceBatchPayload = { items: dirtyRows };
      const response = await fetch(`/api/tra/${config.resource}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(stringifyErrorDetail(result) ?? "저장에 실패했습니다.");
      }
      const batch = result as TraResourceBatchResponse;
      toast.success(`저장 완료 (추가 ${batch.created}, 수정 ${batch.updated}, 삭제 ${batch.deleted})`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [config.resource, mutate, rows]);

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = config.columns.map((column) => column.headerName);
      const sample = config.columns.map((column) => {
        const value = config.defaultRow[column.field];
        return value ?? "";
      });
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "template");
      writeFileXLSX(book, `tra-${config.resource}-template.xlsx`);
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, [config.columns, config.defaultRow, config.resource]);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = ["상태", ...config.columns.map((column) => column.headerName)];
      const dataRows = filteredRows.map((row) => [row._status, ...config.columns.map((column) => row[column.field] ?? "")]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...dataRows]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "data");
      writeFileXLSX(book, `tra-${config.resource}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }, [config.columns, config.resource, filteredRows]);

  const handleUploadFile = useCallback(
    async (file: File) => {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });
        if (!rowsAoa || rowsAoa.length <= 1) return;

        const parsed: TraResourceRow[] = [];
        for (const cells of rowsAoa.slice(1)) {
          const cellValues = cells.map((cell) => String(cell ?? "").trim());
          if (!cellValues.some((value) => value.length > 0)) continue;

          const row: TraResourceRow = {
            id: issueTempId(),
            _status: "added",
            _original: undefined,
            _prevStatus: undefined,
          };
          config.columns.forEach((column, idx) => {
            row[column.field] = normalizeUploadedValue(column, cellValues[idx] ?? "");
          });
          parsed.push(row);
        }

        if (parsed.length === 0) {
          toast.error("업로드 가능한 행이 없습니다.");
          return;
        }

        commitRows((prevRows) => [...parsed, ...prevRows]);
        toast.success(`${parsed.length}건 업로드되었습니다.`);
      } catch {
        toast.error("업로드에 실패했습니다.");
      }
    },
    [commitRows, config.columns, issueTempId],
  );

  const columnDefs = useMemo<ColDef<TraResourceRow>[]>(() => {
    const mappedCols = config.columns.map<ColDef<TraResourceRow>>((column) => {
      const editable = column.editable ?? true;
      const base: ColDef<TraResourceRow> = {
        field: column.field,
        headerName: column.headerName,
        minWidth: column.minWidth,
        width: column.width,
        flex: column.flex,
        editable: (params) => editable && params.data?._status !== "deleted",
      };

      if (column.type === "number") {
        base.valueParser = (params) => {
          const parsed = Number(params.newValue ?? 0);
          return Number.isNaN(parsed) ? 0 : parsed;
        };
      }

      if (column.type === "boolean") {
        base.editable = false;
        base.cellRenderer = (params: ICellRendererParams<TraResourceRow>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={parseBooleanCell(row[column.field])}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-blue)]"
                disabled={row._status === "deleted"}
                onChange={(event) => patchRowById(row.id, { [column.field]: event.target.checked })}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          );
        };
      }

      return base;
    });

    return [
      {
        headerName: "삭제",
        width: 64,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams<TraResourceRow>) => {
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
        width: 88,
        pinned: "left",
        editable: false,
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      ...mappedCols,
    ];
  }, [config.columns, patchRowById, toggleDeleteById]);

  const defaultColDef = useMemo<ColDef<TraResourceRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: true,
    }),
    [],
  );

  const getRowClass = useCallback((params: RowClassParams<TraResourceRow>) => {
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

  function handleQuery() {
    setAppliedFilters({ ...searchFilters });
  }

  function handleSearchEnter(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleQuery();
  }

  function onGridReady(event: GridReadyEvent<TraResourceRow>) {
    gridApiRef.current = event.api;
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title={config.title} onQuery={handleQuery} queryLabel="조회" queryDisabled={isLoading || saving}>
        <SearchFieldGrid className={config.searchFields.length >= 3 ? "xl:grid-cols-3" : undefined}>
          {config.searchFields.map((searchField) => (
            <SearchTextField
              key={searchField.key}
              value={searchFilters[searchField.key] ?? ""}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, [searchField.key]: value }))}
              onKeyDown={handleSearchEnter}
              placeholder={searchField.placeholder}
            />
          ))}
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={(
          <>
            <span className="text-xs text-slate-500">총 {filteredRows.length.toLocaleString()}건</span>
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
            <AgGridReact<TraResourceRow>
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
