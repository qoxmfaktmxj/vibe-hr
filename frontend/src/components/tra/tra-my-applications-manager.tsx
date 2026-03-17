"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { TraApplicationItem, TraApplicationListResponse } from "@/types/tra";
import type { TraResourceListResponse } from "@/types/tra";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  submitted: "접수",
  approved: "승인",
  rejected: "반려",
  canceled: "취소",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-500",
  submitted: "text-blue-600 font-medium",
  approved: "text-green-600 font-medium",
  rejected: "text-red-500",
  canceled: "text-slate-400",
};

type CourseRow = { id: number; course_name: string; in_out_type?: string };

export function TraMyApplicationsManager() {
  useMenuActions("/tra/my-applications");

  const gridRef = useRef<AgGridReact<TraApplicationItem>>(null);
  const [gridApi, setGridApi] = useState<GridApi<TraApplicationItem> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number | string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const rowData = data?.items ?? [];
  const courses = (coursesData?.items ?? []) as CourseRow[];

  const selectedRows = useMemo(() => {
    return gridApi?.getSelectedRows() ?? [];
  }, [gridApi]);

  const canWithdraw = useMemo(() => {
    const rows = gridApi?.getSelectedRows() ?? [];
    return rows.length === 1 && ["submitted", "draft"].includes(rows[0]?.status ?? "");
  }, [gridApi]);

  const columnDefs = useMemo<ColDef<TraApplicationItem>[]>(
    () => [
      { headerName: "신청번호", field: "application_no", width: 140 },
      { headerName: "과정명", field: "course_name", flex: 1, minWidth: 180 },
      { headerName: "차수/이벤트", field: "event_name", width: 140 },
      {
        headerName: "상태",
        field: "status",
        width: 90,
        valueFormatter: (p) => STATUS_LABELS[String(p.value ?? "")] ?? String(p.value ?? ""),
        cellClass: (p) => STATUS_COLORS[p.data?.status ?? ""] ?? "",
      },
      {
        headerName: "신청일",
        field: "created_at",
        width: 160,
        valueFormatter: (p) => (p.value ? new Date(String(p.value)).toLocaleDateString("ko-KR") : ""),
      },
      { headerName: "비고", field: "note", flex: 1, minWidth: 120 },
    ],
    [],
  );

  const onGridReady = useCallback((e: GridReadyEvent<TraApplicationItem>) => {
    setGridApi(e.api);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedCourseId) {
      toast.error("과정을 선택해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tra/my-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: Number(selectedCourseId), note: note || null }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "신청에 실패했습니다.");
        return;
      }
      toast.success("교육 신청이 완료되었습니다.");
      setCreateOpen(false);
      setSelectedCourseId("");
      setNote("");
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "신청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedCourseId, note, mutate]);

  const handleWithdraw = useCallback(async () => {
    const rows = gridApi?.getSelectedRows() ?? [];
    if (rows.length !== 1) return;
    const appId = rows[0]?.id;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tra/applications/${appId}/withdraw`, { method: "PUT" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "회수에 실패했습니다.");
        return;
      }
      toast.success("신청이 회수되었습니다.");
      setWithdrawOpen(false);
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "회수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [gridApi, mutate]);

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="나의 교육 신청" onQuery={() => void mutate()}>
        <p className="text-sm text-slate-500">신청한 교육 목록을 확인하고 새로 신청할 수 있습니다.</p>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={
          <span className="text-xs text-slate-400">총 {rowData.length.toLocaleString()}건</span>
        }
        headerRight={
          <GridToolbarActions
            actions={[
              {
                key: "query",
                label: "조회",
                icon: Search,
                onClick: () => void mutate(),
                disabled: submitting,
              },
              {
                key: "apply",
                label: "신청",
                icon: Plus,
                onClick: () => setCreateOpen(true),
                disabled: submitting,
              },
              {
                key: "withdraw",
                label: "회수",
                icon: RotateCcw,
                onClick: () => setWithdrawOpen(true),
                disabled: submitting || !canWithdraw,
              },
            ]}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-6"
      >
        <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">불러오는 중...</p>
            </div>
          ) : (
            <AgGridReact<TraApplicationItem>
              ref={gridRef}
              theme="legacy"
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "singleRow", checkboxes: true }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onSelectionChanged={() => setGridApi((prev) => prev)}
              localeText={{ noRowsToShow: "신청 내역이 없습니다." }}
              headerHeight={36}
              rowHeight={34}
            />
          )}
        </div>
      </ManagerGridSection>

      {/* 신청 다이얼로그 */}
      <ConfirmDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="교육 신청"
        description="신청할 과정을 선택하고 비고를 입력하세요."
        confirmLabel="신청"
        cancelLabel="취소"
        onConfirm={() => void handleCreate()}
      >
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="course-select">과정 선택 *</Label>
            <select
              id="course-select"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              <option value="">과정을 선택하세요</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="note-input">비고</Label>
            <Input
              id="note-input"
              className="mt-1"
              placeholder="비고 입력 (선택)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* 회수 다이얼로그 */}
      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="신청 회수"
        description="선택한 교육 신청을 회수하시겠습니까? 회수 후에는 취소 상태로 변경됩니다."
        confirmLabel="회수"
        cancelLabel="취소"
        confirmVariant="destructive"
        onConfirm={() => void handleWithdraw()}
      />
    </ManagerPageShell>
  );
}
