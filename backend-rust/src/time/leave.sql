SELECT jsonb_build_object('id',r.id,'employee_id',r.employee_id,'employee_no',e.employee_no,'employee_name',u.display_name,
 'department_name',d.name,'leave_type',r.leave_type,'start_date',r.start_date,'end_date',r.end_date,
 'calendar_days',r.end_date-r.start_date+1,'deduction_days',days.n,'leave_days',days.n,'reason',r.reason,
 'request_status',r.request_status,'approver_employee_id',r.approver_employee_id,'approved_at',(to_jsonb(r.approved_at)#>>'{}')||'Z',
 'decision_comment',r.decision_comment,'decided_by',r.decided_by,'decided_at',(to_jsonb(r.decided_at)#>>'{}')||'Z','created_at',(to_jsonb(r.created_at)#>>'{}')||'Z')
FROM tim_leave_requests r JOIN hr_employees e ON e.id=r.employee_id JOIN auth_users u ON e.user_id=u.id JOIN org_departments d ON d.id=e.department_id
CROSS JOIN LATERAL (SELECT CASE WHEN r.annual_charge_breakdown IS NOT NULL THEN (SELECT coalesce(sum(value::float8),0) FROM jsonb_each_text(r.annual_charge_breakdown))
 WHEN r.leave_type='unpaid' AND r.request_status='approved' AND r.payroll_minutes_snapshot IS NOT NULL THEN (SELECT count(*) FROM tim_attendance_daily WHERE approved_leave_request_id=r.id)
 WHEN r.leave_type='half_day' THEN 0.5 ELSE (SELECT count(*) FROM generate_series(r.start_date::timestamp,r.end_date::timestamp,interval '1 day') g
 WHERE extract(isodow FROM g)<6 AND NOT EXISTS(SELECT 1 FROM tim_holidays WHERE holiday_date=g::date AND is_active)) END AS n) days
WHERE ($1::int IS NULL OR r.id=$1) AND ($2::int IS NULL OR r.employee_id=$2) AND ($3::text IS NULL OR r.request_status=$3) AND (NOT $4 OR r.request_status='pending')
ORDER BY r.created_at DESC,r.id DESC LIMIT $5 OFFSET $6
