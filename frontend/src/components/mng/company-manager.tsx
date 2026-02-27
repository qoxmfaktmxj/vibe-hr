"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Copy, Download, FileDown, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import {
  ManagerGridSection,
  ManagerPageShell,
  ManagerSearchSection,
} from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { fetcher } from "@/lib/fetcher";
import {
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import {
  reconcileUpdatedStatus,
  toggleDeletedStatus,
} from "@/lib/grid/grid-status-mutations";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import type { MngCompanyItem, MngCompanyListResponse } from "@/types/mng";

type RowStatus = GridRowStatus;
type ActiveFilter = "" | "Y" | "N";

type SearchFilters = {
  companyCode: string;
  companyName: string;
  companyType: string;
  active: ActiveFilter;
};

type CompanyGridRow = MngCompanyItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const EMPTY_FILTERS: SearchFilters = {
  companyCode: "",
  companyName: "",
  companyType: "",
  active: "",
};

const TRACKED_FIELDS: (keyof MngCompanyItem)[] = [
  "company_code",
  "company_name",
  "company_group_code",
  "company_type",
  "management_type",
  "representative_company",
  "start_date",
  "is_active",
];

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지",
  more: "더보기",
  to: "~",
  of: "/",
  next: "다음",
  last: "마지막",
  first: "처음",
  previous: "이전",
  loadingOoo: "로딩 중...",
  noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...",
  blanks: "(빈값)",
  filterOoo: "필터...",
  applyFilter: "적용",
  equals: "같음",
  notEqual: "같지 않음",
  lessThan: "보다 작음",
  greaterThan: "보다 큼",
  contains: "포함",
  notContains: "미포함",
  startsWith: "시작",
  endsWith: "끝",
  andCondition: "그리고",
  orCondition: "또는",
  clearFilter: "초기화",
  resetFilter: "리셋",
  cancelFilter: "취소",
  textFilter: "텍스트 필터",
  numberFilter: "숫자 필터",
  dateFilter: "날짜 필터",
  selectAll: "전체 선택",
  selectAllSearchResults: "검색 결과 전체 선택",
  addCurrentSelectionToFilter: "현재 선택 추가",
  noMatches: "일치 항목 없음",
};

