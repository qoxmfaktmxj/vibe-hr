export type PapFinalResultItem = {
  id: number;
  result_code: string;
  result_name: string;
  score_grade: number | null;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PapFinalResultListResponse = {
  items: PapFinalResultItem[];
  total_count: number;
  page: number;
  limit: number;
};

export type PapFinalResultDetailResponse = {
  item: PapFinalResultItem;
};
