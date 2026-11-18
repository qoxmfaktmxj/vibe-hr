SELECT jsonb_build_object('employee_id',$1::int,'work_date',$2::date,
 'day_type',CASE WHEN coalesce(s.is_holiday,h.name IS NOT NULL) THEN 'holiday' WHEN coalesce(s.is_workday,extract(isodow FROM $2::date)<6) THEN 'workday' ELSE 'weekend' END,
 'schedule_source',coalesce(s.schedule_source,'company_default'),'pattern_code',coalesce(p.code,f.code,'WS00'),'pattern_name',coalesce(p.name,f.name,'기본근무'),
 'work_start',coalesce(to_char((s.planned_start_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul','HH24:MI'),f.work_start,'09:00'),
 'work_end',coalesce(to_char((s.planned_end_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul','HH24:MI'),f.work_end,'18:00'),
 'break_minutes',coalesce(s.break_minutes,f.break_minutes,60),'expected_minutes',coalesce(s.expected_minutes,trunc(f.work_hours*60)::int,480),
 'is_holiday',coalesce(s.is_holiday,h.name IS NOT NULL),'holiday_name',CASE WHEN s.id IS NULL THEN h.name ELSE s.holiday_name END,
 'generated_at',(to_jsonb(s.generated_at)#>>'{}')||'Z')
FROM (SELECT 1) singleton
LEFT JOIN tim_employee_daily_schedules s ON s.employee_id=$1 AND s.work_date=$2
LEFT JOIN tim_schedule_patterns p ON p.id=s.pattern_id
LEFT JOIN LATERAL (SELECT name FROM tim_holidays WHERE holiday_date=$2 AND is_active LIMIT 1) h ON true
LEFT JOIN (SELECT * FROM tim_work_schedule_codes WHERE is_active ORDER BY sort_order,id LIMIT 1) f ON true
