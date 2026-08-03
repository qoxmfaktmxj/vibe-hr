DO $$
BEGIN
    IF current_setting('vibehr.reconciliation_confirmation', true)
            IS DISTINCT FROM 'reconcile-known-production-drift-20260803' THEN
        RAISE EXCEPTION 'Missing exact pre-adoption reconciliation confirmation.';
    END IF;
    IF current_setting('vibehr.reconciliation_expected_source_fingerprint', true)
            IS DISTINCT FROM 'e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1' THEN
        RAISE EXCEPTION 'Missing exact reviewed source fingerprint.';
    END IF;
    IF current_schema() <> 'public' THEN
        RAISE EXCEPTION 'Reconciliation requires current_schema()=public.';
    END IF;
    IF to_regclass('public.flyway_schema_history') IS NOT NULL THEN
        RAISE EXCEPTION 'Reconciliation is forbidden after Flyway history exists.';
    END IF;
    IF (SELECT count(*) FROM public.alembic_version
        WHERE version_num = 'org_mapping_foundation_20260722') <> 1
       OR (SELECT count(*) FROM public.alembic_version) <> 1 THEN
        RAISE EXCEPTION 'Unexpected Alembic head.';
    END IF;
    IF to_regnamespace('vibehr_pre_adoption_20260803') IS NOT NULL THEN
        RAISE EXCEPTION 'Archive schema already exists.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.hri_approval_actor_rules
               WHERE resolve_method NOT IN ('ORG_CHAIN', 'JOB_POSITION', 'FIXED_USER')
                  OR fallback_rule NOT IN ('ESCALATE', 'SKIP', 'HR_ADMIN')) THEN
        RAISE EXCEPTION 'HRI actor rule violates the V1 check contract.';
    END IF;
    IF EXISTS (SELECT role_code FROM public.hri_approval_actor_rules GROUP BY role_code HAVING count(*) > 1)
       OR EXISTS (SELECT code FROM public.org_departments GROUP BY code HAVING count(*) > 1)
       OR EXISTS (SELECT employee_id, work_date FROM public.tim_attendance_daily GROUP BY employee_id, work_date HAVING count(*) > 1)
       OR EXISTS (SELECT request_no FROM public.wel_benefit_requests GROUP BY request_no HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Duplicate key would violate a V1 unique contract.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tim_attendance_daily
               WHERE attendance_status NOT IN ('present', 'late', 'absent', 'leave', 'remote'))
       OR EXISTS (SELECT 1 FROM public.tim_leave_requests
                  WHERE leave_type NOT IN ('annual', 'sick', 'half_day', 'unpaid', 'other')
                     OR request_status NOT IN ('pending', 'approved', 'rejected', 'cancelled')
                     OR start_date > end_date) THEN
        RAISE EXCEPTION 'TIM data violates a V1 check contract.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.org_departments d LEFT JOIN public.org_departments p ON p.id = d.parent_id
               WHERE d.parent_id IS NOT NULL AND p.id IS NULL)
       OR EXISTS (SELECT 1 FROM public.tim_attendance_daily a LEFT JOIN public.hr_employees e ON e.id = a.employee_id WHERE e.id IS NULL)
       OR EXISTS (SELECT 1 FROM public.tim_leave_requests r LEFT JOIN public.hr_employees e ON e.id = r.employee_id WHERE e.id IS NULL)
       OR EXISTS (SELECT 1 FROM public.tim_leave_requests r LEFT JOIN public.hr_employees e ON e.id = r.approver_employee_id
                  WHERE r.approver_employee_id IS NOT NULL AND e.id IS NULL)
       OR EXISTS (SELECT 1 FROM public.tim_leave_requests r LEFT JOIN public.hr_employees e ON e.id = r.decided_by
                  WHERE r.decided_by IS NOT NULL AND e.id IS NULL)
       OR EXISTS (SELECT 1 FROM public.wel_benefit_requests r LEFT JOIN public.hr_employees e ON e.id = r.employee_id
                  WHERE r.employee_id IS NOT NULL AND e.id IS NULL) THEN
        RAISE EXCEPTION 'Foreign-key violation would be introduced by reconciliation.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tim_leave_requests
               WHERE decided_at IS NOT NULL
                 AND ((decided_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') IS DISTINCT FROM decided_at) THEN
        RAISE EXCEPTION 'decided_at cannot be losslessly normalized to UTC timestamp.';
    END IF;
END $$;

CREATE TEMP TABLE vibehr_reconciliation_inbound_fks ON COMMIT DROP AS
WITH targets AS (
    SELECT unnest(ARRAY[
        'public.hri_approval_actor_rules'::regclass,
        'public.org_departments'::regclass,
        'public.tim_attendance_daily'::regclass,
        'public.tim_leave_requests'::regclass,
        'public.wel_benefit_requests'::regclass
    ]) AS oid
)
SELECT conrelid::regclass::text AS source_table,
       conname AS constraint_name,
       pg_get_constraintdef(pg_constraint.oid, true) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid IN (SELECT oid FROM targets)
  AND conrelid NOT IN (SELECT oid FROM targets);

CREATE SCHEMA vibehr_pre_adoption_20260803;

ALTER TABLE public.hri_approval_actor_rules SET SCHEMA vibehr_pre_adoption_20260803;
ALTER TABLE public.org_departments SET SCHEMA vibehr_pre_adoption_20260803;
ALTER TABLE public.tim_attendance_daily SET SCHEMA vibehr_pre_adoption_20260803;
ALTER TABLE public.tim_leave_requests SET SCHEMA vibehr_pre_adoption_20260803;
ALTER TABLE public.wel_benefit_requests SET SCHEMA vibehr_pre_adoption_20260803;

CREATE TABLE public.hri_approval_actor_rules (
    id SERIAL NOT NULL,
    role_code VARCHAR(30) NOT NULL,
    resolve_method VARCHAR(30) NOT NULL,
    fallback_rule VARCHAR(30) NOT NULL,
    position_keywords_json VARCHAR,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hri_approval_actor_rules_fallback_rule CHECK (fallback_rule IN ('ESCALATE', 'SKIP', 'HR_ADMIN')),
    CONSTRAINT ck_hri_approval_actor_rules_resolve_method CHECK (resolve_method IN ('ORG_CHAIN', 'JOB_POSITION', 'FIXED_USER')),
    CONSTRAINT uq_hri_approval_actor_rules_role_code UNIQUE (role_code)
);
CREATE INDEX ix_hri_approval_actor_rules_role_code ON public.hri_approval_actor_rules (role_code);

CREATE TABLE public.org_departments (
    id SERIAL NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER,
    organization_type VARCHAR(50),
    cost_center_code VARCHAR(30),
    description VARCHAR(500),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_org_departments_code ON public.org_departments (code);

CREATE TABLE public.tim_attendance_daily (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    check_in_at TIMESTAMP WITHOUT TIME ZONE,
    check_out_at TIMESTAMP WITHOUT TIME ZONE,
    attendance_status VARCHAR(20) NOT NULL,
    actual_minutes INTEGER NOT NULL,
    regular_minutes INTEGER NOT NULL,
    overtime_minutes INTEGER NOT NULL,
    night_minutes INTEGER NOT NULL,
    holiday_work_minutes INTEGER NOT NULL,
    holiday_overtime_minutes INTEGER NOT NULL,
    holiday_night_minutes INTEGER NOT NULL,
    is_holiday_work BOOLEAN NOT NULL,
    calculated_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_attendance_daily_attendance_status CHECK (attendance_status IN ('present', 'late', 'absent', 'leave', 'remote')),
    FOREIGN KEY(employee_id) REFERENCES public.hr_employees (id),
    CONSTRAINT uq_hr_attendance_daily_employee_work_date UNIQUE (employee_id, work_date)
);
CREATE INDEX ix_tim_attendance_daily_date_status ON public.tim_attendance_daily (work_date, attendance_status);
CREATE INDEX ix_tim_attendance_daily_emp_date ON public.tim_attendance_daily (employee_id, work_date);
CREATE INDEX ix_tim_attendance_daily_work_date ON public.tim_attendance_daily (work_date);

CREATE TABLE public.tim_leave_requests (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR,
    request_status VARCHAR(20) NOT NULL,
    approver_employee_id INTEGER,
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    decision_comment VARCHAR,
    decided_by INTEGER,
    decided_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_leave_requests_leave_type CHECK (leave_type IN ('annual', 'sick', 'half_day', 'unpaid', 'other')),
    CONSTRAINT ck_hr_leave_requests_request_status CHECK (request_status IN ('pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT ck_hr_leave_requests_date_range CHECK (start_date <= end_date),
    FOREIGN KEY(approver_employee_id) REFERENCES public.hr_employees (id),
    FOREIGN KEY(decided_by) REFERENCES public.hr_employees (id),
    FOREIGN KEY(employee_id) REFERENCES public.hr_employees (id)
);
CREATE INDEX ix_tim_leave_requests_dates ON public.tim_leave_requests (start_date, end_date);
CREATE INDEX ix_tim_leave_requests_emp_status ON public.tim_leave_requests (employee_id, request_status);

CREATE TABLE public.wel_benefit_requests (
    id SERIAL NOT NULL,
    request_no VARCHAR(40) NOT NULL,
    benefit_type_code VARCHAR(40) NOT NULL,
    benefit_type_name VARCHAR(100) NOT NULL,
    employee_id INTEGER,
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
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES public.hr_employees (id),
    CONSTRAINT uq_wel_benefit_requests_request_no UNIQUE (request_no)
);
CREATE INDEX ix_wel_benefit_requests_benefit_type_code ON public.wel_benefit_requests (benefit_type_code);
CREATE INDEX ix_wel_benefit_requests_employee_id ON public.wel_benefit_requests (employee_id);
CREATE INDEX ix_wel_benefit_requests_employee_no ON public.wel_benefit_requests (employee_no);
CREATE INDEX ix_wel_benefit_requests_request_no ON public.wel_benefit_requests (request_no);
CREATE INDEX ix_wel_benefit_requests_status_code ON public.wel_benefit_requests (status_code);

INSERT INTO public.hri_approval_actor_rules
SELECT id, role_code, resolve_method, fallback_rule, position_keywords_json::varchar,
       is_active, created_at, updated_at
FROM vibehr_pre_adoption_20260803.hri_approval_actor_rules ORDER BY id;

INSERT INTO public.org_departments
SELECT id, code, name, parent_id, organization_type, cost_center_code, description,
       is_active, created_at, updated_at
FROM vibehr_pre_adoption_20260803.org_departments ORDER BY id;

ALTER TABLE public.org_departments
    ADD FOREIGN KEY(parent_id) REFERENCES public.org_departments (id);

INSERT INTO public.tim_attendance_daily
SELECT id, employee_id, work_date, check_in_at, check_out_at, attendance_status,
       actual_minutes, regular_minutes, overtime_minutes, night_minutes,
       holiday_work_minutes, holiday_overtime_minutes, holiday_night_minutes,
       is_holiday_work, calculated_at, created_at, updated_at
FROM vibehr_pre_adoption_20260803.tim_attendance_daily ORDER BY id;

INSERT INTO public.tim_leave_requests
SELECT id, employee_id, leave_type, start_date, end_date, reason, request_status,
       approver_employee_id, approved_at, decision_comment::varchar, decided_by,
       decided_at AT TIME ZONE 'UTC', created_at, updated_at
FROM vibehr_pre_adoption_20260803.tim_leave_requests ORDER BY id;

INSERT INTO public.wel_benefit_requests
SELECT id, request_no, benefit_type_code, benefit_type_name, employee_id, employee_no,
       employee_name, department_name, status_code, requested_amount, approved_amount,
       payroll_run_label, description, requested_at, approved_at, created_at, updated_at
FROM vibehr_pre_adoption_20260803.wel_benefit_requests ORDER BY id;

SELECT setval('public.hri_approval_actor_rules_id_seq',
              greatest(coalesce((SELECT max(id) FROM public.hri_approval_actor_rules), 1), 1),
              EXISTS (SELECT 1 FROM public.hri_approval_actor_rules));
SELECT setval('public.org_departments_id_seq',
              greatest(coalesce((SELECT max(id) FROM public.org_departments), 1), 1),
              EXISTS (SELECT 1 FROM public.org_departments));
SELECT setval('public.tim_attendance_daily_id_seq',
              greatest(coalesce((SELECT max(id) FROM public.tim_attendance_daily), 1), 1),
              EXISTS (SELECT 1 FROM public.tim_attendance_daily));
SELECT setval('public.tim_leave_requests_id_seq',
              greatest(coalesce((SELECT max(id) FROM public.tim_leave_requests), 1), 1),
              EXISTS (SELECT 1 FROM public.tim_leave_requests));
SELECT setval('public.wel_benefit_requests_id_seq',
              greatest(coalesce((SELECT max(id) FROM public.wel_benefit_requests), 1), 1),
              EXISTS (SELECT 1 FROM public.wel_benefit_requests));

DO $$
DECLARE
    item record;
BEGIN
    FOR item IN SELECT * FROM vibehr_reconciliation_inbound_fks ORDER BY source_table, constraint_name LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.source_table, item.constraint_name);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', item.source_table, item.constraint_name, item.definition);
    END LOOP;
END $$;

-- These CHECK constraints are semantically unchanged. They were originally created on
-- TEXT columns and retained a rewritten parse tree after those columns became VARCHAR.
-- Recreating them on the reviewed current types restores the frozen V1 catalog form.
ALTER TABLE public.hr_appointment_order_items DROP CONSTRAINT ck_hr_appointment_order_items_apply_status;
ALTER TABLE public.hr_appointment_order_items ADD CONSTRAINT ck_hr_appointment_order_items_apply_status CHECK (apply_status IN ('pending', 'applied', 'cancelled'));
ALTER TABLE public.hr_appointment_order_items DROP CONSTRAINT ck_hr_appointment_order_items_kind;
ALTER TABLE public.hr_appointment_order_items ADD CONSTRAINT ck_hr_appointment_order_items_kind CHECK (appointment_kind IN ('permanent', 'temporary'));
ALTER TABLE public.hr_appointment_orders DROP CONSTRAINT ck_hr_appointment_orders_status;
ALTER TABLE public.hr_appointment_orders ADD CONSTRAINT ck_hr_appointment_orders_status CHECK (status IN ('draft', 'confirmed', 'cancelled'));
ALTER TABLE public.hr_careers DROP CONSTRAINT ck_hr_careers_scope;
ALTER TABLE public.hr_careers ADD CONSTRAINT ck_hr_careers_scope CHECK (career_scope IN ('INTERNAL', 'EXTERNAL'));
ALTER TABLE public.hr_employees DROP CONSTRAINT ck_hr_employees_employment_status;
ALTER TABLE public.hr_employees ADD CONSTRAINT ck_hr_employees_employment_status CHECK (employment_status IN ('active', 'leave', 'resigned'));
ALTER TABLE public.hr_recruit_finalists DROP CONSTRAINT ck_hr_recruit_finalists_hire_type;
ALTER TABLE public.hr_recruit_finalists ADD CONSTRAINT ck_hr_recruit_finalists_hire_type CHECK (hire_type IN ('new', 'experienced'));
ALTER TABLE public.hr_recruit_finalists DROP CONSTRAINT ck_hr_recruit_finalists_source_type;
ALTER TABLE public.hr_recruit_finalists ADD CONSTRAINT ck_hr_recruit_finalists_source_type CHECK (source_type IN ('if', 'manual'));
ALTER TABLE public.hr_recruit_finalists DROP CONSTRAINT ck_hr_recruit_finalists_status_code;
ALTER TABLE public.hr_recruit_finalists ADD CONSTRAINT ck_hr_recruit_finalists_status_code CHECK (status_code IN ('draft', 'ready', 'appointed'));
ALTER TABLE public.hr_retire_cases DROP CONSTRAINT ck_hr_retire_cases_status;
ALTER TABLE public.hr_retire_cases ADD CONSTRAINT ck_hr_retire_cases_status CHECK (status IN ('draft', 'confirmed', 'cancelled'));
ALTER TABLE public.hr_reward_punish DROP CONSTRAINT ck_hr_reward_punish_status;
ALTER TABLE public.hr_reward_punish ADD CONSTRAINT ck_hr_reward_punish_status CHECK (status IN ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'CONFIRMED'));
ALTER TABLE public.hr_reward_punish DROP CONSTRAINT ck_hr_reward_punish_type;
ALTER TABLE public.hr_reward_punish ADD CONSTRAINT ck_hr_reward_punish_type CHECK (reward_punish_type IN ('REWARD', 'PUNISH'));
ALTER TABLE public.hr_severance_calcs DROP CONSTRAINT ck_hr_severance_calcs_status;
ALTER TABLE public.hr_severance_calcs ADD CONSTRAINT ck_hr_severance_calcs_status CHECK (status IN ('draft', 'reviewed', 'confirmed'));
ALTER TABLE public.hri_approval_line_steps DROP CONSTRAINT ck_hri_approval_line_steps_actor_resolve_type;
ALTER TABLE public.hri_approval_line_steps ADD CONSTRAINT ck_hri_approval_line_steps_actor_resolve_type CHECK (actor_resolve_type IN ('ROLE_BASED', 'USER_FIXED'));
ALTER TABLE public.hri_approval_line_steps DROP CONSTRAINT ck_hri_approval_line_steps_required_action;
ALTER TABLE public.hri_approval_line_steps ADD CONSTRAINT ck_hri_approval_line_steps_required_action CHECK (required_action IN ('APPROVE', 'RECEIVE'));
ALTER TABLE public.hri_approval_line_steps DROP CONSTRAINT ck_hri_approval_line_steps_step_type;
ALTER TABLE public.hri_approval_line_steps ADD CONSTRAINT ck_hri_approval_line_steps_step_type CHECK (step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE'));
ALTER TABLE public.hri_approval_line_templates DROP CONSTRAINT ck_hri_approval_line_templates_scope_type;
ALTER TABLE public.hri_approval_line_templates ADD CONSTRAINT ck_hri_approval_line_templates_scope_type CHECK (scope_type IN ('GLOBAL', 'COMPANY', 'DEPT', 'TEAM', 'USER'));
ALTER TABLE public.hri_request_masters DROP CONSTRAINT ck_hri_request_masters_status_code;
ALTER TABLE public.hri_request_masters ADD CONSTRAINT ck_hri_request_masters_status_code CHECK (status_code IN ('DRAFT', 'APPROVAL_IN_PROGRESS', 'APPROVAL_REJECTED', 'RECEIVE_IN_PROGRESS', 'RECEIVE_REJECTED', 'COMPLETED', 'WITHDRAWN'));
ALTER TABLE public.hri_request_step_snapshots DROP CONSTRAINT ck_hri_request_step_snapshots_action_status;
ALTER TABLE public.hri_request_step_snapshots ADD CONSTRAINT ck_hri_request_step_snapshots_action_status CHECK (action_status IN ('WAITING', 'APPROVED', 'REJECTED', 'RECEIVED'));
ALTER TABLE public.hri_request_step_snapshots DROP CONSTRAINT ck_hri_request_step_snapshots_step_type;
ALTER TABLE public.hri_request_step_snapshots ADD CONSTRAINT ck_hri_request_step_snapshots_step_type CHECK (step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE'));
ALTER TABLE public.org_restructure_plan_items DROP CONSTRAINT ck_org_restructure_plan_items_action;
ALTER TABLE public.org_restructure_plan_items ADD CONSTRAINT ck_org_restructure_plan_items_action CHECK (action_type IN ('move', 'rename', 'create', 'deactivate', 'reactivate'));
ALTER TABLE public.org_restructure_plan_items DROP CONSTRAINT ck_org_restructure_plan_items_status;
ALTER TABLE public.org_restructure_plan_items ADD CONSTRAINT ck_org_restructure_plan_items_status CHECK (item_status IN ('pending', 'applied', 'skipped'));
ALTER TABLE public.org_restructure_plans DROP CONSTRAINT ck_org_restructure_plans_status;
ALTER TABLE public.org_restructure_plans ADD CONSTRAINT ck_org_restructure_plans_status CHECK (status IN ('draft', 'reviewing', 'applied', 'cancelled'));
ALTER TABLE public.pap_appraisal_targets DROP CONSTRAINT ck_pap_appraisal_targets_status;
ALTER TABLE public.pap_appraisal_targets ADD CONSTRAINT ck_pap_appraisal_targets_status CHECK (status IN ('pending', 'evaluated', 'finalized'));
ALTER TABLE public.pay_severance_item_rules DROP CONSTRAINT ck_pay_severance_item_rules_include_type;
ALTER TABLE public.pay_severance_item_rules ADD CONSTRAINT ck_pay_severance_item_rules_include_type CHECK (include_type IN ('full', 'prorate_12', 'exclude'));
ALTER TABLE public.tim_month_closes DROP CONSTRAINT ck_tim_month_closes_status;
ALTER TABLE public.tim_month_closes ADD CONSTRAINT ck_tim_month_closes_status CHECK (close_status IN ('open', 'closed'));
ALTER TABLE public.tra_applications DROP CONSTRAINT ck_tra_applications_status;
ALTER TABLE public.tra_applications ADD CONSTRAINT ck_tra_applications_status CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'canceled'));
ALTER TABLE public.tra_courses DROP CONSTRAINT ck_tra_courses_in_out_type;
ALTER TABLE public.tra_courses ADD CONSTRAINT ck_tra_courses_in_out_type CHECK (in_out_type IN ('INTERNAL', 'EXTERNAL', 'MIXED'));
ALTER TABLE public.tra_cyber_uploads DROP CONSTRAINT ck_tra_cyber_uploads_confirm_type;
ALTER TABLE public.tra_cyber_uploads ADD CONSTRAINT ck_tra_cyber_uploads_confirm_type CHECK (confirm_type IN ('0', '1'));
ALTER TABLE public.tra_histories DROP CONSTRAINT ck_tra_histories_confirm_type;
ALTER TABLE public.tra_histories ADD CONSTRAINT ck_tra_histories_confirm_type CHECK (confirm_type IN ('0', '1'));
ALTER TABLE public.tra_required_targets DROP CONSTRAINT ck_tra_required_targets_completion_status;
ALTER TABLE public.tra_required_targets ADD CONSTRAINT ck_tra_required_targets_completion_status CHECK (completion_status IN ('pending', 'completed', 'exempt'));

SET CONSTRAINTS ALL IMMEDIATE;
