"use client";

import {
  Brain,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarX2,
  Fingerprint,
  Heart,
  IdCard,
  Star,
  TimerOff,
  UserRound,
  Users,
  Droplets,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HrBasicDetailResponse, HrInfoRow } from "@/types/hr-employee-profile";

type Props = {
  detail: HrBasicDetailResponse | null;
  employeeId: number | null;
  onReload: () => Promise<void>;
};

type TabKey =
  | "basic"
  | "appointment"
  | "reward"
  | "contact"
  | "education"
  | "career"
  | "certificate"
  | "military"
  | "evaluation";

type BasicProfileDraft = {
  full_name: string;
  gender: string;
  resident_no_masked: string;
  hire_date: string;
  retire_date: string;
  blood_type: string;
  marital_status: string;
  mbti: string;
  probation_end_date: string;
  job_family: string;
  job_role: string;
  grade: string;
};

type BasicProfileKey = keyof BasicProfileDraft;
type Tone = "primary" | "emerald" | "violet" | "rose" | "amber";

type ProfileCardMeta = {
  key?: BasicProfileKey;
  fixedValue?: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  inputType?: "text" | "date";
  mono?: boolean;
};

type TabColumnLabels = {
  tableTitle: string;
  emptyMessage: string;
  recordDate: string;
  type: string;
  title: string;
  organization: string;
  value: string;
  note: string;
};

const APPOINTMENT_PAGE_SIZE = 5;

const TAB_COLUMN_LABELS: Record<Exclude<TabKey, "basic">, TabColumnLabels> = {
  appointment: {
    tableTitle: "발령 이력",
    emptyMessage: "발령 데이터가 없습니다.",
    recordDate: "발령일",
    type: "발령유형",
    title: "발령명",
    organization: "발령부서",
    value: "발령값",
    note: "비고",
  },
  reward: {
    tableTitle: "상벌 이력",
    emptyMessage: "상벌 데이터가 없습니다.",
    recordDate: "조치일",
    type: "상벌구분",
    title: "상벌명",
    organization: "주관부서",
    value: "금액/점수",
    note: "비고",
  },
  contact: {
    tableTitle: "주소/연락처 이력",
    emptyMessage: "주소/연락처 데이터가 없습니다.",
    recordDate: "유효시작일",
    type: "연락처유형",
    title: "주소/연락처",
    organization: "비상연락인",
    value: "전화/이메일",
    note: "비고",
  },
  education: {
    tableTitle: "학력 이력",
    emptyMessage: "학력 데이터가 없습니다.",
    recordDate: "졸업(수료)일",
    type: "학력구분",
    title: "학교명",
    organization: "전공",
    value: "학위/상태",
    note: "비고",
  },
  career: {
    tableTitle: "경력 이력",
    emptyMessage: "경력 데이터가 없습니다.",
    recordDate: "시작일",
    type: "경력구분",
    title: "회사명",
    organization: "부서/직무",
    value: "종료일/재직여부",
    note: "비고",
  },
  certificate: {
    tableTitle: "자격증 이력",
    emptyMessage: "자격증 데이터가 없습니다.",
    recordDate: "취득일",
    type: "자격유형",
    title: "자격명",
    organization: "발급기관",
    value: "자격번호/등급",
    note: "비고",
  },
  military: {
    tableTitle: "병역 이력",
    emptyMessage: "병역 데이터가 없습니다.",
    recordDate: "복무시작일",
    type: "군별/병과",
    title: "계급",
    organization: "복무구분",
    value: "전역일/면제사유",
    note: "비고",
  },
  evaluation: {
    tableTitle: "평가 이력",
    emptyMessage: "평가 데이터가 없습니다.",
    recordDate: "평가일",
    type: "평가구분",
    title: "평가항목",
    organization: "평가기관",
    value: "평가결과",
    note: "비고",
  },
};

function asInputValue(value?: string | null): string {
  return value ?? "";
}

function asNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringifyErrorDetail(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyErrorDetail(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(" / ") : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.msg === "string") {
    const loc = Array.isArray(record.loc) ? record.loc.map((part) => String(part)).join(".") : "";
    return loc ? `${loc}: ${record.msg}` : record.msg;
  }
  return stringifyErrorDetail(record.detail) ?? stringifyErrorDetail(record.message) ?? stringifyErrorDetail(record.error);
}

