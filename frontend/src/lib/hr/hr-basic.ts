import type { HrBasicDetailResponse, HrInfoRow } from "@/types/hr-employee-profile";

export type TabKey =
  | "basic"
  | "appointment"
  | "reward"
  | "contact"
  | "education"
  | "career"
  | "certificate"
  | "military"
  | "evaluation";

export type BasicProfileDraft = {
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

export type BasicProfileKey = keyof BasicProfileDraft;
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



export const TAB_COLUMN_LABELS: Record<Exclude<TabKey, "basic">, TabColumnLabels> = {
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

export function asNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function stringifyErrorDetail(value: unknown): string | null {
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

export function buildProfileDraft(detail: HrBasicDetailResponse | null): BasicProfileDraft {
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

export function toCategory(tab: Exclude<TabKey, "basic">): string {
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

export function rowsByTab(detail: HrBasicDetailResponse | null, tab: Exclude<TabKey, "basic">): HrInfoRow[] {
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