function snapshotOriginal(row: MngCompanyItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isRevertedToOriginal(row: CompanyGridRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(row: MngCompanyItem): CompanyGridRow {
  return {
    ...row,
    start_date: row.start_date ?? null,
    _status: "clean",
    _original: snapshotOriginal(row),
    _prevStatus: undefined,
  };
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function CompanyManager() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<CompanyGridRow[]>([]);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<CompanyGridRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);

  const { data, isLoading, mutate } = useSWR<MngCompanyListResponse>(
    "/api/mng/companies",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  useEffect(() => {
    if (!data) return;
    setRows((data.companies ?? []).map(toGridRow));
  }, [data]);

  const filteredRows = useMemo(() => {
    const companyCode = appliedFilters.companyCode.trim().toLowerCase();
    const companyName = appliedFilters.companyName.trim().toLowerCase();
    const companyType = appliedFilters.companyType.trim().toLowerCase();

    return rows.filter((row) => {
      if (companyCode && !row.company_code.toLowerCase().includes(companyCode)) return false;
      if (companyName && !row.company_name.toLowerCase().includes(companyName)) return false;
      if (companyType && !(row.company_type ?? "").toLowerCase().includes(companyType)) return false;
      if (appliedFilters.active === "Y" && !row.is_active) return false;
      if (appliedFilters.active === "N" && row.is_active) return false;
      return true;
    });
  }, [appliedFilters, rows]);

  const changeSummary = useMemo(
    () => summarizeGridStatuses(rows, (row) => row._status),
    [rows],
  );

  const defaultColDef = useMemo<ColDef<CompanyGridRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: true,
      minWidth: 100,
    }),
    [],
  );

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const redrawRows = useCallback(() => {
    gridApiRef.current?.redrawRows();
  }, []);

  const patchRowById = useCallback(
    (rowId: number, patch: Partial<CompanyGridRow>) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const merged: CompanyGridRow = {
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
      setTimeout(redrawRows, 0);
    },
    [redrawRows],
  );

  const addRow = useCallback(() => {
    const now = new Date().toISOString();
    const newRow: CompanyGridRow = {
      id: issueTempId(),
      company_code: "",
      company_name: "",
      company_group_code: "",
      company_type: "",
      management_type: "",
      representative_company: "",
      start_date: new Date().toISOString().slice(0, 10),
      is_active: true,
      created_at: now,
      updated_at: now,
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };

    setRows((prev) => [newRow, ...prev]);
    setTimeout(redrawRows, 0);
  }, [issueTempId, redrawRows]);

  const copyRows = useCallback(() => {
    const selectedRows =
      gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selectedRows.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const clones = selectedRows.map<CompanyGridRow>((row) => ({
      ...row,
      id: issueTempId(),
      company_code: `${row.company_code}_COPY`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    }));

    setRows((prev) => [...clones, ...prev]);
    setTimeout(redrawRows, 0);
  }, [issueTempId, redrawRows]);

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      setRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
        }),
      );
      setTimeout(redrawRows, 0);
    },
    [redrawRows],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<CompanyGridRow>) => {
      const row = event.data;
      const field = event.colDef.field as keyof CompanyGridRow | undefined;
      if (!row || !field || event.newValue === event.oldValue) return;
      patchRowById(row.id, { [field]: event.newValue } as Partial<CompanyGridRow>);
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
      for (const row of toInsert) {
        if (!row.company_code.trim() || !row.company_name.trim()) {
          throw new Error("신규 입력 행에는 회사코드와 회사명이 필수입니다.");
        }
      }

      if (toDelete.length > 0) {
        const response = await fetch("/api/mng/companies", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: toDelete.map((row) => row.id) }),
        });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, "삭제 처리에 실패했습니다."));
        }
      }

      for (const row of toUpdate) {
        const response = await fetch("/api/mng/companies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            company_name: row.company_name.trim(),
            company_group_code: row.company_group_code || null,
            company_type: row.company_type || null,
            management_type: row.management_type || null,
            representative_company: row.representative_company || null,
            start_date: row.start_date || null,
            is_active: row.is_active,
          }),
        });
        if (!response.ok) {
          throw new Error(
            await parseErrorDetail(response, `${row.company_code} 수정에 실패했습니다.`),
          );
        }
      }

      for (const row of toInsert) {
        const response = await fetch("/api/mng/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_code: row.company_code.trim(),
            company_name: row.company_name.trim(),
            company_group_code: row.company_group_code || null,
            company_type: row.company_type || null,
            management_type: row.management_type || null,
            representative_company: row.representative_company || null,
            start_date: row.start_date || null,
          }),
        });
        if (!response.ok) {
          throw new Error(
            await parseErrorDetail(response, `${row.company_code || "(신규)"} 입력에 실패했습니다.`),
          );
        }
      }

      toast.success(
        `저장 완료 (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`,
      );
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [mutate, rows]);

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = [
        "회사코드",
        "회사명",
        "회사그룹코드",
        "회사구분",
        "관리구분",
        "대표회사",
        "시작일",
        "사용(Y/N)",
      ];
      const sample = ["COMP001", "바이브HR", "GROUP_A", "고객사", "직영", "바이브HR", "2026-01-01", "Y"];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, "mng-companies-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, []);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = [
        "상태",
        "회사코드",
        "회사명",
        "회사그룹코드",
        "회사구분",
        "관리구분",
        "대표회사",
        "시작일",
        "사용",
      ];

      const dataRows = rows.map((row) => [
        STATUS_LABELS[row._status],
        row.company_code,
        row.company_name,
        row.company_group_code ?? "",
        row.company_type ?? "",
        row.management_type ?? "",
        row.representative_company ?? "",
        row.start_date ?? "",
        row.is_active ? "Y" : "N",
      ]);

      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...dataRows]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "고객사관리");
      writeFileXLSX(book, `mng-companies-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
        const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, {
          header: 1,
          raw: false,
        });

        if (!rowsAoa || rowsAoa.length <= 1) return;

        const parsed: CompanyGridRow[] = [];
        for (const cells of rowsAoa.slice(1)) {
          const values = cells.map((value) => String(value ?? "").trim());
          if (!values.some((value) => value.length > 0)) continue;

          const activeRaw = (values[7] ?? "Y").toLowerCase();
          const isActive = activeRaw === "y" || activeRaw === "true" || activeRaw === "1";

          parsed.push({
            id: issueTempId(),
            company_code: values[0] ?? "",
            company_name: values[1] ?? "",
            company_group_code: values[2] ?? "",
            company_type: values[3] ?? "",
            management_type: values[4] ?? "",
            representative_company: values[5] ?? "",
            start_date: values[6] || null,
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

        setRows((prev) => [...parsed, ...prev]);
        setTimeout(redrawRows, 0);
        toast.success(`${parsed.length}건 업로드 반영 완료`);
      } catch {
        toast.error("파일 업로드에 실패했습니다.");
      }
    },
    [issueTempId, redrawRows],
  );

  const columnDefs = useMemo<ColDef<CompanyGridRow>[]>(
    () => [
      {
        headerName: "삭제",
        width: 62,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams<CompanyGridRow>) => {
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
        sortable: false,
        filter: false,
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
      },
      {
        field: "company_code",
        headerName: "회사코드",
        minWidth: 140,
        editable: (params) => params.data?._status === "added",
      },
      {
        field: "company_name",
        headerName: "회사명",
        minWidth: 180,
        flex: 1.2,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "company_group_code",
        headerName: "회사그룹코드",
        minWidth: 140,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "company_type",
        headerName: "회사구분",
        minWidth: 130,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "management_type",
        headerName: "관리구분",
        minWidth: 130,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "representative_company",
        headerName: "대표회사",
        minWidth: 130,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "start_date",
        headerName: "시작일",
        minWidth: 120,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        field: "is_active",
        headerName: "사용",
        width: 90,
        editable: false,
        cellRenderer: (params: ICellRendererParams<CompanyGridRow>) => {
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
        field: "updated_at",
        headerName: "수정일시",
        minWidth: 180,
        editable: false,
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value as string).toLocaleString();
        },
      },
    ],
    [patchRowById, toggleDeleteById],
  );

  const getRowClass = useCallback((params: RowClassParams<CompanyGridRow>) => {
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

  function onGridReady(event: GridReadyEvent<CompanyGridRow>) {
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
        title="고객사관리"
        onQuery={handleQuery}
        queryLabel="조회"
        queryDisabled={isLoading || saving}
      >
        <SearchFieldGrid className="xl:grid-cols-4">
          <SearchTextField
            value={searchFilters.companyCode}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, companyCode: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="회사코드"
          />
          <SearchTextField
            value={searchFilters.companyName}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, companyName: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="회사명"
          />
          <SearchTextField
            value={searchFilters.companyType}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, companyType: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="회사구분"
          />
          <select
            value={searchFilters.active}
            onChange={(event) =>
              setSearchFilters((prev) => ({ ...prev, active: event.target.value as ActiveFilter }))
            }
            onKeyDown={handleSearchEnter}
            aria-label="사용 여부"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">전체</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
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
            <AgGridReact<CompanyGridRow>
              theme="legacy"
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="multiple"
              suppressRowClickSelection={false}
              singleClickEdit
              animateRows={false}
              localeText={AG_GRID_LOCALE_KO}
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
