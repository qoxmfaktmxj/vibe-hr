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
import { Copy, Download, FileDown, Plus, RefreshCw, Save, Upload, UserRoundPlus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import {
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import type { HrRecruitFinalistItem, HrRecruitFinalistListResponse } from "@/types/hr-recruit";

type RowStatus = GridRowStatus;
type SourceType = "if" | "manual";
type HireType = "new" | "experienced";
type ProgressStatus = "draft" | "ready" | "appointed";

type SearchFilters = {
  keyword: string;
  status: "" | ProgressStatus;
};

type RecruitGridRow = HrRecruitFinalistItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const EMPTY_FILTERS: SearchFilters = {
  keyword: "",
  status: "",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

const SOURCE_LABELS: Record<SourceType, string> = {
  if: "IF",
  manual: "수기",
};

const HIRE_TYPE_LABELS: Record<HireType, string> = {
  new: "신규",
  experienced: "경력",
};

const PROCESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  draft: "등록",
  ready: "발령대기",
  appointed: "발령완료",
};

const TRACKED_FIELDS: (keyof HrRecruitFinalistItem)[] = [
  "source_type",
  "external_key",
  "full_name",
  "resident_no_masked",
  "birth_date",
  "phone_mobile",
  "email",
  "hire_type",
  "career_years",
  "login_id",
  "employee_no",
  "expected_join_date",
  "status_code",
  "note",
  "is_active",
];

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
};

function snapshotOriginal(row: HrRecruitFinalistItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isRevertedToOriginal(row: RecruitGridRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(row: HrRecruitFinalistItem): RecruitGridRow {
  return {
    ...row,
    _status: "clean",
    _original: snapshotOriginal(row),
    _prevStatus: undefined,
  };
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function HrRecruitFinalistManager() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<RecruitGridRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [ifSyncing, setIfSyncing] = useState(false);
  const [generatingNo, setGeneratingNo] = useState(false);

  const gridApiRef = useRef<GridApi<RecruitGridRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const rowsRef = useRef<RecruitGridRow[]>([]);
  const tempIdRef = useRef(-1);

  const { data, isLoading, mutate } = useSWR<HrRecruitFinalistListResponse>(
    "/api/hr/recruit/finalists",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );

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
      return (
        row.full_name.toLowerCase().includes(keyword)
        || row.candidate_no.toLowerCase().includes(keyword)
        || (row.employee_no ?? "").toLowerCase().includes(keyword)
        || (row.login_id ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [appliedFilters, rows]);

  const changeSummary = useMemo(
    () => summarizeGridStatuses(rows, (row) => row._status),
    [rows],
  );

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

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const getRowKey = useCallback((row: RecruitGridRow) => String(row.id), []);

  const applyGridTransaction = useCallback(
    (prevRows: RecruitGridRow[], nextRows: RecruitGridRow[]) => {
      const api = gridApiRef.current;
      if (!api) return;

      const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
      const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
      const add: RecruitGridRow[] = [];
      const update: RecruitGridRow[] = [];
      const remove: RecruitGridRow[] = [];

      for (const row of nextRows) {
        const previous = prevMap.get(getRowKey(row));
        if (!previous) {
          add.push(row);
          continue;
        }
        if (previous !== row) update.push(row);
      }

      for (const row of prevRows) {
        if (!nextMap.has(getRowKey(row))) remove.push(row);
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
    (updater: (prevRows: RecruitGridRow[]) => RecruitGridRow[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
      applyGridTransaction(prevRows, nextRows);
    },
    [applyGridTransaction],
  );

  const patchRowById = useCallback(
    (rowId: number, patch: Partial<RecruitGridRow>) => {
      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const merged: RecruitGridRow = {
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
    const now = new Date().toISOString();
    const newRow: RecruitGridRow = {
      id: issueTempId(),
      candidate_no: "",
      source_type: "manual",
      external_key: null,
      full_name: "",
      resident_no_masked: null,
      birth_date: null,
      phone_mobile: null,
      email: null,
      hire_type: "new",
      career_years: null,
      login_id: null,
      employee_no: null,
      expected_join_date: new Date().toISOString().slice(0, 10),
      status_code: "draft",
      note: null,
      is_active: true,
      created_at: now,
      updated_at: now,
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };
    commitRows((prev) => [newRow, ...prev]);
  }, [commitRows, issueTempId]);

  const copyRows = useCallback(() => {
    const selectedRows =
      gridApiRef.current?.getSelectedRows().filter((row) => row._status !== "deleted") ?? [];
    if (selectedRows.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const now = new Date().toISOString();
    const clones = selectedRows.map<RecruitGridRow>((row) => ({
      ...row,
      id: issueTempId(),
      candidate_no: "",
      external_key: null,
      employee_no: null,
      status_code: "draft",
      created_at: now,
      updated_at: now,
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
    (event: CellValueChangedEvent<RecruitGridRow>) => {
      const row = event.data;
      const field = event.colDef.field as keyof RecruitGridRow | undefined;
      if (!row || !field || event.newValue === event.oldValue) return;
      patchRowById(row.id, { [field]: event.newValue } as Partial<RecruitGridRow>);
    },
    [patchRowById],
  );

  const downloadTemplate = useCallback(async () => {
    try {
      const headers = ["성명", "주민등록번호(마스킹)", "생년월일", "휴대폰", "이메일", "입사유형(new/experienced)", "경력년수", "예정입사일", "비고"];
      const sample = ["홍길동", "900101-1******", "1990-01-01", "010-1234-5678", "hong@example.com", "new", "0", "2026-04-01", "신규 채용"];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, "hr-recruit-finalists-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, []);

  const downloadCurrentSheet = useCallback(async () => {
    try {
      const headers = [
        "상태",
        "합격자번호",
        "등록구분",
        "성명",
        "주민등록번호",
        "생년월일",
        "휴대폰",
        "이메일",
        "입사유형",
        "경력년수",
        "로그인ID",
        "사번",
        "예정입사일",
        "진행상태",
        "비고",
      ];
      const dataRows = rows.map((row) => [
        STATUS_LABELS[row._status],
        row.candidate_no,
        SOURCE_LABELS[row.source_type],
        row.full_name,
        row.resident_no_masked ?? "",
        row.birth_date ?? "",
        row.phone_mobile ?? "",
        row.email ?? "",
        HIRE_TYPE_LABELS[row.hire_type],
        row.career_years ?? "",
        row.login_id ?? "",
        row.employee_no ?? "",
        row.expected_join_date ?? "",
        PROCESS_STATUS_LABELS[row.status_code],
        row.note ?? "",
      ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...dataRows]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "채용합격자등록");
      writeFileXLSX(book, `hr-recruit-finalists-${new Date().toISOString().slice(0, 10)}.xlsx`);
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

        const parsed: RecruitGridRow[] = [];
        for (const cells of rowsAoa.slice(1)) {
          const c = cells.map((value) => String(value ?? "").trim());
          if (!c.some((value) => value.length > 0)) continue;

          const hireType = c[5] === "experienced" ? "experienced" : "new";
          parsed.push({
            id: issueTempId(),
            candidate_no: "",
            source_type: "manual",
            external_key: null,
            full_name: c[0] ?? "",
            resident_no_masked: c[1] || null,
            birth_date: c[2] || null,
            phone_mobile: c[3] || null,
            email: c[4] || null,
            hire_type: hireType,
            career_years: c[6] ? Number(c[6]) || 0 : null,
            login_id: null,
            employee_no: null,
            expected_join_date: c[7] || null,
            status_code: "draft",
            note: c[8] || null,
            is_active: true,
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
        toast.error("파일 업로드에 실패했습니다.");
      }
    },
    [commitRows, issueTempId],
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
        if (!row.full_name.trim()) {
          throw new Error("신규 입력 행에는 성명이 필수입니다.");
        }
      }

      if (toDelete.length > 0) {
        const response = await fetch("/api/hr/recruit/finalists", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: toDelete.map((row) => row.id) }),
        });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, "삭제 처리에 실패했습니다."));
        }
      }

      for (const row of toUpdate) {
        const response = await fetch(`/api/hr/recruit/finalists/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: row.source_type,
            external_key: row.external_key || null,
            full_name: row.full_name.trim(),
            resident_no_masked: row.resident_no_masked || null,
            birth_date: row.birth_date || null,
            phone_mobile: row.phone_mobile || null,
            email: row.email || null,
            hire_type: row.hire_type,
            career_years: row.career_years ?? null,
            login_id: row.login_id || null,
            employee_no: row.employee_no || null,
            expected_join_date: row.expected_join_date || null,
            status_code: row.status_code,
            note: row.note || null,
            is_active: row.is_active,
          }),
        });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, `${row.full_name} 수정에 실패했습니다.`));
        }
      }

      for (const row of toInsert) {
        const response = await fetch("/api/hr/recruit/finalists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: "manual",
            full_name: row.full_name.trim(),
            resident_no_masked: row.resident_no_masked || null,
            birth_date: row.birth_date || null,
            phone_mobile: row.phone_mobile || null,
            email: row.email || null,
            hire_type: row.hire_type,
            career_years: row.career_years ?? null,
            login_id: row.login_id || null,
            expected_join_date: row.expected_join_date || null,
            status_code: row.status_code,
            note: row.note || null,
            is_active: row.is_active,
          }),
        });
        if (!response.ok) {
          throw new Error(await parseErrorDetail(response, `${row.full_name} 입력에 실패했습니다.`));
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

  const syncFromIf = useCallback(async () => {
    setIfSyncing(true);
    try {
      const response = await fetch("/api/hr/recruit/finalists/if-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "IF 수신 처리에 실패했습니다."));
      }
      const data = (await response.json().catch(() => null)) as
        | { inserted_count?: number; updated_count?: number }
        | null;
      toast.success(`IF 수신 완료 (신규 ${data?.inserted_count ?? 0}건 / 갱신 ${data?.updated_count ?? 0}건)`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "IF 수신 처리에 실패했습니다.");
    } finally {
      setIfSyncing(false);
    }
  }, [mutate]);

  const generateEmployeeNoForSelected = useCallback(async () => {
    const selected = gridApiRef.current?.getSelectedRows() ?? [];
    const targetIds = selected
      .filter((row) => row._status !== "deleted" && row.id > 0)
      .map((row) => row.id);
    if (targetIds.length === 0) {
      toast.error("사번생성 대상 행을 선택해 주세요.");
      return;
    }

    setGeneratingNo(true);
    try {
      const response = await fetch("/api/hr/recruit/finalists/generate-employee-no", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "사번생성에 실패했습니다."));
      }
      const data = (await response.json().catch(() => null)) as
        | { updated_count?: number; skipped_count?: number }
        | null;
      toast.success(`사번생성 완료 (생성 ${data?.updated_count ?? 0}건 / 기생성 ${data?.skipped_count ?? 0}건)`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "사번생성에 실패했습니다.");
    } finally {
      setGeneratingNo(false);
    }
  }, [mutate]);

  const columnDefs = useMemo<ColDef<RecruitGridRow>[]>(
    () => [
      {
        headerName: "",
        width: 44,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        suppressMenu: true,
        checkboxSelection: true,
        headerCheckboxSelection: true,
      },
      {
        headerName: "삭제",
        width: 62,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams<RecruitGridRow>) => {
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
      { field: "candidate_no", headerName: "합격자번호", minWidth: 130, editable: false },
      {
        field: "source_type",
        headerName: "등록구분",
        minWidth: 100,
        editable: (params) => params.data?._status === "added",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["manual", "if"] },
        valueFormatter: (params) => SOURCE_LABELS[(params.value as SourceType) ?? "manual"],
      },
      { field: "full_name", headerName: "성명", minWidth: 120, editable: (params) => params.data?._status !== "deleted" },
      { field: "resident_no_masked", headerName: "주민번호", minWidth: 130, editable: (params) => params.data?._status !== "deleted" },
      { field: "birth_date", headerName: "생년월일", minWidth: 115, editable: (params) => params.data?._status !== "deleted" },
      { field: "phone_mobile", headerName: "휴대폰", minWidth: 130, editable: (params) => params.data?._status !== "deleted" },
      { field: "email", headerName: "이메일", minWidth: 190, editable: (params) => params.data?._status !== "deleted" },
      {
        field: "hire_type",
        headerName: "입사유형",
        minWidth: 110,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["new", "experienced"] },
        valueFormatter: (params) => HIRE_TYPE_LABELS[(params.value as HireType) ?? "new"],
      },
      { field: "career_years", headerName: "경력년수", minWidth: 100, editable: (params) => params.data?._status !== "deleted" },
      { field: "login_id", headerName: "로그인ID", minWidth: 120, editable: (params) => params.data?._status !== "deleted" },
      { field: "employee_no", headerName: "사번", minWidth: 120, editable: false },
      { field: "expected_join_date", headerName: "예정입사일", minWidth: 120, editable: (params) => params.data?._status !== "deleted" },
      {
        field: "status_code",
        headerName: "진행상태",
        minWidth: 110,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["draft", "ready", "appointed"] },
        valueFormatter: (params) => PROCESS_STATUS_LABELS[(params.value as ProgressStatus) ?? "draft"],
      },
      { field: "note", headerName: "비고", minWidth: 180, flex: 1.2, editable: (params) => params.data?._status !== "deleted" },
      {
        field: "updated_at",
        headerName: "수정일시",
        minWidth: 170,
        editable: false,
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value as string).toLocaleString();
        },
      },
    ],
    [toggleDeleteById],
  );

  const getRowClass = useCallback((params: RowClassParams<RecruitGridRow>) => {
    return getGridRowClass(params.data?._status);
  }, []);

  const toolbarActions = [
    {
      key: "create",
      label: "입력",
      icon: Plus,
      onClick: addRow,
      disabled: isLoading || saving || ifSyncing || generatingNo,
    },
    {
      key: "copy",
      label: "복사",
      icon: Copy,
      onClick: copyRows,
      disabled: isLoading || saving || ifSyncing || generatingNo,
    },
    {
      key: "template",
      label: "양식 다운로드",
      icon: FileDown,
      onClick: () => void downloadTemplate(),
      disabled: isLoading || saving || ifSyncing || generatingNo,
    },
    {
      key: "upload",
      label: "업로드",
      icon: Upload,
      onClick: () => uploadInputRef.current?.click(),
      disabled: isLoading || saving || ifSyncing || generatingNo,
    },
    {
      key: "save",
      label: saving ? "저장중..." : "저장",
      icon: Save,
      onClick: () => void saveAll(),
      disabled: isLoading || saving || ifSyncing || generatingNo,
      variant: "save" as const,
    },
    {
      key: "download",
      label: "다운로드",
      icon: Download,
      onClick: () => void downloadCurrentSheet(),
      disabled: isLoading || saving || ifSyncing || generatingNo,
    },
  ];

  function onGridReady(event: GridReadyEvent<RecruitGridRow>) {
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
        title="채용합격자등록"
        onQuery={handleQuery}
        queryLabel="조회"
        queryDisabled={isLoading || saving || ifSyncing || generatingNo}
      >
        <SearchFieldGrid className="xl:grid-cols-3">
          <SearchTextField
            value={searchFilters.keyword}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, keyword: value }))}
            onKeyDown={handleSearchEnter}
            placeholder="성명/합격자번호/사번/로그인ID"
          />
          <select
            value={searchFilters.status}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, status: event.target.value as SearchFilters["status"] }))}
            onKeyDown={handleSearchEnter}
            aria-label="진행상태"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">진행상태 전체</option>
            <option value="draft">등록</option>
            <option value="ready">발령대기</option>
            <option value="appointed">발령완료</option>
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
            <Button
              size="sm"
              variant="action"
              onClick={() => void syncFromIf()}
              disabled={isLoading || saving || ifSyncing || generatingNo}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {ifSyncing ? "IF 수신중..." : "IF 수신"}
            </Button>
            <Button
              size="sm"
              variant="action"
              onClick={() => void generateEmployeeNoForSelected()}
              disabled={isLoading || saving || ifSyncing || generatingNo}
            >
              <UserRoundPlus className="h-3.5 w-3.5" />
              {generatingNo ? "사번생성중..." : "사번생성"}
            </Button>
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
            <AgGridReact<RecruitGridRow>
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
