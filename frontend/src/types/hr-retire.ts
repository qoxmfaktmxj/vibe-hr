export type HrRetireChecklistItem = {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type HrRetireChecklistListResponse = {
  items: HrRetireChecklistItem[];
};

export type HrRetireCaseListItem = {
  id: number;
  employee_id: number;
  employee_no: string;
  employee_name: string;
  department_name: string;
  position_title: string;
  retire_date: string;
  reason?: string | null;
  status: "draft" | "confirmed" | "cancelled";
  created_at: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
};

export type HrRetireCaseListResponse = {
  items: HrRetireCaseListItem[];
};

export type HrRetireCaseChecklistItem = {
  id: number;
  checklist_item_id: number;
  checklist_code: string;
  checklist_title: string;
  checklist_description?: string | null;
  is_required: boolean;
  is_checked: boolean;
  checked_by?: number | null;
  checked_at?: string | null;
  note?: string | null;
};

export type HrRetireAuditLogItem = {
  id: number;
  action_type: string;
  actor_user_id?: number | null;
  detail?: string | null;
  created_at: string;
};

export type HrRetireCaseDetail = {
  id: number;
  employee_id: number;
  employee_no: string;
  employee_name: string;
  department_name: string;
  position_title: string;
  retire_date: string;
  reason?: string | null;
  status: "draft" | "confirmed" | "cancelled";
  previous_employment_status?: string | null;
  requested_by?: number | null;
  confirmed_by?: number | null;
  confirmed_at?: string | null;
  cancelled_by?: number | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;
  checklist_items: HrRetireCaseChecklistItem[];
  audit_logs: HrRetireAuditLogItem[];
};

