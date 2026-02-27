export type HrAppointmentCodeItem = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  mapping_key: string | null;
  mapping_value: string | null;
  created_at: string;
  updated_at: string;
};

export type HrAppointmentCodeListResponse = {
  items: HrAppointmentCodeItem[];
};

export type HrAppointmentCodeDetailResponse = {
  item: HrAppointmentCodeItem;
};

