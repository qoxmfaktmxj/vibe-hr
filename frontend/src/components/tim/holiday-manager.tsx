"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, Save, Download, Search, CopyPlus } from "lucide-react";
import { toast } from "sonner";

import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ICellEditorParams,
  type ICellRendererParams,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Button } from "@/components/ui/button";
import {
  isRowRevertedToOriginal,
  resolveRestoredStatus,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import type {
  TimHolidayItem,
  TimHolidayBatchRequest,
  TimHolidayBatchResponse,
  TimHolidayCopyYearResponse,
} from "@/types/tim";

/* ------------------------------------------------------------------ */
/* AG Grid 모듈 등록 (최초 1회)                                         */
/* ------------------------------------------------------------------ */
let modulesRegistered = false;
if (!modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  modulesRegistered = true;
}

/* ------------------------------------------------------------------ */
/* 타입                                                                */
/* ------------------------------------------------------------------ */
type RowStatus = GridRowStatus;

type HolidayRow = TimHolidayItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

/* ------------------------------------------------------------------ */
/* 상수                                                                */
/* ------------------------------------------------------------------ */
const TRACKED_FIELDS: (keyof TimHolidayItem)[] = [
  "holiday_date", "name", "holiday_type", "is_active",
];

const HOLIDAY_TYPE_OPTIONS = ["legal", "company", "substitute"];
const HOLIDAY_TYPE_LABELS: Record<string, string> = {
  legal: "법정", company: "회사지정", substitute: "대체",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "", added: "입력", updated: "수정", deleted: "삭제",
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지", more: "더보기", to: "~", of: "/",
  next: "다음", last: "마지막", first: "처음", previous: "이전",
  loadingOoo: "로딩 중...", noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...", blanks: "(빈값)", filterOoo: "필터...",
  applyFilter: "적용", equals: "같음", notEqual: "같지 않음",
  contains: "포함", notContains: "미포함", startsWith: "시작", endsWith: "끝",
  andCondition: "그리고", orCondition: "또는",
  selectAll: "전체 선택", noMatches: "일치 항목 없음",
};

/* ------------------------------------------------------------------ */
/* 날짜 셀 에디터 (CustomDatePicker popup)                              */
/* ------------------------------------------------------------------ */
type DateEditorProps = ICellEditorParams<HolidayRow, string>;

const HolidayDateCellEditor = forwardRef<
  { getValue: () => string; isPopup: () => boolean },
  DateEditorProps
>(function HolidayDateCellEditor(props, ref) {
  const [value, setValue] = useState<string>(
    typeof props.value === "string" ? props.value : "",
  );

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    isPopup: () => true,
  }), [value]);

  const handleChange = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      props.stopEditing();
    },
    [props],
  );

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 shadow-lg">
      <CustomDatePicker
        value={value}
        onChange={handleChange}
        inline
        closeOnSelect={false}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* 보조 함수                                                           */
