from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_employees: int
    total_departments: int
    attendance_present_today: int
    attendance_late_today: int
    attendance_absent_today: int
    pending_leave_requests: int

