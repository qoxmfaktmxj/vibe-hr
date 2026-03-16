export type OrganizationDepartmentItem = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  organization_type: string | null;
  cost_center_code: string | null;
  description: string | null;
  employee_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationDepartmentListResponse = {
  departments: OrganizationDepartmentItem[];
  total_count: number;
  reference_date: string | null;
  page?: number | null;
  limit?: number | null;
};

export type OrganizationDepartmentDetailResponse = {
  department: OrganizationDepartmentItem;
};

export type OrganizationCorporationItem = {
  id: number;
  enter_cd: string;
  company_code: string;
  corporation_name: string;
  corporation_number: string | null;
  business_number: string | null;
  company_seal_url: string | null;
  certificate_seal_url: string | null;
  company_logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationCorporationListResponse = {
  corporations: OrganizationCorporationItem[];
  total_count: number;
  page?: number | null;
  limit?: number | null;
};

export type OrganizationCorporationDetailResponse = {
  corporation: OrganizationCorporationItem;
};

// ---------------------------------------------------------------------------
// B안: 부서 변경 이력
// ---------------------------------------------------------------------------
export type OrgDeptChangeHistoryItem = {
  id: number;
  department_id: number;
  department_name: string | null;
  changed_by: number | null;
  changed_by_name: string | null;
  field_name: string;
  before_value: string | null;
  after_value: string | null;
  change_reason: string | null;
  changed_at: string;
};

export type OrgDeptChangeHistoryListResponse = {
  items: OrgDeptChangeHistoryItem[];
  total_count: number;
};

// ---------------------------------------------------------------------------
// A안: 조직개편안 (Plan)
// ---------------------------------------------------------------------------
export type OrgRestructurePlanStatus = "draft" | "reviewing" | "applied" | "cancelled";

export type OrgRestructurePlanItem = {
  id: number;
  title: string;
  description: string | null;
  planned_date: string | null;
  status: OrgRestructurePlanStatus;
  applied_at: string | null;
  applied_by: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  item_count: number;
};

export type OrgRestructurePlanListResponse = {
  items: OrgRestructurePlanItem[];
  total_count: number;
};

// ---------------------------------------------------------------------------
// A안: 개편안 항목 (Plan Item)
// ---------------------------------------------------------------------------
export type OrgRestructureActionType = "move" | "rename" | "create" | "deactivate" | "reactivate";
export type OrgRestructureItemStatus = "pending" | "applied" | "skipped";

export type OrgRestructurePlanItemDetail = {
  id: number;
  plan_id: number;
  action_type: OrgRestructureActionType;
  target_dept_id: number | null;
  target_dept_name: string | null;
  target_dept_code: string | null;
  new_parent_id: number | null;
  new_parent_name: string | null;
  new_name: string | null;
  new_code: string | null;
  new_organization_type: string | null;
  new_cost_center_code: string | null;
  sort_order: number;
  item_status: OrgRestructureItemStatus;
  memo: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgRestructurePlanItemListResponse = {
  items: OrgRestructurePlanItemDetail[];
  total_count: number;
};

export type OrgRestructureApplyResponse = {
  plan_id: number;
  applied_count: number;
  skipped_count: number;
  messages: string[];
};