/* ------------------------------------------------------------------ */
function snapshotOriginal(row: TimHolidayItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: HolidayRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: TimHolidayItem): HolidayRow {
  return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number, year: number): HolidayRow {
  const now = new Date().toISOString();
  return {
    id: tempId,
    holiday_date: `${year}-01-01`,
    name: "",
    holiday_type: "legal",
    is_active: true,
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

/* ------------------------------------------------------------------ */
/* 컴포넌트                                                            */
/* ------------------------------------------------------------------ */
export function HolidayManager() {
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [yearInput, setYearInput] = useState(String(currentYear));
  const [gridMountKey, setGridMountKey] = useState(0);

  // 전년도 복사 모달 상태
  const [copyFrom, setCopyFrom] = useState(String(currentYear));
  const [copyTo, setCopyTo] = useState(String(currentYear + 1));
  const [copyLoading, setCopyLoading] = useState(false);

  const gridApiRef = useRef<GridApi<HolidayRow> | null>(null);
  const tempIdRef = useRef(-1);

  const issueTempId = () => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  };

  /* -- 변경 요약 ---------------------------------------------------- */
  const changeSummary = useMemo(() => {
    const s = { added: 0, updated: 0, deleted: 0 };
    for (const r of rows) {
      if (r._status === "added") s.added++;
      else if (r._status === "updated") s.updated++;
      else if (r._status === "deleted") s.deleted++;
    }
    return s;
  }, [rows]);

  const hasChanges = changeSummary.added + changeSummary.updated + changeSummary.deleted > 0;

  /* -- 로딩 -------------------------------------------------------- */
  const loadData = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tim/holidays?year=${targetYear}`, { cache: "no-store" });
      if (!res.ok) throw new Error("공휴일 목록을 불러오지 못했습니다.");
      const data = (await res.json()) as { items: TimHolidayItem[] };
      setRows(data.items.map(toGridRow));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(year); }, [loadData, year]);

  const redraw = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.redrawRows();
  }, []);

  /* -- 삭제 토글 --------------------------------------------------- */
  const toggleDelete = useCallback(
    (rowId: number, checked: boolean) => {
      setRows((prev) => {
        const next: HolidayRow[] = [];
        for (const row of prev) {
          if (row.id !== rowId) { next.push(row); continue; }
          if (!checked) {
            if (row._status === "deleted") {
              const restored = resolveRestoredStatus(row, (r) => isReverted(r));
              next.push({ ...row, _status: restored, _prevStatus: undefined });
            } else {
              next.push(row);
            }
            continue;
          }
          if (row._status === "added") continue;
          if (row._status !== "deleted") {
            next.push({ ...row, _status: "deleted", _prevStatus: row._status });
          } else {
            next.push(row);
          }
        }
        return next;
      });
      setTimeout(redraw, 0);
    },
    [redraw],
  );

  /* -- 컬럼 정의 --------------------------------------------------- */
  const columnDefs = useMemo<ColDef<HolidayRow>[]>(
    () => [
      {
        headerName: "선택",
        checkboxSelection: true,
        headerCheckboxSelection: true,
        width: 52,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        resizable: false,
      },
      {
        headerName: "삭제",
        width: 52,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        resizable: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<HolidayRow>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={row._status === "deleted"}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
                onChange={(e) => toggleDelete(row.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: "상태",
        field: "_status",
        width: 68,
        editable: false,
        sortable: false,
        filter: false,
        cellClass: (p) => {
          const s = p.value as RowStatus;
          if (s === "added") return "vibe-status-added";
          if (s === "updated") return "vibe-status-updated";
          if (s === "deleted") return "vibe-status-deleted";
          return "";
        },
        valueFormatter: (p) => STATUS_LABELS[(p.value as RowStatus) ?? "clean"],
      },
      {
        headerName: "날짜",
        field: "holiday_date",
        width: 130,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: HolidayDateCellEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        sort: "asc",
      },
      {
        headerName: "공휴일명",
        field: "name",
        flex: 1,
        minWidth: 160,
        editable: (p) => p.data?._status !== "deleted",
      },
      {
        headerName: "유형",
        field: "holiday_type",
        width: 110,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: HOLIDAY_TYPE_OPTIONS },
        valueFormatter: (p) => HOLIDAY_TYPE_LABELS[p.value as string] ?? (p.value as string),
      },
      {
        headerName: "사용",
        field: "is_active",
        width: 72,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (p) => (p.value ? "Y" : "N"),
        valueParser: (p) => p.newValue === "Y",
        cellStyle: { textAlign: "center" },
      },
    ],
    [toggleDelete],
  );

  const defaultColDef = useMemo<ColDef<HolidayRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false }),
    [],
  );

  const getRowClass = useCallback((params: RowClassParams<HolidayRow>) => {
    if (!params.data) return "";
    if (params.data._status === "added") return "vibe-row-added";
    if (params.data._status === "updated") return "vibe-row-updated";
    if (params.data._status === "deleted") return "vibe-row-deleted";
    return "";
  }, []);

  const onGridReady = useCallback((e: GridReadyEvent<HolidayRow>) => {
    gridApiRef.current = e.api;
  }, []);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<HolidayRow>) => {
      if (e.newValue === e.oldValue) return;
      const rowId = e.data?.id;
      if (rowId == null) return;
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row } as HolidayRow;
          if (next._status !== "added" && next._status !== "deleted") {
            next._status = isReverted(next) ? "clean" : "updated";
          }
          return next;
        }),
      );
      setTimeout(redraw, 0);
    },
    [redraw],
  );

  /* -- 액션 -------------------------------------------------------- */
  function addRow() {
    const row = createEmptyRow(issueTempId(), year);
    setRows((prev) => [row, ...prev]);
    setTimeout(redraw, 0);
  }

  async function downloadExcel() {
    try {
      const headers = ["날짜", "공휴일명", "유형", "사용여부"];
      const data = rows
        .filter((r) => r._status !== "deleted")
        .map((r) => [
          r.holiday_date, r.name,
          HOLIDAY_TYPE_LABELS[r.holiday_type] ?? r.holiday_type,
          r.is_active ? "Y" : "N",
        ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...data]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, `공휴일_${year}`);
      writeFileXLSX(book, `holidays-${year}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }

  async function handleQuery() {
    const parsed = parseInt(yearInput, 10);
    if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
      toast.error("유효한 연도를 입력해 주세요. (2000~2100)");
      return;
    }
    setYear(parsed);
    tempIdRef.current = -1;
    gridApiRef.current = null;
    setGridMountKey((k) => k + 1);
  }

  async function copyYear() {
    const from = parseInt(copyFrom, 10);
    const to = parseInt(copyTo, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      toast.error("유효한 연도를 입력해 주세요.");
      return;
    }
    if (from === to) {
      toast.error("복사 원본과 대상 연도가 같을 수 없습니다.");
      return;
    }
    setCopyLoading(true);
    try {
      const res = await fetch("/api/tim/holidays/copy-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_from: from, year_to: to }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "복사에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as TimHolidayCopyYearResponse;
      toast.success(`${to}년으로 ${json.copied_count}건이 복사되었습니다.`);
      // 복사한 연도로 이동
      setYearInput(String(to));
      setYear(to);
      setGridMountKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "복사에 실패했습니다.");
    } finally {
      setCopyLoading(false);
    }
  }

  async function saveAllChanges() {
    const toInsert = rows.filter((r) => r._status === "added");
    const toUpdate = rows.filter((r) => r._status === "updated");
    const toDelete = rows.filter((r) => r._status === "deleted" && r.id > 0);

    if (toInsert.length + toUpdate.length + toDelete.length === 0) return;

    for (const r of [...toInsert, ...toUpdate]) {
      if (!r.holiday_date) { toast.error("날짜를 입력해 주세요."); return; }
      if (!r.name.trim()) { toast.error(`공휴일명을 입력해 주세요. (날짜: ${r.holiday_date})`); return; }
    }

    setSaving(true);
    try {
      const payload: TimHolidayBatchRequest = {
        items: [...toInsert, ...toUpdate].map((r) => ({
          id: r.id > 0 ? r.id : null,
          holiday_date: r.holiday_date,
          name: r.name.trim(),
          holiday_type: r.holiday_type,
          is_active: r.is_active,
        })),
        delete_ids: toDelete.map((r) => r.id),
      };

      const res = await fetch(`/api/tim/holidays/batch?year=${year}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "저장에 실패했습니다.");
        return;
      }

      const json = (await res.json()) as TimHolidayBatchResponse;
      setRows(json.items.map(toGridRow));
      gridApiRef.current = null;
      setGridMountKey((k) => k + 1);
      toast.success(
        `저장 완료 (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  /* -- 렌더링 ------------------------------------------------------ */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">{year}년 공휴일 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">
      {/* 검색 영역 */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">조회 연도</div>
            <input
              type="number"
              value={yearInput}
              min={2000}
              max={2100}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleQuery(); }}
              className="h-9 w-24 rounded-md border border-gray-200 px-3 text-sm"
            />
          </div>
          <Button size="sm" variant="query" onClick={() => void handleQuery()} className="h-9">
            <Search className="mr-1 h-3.5 w-3.5" />
            조회
          </Button>

          {/* 구분선 */}
          <div className="mx-2 h-8 w-px bg-gray-200" />

          {/* 전년도 복사 */}
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">복사 원본 연도</div>
              <input
                type="number"
                value={copyFrom}
                min={2000}
                max={2100}
                onChange={(e) => setCopyFrom(e.target.value)}
                className="h-9 w-24 rounded-md border border-gray-200 px-3 text-sm"
              />
            </div>
            <span className="mb-2 text-slate-400">→</span>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">대상 연도</div>
              <input
                type="number"
                value={copyTo}
                min={2000}
                max={2100}
                onChange={(e) => setCopyTo(e.target.value)}
                className="h-9 w-24 rounded-md border border-gray-200 px-3 text-sm"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copyYear()}
              disabled={copyLoading}
              className="h-9"
            >
              <CopyPlus className="mr-1 h-3.5 w-3.5" />
              {copyLoading ? "복사중..." : "연도 복사"}
            </Button>
          </div>
        </div>
      </div>

      {/* 툴바 */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-800">{year}년 공휴일</h2>
          <span className="text-xs text-slate-400">{rows.length}건</span>
          {hasChanges && (
            <div className="flex gap-1.5">
              {changeSummary.added > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">+{changeSummary.added}</span>
              )}
              {changeSummary.updated > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">~{changeSummary.updated}</span>
              )}
              {changeSummary.deleted > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">-{changeSummary.deleted}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="mr-1 h-3.5 w-3.5" />입력
          </Button>
          <Button size="sm" variant="outline" onClick={() => void downloadExcel()}>
            <Download className="mr-1 h-3.5 w-3.5" />다운로드
          </Button>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <Button size="sm" variant="save" onClick={() => void saveAllChanges()} disabled={saving}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? "저장중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* AG Grid */}
      <div className="flex-1 px-6 pb-4 pt-2">
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<HolidayRow>
            theme="legacy"
            key={gridMountKey}
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            animateRows={false}
            getRowClass={getRowClass}
            getRowId={(p) => String(p.data.id)}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-slate-400">${year}년 공휴일 데이터가 없습니다.</span>`}
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </div>
    </div>
  );
}
