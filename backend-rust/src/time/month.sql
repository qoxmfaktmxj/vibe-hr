SELECT jsonb_build_object('id',c.id,'year',$1::int,'month',m,'close_status',coalesce(c.close_status,'open'),
 'employee_count',coalesce(c.employee_count,0),
 'present_days',coalesce(c.present_days,0),
 'absent_days',coalesce(c.absent_days,0),
 'late_days',coalesce(c.late_days,0),
 'total_overtime_minutes',coalesce(c.total_overtime_minutes,0),
 'total_night_minutes',coalesce(c.total_night_minutes,0),
 'total_holiday_work_minutes',coalesce(c.total_holiday_work_minutes,0),
 'total_holiday_overtime_minutes',coalesce(c.total_holiday_overtime_minutes,0),
 'total_holiday_night_minutes',coalesce(c.total_holiday_night_minutes,0),
 'leave_days',coalesce(c.leave_days+c.half_day_count/2.0,0),
 'closed_by',c.closed_by,'closed_by_name',closer.display_name,'reopened_by',c.reopened_by,'reopened_by_name',opener.display_name,'note',c.note,
 'closed_at',(to_jsonb(c.closed_at)#>>'{}')||'Z',
 'reopened_at',(to_jsonb(c.reopened_at)#>>'{}')||'Z',
 'created_at',(to_jsonb(c.created_at)#>>'{}')||'Z',
 'updated_at',(to_jsonb(c.updated_at)#>>'{}')||'Z')
FROM generate_series(1,12) AS m
LEFT JOIN tim_month_closes c ON c.year=$1 AND c.month=m
LEFT JOIN auth_users closer ON closer.id=c.closed_by LEFT JOIN auth_users opener ON opener.id=c.reopened_by
WHERE ($2::int IS NULL OR m=$2) ORDER BY m
