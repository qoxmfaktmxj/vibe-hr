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
import useSWR from "swr";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { fetcher } from "@/lib/fetcher";
import { getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type { PapAppraisalItem, PapAppraisalListResponse } from "@/types/pap-appraisal";
import type { PapFinalResultListResponse } from "@/types/pap-final-result";

let modulesRegistered = false;
if (!modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  modulesRegistered = true;
}

type RowStatus = GridRowStatus;

type PapAppraisalRow = {
  id: number;
  appraisal_code: string;
  appraisal_name: string;
  appraisal_year: number;
  final_result_id: number | null;
  final_result_code: string | null;
  final_result_name: string | null;
  appraisal_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

type SearchFilters = {
  code: string;
  name: string;
  year: string;
  active: "" | "active" | "inactive";
};

const EMPTY_FILTERS: SearchFilters = {
  code: "",
  name: "",
  year: "",
  active: "",
};

const TRACKED_FIELDS: (keyof PapAppraisalItem)[] = [
  "appraisal_code",
  "appraisal_name",
  "appraisal_year",
  "final_result_id",
  "appraisal_type",
  "start_date",
  "end_date",
  "is_active",
  "sort_order",
  "description",
];

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "Added",
  updated: "Updated",
  deleted: "Deleted",
};

function isRevertedToOriginal(row: PapAppraisalRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function PapAppraisalManager() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<PapAppraisalRow[]>([]);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<PapAppraisalRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);

  const { data, isLoading, mutate } = useSWR<PapAppraisalListResponse>("/api/pap/appraisals", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const { data: finalResultData } = useSWR<PapFinalResultListResponse>("/api/pap/final-results", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const finalResults = useMemo(() => finalResultData?.items ?? [], [finalResultData?.items]);
  const finalResultLabelById = useMemo(
    () =>
      new Map(
        finalResults.map((item) => [item.id, `${item.result_code} - ${item.result_name}`]),
      ),
    [finalResults],
  );
  const finalResultCodeToId = useMemo(
    () =>
      new Map(
        finalResults.map((item) => [item.result_code.trim().toUpperCase(), item.id]),
      ),
    [finalResults],
  );
  const finalResultById = useMemo(
    () =>
      new Map(
        finalResults.map((item) => [item.id, item]),
      ),
    [finalResults],
  );
  const finalResultValueOptions = useMemo(
    () => ["", ...finalResults.map((item) => String(item.id))],
    [finalResults],
  );

  useEffect(() => {
    if (!data) return;
    const nextRows = (data.items ?? []).map((row) => ({
      ...row,
      _status: "clean" as const,
      _original: snapshotFields(row, TRACKED_FIELDS),
      _prevStatus: undefined,
    }));
    setRows(nextRows);
  }, [data]);

  const redrawRows = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.redrawRows();
  }, []);

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const defaultColDef = useMemo<ColDef<PapAppraisalRow>>(
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
    const year = Number(appliedFilters.year.trim());

    return rows.filter((row) => {
      if (code && !row.appraisal_code.toLowerCase().includes(code)) return false;
      if (name && !row.appraisal_name.toLowerCase().includes(name)) return false;
      if (!Number.isNaN(year) && appliedFilters.year.trim() && row.appraisal_year !== year) return false;
      if (appliedFilters.active === "active" && !row.is_active) return false;
      if (appliedFilters.active === "inactive" && row.is_active) return false;
      return true;
    });
  }, [appliedFilters, rows]);

  const patchRowById = useCallback(
    (rowId: number, patch: Partial<PapAppraisalRow>) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const merged: PapAppraisalRow = {
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
      redrawRows();
    },
    [redrawRows],
  );

  const addRow = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const newRow: PapAppraisalRow = {
      id: issueTempId(),
      appraisal_code: "",
      appraisal_name: "",
      appraisal_year: new Date().getFullYear(),
      final_result_id: null,
      final_result_code: null,
      final_result_name: null,
      appraisal_type: "annual",
      start_date: today,
      end_date: today,
      is_active: true,
      sort_order: 0,
      description: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };
    setRows((prev) => [newRow, ...prev]);
    redrawRows();
  }, [issueTempId, redrawRows]);

  const copyRows = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selected.length === 0) {
      toast.error("Select rows to copy.");
      return;
    }

    const clones = selected.map<PapAppraisalRow>((row) => ({
      ...row,
      id: issueTempId(),
      appraisal_code: `${row.appraisal_code}_COPY`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    }));
    setRows((prev) => [...clones, ...prev]);
    redrawRows();
  }, [issueTempId, redrawRows]);

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      setRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
        }),
      );
      redrawRows();
    },
    [redrawRows],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<PapAppraisalRow>) => {
      const changed = event.data;
      if (!changed) return;
      if (event.colDef.field === "final_result_id") {
        const finalResult = changed.final_result_id != null ? finalResultById.get(changed.final_result_id) : undefined;
        patchRowById(changed.id, {
          ...changed,
          final_result_code: finalResult?.result_code ?? null,
          final_result_name: finalResult?.result_name ?? null,
        });
        return;
      }
      patchRowById(changed.id, changed);
    },
    [finalResultById, patchRowById],
  );

  const saveAll = useCallback(async () => {
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated" && row.id > 0);

    if (toDelete.length + toInsert.length + toUpdate.length === 0) {
      toast.info("No pending changes.");
      return;
    }

    const dirtyRows = [...toInsert, ...toUpdate];
    for (const row of dirtyRows) {
      if (!row.appraisal_code.trim()) {
        toast.error("appraisal_code is required.");
        return;
      }
      if (!row.appraisal_name.trim()) {
        toast.error("appraisal_name is required.");
        return;
      }
      if (!Number.isFinite(row.appraisal_year)) {
        toast.error("appraisal_year is required.");
        return;
      }
      if (row.final_result_id == null) {
        toast.error("final_result_id is required.");
        return;
      }
    }

    setSaving(true);
    try {
      for (const row of toDelete) {
        const response = await fetch(`/api/pap/appraisals/${row.id}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, `${row.appraisal_code} delete failed`));
        }
      }

      for (const row of toUpdate) {
        const response = await fetch(`/api/pap/appraisals/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appraisal_code: row.appraisal_code.trim(),
            appraisal_name: row.appraisal_name.trim(),
            appraisal_year: Number(row.appraisal_year),
            final_result_id: row.final_result_id,
            appraisal_type: row.appraisal_type || null,
            start_date: row.start_date || null,
            end_date: row.end_date || null,
            is_active: row.is_active,
            sort_order: Number(row.sort_order || 0),
            description: row.description || null,
          }),
        });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, `${row.appraisal_code} update failed`));
        }
      }

      for (const row of toInsert) {
        const response = await fetch("/api/pap/appraisals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appraisal_code: row.appraisal_code.trim(),
            appraisal_name: row.appraisal_name.trim(),
            appraisal_year: Number(row.appraisal_year),
            final_result_id: row.final_result_id,
            appraisal_type: row.appraisal_type || null,
            start_date: row.start_date || null,
            end_date: row.end_date || null,
            is_active: row.is_active,
            sort_order: Number(row.sort_order || 0),
            description: row.description || null,
          }),
        });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, `${row.appraisal_code || "(new)"} create failed`));
        }
      }

      toast.success(
        `Saved successfully (create ${toInsert.length}, update ${toUpdate.length}, delete ${toDelete.length})`,
      );
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [mutate, rows]);

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = [
        "appraisal_code",
        "appraisal_name",
        "appraisal_year",
        "final_result_code",
        "appraisal_type",
        "start_date",
        "end_date",
        "sort_order",
        "is_active(Y/N)",
        "description",
      ];
      const sample = [
        "ANNUAL_A",
        "Annual Performance Review",
        "2026",
        "A",
        "annual",
        "2026-01-01",
        "2026-12-31",
        "10",
        "Y",
        "Default annual cycle",
      ];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "pap-appraisals");
      writeFileXLSX(book, "pap-appraisals-template.xlsx");
    } catch {
      toast.error("Failed to download template.");
    }
  }, []);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = [
        "status",
        "appraisal_code",
        "appraisal_name",
        "appraisal_year",
        "final_result_code",
        "appraisal_type",
        "start_date",
        "end_date",
        "sort_order",
        "is_active",
        "description",
      ];
      const dataRows = rows.map((row) => [
        row._status,
        row.appraisal_code,
        row.appraisal_name,
        row.appraisal_year,
        row.final_result_id != null
          ? finalResults.find((item) => item.id === row.final_result_id)?.result_code ?? ""
          : "",
        row.appraisal_type ?? "",
        row.start_date ?? "",
        row.end_date ?? "",
        row.sort_order,
        row.is_active ? "Y" : "N",
        row.description ?? "",
      ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...dataRows]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "pap-appraisals");
      writeFileXLSX(book, `pap-appraisals-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Failed to download file.");
    }
  }, [finalResults, rows]);

  const handleUploadFile = useCallback(
    async (file: File) => {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });
        if (!rowsAoa || rowsAoa.length <= 1) return;

        const parsed: PapAppraisalRow[] = [];
        for (const cells of rowsAoa.slice(1)) {
          const c = cells.map((value) => String(value ?? "").trim());
          if (!c.some((value) => value.length > 0)) continue;

          const activeRaw = (c[8] ?? "").toLowerCase();
          const isActive = activeRaw === "y" || activeRaw === "true" || activeRaw === "1";
          const finalResultCode = (c[3] ?? "").toUpperCase();
          const finalResultId = finalResultCodeToId.get(finalResultCode) ?? null;
          const finalResult = finalResults.find((item) => item.id === finalResultId);

          parsed.push({
            id: issueTempId(),
            appraisal_code: c[0] ?? "",
            appraisal_name: c[1] ?? "",
            appraisal_year: Number(c[2] || new Date().getFullYear()),
            final_result_id: finalResultId,
            final_result_code: finalResult?.result_code ?? null,
            final_result_name: finalResult?.result_name ?? null,
            appraisal_type: c[4] || "",
            start_date: c[5] || "",
            end_date: c[6] || "",
            sort_order: Number(c[7] || 0),
            is_active: isActive,
            description: c[9] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _status: "added",
            _original: undefined,
            _prevStatus: undefined,
          });
        }

        if (parsed.length === 0) {
          toast.error("No valid rows found in upload file.");
          return;
        }

        setRows((prev) => [...parsed, ...prev]);
        redrawRows();
        toast.success(`${parsed.length} rows imported as new rows.`);
      } catch {
        toast.error("Upload failed.");
      }
    },
    [finalResultCodeToId, finalResults, issueTempId, redrawRows],
  );

  const columnDefs = useMemo<ColDef<PapAppraisalRow>[]>(() => {
    return [
      {
        headerName: "Del",
        width: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams<PapAppraisalRow>) => {
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
        headerName: "Status",
        width: 90,
        pinned: "left",
        editable: false,
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      {
        field: "appraisal_code",
        headerName: "Code",
        minWidth: 140,
        pinned: "left",
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "appraisal_name",
        headerName: "Name",
        minWidth: 220,
        pinned: "left",
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "appraisal_year",
        headerName: "Year",
        width: 100,
        editable: (params) => params.data?._status !== "deleted",
        valueParser: (params) => Number(params.newValue || new Date().getFullYear()),
      },
      {
        field: "final_result_id",
        headerName: "Final Result",
        minWidth: 180,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: finalResultValueOptions,
        },
        valueParser: (params) => {
          const next = String(params.newValue ?? "").trim();
          if (!next) return null;
          const parsed = Number(next);
          return Number.isFinite(parsed) ? parsed : null;
        },
        valueFormatter: (params) => {
          const value = Number(params.value);
          if (!Number.isFinite(value)) return "";
          return finalResultLabelById.get(value) ?? "";
        },
      },
      {
        field: "appraisal_type",
        headerName: "Type",
        width: 120,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "start_date",
        headerName: "Start Date",
        width: 130,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "end_date",
        headerName: "End Date",
        width: 130,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "sort_order",
        headerName: "Sort",
        width: 90,
        editable: (params) => params.data?._status !== "deleted",
        valueParser: (params) => Number(params.newValue || 0),
      },
      {
        field: "is_active",
        headerName: "Active",
        width: 100,
        editable: false,
        cellRenderer: (params: ICellRendererParams<PapAppraisalRow>) => {
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
      {
        field: "description",
        headerName: "Description",
        flex: 1,
        minWidth: 220,
        editable: (params) => params.data?._status !== "deleted",
      },
    ];
  }, [finalResultLabelById, finalResultValueOptions, patchRowById, toggleDeleteById]);

  const getRowClass = useCallback((params: RowClassParams<PapAppraisalRow>) => {
    return getGridRowClass(params.data?._status);
  }, []);

  const toolbarActions = [
    {
      key: "create",
      label: "Create",
      icon: Plus,
      onClick: addRow,
      disabled: isLoading || saving,
    },
    {
      key: "copy",
      label: "Copy",
      icon: Copy,
      onClick: copyRows,
      disabled: isLoading || saving,
    },
    {
      key: "template",
      label: "Template",
      icon: FileDown,
      onClick: () => void downloadTemplate(),
      disabled: isLoading || saving,
    },
    {
      key: "upload",
      label: "Upload",
      icon: Upload,
      onClick: () => uploadInputRef.current?.click(),
      disabled: isLoading || saving,
    },
    {
      key: "save",
      label: saving ? "Saving..." : "Save",
      icon: Save,
      onClick: () => void saveAll(),
      disabled: isLoading || saving,
      variant: "save" as const,
    },
    {
      key: "download",
      label: "Download",
      icon: Download,
      onClick: () => void downloadCurrentSheet(),
      disabled: isLoading || saving,
    },
  ];

  function onGridReady(event: GridReadyEvent<PapAppraisalRow>) {
    gridApiRef.current = event.api;
  }

  function handleQuery() {
    setAppliedFilters({ ...searchFilters });
  }

  function handleSearchEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleQuery();
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title="Performance Appraisal Master"
        onQuery={handleQuery}
        queryLabel="Query"
        queryDisabled={isLoading || saving}
      >
        <SearchFieldGrid className="xl:grid-cols-4">
          <SearchTextField
            value={searchFilters.code}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, code: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="Code"
          />
          <SearchTextField
            value={searchFilters.name}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="Name"
          />
          <SearchTextField
            value={searchFilters.year}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, year: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="Year"
          />
          <select
            value={searchFilters.active}
            onChange={(event) =>
              setSearchFilters((prev) => ({
                ...prev,
                active: event.target.value as SearchFilters["active"],
              }))
            }
            onKeyDown={handleSearchEnter}
            aria-label="Active"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={
          <>
            <span className="text-xs text-slate-400">Rows {filteredRows.length.toLocaleString()}</span>
            <GridChangeSummaryBadges summary={changeSummary} className="ml-2" />
          </>
        }
        headerRight={
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
        }
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 px-3 pb-4 pt-2 md:px-6 md:pt-0">
          <div className="ag-theme-quartz vibe-grid h-full w-full min-h-[420px] overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<PapAppraisalRow>
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
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">No data.</span>'
            />
          </div>
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}

