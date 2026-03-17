"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Plus, RefreshCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import useSWR from "swr";

import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  TraApplicationActionResponse,
  TraApplicationCreateRequest,
  TraApplicationItem,
  TraApplicationListResponse,
} from "@/types/tra";
import type { TraResourceListResponse } from "@/types/tra";

const STATUS_LABELS: Record<string, string> = {
  draft: "작성중",
  submitted: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  canceled: "취소",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "text-amber-600 font-medium",
  approved: "text-emerald-600 font-medium",
  rejected: "text-red-600 font-medium",
  canceled: "text-slate-400",
};

export function TraMyApplicationsManager() {
  useMenuActions("/tra/my-applications");

  const [page, setPage] = useState(1);
  const [working, setWorking] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TraApplicationItem | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createCourseId, setCreateCourseId] = useState("");
  const [createNote, setCreateNote] = useState("");

  // Withdraw confirm dialog
  const [withdrawTarget, setWithdrawTarget] = useState<TraApplicationItem | null>(null);

  const pageSize = 50;

  const { data, isLoading, mutate } = useSWR<TraApplicationListResponse>(
    "/api/tra/my-applications",
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: coursesData } = useSWR<TraResourceListResponse>(
    "/api/tra/courses",
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.total_count ?? 0;
  const courses = useMemo(
    () => (coursesData?.items ?? []) as Array<{ id: number; course_code: string; course_name: string }>,
    [coursesData?.items],
  );

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page]);

  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  const canWithdraw =
    selectedRow?.status === "submitted" || selectedRow?.status === "draft";

  const columnDefs = useMemo<ColDef<TraApplicationItem>[]>(
    () => [
      { headerName: "신청번호", field: "application_no", width: 180 },
      { headerName: "과정명", field: "course_name", flex: 1, minWidth: 180 },
      { headerName: "차수", field: "event_name", width: 150 },
      {
        headerName: "상태",
        field: "status",
        width: 110,
        cellRenderer: (params: { value: string }) => {
          const label = STATUS_LABELS[params.value] ?? params.value;
          const cls = STATUS_COLORS[params.value] ?? "";
          return `<span class="${cls}">${label}</span>`;
        },
      },
      {
        headerName: "신청일",
        field: "created_at",
        width: 120,
        valueFormatter: (p) => String(p.value ?? "").slice(0, 10),
      },
      { headerName: "비고", field: "note", flex: 1, minWidth: 150 },
    ],
    [],
  );

  const handleCreate = useCallback(async () => {
    const courseId = parseInt(createCourseId, 10);
    if (isNaN(courseId) || courseId <= 0) {
      toast.error("과정을 선택해주세요.");
      return;
    }
    setWorking(true);
    try {
      const payload: TraApplicationCreateRequest = {
        course_id: courseId,
        note: createNote.trim() || null,
      };
      const res = await fetch("/api/tra/my-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "신청에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as TraApplicationActionResponse;
      toast.success(`${json.item.application_no} 신청 접수 완료.`);
      setCreateOpen(false);
      setCreateCourseId("");
      setCreateNote("");
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "신청에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [createCourseId, createNote, mutate]);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawTarget) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/tra/applications/${withdrawTarget.id}/withdraw`, {
        method: "PUT",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "회수에 실패했습니다.");
        return;
      }
      toast.success(`${withdrawTarget.application_no} 회수 완료.`);
      setWithdrawTarget(null);
      setSelectedRow(null);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "회수에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [withdrawTarget, mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">교육신청 내역을 불러오는 중입니다.</p>
      </div>
    );
  }

  return (
    <>
      <ManagerPageShell>
        <ManagerSearchSection title="내 교육신청" onQuery={() => void mutate()}>
          <p className="text-sm text-slate-500">교육신청 내역을 조회하고 신규 신청할 수 있습니다.</p>
        </ManagerSearchSection>

        <ManagerGridSection
          headerLeft={
            <>
              <GridPaginationControls
                page={page}
                totalPages={pagination.totalPages}
                pageInput={pagination.pageInput}
                setPageInput={pagination.setPageInput}
                goPrev={pagination.goPrev}
                goNext={pagination.goNext}
                goToPage={pagination.goToPage}
              />
              <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
            </>
          }
          headerRight={
            <GridToolbarActions
              actions={[
                { key: "query", label: "조회", icon: Search, onClick: () => void mutate(), disabled: working },
                {
                  key: "create",
                  label: "신청",
                  icon: Plus,
                  onClick: () => setCreateOpen(true),
                  disabled: working,
                },
                {
                  key: "withdraw",
                  label: "회수",
                  icon: XCircle,
                  onClick: () => selectedRow && setWithdrawTarget(selectedRow),
                  disabled: working || !canWithdraw,
                },
              ]}
              saveAction={{
                key: "refresh",
                label: "새로고침",
                icon: RefreshCcw,
                onClick: () => void mutate(),
                disabled: working,
              }}
            />
          }
          contentClassName="min-h-0 flex-1 px-6 pb-6"
        >
          <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<TraApplicationItem>
              theme="legacy"
              rowData={pagedItems}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(event) => setSelectedRow(event.data ?? null)}
              localeText={{ noRowsToShow: "교육신청 내역이 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">교육신청 내역이 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </ManagerGridSection>
      </ManagerPageShell>

      {/* 신청 다이얼로그 */}
      <ConfirmDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="교육신청"
        confirmLabel="신청"
        cancelLabel="취소"
        confirmVariant="save"
        busy={working}
        onConfirm={handleCreate}
        description={
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">과정 *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createCourseId}
                onChange={(e) => setCreateCourseId(e.target.value)}
              >
                <option value="">과정 선택</option>
                {courses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.course_name} ({c.course_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">비고 (선택)</label>
              <Input
                type="text"
                placeholder="신청 사유 또는 메모를 입력하세요"
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        }
      />

      {/* 회수 확인 다이얼로그 */}
      <ConfirmDialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title="교육신청 회수"
        description={`${withdrawTarget?.application_no ?? ""} 신청을 회수하시겠습니까?`}
        confirmLabel="회수"
        cancelLabel="취소"
        confirmVariant="destructive"
        busy={working}
        onConfirm={handleWithdraw}
      />
    </>
  );
}