function buildProfileDraft(detail: HrBasicDetailResponse | null): BasicProfileDraft {
  return {
    full_name: asInputValue(detail?.profile.full_name),
    gender: asInputValue(detail?.profile.gender),
    resident_no_masked: asInputValue(detail?.profile.resident_no_masked),
    hire_date: asInputValue(detail?.profile.hire_date),
    retire_date: asInputValue(detail?.profile.retire_date),
    blood_type: asInputValue(detail?.profile.blood_type),
    marital_status: asInputValue(detail?.profile.marital_status),
    mbti: asInputValue(detail?.profile.mbti),
    probation_end_date: asInputValue(detail?.profile.probation_end_date),
    job_family: asInputValue(detail?.profile.job_family),
    job_role: asInputValue(detail?.profile.job_role),
    grade: asInputValue(detail?.profile.grade),
  };
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

function toCategory(tab: Exclude<TabKey, "basic">): string {
  return {
    appointment: "appointment",
    reward: "reward_punish",
    contact: "contact_points",
    education: "education",
    career: "careers",
    certificate: "licenses",
    military: "military",
    evaluation: "evaluation",
  }[tab];
}

function rowsByTab(detail: HrBasicDetailResponse | null, tab: Exclude<TabKey, "basic">): HrInfoRow[] {
  if (!detail) return [];
  if (tab === "appointment") return detail.appointments;
  if (tab === "reward") return detail.rewards_penalties;
  if (tab === "contact") return detail.contacts;
  if (tab === "education") return detail.educations;
  if (tab === "career") return detail.careers;
  if (tab === "certificate") return detail.certificates;
  if (tab === "military") return detail.military;
  return detail.evaluations;
}

function buildPageNumbers(current: number, total: number): number[] {
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + windowSize - 1);
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function getToneCardClass(tone: Tone): string {
  if (tone === "emerald") {
    return "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20";
  }
  if (tone === "violet") {
    return "border-violet-200/70 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20";
  }
  if (tone === "rose") {
    return "border-rose-200/70 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20";
  }
  if (tone === "amber") {
    return "border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20";
  }
  return "border-primary/30 bg-primary/5 dark:border-primary/40 dark:bg-primary/10";
}

function getToneIconClass(tone: Tone): string {
  if (tone === "emerald") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (tone === "violet") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  }
  if (tone === "rose") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  }
  if (tone === "amber") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-primary/15 text-primary dark:bg-primary/25";
}

