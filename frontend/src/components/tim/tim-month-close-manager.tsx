"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, LockOpen } from "lucide-react";
import { toast } from "sonner";

import { ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { LocalReadonlyGrid } from "@/components/grid/readonly-grid-manager";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { TimMonthCloseItem, TimMonthCloseListResponse } from "@/types/tim";

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function buildYearGrid(year: number, items: TimMonthCloseItem[]): (TimMonthCloseItem | null)[] {
  const map = new Map(items.map((it) => [it.month, it]));
  return Array.from({ length: 12 }, (_, i) => map.get(i + 1) ?? null);
}

export function TimMonthCloseManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/tim/month-closing");
  const currentYear = new Date().getFullYear();
  const [searchYear, setSearchYear] = useState(currentYear);
  const [appliedYear, setAppliedYear] = useState(currentYear);
  const [items, setItems] = useState<TimMonthCloseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [targetMonth, setTargetMonth] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [acting, setActing] = useState(false);

  const fetchData = useCallback((year: number, signal?: AbortSignal) =>
    fetch(`/api/tim/month-close?year=${year}`, { cache: "no-store", signal }).then(async (res) => {
      if (!res.ok) throw new Error("월마감 현황을 불러오지 못했습니다.");
      const data = (await res.json()) as TimMonthCloseListResponse;
      if (signal?.aborted) return;
      setItems(data.items);
    }).catch((e) => {
      if (signal?.aborted) return;
      toast.error(e instanceof Error ? e.message : "조회 실패");
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    }), []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(currentYear, controller.signal);
    return () => controller.abort();
  }, [currentYear, fetchData]);

  function handleQuery() {
    setLoading(true);
    setAppliedYear(searchYear);
    void fetchData(searchYear);
  }

  function requestClose(month: number) {
    setTargetMonth(month);
    setActionNote("");
    setCloseDialogOpen(true);
  }

  function requestReopen(month: number) {
    setTargetMonth(month);
    setActionNote("");
    setReopenDialogOpen(true);
  }

  async function confirmClose() {
    if (!targetMonth) return;
    setActing(true);
    try {
      const res = await fetch("/api/tim/month-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: appliedYear, month: targetMonth, note: actionNote || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        toast.error(json.detail ?? "마감 처리 실패");
        return;
      }
      toast.success(`${appliedYear}년 ${targetMonth}월 마감 완료`);
      setLoading(true);
      await fetchData(appliedYear);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "마감 처리 실패");
    } finally {
      setActing(false);
      setCloseDialogOpen(false);
    }
  }

  async function confirmReopen() {
    if (!targetMonth) return;
    setActing(true);
    try {
      const res = await fetch(`/api/tim/month-close/${appliedYear}/${targetMonth}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        toast.error(json.detail ?? "재오픈 처리 실패");
        return;
      }
      toast.success(`${appliedYear}년 ${targetMonth}월 마감 해제됨`);
      setLoading(true);
      await fetchData(appliedYear);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "재오픈 처리 실패");
    } finally {
      setActing(false);
      setReopenDialogOpen(false);
    }
  }

  const grid = buildYearGrid(appliedYear, items);
  const closedCount = items.filter((it) => it.close_status === "closed").length;

  return (
    <ManagerPageShell className="business-workspace h-auto">
      <ManagerSearchSection
        title="근태 월마감"
        onQuery={handleQuery}
        queryLabel="조회"
        queryDisabled={loading || menuActionLoading || !can("query")}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">조회 연도</div>
            <Input
              type="number"
              value={searchYear}
              onChange={(e) => setSearchYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuery(); }}
              placeholder={String(new Date().getFullYear())}
              className="h-9 w-32 text-sm"
            />
          </div>
        </div>
      </ManagerSearchSection>

      <p className="text-xs text-muted-foreground">{appliedYear}년 / 마감 완료 {closedCount}개월 / 미마감 {12 - closedCount}개월</p>
      <LocalReadonlyGrid title="월별 마감 현황" items={grid.map((item, index) => ({ ...item, id: index + 1, year: appliedYear, month: index + 1 }))} rowId={row => row.month} loading={loading} disabled={acting || menuActionLoading} gridHeight={460} queryLabel="새로고침" onQuery={() => { setLoading(true); void fetchData(appliedYear); }} columns={[
        { field: "month", headerName: "월", minWidth: 130, pinned: "left", valueFormatter: p => `${appliedYear}년 ${MONTH_NAMES[Number(p.value) - 1]}` },
        { field: "close_status", headerName: "상태", width: 110, valueFormatter: p => p.value === "closed" ? "마감완료" : "미마감" },
        ...([['employee_count','인원수'],['present_days','출근'],['absent_days','결근'],['late_days','지각'],['leave_days','휴가']] as const).map(([field, headerName]) => ({ field, headerName, width: 100, cellClass: "text-right", valueFormatter: (p: { value: unknown }) => p.value == null ? "-" : Number(p.value).toLocaleString() })),
        ...([['total_overtime_minutes','연장(h)'],['total_night_minutes','야간(h)'],['total_holiday_work_minutes','휴일(h)']] as const).map(([field, headerName]) => ({ field, headerName, width: 110, cellClass: "text-right", valueFormatter: (p: { value: unknown }) => p.value == null ? "-" : (Number(p.value) / 60).toFixed(1) })),
        { field: "closed_by_name", headerName: "마감자", minWidth: 120 },
        { field: "closed_at", headerName: "마감일시", minWidth: 180, valueFormatter: p => p.value ? new Date(p.value).toLocaleString("ko-KR") : "-" },
        { field: "note", headerName: "메모", minWidth: 170 },
        { colId: "actions", headerName: "처리", width: 115, pinned: "right", sortable: false, filter: false, cellRenderer: ({ data: row }: { data?: { month: number; close_status?: string } }) => {
          if (!row || !can("save")) return null;
          const future = appliedYear > new Date().getFullYear() || (appliedYear === new Date().getFullYear() && row.month > new Date().getMonth() + 1);
          return row.close_status === "closed" ? <Button variant="outline" size="sm" className="!h-7 !min-h-7" disabled={acting || menuActionLoading} onClick={() => requestReopen(row.month)}><LockOpen className="h-3 w-3" />재오픈</Button> : <Button size="sm" className="!h-7 !min-h-7" disabled={acting || menuActionLoading || future} title={future ? "미래 월은 마감할 수 없습니다" : undefined} onClick={() => requestClose(row.month)}><CalendarOff className="h-3 w-3" />마감</Button>;
        } },
      ]} />

      {/* 마감 확인 */}
      <ConfirmDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        title={`${appliedYear}년 ${targetMonth ?? ""}월 근태를 마감하시겠습니까?`}
        description="마감 후에는 해당 월 근태 수정이 제한됩니다. 마감 해제(재오픈)는 가능합니다."
        confirmLabel="마감"
        cancelLabel="취소"
        confirmVariant="default"
        busy={acting}
        onConfirm={() => void confirmClose()}
      >
        <div className="px-6 py-3">
          <label className="mb-1 block text-xs text-muted-foreground">메모 (선택)</label>
          <Input
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="마감 사유 또는 메모"
            className="h-8 text-sm"
          />
        </div>
      </ConfirmDialog>

      {/* 재오픈 확인 */}
      <ConfirmDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        title={`${appliedYear}년 ${targetMonth ?? ""}월 마감을 해제하시겠습니까?`}
        description="마감 해제 후 해당 월 근태 데이터를 수정할 수 있습니다."
        confirmLabel="재오픈"
        cancelLabel="취소"
        confirmVariant="destructive"
        busy={acting}
        onConfirm={() => void confirmReopen()}
      />
    </ManagerPageShell>
  );
}
