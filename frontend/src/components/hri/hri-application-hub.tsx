"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Plus, RefreshCw, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { fetcher } from "@/lib/fetcher";
import type {
  HriFormTypeItem,
  HriFormTypeListResponse,
  HriRequestDetailResponse,
  HriRequestItem,
  HriRequestListResponse,
} from "@/types/hri";

/* ------------------------------------------------------------------ */
/* AG Grid 모듈 등록 (최초 1회)                                        */
/* ------------------------------------------------------------------ */
let _modulesRegistered = false;
if (!_modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  _modulesRegistered = true;
}

/* ------------------------------------------------------------------ */
/* 상수                                                                */
/* ------------------------------------------------------------------ */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  APPROVAL_IN_PROGRESS: "결재중",
  APPROVAL_REJECTED: "반려",
  RECEIVE_IN_PROGRESS: "수신처리중",
  RECEIVE_REJECTED: "수신반려",
  COMPLETED: "완료",
  WITHDRAWN: "회수",
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVAL_IN_PROGRESS: "bg-blue-100 text-blue-700",
  APPROVAL_REJECTED: "bg-red-100 text-red-700",
  RECEIVE_IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RECEIVE_REJECTED: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  WITHDRAWN: "bg-gray-200 text-gray-500",
};

const WITHDRAW_ALLOWED = new Set(["DRAFT", "APPROVAL_IN_PROGRESS", "APPROVAL_REJECTED"]);

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지",
  to: "~",
  of: "/",
  next: "다음",
  last: "마지막",
  first: "처음",
  previous: "이전",
  loadingOoo: "로딩 중...",
  noRowsToShow: "신청 내역이 없습니다.",
  searchOoo: "검색...",
  blanks: "(빈값)",
  filterOoo: "필터...",
  applyFilter: "적용",
  equals: "같음",
  notEqual: "같지 않음",
  contains: "포함",
  notContains: "미포함",
  startsWith: "시작",
  endsWith: "끝",
  andCondition: "그리고",
  orCondition: "또는",
  clearFilter: "초기화",
  resetFilter: "리셋",
  cancelFilter: "취소",
  selectAll: "전체 선택",
  noMatches: "일치 항목 없음",
};

/* ------------------------------------------------------------------ */
/* 신청서 폼 빌더                                                      */
/* ------------------------------------------------------------------ */
function buildContent(form: HriFormTypeItem | null, values: Record<string, string>) {
  if (!form) return {};
  if (form.form_code === "TIM_CORRECTION") {
    return {
      work_date: values.work_date,
      before_status: values.before_status,
      after_status: values.after_status,
      reason: values.reason,
    };
  }
  if (form.form_code === "CERT_EMPLOYMENT") {
    return {
      purpose: values.purpose,
      copies: Number(values.copies || "1"),
      recipient: values.recipient,
      reason: values.reason,
    };
  }
  if (form.form_code === "LEAVE_REQUEST") {
    return {
      leave_type_code: values.leave_type_code,
      start_date: values.start_date,
      end_date: values.end_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      applied_minutes: Number(values.applied_minutes || "480"),
      reason: values.reason,
    };
  }
  return {
    detail: values.detail,
    reason: values.reason,
  };
}

const EMPTY_FORM_VALUES = {
  // TIM_CORRECTION
  work_date: "",
  before_status: "present",
  after_status: "present",
  // CERT_EMPLOYMENT
  purpose: "",
  copies: "1",
  recipient: "",
  // LEAVE_REQUEST
  leave_type_code: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  applied_minutes: "480",
  // 공통
  reason: "",
  detail: "",
};

