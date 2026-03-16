"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Copy, Save, Download } from "lucide-react";
import { toast } from "sonner";

import {
    type CellStyle,
    type CellValueChangedEvent,
    type ICellRendererParams,
    type ColDef,
    type GridApi,
    type GridReadyEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
    isRowRevertedToOriginal,
    snapshotFields,
    type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
    PayIncomeTaxBracketItem,
    PayIncomeTaxBracketBatchRequest,
    PayIncomeTaxBracketBatchResponse,
} from "@/types/pay";


type RowStatus = GridRowStatus;

type RowData = PayIncomeTaxBracketItem & {
    _status: RowStatus;
    _original?: Record<string, unknown>;
    _prevStatus?: RowStatus;
};

const TRACKED_FIELDS: (keyof PayIncomeTaxBracketItem)[] = [
    "year", "annual_taxable_from", "annual_taxable_to", "tax_rate", "quick_deduction",
];

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

const ACTION_CODE_BY_KEY: Record<string, string> = {
    create: "create",
    copy: "copy",
    download: "download",
};

function snapshotOriginal(row: PayIncomeTaxBracketItem): Record<string, unknown> {
    return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: RowData): boolean {
    return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: PayIncomeTaxBracketItem): RowData {
    return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number): RowData {
    const now = new Date().toISOString();
    return {
        id: tempId,
        year: new Date().getFullYear(),
        annual_taxable_from: 0,
        annual_taxable_to: null,
        tax_rate: 0,
        quick_deduction: 0,
        created_at: now,
        updated_at: now,
        _status: "added",
    };
}

function formatAmount(value: number | null | undefined): string {
    if (value == null) return "-";
    return Number(value).toLocaleString();
}

