"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimAnnualLeaveItem, TimAnnualLeaveListResponse, TimAnnualLeaveResponse } from "@/types/tim";

type AnnualLeaveGridRow = TimAnnualLeaveItem & ReadonlyGridRow;

function LeaveMetricCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}

export function AnnualLeaveManager() {
  const [yearInput, setYearInput] = useState(new Date().getFullYear());
  const [appliedYear, setAppliedYear] = useState(yearInput);
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [employeeId, setEmployeeId] = useState("");
  const [adjustmentDays, setAdjustmentDays] = useState("0");
  const [reason, setReason] = useState("");

  const myKey = `/api/tim/annual-leave/my?year=${appliedYear}`;
  const listKey = useMemo(() => {
    const params = new URLSearchParams({
      year: String(appliedYear),
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedKeyword.trim()) {
      params.set("keyword", appliedKeyword.trim());
    }
    return `/api/tim/annual-leave/list?${params.toString()}`;
  }, [appliedKeyword, appliedYear, page]);

  const { data: myLeave } = useSWR<TimAnnualLeaveResponse>(myKey, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: listData, isLoading, mutate: mutateList } = useSWR<TimAnnualLeaveListResponse>(
    listKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const rowData = useMemo<AnnualLeaveGridRow[]>(
    () => createReadonlyGridRows(listData?.items ?? []),
    [listData?.items],
  );

  const columnDefs = useMemo<ColDef<AnnualLeaveGridRow>[]>(
    () => [
      { field: "department_name", headerName: "부서", minWidth: 140, flex: 1 },
      { field: "employee_no", headerName: "사번", width: 120 },
      { field: "employee_name", headerName: "이름", width: 120 },
      { field: "granted_days", headerName: "발생", width: 100 },
      { field: "used_days", headerName: "사용", width: 100 },
      { field: "carried_over_days", headerName: "이월", width: 100 },
      { field: "remaining_days", headerName: "잔여", width: 110 },
      { field: "grant_type", headerName: "부여유형", width: 120 },
    ],
    [],
  );

  async function adjustAnnualLeave() {
    const parsedEmployeeId = Number(employeeId);
    const parsedAdjustmentDays = Number(adjustmentDays);

    if (!Number.isFinite(parsedEmployeeId) || parsedEmployeeId <= 0) {
      toast.error("직원 ID를 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(parsedAdjustmentDays)) {
      toast.error("조정 일수를 확인해 주세요.");
      return;
    }
    if (!reason.trim()) {
      toast.error("조정 사유를 입력해 주세요.");
      return;
    }

    const response = await fetch("/api/tim/annual-leave/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: parsedEmployeeId,
        year: appliedYear,
        adjustment_days: parsedAdjustmentDays,
        reason: reason.trim(),
      }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      toast.error(json?.detail ?? "연차 조정에 실패했습니다.");
      return;
    }

    toast.success("연차 조정이 완료되었습니다.");
    setEmployeeId("");
    setAdjustmentDays("0");
    setReason("");
    await mutate(myKey);
    await mutateList();
  }

  return (
    <ReadonlyGridManager<AnnualLeaveGridRow>
      title="연차 관리"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-4">
          <Input
            type="number"
            value={yearInput}
            onChange={(event) => setYearInput(Number(event.target.value))}
            aria-label="기준연도"
          />
          <SearchTextField
            value={keywordInput}
            onChange={setKeywordInput}
            placeholder="사번 또는 이름"
          />
          <div className="flex items-center text-sm text-slate-500 md:col-span-2">
            연도별 연차 현황과 잔여 일수를 조회할 수 있습니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 md:grid-cols-4">
            <LeaveMetricCard title="발생" value={myLeave?.item.granted_days ?? "-"} />
            <LeaveMetricCard title="사용" value={myLeave?.item.used_days ?? "-"} />
            <LeaveMetricCard title="이월" value={myLeave?.item.carried_over_days ?? "-"} />
            <LeaveMetricCard title="잔여" value={myLeave?.item.remaining_days ?? "-"} />
          </div>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-700">관리자 연차 조정</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Input
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="employee_id"
              />
              <Input
                value={adjustmentDays}
                onChange={(event) => setAdjustmentDays(event.target.value)}
                placeholder="조정 일수 (+/-)"
              />
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="조정 사유"
              />
              <Button onClick={() => void adjustAnnualLeave()}>조정 반영</Button>
            </CardContent>
          </Card>
        </div>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={listData?.total_count ?? 0}
      page={listData?.page ?? page}
      pageSize={listData?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedYear(yearInput);
        setAppliedKeyword(keywordInput);
        void mutate(myKey);
        void mutateList();
      }}
      loading={isLoading}
      emptyText="연차 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
