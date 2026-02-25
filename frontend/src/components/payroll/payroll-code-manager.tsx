"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Copy, Save, Download, Search } from "lucide-react";
import { toast } from "sonner";

import {
    AllCommunityModule,
    ModuleRegistry,
    type CellValueChangedEvent,
    type ICellRendererParams,
    type ColDef,
    type GridApi,
    type GridReadyEvent,
    type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    isRowRevertedToOriginal,
    resolveRestoredStatus,
    snapshotFields,
    type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import type {
    PayPayrollCodeItem,
    PayPayrollCodeBatchRequest,
    PayPayrollCodeBatchResponse,
} from "@/types/pay";

let modulesRegistered = false;
if (!modulesRegistered) {
    ModuleRegistry.registerModules([AllCommunityModule]);
    modulesRegistered = true;
}

type RowStatus = GridRowStatus;

type RowData = PayPayrollCodeItem & {
    _status: RowStatus;
    _original?: Record<string, unknown>;
    _prevStatus?: RowStatus;
};

const TRACKED_FIELDS: (keyof PayPayrollCodeItem)[] = [
    "code", "name", "pay_type", "payment_day", "tax_deductible", "social_ins_deductible", "is_active",
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

function snapshotOriginal(row: PayPayrollCodeItem): Record<string, unknown> {
    return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: RowData): boolean {
    return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: PayPayrollCodeItem): RowData {
    return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number): RowData {
    const now = new Date().toISOString();
    return {
        id: tempId,
        code: "",
        name: "",
        pay_type: "",
        payment_day: "",
        tax_deductible: true,
        social_ins_deductible: true,
        is_active: true,
        created_at: now,
        updated_at: now,
        _status: "added",
    };
}

export function PayrollCodeManager() {
    const [rows, setRows] = useState<RowData[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchName, setSearchName] = useState("");
    const [appliedName, setAppliedName] = useState("");
    const [gridMountKey, setGridMountKey] = useState(0);

    const gridApiRef = useRef<GridApi<RowData> | null>(null);
    const tempIdRef = useRef(-1);

    const issueTempId = () => {
        const id = tempIdRef.current;
        tempIdRef.current -= 1;
        return id;
    };

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

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/pay/setup/codes", { cache: "no-store" });
            if (!res.ok) throw new Error("급여코드 목록을 불러오지 못했습니다.");
            const data = (await res.json()) as { items: PayPayrollCodeItem[] };
            setRows(data.items.map(toGridRow));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "로딩 실패");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const redraw = useCallback(() => {
        if (!gridApiRef.current) return;
        gridApiRef.current.redrawRows();
    }, []);

    const toggleDelete = useCallback(
        (rowId: number, checked: boolean) => {
            setRows((prev) => {
                const next: RowData[] = [];
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
                headerName: "급여코드",
                field: "code",
                width: 140,
                editable: (p) => p.data?._status === "added",
            },
            {
                headerName: "코드명",
                field: "name",
                flex: 1,
                minWidth: 160,
                editable: (p) => p.data?._status !== "deleted",
            },
            {
                headerName: "지급성격",
                field: "pay_type",
                width: 140,
                editable: (p) => p.data?._status !== "deleted",
            },
            {
                headerName: "지급기준일",
                field: "payment_day",
                width: 120,
                editable: (p) => p.data?._status !== "deleted",
            },
            {
                headerName: "소득세공제",
                field: "tax_deductible",
                width: 100,
                editable: (p) => p.data?._status !== "deleted",
                cellEditor: "agSelectCellEditor",
                cellEditorParams: { values: ["Y", "N"] },
                valueFormatter: (p) => (p.value ? "Y" : "N"),
                valueParser: (p) => p.newValue === "Y",
                cellStyle: { textAlign: "center" },
            },
            {
                headerName: "사대보험공제",
                field: "social_ins_deductible",
                width: 110,
                editable: (p) => p.data?._status !== "deleted",
                cellEditor: "agSelectCellEditor",
                cellEditorParams: { values: ["Y", "N"] },
                valueFormatter: (p) => (p.value ? "Y" : "N"),
                valueParser: (p) => p.newValue === "Y",
                cellStyle: { textAlign: "center" },
            },
            {
                headerName: "사용여부",
                field: "is_active",
                width: 100,
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

    const defaultColDef = useMemo<ColDef<RowData>>(
        () => ({ sortable: true, filter: true, resizable: true, editable: false }),
        [],
    );

    const getRowClass = useCallback((params: RowClassParams<RowData>) => {
        if (!params.data) return "";
        if (params.data._status === "added") return "vibe-row-added";
        if (params.data._status === "updated") return "vibe-row-updated";
        if (params.data._status === "deleted") return "vibe-row-deleted";
        return "";
    }, []);

    const onGridReady = useCallback((e: GridReadyEvent<RowData>) => {
        gridApiRef.current = e.api;
    }, []);

    const onCellValueChanged = useCallback(
        (e: CellValueChangedEvent<RowData>) => {
            if (e.newValue === e.oldValue) return;
            const rowId = e.data?.id;
            if (rowId == null) return;
            setRows((prev) =>
                prev.map((row) => {
                    if (row.id !== rowId) return row;
                    const next = { ...row } as RowData;
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

    function addRow() {
        const row = createEmptyRow(issueTempId());
        setRows((prev) => [row, ...prev]);
        setTimeout(redraw, 0);
    }

    function copySelectedRows() {
        if (!gridApiRef.current) return;
        const selected = gridApiRef.current.getSelectedRows().filter((r) => r._status !== "deleted");
        if (selected.length === 0) return;
        const selectedIdSet = new Set(selected.map((r) => r.id));
        const clones = new Map(
            selected.map((r) => [
                r.id,
                { ...r, id: issueTempId(), code: "", _status: "added" as const, _original: undefined, _prevStatus: undefined },
            ]),
        );
        setRows((prev) => {
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
        setTimeout(redraw, 0);
    }

    async function downloadExcel() {
        try {
            const headers = ["급여코드", "코드명", "지급성격", "지급기준일", "소득세공제", "사대보험공제", "사용여부"];
            const data = rows
                .filter((r) => r._status !== "deleted")
                .map((r) => [
                    r.code, r.name, r.pay_type, r.payment_day,
                    r.tax_deductible ? "Y" : "N",
                    r.social_ins_deductible ? "Y" : "N",
                    r.is_active ? "Y" : "N",
                ]);
            const { utils, writeFileXLSX } = await import("xlsx");
            const sheet = utils.aoa_to_sheet([headers, ...data]);
            const book = utils.book_new();
            utils.book_append_sheet(book, sheet, "급여코드");
            writeFileXLSX(book, `payroll-codes-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch {
            toast.error("다운로드에 실패했습니다.");
        }
    }

    async function handleQuery() {
        setAppliedName(searchName);
        await loadData();
        tempIdRef.current = -1;
        gridApiRef.current = null;
        setGridMountKey((k) => k + 1);
    }

    async function saveAllChanges() {
        const toInsert = rows.filter((r) => r._status === "added");
        const toUpdate = rows.filter((r) => r._status === "updated");
        const toDelete = rows.filter((r) => r._status === "deleted" && r.id > 0);

        if (toInsert.length + toUpdate.length + toDelete.length === 0) return;

        for (const r of [...toInsert, ...toUpdate]) {
            if (!r.code.trim()) { toast.error(`급여코드를 입력해 주세요. (행 ID: ${r.id})`); return; }
            if (!r.name.trim()) { toast.error(`코드명을 입력해 주세요. (코드: ${r.code})`); return; }
            if (!r.pay_type.trim()) { toast.error(`지급성격을 입력해 주세요. (코드: ${r.code})`); return; }
            if (!r.payment_day.trim()) { toast.error(`지급기준일을 입력해 주세요. (코드: ${r.code})`); return; }
        }

        setSaving(true);
        try {
            const payload: PayPayrollCodeBatchRequest = {
                items: [...toInsert, ...toUpdate].map((r) => ({
                    id: r.id > 0 ? r.id : undefined,
                    code: r.code.trim().toUpperCase(),
                    name: r.name.trim(),
                    pay_type: r.pay_type.trim(),
                    payment_day: r.payment_day.trim(),
                    tax_deductible: r.tax_deductible,
                    social_ins_deductible: r.social_ins_deductible,
                    is_active: r.is_active,
                })),
                delete_ids: toDelete.map((r) => r.id),
            };

            const res = await fetch("/api/pay/setup/codes/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const json = (await res.json().catch(() => ({}))) as { detail?: string };
                toast.error(json.detail ?? "저장에 실패했습니다.");
                return;
            }

            const json = (await res.json()) as PayPayrollCodeBatchResponse;
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

    const filteredRows = useMemo(() => {
        const name = appliedName.trim().toLowerCase();
        return rows.filter((r) => {
            if (name && !r.name.toLowerCase().includes(name) && !r.code.toLowerCase().includes(name)) return false;
            return true;
        });
    }, [rows, appliedName]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-sm text-slate-500">급여코드 데이터를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-73px)] flex-col">
            <div className="border-b border-gray-200 bg-white px-6 py-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <div className="text-xs text-slate-500">근태명/코드</div>
                        <Input
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleQuery(); }}
                            placeholder="급여코드 또는 명칭"
                            className="h-9 w-48 text-sm"
                        />
                    </div>
                    <Button size="sm" variant="query" onClick={() => void handleQuery()} className="h-9">
                        <Search className="mr-1 h-3.5 w-3.5" />
                        조회
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-800">급여코드 목록</h2>
                    <span className="text-xs text-slate-400">
                        {filteredRows.length} / {rows.length}건
                    </span>
                    {hasChanges && (
                        <div className="flex gap-1.5">
                            {changeSummary.added > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">+{changeSummary.added}</span>}
                            {changeSummary.updated > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">~{changeSummary.updated}</span>}
                            {changeSummary.deleted > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">-{changeSummary.deleted}</span>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={addRow}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> 입력
                    </Button>
                    <Button size="sm" variant="outline" onClick={copySelectedRows}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> 복사
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void downloadExcel()}>
                        <Download className="mr-1 h-3.5 w-3.5" /> 다운로드
                    </Button>
                    <div className="mx-1 h-6 w-px bg-gray-200" />
                    <Button size="sm" variant="save" onClick={() => void saveAllChanges()} disabled={saving}>
                        <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "저장중..." : "저장"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 px-6 pb-4 pt-2">
                <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
                    <AgGridReact<RowData>
                        key={gridMountKey}
                        rowData={filteredRows}
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
                        overlayNoRowsTemplate='<span class="text-sm text-slate-400">급여코드 데이터가 없습니다.</span>'
                        headerHeight={36}
                        rowHeight={34}
                    />
                </div>
            </div>
        </div>
    );
}
