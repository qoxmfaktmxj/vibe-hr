"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import {
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ManagerGridSection,
  ManagerPageShell,
  ManagerSearchSection,
} from "@/components/grid/manager-layout";
import { fetcher } from "@/lib/fetcher";
import type {
  HriFormTypeItem,
  HriFormTypeListResponse,
  HriRequestDetailFull,
  HriRequestDetailFullResponse,
  HriRequestDetailResponse,
  HriRequestItem,
  HriRequestListResponse,
  HriRequestStepSnapshotItem,
} from "@/types/hri";

/* ------------------------------------------------------------------ */
/* AG Grid 모듈 등록                                                    */
/* ------------------------------------------------------------------ */
let _modulesRegistered = false;
if (!_modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  _modulesRegistered = true;
}

/* ------------------------------------------------------------------ */
/* 상수 & 헬퍼                                                          */
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
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  APPROVAL_IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVAL_REJECTED: "bg-red-50 text-red-700 border-red-200",
  RECEIVE_IN_PROGRESS: "bg-yellow-50 text-yellow-700 border-yellow-200",
  RECEIVE_REJECTED: "bg-orange-50 text-orange-700 border-orange-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WITHDRAWN: "bg-gray-100 text-gray-400 border-gray-200",
};

/** 수정/재제출 가능한 상태 */
const EDITABLE_STATUSES = new Set(["DRAFT", "APPROVAL_REJECTED", "RECEIVE_REJECTED"]);
/** 회수 가능한 상태 */
const WITHDRAW_STATUSES = new Set(["DRAFT", "APPROVAL_IN_PROGRESS", "APPROVAL_REJECTED"]);

const AG_LOCALE_KO: Record<string, string> = {
  noRowsToShow: "신청 내역이 없습니다.",
  loadingOoo: "로딩 중...",
  searchOoo: "검색...",
  filterOoo: "필터...",
  equals: "같음",
  notEqual: "같지 않음",
  contains: "포함",
  notContains: "미포함",
  startsWith: "시작",
  endsWith: "끝",
  andCondition: "그리고",
  orCondition: "또는",
  clearFilter: "초기화",
  cancelFilter: "취소",
  applyFilter: "적용",
  resetFilter: "리셋",
  page: "페이지",
  to: "~",
  of: "/",
  next: "다음",
  last: "마지막",
  first: "처음",
  previous: "이전",
  blanks: "(빈값)",
  selectAll: "전체 선택",
  noMatches: "일치 항목 없음",
};

/* ------------------------------------------------------------------ */
/* 결재선 타임라인 컴포넌트                                              */
/* ------------------------------------------------------------------ */
const STEP_TYPE_LABEL: Record<string, string> = {
  APPROVAL: "결재",
  RECEIVE: "수신",
  REFERENCE: "참조",
};

const ACTION_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  WAITING: {
    label: "대기",
    icon: <Clock className="h-4 w-4" />,
    color: "text-slate-400",
  },
  APPROVED: {
    label: "승인",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-600",
  },
  REJECTED: {
    label: "반려",
    icon: <XCircle className="h-4 w-4" />,
    color: "text-red-500",
  },
  RECEIVED: {
    label: "수신완료",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-blue-600",
  },
};

