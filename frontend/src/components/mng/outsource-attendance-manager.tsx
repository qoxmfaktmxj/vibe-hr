"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";

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

  const { data: summaryData, mutate: mutateSummary } = useSWR<MngOutsourceAttendanceSummaryResponse>(
    "/api/mng/outsource-attendances",
    fetcher,
    { revalidateOnFocus: false },
  );
  const summaryItems = useMemo(() => summaryData?.items ?? [], [summaryData?.items]);

  useEffect(() => {
    if (!selectedContractId && summaryItems.length > 0) {
      setSelectedContractId(summaryItems[0].contract_id);
    }
  }, [selectedContractId, summaryItems]);

  const selectedSummary = useMemo(
    () => summaryItems.find((item) => item.contract_id === selectedContractId) ?? null,
    [selectedContractId, summaryItems],
  );

  const detailEndpoint = selectedContractId ? `/api/mng/outsource-attendances/${selectedContractId}` : null;
  const { data: detailData, mutate: mutateDetail } = useSWR<MngOutsourceAttendanceListResponse>(
    detailEndpoint,
    fetcher,
    { revalidateOnFocus: false },
  );
  const details = detailData?.items ?? [];
  const summaryColumnDefs: ColDef<MngOutsourceAttendanceSummaryItem>[] = [
    { field: "employee_name", headerName: "사원", width: 120 },
    { field: "employee_no", headerName: "사번", width: 110 },
    { field: "start_date", headerName: "계약시작", width: 120 },
    { field: "end_date", headerName: "계약종료", width: 120 },
    { field: "total_count", headerName: "총일수", width: 90 },
    { field: "used_count", headerName: "사용", width: 90 },
    { field: "remain_count", headerName: "잔여", width: 90 },
  ];
  const detailColumnDefs: ColDef<MngOutsourceAttendanceItem>[] = [
    { field: "attendance_code", headerName: "근태코드", width: 120 },
    { field: "start_date", headerName: "시작일", width: 120 },
    { field: "end_date", headerName: "종료일", width: 120 },
    { field: "apply_count", headerName: "적용일수", width: 100 },
    { field: "note", headerName: "비고", flex: 1, minWidth: 140 },
  ];

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
      await Promise.all([mutateDetail(), mutateSummary()]);
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
      await Promise.all([mutateDetail(), mutateSummary()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>외주 근태 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <MngSimpleGrid<MngOutsourceAttendanceSummaryItem>
            rowData={summaryItems}
            columnDefs={summaryColumnDefs}
            onRowClick={(row) => setSelectedContractId(row.contract_id)}
            getRowId={(row) => String(row.contract_id)}
            selectedRowId={selectedContractId ? String(selectedContractId) : null}
            height={380}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>근태 상세</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              className="md:col-span-2"
            />
          </div>
          <Button variant="save" onClick={() => void saveAttendance()} disabled={saving}>
            등록
          </Button>

          <MngSimpleGrid<MngOutsourceAttendanceItem>
            rowData={details}
            columnDefs={detailColumnDefs}
            height={280}
          />
          <div className="flex flex-wrap gap-2">
            {details.map((item) => (
              <Button key={item.id} size="sm" variant="outline" onClick={() => void deleteAttendance(item)} disabled={saving}>
                {item.attendance_code} 삭제
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
