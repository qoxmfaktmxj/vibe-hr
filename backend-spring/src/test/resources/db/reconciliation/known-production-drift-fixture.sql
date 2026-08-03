CREATE TEMP TABLE fixture_inbound_fks ON COMMIT DROP AS
WITH targets AS (
    SELECT unnest(ARRAY[
        'public.hri_approval_actor_rules'::regclass,
        'public.org_departments'::regclass,
        'public.tim_attendance_daily'::regclass,
        'public.tim_leave_requests'::regclass,
        'public.wel_benefit_requests'::regclass
    ]) AS oid
)
SELECT conrelid::regclass::text AS source_table, conname AS constraint_name,
       pg_get_constraintdef(pg_constraint.oid, true) AS definition
FROM pg_constraint
WHERE contype = 'f' AND confrelid IN (SELECT oid FROM targets)
  AND conrelid NOT IN (SELECT oid FROM targets);

CREATE SCHEMA fixture_v1;
ALTER TABLE public.hri_approval_actor_rules SET SCHEMA fixture_v1;
ALTER TABLE public.org_departments SET SCHEMA fixture_v1;
ALTER TABLE public.tim_attendance_daily SET SCHEMA fixture_v1;
ALTER TABLE public.tim_leave_requests SET SCHEMA fixture_v1;
ALTER TABLE public.wel_benefit_requests SET SCHEMA fixture_v1;

CREATE TABLE public.hri_approval_actor_rules (
    id SERIAL NOT NULL PRIMARY KEY,
    role_code VARCHAR(30) NOT NULL,
    resolve_method VARCHAR(30) NOT NULL,
    fallback_rule VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT ck_hri_approval_actor_rules_fallback_rule CHECK (fallback_rule IN ('ESCALATE', 'SKIP', 'HR_ADMIN')),
    CONSTRAINT ck_hri_approval_actor_rules_resolve_method CHECK (resolve_method IN ('ORG_CHAIN', 'JOB_POSITION', 'FIXED_USER')),
    CONSTRAINT uq_hri_approval_actor_rules_role_code UNIQUE (role_code)
);
ALTER TABLE public.hri_approval_actor_rules ALTER COLUMN resolve_method TYPE TEXT;
ALTER TABLE public.hri_approval_actor_rules ALTER COLUMN resolve_method TYPE VARCHAR(30);
ALTER TABLE public.hri_approval_actor_rules ALTER COLUMN fallback_rule TYPE TEXT;
ALTER TABLE public.hri_approval_actor_rules ALTER COLUMN fallback_rule TYPE VARCHAR(30);
ALTER TABLE public.hri_approval_actor_rules ADD COLUMN position_keywords_json TEXT;
CREATE INDEX ix_hri_approval_actor_rules_role_code ON public.hri_approval_actor_rules (role_code);

CREATE TABLE public.org_departments (
    id SERIAL NOT NULL PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES public.org_departments(id),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    organization_type VARCHAR(50),
    cost_center_code VARCHAR(30),
    description VARCHAR(500)
);
CREATE UNIQUE INDEX ix_org_departments_code ON public.org_departments (code);

CREATE SEQUENCE public.hr_attendance_daily_id_seq AS INTEGER;
CREATE TABLE public.tim_attendance_daily (
    id INTEGER DEFAULT nextval('public.hr_attendance_daily_id_seq') NOT NULL,
    employee_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    check_in_at TIMESTAMP WITHOUT TIME ZONE,
    check_out_at TIMESTAMP WITHOUT TIME ZONE,
    attendance_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    actual_minutes INTEGER DEFAULT 0 NOT NULL,
    regular_minutes INTEGER DEFAULT 0 NOT NULL,
    overtime_minutes INTEGER DEFAULT 0 NOT NULL,
    night_minutes INTEGER DEFAULT 0 NOT NULL,
    holiday_work_minutes INTEGER DEFAULT 0 NOT NULL,
    holiday_overtime_minutes INTEGER DEFAULT 0 NOT NULL,
    holiday_night_minutes INTEGER DEFAULT 0 NOT NULL,
    is_holiday_work BOOLEAN DEFAULT false NOT NULL,
    calculated_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT hr_attendance_daily_pkey PRIMARY KEY (id),
    CONSTRAINT ck_hr_attendance_daily_attendance_status CHECK (attendance_status IN ('present', 'late', 'absent', 'leave', 'remote')),
    CONSTRAINT hr_attendance_daily_employee_id_fkey FOREIGN KEY(employee_id) REFERENCES public.hr_employees(id),
    CONSTRAINT uq_hr_attendance_daily_employee_work_date UNIQUE(employee_id, work_date)
);
ALTER SEQUENCE public.hr_attendance_daily_id_seq OWNED BY public.tim_attendance_daily.id;
ALTER TABLE public.tim_attendance_daily ALTER COLUMN attendance_status TYPE TEXT;
ALTER TABLE public.tim_attendance_daily ALTER COLUMN attendance_status TYPE VARCHAR(20);
CREATE INDEX ix_hr_attendance_daily_work_date ON public.tim_attendance_daily(work_date);

