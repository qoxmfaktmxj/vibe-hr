// ── 근태코드 ──
export type TimAttendanceCodeItem = {
  id: number;
  code: string;
  name: string;
  category: "leave" | "work" | "special";
  unit: "day" | "am" | "pm" | "hour";
  is_requestable: boolean;
  min_days: number | null;
  max_days: number | null;
  deduct_annual: boolean;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TimAttendanceCodeListResponse = {
  items: TimAttendanceCodeItem[];
  total_count: number;
};

export type TimAttendanceCodeBatchItem = {
  id?: number | null;
  code: string;
  name: string;
  category: string;
  unit: string;
  is_requestable: boolean;
  min_days: number | null;
  max_days: number | null;
  deduct_annual: boolean;
  is_active: boolean;
  sort_order: number;
  description: string | null;
};

export type TimAttendanceCodeBatchRequest = {
  items: TimAttendanceCodeBatchItem[];
  delete_ids: number[];
};

export type TimAttendanceCodeBatchResponse = {
  items: TimAttendanceCodeItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

// ── 근무코드 ──
export type TimWorkScheduleCodeItem = {
  id: number;
  code: string;
  name: string;
  work_start: string;
  work_end: string;
  break_minutes: number;
  is_overnight: boolean;
  work_hours: number;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TimWorkScheduleCodeListResponse = {
  items: TimWorkScheduleCodeItem[];
  total_count: number;
};

export type TimWorkScheduleCodeBatchItem = {
  id?: number | null;
  code: string;
  name: string;
  work_start: string;
  work_end: string;
  break_minutes: number;
  is_overnight: boolean;
  work_hours: number;
  is_active: boolean;
  sort_order: number;
  description: string | null;
};

export type TimWorkScheduleCodeBatchRequest = {
  items: TimWorkScheduleCodeBatchItem[];
  delete_ids: number[];
};

export type TimWorkScheduleCodeBatchResponse = {
  items: TimWorkScheduleCodeItem[];
  total_count: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

// ── 공휴일 ──
export type TimHolidayItem = {
  id: number;
  holiday_date: string;
  name: string;
  holiday_type: "legal" | "company" | "substitute";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TimHolidayListResponse = {
  items: TimHolidayItem[];
  total_count: number;
  year: number;
};

export type TimHolidayBatchItem = {
  id?: number | null;
  holiday_date: string;
  name: string;
  holiday_type: string;
  is_active: boolean;
};

export type TimHolidayBatchRequest = {
  items: TimHolidayBatchItem[];
  delete_ids: number[];
};

export type TimHolidayBatchResponse = {
  items: TimHolidayItem[];
  total_count: number;
  year: number;
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};

export type TimHolidayCopyYearRequest = {
  year_from: number;
  year_to: number;
};

export type TimHolidayCopyYearResponse = {
  copied_count: number;
  year_to: number;
};

// ── 일상근태 (Phase 2) ──
export type TimAttendanceDailyItem = {
  id: number;
  employee_id: number;
  employee_no: string;
  employee_name: string;
  department_id: number;
  department_name: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  attendance_status: "present" | "late" | "absent" | "leave" | "remote";
};

export type TimAttendanceDailyListResponse = {
  items: TimAttendanceDailyItem[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type TimAttendanceTodayResponse = {
  item: TimAttendanceDailyItem | null;
};

export type TimAttendanceCorrectionItem = {
  id: number;
  attendance_id: number;
  corrected_by_employee_id: number;
  old_status: string;
  new_status: string;
  old_check_in_at: string | null;
  new_check_in_at: string | null;
  old_check_out_at: string | null;
  new_check_out_at: string | null;
  reason: string;
  corrected_at: string;
};

export type TimAttendanceCorrectionListResponse = {
  corrections: TimAttendanceCorrectionItem[];
  total_count: number;
};
