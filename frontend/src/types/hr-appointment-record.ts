export type HrAppointmentRecordItem = {
  id: number;
  order_id: number;
  appointment_no: string;
  order_title: string;
  order_description: string | null;
  effective_date: string;
  order_status: "draft" | "confirmed" | "cancelled";
  confirmed_at: string | null;
  confirmed_by: number | null;
  employee_id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
  employment_status: "active" | "leave" | "resigned";
  appointment_code_id: number | null;
  appointment_code_name: string | null;
  appointment_kind: "permanent" | "temporary";
  action_type: string;
  start_date: string;
  end_date: string | null;
  from_department_id: number | null;
  to_department_id: number | null;
  from_position_title: string | null;
  to_position_title: string | null;
  from_employment_status: string | null;
  to_employment_status: string | null;
  apply_status: "pending" | "applied" | "cancelled";
  applied_at: string | null;
  temporary_reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type HrAppointmentRecordListResponse = {
  items: HrAppointmentRecordItem[];
};

export type HrAppointmentRecordDetailResponse = {
  item: HrAppointmentRecordItem;
};

export type HrAppointmentOrderConfirmResponse = {
  order_id: number;
  status: "draft" | "confirmed" | "cancelled";
  confirmed_at: string;
  confirmed_by: number | null;
  applied_count: number;
};
