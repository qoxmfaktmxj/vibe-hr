export type PapAppraisalItem = {
  id: number;
  appraisal_code: string;
  appraisal_name: string;
  appraisal_year: number;
  final_result_id: number | null;
  final_result_code: string | null;
  final_result_name: string | null;
  appraisal_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PapAppraisalListResponse = {
  items: PapAppraisalItem[];
  total_count: number;
  page: number;
  limit: number;
};

export type PapAppraisalDetailResponse = {
  item: PapAppraisalItem;
};

// ─── Appraisal Target types ───────────────────────────────────────────────────

export type PapAppraisalTargetItem = {
  [key: string]: unknown;
  id: number;
  appraisal_id: number;
  appraisal_name: string | null;
  employee_id: number;
  employee_no: string | null;
  employee_name: string | null;
  department_name: string | null;
  score: number | null;
  grade_code: string | null;
  evaluator_note: string | null;
  status: string;
  evaluated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PapAppraisalTargetListResponse = {
  items: PapAppraisalTargetItem[];
  total_count: number;
};

export type PapAppraisalTargetBatchRequest = {
  items: Array<Partial<PapAppraisalTargetItem> & { _status?: string }>;
};

export type PapAppraisalTargetBatchResponse = {
  created: number;
  updated: number;
  deleted: number;
};
