"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Lock, LockOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
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
  const [searchYear, setSearchYear] = useState(new Date().getFullYear());
  const [appliedYear, setAppliedYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<TimMonthCloseItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [targetMonth, setTargetMonth] = useState<number | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async (year: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tim/month-close?year=${year}`, { cache: "no-store" });
      if (!res.ok) throw new Error("월마감 현황을 불러오지 못했습니다.");
      const data = (await res.json()) as TimMonthCloseListResponse;
      setItems(data.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(appliedYear);
  }, [appliedYear, fetchData]);

  function handleQuery() {
    setAppliedYear(searchYear);
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
    <ManagerPageShell>
      <ManagerSearchSection
        title="근태 월마감"
        onQuery={handleQuery}
        queryLabel="조회"
        queryDisabled={loading || menuActionLoading || !can("query")}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">조회 연도</div>
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

      <ManagerGridSection
        headerLeft={
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">{appliedYear}년</span>
            <span className="text-xs text-slate-500">
              마감 완료: <span className="font-semibold text-green-600">{closedCount}</span>개월 /
              미마감: <span className="font-semibold text-slate-500">{12 - closedCount}</span>개월
            </span>
          </div>
        }
        headerRight={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData(appliedYear)}
            disabled={loading}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            새로고침
          </Button>
        }
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-2"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 pl-4 text-left font-medium text-slate-600">월</th>
                  <th className="py-2.5 text-center font-medium text-slate-600">상태</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">인원수</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">출근</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">결근</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">지각</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">휴가</th>
                  <th className="py-2.5 pl-4 text-left font-medium text-slate-600">마감자 / 일시</th>
                  <th className="py-2.5 pl-4 text-left font-medium text-slate-600">메모</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">처리</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((item, idx) => {
                  const month = idx + 1;
                  const isClosed = item?.close_status === "closed";
                  const isFuture =
                    appliedYear > new Date().getFullYear() ||
                    (appliedYear === new Date().getFullYear() && month > new Date().getMonth() + 1);

                  return (
                    <tr
                      key={month}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                        isClosed ? "bg-green-50/40" : ""
                      }`}
                    >
                      <td className="py-3 pl-4 font-medium text-slate-700">
                        {appliedYear}년 {MONTH_NAMES[idx]}
                      </td>
                      <td className="py-3 text-center">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            <Lock className="h-3 w-3" />
                            마감완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                            <LockOpen className="h-3 w-3" />
                            미마감
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                        {item ? item.employee_count.toLocaleString() : "-"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                        {item ? item.present_days.toLocaleString() : "-"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-red-600">
                        {item ? (item.absent_days > 0 ? item.absent_days.toLocaleString() : "-") : "-"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-amber-600">
                        {item ? (item.late_days > 0 ? item.late_days.toLocaleString() : "-") : "-"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-blue-600">
                        {item ? (item.leave_days > 0 ? item.leave_days.toLocaleString() : "-") : "-"}
                      </td>
                      <td className="py-3 pl-4 text-xs text-slate-500">
                        {isClosed && item ? (
                          <>
                            <span className="font-medium text-slate-700">
                              {item.closed_by_name ?? `ID:${String(item.closed_by)}`}
                            </span>
                            {item.closed_at && (
                              <span className="ml-1 text-slate-400">
                                {new Date(item.closed_at).toLocaleDateString("ko-KR")}
                              </span>
                            )}
                          </>
                        ) : "-"}
                      </td>
                      <td className="max-w-[160px] truncate py-3 pl-4 text-xs text-slate-500">
                        {item?.note ?? "-"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {isClosed ? (
                          can("save") ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              disabled={acting || menuActionLoading}
                              onClick={() => requestReopen(month)}
                            >
                              <LockOpen className="mr-1 h-3 w-3" />
                              재오픈
                            </Button>
                          ) : null
                        ) : can("save") ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 bg-green-600 text-xs text-white hover:bg-green-700"
                            disabled={acting || menuActionLoading || isFuture}
                            title={isFuture ? "미래 월은 마감할 수 없습니다" : undefined}
                            onClick={() => requestClose(month)}
                          >
                            <CalendarOff className="mr-1 h-3 w-3" />
                            마감
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ManagerGridSection>

      {/* 마감 확인 */}
      <ConfirmDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        title={`${appliedYear}년 ${targetMonth ?? ""}월 근태를 마감하시겠습니까?`}
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              마감 후에는 해당 월 근태 수정이 제한됩니다. 마감 해제(재오픈)는 가능합니다.
            </p>
            <div>
              <label className="mb-1 block text-xs text-slate-500">메모 (선택)</label>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="마감 사유 또는 메모"
                className="h-8 text-sm"
              />
            </div>
          </div>
        }
        confirmLabel="마감"
        cancelLabel="취소"
        confirmVariant="default"
        busy={acting}
        onConfirm={() => void confirmClose()}
      />

      {/* 재오픈 확인 */}
      <ConfirmDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        title={`${appliedYear}년 ${targetMonth ?? ""}월 마감을 해제하시겠습니까?`}
        description={
          <p className="text-sm text-slate-600">
            마감 해제 후 해당 월 근태 데이터를 수정할 수 있습니다.
          </p>
        }
        confirmLabel="재오픈"
        cancelLabel="취소"
        confirmVariant="destructive"
        busy={acting}
        onConfirm={() => void confirmReopen()}
      />
    </ManagerPageShell>
  );
}
