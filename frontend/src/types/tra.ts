export type TraRowStatus = "clean" | "added" | "updated" | "deleted";

export type TraResourceRow = {
  id: number;
  _status: TraRowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: TraRowStatus;
  [key: string]: unknown;
};

export type TraResourceListResponse = {
  items: Record<string, unknown>[];
  total_count: number;
};

export type TraResourceBatchPayload = {
  items: Record<string, unknown>[];
};

export type TraResourceBatchResponse = {
  created: number;
  updated: number;
  deleted: number;
};

export type TraGenerationResponse = {
  processed: number;
  message: string;
};

// ── Write-flow types ──────────────────────────────────────────────────────────

export type TraApplicationItem = {
  id: number;
  application_no: string;
  employee_id: number;
  employee_no: string | null;
  employee_name: string | null;
  department_name: string | null;
  course_id: number;
  course_name: string | null;
  event_id: number | null;
  event_name: string | null;
  in_out_type: string | null;
  status: string;
  year_plan_yn: boolean;
  survey_yn: boolean;
  edu_memo: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type TraApplicationListResponse = {
  items: TraApplicationItem[];
  total_count: number;
};

export type TraApplicationCreateRequest = {
  course_id: number;
  event_id?: number | null;
  in_out_type?: string | null;
  year_plan_yn?: boolean;
  edu_memo?: string | null;
  note?: string | null;
};

export type TraApplicationRejectRequest = {
  reason?: string | null;
};

export type TraApplicationActionResponse = {
  item: TraApplicationItem;
};

export type TraColumnType = "text" | "number" | "boolean" | "date";

export type TraColumnConfig = {
  field: string;
  headerName: string;
  type?: TraColumnType;
  minWidth?: number;
  width?: number;
  flex?: number;
  editable?: boolean;
  required?: boolean;
};

export type TraSearchFieldConfig = {
  key: string;
  placeholder: string;
};

export type TraScreenConfig = {
  title: string;
  resource: string;
  searchFields: TraSearchFieldConfig[];
  columns: TraColumnConfig[];
  defaultRow: Record<string, unknown>;
};

// ─── Write-flow types ─────────────────────────────────────────────────────────

export type TraApplicationItem = {
  id: number;
  application_no: string;
  employee_id: number;
  employee_no: string | null;
  employee_name: string | null;
  department_name: string | null;
  course_id: number;
  course_name: string | null;
  event_id: number | null;
  event_name: string | null;
  in_out_type: string | null;
  status: string;
  year_plan_yn: boolean;
  survey_yn: boolean;
  edu_memo: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type TraApplicationListResponse = {
  items: TraApplicationItem[];
  total_count: number;
};

export type TraApplicationCreateRequest = {
  course_id: number;
  event_id?: number | null;
  in_out_type?: string | null;
  year_plan_yn?: boolean;
  edu_memo?: string | null;
  note?: string | null;
};

export type TraApplicationRejectRequest = {
  reason?: string | null;
};

export type TraApplicationActionResponse = {
  item: TraApplicationItem;
};
