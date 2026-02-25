export type MngCompanyItem = {
  id: number;
  company_code: string;
  company_name: string;
  company_group_code?: string | null;
  company_type?: string | null;
  management_type?: string | null;
  representative_company?: string | null;
  start_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MngCompanyListResponse = {
  companies: MngCompanyItem[];
  total_count: number;
};

export type MngCompanyDropdownItem = {
  id: number;
  company_name: string;
};

export type MngCompanyDropdownResponse = {
  companies: MngCompanyDropdownItem[];
};

export type MngManagerCompanyItem = {
  id: number;
  employee_id: number;
  employee_name?: string | null;
  company_id: number;
  company_name?: string | null;
  start_date: string;
  end_date?: string | null;
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MngManagerCompanyListResponse = {
  items: MngManagerCompanyItem[];
  total_count: number;
};

export type MngDevRequestItem = {
  id: number;
  company_id: number;
  company_name?: string | null;
  request_ym: string;
  request_seq: number;
  status_code?: string | null;
  requester_name?: string | null;
  request_content?: string | null;
  manager_employee_id?: number | null;
  developer_employee_id?: number | null;
  is_paid: boolean;
  paid_content?: string | null;
  has_tax_bill: boolean;
  paid_man_months?: number | null;
  actual_man_months?: number | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export type MngDevRequestListResponse = {
  items: MngDevRequestItem[];
  total_count: number;
};

export type MngDevRequestMonthlySummaryItem = {
  request_ym: string;
  total_count: number;
  paid_count: number;
  paid_man_months_total: number;
  actual_man_months_total: number;
};

export type MngDevRequestMonthlySummaryResponse = {
  items: MngDevRequestMonthlySummaryItem[];
  total_count: number;
};

export type MngDevProjectItem = {
  id: number;
  project_name: string;
  company_id: number;
  company_name?: string | null;
  part_code?: string | null;
  assigned_staff?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  dev_start_date?: string | null;
  dev_end_date?: string | null;
  inspection_status?: string | null;
  has_tax_bill: boolean;
  actual_man_months?: number | null;
  contract_amount?: number | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export type MngDevProjectListResponse = {
  items: MngDevProjectItem[];
  total_count: number;
};

export type MngDevInquiryItem = {
  id: number;
  company_id: number;
  company_name?: string | null;
  inquiry_content?: string | null;
  hoped_start_date?: string | null;
  estimated_man_months?: number | null;
  sales_rep_name?: string | null;
  client_contact_name?: string | null;
  progress_code?: string | null;
  is_confirmed: boolean;
  project_name?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export type MngDevInquiryListResponse = {
  items: MngDevInquiryItem[];
  total_count: number;
};

export type MngDevStaffProjectItem = {
  project_id: number;
  project_name: string;
  company_id: number;
  company_name?: string | null;
  assigned_staff?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  dev_start_date?: string | null;
  dev_end_date?: string | null;
  actual_man_months?: number | null;
  contract_amount?: number | null;
};

export type MngDevStaffProjectListResponse = {
  items: MngDevStaffProjectItem[];
  total_count: number;
};

export type MngDevStaffRevenueItem = {
  month: string;
  project_count: number;
  contract_amount_total: number;
  actual_man_months_total: number;
};

export type MngDevStaffRevenueSummaryResponse = {
  items: MngDevStaffRevenueItem[];
  total_count: number;
};

export type MngOutsourceContractItem = {
  id: number;
  employee_id: number;
  employee_name?: string | null;
  employee_no?: string | null;
  start_date: string;
  end_date: string;
  total_leave_count: number;
  extra_leave_count: number;
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MngOutsourceContractListResponse = {
  items: MngOutsourceContractItem[];
  total_count: number;
};

export type MngOutsourceAttendanceSummaryItem = {
  contract_id: number;
  employee_id: number;
  employee_name?: string | null;
  employee_no?: string | null;
  start_date: string;
  end_date: string;
  total_count: number;
  used_count: number;
  remain_count: number;
  note?: string | null;
};

export type MngOutsourceAttendanceSummaryResponse = {
  items: MngOutsourceAttendanceSummaryItem[];
  total_count: number;
};

export type MngOutsourceAttendanceItem = {
  id: number;
  contract_id: number;
  employee_id: number;
  attendance_code: string;
  apply_date?: string | null;
  status_code?: string | null;
  start_date: string;
  end_date: string;
  apply_count?: number | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export type MngOutsourceAttendanceListResponse = {
  items: MngOutsourceAttendanceItem[];
  total_count: number;
};

export type MngInfraMasterItem = {
  id: number;
  company_id: number;
  company_name?: string | null;
  service_type: string;
  env_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MngInfraMasterListResponse = {
  items: MngInfraMasterItem[];
  total_count: number;
};

export type MngInfraConfigItem = {
  id: number;
  master_id: number;
  section: string;
  config_key: string;
  config_value?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MngInfraConfigListResponse = {
  items: MngInfraConfigItem[];
  total_count: number;
};
