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

// ── 근태 리포트 (Phase 4) ──
export type TimStatusCount = {
  present: number;
  late: number;
  absent: number;
  leave: number;
  remote: number;
};

export type TimDepartmentSummaryItem = {
  department_id: number;
  department_name: string;
  attendance_count: number;
  present_rate: number;
  late_rate: number;
  absent_rate: number;
};

export type TimLeaveTypeSummaryItem = {
  leave_type: string;
  request_count: number;
  approved_count: number;
  pending_count: number;
};

export type TimReportSummaryResponse = {
  start_date: string;
  end_date: string;
  total_attendance_records: number;
  total_leave_requests: number;
  status_counts: TimStatusCount;
  department_summaries: TimDepartmentSummaryItem[];
  leave_type_summaries: TimLeaveTypeSummaryItem[];
};
