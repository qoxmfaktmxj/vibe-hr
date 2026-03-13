export type WelBenefitTypeItem = {
  id: number;
  code: string;
  name: string;
  module_path: string;
  is_deduction: boolean;
  pay_item_code: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WelBenefitTypeListResponse = {
  items: WelBenefitTypeItem[];
  total_count: number;
  page: number;
  limit: number;
};

export type WelBenefitRequestItem = {
  id: number;
  request_no: string;
  benefit_type_code: string;
  benefit_type_name: string;
  employee_no: string;
  employee_name: string;
  department_name: string;
  status_code: string;
  requested_amount: number;
  approved_amount: number | null;
  payroll_run_label: string | null;
  description: string | null;
  requested_at: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WelBenefitRequestListResponse = {
  items: WelBenefitRequestItem[];
  total_count: number;
  page: number;
  limit: number;
};
