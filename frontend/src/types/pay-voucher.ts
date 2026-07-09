// ── GL 계정과목 ──
export type GlAccountItem = {
  id: number;
  code: string;
  name: string;
  account_type: "expense" | "liability" | "asset" | "equity" | "revenue";
  is_net_pay_account: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type GlAccountListResponse = {
  items: GlAccountItem[];
  total_count: number;
};

export type GlAccountBatchItem = {
  id?: number | null;
  code: string;
  name: string;
  account_type: string;
  is_net_pay_account: boolean;
  is_active: boolean;
  sort_order: number;
};

export type GlAccountBatchRequest = {
  items: GlAccountBatchItem[];
  delete_ids?: number[];
};

export type GlAccountBatchResponse = {
  items: GlAccountItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

// ── 급여항목-계정 매핑 ──
export type PayGlMappingItem = {
  id: number;
  pay_item_code: string;
  pay_item_name?: string | null;
  gl_account_code: string;
  gl_account_name?: string | null;
  effective_from: string;
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PayGlMappingListResponse = {
  items: PayGlMappingItem[];
  total_count: number;
};

export type PayGlMappingBatchItem = {
  id?: number | null;
  pay_item_code: string;
  gl_account_code: string;
  effective_from: string;
  note?: string | null;
  is_active: boolean;
};

export type PayGlMappingBatchRequest = {
  items: PayGlMappingBatchItem[];
  delete_ids?: number[];
};

export type PayGlMappingBatchResponse = {
  items: PayGlMappingItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

// ── 급여 전표 ──
export type PayVoucherItem = {
  id: number;
  voucher_no: string;
  run_id: number;
  year_month?: string | null;
  voucher_date: string;
  status: string;
  total_debit: number;
  total_credit: number;
  summary?: string | null;
  created_by?: number | null;
  confirmed_by?: number | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PayVoucherListResponse = {
  items: PayVoucherItem[];
  total_count: number;
};

export type PayVoucherLineItem = {
  id: number;
  line_no: number;
  gl_account_code: string;
  gl_account_name?: string | null;
  cost_center_code?: string | null;
  debit_amount: number;
  credit_amount: number;
  summary?: string | null;
  source_item_code?: string | null;
  created_at: string;
};

export type PayVoucherDetailResponse = {
  voucher: PayVoucherItem;
  lines: PayVoucherLineItem[];
};

export type PayVoucherActionResponse = {
  voucher: PayVoucherItem;
};

export type MappingGapItem = {
  item_code: string;
  item_name?: string | null;
  direction: string;
};

export type MappingGapsResponse = {
  run_id: number;
  missing_item_codes: MappingGapItem[];
};
