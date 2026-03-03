export type HrRecruitFinalistItem = {
  id: number;
  candidate_no: string;
  source_type: "if" | "manual";
  external_key?: string | null;
  full_name: string;
  resident_no_masked?: string | null;
  birth_date?: string | null;
  phone_mobile?: string | null;
  email?: string | null;
  hire_type: "new" | "experienced";
  career_years?: number | null;
  login_id?: string | null;
  employee_no?: string | null;
  expected_join_date?: string | null;
  status_code: "draft" | "ready" | "appointed";
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HrRecruitFinalistListResponse = {
  items: HrRecruitFinalistItem[];
  total_count: number;
};

