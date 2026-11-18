SELECT a.id,a.employee_id,e.employee_no,u.display_name AS employee_name,
       d.id AS department_id,d.name AS department_name,a.work_date,
       a.check_in_at AT TIME ZONE 'UTC' AS check_in_at,a.check_out_at AT TIME ZONE 'UTC' AS check_out_at,
       CASE WHEN a.check_in_at IS NOT NULL AND a.check_out_at IS NOT NULL
            THEN greatest(0,trunc(extract(epoch FROM a.check_out_at-a.check_in_at)/60)::int) END AS worked_minutes,
       a.attendance_status,a.actual_minutes,a.regular_minutes,a.overtime_minutes,a.night_minutes,
       a.holiday_work_minutes,a.holiday_overtime_minutes,a.holiday_night_minutes,a.is_holiday_work,r.leave_type AS approved_leave_type
FROM tim_attendance_daily a
JOIN hr_employees e ON e.id=a.employee_id JOIN auth_users u ON u.id=e.user_id JOIN org_departments d ON d.id=e.department_id
LEFT JOIN tim_leave_requests r ON r.id=a.approved_leave_request_id AND r.request_status='approved'
WHERE ($1::int IS NULL OR a.id=$1) AND ($2::int IS NULL OR a.employee_id=$2)
  AND ($3::date IS NULL OR a.work_date >= $3) AND ($4::date IS NULL OR a.work_date <= $4)
  AND ($5::text IS NULL OR $5='' OR a.attendance_status=$5 OR ($5='leave' AND r.leave_type='half_day'))
ORDER BY a.work_date DESC,a.id DESC LIMIT $6 OFFSET $7