/* ------------------------------------------------------------------ */
/* 메인 컴포넌트                                                       */
/* ------------------------------------------------------------------ */
export function HriApplicationHub() {
  /* --- 상태 --- */
  const [searchTitle, setSearchTitle] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [appliedTitle, setAppliedTitle] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedFormTypeId, setSelectedFormTypeId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>(EMPTY_FORM_VALUES);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<HriRequestItem> | null>(null);

  /* --- 데이터 패치 --- */
  const { data: formTypeData } = useSWR<HriFormTypeListResponse>("/api/hri/form-types", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: myData, isLoading } = useSWR<HriRequestListResponse>("/api/hri/requests/my", fetcher, {
    revalidateOnFocus: false,
  });

  const formTypes = useMemo(
    () => (formTypeData?.items ?? []).filter((item) => item.is_active),
    [formTypeData?.items],
  );
  const selectedForm = useMemo(
    () => formTypes.find((item) => item.id === selectedFormTypeId) ?? null,
    [formTypes, selectedFormTypeId],
  );

  /* --- 필터링 --- */
  const filteredRows = useMemo(() => {
    return (myData?.items ?? []).filter((item) => {
      if (appliedTitle && !item.title.includes(appliedTitle) && !item.request_no.includes(appliedTitle)) {
        return false;
      }
      if (appliedStatus && item.status_code !== appliedStatus) {
        return false;
      }
      return true;
    });
  }, [myData?.items, appliedTitle, appliedStatus]);

  /* --- 패널 리셋 --- */
  const resetPanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedFormTypeId(null);
    setFormTitle("");
    setFormValues(EMPTY_FORM_VALUES);
  }, []);

  /* --- 신청서 저장 및 결재신청 --- */
  async function saveAndSubmit() {
    if (!selectedForm || !formTitle.trim()) {
      toast.error("신청서 유형과 제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const draftRes = await fetch("/api/hri/requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: null,
          form_type_id: selectedForm.id,
          title: formTitle.trim(),
          content_json: buildContent(selectedForm, formValues),
        }),
      });
      const draftJson = (await draftRes.json().catch(() => null)) as HriRequestDetailResponse | { detail?: string } | null;
      if (!draftRes.ok || !draftJson || !("request" in draftJson)) {
        throw new Error((draftJson as { detail?: string } | null)?.detail ?? "임시저장 실패");
      }

      const submitRes = await fetch(`/api/hri/requests/${draftJson.request.id}/submit`, { method: "POST" });
      const submitJson = (await submitRes.json().catch(() => null)) as { detail?: string } | null;
      if (!submitRes.ok) {
        throw new Error(submitJson?.detail ?? "결재신청 실패");
      }

      toast.success("결재신청이 완료되었습니다.");
      await mutate("/api/hri/requests/my");
      resetPanel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "요청 처리 실패");
    } finally {
      setSaving(false);
    }
  }

  /* --- 회수 --- */
  async function handleWithdraw(requestId: number) {
    if (!confirm("신청서를 회수하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/hri/requests/${requestId}/withdraw`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      if (!res.ok) throw new Error(json?.detail ?? "회수 실패");
      toast.success("신청서가 회수되었습니다.");
      await mutate("/api/hri/requests/my");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "회수 실패");
    }
  }

  /* --- 조회 --- */
  function handleQuery() {
    setAppliedTitle(searchTitle);
    setAppliedStatus(searchStatus);
  }

  /* --- 컬럼 정의 --- */
  const columnDefs = useMemo<ColDef<HriRequestItem>[]>(() => [
    {
      headerName: "문서번호",
      field: "request_no",
      width: 140,
      sortable: true,
      filter: true,
    },
    {
      headerName: "신청서",
      field: "form_name",
      width: 150,
      sortable: true,
      filter: true,
      valueFormatter: (p) => p.value ?? "-",
    },
    {
      headerName: "제목",
      field: "title",
      flex: 1,
      minWidth: 180,
      sortable: true,
      filter: true,
    },
    {
      headerName: "상태",
      field: "status_code",
      width: 130,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams<HriRequestItem>) => {
        const code = params.value as string ?? "";
        const label = STATUS_LABEL[code] ?? code;
        const cls = STATUS_CLASS[code] ?? "bg-gray-100 text-gray-500";
        return (
          <div className="flex h-full items-center">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
          </div>
        );
      },
    },
    {
      headerName: "현재 결재자",
      field: "current_actor_name",
      width: 120,
      sortable: false,
      filter: false,
      valueFormatter: (p) => p.value ?? "-",
    },
    {
      headerName: "제출일",
      field: "submitted_at",
      width: 110,
      sortable: true,
      filter: false,
      valueFormatter: (p) => (p.value ? String(p.value).slice(0, 10) : "-"),
    },
    {
      headerName: "완료일",
      field: "completed_at",
      width: 110,
      sortable: true,
      filter: false,
      valueFormatter: (p) => (p.value ? String(p.value).slice(0, 10) : "-"),
    },
    {
      headerName: "작성일",
      field: "created_at",
      width: 110,
      sortable: true,
      filter: false,
      valueFormatter: (p) => (p.value ? String(p.value).slice(0, 10) : "-"),
    },
    {
      headerName: "액션",
      width: 90,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (params: ICellRendererParams<HriRequestItem>) => {
        const row = params.data;
        if (!row) return null;
        if (!WITHDRAW_ALLOWED.has(row.status_code)) return null;
        return (
          <div className="flex h-full items-center justify-center">
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                void handleWithdraw(row.id);
              }}
            >
              <Undo2 className="h-3 w-3" />
              회수
            </button>
          </div>
        );
      },
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultColDef = useMemo<ColDef<HriRequestItem>>(
    () => ({ resizable: true, editable: false }),
    [],
  );

  const onGridReady = useCallback((event: GridReadyEvent<HriRequestItem>) => {
    gridApiRef.current = event.api;
  }, []);

  const totalCount = filteredRows.length;

  /* --- 렌더링 --- */
  return (
    <ManagerPageShell>
      {/* 검색 섹션 */}
      <ManagerSearchSection
        title="신청 허브"
        onQuery={handleQuery}
        queryLabel="조회"
      >
        <div className="grid flex-1 gap-2 md:grid-cols-3 xl:grid-cols-4">
          <Input
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleQuery(); }}
            placeholder="문서번호 / 제목 검색"
            className="h-9 text-sm"
          />
          <select
            value={searchStatus}
            onChange={(e) => setSearchStatus(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
            aria-label="상태 필터"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
      </ManagerSearchSection>

      {/* 그리드 섹션 */}
      <ManagerGridSection
        contentClassName="flex flex-col"
        headerLeft={
          <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
        }
        headerRight={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void mutate("/api/hri/requests/my")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              새로고침
            </Button>
            <Button
              size="sm"
              onClick={() => setPanelOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              신청서 작성
            </Button>
          </>
        }
      >
        <div className="hidden min-h-0 flex-1 px-3 pb-4 pt-2 md:block md:px-6 md:pt-0">
          <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<HriRequestItem>
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              suppressRowClickSelection={false}
              animateRows={false}
              getRowId={(p) => String(p.data.id)}
              onGridReady={onGridReady}
              loading={isLoading}
              localeText={AG_GRID_LOCALE_KO}
              overlayNoRowsTemplate={`<span class="text-sm text-slate-400">신청 내역이 없습니다.</span>`}
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </div>

        {/* 모바일 카드 목록 */}
        <div className="flex-1 overflow-auto px-3 pb-4 pt-2 md:hidden">
          <div className="space-y-2">
            {filteredRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                신청 내역이 없습니다.
              </div>
            ) : (
              filteredRows.map((item) => {
                const statusLabel = STATUS_LABEL[item.status_code] ?? item.status_code;
                const statusCls = STATUS_CLASS[item.status_code] ?? "bg-gray-100 text-gray-500";
                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">{item.request_no}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.form_name ?? "-"} · {String(item.created_at).slice(0, 10)}</p>
                    {WITHDRAW_ALLOWED.has(item.status_code) && (
                      <button
                        className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        onClick={() => void handleWithdraw(item.id)}
                      >
                        <Undo2 className="h-3 w-3" />
                        회수
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ManagerGridSection>

      {/* 신청서 작성 슬라이드 패널 */}
      {panelOpen && (
        <div className="fixed inset-0 z-[70] flex">
          {/* 배경 오버레이 */}
          <button
            className="absolute inset-0 bg-black/40"
            onClick={resetPanel}
            aria-label="닫기"
          />
          {/* 우측 슬라이드 패널 */}
          <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-l-xl border-l bg-background shadow-2xl">
            {/* 헤더 */}
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">신청서 작성</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={resetPanel}>닫기</Button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* 신청서 유형 선택 */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">신청서 유형</p>
                <div className="flex flex-wrap gap-2">
                  {formTypes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFormTypeId(item.id)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedFormTypeId === item.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {item.form_name_ko}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">제목 *</p>
                <Input
                  placeholder="신청서 제목을 입력해 주세요"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* TIM_CORRECTION 폼 */}
              {selectedForm?.form_code === "TIM_CORRECTION" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">근태정정 정보</p>
                  <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">정정 날짜</label>
                      <Input
                        type="date"
                        value={formValues.work_date}
                        onChange={(e) => setFormValues((p) => ({ ...p, work_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">정정 전 상태</label>
                      <select
                        className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                        value={formValues.before_status}
                        onChange={(e) => setFormValues((p) => ({ ...p, before_status: e.target.value }))}
                      >
                        <option value="present">출근</option>
                        <option value="late">지각</option>
                        <option value="absent">결근</option>
                        <option value="early_leave">조퇴</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">정정 후 상태</label>
                      <select
                        className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                        value={formValues.after_status}
                        onChange={(e) => setFormValues((p) => ({ ...p, after_status: e.target.value }))}
                      >
                        <option value="present">출근</option>
                        <option value="late">지각</option>
                        <option value="absent">결근</option>
                        <option value="early_leave">조퇴</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* CERT_EMPLOYMENT 폼 */}
              {selectedForm?.form_code === "CERT_EMPLOYMENT" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">재직증명서 발급 정보</p>
                  <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">사용 목적 *</label>
                      <Input
                        placeholder="예: 금융기관 제출"
                        value={formValues.purpose}
                        onChange={(e) => setFormValues((p) => ({ ...p, purpose: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">발급 부수</label>
                      <Input
                        type="number"
                        min="1"
                        value={formValues.copies}
                        onChange={(e) => setFormValues((p) => ({ ...p, copies: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-xs text-muted-foreground">제출처</label>
                      <Input
                        placeholder="예: 국민은행"
                        value={formValues.recipient}
                        onChange={(e) => setFormValues((p) => ({ ...p, recipient: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* LEAVE_REQUEST 폼 */}
              {selectedForm?.form_code === "LEAVE_REQUEST" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">휴가 신청 정보</p>
                  <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">휴가 유형 코드</label>
                      <Input
                        placeholder="예: ANNUAL, HALF_AM, HALF_PM"
                        value={formValues.leave_type_code}
                        onChange={(e) => setFormValues((p) => ({ ...p, leave_type_code: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">차감 분(分)</label>
                      <Input
                        type="number"
                        min="0"
                        step="30"
                        value={formValues.applied_minutes}
                        onChange={(e) => setFormValues((p) => ({ ...p, applied_minutes: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">시작일 *</label>
                      <Input
                        type="date"
                        value={formValues.start_date}
                        onChange={(e) => setFormValues((p) => ({ ...p, start_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">종료일 *</label>
                      <Input
                        type="date"
                        value={formValues.end_date}
                        onChange={(e) => setFormValues((p) => ({ ...p, end_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">시작 시간 (반차 등)</label>
                      <Input
                        type="time"
                        value={formValues.start_time}
                        onChange={(e) => setFormValues((p) => ({ ...p, start_time: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">종료 시간 (반차 등)</label>
                      <Input
                        type="time"
                        value={formValues.end_time}
                        onChange={(e) => setFormValues((p) => ({ ...p, end_time: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 기타 유형 - 상세 내용 */}
              {selectedForm &&
                selectedForm.form_code !== "TIM_CORRECTION" &&
                selectedForm.form_code !== "CERT_EMPLOYMENT" &&
                selectedForm.form_code !== "LEAVE_REQUEST" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">상세 내용</p>
                  <Input
                    placeholder="상세 내용을 입력해 주세요"
                    value={formValues.detail}
                    onChange={(e) => setFormValues((p) => ({ ...p, detail: e.target.value }))}
                  />
                </div>
              )}

              {/* 공통: 신청 사유 */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">신청 사유</p>
                <textarea
                  className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="신청 사유를 입력해 주세요"
                  value={formValues.reason}
                  onChange={(e) => setFormValues((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>

              {/* 결재 안내 */}
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">결재 안내</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  제출 시 신청서 유형에 설정된 결재선이 자동으로 적용됩니다.
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" disabled={saving} onClick={resetPanel}>
                취소
              </Button>
              <Button disabled={saving || !selectedForm} onClick={() => void saveAndSubmit()}>
                {saving ? "처리 중..." : "결재신청"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ManagerPageShell>
  );
}
