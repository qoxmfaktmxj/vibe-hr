// ── 퇴직금 산정 ──
export type HrSeveranceCalcItem = {
  id: number;
  retire_case_id: number;
  employee_id: number;
  employee_no?: string | null;
  employee_name?: string | null;
  department_name?: string | null;
  hire_date: string;
  retire_date: string;
  service_days: number;
  avg_wage_base_from?: string | null;
  avg_wage_base_to?: string | null;
  wage_total_3m: number;
  base_days_3m: number;
  avg_daily_wage: number;
  severance_amount: number;
  adjustment_amount: number;
  adjustment_reason?: string | null;
  final_amount: number;
  status: string;
  warning?: string | null;
  calculated_at?: string | null;
  confirmed_by?: number | null;
  confirmed_at?: string | null;
  service_years: number;
  income_tax: number;
  local_income_tax: number;
  net_severance: number;
  created_at: string;
  updated_at: string;
};

export type HrSeveranceTaxDetail = {
  service_years: number;
  service_year_deduction: number;
  conversion_income: number;
  conversion_income_deduction: number;
  taxable_base: number;
  base_tax_rate: number;
  quick_deduction: number;
  converted_calculated_tax: number;
  income_tax: number;
  local_income_tax: number;
  net_severance: number;
  tax_table_year?: number | null;
  bracket_year?: number | null;
  warning?: string | null;
};

export type HrSeveranceCalcListResponse = {
  items: HrSeveranceCalcItem[];
  total_count: number;
  page: number;
  limit: number;
};

export type HrSeveranceWageDetailItem = {
  item_code: string;
  item_name?: string | null;
  include_type: string;
  raw_amount: number;
  included_amount: number;
};

export type HrSeveranceCalcDetailResponse = {
  calc: HrSeveranceCalcItem;
  wage_details: HrSeveranceWageDetailItem[];
  tax_detail?: HrSeveranceTaxDetail | null;
};

export type HrSeveranceAdjustmentUpdateRequest = {
  adjustment_amount: number;
  adjustment_reason: string;
};

// ── 퇴직금 산입 규칙 ──
export type PaySeveranceItemRuleItem = {
  id: number;
  pay_item_code: string;
  pay_item_name?: string | null;
  include_type: "full" | "prorate_12" | "exclude";
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaySeveranceItemRuleListResponse = {
  items: PaySeveranceItemRuleItem[];
  total_count: number;
};

export type PaySeveranceItemRuleBatchItem = {
  id?: number | null;
  pay_item_code: string;
  include_type: string;
  note?: string | null;
  is_active: boolean;
};

export type PaySeveranceItemRuleBatchRequest = {
  items: PaySeveranceItemRuleBatchItem[];
  delete_ids?: number[];
};

export type PaySeveranceItemRuleBatchResponse = {
  items: PaySeveranceItemRuleItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};