CREATE SEQUENCE public.hr_leave_requests_id_seq AS INTEGER;
CREATE TABLE public.tim_leave_requests (
    id INTEGER DEFAULT nextval('public.hr_leave_requests_id_seq') NOT NULL,
    employee_id INTEGER NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR,
    request_status VARCHAR(20) NOT NULL,
    approver_employee_id INTEGER,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    decision_comment VARCHAR(1000),
    decided_by INTEGER,
    decided_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT hr_leave_requests_pkey PRIMARY KEY(id),
    CONSTRAINT ck_hr_leave_requests_date_range CHECK(start_date <= end_date),
    CONSTRAINT ck_hr_leave_requests_leave_type CHECK(leave_type IN ('annual', 'sick', 'half_day', 'unpaid', 'other')),
    CONSTRAINT ck_hr_leave_requests_request_status CHECK(request_status IN ('pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT hr_leave_requests_approver_employee_id_fkey FOREIGN KEY(approver_employee_id) REFERENCES public.hr_employees(id),
    CONSTRAINT hr_leave_requests_employee_id_fkey FOREIGN KEY(employee_id) REFERENCES public.hr_employees(id)
);
ALTER SEQUENCE public.hr_leave_requests_id_seq OWNED BY public.tim_leave_requests.id;
ALTER TABLE public.tim_leave_requests ALTER COLUMN leave_type TYPE TEXT;
ALTER TABLE public.tim_leave_requests ALTER COLUMN leave_type TYPE VARCHAR(20);
ALTER TABLE public.tim_leave_requests ALTER COLUMN request_status TYPE TEXT;
ALTER TABLE public.tim_leave_requests ALTER COLUMN request_status TYPE VARCHAR(20);

CREATE TABLE public.wel_benefit_requests (
    id SERIAL NOT NULL PRIMARY KEY,
    request_no VARCHAR(40) NOT NULL,
    benefit_type_code VARCHAR(40) NOT NULL,
    benefit_type_name VARCHAR(100) NOT NULL,
    employee_no VARCHAR(40) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    department_name VARCHAR(120) NOT NULL,
    status_code VARCHAR(30) NOT NULL,
    requested_amount INTEGER NOT NULL,
    approved_amount INTEGER,
    payroll_run_label VARCHAR(120),
    description VARCHAR(500),
    requested_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    employee_id INTEGER REFERENCES public.hr_employees(id),
    CONSTRAINT uq_wel_benefit_requests_request_no UNIQUE(request_no)
);
CREATE INDEX ix_wel_benefit_requests_benefit_type_code ON public.wel_benefit_requests(benefit_type_code);
CREATE INDEX ix_wel_benefit_requests_employee_id ON public.wel_benefit_requests(employee_id);
CREATE INDEX ix_wel_benefit_requests_employee_no ON public.wel_benefit_requests(employee_no);
CREATE INDEX ix_wel_benefit_requests_request_no ON public.wel_benefit_requests(request_no);
CREATE INDEX ix_wel_benefit_requests_status_code ON public.wel_benefit_requests(status_code);

DO $$
DECLARE item record;
BEGIN
    FOR item IN SELECT * FROM fixture_inbound_fks ORDER BY source_table, constraint_name LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.source_table, item.constraint_name);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', item.source_table, item.constraint_name, item.definition);
    END LOOP;
END $$;

-- Reproduce parse trees retained when production TEXT columns were narrowed to VARCHAR.
ALTER TABLE public.hr_appointment_order_items ALTER COLUMN apply_status TYPE TEXT;
ALTER TABLE public.hr_appointment_order_items ALTER COLUMN apply_status TYPE VARCHAR(20);
ALTER TABLE public.hr_appointment_order_items ALTER COLUMN appointment_kind TYPE TEXT;
ALTER TABLE public.hr_appointment_order_items ALTER COLUMN appointment_kind TYPE VARCHAR(20);
ALTER TABLE public.hr_appointment_orders ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.hr_appointment_orders ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.hr_careers ALTER COLUMN career_scope TYPE TEXT;
ALTER TABLE public.hr_careers ALTER COLUMN career_scope TYPE VARCHAR(20);
ALTER TABLE public.hr_employees ALTER COLUMN employment_status TYPE TEXT;
ALTER TABLE public.hr_employees ALTER COLUMN employment_status TYPE VARCHAR(20);
ALTER TABLE public.hr_recruit_finalists ALTER COLUMN hire_type TYPE TEXT;
ALTER TABLE public.hr_recruit_finalists ALTER COLUMN hire_type TYPE VARCHAR(20);
ALTER TABLE public.hr_recruit_finalists ALTER COLUMN source_type TYPE TEXT;
ALTER TABLE public.hr_recruit_finalists ALTER COLUMN source_type TYPE VARCHAR(20);
ALTER TABLE public.hr_recruit_finalists ALTER COLUMN status_code TYPE TEXT;
ALTER TABLE public.hr_recruit_finalists ALTER COLUMN status_code TYPE VARCHAR(20);
ALTER TABLE public.hr_retire_cases ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.hr_retire_cases ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.hr_reward_punish ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.hr_reward_punish ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.hr_reward_punish ALTER COLUMN reward_punish_type TYPE TEXT;
ALTER TABLE public.hr_reward_punish ALTER COLUMN reward_punish_type TYPE VARCHAR(20);
ALTER TABLE public.hr_severance_calcs ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.hr_severance_calcs ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.hri_approval_line_steps ALTER COLUMN actor_resolve_type TYPE TEXT;
ALTER TABLE public.hri_approval_line_steps ALTER COLUMN actor_resolve_type TYPE VARCHAR(30);
ALTER TABLE public.hri_approval_line_steps ALTER COLUMN required_action TYPE TEXT;
ALTER TABLE public.hri_approval_line_steps ALTER COLUMN required_action TYPE VARCHAR(20);
ALTER TABLE public.hri_approval_line_steps ALTER COLUMN step_type TYPE TEXT;
ALTER TABLE public.hri_approval_line_steps ALTER COLUMN step_type TYPE VARCHAR(20);
ALTER TABLE public.hri_approval_line_templates ALTER COLUMN scope_type TYPE TEXT;
ALTER TABLE public.hri_approval_line_templates ALTER COLUMN scope_type TYPE VARCHAR(20);
ALTER TABLE public.hri_request_masters ALTER COLUMN status_code TYPE TEXT;
ALTER TABLE public.hri_request_masters ALTER COLUMN status_code TYPE VARCHAR(30);
ALTER TABLE public.hri_request_step_snapshots ALTER COLUMN action_status TYPE TEXT;
ALTER TABLE public.hri_request_step_snapshots ALTER COLUMN action_status TYPE VARCHAR(20);
ALTER TABLE public.hri_request_step_snapshots ALTER COLUMN step_type TYPE TEXT;
ALTER TABLE public.hri_request_step_snapshots ALTER COLUMN step_type TYPE VARCHAR(20);
ALTER TABLE public.org_restructure_plan_items ALTER COLUMN action_type TYPE TEXT;
ALTER TABLE public.org_restructure_plan_items ALTER COLUMN action_type TYPE VARCHAR(20);
ALTER TABLE public.org_restructure_plan_items ALTER COLUMN item_status TYPE TEXT;
ALTER TABLE public.org_restructure_plan_items ALTER COLUMN item_status TYPE VARCHAR(20);
ALTER TABLE public.org_restructure_plans ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.org_restructure_plans ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.pap_appraisal_targets ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.pap_appraisal_targets ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.pay_severance_item_rules ALTER COLUMN include_type TYPE TEXT;
ALTER TABLE public.pay_severance_item_rules ALTER COLUMN include_type TYPE VARCHAR(20);
ALTER TABLE public.tim_month_closes ALTER COLUMN close_status TYPE TEXT;
ALTER TABLE public.tim_month_closes ALTER COLUMN close_status TYPE VARCHAR(10);
ALTER TABLE public.tra_applications ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.tra_applications ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.tra_courses ALTER COLUMN in_out_type TYPE TEXT;
ALTER TABLE public.tra_courses ALTER COLUMN in_out_type TYPE VARCHAR(20);
ALTER TABLE public.tra_cyber_uploads ALTER COLUMN confirm_type TYPE TEXT;
ALTER TABLE public.tra_cyber_uploads ALTER COLUMN confirm_type TYPE VARCHAR(1);
ALTER TABLE public.tra_histories ALTER COLUMN confirm_type TYPE TEXT;
ALTER TABLE public.tra_histories ALTER COLUMN confirm_type TYPE VARCHAR(1);
ALTER TABLE public.tra_required_targets ALTER COLUMN completion_status TYPE TEXT;
ALTER TABLE public.tra_required_targets ALTER COLUMN completion_status TYPE VARCHAR(20);

INSERT INTO public.org_departments
    (id, code, name, parent_id, is_active, created_at, updated_at, organization_type, cost_center_code, description)
SELECT department_id,
       CASE department_id
           WHEN 1 THEN 'HQ-HR'
           WHEN 2 THEN 'HQ-ENG'
           WHEN 3 THEN 'HQ-SALES'
           WHEN 4 THEN 'HQ-FIN'
           WHEN 5 THEN 'HQ-OPS'
           ELSE 'ORG-' || lpad((department_id - 5)::text, 4, '0')
       END,
       'fixture-' || department_id,
       NULL,
       true,
       timestamp '2026-08-03 00:00:00',
       timestamp '2026-08-03 00:00:00',
       CASE WHEN department_id <= 5 THEN 'HEADQUARTERS' ELSE 'TEAM' END,
       'C-' || department_id,
       'fixture'
FROM generate_series(1, 50) AS department_id;
INSERT INTO public.tim_schedule_patterns
    (id, code, name, description, is_active, created_at, updated_at)
VALUES (1, 'PTN_DEPT_STD', 'fixture', NULL, true, timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00');
INSERT INTO public.tim_department_schedule_assignments
    (id, department_id, pattern_id, effective_from, effective_to, priority, is_active, created_at, updated_at)
SELECT department_id, department_id, 1, date '2026-01-01', NULL::date, 100, true,
       timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00'
FROM generate_series(1, 50) AS department_id
UNION ALL
SELECT 50 + department_id, department_id, 1, date '2026-03-01', NULL::date,
       100 + (department_id % 3) * 20, true,
       timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00'
FROM generate_series(1, 50) AS department_id;
INSERT INTO public.auth_users
    (id, login_id, email, password_hash, display_name, is_active, created_at, updated_at)
VALUES (9, 'fixture', 'fixture@example.test', 'fixture-only', 'fixture', true, timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00');
INSERT INTO public.hr_employees
    (id, user_id, employee_no, department_id, position_title, hire_date, employment_status, created_at, updated_at)
VALUES (11, 9, 'E-FIXTURE', 7, 'Engineer', date '2026-01-01', 'active', timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00');
INSERT INTO public.hri_approval_actor_rules
    (id, role_code, resolve_method, fallback_rule, is_active, created_at, updated_at, position_keywords_json)
VALUES (13, 'FIXTURE_ROLE', 'FIXED_USER', 'HR_ADMIN', true, timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00', '["Engineer"]');
INSERT INTO public.tim_attendance_daily
    (id, employee_id, work_date, attendance_status, created_at, updated_at)
VALUES (17, 11, date '2026-08-03', 'present', timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00');
INSERT INTO public.tim_leave_requests
    (id, employee_id, leave_type, start_date, end_date, request_status, created_at, updated_at, decision_comment, decided_by, decided_at)
VALUES (19, 11, 'annual', date '2026-08-04', date '2026-08-04', 'approved', timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00', 'ok', 11, timestamptz '2026-08-03 09:00:00+09');
INSERT INTO public.wel_benefit_requests
    (id, request_no, benefit_type_code, benefit_type_name, employee_no, employee_name, department_name, status_code, requested_amount, requested_at, created_at, updated_at, employee_id)
VALUES (23, 'W-FIXTURE', 'FIT', 'fixture', 'E-FIXTURE', 'fixture', 'fixture', 'REQUESTED', 1000, timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00', timestamp '2026-08-03 00:00:00', 11);

SELECT setval('public.hri_approval_actor_rules_id_seq', 13, true);
SELECT setval('public.org_departments_id_seq', 50, true);
SELECT setval('public.tim_schedule_patterns_id_seq', 1, true);
SELECT setval('public.tim_department_schedule_assignments_id_seq', 100, true);
SELECT setval('public.hr_attendance_daily_id_seq', 17, true);
SELECT setval('public.hr_leave_requests_id_seq', 19, true);
SELECT setval('public.wel_benefit_requests_id_seq', 23, true);