export function PayrollIncomeTaxBracketManager() {
    const { can, loading: menuActionLoading } = useMenuActions("/payroll/income-tax-brackets");
    const [rows, setRows] = useState<RowData[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchYear, setSearchYear] = useState<string>(new Date().getFullYear().toString());
    const [appliedYear, setAppliedYear] = useState<string>(new Date().getFullYear().toString());
    const [page, setPage] = useState(1);
    const [gridMountKey, setGridMountKey] = useState(0);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const [pendingQuery, setPendingQuery] = useState(false);

    const gridApiRef = useRef<GridApi<RowData> | null>(null);
    const tempIdRef = useRef(-1);
    const rowsRef = useRef<RowData[]>([]);
    const pageSize = 100;

    const issueTempId = () => {
        const id = tempIdRef.current;
        tempIdRef.current -= 1;
        return id;
    };

    const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
    const hasChanges = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);
    const rowClassRules = useMemo(() => buildGridRowClassRules<RowData>(), []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/pay/setup/income-tax-brackets", { cache: "no-store" });
            if (!res.ok) throw new Error("소득세 구간 목록을 불러오지 못했습니다.");
            const data = (await res.json()) as { items: PayIncomeTaxBracketItem[] };
            const nextRows = data.items.map(toGridRow);
            rowsRef.current = nextRows;
            setRows(nextRows);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "로딩 실패");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const getRowKey = useCallback((row: RowData) => String(row.id), []);

    const applyGridTransaction = useCallback(
        (prevRows: RowData[], nextRows: RowData[]) => {
            const api = gridApiRef.current;
            if (!api) return;

            const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
            const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
            const add: RowData[] = [];
            const update: RowData[] = [];
            const remove: RowData[] = [];

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
        (updater: (prevRows: RowData[]) => RowData[]) => {
            const prevRows = rowsRef.current;
            const nextRows = updater(prevRows);
            rowsRef.current = nextRows;
            setRows(nextRows);
            applyGridTransaction(prevRows, nextRows);
        },
        [applyGridTransaction],
    );

    const toggleDelete = useCallback(
        (rowId: number, checked: boolean) => {
            commitRows((prev) =>
                toggleDeletedStatus(prev, rowId, checked, {
                    shouldBeClean: (candidate) => isReverted(candidate),
                    removeAddedRow: true,
                }),
            );
        },
        [commitRows],
    );

    const columnDefs = useMemo<ColDef<RowData>[]>(
        () => [
            {
                headerName: "삭제",
                width: 52,
                pinned: "left",
                sortable: false,
                filter: false,
                suppressHeaderMenuButton: true,
                resizable: false,
                editable: false,
                cellRenderer: (params: ICellRendererParams<RowData>) => {
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
                cellClass: (p) => getGridStatusCellClass(p.value as RowStatus),
                valueFormatter: (p) => STATUS_LABELS[(p.value as RowStatus) ?? "clean"],
            },
            {
                headerName: "연도",
                field: "year",
                width: 90,
                editable: (p) => p.data?._status === "added",
                cellStyle: { textAlign: "right" } as CellStyle,
                valueParser: (p) => parseInt(p.newValue, 10) || new Date().getFullYear(),
            },
            {
                headerName: "과세표준 하한 (연간, 원)",
                field: "annual_taxable_from",
                width: 200,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" } as CellStyle,
                valueFormatter: (p) => formatAmount(p.value as number),
                valueParser: (p) => parseInt(String(p.newValue).replace(/,/g, ""), 10) || 0,
            },
            {
                headerName: "과세표준 상한 (연간, 원)",
                field: "annual_taxable_to",
                width: 200,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" } as CellStyle,
                valueFormatter: (p) => (p.value != null ? formatAmount(p.value as number) : "∞ (최고 구간)"),
                valueParser: (p) => {
                    const s = String(p.newValue).replace(/,/g, "").trim();
                    if (!s || s === "∞" || s === "-") return null;
                    const v = parseInt(s, 10);
                    return isNaN(v) ? null : v;
                },
            },
            {
                headerName: "세율 (%)",
                field: "tax_rate",
                width: 110,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" } as CellStyle,
                valueFormatter: (p) => (p.value != null ? `${p.value}%` : "-"),
                valueParser: (p) => {
                    const v = parseFloat(p.newValue);
                    return isNaN(v) ? 0 : v;
                },
            },
            {
                headerName: "누진공제액 (원)",
                field: "quick_deduction",
                width: 160,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" } as CellStyle,
                valueFormatter: (p) => formatAmount(p.value as number),
                valueParser: (p) => {
                    const v = parseFloat(String(p.newValue).replace(/,/g, ""));
                    return isNaN(v) ? 0 : v;
                },
            },
            {
                headerName: "월 소득세 산식",
                editable: false,
                sortable: false,
                filter: false,
                flex: 1,
                minWidth: 260,
                valueGetter: (p) => {
                    const row = p.data;
                    if (!row || row._status === "deleted") return "";
                    const rate = row.tax_rate ?? 0;
                    const deduct = row.quick_deduction ?? 0;
                    return `(연간과표 × ${rate}% − ${Number(deduct).toLocaleString()}) ÷ 12`;
                },
                cellStyle: { color: "var(--vibe-text-muted, #94a3b8)", fontStyle: "italic" } as CellStyle,
            },
        ],
        [toggleDelete],
    );

    const defaultColDef = useMemo<ColDef<RowData>>(
        () => ({ sortable: true, filter: true, resizable: true, editable: false }),
        [],
    );
    const selectionColumnDef = useMemo<ColDef<RowData>>(
        () => ({
            width: 52,
            pinned: "left",
            sortable: false,
            filter: false,
            resizable: false,
            suppressHeaderMenuButton: true,
        }),
        [],
    );

    const onGridReady = useCallback((e: GridReadyEvent<RowData>) => {
        gridApiRef.current = e.api;
    }, []);

    const onCellValueChanged = useCallback(
        (e: CellValueChangedEvent<RowData>) => {
            if (e.newValue === e.oldValue) return;
            const rowId = e.data?.id;
            if (rowId == null) return;
            commitRows((prev) =>
                prev.map((row) => {
                    if (row.id !== rowId) return row;
                    return reconcileUpdatedStatus({ ...row } as RowData, {
                        shouldBeClean: (candidate) => isReverted(candidate),
                    });
                }),
            );
        },
        [commitRows],
    );

    function addRow() {
        const row = createEmptyRow(issueTempId());
        commitRows((prev) => [row, ...prev]);
    }

    function copySelectedRows() {
        if (!gridApiRef.current) return;
        const selected = gridApiRef.current.getSelectedRows().filter((r) => r._status !== "deleted");
        if (selected.length === 0) return;
        const selectedIdSet = new Set(selected.map((r) => r.id));
        const clones = new Map(
            selected.map((r) => [
                r.id,
                { ...r, id: issueTempId(), _status: "added" as const, _original: undefined, _prevStatus: undefined },
            ]),
        );
        commitRows((prev) => {
            const next: RowData[] = [];
            for (const row of prev) {
                next.push(row);
                if (selectedIdSet.has(row.id)) {
                    const clone = clones.get(row.id);
                    if (clone) next.push(clone);
                }
            }
            return next;
        });
    }

    async function downloadExcel() {
        try {
            const headers = ["연도", "하한(연간원)", "상한(연간원)", "세율(%)", "누진공제(원)"];
            const data = rows
                .filter((r) => r._status !== "deleted")
                .map((r) => [
                    r.year,
                    r.annual_taxable_from,
                    r.annual_taxable_to ?? "",
                    r.tax_rate,
                    r.quick_deduction,
                ]);
            const { utils, writeFileXLSX } = await import("xlsx");
            const sheet = utils.aoa_to_sheet([headers, ...data]);
            const book = utils.book_new();
            utils.book_append_sheet(book, sheet, "소득세구간");
            writeFileXLSX(book, `income-tax-brackets-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch {
            toast.error("다운로드에 실패했습니다.");
        }
    }

    async function handleQuery() {
        setAppliedYear(searchYear);
        await loadData();
        tempIdRef.current = -1;
        gridApiRef.current = null;
        setGridMountKey((k) => k + 1);
        setPage(1);
    }

    function handleQueryRequest() {
        gridApiRef.current?.stopEditing();
        if (hasChanges) {
            setPendingQuery(true);
            setDiscardDialogOpen(true);
            return;
        }
        void handleQuery();
    }

    async function saveAllChanges() {
        const toInsert = rows.filter((r) => r._status === "added");
        const toUpdate = rows.filter((r) => r._status === "updated");
        const toDelete = rows.filter((r) => r._status === "deleted" && r.id > 0);

        if (toInsert.length + toUpdate.length + toDelete.length === 0) return;

        for (const r of [...toInsert, ...toUpdate]) {
            if (!r.year) { toast.error(`연도를 입력해 주세요. (행 ID: ${r.id})`); return; }
            if (r.annual_taxable_from == null || r.annual_taxable_from < 0) {
                toast.error(`과세표준 하한을 0 이상으로 입력해 주세요. (연도: ${r.year})`);
                return;
            }
            if (r.tax_rate == null || r.tax_rate < 0) {
                toast.error(`세율을 0 이상으로 입력해 주세요. (연도: ${r.year})`);
                return;
            }
        }

        setSaving(true);
        try {
            const payload: PayIncomeTaxBracketBatchRequest = {
                items: [...toInsert, ...toUpdate].map((r) => ({
                    id: r.id > 0 ? r.id : undefined,
                    year: r.year,
                    annual_taxable_from: r.annual_taxable_from,
                    annual_taxable_to: r.annual_taxable_to,
                    tax_rate: r.tax_rate,
                    quick_deduction: r.quick_deduction,
                })),
                delete_ids: toDelete.map((r) => r.id),
            };

            const res = await fetch("/api/pay/setup/income-tax-brackets/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const json = (await res.json().catch(() => ({}))) as { detail?: string };
                toast.error(json.detail ?? "저장에 실패했습니다.");
                return;
            }

            const json = (await res.json()) as PayIncomeTaxBracketBatchResponse;
            const nextRows = json.items.map(toGridRow);
            rowsRef.current = nextRows;
            setRows(nextRows);
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

    const filteredRows = useMemo(() => {
        const y = parseInt(appliedYear, 10);
        return rows.filter((r) => {
            if (!isNaN(y) && r.year !== y && appliedYear !== "") return false;
            return true;
        });
    }, [rows, appliedYear]);
    const totalCount = filteredRows.length;
    const pagedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [filteredRows, page, pageSize]);
    const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

    const toolbarActions = [
        { key: "create", label: "입력", icon: Plus, onClick: addRow },
        { key: "copy", label: "복사", icon: Copy, onClick: copySelectedRows },
        { key: "download", label: "다운로드", icon: Download, onClick: () => void downloadExcel() },
    ];
    const filteredToolbarActions = toolbarActions.filter((action) => can(ACTION_CODE_BY_KEY[action.key] ?? action.key));
    const toolbarSaveAction = can("save")
        ? {
            key: "save",
            label: saving ? "저장중..." : "저장",
            icon: Save,
            onClick: () => void saveAllChanges(),
            disabled: saving || menuActionLoading,
        }
        : undefined;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-sm text-slate-500">소득세 구간 데이터를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <ManagerPageShell>
            <ManagerSearchSection
                title="소득세 구간 관리"
                onQuery={handleQueryRequest}
                queryDisabled={saving || menuActionLoading || !can("query")}
            >
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <div className="text-xs text-slate-500">조회 연도</div>
                        <Input
                            type="number"
                            value={searchYear}
                            onChange={(e) => setSearchYear(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleQueryRequest(); }}
                            placeholder="예: 2026 (전체 조회시 비움)"
                            className="h-9 w-48 text-sm"
                        />
                    </div>
                    <div className="text-xs text-slate-400 self-end pb-1">
                        산식: (연간과세표준 × 세율 − 누진공제) ÷ 12 = 월 소득세
                    </div>
                </div>
            </ManagerSearchSection>

            <ManagerGridSection
                headerLeft={
                    <>
                        <GridPaginationControls page={page} totalPages={pagination.totalPages} pageInput={pagination.pageInput} setPageInput={pagination.setPageInput} goPrev={pagination.goPrev} goNext={pagination.goNext} goToPage={pagination.goToPage} />
                        <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
                        <GridChangeSummaryBadges summary={changeSummary} />
                    </>
                }
                headerRight={
                    <GridToolbarActions
                        actions={filteredToolbarActions}
                        saveAction={toolbarSaveAction}
                    />
                }
                contentClassName="min-h-0 flex-1 px-6 pb-4"
            >
                <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
                    <AgGridReact<RowData>
                        theme="legacy"
                        key={gridMountKey}
                        rowData={pagedRows}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        rowSelection={{ mode: "multiRow" }}
                        selectionColumnDef={selectionColumnDef}
                        animateRows={false}
                        rowClassRules={rowClassRules}
                        getRowClass={(params) => getGridRowClass(params.data?._status)}
                        getRowId={(p) => String(p.data.id)}
                        onGridReady={onGridReady}
                        onCellValueChanged={onCellValueChanged}
                        localeText={AG_GRID_LOCALE_KO}
                        overlayNoRowsTemplate='<span class="text-sm text-slate-400">조회된 소득세 구간 데이터가 없습니다.</span>'
                        headerHeight={36}
                        rowHeight={34}
                    />
                </div>
            </ManagerGridSection>

            <ConfirmDialog
                open={discardDialogOpen}
                onOpenChange={setDiscardDialogOpen}
                title="저장되지 않은 변경 사항이 있습니다."
                description="현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?"
                confirmLabel="무시하고 이동"
                cancelLabel="취소"
                onConfirm={() => {
                    setDiscardDialogOpen(false);
                    if (pendingQuery) {
                        setPendingQuery(false);
                        void handleQuery();
                    }
                }}
            />
        </ManagerPageShell>
    );
}
