alter table tim_attendance_daily
    add column approved_leave_request_id integer,
    add column leave_base_status varchar(20),
    add column leave_generated boolean not null default false,
    add constraint fk_tim_attendance_approved_leave
        foreign key (approved_leave_request_id) references tim_leave_requests(id);

alter table tim_leave_requests
    add column payroll_minutes_snapshot jsonb;

alter table tim_month_closes
    add column half_day_count integer not null default 0;

insert into pay_allowance_deductions
    (code, name, type, tax_type, calculation_type, is_active, sort_order, created_at, updated_at)
values ('TIM_UNPAID', '무급휴가공제', 'deduction', 'tax', 'hourly', true, 900, current_timestamp, current_timestamp);

insert into pay_gl_mappings
    (pay_item_code, gl_account_code, effective_from, note, is_active, created_at, updated_at)
select 'TIM_UNPAID', gl_account_code, date '2000-01-01', '승인 무급휴가 자동 공제', true, current_timestamp, current_timestamp
from pay_gl_mappings
where pay_item_code = 'BSC' and is_active = true and effective_from <= current_date
order by effective_from desc, id desc
limit 1;

do $$
begin
    if not exists (select 1 from pay_gl_mappings where pay_item_code = 'TIM_UNPAID') then
        raise exception 'TIM_UNPAID requires an active base-salary GL mapping';
    end if;
end
$$;
