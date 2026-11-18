INSERT INTO tim_month_closes(year,month,close_status,employee_count,present_days,absent_days,late_days,leave_days,half_day_count,
 total_overtime_minutes,total_night_minutes,total_holiday_work_minutes,total_holiday_overtime_minutes,total_holiday_night_minutes,
 closed_by,note,closed_at,created_at,updated_at)
SELECT $3,$4,'closed',count(DISTINCT a.employee_id),count(*) FILTER(WHERE attendance_status='present'),count(*) FILTER(WHERE attendance_status='absent'),
 count(*) FILTER(WHERE attendance_status='late'),count(*) FILTER(WHERE attendance_status='leave' AND l.leave_type IS DISTINCT FROM 'half_day'),
 count(*) FILTER(WHERE l.leave_type='half_day'),coalesce(sum(overtime_minutes),0),coalesce(sum(night_minutes),0),coalesce(sum(holiday_work_minutes),0),
 coalesce(sum(holiday_overtime_minutes),0),coalesce(sum(holiday_night_minutes),0),$5,$6,
 statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp() AT TIME ZONE 'UTC'
FROM tim_attendance_daily a LEFT JOIN tim_leave_requests l ON a.approved_leave_request_id=l.id AND l.request_status='approved'
WHERE a.work_date BETWEEN $1 AND $2
ON CONFLICT(year,month) DO UPDATE SET
 close_status=excluded.close_status,
 employee_count=excluded.employee_count,
 present_days=excluded.present_days,
 absent_days=excluded.absent_days,
 late_days=excluded.late_days,
 total_overtime_minutes=excluded.total_overtime_minutes,
 total_night_minutes=excluded.total_night_minutes,
 total_holiday_work_minutes=excluded.total_holiday_work_minutes,
 total_holiday_overtime_minutes=excluded.total_holiday_overtime_minutes,
 total_holiday_night_minutes=excluded.total_holiday_night_minutes,
 leave_days=excluded.leave_days,
 half_day_count=excluded.half_day_count,
 closed_by=excluded.closed_by,
 note=excluded.note,
 closed_at=excluded.closed_at,
 updated_at=excluded.updated_at