function ApprovalTimeline({ steps }: { steps: HriRequestStepSnapshotItem[] }) {
  if (steps.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">결재선 정보가 없습니다.</p>
    );
  }
  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => {
        const cfg = ACTION_STATUS_CONFIG[step.action_status] ?? ACTION_STATUS_CONFIG.WAITING;
        return (
          <li key={step.id} className="flex gap-3">
            {/* 순서 선 */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-background ${cfg.color} border-current`}
              >
                {cfg.icon}
              </div>
              {idx < steps.length - 1 && (
                <div className="mt-1 h-full w-px bg-border" />
              )}
            </div>
            {/* 내용 */}
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {STEP_TYPE_LABEL[step.step_type] ?? step.step_type}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cfg.color} border-current`}
                >
                  {cfg.label}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium">{step.actor_name}</p>
              {step.acted_at && (
                <p className="text-xs text-muted-foreground">
                  {step.acted_at.slice(0, 16).replace("T", " ")}
                </p>
              )}
              {step.comment && (
                <p className="mt-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {step.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* 유형별 상세 필드 렌더러                                               */
/* ------------------------------------------------------------------ */
function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? "-"}</dd>
    </div>
  );
}

const CORRECTION_STATUS_LABEL: Record<string, string> = {
  present: "출근",
  late: "지각",
  absent: "결근",
  early_leave: "조퇴",
};

function FormDetailView({
  formCode,
  data,
}: {
  formCode: string | null;
  data: Record<string, unknown>;
}) {
  if (formCode === "TIM_CORRECTION") {
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <DetailField label="정정 날짜" value={String(data.work_date ?? "-")} />
        <DetailField
          label="정정 전"
          value={CORRECTION_STATUS_LABEL[String(data.before_status ?? "")] ?? String(data.before_status ?? "-")}
        />
        <DetailField
          label="정정 후"
          value={CORRECTION_STATUS_LABEL[String(data.after_status ?? "")] ?? String(data.after_status ?? "-")}
        />
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  if (formCode === "CERT_EMPLOYMENT") {
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <div className="col-span-2">
          <DetailField label="사용 목적" value={String(data.purpose ?? "-")} />
        </div>
        <DetailField label="발급 부수" value={`${String(data.copies ?? 1)}부`} />
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="제출처" value={String(data.recipient ?? "-")} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  if (formCode === "LEAVE_REQUEST") {
    const mins = Number(data.applied_minutes ?? 0);
    const minsLabel = mins >= 480 ? `${mins / 480}일 (${mins}분)` : `${mins}분`;
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <DetailField label="휴가 유형" value={String(data.leave_type_code ?? "-")} />
        <DetailField label="차감" value={minsLabel} />
        <DetailField label="시작일" value={String(data.start_date ?? "-")} />
        <DetailField label="종료일" value={String(data.end_date ?? "-")} />
        {data.start_time && <DetailField label="시작 시간" value={String(data.start_time)} />}
        {data.end_time && <DetailField label="종료 시간" value={String(data.end_time)} />}
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  // 기타 유형 — key-value 표
  const entries = Object.entries(data).filter(([k]) => k !== "reason");
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {entries.map(([k, v]) => (
        <DetailField key={k} label={k} value={String(v ?? "-")} />
      ))}
      {data.reason != null && (
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason)} />
        </div>
      )}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* 유형별 편집 폼                                                       */
/* ------------------------------------------------------------------ */
type FormValues = Record<string, string>;

const EMPTY_FORM: FormValues = {
  work_date: "",
  before_status: "present",
  after_status: "present",
  purpose: "",
  copies: "1",
  recipient: "",
  leave_type_code: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  applied_minutes: "480",
  reason: "",
  detail: "",
};

function formValuesFromDetail(
  formCode: string | null,
  data: Record<string, unknown>,
): FormValues {
  const base = { ...EMPTY_FORM };
  for (const [k, v] of Object.entries(data)) {
    if (k in base) base[k] = String(v ?? "");
  }
  return base;
}

function buildContentJson(formCode: string | null, vals: FormValues): Record<string, unknown> {
  if (formCode === "TIM_CORRECTION") {
    return {
      work_date: vals.work_date,
      before_status: vals.before_status,
      after_status: vals.after_status,
      reason: vals.reason,
    };
  }
  if (formCode === "CERT_EMPLOYMENT") {
    return {
      purpose: vals.purpose,
      copies: Number(vals.copies || "1"),
      recipient: vals.recipient,
      reason: vals.reason,
    };
  }
  if (formCode === "LEAVE_REQUEST") {
    return {
      leave_type_code: vals.leave_type_code,
      start_date: vals.start_date,
      end_date: vals.end_date,
      start_time: vals.start_time || null,
      end_time: vals.end_time || null,
      applied_minutes: Number(vals.applied_minutes || "480"),
      reason: vals.reason,
    };
  }
  return { detail: vals.detail, reason: vals.reason };
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="h-9 w-full rounded-md border bg-card px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="present">출근</option>
      <option value="late">지각</option>
      <option value="absent">결근</option>
      <option value="early_leave">조퇴</option>
    </select>
  );
}

function FormEditView({
  formCode,
  vals,
  onChange,
}: {
  formCode: string | null;
  vals: FormValues;
  onChange: (key: string, value: string) => void;
}) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange(key, e.target.value);

  if (formCode === "TIM_CORRECTION") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">정정 날짜</label>
          <Input type="date" value={vals.work_date} onChange={set("work_date")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">정정 전</label>
          <StatusSelect value={vals.before_status} onChange={(v) => onChange("before_status", v)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">정정 후</label>
          <StatusSelect value={vals.after_status} onChange={(v) => onChange("after_status", v)} />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs text-muted-foreground">사유</label>
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={vals.reason}
            onChange={set("reason")}
          />
        </div>
      </div>
    );
  }

  if (formCode === "CERT_EMPLOYMENT") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">사용 목적 *</label>
          <Input placeholder="예: 금융기관 제출" value={vals.purpose} onChange={set("purpose")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">발급 부수</label>
          <Input type="number" min="1" value={vals.copies} onChange={set("copies")} />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs text-muted-foreground">제출처</label>
          <Input placeholder="예: 국민은행" value={vals.recipient} onChange={set("recipient")} />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs text-muted-foreground">사유</label>
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={vals.reason}
            onChange={set("reason")}
          />
        </div>
      </div>
    );
  }

  if (formCode === "LEAVE_REQUEST") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">휴가 유형 코드</label>
          <Input placeholder="예: ANNUAL" value={vals.leave_type_code} onChange={set("leave_type_code")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">차감 분(分)</label>
          <Input type="number" min="0" step="30" value={vals.applied_minutes} onChange={set("applied_minutes")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">시작일 *</label>
          <Input type="date" value={vals.start_date} onChange={set("start_date")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">종료일 *</label>
          <Input type="date" value={vals.end_date} onChange={set("end_date")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">시작 시간</label>
          <Input type="time" value={vals.start_time} onChange={set("start_time")} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">종료 시간</label>
          <Input type="time" value={vals.end_time} onChange={set("end_time")} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">사유</label>
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={vals.reason}
            onChange={set("reason")}
          />
        </div>
      </div>
    );
  }

  // 기타
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">상세 내용</label>
        <Input value={vals.detail} onChange={set("detail")} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">사유</label>
        <textarea
          className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={vals.reason}
          onChange={set("reason")}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 상태 배지                                                            */
/* ------------------------------------------------------------------ */
function StatusBadge({ code }: { code: string }) {
  const label = STATUS_LABEL[code] ?? code;
  const cls = STATUS_CLASS[code] ?? "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 상세 Dialog                                                          */
/* ------------------------------------------------------------------ */
function RequestDetailDialog({
  requestId,
  open,
  onClose,
  onRefresh,
}: {
  requestId: number | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { data, isLoading, mutate: mutateDetail } = useSWR<HriRequestDetailFullResponse>(
    requestId ? `/api/hri/requests/${requestId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const request = data?.request ?? null;
  const isEditable = request ? EDITABLE_STATUSES.has(request.status_code) : false;
  const canWithdraw = request ? WITHDRAW_STATUSES.has(request.status_code) : false;

  const [editTitle, setEditTitle] = useState("");
  const [editVals, setEditVals] = useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 데이터 로드 시 편집 상태 초기화
  useSWR(
    request ? `init-edit-${request.id}-${request.updated_at}` : null,
    () => {
      if (request) {
        setEditTitle(request.title);
        setEditVals(formValuesFromDetail(request.form_code ?? null, request.detail_data));
      }
      return null;
    },
    { revalidateOnFocus: false },
  );

  // request가 바뀔 때 편집 상태 초기화
  const prevIdRef = useRef<number | null>(null);
  if (request && request.id !== prevIdRef.current) {
    prevIdRef.current = request.id;
    setEditTitle(request.title);
    setEditVals(formValuesFromDetail(request.form_code ?? null, request.detail_data));
  }

  function setVal(key: string, value: string) {
    setEditVals((p) => ({ ...p, [key]: value }));
  }

  async function handleSaveAndSubmit() {
    if (!request) return;
    setSaving(true);
    try {
      // 임시저장
      const draftRes = await fetch("/api/hri/requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          form_type_id: request.form_type_id,
          title: editTitle.trim(),
          content_json: buildContentJson(request.form_code ?? null, editVals),
        }),
      });
      const draftJson = (await draftRes.json().catch(() => null)) as HriRequestDetailResponse | { detail?: string } | null;
      if (!draftRes.ok || !draftJson || !("request" in draftJson)) {
        throw new Error((draftJson as { detail?: string } | null)?.detail ?? "저장 실패");
      }

      // 제출
      const submitRes = await fetch(`/api/hri/requests/${request.id}/submit`, { method: "POST" });
      const submitJson = (await submitRes.json().catch(() => null)) as { detail?: string } | null;
      if (!submitRes.ok) throw new Error(submitJson?.detail ?? "재제출 실패");

      toast.success("재제출이 완료되었습니다.");
      await mutateDetail();
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!request) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hri/requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: request.id,
          form_type_id: request.form_type_id,
          title: editTitle.trim(),
          content_json: buildContentJson(request.form_code ?? null, editVals),
        }),
      });
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      if (!res.ok) throw new Error(json?.detail ?? "저장 실패");
      toast.success("임시저장 완료.");
      await mutateDetail();
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleWithdraw() {
    if (!request || !confirm("신청서를 회수하시겠습니까?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hri/requests/${request.id}/withdraw`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      if (!res.ok) throw new Error(json?.detail ?? "회수 실패");
      toast.success("신청서가 회수되었습니다.");
      await mutateDetail();
      onRefresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "회수 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0"
        showClose
      >
        {/* 헤더 */}
        <DialogHeader className="shrink-0 border-b pb-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <p className="mb-1 font-mono text-xs text-muted-foreground">
                {request?.request_no ?? ""}
              </p>
              <DialogTitle className="text-base">
                {request?.form_name ?? "신청서 상세"}
              </DialogTitle>
            </div>
            {request && (
              <StatusBadge code={request.status_code} />
            )}
          </div>
        </DialogHeader>

        {/* 본문 */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {isLoading || !request ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {isLoading ? "로딩 중..." : "데이터를 불러올 수 없습니다."}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-0 overflow-hidden md:flex-row">
              {/* 좌측 — 신청 내용 */}
              <div className="flex-1 overflow-y-auto border-r px-5 py-4 md:min-w-0">
                {/* 제목 */}
                <div className="mb-4">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">제목</p>
                  {isEditable ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-9 text-sm font-medium"
                    />
                  ) : (
                    <p className="text-sm font-medium">{request.title}</p>
                  )}
                </div>

                {/* 메타 정보 */}
                <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 px-3 py-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">현재 결재자</span>
                    <p className="font-medium">{request.current_actor_name ?? "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">제출일</span>
                    <p className="font-medium">
                      {request.submitted_at ? request.submitted_at.slice(0, 10) : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">작성일</span>
                    <p className="font-medium">{request.created_at.slice(0, 10)}</p>
                  </div>
                  {request.completed_at && (
                    <div>
                      <span className="text-muted-foreground">완료일</span>
                      <p className="font-medium">{request.completed_at.slice(0, 10)}</p>
                    </div>
                  )}
                </div>

                {/* 유형별 상세 */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">신청 내용</p>
                  {isEditable ? (
                    <FormEditView
                      formCode={request.form_code ?? null}
                      vals={editVals}
                      onChange={setVal}
                    />
                  ) : (
                    <FormDetailView
                      formCode={request.form_code ?? null}
                      data={request.detail_data}
                    />
                  )}
                </div>
              </div>

              {/* 우측 — 결재선 타임라인 */}
              <div className="w-full shrink-0 overflow-y-auto px-4 py-4 md:w-60">
                <p className="mb-3 text-xs font-medium text-muted-foreground">결재 진행</p>
                <ApprovalTimeline steps={request.steps} />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        {request && (
          <DialogFooter className="shrink-0">
            {canWithdraw && (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void handleWithdraw()}
                className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                회수
              </Button>
            )}
            {isEditable && (
              <>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => void handleSaveDraft()}>
                  임시저장
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void handleSaveAndSubmit()}>
                  {saving ? "처리 중..." : "저장 후 재제출"}
                </Button>
              </>
            )}
            {!isEditable && !canWithdraw && (
              <Button variant="outline" size="sm" onClick={onClose}>
                닫기
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 신규 작성 Dialog                                                     */
/* ------------------------------------------------------------------ */
function NewRequestDialog({
  open,
  onClose,
  formTypes,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  formTypes: HriFormTypeItem[];
  onCreated: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [vals, setVals] = useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const selectedForm = formTypes.find((f) => f.id === selectedId) ?? null;

  function setVal(key: string, value: string) {
    setVals((p) => ({ ...p, [key]: value }));
  }

  function reset() {
    setSelectedId(null);
    setTitle("");
    setVals(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!selectedForm || !title.trim()) {
      toast.error("신청서 유형과 제목을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      // 임시저장
      const draftRes = await fetch("/api/hri/requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: null,
          form_type_id: selectedForm.id,
          title: title.trim(),
          content_json: buildContentJson(selectedForm.form_code, vals),
        }),
      });
      const draftJson = (await draftRes.json().catch(() => null)) as HriRequestDetailResponse | { detail?: string } | null;
      if (!draftRes.ok || !draftJson || !("request" in draftJson)) {
        throw new Error((draftJson as { detail?: string } | null)?.detail ?? "임시저장 실패");
      }

      // 제출
      const submitRes = await fetch(`/api/hri/requests/${draftJson.request.id}/submit`, {
        method: "POST",
      });
      const submitJson = (await submitRes.json().catch(() => null)) as { detail?: string } | null;
      if (!submitRes.ok) throw new Error(submitJson?.detail ?? "결재신청 실패");

      toast.success("결재신청이 완료되었습니다.");
      reset();
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) { reset(); onClose(); }
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b pb-4">
          <div className="flex items-center gap-2 pr-8">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <DialogTitle>신청서 작성</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 신청서 유형 선택 */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">신청서 유형</p>
            <div className="flex flex-wrap gap-2">
              {formTypes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedId === item.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted"
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
              placeholder="신청서 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 유형별 폼 */}
          {selectedForm && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">신청 내용</p>
              <div className="rounded-lg border bg-muted/20 p-3">
                <FormEditView
                  formCode={selectedForm.form_code}
                  vals={vals}
                  onChange={setVal}
                />
              </div>
            </div>
          )}

          {/* 결재선 안내 */}
          <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              제출 시 신청서 유형에 설정된 결재선이 자동 적용됩니다.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => { reset(); onClose(); }}>
            취소
          </Button>
          <Button size="sm" disabled={saving || !selectedForm} onClick={() => void handleSubmit()}>
            {saving ? "처리 중..." : "결재신청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 메인 컴포넌트                                                        */
/* ------------------------------------------------------------------ */
export function HriApplicationHub() {
  const [searchTitle, setSearchTitle] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [appliedTitle, setAppliedTitle] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");

  const [detailId, setDetailId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const gridApiRef = useRef<GridApi<HriRequestItem> | null>(null);

  const { data: formTypeData } = useSWR<HriFormTypeListResponse>("/api/hri/form-types", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: myData, isLoading } = useSWR<HriRequestListResponse>(
    "/api/hri/requests/my",
    fetcher,
    { revalidateOnFocus: false },
  );

  const formTypes = useMemo(
    () => (formTypeData?.items ?? []).filter((f) => f.is_active),
    [formTypeData?.items],
  );

  const filteredRows = useMemo(() => {
    return (myData?.items ?? []).filter((item) => {
      if (
        appliedTitle &&
        !item.title.includes(appliedTitle) &&
        !item.request_no.includes(appliedTitle)
      )
        return false;
      if (appliedStatus && item.status_code !== appliedStatus) return false;
      return true;
    });
  }, [myData?.items, appliedTitle, appliedStatus]);

  function handleQuery() {
    setAppliedTitle(searchTitle);
    setAppliedStatus(searchStatus);
  }

  const refreshList = useCallback(() => void mutate("/api/hri/requests/my"), []);

  const columnDefs = useMemo<ColDef<HriRequestItem>[]>(
    () => [
      {
        headerName: "문서번호",
        field: "request_no",
        width: 150,
        sortable: true,
        filter: true,
        cellClass: "font-mono text-xs",
      },
      {
        headerName: "신청서 유형",
        field: "form_name",
        width: 140,
        sortable: true,
        filter: true,
        valueFormatter: (p) => (p.value as string | null) ?? "-",
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
        width: 120,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams<HriRequestItem>) => {
          const code = (params.value as string) ?? "";
          const label = STATUS_LABEL[code] ?? code;
          const cls = STATUS_CLASS[code] ?? "bg-gray-100 text-gray-500 border-gray-200";
          return (
            <div className="flex h-full items-center">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
                {label}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "현재 결재자",
        field: "current_actor_name",
        width: 110,
        sortable: false,
        filter: false,
        valueFormatter: (p) => (p.value as string | null) ?? "-",
      },
      {
        headerName: "제출일",
        field: "submitted_at",
        width: 100,
        sortable: true,
        filter: false,
        valueFormatter: (p) => ((p.value as string | null) ? (p.value as string).slice(0, 10) : "-"),
      },
      {
        headerName: "완료일",
        field: "completed_at",
        width: 100,
        sortable: true,
        filter: false,
        valueFormatter: (p) => ((p.value as string | null) ? (p.value as string).slice(0, 10) : "-"),
      },
      {
        headerName: "세부내역",
        width: 90,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: ICellRendererParams<HriRequestItem>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <button
                className="rounded px-2 py-1 text-xs text-primary underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailId(row.id);
                }}
              >
                세부내역
              </button>
            </div>
          );
        },
      },
    ],
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultColDef = useMemo<ColDef<HriRequestItem>>(
    () => ({ resizable: true, editable: false }),
    [],
  );

  const onGridReady = useCallback((e: GridReadyEvent<HriRequestItem>) => {
    gridApiRef.current = e.api;
  }, []);

  const totalCount = filteredRows.length;

  return (
    <ManagerPageShell>
      {/* 검색 */}
      <ManagerSearchSection title="신청 허브" onQuery={handleQuery}>
        <div className="flex flex-wrap gap-2">
          <Input
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleQuery(); }}
            placeholder="문서번호 / 제목"
            className="h-9 w-56 text-sm"
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

      {/* 그리드 */}
      <ManagerGridSection
        contentClassName="flex flex-col"
        headerLeft={
          <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
        }
        headerRight={
          <>
            <Button size="sm" variant="outline" onClick={refreshList}>
              <RefreshCw className="h-3.5 w-3.5" />
              새로고침
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              신청서 작성
            </Button>
          </>
        }
      >
        {/* 데스크탑 AG Grid */}
        <div className="hidden min-h-0 flex-1 px-3 pb-4 md:block md:px-6">
          <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<HriRequestItem>
              theme="legacy"
              rowData={filteredRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              suppressRowClickSelection={false}
              animateRows={false}
              getRowId={(p) => String(p.data.id)}
              onGridReady={onGridReady}
              onRowClicked={(e) => { if (e.data) setDetailId(e.data.id); }}
              loading={isLoading}
              localeText={AG_LOCALE_KO}
              overlayNoRowsTemplate={`<span class="text-sm text-slate-400">신청 내역이 없습니다.</span>`}
              headerHeight={36}
              rowHeight={36}
            />
          </div>
        </div>

        {/* 모바일 카드 */}
        <div className="flex-1 overflow-auto px-3 pb-4 pt-2 md:hidden">
          <div className="space-y-2">
            {filteredRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                신청 내역이 없습니다.
              </div>
            ) : (
              filteredRows.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left"
                  onClick={() => setDetailId(item.id)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-400">{item.request_no}</span>
                    <StatusBadge code={item.status_code} />
                  </div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.form_name ?? "-"} · {item.created_at.slice(0, 10)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </ManagerGridSection>

      {/* 상세 Dialog */}
      <RequestDetailDialog
        requestId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        onRefresh={refreshList}
      />

      {/* 신규 작성 Dialog */}
      <NewRequestDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        formTypes={formTypes}
        onCreated={refreshList}
      />
    </ManagerPageShell>
  );
}
