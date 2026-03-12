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
};