export function HrBasicTabs({ detail, employeeId, onReload }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [newTitle, setNewTitle] = useState("");
  const [draftRows, setDraftRows] = useState<Record<number, HrInfoRow>>({});
  const [appointmentPage, setAppointmentPage] = useState(1);

  const [profileDraft, setProfileDraft] = useState<BasicProfileDraft>(() => buildProfileDraft(detail));
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!profileEditMode) {
      setProfileDraft(buildProfileDraft(detail));
    }
  }, [detail, profileEditMode]);

  useEffect(() => {
    if (detail) {
      setLastUpdatedAt(new Date());
    }
  }, [detail]);

  const tabs: Array<[TabKey, string]> = [
    ["basic", "인사기본"],
    ["appointment", "발령"],
    ["reward", "상벌"],
    ["contact", "주소연락처"],
    ["education", "학력"],
    ["career", "경력"],
    ["certificate", "자격증"],
    ["military", "병역"],
    ["evaluation", "평가"],
  ];

  const profileCards = useMemo<ProfileCardMeta[]>(
    () => [
      { key: "full_name", label: "성명", icon: UserRound, tone: "primary" },
      { fixedValue: detail?.profile.employee_no ?? "", label: "사번", icon: IdCard, tone: "primary", mono: true },
      { key: "gender", label: "성별", icon: Users, tone: "primary" },
      { key: "resident_no_masked", label: "주민번호", icon: Fingerprint, tone: "primary", mono: true },
      { key: "hire_date", label: "입사일", icon: CalendarCheck2, tone: "emerald", inputType: "date", mono: true },
      { key: "retire_date", label: "퇴사일", icon: CalendarX2, tone: "emerald", inputType: "date", mono: true },
      { key: "blood_type", label: "혈액형", icon: Droplets, tone: "rose" },
      { key: "marital_status", label: "혼인상태", icon: Heart, tone: "rose" },
      { key: "mbti", label: "MBTI", icon: Brain, tone: "amber", mono: true },
      { key: "probation_end_date", label: "수습종료일", icon: TimerOff, tone: "emerald", inputType: "date", mono: true },
      { key: "job_family", label: "직군", icon: Shapes, tone: "violet" },
      { key: "job_role", label: "직무", icon: BriefcaseBusiness, tone: "violet" },
      { key: "grade", label: "직급", icon: Star, tone: "violet" },
    ],
    [detail?.profile.employee_no],
  );

  const tabRows = activeTab === "basic" ? [] : rowsByTab(detail, activeTab);
  const activeTabLabels = activeTab === "basic" ? null : TAB_COLUMN_LABELS[activeTab];

  const appointmentRows = useMemo(() => rowsByTab(detail, "appointment"), [detail]);
  const appointmentTotalPages = Math.max(1, Math.ceil(appointmentRows.length / APPOINTMENT_PAGE_SIZE));
  const currentAppointmentPage = Math.min(appointmentPage, appointmentTotalPages);
  const appointmentPageNumbers = useMemo(
    () => buildPageNumbers(currentAppointmentPage, appointmentTotalPages),
    [currentAppointmentPage, appointmentTotalPages],
  );
  const appointmentPagedRows = useMemo(() => {
    const start = (currentAppointmentPage - 1) * APPOINTMENT_PAGE_SIZE;
    return appointmentRows.slice(start, start + APPOINTMENT_PAGE_SIZE);
  }, [currentAppointmentPage, appointmentRows]);

  function updateProfileDraft(field: BasicProfileKey, value: string) {
    setProfileDraft((prev) => ({ ...prev, [field]: value }));
  }

  function cancelBasicEdit() {
    setProfileDraft(buildProfileDraft(detail));
    setProfileEditMode(false);
  }

  async function saveBasicProfile() {
    if (!employeeId) return;
    if (activeTab !== "basic") {
      toast.error("인사기본 탭에서만 기본정보를 저장할 수 있습니다.");
      return;
    }

    setProfileSaving(true);
    try {
      const response = await fetch(`/api/hr/basic/${employeeId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: asNullable(profileDraft.full_name),
          hire_date: asNullable(profileDraft.hire_date),
          gender: asNullable(profileDraft.gender),
          resident_no_masked: asNullable(profileDraft.resident_no_masked),
          retire_date: asNullable(profileDraft.retire_date),
          blood_type: asNullable(profileDraft.blood_type),
          marital_status: asNullable(profileDraft.marital_status),
          mbti: asNullable(profileDraft.mbti),
          probation_end_date: asNullable(profileDraft.probation_end_date),
          job_family: asNullable(profileDraft.job_family),
          job_role: asNullable(profileDraft.job_role),
          grade: asNullable(profileDraft.grade),
        }),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as unknown;
        toast.error(stringifyErrorDetail(json) ?? "기본정보 저장에 실패했습니다.");
        return;
      }

      toast.success("기본정보가 저장되었습니다.");
      setProfileEditMode(false);
      await onReload();
    } finally {
      setProfileSaving(false);
    }
  }

  async function addRecord() {
    if (!employeeId || activeTab === "basic") return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: toCategory(activeTab),
        title: newTitle || "신규",
        type: "",
        note: "",
      }),
    });
    if (!response.ok) {
      toast.error("행 추가에 실패했습니다.");
      return;
    }
    setNewTitle("");
    toast.success("행이 추가되었습니다.");
    await onReload();
  }

  async function saveRow(rowId: number) {
    if (!employeeId || activeTab === "basic") return;
    const category = toCategory(activeTab);
    const row = draftRows[rowId];
    if (!row) return;

    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}?category=${encodeURIComponent(category)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_date: row.record_date || null,
        type: row.type || null,
        title: row.title || null,
        organization: row.organization || null,
        value: row.value || null,
        note: row.note || null,
      }),
    });
    if (!response.ok) {
      toast.error("저장에 실패했습니다.");
      return;
    }
    toast.success("저장되었습니다.");
    await onReload();
  }

  async function removeRecord(row: HrInfoRow) {
    if (!employeeId || activeTab === "basic") return;
    const category = toCategory(activeTab);
    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}?category=${encodeURIComponent(category)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    toast.success("삭제되었습니다.");
    await onReload();
  }

  function updateDraft(rowId: number, field: keyof HrInfoRow, value: string) {
    setDraftRows((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value,
      },
    }));
  }

  return (
    <div className="mx-4 mt-4 space-y-4 lg:mx-8">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--vibe-nav-text-strong)]">인사기본 정보</h2>
            <p className="mt-1 text-sm text-[color:var(--vibe-nav-text-muted)]">
              직원의 상세한 개인 및 직무 정보를 확인하세요.
            </p>
            {profileEditMode ? (
              <p className="mt-2 text-xs font-medium text-primary">수정 모드입니다. 변경 후 저장 버튼을 눌러주세요.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeTab !== "basic") {
                  setActiveTab("basic");
                }
                setProfileEditMode(true);
              }}
              disabled={!employeeId || profileEditMode}
            >
              수정
            </Button>

            {profileEditMode ? (
              <Button type="button" variant="outline" onClick={cancelBasicEdit} disabled={profileSaving}>
                취소
              </Button>
            ) : null}

            <Button
              type="button"
              onClick={() => void saveBasicProfile()}
              disabled={!employeeId || activeTab !== "basic" || !profileEditMode || profileSaving}
            >
              {profileSaving ? "저장중..." : "저장"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => toast.info("출력 방식은 협의 후 반영하겠습니다.")}
            >
              출력
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setActiveTab(value);
                setDraftRows({});
                if (value === "appointment") setAppointmentPage(1);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === value
                  ? "border-primary/40 bg-primary/10 text-[color:var(--vibe-nav-text-strong)]"
                  : "border-border bg-card text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "basic" ? (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profileCards.map((card) => {
              const raw = card.key ? profileDraft[card.key] : card.fixedValue ?? "";
              const displayValue = raw.trim().length > 0 ? raw : "-";
              const editable = Boolean(card.key) && profileEditMode;
              const Icon = card.icon;

              return (
                <article
                  key={card.label}
                  className={`rounded-2xl border p-4 transition hover:shadow-sm ${getToneCardClass(card.tone)} ${displayValue === "-" ? "opacity-85" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tracking-wide text-[color:var(--vibe-nav-text-muted)]">{card.label}</p>

                      {editable && card.key ? (
                        <Input
                          type={card.inputType ?? "text"}
                          value={profileDraft[card.key]}
                          onChange={(event) => updateProfileDraft(card.key as BasicProfileKey, event.target.value)}
                          className={`mt-2 h-9 ${card.mono ? "font-mono" : ""}`}
                        />
                      ) : (
                        <p
                          className={`mt-2 break-words text-lg font-bold text-[color:var(--vibe-nav-text-strong)] ${
                            card.mono ? "font-mono text-[15px]" : ""
                          } ${displayValue === "-" ? "text-[color:var(--vibe-nav-text-muted)]" : ""}`}
                        >
                          {displayValue}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${getToneIconClass(card.tone)}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 text-right text-xs text-[color:var(--vibe-nav-text-muted)]">
            마지막 갱신: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "-"}
          </div>
        </section>
      ) : activeTab === "appointment" ? (
        <Card className="rounded-3xl border-border shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-[color:var(--vibe-nav-text-strong)]">{TAB_COLUMN_LABELS.appointment.tableTitle}</CardTitle>
              <p className="mt-1 text-sm text-[color:var(--vibe-nav-text-muted)]">소량 데이터 테이블 모드 (비 AG Grid)</p>
            </div>
            <div className="text-sm font-medium text-[color:var(--vibe-nav-text-muted)]">
              [{currentAppointmentPage} / {appointmentTotalPages}]
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="신규 행 제목"
                className="max-w-xs"
              />
              <Button onClick={addRecord}>추가</Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs uppercase tracking-wide text-[color:var(--vibe-nav-text)]">
                    <th className="border-b border-border px-3 py-2 text-center">순번</th>
                    <th className="border-b border-border px-3 py-2 text-left">{TAB_COLUMN_LABELS.appointment.recordDate}</th>
                    <th className="border-b border-border px-3 py-2 text-left">{TAB_COLUMN_LABELS.appointment.type}</th>
                    <th className="border-b border-border px-3 py-2 text-left">{TAB_COLUMN_LABELS.appointment.title}</th>
                    <th className="border-b border-border px-3 py-2 text-left">{TAB_COLUMN_LABELS.appointment.organization}</th>
                    <th className="border-b border-border px-3 py-2 text-left">{TAB_COLUMN_LABELS.appointment.value}</th>
                    <th className="border-b border-border px-3 py-2 text-left">{TAB_COLUMN_LABELS.appointment.note}</th>
                    <th className="border-b border-border px-3 py-2 text-left">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentPagedRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-[color:var(--vibe-nav-text-muted)]" colSpan={8}>
                        {TAB_COLUMN_LABELS.appointment.emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    appointmentPagedRows.map((row, index) => {
                      const draft = draftRows[row.id] ?? row;
                      const rowNumber = (currentAppointmentPage - 1) * APPOINTMENT_PAGE_SIZE + index + 1;
                      return (
                        <tr key={row.id} className="border-b border-border/60 hover:bg-accent/40">
                          <td className="px-3 py-2 text-center text-[color:var(--vibe-nav-text-muted)]">{rowNumber}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="date"
                              value={draft.record_date ?? ""}
                              onChange={(event) => updateDraft(row.id, "record_date", event.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={draft.type ?? ""} onChange={(event) => updateDraft(row.id, "type", event.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={draft.title ?? ""} onChange={(event) => updateDraft(row.id, "title", event.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={draft.organization ?? ""}
                              onChange={(event) => updateDraft(row.id, "organization", event.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={draft.value ?? ""} onChange={(event) => updateDraft(row.id, "value", event.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={draft.note ?? ""} onChange={(event) => updateDraft(row.id, "note", event.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => void saveRow(row.id)}>
                                저장
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void removeRecord(row)}>
                                삭제
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentAppointmentPage <= 1}
                onClick={() => setAppointmentPage(Math.max(1, currentAppointmentPage - 1))}
              >
                이전
              </Button>
              {appointmentPageNumbers.map((pageNo) => (
                <Button
                  key={pageNo}
                  type="button"
                  size="sm"
                  variant={currentAppointmentPage === pageNo ? "default" : "outline"}
                  onClick={() => setAppointmentPage(pageNo)}
                >
                  {pageNo}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentAppointmentPage >= appointmentTotalPages}
                onClick={() => setAppointmentPage(Math.min(appointmentTotalPages, currentAppointmentPage + 1))}
              >
                다음
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-[color:var(--vibe-nav-text-strong)]">{activeTabLabels?.tableTitle ?? "이력 관리"}</CardTitle>
            <div className="mt-2 flex gap-2">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="신규 행 제목"
                className="max-w-xs"
              />
              <Button onClick={addRecord}>추가</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-[color:var(--vibe-nav-text-strong)]">
                    <th className="px-2 py-2 text-left font-semibold">{activeTabLabels?.recordDate ?? "일자"}</th>
                    <th className="px-2 py-2 text-left font-semibold">{activeTabLabels?.type ?? "구분"}</th>
                    <th className="px-2 py-2 text-left font-semibold">{activeTabLabels?.title ?? "제목"}</th>
                    <th className="px-2 py-2 text-left font-semibold">{activeTabLabels?.organization ?? "소속"}</th>
                    <th className="px-2 py-2 text-left font-semibold">{activeTabLabels?.value ?? "값"}</th>
                    <th className="px-2 py-2 text-left font-semibold">{activeTabLabels?.note ?? "비고"}</th>
                    <th className="px-2 py-2 text-left font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {tabRows.length === 0 ? (
                    <tr>
                      <td className="px-2 py-6 text-center text-[color:var(--vibe-nav-text-muted)]" colSpan={7}>
                        {activeTabLabels?.emptyMessage ?? "데이터가 없습니다."}
                      </td>
                    </tr>
                  ) : (
                    tabRows.map((row) => {
                      const draft = draftRows[row.id] ?? row;
                      return (
                        <tr key={row.id} className="border-t border-border/60">
                          <td className="px-2 py-1">
                            <Input
                              type="date"
                              value={draft.record_date ?? ""}
                              onChange={(event) => updateDraft(row.id, "record_date", event.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.type ?? ""} onChange={(event) => updateDraft(row.id, "type", event.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.title ?? ""} onChange={(event) => updateDraft(row.id, "title", event.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              value={draft.organization ?? ""}
                              onChange={(event) => updateDraft(row.id, "organization", event.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.value ?? ""} onChange={(event) => updateDraft(row.id, "value", event.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.note ?? ""} onChange={(event) => updateDraft(row.id, "note", event.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => void saveRow(row.id)}>
                                저장
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void removeRecord(row)}>
                                삭제
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
