WITH target AS (
 SELECT e.id AS employee_id,e.department_id,d::date AS day
 FROM generate_series($1::date::timestamp,$2::date::timestamp,interval '1 day') d
 CROSS JOIN hr_employees e WHERE ($3 <> 'department' OR e.department_id=$4)
   AND ($3 <> 'employee' OR e.id=ANY($5::int[]))
), assigned AS (
 SELECT t.*,h.name AS holiday_name,
        coalesce(ex.pattern_id,dep.pattern_id,def.id) AS pattern_id,
        CASE WHEN ex.pattern_id IS NOT NULL THEN 'employee_exception' WHEN dep.pattern_id IS NOT NULL THEN 'department_default' ELSE 'company_default' END AS source
 FROM target t
 LEFT JOIN LATERAL (SELECT pattern_id FROM tim_employee_schedule_exceptions
   WHERE employee_id=t.employee_id AND is_active AND effective_from<=t.day AND (effective_to IS NULL OR effective_to>=t.day)
   ORDER BY priority DESC,effective_from DESC,id DESC LIMIT 1) ex ON true
 LEFT JOIN LATERAL (SELECT pattern_id FROM tim_department_schedule_assignments
   WHERE department_id=t.department_id AND is_active AND effective_from<=t.day AND (effective_to IS NULL OR effective_to>=t.day)
   ORDER BY priority DESC,effective_from DESC,id DESC LIMIT 1) dep ON true
 LEFT JOIN (SELECT id FROM tim_schedule_patterns WHERE is_active ORDER BY id LIMIT 1) def ON true
 LEFT JOIN LATERAL (SELECT name FROM tim_holidays WHERE holiday_date=t.day AND is_active LIMIT 1) h ON true
), planned AS (
 SELECT a.*,p.id AS pattern_day,p.start_time,p.end_time,p.break_minutes,p.expected_minutes,p.is_overnight,
   a.holiday_name IS NULL AND coalesce(p.is_workday,extract(isodow FROM day)<6) AS workday,
   s.id AS existing
 FROM assigned a LEFT JOIN tim_schedule_pattern_days p ON p.pattern_id=a.pattern_id AND p.weekday=extract(isodow FROM a.day)-1
 LEFT JOIN tim_employee_daily_schedules s ON s.employee_id=a.employee_id AND s.work_date=a.day
), written AS (
 INSERT INTO tim_employee_daily_schedules(employee_id,work_date,schedule_source,pattern_id,is_holiday,holiday_name,is_workday,
   planned_start_at,planned_end_at,break_minutes,expected_minutes,is_overnight,generated_at,version_tag)
 SELECT employee_id,day,source,pattern_id,holiday_name IS NOT NULL,holiday_name,workday,
   ((day+(CASE WHEN pattern_day IS NULL AND workday THEN '09:00' ELSE start_time END)::time) AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC',
   ((day+(CASE WHEN pattern_day IS NULL AND workday THEN '18:00' ELSE end_time END)::time) AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'UTC',
   coalesce(break_minutes,60),coalesce(expected_minutes,CASE WHEN workday THEN 480 ELSE 0 END),coalesce(is_overnight,false),statement_timestamp() AT TIME ZONE 'UTC',$7
 FROM planned WHERE existing IS NULL OR $6 ORDER BY day,employee_id
 ON CONFLICT(employee_id,work_date) DO UPDATE SET
 schedule_source=excluded.schedule_source, pattern_id=excluded.pattern_id, is_holiday=excluded.is_holiday, holiday_name=excluded.holiday_name, is_workday=excluded.is_workday, planned_start_at=excluded.planned_start_at, planned_end_at=excluded.planned_end_at, break_minutes=excluded.break_minutes, expected_minutes=excluded.expected_minutes, is_overnight=excluded.is_overnight, generated_at=excluded.generated_at, version_tag=excluded.version_tag
 RETURNING employee_id
) SELECT count(*) FILTER (WHERE existing IS NULL),count(*) FILTER(WHERE existing IS NOT NULL AND $6),count(*) FILTER(WHERE existing IS NOT NULL AND NOT $6) FROM planned
