"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Copy, Save, Download, Search } from "lucide-react";
import { toast } from "sonner";

import {
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
import type {
    PayTaxRateItem,
    PayTaxRateBatchRequest,
    PayTaxRateBatchResponse,
} from "@/types/pay";


type RowStatus = GridRowStatus;

type RowData = PayTaxRateItem & {
    _status: RowStatus;
    _original?: Record<string, unknown>;
    _prevStatus?: RowStatus;
};

const TRACKED_FIELDS: (keyof PayTaxRateItem)[] = [
    "year", "rate_type", "employee_rate", "employer_rate", "min_limit", "max_limit",
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

function snapshotOriginal(row: PayTaxRateItem): Record<string, unknown> {
    return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: RowData): boolean {
    return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: PayTaxRateItem): RowData {
    return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number): RowData {
    const now = new Date().toISOString();
    return {
        id: tempId,
        year: new Date().getFullYear(),
        rate_type: "",
        employee_rate: null,
        employer_rate: null,
        min_limit: null,
        max_limit: null,
        created_at: now,
        updated_at: now,
        _status: "added",
    };
}

export function PayrollTaxRateManager() {
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
            const res = await fetch("/api/pay/setup/tax-rates", { cache: "no-store" });
            if (!res.ok) throw new Error("세율 목록을 불러오지 못했습니다.");
            const data = (await res.json()) as { items: PayTaxRateItem[] };
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
                width: 100,
                editable: (p) => p.data?._status === "added",
                cellStyle: { textAlign: "right" },
                valueParser: (p) => parseInt(p.newValue, 10) || new Date().getFullYear(),
            },
            {
                headerName: "요율/세율 이름",
                field: "rate_type",
                flex: 1,
                minWidth: 160,
                editable: (p) => p.data?._status === "added",
            },
            {
                headerName: "근로자 부담 요율 (%)",
                field: "employee_rate",
                width: 180,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" },
                valueFormatter: (p) => (p.value != null ? String(p.value) : "-"),
                valueParser: (p) => {
                    const v = parseFloat(p.newValue);
                    return isNaN(v) ? null : v;
                },
            },
            {
                headerName: "사업주 부담 요율 (%)",
                field: "employer_rate",
                width: 180,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" },
                valueFormatter: (p) => (p.value != null ? String(p.value) : "-"),
                valueParser: (p) => {
                    const v = parseFloat(p.newValue);
                    return isNaN(v) ? null : v;
                },
            },
            {
                headerName: "하한액 (소득월액)",
                field: "min_limit",
                width: 160,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" },
                valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "-"),
                valueParser: (p) => {
                    const v = parseInt(p.newValue.replace(/,/g, ''), 10);
                    return isNaN(v) ? null : v;
                },
            },
            {
                headerName: "상한액 (소득월액)",
                field: "max_limit",
                width: 160,
                editable: (p) => p.data?._status !== "deleted",
                cellStyle: { textAlign: "right" },
                valueFormatter: (p) => (p.value != null ? Number(p.value).toLocaleString() : "-"),
                valueParser: (p) => {
                    const v = parseInt(p.newValue.replace(/,/g, ''), 10);
                    return isNaN(v) ? null : v;
                },
            },
        ],
        [toggleDelete],
    );

    const defaultColDef = useMemo<ColDef<RowData>>(
        () => ({ sortable: true, filter: true, resizable: true, editable: false }),
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
            const headers = ["연도", "이름", "근로자요율", "사업주요율", "하한액", "상한액"];
            const data = rows
                .filter((r) => r._status !== "deleted")
                .map((r) => [
                    r.year, r.rate_type, r.employee_rate ?? "", r.employer_rate ?? "", r.min_limit ?? "", r.max_limit ?? ""
                ]);
            const { utils, writeFileXLSX } = await import("xlsx");
            const sheet = utils.aoa_to_sheet([headers, ...data]);
            const book = utils.book_new();
            utils.book_append_sheet(book, sheet, "세율");
            writeFileXLSX(book, `tax-rates-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            if (!r.rate_type.trim()) { toast.error(`세율 이름을 입력해 주세요. (연도: ${r.year})`); return; }
        }

        setSaving(true);
        try {
            const payload: PayTaxRateBatchRequest = {
                items: [...toInsert, ...toUpdate].map((r) => ({
                    id: r.id > 0 ? r.id : undefined,
                    year: r.year,
                    rate_type: r.rate_type.trim(),
                    employee_rate: r.employee_rate,
                    employer_rate: r.employer_rate,
                    min_limit: r.min_limit,
                    max_limit: r.max_limit,
                })),
                delete_ids: toDelete.map((r) => r.id),
            };

            const res = await fetch("/api/pay/setup/tax-rates/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const json = (await res.json().catch(() => ({}))) as { detail?: string };
                toast.error(json.detail ?? "저장에 실패했습니다.");
                return;
            }

            const json = (await res.json()) as PayTaxRateBatchResponse;
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

    function handleTemplateDownload() {
        toast.success("양식 다운로드는 다음 단계에서 연결합니다.");
    }

    function handleUpload() {
        toast.success("업로드는 다음 단계에서 연결합니다.");
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-sm text-slate-500">세율 데이터를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <ManagerPageShell>
            <ManagerSearchSection title="세율관리" onQuery={handleQueryRequest}>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <div className="text-xs text-slate-500">조회 연도</div>
                        <Input
                            type="number"
                            value={searchYear}
                            onChange={(e) => setSearchYear(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleQueryRequest(); }}
                            placeholder="예: 2024 (전체 조회시 비움)"
                            className="h-9 w-48 text-sm"
                        />
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
                        actions={[
                            { key: "create", label: "입력", icon: Plus, onClick: addRow },
                            { key: "copy", label: "복사", icon: Copy, onClick: copySelectedRows },
                            { key: "template", label: "양식 다운로드", icon: Search, onClick: handleTemplateDownload },
                            { key: "upload", label: "업로드", icon: Search, onClick: handleUpload },
                            { key: "download", label: "다운로드", icon: Download, onClick: () => void downloadExcel() },
                        ]}
                        saveAction={{ key: "save", label: saving ? "저장중..." : "저장", icon: Save, onClick: () => void saveAllChanges(), disabled: saving }}
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
                        rowSelection="multiple"
                        suppressRowClickSelection={true}
                        animateRows={false}
                        rowClassRules={rowClassRules}
                        getRowClass={(params) => getGridRowClass(params.data?._status)}
                        getRowId={(p) => String(p.data.id)}
                        onGridReady={onGridReady}
                        onCellValueChanged={onCellValueChanged}
                        localeText={AG_GRID_LOCALE_KO}
                        overlayNoRowsTemplate='<span class="text-sm text-slate-400">조회된 세율 데이터가 없습니다.</span>'
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

