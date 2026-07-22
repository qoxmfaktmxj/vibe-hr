"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import type {
  MngOutsourceAttendanceItem,
  MngOutsourceAttendanceListResponse,
  MngOutsourceAttendanceSummaryItem,
  MngOutsourceAttendanceSummaryResponse,
} from "@/types/mng";

type AttendanceForm = {
  attendance_code: string;
  status_code: string;
  start_date: string;
  end_date: string;
  apply_date: string;
  apply_count: string;
  note: string;
};

type AttendanceSummaryGridRow = (MngOutsourceAttendanceSummaryItem & { id: number }) & ReadonlyGridRow;function toXlsxSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet1";
}

async function downloadRowsAsXlsx<Row extends ReadonlyGridRow>(
  columns: ColDef<Row>[],
  rows: Row[],
  title: string,
  fileName: string,
) {
  const visibleColumns = columns.filter((column) => column.field || column.valueGetter);
  const headers = visibleColumns.map((column) => column.headerName ?? String(column.field ?? ""));
  const data = rows.map((row) =>
    visibleColumns.map((column) => {
      const field = column.field as keyof Row | undefined;
      const rawValue = field ? row[field] : undefined;
      if (typeof column.valueFormatter === "function") {
        return (column.valueFormatter as (params: { value: unknown; data: Row }) => string)({
          value: rawValue,
          data: row,
        }) ?? "";
      }
      return rawValue ?? "";
    }),
  );
  const { utils, writeFileXLSX } = await import("xlsx");
  const sheet = utils.aoa_to_sheet([headers, ...data]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, toXlsxSheetName(title));
  writeFileXLSX(workbook, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const EMPTY_FORM: AttendanceForm = {
  attendance_code: "",
  status_code: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  apply_date: "",
  apply_count: "1",
  note: "",
};

export function OutsourceAttendanceManager() {
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [form, setForm] = useState<AttendanceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { mutate: globalMutate } = useSWRConfig();

  const summaryQuery = useMemo(
    () => `/api/mng/outsource-attendances?page=${page}&limit=${pageSize}`,
    [page],
  );

  const { data: summaryData, mutate: mutateSummary, isLoading } = useSWR<MngOutsourceAttendanceSummaryResponse>(
    summaryQuery,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: allSummaryData, mutate: mutateAllSummary } = useSWR<MngOutsourceAttendanceSummaryResponse>(
    "/api/mng/outsource-attendances?page=1&limit=200",
    fetcher,
    { revalidateOnFocus: false },
  );
  const summaryItems = useMemo(() => summaryData?.items ?? [], [summaryData?.items]);
  const allSummaryItems = useMemo(() => allSummaryData?.items ?? [], [allSummaryData?.items]);

  useEffect(() => {
    if (!selectedContractId && allSummaryItems.length > 0) {
      setSelectedContractId(allSummaryItems[0].contract_id);
    }
  }, [allSummaryItems, selectedContractId]);

  const selectedSummary = useMemo(
    () => allSummaryItems.find((item) => item.contract_id === selectedContractId) ?? null,
    [allSummaryItems, selectedContractId],
  );

  const detailEndpoint = selectedContractId ? `/api/mng/outsource-attendances/${selectedContractId}` : null;
  const { data: detailData, mutate: mutateDetail } = useSWR<MngOutsourceAttendanceListResponse>(
    detailEndpoint,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function refreshAll() {
    await Promise.all([
      globalMutate((key) => typeof key === "string" && key.startsWith("/api/mng/outsource-attendances")),
      mutateAllSummary(),
      mutateDetail(),
    ]);
  }
  const details = detailData?.items ?? [];

  const rowData = useMemo<AttendanceSummaryGridRow[]>(
    () =>
      createReadonlyGridRows(
        summaryItems.map((item) => ({
          ...item,
          id: item.contract_id,
        })),
      ),
    [summaryItems],
  );

  const summaryColumnDefs = useMemo<ColDef<AttendanceSummaryGridRow>[]>(
    () => [
      { field: "employee_name", headerName: "사원", width: 120 },
      { field: "employee_no", headerName: "사번", width: 110 },
      { field: "start_date", headerName: "계약시작", width: 120 },
      { field: "end_date", headerName: "계약종료", width: 120 },
      { field: "total_count", headerName: "총일수", width: 90 },
      { field: "used_count", headerName: "사용", width: 90 },
      { field: "remain_count", headerName: "잔여", width: 90 },
    ],
    [],
  );

  const detailColumnDefs = useMemo<ColDef<MngOutsourceAttendanceItem>[]>(
    () => [
      { field: "attendance_code", headerName: "근태코드", width: 120 },
      { field: "start_date", headerName: "시작일", width: 120 },
      { field: "end_date", headerName: "종료일", width: 120 },
      { field: "apply_count", headerName: "적용일수", width: 100 },
      { field: "note", headerName: "비고", minWidth: 140, flex: 1 },
    ],
    [],
  );

  async function saveAttendance() {
    if (!selectedContractId || !selectedSummary) {
      toast.error("먼저 계약을 선택해 주세요.");
      return;
    }
    if (!form.attendance_code.trim()) {
      toast.error("근태코드를 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/mng/outsource-attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: selectedContractId,
          employee_id: selectedSummary.employee_id,
          attendance_code: form.attendance_code.trim(),
          status_code: form.status_code || null,
          start_date: form.start_date,
          end_date: form.end_date,
          apply_date: form.apply_date || null,
          apply_count: form.apply_count ? Number(form.apply_count) : null,
          note: form.note || null,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "등록에 실패했습니다.");

      toast.success("등록되었습니다.");
      setForm(EMPTY_FORM);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttendance(item: MngOutsourceAttendanceItem) {
    if (!confirm("선택한 근태 이력을 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/outsource-attendances", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "삭제에 실패했습니다.");

      toast.success("삭제되었습니다.");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReadonlyGridManager<AttendanceSummaryGridRow>
      title="외주 근태 현황"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-1">
          <div className="flex items-center text-sm text-muted-foreground">
            계약별 잔여 일수와 상세 근태 이력을 함께 관리합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground">근태 상세 등록</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                value={form.attendance_code}
                onChange={(event) => setForm((prev) => ({ ...prev, attendance_code: event.target.value }))}
                placeholder="근태코드"
              />
              <Input
                value={form.status_code}
                onChange={(event) => setForm((prev) => ({ ...prev, status_code: event.target.value }))}
                placeholder="상태코드"
              />
              <CustomDatePicker
                value={form.start_date}
                onChange={(value) => setForm((prev) => ({ ...prev, start_date: value }))}
                holidays={HOLIDAY_DATE_KEYS}
              />
              <CustomDatePicker
                value={form.end_date}
                onChange={(value) => setForm((prev) => ({ ...prev, end_date: value }))}
                holidays={HOLIDAY_DATE_KEYS}
              />
              <CustomDatePicker
                value={form.apply_date}
                onChange={(value) => setForm((prev) => ({ ...prev, apply_date: value }))}
                holidays={HOLIDAY_DATE_KEYS}
              />
              <Input
                value={form.apply_count}
                onChange={(event) => setForm((prev) => ({ ...prev, apply_count: event.target.value }))}
                placeholder="적용일수"
              />
              <Input
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="비고"
                className="xl:col-span-2"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="save" onClick={() => void saveAttendance()} disabled={saving}>
                등록
              </Button>
              <Button variant="outline" onClick={() => setForm(EMPTY_FORM)} disabled={saving}>
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>
      }
      afterGrid={
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground">
              근태 상세 {selectedSummary ? `- ${selectedSummary.employee_name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MngSimpleGrid<MngOutsourceAttendanceItem>
              rowData={details}
              columnDefs={detailColumnDefs}
              getRowId={(row) => String(row.id)}
              height={260}
            />
            <div className="flex flex-wrap gap-2">
              {details.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteAttendance(item)}
                  disabled={saving}
                >
                  {item.attendance_code} 삭제
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      }
      rowData={rowData}
      columnDefs={summaryColumnDefs}
      onDownload={() => void downloadRowsAsXlsx(summaryColumnDefs, rowData, "외주 근태 현황", "mng-outsource-attendance")}
      totalCount={summaryData?.total_count ?? 0}
      page={summaryData?.page ?? page}
      pageSize={summaryData?.limit ?? pageSize}
      selectedRowId={selectedContractId}
      onRowClick={(row) => setSelectedContractId(row.contract_id)}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        void mutateSummary();
      }}
      queryDisabled={isLoading}
      loading={isLoading}
      emptyText="외주 근태 요약 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
