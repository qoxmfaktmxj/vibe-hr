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
};

export type PapAppraisalDetailResponse = {
  item: PapAppraisalItem;
};
