export type HrEmployeeSummary = {
  id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
  position_title: string;
  birth_date?: string | null;
  job_family?: string | null;
  job_role?: string | null;
  grade?: string | null;
};

export type HrInfoRow = {
  id: number;
  category: string;
  record_date?: string | null;
  title?: string | null;
  type?: string | null;
  organization?: string | null;
  value?: string | null;
  note?: string | null;
  created_at: string;
};

export type HrBasicProfileResponse = {
  employee_id: number;
  employee_no?: string | null;
  full_name?: string | null;
  gender?: string | null;
  resident_no_masked?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  retire_date?: string | null;
  blood_type?: string | null;
  marital_status?: string | null;
  mbti?: string | null;
  probation_end_date?: string | null;
  department_name?: string | null;
  position_title?: string | null;
  job_family?: string | null;
  job_role?: string | null;
  grade?: string | null;
};

export type HrBasicDetailResponse = {
  profile: HrBasicProfileResponse;
  appointments: HrInfoRow[];
  rewards_penalties: HrInfoRow[];
  contacts: HrInfoRow[];
  educations: HrInfoRow[];
  careers: HrInfoRow[];
  certificates: HrInfoRow[];
  military: HrInfoRow[];
  evaluations: HrInfoRow[];
};
