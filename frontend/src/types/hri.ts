export type HriFormTypeItem = {
  id: number;
  form_code: string;
  form_name_ko: string;
  form_name_en: string | null;
  module_code: string;
  is_active: boolean;
  allow_draft: boolean;
  allow_withdraw: boolean;
  requires_receive: boolean;
  default_priority: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type HriFormTypeListResponse = {
  items: HriFormTypeItem[];
  total_count: number;
};

export type HriFormTypeBatchItem = {
  id: number | null;
  form_code: string;
  form_name_ko: string;
  form_name_en: string | null;
  module_code: string;
  is_active: boolean;
  allow_draft: boolean;
  allow_withdraw: boolean;
  requires_receive: boolean;
  default_priority: number;
};

export type HriFormTypeBatchRequest = {
  items: HriFormTypeBatchItem[];
  delete_ids: number[];
};

export type HriFormTypeBatchResponse = {
  items: HriFormTypeItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

export type HriApprovalTemplateStepItem = {
  id: number;
  step_order: number;
  step_type: "APPROVAL" | "RECEIVE" | "REFERENCE";
  actor_resolve_type: "ROLE_BASED" | "USER_FIXED";
  actor_role_code: string | null;
  actor_user_id: number | null;
  allow_delegate: boolean;
  required_action: "APPROVE" | "RECEIVE";
  created_at: string;
  updated_at: string;
};

export type HriApprovalTemplateItem = {
  id: number;
  template_code: string;
  template_name: string;
  scope_type: "GLOBAL" | "COMPANY" | "DEPT" | "TEAM" | "USER";
  scope_id: string | null;
  is_default: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  steps: HriApprovalTemplateStepItem[];
};

export type HriApprovalTemplateListResponse = {
  items: HriApprovalTemplateItem[];
  total_count: number;
};

export type HriApprovalTemplateStepBatchItem = {
  id: number | null;
  step_order: number;
  step_type: "APPROVAL" | "RECEIVE" | "REFERENCE";
  actor_resolve_type: "ROLE_BASED" | "USER_FIXED";
  actor_role_code: string | null;
  actor_user_id: number | null;
  allow_delegate: boolean;
  required_action: "APPROVE" | "RECEIVE";
};

export type HriApprovalTemplateBatchItem = {
  id: number | null;
  template_code: string;
  template_name: string;
  scope_type: "GLOBAL" | "COMPANY" | "DEPT" | "TEAM" | "USER";
  scope_id: string | null;
  is_default: boolean;
  is_active: boolean;
  priority: number;
  steps: HriApprovalTemplateStepBatchItem[];
};

export type HriApprovalTemplateBatchRequest = {
  items: HriApprovalTemplateBatchItem[];
  delete_ids: number[];
};

export type HriApprovalTemplateBatchResponse = {
  items: HriApprovalTemplateItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

export type HriRequestItem = {
  id: number;
  request_no: string;
  form_type_id: number;
  form_name: string | null;
  requester_id: number;
  title: string;
  status_code: string;
  current_step_order: number | null;
  current_actor_name: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  content_json: Record<string, unknown>;
};

export type HriRequestListResponse = {
  items: HriRequestItem[];
  total_count: number;
};

export type HriTaskItem = {
  request_id: number;
  request_no: string;
  title: string;
  status_code: string;
  step_order: number;
  step_type: "APPROVAL" | "RECEIVE" | "REFERENCE";
  requester_id: number;
  requested_at: string;
  form_name: string | null;
};

export type HriTaskListResponse = {
  items: HriTaskItem[];
  total_count: number;
};

export type HriRequestDraftUpsertRequest = {
  request_id: number | null;
  form_type_id: number;
  title: string;
  content_json: Record<string, unknown>;
};

export type HriRequestDetailResponse = {
  request: HriRequestItem;
};

export type HriRequestStepSnapshotItem = {
  id: number;
  step_order: number;
  step_type: "APPROVAL" | "RECEIVE" | "REFERENCE";
  actor_name: string;
  action_status: "WAITING" | "APPROVED" | "REJECTED" | "RECEIVED";
  acted_at: string | null;
  comment: string | null;
};

export type HriRequestDetailFull = HriRequestItem & {
  form_code: string | null;
  steps: HriRequestStepSnapshotItem[];
  detail_data: Record<string, unknown>;
};

export type HriRequestDetailFullResponse = {
  request: HriRequestDetailFull;
};

export type HriRequestSubmitResponse = {
  request_id: number;
  status_code: string;
  current_step_order: number | null;
};

export type HriRequestActionRequest = {
  comment: string | null;
};

export type HriRequestActionResponse = {
  request_id: number;
  status_code: string;
};
