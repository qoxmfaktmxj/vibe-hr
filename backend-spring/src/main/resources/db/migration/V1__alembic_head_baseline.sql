CREATE TABLE "PAP_FINAL_RESULTS" (
    id SERIAL NOT NULL,
    result_code VARCHAR(30) NOT NULL,
    result_name VARCHAR(120) NOT NULL,
    score_grade FLOAT,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_pap_final_results_code UNIQUE (result_code)
);

CREATE INDEX "ix_PAP_FINAL_RESULTS_result_code" ON "PAP_FINAL_RESULTS" (result_code);

CREATE INDEX ix_pap_final_results_active_sort ON "PAP_FINAL_RESULTS" (is_active, sort_order);

CREATE TABLE app_code_groups (
    id SERIAL NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_app_code_groups_code ON app_code_groups (code);

CREATE TABLE app_menus (
    id SERIAL NOT NULL,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER,
    path VARCHAR(200),
    icon VARCHAR(60),
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(parent_id) REFERENCES app_menus (id)
);

CREATE UNIQUE INDEX ix_app_menus_code ON app_menus (code);

CREATE TABLE auth_roles (
    id SERIAL NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(60) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_auth_roles_code ON auth_roles (code);

CREATE TABLE auth_users (
    id SERIAL NOT NULL,
    login_id VARCHAR(50) NOT NULL,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL,
    last_login_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_auth_users_email ON auth_users (email);

CREATE UNIQUE INDEX ix_auth_users_login_id ON auth_users (login_id);

CREATE TABLE hr_recruit_finalists (
    id SERIAL NOT NULL,
    candidate_no VARCHAR(30) NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    external_key VARCHAR(100),
    full_name VARCHAR(100) NOT NULL,
    resident_no_masked VARCHAR(30),
    birth_date DATE,
    phone_mobile VARCHAR(40),
    email VARCHAR(320),
    hire_type VARCHAR(20) NOT NULL,
    career_years INTEGER,
    login_id VARCHAR(50),
    employee_no VARCHAR(30),
    expected_join_date DATE,
    status_code VARCHAR(20) NOT NULL,
    note VARCHAR(500),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_recruit_finalists_hire_type CHECK (hire_type IN ('new', 'experienced')),
    CONSTRAINT ck_hr_recruit_finalists_source_type CHECK (source_type IN ('if', 'manual')),
    CONSTRAINT ck_hr_recruit_finalists_status_code CHECK (status_code IN ('draft', 'ready', 'appointed')),
    CONSTRAINT uq_hr_recruit_finalists_no UNIQUE (candidate_no),
    CONSTRAINT uq_hr_recruit_finalists_external_key UNIQUE (external_key)
);

CREATE INDEX ix_hr_recruit_finalists_candidate_no ON hr_recruit_finalists (candidate_no);

CREATE INDEX ix_hr_recruit_finalists_employee_no ON hr_recruit_finalists (employee_no);

CREATE INDEX ix_hr_recruit_finalists_external_key ON hr_recruit_finalists (external_key);

CREATE INDEX ix_hr_recruit_finalists_status_created ON hr_recruit_finalists (status_code, created_at);

CREATE TABLE hr_retire_checklist_items (
    id SERIAL NOT NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    is_required BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_hr_retire_checklist_items_code UNIQUE (code)
);

CREATE INDEX ix_hr_retire_checklist_items_active_sort ON hr_retire_checklist_items (is_active, sort_order);

CREATE INDEX ix_hr_retire_checklist_items_code ON hr_retire_checklist_items (code);

CREATE TABLE hri_approval_actor_rules (
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

CREATE INDEX ix_hri_approval_actor_rules_role_code ON hri_approval_actor_rules (role_code);

CREATE TABLE hri_approval_line_templates (
    id SERIAL NOT NULL,
    template_code VARCHAR(30) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    scope_type VARCHAR(20) NOT NULL,
    scope_id VARCHAR(40),
    is_default BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    priority INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hri_approval_line_templates_scope_type CHECK (scope_type IN ('GLOBAL', 'COMPANY', 'DEPT', 'TEAM', 'USER')),
    CONSTRAINT uq_hri_approval_line_templates_code UNIQUE (template_code)
);

CREATE INDEX ix_hri_approval_line_templates_scope_id ON hri_approval_line_templates (scope_id);

CREATE INDEX ix_hri_approval_line_templates_template_code ON hri_approval_line_templates (template_code);

CREATE TABLE hri_request_counters (
    counter_key VARCHAR(80) NOT NULL,
    last_seq INTEGER NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (counter_key)
);

CREATE TABLE mng_companies (
    id SERIAL NOT NULL,
    company_code VARCHAR(20) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    company_group_code VARCHAR(20),
    company_type VARCHAR(40),
    management_type VARCHAR(40),
    representative_company VARCHAR(20),
    start_date DATE,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_mng_companies_code UNIQUE (company_code)
);

CREATE INDEX ix_mng_companies_company_code ON mng_companies (company_code);

CREATE TABLE org_corporations (
    id SERIAL NOT NULL,
    enter_cd VARCHAR(20) NOT NULL,
    company_code VARCHAR(20) NOT NULL,
    corporation_name VARCHAR(120) NOT NULL,
    corporation_number VARCHAR(30),
    business_number VARCHAR(30),
    company_seal_url VARCHAR(500),
    certificate_seal_url VARCHAR(500),
    company_logo_url VARCHAR(500),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_org_corporations_company_code UNIQUE (company_code),
    CONSTRAINT uq_org_corporations_enter_cd UNIQUE (enter_cd)
);

CREATE INDEX ix_org_corporations_company_code ON org_corporations (company_code);

CREATE INDEX ix_org_corporations_enter_cd ON org_corporations (enter_cd);

CREATE TABLE org_departments (
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
    PRIMARY KEY (id),
    FOREIGN KEY(parent_id) REFERENCES org_departments (id)
);

CREATE UNIQUE INDEX ix_org_departments_code ON org_departments (code);

CREATE TABLE pay_allowance_deductions (
    id SERIAL NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    tax_type VARCHAR(20) NOT NULL,
    calculation_type VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_pay_allowance_deductions_code UNIQUE (code)
);

CREATE INDEX ix_pay_allowance_deductions_code ON pay_allowance_deductions (code);

CREATE TABLE pay_income_tax_brackets (
    id SERIAL NOT NULL,
    year INTEGER NOT NULL,
    annual_taxable_from INTEGER NOT NULL,
    annual_taxable_to INTEGER,
    tax_rate FLOAT NOT NULL,
    quick_deduction FLOAT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_pay_income_tax_brackets_year_from UNIQUE (year, annual_taxable_from)
);

CREATE INDEX ix_pay_income_tax_brackets_annual_taxable_from ON pay_income_tax_brackets (annual_taxable_from);

CREATE INDEX ix_pay_income_tax_brackets_annual_taxable_to ON pay_income_tax_brackets (annual_taxable_to);

CREATE INDEX ix_pay_income_tax_brackets_year ON pay_income_tax_brackets (year);

CREATE INDEX ix_pay_income_tax_brackets_year_range ON pay_income_tax_brackets (year, annual_taxable_from, annual_taxable_to);

CREATE TABLE pay_item_groups (
    id SERIAL NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(200),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_pay_item_groups_code UNIQUE (code)
);

CREATE INDEX ix_pay_item_groups_code ON pay_item_groups (code);

CREATE TABLE pay_payroll_codes (
    id SERIAL NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    pay_type VARCHAR(20) NOT NULL,
    payment_day VARCHAR(20) NOT NULL,
    tax_deductible BOOLEAN NOT NULL,
    social_ins_deductible BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_pay_payroll_codes_code UNIQUE (code)
);

CREATE INDEX ix_pay_payroll_codes_code ON pay_payroll_codes (code);

CREATE TABLE pay_tax_rates (
    id SERIAL NOT NULL,
    year INTEGER NOT NULL,
    rate_type VARCHAR(50) NOT NULL,
    employee_rate FLOAT,
    employer_rate FLOAT,
    min_limit INTEGER,
    max_limit INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_pay_tax_rates_year_type UNIQUE (year, rate_type)
);

CREATE INDEX ix_pay_tax_rates_year ON pay_tax_rates (year);

CREATE TABLE tim_attendance_codes (
    id SERIAL NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    is_requestable BOOLEAN NOT NULL,
    min_days FLOAT,
    max_days FLOAT,
    deduct_annual BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    description VARCHAR(200),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_tim_attendance_codes_code UNIQUE (code)
);

CREATE INDEX ix_tim_attendance_codes_code ON tim_attendance_codes (code);

CREATE TABLE tim_holidays (
    id SERIAL NOT NULL,
    holiday_date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    holiday_type VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_tim_holidays_date UNIQUE (holiday_date)
);

CREATE INDEX ix_tim_holidays_holiday_date ON tim_holidays (holiday_date);

CREATE TABLE tim_schedule_patterns (
    id SERIAL NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_tim_schedule_patterns_code UNIQUE (code)
);

CREATE INDEX ix_tim_schedule_patterns_code ON tim_schedule_patterns (code);

CREATE TABLE tim_work_schedule_codes (
    id SERIAL NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    work_start VARCHAR(5) NOT NULL,
    work_end VARCHAR(5) NOT NULL,
    break_minutes INTEGER NOT NULL,
    is_overnight BOOLEAN NOT NULL,
    work_hours FLOAT NOT NULL,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    description VARCHAR(200),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_tim_work_schedule_codes_code UNIQUE (code)
);

CREATE INDEX ix_tim_work_schedule_codes_code ON tim_work_schedule_codes (code);

CREATE TABLE tra_elearning_windows (
    id SERIAL NOT NULL,
    year_month VARCHAR(6) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    app_count INTEGER NOT NULL,
    note VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_tra_elearning_windows_year_month UNIQUE (year_month)
);

CREATE INDEX ix_tra_elearning_windows_year_month ON tra_elearning_windows (year_month);

CREATE TABLE tra_organizations (
    id SERIAL NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(200) NOT NULL,
    business_no VARCHAR(40),
    contact_name VARCHAR(100),
    contact_phone VARCHAR(40),
    contact_email VARCHAR(320),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_tra_organizations_code UNIQUE (code)
);

CREATE INDEX ix_tra_organizations_code ON tra_organizations (code);

CREATE TABLE wel_benefit_types (
    id SERIAL NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    module_path VARCHAR(200) NOT NULL,
    is_deduction BOOLEAN NOT NULL,
    pay_item_code VARCHAR(60),
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_wel_benefit_types_code UNIQUE (code),
    CONSTRAINT uq_wel_benefit_types_module_path UNIQUE (module_path)
);

CREATE INDEX ix_wel_benefit_types_code ON wel_benefit_types (code);

CREATE TABLE "PAP_APPRAISAL_MASTERS" (
    id SERIAL NOT NULL,
    appraisal_code VARCHAR(30) NOT NULL,
    appraisal_name VARCHAR(120) NOT NULL,
    appraisal_year INTEGER NOT NULL,
    final_result_id INTEGER,
    appraisal_type VARCHAR(40),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(final_result_id) REFERENCES "PAP_FINAL_RESULTS" (id),
    CONSTRAINT uq_pap_appraisal_masters_year_code UNIQUE (appraisal_year, appraisal_code)
);

CREATE INDEX IF NOT EXISTS "ix_PAP_APPRAISAL_MASTERS_appraisal_code" ON "PAP_APPRAISAL_MASTERS" (appraisal_code);

CREATE INDEX IF NOT EXISTS "ix_PAP_APPRAISAL_MASTERS_appraisal_year" ON "PAP_APPRAISAL_MASTERS" (appraisal_year);

CREATE INDEX ix_pap_appraisal_masters_final_result_id ON "PAP_APPRAISAL_MASTERS" (final_result_id);

CREATE INDEX ix_pap_appraisal_masters_year_active ON "PAP_APPRAISAL_MASTERS" (appraisal_year, is_active);

CREATE TABLE app_codes (
    id SERIAL NOT NULL,
    group_id INTEGER NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    extra_value1 VARCHAR(200),
    extra_value2 VARCHAR(200),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(group_id) REFERENCES app_code_groups (id),
    CONSTRAINT uq_app_codes_group_code UNIQUE (group_id, code)
);

CREATE INDEX ix_app_codes_group_id ON app_codes (group_id);

CREATE TABLE app_menu_actions (
    id SERIAL NOT NULL,
    menu_id INTEGER NOT NULL,
    action_code VARCHAR(40) NOT NULL,
    enabled_default BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(menu_id) REFERENCES app_menus (id),
    CONSTRAINT uq_app_menu_actions_menu_action UNIQUE (menu_id, action_code)
);

CREATE INDEX ix_app_menu_actions_action_code ON app_menu_actions (action_code);

CREATE INDEX ix_app_menu_actions_menu_id ON app_menu_actions (menu_id);

CREATE TABLE app_menu_roles (
    menu_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY (menu_id, role_id),
    FOREIGN KEY(menu_id) REFERENCES app_menus (id),
    FOREIGN KEY(role_id) REFERENCES auth_roles (id)
);

CREATE TABLE app_role_menu_actions (
    id SERIAL NOT NULL,
    role_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    action_code VARCHAR(40) NOT NULL,
    allowed BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(menu_id) REFERENCES app_menus (id),
    FOREIGN KEY(role_id) REFERENCES auth_roles (id),
    CONSTRAINT uq_app_role_menu_actions_role_menu_action UNIQUE (role_id, menu_id, action_code)
);

CREATE INDEX ix_app_role_menu_actions_action_code ON app_role_menu_actions (action_code);

CREATE INDEX ix_app_role_menu_actions_menu_id ON app_role_menu_actions (menu_id);

CREATE INDEX ix_app_role_menu_actions_role_id ON app_role_menu_actions (role_id);

CREATE TABLE app_system_settings (
    id SERIAL NOT NULL,
    key VARCHAR(120) NOT NULL,
    category VARCHAR(50) NOT NULL,
    value_type VARCHAR(20) NOT NULL,
    value_text VARCHAR NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL,
    updated_by INTEGER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_app_system_settings_category ON app_system_settings (category);

CREATE UNIQUE INDEX ix_app_system_settings_key ON app_system_settings (key);

CREATE TABLE auth_user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY(role_id) REFERENCES auth_roles (id),
    FOREIGN KEY(user_id) REFERENCES auth_users (id)
);

CREATE TABLE hr_employees (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    employee_no VARCHAR(30) NOT NULL,
    department_id INTEGER NOT NULL,
    position_title VARCHAR(80) NOT NULL,
    hire_date DATE NOT NULL,
    employment_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_employees_employment_status CHECK (employment_status IN ('active', 'leave', 'resigned')),
    FOREIGN KEY(department_id) REFERENCES org_departments (id),
    FOREIGN KEY(user_id) REFERENCES auth_users (id),
    CONSTRAINT uq_hr_employees_employee_no UNIQUE (employee_no),
    CONSTRAINT uq_hr_employees_user_id UNIQUE (user_id)
);

CREATE INDEX ix_hr_employees_employee_no ON hr_employees (employee_no);

CREATE TABLE hri_approval_line_steps (
    id SERIAL NOT NULL,
    template_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(20) NOT NULL,
    actor_resolve_type VARCHAR(30) NOT NULL,
    actor_role_code VARCHAR(30),
    actor_user_id INTEGER,
    allow_delegate BOOLEAN NOT NULL,
    required_action VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hri_approval_line_steps_actor_resolve_type CHECK (actor_resolve_type IN ('ROLE_BASED', 'USER_FIXED')),
    CONSTRAINT ck_hri_approval_line_steps_required_action CHECK (required_action IN ('APPROVE', 'RECEIVE')),
    CONSTRAINT ck_hri_approval_line_steps_step_type CHECK (step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE')),
    FOREIGN KEY(actor_user_id) REFERENCES auth_users (id),
    FOREIGN KEY(template_id) REFERENCES hri_approval_line_templates (id),
    CONSTRAINT uq_hri_approval_line_steps_order UNIQUE (template_id, step_order)
);

CREATE INDEX ix_hri_approval_line_steps_template_id ON hri_approval_line_steps (template_id);

CREATE TABLE hri_form_types (
    id SERIAL NOT NULL,
    form_code VARCHAR(30) NOT NULL,
    form_name_ko VARCHAR(100) NOT NULL,
    form_name_en VARCHAR(100),
    module_code VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL,
    allow_draft BOOLEAN NOT NULL,
    allow_withdraw BOOLEAN NOT NULL,
    requires_receive BOOLEAN NOT NULL,
    default_priority INTEGER NOT NULL,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id),
    CONSTRAINT uq_hri_form_types_form_code UNIQUE (form_code)
);

CREATE INDEX ix_hri_form_types_form_code ON hri_form_types (form_code);

CREATE TABLE mng_dev_inquiries (
    id SERIAL NOT NULL,
    company_id INTEGER NOT NULL,
    inquiry_content VARCHAR,
    hoped_start_date DATE,
    estimated_man_months FLOAT,
    sales_rep_name VARCHAR(100),
    client_contact_name VARCHAR(100),
    progress_code VARCHAR(20),
    is_confirmed BOOLEAN NOT NULL,
    project_name VARCHAR(200),
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES mng_companies (id)
);

CREATE INDEX ix_mng_dev_inquiries_company_id ON mng_dev_inquiries (company_id);

CREATE TABLE mng_dev_projects (
    id SERIAL NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    company_id INTEGER NOT NULL,
    part_code VARCHAR(20),
    assigned_staff VARCHAR(200),
    contract_start_date DATE,
    contract_end_date DATE,
    dev_start_date DATE,
    dev_end_date DATE,
    inspection_status VARCHAR(20),
    has_tax_bill BOOLEAN NOT NULL,
    actual_man_months FLOAT,
    contract_amount INTEGER,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES mng_companies (id)
);

CREATE INDEX ix_mng_dev_projects_company_id ON mng_dev_projects (company_id);

CREATE TABLE mng_infra_masters (
    id SERIAL NOT NULL,
    company_id INTEGER NOT NULL,
    service_type VARCHAR(40) NOT NULL,
    env_type VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES mng_companies (id),
    CONSTRAINT uq_mng_infra_masters_comp_svc_env UNIQUE (company_id, service_type, env_type)
);

CREATE INDEX ix_mng_infra_masters_company_id ON mng_infra_masters (company_id);

CREATE TABLE org_dept_change_histories (
    id SERIAL NOT NULL,
    department_id INTEGER NOT NULL,
    changed_by INTEGER,
    field_name VARCHAR(60) NOT NULL,
    before_value VARCHAR(500),
    after_value VARCHAR(500),
    change_reason VARCHAR(300),
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(changed_by) REFERENCES auth_users (id),
    FOREIGN KEY(department_id) REFERENCES org_departments (id)
);

CREATE INDEX ix_org_dept_change_histories_changed_at ON org_dept_change_histories (changed_at);

CREATE INDEX ix_org_dept_change_histories_department_id ON org_dept_change_histories (department_id);

CREATE INDEX ix_org_dept_change_histories_dept_changed ON org_dept_change_histories (department_id, changed_at);

CREATE TABLE org_restructure_plans (
    id SERIAL NOT NULL,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000),
    planned_date DATE,
    status VARCHAR(20) NOT NULL,
    applied_at TIMESTAMP WITHOUT TIME ZONE,
    applied_by INTEGER,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_org_restructure_plans_status CHECK (status IN ('draft', 'reviewing', 'applied', 'cancelled')),
    FOREIGN KEY(applied_by) REFERENCES auth_users (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_org_restructure_plans_status_created ON org_restructure_plans (status, created_at);

CREATE TABLE pay_item_group_details (
    id SERIAL NOT NULL,
    group_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(group_id) REFERENCES pay_item_groups (id),
    FOREIGN KEY(item_id) REFERENCES pay_allowance_deductions (id),
    CONSTRAINT uq_pay_item_group_details_link UNIQUE (group_id, item_id)
);

CREATE INDEX ix_pay_item_group_details_group_id ON pay_item_group_details (group_id);

CREATE TABLE pay_payroll_runs (
    id SERIAL NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    payroll_code_id INTEGER NOT NULL,
    run_name VARCHAR(120),
    status VARCHAR(20) NOT NULL,
    total_employees INTEGER NOT NULL,
    total_gross FLOAT NOT NULL,
    total_deductions FLOAT NOT NULL,
    total_net FLOAT NOT NULL,
    calculated_at TIMESTAMP WITHOUT TIME ZONE,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(payroll_code_id) REFERENCES pay_payroll_codes (id),
    CONSTRAINT uq_pay_payroll_runs_month_code UNIQUE (year_month, payroll_code_id)
);

CREATE INDEX ix_pay_payroll_runs_month_status ON pay_payroll_runs (year_month, status);

CREATE INDEX ix_pay_payroll_runs_payroll_code_id ON pay_payroll_runs (payroll_code_id);

CREATE INDEX ix_pay_payroll_runs_year_month ON pay_payroll_runs (year_month);

CREATE TABLE tim_department_schedule_assignments (
    id SERIAL NOT NULL,
    department_id INTEGER NOT NULL,
    pattern_id INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    priority INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(department_id) REFERENCES org_departments (id),
    FOREIGN KEY(pattern_id) REFERENCES tim_schedule_patterns (id)
);

CREATE INDEX ix_tim_department_schedule_assignments_department_id ON tim_department_schedule_assignments (department_id);

CREATE INDEX ix_tim_department_schedule_assignments_dept_date ON tim_department_schedule_assignments (department_id, effective_from, effective_to);

CREATE INDEX ix_tim_department_schedule_assignments_effective_from ON tim_department_schedule_assignments (effective_from);

CREATE INDEX ix_tim_department_schedule_assignments_effective_to ON tim_department_schedule_assignments (effective_to);

CREATE TABLE tim_month_closes (
    id SERIAL NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    close_status VARCHAR(10) NOT NULL,
    employee_count INTEGER NOT NULL,
    present_days INTEGER NOT NULL,
    absent_days INTEGER NOT NULL,
    late_days INTEGER NOT NULL,
    leave_days INTEGER NOT NULL,
    total_overtime_minutes INTEGER NOT NULL,
    total_night_minutes INTEGER NOT NULL,
    total_holiday_work_minutes INTEGER NOT NULL,
    total_holiday_overtime_minutes INTEGER NOT NULL,
    total_holiday_night_minutes INTEGER NOT NULL,
    closed_by INTEGER,
    closed_at TIMESTAMP WITHOUT TIME ZONE,
    reopened_by INTEGER,
    reopened_at TIMESTAMP WITHOUT TIME ZONE,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tim_month_closes_status CHECK (close_status IN ('open','closed')),
    CONSTRAINT ck_tim_month_closes_month CHECK (month BETWEEN 1 AND 12),
    FOREIGN KEY(closed_by) REFERENCES auth_users (id),
    FOREIGN KEY(reopened_by) REFERENCES auth_users (id),
    CONSTRAINT uq_tim_month_closes_ym UNIQUE (year, month)
);

CREATE INDEX ix_tim_month_closes_year ON tim_month_closes (year);

CREATE TABLE tim_schedule_pattern_days (
    id SERIAL NOT NULL,
    pattern_id INTEGER NOT NULL,
    weekday INTEGER NOT NULL,
    is_workday BOOLEAN NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    break_minutes INTEGER NOT NULL,
    expected_minutes INTEGER NOT NULL,
    is_overnight BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tim_schedule_pattern_days_weekday CHECK (weekday BETWEEN 0 AND 6),
    FOREIGN KEY(pattern_id) REFERENCES tim_schedule_patterns (id),
    CONSTRAINT uq_tim_schedule_pattern_days_pattern_weekday UNIQUE (pattern_id, weekday)
);

CREATE INDEX ix_tim_schedule_pattern_days_pattern_id ON tim_schedule_pattern_days (pattern_id);

CREATE TABLE tra_courses (
    id SERIAL NOT NULL,
    course_code VARCHAR(40) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    in_out_type VARCHAR(20) NOT NULL,
    branch_code VARCHAR(30),
    sub_branch_code VARCHAR(30),
    method_code VARCHAR(30),
    status_code VARCHAR(30) NOT NULL,
    organization_id INTEGER,
    mandatory_yn BOOLEAN NOT NULL,
    job_code VARCHAR(30),
    edu_level VARCHAR(30),
    memo VARCHAR(2000),
    note VARCHAR(2000),
    manager_employee_no VARCHAR(40),
    manager_phone VARCHAR(40),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tra_courses_in_out_type CHECK (in_out_type IN ('INTERNAL', 'EXTERNAL', 'MIXED')),
    FOREIGN KEY(organization_id) REFERENCES tra_organizations (id),
    CONSTRAINT uq_tra_courses_code UNIQUE (course_code)
);

CREATE INDEX ix_tra_courses_course_code ON tra_courses (course_code);

CREATE TABLE app_system_setting_history (
    id SERIAL NOT NULL,
    setting_id INTEGER,
    key VARCHAR(120) NOT NULL,
    old_value_text VARCHAR,
    new_value_text VARCHAR NOT NULL,
    changed_by INTEGER,
    reason VARCHAR(255),
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(changed_by) REFERENCES auth_users (id),
    FOREIGN KEY(setting_id) REFERENCES app_system_settings (id)
);

CREATE INDEX ix_app_system_setting_history_key ON app_system_setting_history (key);

CREATE TABLE hr_appointment_orders (
    id SERIAL NOT NULL,
    appointment_no VARCHAR(30) NOT NULL,
    appointment_code_id INTEGER,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    effective_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    confirmed_by INTEGER,
    created_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_appointment_orders_status CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    FOREIGN KEY(appointment_code_id) REFERENCES app_codes (id),
    FOREIGN KEY(confirmed_by) REFERENCES auth_users (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    CONSTRAINT uq_hr_appointment_orders_no UNIQUE (appointment_no)
);

CREATE INDEX ix_hr_appointment_orders_appointment_no ON hr_appointment_orders (appointment_no);

CREATE INDEX ix_hr_appointment_orders_effective_date ON hr_appointment_orders (effective_date);

CREATE INDEX ix_hr_appointment_orders_status_effective ON hr_appointment_orders (status, effective_date);

CREATE TABLE hr_careers (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    career_scope VARCHAR(20) NOT NULL,
    record_date DATE,
    company_name VARCHAR(120),
    department_name VARCHAR(120),
    position_title VARCHAR(120),
    job_title VARCHAR(120),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN NOT NULL,
    career_years INTEGER,
    career_months INTEGER,
    description VARCHAR(1000),
    note VARCHAR(500),
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_careers_scope CHECK (career_scope IN ('INTERNAL', 'EXTERNAL')),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hr_careers_employee_id ON hr_careers (employee_id);

CREATE INDEX ix_hr_careers_employee_record_date ON hr_careers (employee_id, record_date);

CREATE TABLE hr_contact_points (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    contact_type VARCHAR(50),
    record_date DATE,
    zip_code VARCHAR(20),
    addr1 VARCHAR(300),
    addr2 VARCHAR(300),
    phone_mobile VARCHAR(40),
    phone_home VARCHAR(40),
    phone_work VARCHAR(40),
    email VARCHAR(320),
    emergency_name VARCHAR(100),
    emergency_relation VARCHAR(50),
    emergency_phone VARCHAR(40),
    is_primary BOOLEAN NOT NULL,
    valid_from DATE,
    valid_to DATE,
    note VARCHAR(500),
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hr_contact_points_employee_id ON hr_contact_points (employee_id);

CREATE INDEX ix_hr_contact_points_employee_record_date ON hr_contact_points (employee_id, record_date);

CREATE TABLE hr_employee_basic_profiles (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    gender VARCHAR(20),
    resident_no_masked VARCHAR(30),
    birth_date DATE,
    retire_date DATE,
    blood_type VARCHAR(10),
    marital_status VARCHAR(20),
    mbti VARCHAR(10),
    probation_end_date DATE,
    job_family VARCHAR(80),
    job_role VARCHAR(80),
    grade VARCHAR(40),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_hr_employee_basic_profiles_employee_id UNIQUE (employee_id)
);

CREATE INDEX ix_hr_employee_basic_profiles_employee_id ON hr_employee_basic_profiles (employee_id);

CREATE TABLE hr_employee_info_records (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    category VARCHAR(40) NOT NULL,
    record_date DATE,
    title VARCHAR(120),
    type VARCHAR(80),
    organization VARCHAR(120),
    value VARCHAR(200),
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_hr_employee_info_records_category ON hr_employee_info_records (category);

CREATE INDEX ix_hr_employee_info_records_employee_id ON hr_employee_info_records (employee_id);

CREATE TABLE hr_licenses (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    license_type VARCHAR(60),
    license_code VARCHAR(60),
    license_name VARCHAR(120),
    license_grade VARCHAR(60),
    license_no VARCHAR(120),
    issued_org VARCHAR(120),
    record_date DATE,
    issued_date DATE,
    renewal_date DATE,
    expire_date DATE,
    allowance_yn BOOLEAN NOT NULL,
    allowance_rate FLOAT,
    allowance_amount FLOAT,
    note VARCHAR(500),
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hr_licenses_employee_id ON hr_licenses (employee_id);

CREATE INDEX ix_hr_licenses_employee_record_date ON hr_licenses (employee_id, record_date);

CREATE TABLE hr_military (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    military_type VARCHAR(60),
    branch VARCHAR(60),
    rank VARCHAR(60),
    record_date DATE,
    service_start_date DATE,
    service_end_date DATE,
    discharge_type VARCHAR(60),
    exemption_reason VARCHAR(500),
    special_case_yn BOOLEAN NOT NULL,
    special_case_type VARCHAR(60),
    note VARCHAR(500),
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hr_military_employee_id ON hr_military (employee_id);

CREATE INDEX ix_hr_military_employee_record_date ON hr_military (employee_id, record_date);

CREATE TABLE hr_retire_cases (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    retire_date DATE NOT NULL,
    reason VARCHAR(500),
    status VARCHAR(20) NOT NULL,
    previous_employment_status VARCHAR(20),
    requested_by INTEGER,
    confirmed_by INTEGER,
    confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    cancelled_by INTEGER,
    cancelled_at TIMESTAMP WITHOUT TIME ZONE,
    cancel_reason VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_retire_cases_status CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    FOREIGN KEY(cancelled_by) REFERENCES auth_users (id),
    FOREIGN KEY(confirmed_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(requested_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hr_retire_cases_employee_created ON hr_retire_cases (employee_id, created_at);

CREATE INDEX ix_hr_retire_cases_employee_id ON hr_retire_cases (employee_id);

CREATE INDEX ix_hr_retire_cases_retire_date ON hr_retire_cases (retire_date);

CREATE INDEX ix_hr_retire_cases_status_date ON hr_retire_cases (status, retire_date);

CREATE TABLE hri_form_type_approval_maps (
    id SERIAL NOT NULL,
    form_type_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(form_type_id) REFERENCES hri_form_types (id),
    FOREIGN KEY(template_id) REFERENCES hri_approval_line_templates (id),
    CONSTRAINT uq_hri_form_type_approval_maps_link UNIQUE (form_type_id, template_id, effective_from)
);

CREATE INDEX ix_hri_form_type_approval_maps_form_type_id ON hri_form_type_approval_maps (form_type_id);

CREATE INDEX ix_hri_form_type_approval_maps_template_id ON hri_form_type_approval_maps (template_id);

CREATE TABLE hri_form_type_policies (
    id SERIAL NOT NULL,
    form_type_id INTEGER NOT NULL,
    policy_key VARCHAR(50) NOT NULL,
    policy_value VARCHAR(500) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(form_type_id) REFERENCES hri_form_types (id),
    CONSTRAINT uq_hri_form_type_policies_key_period UNIQUE (form_type_id, policy_key, effective_from)
);

CREATE INDEX ix_hri_form_type_policies_form_type_id ON hri_form_type_policies (form_type_id);

CREATE TABLE hri_request_masters (
    id SERIAL NOT NULL,
    request_no VARCHAR(40) NOT NULL,
    form_type_id INTEGER NOT NULL,
    requester_id INTEGER NOT NULL,
    requester_org_id INTEGER,
    title VARCHAR(200) NOT NULL,
    content_json VARCHAR NOT NULL,
    status_code VARCHAR(30) NOT NULL,
    current_step_order INTEGER,
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hri_request_masters_status_code CHECK (status_code IN ('DRAFT','APPROVAL_IN_PROGRESS','APPROVAL_REJECTED','RECEIVE_IN_PROGRESS','RECEIVE_REJECTED','COMPLETED','WITHDRAWN')),
    FOREIGN KEY(form_type_id) REFERENCES hri_form_types (id),
    FOREIGN KEY(requester_id) REFERENCES auth_users (id),
    FOREIGN KEY(requester_org_id) REFERENCES org_departments (id),
    CONSTRAINT uq_hri_request_masters_request_no UNIQUE (request_no)
);

CREATE INDEX ix_hri_request_masters_form_type_id ON hri_request_masters (form_type_id);

CREATE INDEX ix_hri_request_masters_request_no ON hri_request_masters (request_no);

CREATE INDEX ix_hri_request_masters_requester_created_at ON hri_request_masters (requester_id, created_at);

CREATE INDEX ix_hri_request_masters_requester_id ON hri_request_masters (requester_id);

CREATE INDEX ix_hri_request_masters_status_created_at ON hri_request_masters (status_code, created_at);

CREATE TABLE mng_dev_requests (
    id SERIAL NOT NULL,
    company_id INTEGER NOT NULL,
    request_ym DATE NOT NULL,
    request_seq INTEGER NOT NULL,
    status_code VARCHAR(20),
    part_code VARCHAR(20),
    requester_name VARCHAR(100),
    request_content VARCHAR,
    manager_employee_id INTEGER,
    developer_employee_id INTEGER,
    is_paid BOOLEAN NOT NULL,
    paid_content VARCHAR(500),
    has_tax_bill BOOLEAN NOT NULL,
    start_ym DATE,
    end_ym DATE,
    dev_start_date DATE,
    dev_end_date DATE,
    paid_man_months FLOAT,
    actual_man_months FLOAT,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES mng_companies (id),
    FOREIGN KEY(developer_employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(manager_employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_mng_dev_requests_company_id ON mng_dev_requests (company_id);

CREATE INDEX ix_mng_dev_requests_company_ym ON mng_dev_requests (company_id, request_ym);

CREATE TABLE mng_infra_configs (
    id SERIAL NOT NULL,
    master_id INTEGER NOT NULL,
    section VARCHAR(100) NOT NULL,
    config_key VARCHAR(100) NOT NULL,
    config_value VARCHAR,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(master_id) REFERENCES mng_infra_masters (id),
    CONSTRAINT uq_mng_infra_configs_master_section_key UNIQUE (master_id, section, config_key)
);

CREATE INDEX ix_mng_infra_configs_master_id ON mng_infra_configs (master_id);

CREATE TABLE mng_manager_companies (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    note VARCHAR(500),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(company_id) REFERENCES mng_companies (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_mng_manager_companies_emp_comp_sdate UNIQUE (employee_id, company_id, start_date)
);

CREATE INDEX ix_mng_manager_companies_company_id ON mng_manager_companies (company_id);

CREATE INDEX ix_mng_manager_companies_employee_id ON mng_manager_companies (employee_id);

CREATE TABLE mng_outsource_contracts (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_leave_count FLOAT NOT NULL,
    extra_leave_count FLOAT NOT NULL,
    note VARCHAR(500),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_mng_outsource_contracts_emp_sdate UNIQUE (employee_id, start_date)
);

CREATE INDEX ix_mng_outsource_contracts_employee_id ON mng_outsource_contracts (employee_id);

CREATE TABLE org_restructure_plan_items (
    id SERIAL NOT NULL,
    plan_id INTEGER NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    target_dept_id INTEGER,
    new_parent_id INTEGER,
    new_name VARCHAR(100),
    new_code VARCHAR(30),
    new_organization_type VARCHAR(50),
    new_cost_center_code VARCHAR(30),
    sort_order INTEGER NOT NULL,
    item_status VARCHAR(20) NOT NULL,
    memo VARCHAR(500),
    applied_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_org_restructure_plan_items_action CHECK (action_type IN ('move', 'rename', 'create', 'deactivate', 'reactivate')),
    CONSTRAINT ck_org_restructure_plan_items_status CHECK (item_status IN ('pending', 'applied', 'skipped')),
    FOREIGN KEY(new_parent_id) REFERENCES org_departments (id),
    FOREIGN KEY(plan_id) REFERENCES org_restructure_plans (id),
    FOREIGN KEY(target_dept_id) REFERENCES org_departments (id)
);

CREATE INDEX ix_org_restructure_plan_items_plan ON org_restructure_plan_items (plan_id, sort_order);

CREATE INDEX ix_org_restructure_plan_items_plan_id ON org_restructure_plan_items (plan_id);

CREATE TABLE pap_appraisal_targets (
    id SERIAL NOT NULL,
    appraisal_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    score FLOAT,
    grade_code VARCHAR(30),
    evaluator_note VARCHAR(2000),
    status VARCHAR(20) NOT NULL,
    evaluated_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_pap_appraisal_targets_status CHECK (status IN ('pending', 'evaluated', 'finalized')),
    FOREIGN KEY(appraisal_id) REFERENCES "PAP_APPRAISAL_MASTERS" (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_pap_appraisal_targets_appraisal_id ON pap_appraisal_targets (appraisal_id);

CREATE INDEX ix_pap_appraisal_targets_employee_id ON pap_appraisal_targets (employee_id);

CREATE TABLE pay_employee_profiles (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    payroll_code_id INTEGER NOT NULL,
    item_group_id INTEGER,
    base_salary FLOAT NOT NULL,
    pay_type_code VARCHAR(20) NOT NULL,
    payment_day_type VARCHAR(20) NOT NULL,
    payment_day_value INTEGER,
    holiday_adjustment VARCHAR(30) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(item_group_id) REFERENCES pay_item_groups (id),
    FOREIGN KEY(payroll_code_id) REFERENCES pay_payroll_codes (id),
    CONSTRAINT uq_pay_employee_profiles_employee_period UNIQUE (employee_id, effective_from)
);

CREATE INDEX ix_pay_employee_profiles_effective_from ON pay_employee_profiles (effective_from);

CREATE INDEX ix_pay_employee_profiles_effective_to ON pay_employee_profiles (effective_to);

CREATE INDEX ix_pay_employee_profiles_employee_id ON pay_employee_profiles (employee_id);

CREATE INDEX ix_pay_employee_profiles_payroll_code_id ON pay_employee_profiles (payroll_code_id);

CREATE TABLE pay_payroll_run_events (
    id SERIAL NOT NULL,
    run_id INTEGER NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    message VARCHAR(500) NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(run_id) REFERENCES pay_payroll_runs (id)
);

CREATE INDEX ix_pay_payroll_run_events_run ON pay_payroll_run_events (run_id, created_at);

CREATE INDEX ix_pay_payroll_run_events_run_id ON pay_payroll_run_events (run_id);

CREATE TABLE pay_variable_inputs (
    id SERIAL NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    employee_id INTEGER NOT NULL,
    item_code VARCHAR(20) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    amount FLOAT NOT NULL,
    memo VARCHAR(200),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_pay_variable_inputs_month_employee_item UNIQUE (year_month, employee_id, item_code)
);

CREATE INDEX ix_pay_variable_inputs_employee_id ON pay_variable_inputs (employee_id);

CREATE INDEX ix_pay_variable_inputs_year_month ON pay_variable_inputs (year_month, employee_id);

CREATE TABLE tim_annual_leaves (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    granted_days FLOAT NOT NULL,
    used_days FLOAT NOT NULL,
    carried_over_days FLOAT NOT NULL,
    remaining_days FLOAT NOT NULL,
    grant_type VARCHAR(20) NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_tim_annual_leaves_emp_year UNIQUE (employee_id, year)
);

CREATE INDEX ix_tim_annual_leaves_emp_year ON tim_annual_leaves (employee_id, year);

CREATE INDEX ix_tim_annual_leaves_employee_id ON tim_annual_leaves (employee_id);

CREATE INDEX ix_tim_annual_leaves_year ON tim_annual_leaves (year);

CREATE TABLE tim_attendance_daily (
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
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_hr_attendance_daily_employee_work_date UNIQUE (employee_id, work_date)
);

CREATE INDEX ix_tim_attendance_daily_date_status ON tim_attendance_daily (work_date, attendance_status);

CREATE INDEX ix_tim_attendance_daily_emp_date ON tim_attendance_daily (employee_id, work_date);

CREATE INDEX ix_tim_attendance_daily_work_date ON tim_attendance_daily (work_date);

CREATE TABLE tim_employee_daily_schedules (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    schedule_source VARCHAR(30) NOT NULL,
    pattern_id INTEGER,
    is_holiday BOOLEAN NOT NULL,
    holiday_name VARCHAR(120),
    is_workday BOOLEAN NOT NULL,
    planned_start_at TIMESTAMP WITHOUT TIME ZONE,
    planned_end_at TIMESTAMP WITHOUT TIME ZONE,
    break_minutes INTEGER NOT NULL,
    expected_minutes INTEGER NOT NULL,
    is_overnight BOOLEAN NOT NULL,
    generated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    version_tag VARCHAR(50),
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(pattern_id) REFERENCES tim_schedule_patterns (id),
    CONSTRAINT uq_tim_employee_daily_schedules_employee_work_date UNIQUE (employee_id, work_date)
);

CREATE INDEX ix_tim_employee_daily_schedules_employee_id ON tim_employee_daily_schedules (employee_id);

CREATE INDEX ix_tim_employee_daily_schedules_work_date ON tim_employee_daily_schedules (work_date);

CREATE TABLE tim_employee_schedule_exceptions (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    pattern_id INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    reason VARCHAR(255),
    priority INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(pattern_id) REFERENCES tim_schedule_patterns (id)
);

CREATE INDEX ix_tim_employee_schedule_exceptions_effective_from ON tim_employee_schedule_exceptions (effective_from);

CREATE INDEX ix_tim_employee_schedule_exceptions_effective_to ON tim_employee_schedule_exceptions (effective_to);

CREATE INDEX ix_tim_employee_schedule_exceptions_emp_date ON tim_employee_schedule_exceptions (employee_id, effective_from, effective_to);

CREATE INDEX ix_tim_employee_schedule_exceptions_employee_id ON tim_employee_schedule_exceptions (employee_id);

CREATE TABLE tim_leave_requests (
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
    FOREIGN KEY(approver_employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(decided_by) REFERENCES hr_employees (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_tim_leave_requests_dates ON tim_leave_requests (start_date, end_date);

CREATE INDEX ix_tim_leave_requests_emp_status ON tim_leave_requests (employee_id, request_status);

CREATE TABLE tra_events (
    id SERIAL NOT NULL,
    course_id INTEGER NOT NULL,
    event_code VARCHAR(40) NOT NULL,
    event_name VARCHAR(200) NOT NULL,
    status_code VARCHAR(30) NOT NULL,
    organization_id INTEGER,
    place VARCHAR(200),
    start_date DATE,
    end_date DATE,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    edu_day INTEGER NOT NULL,
    edu_hour FLOAT NOT NULL,
    appl_start_date DATE,
    appl_end_date DATE,
    currency_code VARCHAR(20) NOT NULL,
    per_expense_amount FLOAT NOT NULL,
    real_expense_amount FLOAT NOT NULL,
    labor_apply_yn BOOLEAN NOT NULL,
    labor_amount FLOAT NOT NULL,
    labor_return_yn BOOLEAN NOT NULL,
    labor_return_date DATE,
    result_app_skip_yn BOOLEAN NOT NULL,
    max_person INTEGER NOT NULL,
    note VARCHAR(2000),
    manager_employee_no VARCHAR(40),
    manager_phone VARCHAR(40),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(course_id) REFERENCES tra_courses (id),
    FOREIGN KEY(organization_id) REFERENCES tra_organizations (id),
    CONSTRAINT uq_tra_events_course_event_code UNIQUE (course_id, event_code)
);

CREATE INDEX ix_tra_events_course_id ON tra_events (course_id);

CREATE TABLE tra_required_rules (
    id SERIAL NOT NULL,
    year INTEGER NOT NULL,
    rule_code VARCHAR(30) NOT NULL,
    order_seq INTEGER NOT NULL,
    job_grade_code VARCHAR(30),
    job_grade_year INTEGER,
    job_code VARCHAR(30),
    search_seq INTEGER,
    entry_month INTEGER,
    start_month INTEGER NOT NULL,
    end_month INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    edu_level VARCHAR(30),
    note VARCHAR(2000),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(course_id) REFERENCES tra_courses (id),
    CONSTRAINT uq_tra_required_rules_year_rule UNIQUE (year, rule_code, order_seq, course_id)
);

CREATE INDEX ix_tra_required_rules_course_id ON tra_required_rules (course_id);

CREATE INDEX ix_tra_required_rules_year ON tra_required_rules (year);

CREATE TABLE wel_benefit_requests (
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
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    CONSTRAINT uq_wel_benefit_requests_request_no UNIQUE (request_no)
);

CREATE INDEX ix_wel_benefit_requests_benefit_type_code ON wel_benefit_requests (benefit_type_code);

CREATE INDEX ix_wel_benefit_requests_employee_id ON wel_benefit_requests (employee_id);

CREATE INDEX ix_wel_benefit_requests_employee_no ON wel_benefit_requests (employee_no);

CREATE INDEX ix_wel_benefit_requests_request_no ON wel_benefit_requests (request_no);

CREATE INDEX ix_wel_benefit_requests_status_code ON wel_benefit_requests (status_code);

CREATE TABLE hr_appointment_order_items (
    id SERIAL NOT NULL,
    order_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    appointment_code_id INTEGER,
    appointment_kind VARCHAR(20) NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    from_department_id INTEGER,
    to_department_id INTEGER,
    from_position_title VARCHAR(80),
    to_position_title VARCHAR(80),
    from_employment_status VARCHAR(20),
    to_employment_status VARCHAR(20),
    apply_status VARCHAR(20) NOT NULL,
    applied_at TIMESTAMP WITHOUT TIME ZONE,
    temporary_reason VARCHAR(500),
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_appointment_order_items_temporary_end_date CHECK ((appointment_kind = 'permanent') OR (appointment_kind = 'temporary' AND end_date IS NOT NULL)),
    CONSTRAINT ck_hr_appointment_order_items_apply_status CHECK (apply_status IN ('pending', 'applied', 'cancelled')),
    CONSTRAINT ck_hr_appointment_order_items_kind CHECK (appointment_kind IN ('permanent', 'temporary')),
    FOREIGN KEY(appointment_code_id) REFERENCES app_codes (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(from_department_id) REFERENCES org_departments (id),
    FOREIGN KEY(order_id) REFERENCES hr_appointment_orders (id),
    FOREIGN KEY(to_department_id) REFERENCES org_departments (id),
    CONSTRAINT uq_hr_appointment_order_items_order_employee UNIQUE (order_id, employee_id)
);

CREATE INDEX ix_hr_appointment_order_items_employee_id ON hr_appointment_order_items (employee_id);

CREATE INDEX ix_hr_appointment_order_items_employee_start ON hr_appointment_order_items (employee_id, start_date);

CREATE INDEX ix_hr_appointment_order_items_end_date ON hr_appointment_order_items (end_date);

CREATE INDEX ix_hr_appointment_order_items_kind ON hr_appointment_order_items (appointment_kind);

CREATE INDEX ix_hr_appointment_order_items_order_apply ON hr_appointment_order_items (order_id, apply_status);

CREATE INDEX ix_hr_appointment_order_items_order_id ON hr_appointment_order_items (order_id);

CREATE INDEX ix_hr_appointment_order_items_start_date ON hr_appointment_order_items (start_date);

CREATE TABLE hr_personnel_histories (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    history_type VARCHAR(30) NOT NULL,
    source_table VARCHAR(50) NOT NULL,
    source_id INTEGER NOT NULL,
    appointment_order_id INTEGER,
    effective_date DATE NOT NULL,
    field_name VARCHAR(60),
    before_value VARCHAR(200),
    after_value VARCHAR(200),
    description VARCHAR(500),
    created_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(appointment_order_id) REFERENCES hr_appointment_orders (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_hr_personnel_histories_effective_date ON hr_personnel_histories (effective_date);

CREATE INDEX ix_hr_personnel_histories_employee_effective ON hr_personnel_histories (employee_id, effective_date);

CREATE INDEX ix_hr_personnel_histories_employee_id ON hr_personnel_histories (employee_id);

CREATE INDEX ix_hr_personnel_histories_history_type ON hr_personnel_histories (history_type);

CREATE INDEX ix_hr_personnel_histories_source ON hr_personnel_histories (source_table, source_id);

CREATE INDEX ix_hr_personnel_histories_source_id ON hr_personnel_histories (source_id);

CREATE TABLE hr_retire_audit_logs (
    id SERIAL NOT NULL,
    case_id INTEGER NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    actor_user_id INTEGER,
    detail VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(actor_user_id) REFERENCES auth_users (id),
    FOREIGN KEY(case_id) REFERENCES hr_retire_cases (id)
);

CREATE INDEX ix_hr_retire_audit_logs_action_type ON hr_retire_audit_logs (action_type);

CREATE INDEX ix_hr_retire_audit_logs_case_created ON hr_retire_audit_logs (case_id, created_at);

CREATE INDEX ix_hr_retire_audit_logs_case_id ON hr_retire_audit_logs (case_id);

CREATE TABLE hr_retire_case_items (
    id SERIAL NOT NULL,
    case_id INTEGER NOT NULL,
    checklist_item_id INTEGER NOT NULL,
    is_required BOOLEAN NOT NULL,
    is_checked BOOLEAN NOT NULL,
    checked_by INTEGER,
    checked_at TIMESTAMP WITHOUT TIME ZONE,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(case_id) REFERENCES hr_retire_cases (id),
    FOREIGN KEY(checked_by) REFERENCES auth_users (id),
    FOREIGN KEY(checklist_item_id) REFERENCES hr_retire_checklist_items (id),
    CONSTRAINT uq_hr_retire_case_items_case_checklist UNIQUE (case_id, checklist_item_id)
);

CREATE INDEX ix_hr_retire_case_items_case_checked ON hr_retire_case_items (case_id, is_checked);

CREATE INDEX ix_hr_retire_case_items_case_id ON hr_retire_case_items (case_id);

CREATE INDEX ix_hr_retire_case_items_checklist_item_id ON hr_retire_case_items (checklist_item_id);

CREATE TABLE hr_reward_punish (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    reward_punish_type VARCHAR(20) NOT NULL,
    code VARCHAR(60),
    title VARCHAR(120),
    reason VARCHAR(1000),
    action_date DATE,
    office_name VARCHAR(120),
    amount FLOAT,
    status VARCHAR(20) NOT NULL,
    hri_request_id INTEGER,
    note VARCHAR(500),
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_reward_punish_type CHECK (reward_punish_type IN ('REWARD', 'PUNISH')),
    CONSTRAINT ck_hr_reward_punish_status CHECK (status IN ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'CONFIRMED')),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(hri_request_id) REFERENCES hri_request_masters (id),
    FOREIGN KEY(updated_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hr_reward_punish_employee_action_date ON hr_reward_punish (employee_id, action_date);

CREATE INDEX ix_hr_reward_punish_employee_id ON hr_reward_punish (employee_id);

CREATE INDEX ix_hr_reward_punish_request_status ON hr_reward_punish (hri_request_id, status);

CREATE TABLE hri_req_cert_employment (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    purpose VARCHAR(200) NOT NULL,
    copies INTEGER NOT NULL,
    recipient VARCHAR(200),
    reason VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id),
    CONSTRAINT uq_hri_req_cert_employment_request_id UNIQUE (request_id)
);

CREATE INDEX ix_hri_req_cert_employment_request_id ON hri_req_cert_employment (request_id);

CREATE TABLE hri_req_leave (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    leave_type_code VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    applied_minutes INTEGER NOT NULL,
    reason VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id),
    CONSTRAINT uq_hri_req_leave_request_id UNIQUE (request_id)
);

CREATE INDEX ix_hri_req_leave_dates ON hri_req_leave (start_date, end_date);

CREATE INDEX ix_hri_req_leave_request_id ON hri_req_leave (request_id);

CREATE TABLE hri_req_tim_attendance (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    attendance_code VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    applied_minutes INTEGER NOT NULL,
    reason VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id),
    CONSTRAINT uq_hri_req_tim_attendance_request_id UNIQUE (request_id)
);

CREATE INDEX ix_hri_req_tim_attendance_dates ON hri_req_tim_attendance (start_date, end_date);

CREATE INDEX ix_hri_req_tim_attendance_request_id ON hri_req_tim_attendance (request_id);

CREATE TABLE hri_req_tim_correction (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    before_status VARCHAR(30) NOT NULL,
    after_status VARCHAR(30) NOT NULL,
    reason VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id),
    CONSTRAINT uq_hri_req_tim_correction_request_id UNIQUE (request_id)
);

CREATE INDEX ix_hri_req_tim_correction_request_id ON hri_req_tim_correction (request_id);

CREATE INDEX ix_hri_req_tim_correction_work_date ON hri_req_tim_correction (work_date);

CREATE TABLE hri_request_attachments (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    file_key VARCHAR(300) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(120),
    uploaded_by INTEGER NOT NULL,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id),
    FOREIGN KEY(uploaded_by) REFERENCES auth_users (id)
);

CREATE INDEX ix_hri_request_attachments_request_id ON hri_request_attachments (request_id);

CREATE INDEX ix_hri_request_attachments_request_uploaded_at ON hri_request_attachments (request_id, uploaded_at);

CREATE TABLE hri_request_histories (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    actor_user_id INTEGER NOT NULL,
    actor_ip VARCHAR(45),
    event_payload_json VARCHAR,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(actor_user_id) REFERENCES auth_users (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id)
);

CREATE INDEX ix_hri_request_histories_actor_created_at ON hri_request_histories (actor_user_id, created_at);

CREATE INDEX ix_hri_request_histories_event_type ON hri_request_histories (event_type);

CREATE INDEX ix_hri_request_histories_request_created_at ON hri_request_histories (request_id, created_at);

CREATE INDEX ix_hri_request_histories_request_id ON hri_request_histories (request_id);

CREATE TABLE hri_request_step_snapshots (
    id SERIAL NOT NULL,
    request_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(20) NOT NULL,
    actor_user_id INTEGER NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    actor_org_id INTEGER,
    actor_role_code VARCHAR(30),
    action_status VARCHAR(20) NOT NULL,
    acted_at TIMESTAMP WITHOUT TIME ZONE,
    comment VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hri_request_step_snapshots_action_status CHECK (action_status IN ('WAITING', 'APPROVED', 'REJECTED', 'RECEIVED')),
    CONSTRAINT ck_hri_request_step_snapshots_step_type CHECK (step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE')),
    FOREIGN KEY(actor_org_id) REFERENCES org_departments (id),
    FOREIGN KEY(actor_user_id) REFERENCES auth_users (id),
    FOREIGN KEY(request_id) REFERENCES hri_request_masters (id),
    CONSTRAINT uq_hri_request_step_snapshots_request_step UNIQUE (request_id, step_order)
);

CREATE INDEX ix_hri_request_step_snapshots_actor_status ON hri_request_step_snapshots (actor_user_id, action_status);

CREATE INDEX ix_hri_request_step_snapshots_actor_user_id ON hri_request_step_snapshots (actor_user_id);

CREATE INDEX ix_hri_request_step_snapshots_request_id ON hri_request_step_snapshots (request_id);

CREATE TABLE mng_outsource_attendances (
    id SERIAL NOT NULL,
    contract_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    attendance_code VARCHAR(20) NOT NULL,
    apply_date DATE,
    status_code VARCHAR(20),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    apply_count FLOAT,
    note VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(contract_id) REFERENCES mng_outsource_contracts (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_mng_outsource_attendances_contract ON mng_outsource_attendances (contract_id);

CREATE INDEX ix_mng_outsource_attendances_contract_id ON mng_outsource_attendances (contract_id);

CREATE INDEX ix_mng_outsource_attendances_emp ON mng_outsource_attendances (employee_id);

CREATE INDEX ix_mng_outsource_attendances_employee_id ON mng_outsource_attendances (employee_id);

CREATE TABLE pay_payroll_run_employees (
    id SERIAL NOT NULL,
    run_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    profile_id INTEGER,
    gross_pay FLOAT NOT NULL,
    taxable_income FLOAT NOT NULL,
    non_taxable_income FLOAT NOT NULL,
    total_deductions FLOAT NOT NULL,
    net_pay FLOAT NOT NULL,
    status VARCHAR(20) NOT NULL,
    warning_message VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(profile_id) REFERENCES pay_employee_profiles (id),
    FOREIGN KEY(run_id) REFERENCES pay_payroll_runs (id),
    CONSTRAINT uq_pay_payroll_run_employees_run_employee UNIQUE (run_id, employee_id)
);

CREATE INDEX ix_pay_payroll_run_employees_employee_id ON pay_payroll_run_employees (employee_id);

CREATE INDEX ix_pay_payroll_run_employees_run ON pay_payroll_run_employees (run_id, employee_id);

CREATE INDEX ix_pay_payroll_run_employees_run_id ON pay_payroll_run_employees (run_id);

CREATE TABLE pay_payroll_run_targets (
    id SERIAL NOT NULL,
    run_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    profile_id INTEGER,
    event_count INTEGER NOT NULL,
    review_required BOOLEAN NOT NULL,
    snapshot_json JSON NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(profile_id) REFERENCES pay_employee_profiles (id),
    FOREIGN KEY(run_id) REFERENCES pay_payroll_runs (id),
    CONSTRAINT uq_pay_payroll_run_targets_run_employee UNIQUE (run_id, employee_id)
);

CREATE INDEX ix_pay_payroll_run_targets_employee_id ON pay_payroll_run_targets (employee_id);

CREATE INDEX ix_pay_payroll_run_targets_run ON pay_payroll_run_targets (run_id, employee_id);

CREATE INDEX ix_pay_payroll_run_targets_run_id ON pay_payroll_run_targets (run_id);

CREATE TABLE tim_attendance_corrections (
    id SERIAL NOT NULL,
    attendance_id INTEGER NOT NULL,
    corrected_by_employee_id INTEGER NOT NULL,
    old_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    old_check_in_at TIMESTAMP WITHOUT TIME ZONE,
    new_check_in_at TIMESTAMP WITHOUT TIME ZONE,
    old_check_out_at TIMESTAMP WITHOUT TIME ZONE,
    new_check_out_at TIMESTAMP WITHOUT TIME ZONE,
    reason VARCHAR(500) NOT NULL,
    corrected_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(attendance_id) REFERENCES tim_attendance_daily (id),
    FOREIGN KEY(corrected_by_employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_tim_attendance_corrections_attendance ON tim_attendance_corrections (attendance_id, corrected_at);

CREATE INDEX ix_tim_attendance_corrections_attendance_id ON tim_attendance_corrections (attendance_id);

CREATE TABLE tra_applications (
    id SERIAL NOT NULL,
    application_no VARCHAR(40) NOT NULL,
    employee_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    event_id INTEGER,
    in_out_type VARCHAR(20),
    job_code VARCHAR(30),
    year_plan_yn BOOLEAN NOT NULL,
    edu_memo VARCHAR(2000),
    note VARCHAR(2000),
    survey_yn BOOLEAN NOT NULL,
    approval_request_id INTEGER,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tra_applications_status CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'canceled')),
    FOREIGN KEY(approval_request_id) REFERENCES hri_request_masters (id),
    FOREIGN KEY(course_id) REFERENCES tra_courses (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(event_id) REFERENCES tra_events (id),
    CONSTRAINT uq_tra_applications_application_no UNIQUE (application_no)
);

CREATE INDEX ix_tra_applications_application_no ON tra_applications (application_no);

CREATE INDEX ix_tra_applications_course_id ON tra_applications (course_id);

CREATE INDEX ix_tra_applications_employee_id ON tra_applications (employee_id);

CREATE INDEX ix_tra_applications_event_id ON tra_applications (event_id);

CREATE TABLE pay_payroll_run_items (
    id SERIAL NOT NULL,
    run_employee_id INTEGER NOT NULL,
    item_code VARCHAR(30) NOT NULL,
    item_name VARCHAR(120) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    amount FLOAT NOT NULL,
    tax_type VARCHAR(30) NOT NULL,
    calculation_type VARCHAR(30) NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(run_employee_id) REFERENCES pay_payroll_run_employees (id)
);

CREATE INDEX ix_pay_payroll_run_items_run_employee ON pay_payroll_run_items (run_employee_id, direction);

CREATE INDEX ix_pay_payroll_run_items_run_employee_id ON pay_payroll_run_items (run_employee_id);

CREATE TABLE pay_payroll_run_target_events (
    id SERIAL NOT NULL,
    run_id INTEGER NOT NULL,
    target_id INTEGER,
    employee_id INTEGER NOT NULL,
    event_code VARCHAR(50) NOT NULL,
    event_name VARCHAR(120) NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    source_table VARCHAR(50) NOT NULL,
    source_id INTEGER,
    effective_date DATE NOT NULL,
    decision_code VARCHAR(20) NOT NULL,
    payload_json JSON NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(run_id) REFERENCES pay_payroll_runs (id),
    FOREIGN KEY(target_id) REFERENCES pay_payroll_run_targets (id)
);

CREATE INDEX ix_pay_payroll_run_target_events_effective_date ON pay_payroll_run_target_events (effective_date);

CREATE INDEX ix_pay_payroll_run_target_events_employee_id ON pay_payroll_run_target_events (employee_id);

CREATE INDEX ix_pay_payroll_run_target_events_run_code ON pay_payroll_run_target_events (run_id, event_code);

CREATE INDEX ix_pay_payroll_run_target_events_run_employee ON pay_payroll_run_target_events (run_id, employee_id, effective_date);

CREATE INDEX ix_pay_payroll_run_target_events_run_id ON pay_payroll_run_target_events (run_id);

CREATE INDEX ix_pay_payroll_run_target_events_target_id ON pay_payroll_run_target_events (target_id);

CREATE TABLE tra_histories (
    id SERIAL NOT NULL,
    employee_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    event_id INTEGER,
    application_id INTEGER,
    confirm_type VARCHAR(1) NOT NULL,
    unconfirm_reason VARCHAR(1000),
    app_point FLOAT,
    job_code VARCHAR(30),
    note VARCHAR(2000),
    completed_at DATE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tra_histories_confirm_type CHECK (confirm_type IN ('0', '1')),
    FOREIGN KEY(application_id) REFERENCES tra_applications (id),
    FOREIGN KEY(course_id) REFERENCES tra_courses (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(event_id) REFERENCES tra_events (id)
);

CREATE INDEX ix_tra_histories_course_id ON tra_histories (course_id);

CREATE INDEX ix_tra_histories_employee_completed_at ON tra_histories (employee_id, completed_at);

CREATE INDEX ix_tra_histories_employee_id ON tra_histories (employee_id);

CREATE TABLE tra_required_targets (
    id SERIAL NOT NULL,
    year INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    rule_code VARCHAR(30) NOT NULL,
    course_id INTEGER NOT NULL,
    edu_month VARCHAR(6) NOT NULL,
    event_id INTEGER,
    application_id INTEGER,
    standard_rule_id INTEGER,
    edu_level VARCHAR(30),
    completion_status VARCHAR(20) NOT NULL,
    completed_count INTEGER NOT NULL,
    note VARCHAR(1000),
    error_note VARCHAR(1000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tra_required_targets_completion_status CHECK (completion_status IN ('pending', 'completed', 'exempt')),
    FOREIGN KEY(application_id) REFERENCES tra_applications (id),
    FOREIGN KEY(course_id) REFERENCES tra_courses (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(event_id) REFERENCES tra_events (id),
    FOREIGN KEY(standard_rule_id) REFERENCES tra_required_rules (id),
    CONSTRAINT uq_tra_required_targets_year_employee_rule UNIQUE (year, employee_id, rule_code, course_id, edu_month)
);

CREATE INDEX ix_tra_required_targets_course_id ON tra_required_targets (course_id);

CREATE INDEX ix_tra_required_targets_employee_id ON tra_required_targets (employee_id);

CREATE INDEX ix_tra_required_targets_year ON tra_required_targets (year);

CREATE TABLE tra_cyber_uploads (
    id SERIAL NOT NULL,
    upload_ym VARCHAR(6) NOT NULL,
    employee_no VARCHAR(40),
    employee_id INTEGER,
    course_name VARCHAR(200) NOT NULL,
    start_date DATE,
    end_date DATE,
    reward_hour FLOAT NOT NULL,
    edu_hour FLOAT NOT NULL,
    labor_apply_yn BOOLEAN NOT NULL,
    labor_amount FLOAT NOT NULL,
    per_expense_amount FLOAT NOT NULL,
    real_expense_amount FLOAT NOT NULL,
    confirm_type VARCHAR(1) NOT NULL,
    unconfirm_reason VARCHAR(1000),
    edu_branch_code VARCHAR(30),
    edu_sub_branch_code VARCHAR(30),
    in_out_type VARCHAR(20),
    method_code VARCHAR(30),
    organization_name VARCHAR(200),
    business_no VARCHAR(40),
    mandatory_yn BOOLEAN NOT NULL,
    job_code VARCHAR(30),
    edu_level VARCHAR(30),
    event_name VARCHAR(200),
    place VARCHAR(200),
    close_yn BOOLEAN NOT NULL,
    applied_course_id INTEGER,
    applied_event_id INTEGER,
    applied_history_id INTEGER,
    note VARCHAR(2000),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_tra_cyber_uploads_confirm_type CHECK (confirm_type IN ('0', '1')),
    FOREIGN KEY(applied_course_id) REFERENCES tra_courses (id),
    FOREIGN KEY(applied_event_id) REFERENCES tra_events (id),
    FOREIGN KEY(applied_history_id) REFERENCES tra_histories (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id)
);

CREATE INDEX ix_tra_cyber_uploads_employee_id ON tra_cyber_uploads (employee_id);

CREATE INDEX ix_tra_cyber_uploads_upload_ym ON tra_cyber_uploads (upload_ym);

CREATE INDEX ix_tra_cyber_uploads_upload_ym_close_yn ON tra_cyber_uploads (upload_ym, close_yn);

CREATE TABLE gl_accounts (
    id SERIAL NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    is_net_pay_account BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_gl_accounts_code UNIQUE (code)
);

CREATE INDEX ix_gl_accounts_code ON gl_accounts (code);

CREATE TABLE pay_gl_mappings (
    id SERIAL NOT NULL,
    pay_item_code VARCHAR(30) NOT NULL,
    gl_account_code VARCHAR(20) NOT NULL,
    effective_from DATE NOT NULL,
    note VARCHAR(200),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(gl_account_code) REFERENCES gl_accounts (code),
    CONSTRAINT uq_pay_gl_mappings_item_period UNIQUE (pay_item_code, effective_from)
);

CREATE INDEX ix_pay_gl_mappings_effective_from ON pay_gl_mappings (effective_from);

CREATE INDEX ix_pay_gl_mappings_gl_account_code ON pay_gl_mappings (gl_account_code);

CREATE INDEX ix_pay_gl_mappings_item_code ON pay_gl_mappings (pay_item_code);

CREATE TABLE pay_vouchers (
    id SERIAL NOT NULL,
    voucher_no VARCHAR(30) NOT NULL,
    run_id INTEGER NOT NULL,
    voucher_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_debit FLOAT NOT NULL,
    total_credit FLOAT NOT NULL,
    summary VARCHAR(200),
    created_by INTEGER,
    confirmed_by INTEGER,
    confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(confirmed_by) REFERENCES auth_users (id),
    FOREIGN KEY(created_by) REFERENCES auth_users (id),
    FOREIGN KEY(run_id) REFERENCES pay_payroll_runs (id),
    CONSTRAINT uq_pay_vouchers_run_id UNIQUE (run_id),
    CONSTRAINT uq_pay_vouchers_voucher_no UNIQUE (voucher_no)
);

CREATE INDEX ix_pay_vouchers_run_id ON pay_vouchers (run_id);

CREATE INDEX ix_pay_vouchers_voucher_date ON pay_vouchers (voucher_date);

CREATE INDEX ix_pay_vouchers_voucher_no ON pay_vouchers (voucher_no);

CREATE TABLE pay_voucher_lines (
    id SERIAL NOT NULL,
    voucher_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    gl_account_code VARCHAR(20) NOT NULL,
    cost_center_code VARCHAR(30),
    debit_amount FLOAT NOT NULL,
    credit_amount FLOAT NOT NULL,
    summary VARCHAR(200),
    source_item_code VARCHAR(30),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(gl_account_code) REFERENCES gl_accounts (code),
    FOREIGN KEY(voucher_id) REFERENCES pay_vouchers (id)
);

CREATE INDEX ix_pay_voucher_lines_gl_account_code ON pay_voucher_lines (gl_account_code);

CREATE INDEX ix_pay_voucher_lines_voucher ON pay_voucher_lines (voucher_id, line_no);

CREATE INDEX ix_pay_voucher_lines_voucher_id ON pay_voucher_lines (voucher_id);

CREATE TABLE pay_severance_item_rules (
    id SERIAL NOT NULL,
    pay_item_code VARCHAR(30) NOT NULL,
    include_type VARCHAR(20) NOT NULL,
    note VARCHAR(200),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_pay_severance_item_rules_include_type CHECK (include_type IN ('full', 'prorate_12', 'exclude')),
    CONSTRAINT uq_pay_severance_item_rules_item_code UNIQUE (pay_item_code)
);

CREATE INDEX ix_pay_severance_item_rules_pay_item_code ON pay_severance_item_rules (pay_item_code);

CREATE TABLE hr_severance_calcs (
    id SERIAL NOT NULL,
    retire_case_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    hire_date DATE NOT NULL,
    retire_date DATE NOT NULL,
    service_days INTEGER NOT NULL,
    avg_wage_base_from DATE,
    avg_wage_base_to DATE,
    wage_total_3m FLOAT NOT NULL,
    base_days_3m INTEGER NOT NULL,
    avg_daily_wage FLOAT NOT NULL,
    severance_amount FLOAT NOT NULL,
    adjustment_amount FLOAT NOT NULL,
    adjustment_reason VARCHAR(500),
    final_amount FLOAT NOT NULL,
    status VARCHAR(20) NOT NULL,
    warning VARCHAR(500),
    calculated_at TIMESTAMP WITHOUT TIME ZONE,
    confirmed_by INTEGER,
    confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_hr_severance_calcs_status CHECK (status IN ('draft', 'reviewed', 'confirmed')),
    FOREIGN KEY(confirmed_by) REFERENCES auth_users (id),
    FOREIGN KEY(employee_id) REFERENCES hr_employees (id),
    FOREIGN KEY(retire_case_id) REFERENCES hr_retire_cases (id),
    CONSTRAINT uq_hr_severance_calcs_retire_case_id UNIQUE (retire_case_id)
);

CREATE INDEX ix_hr_severance_calcs_employee_id ON hr_severance_calcs (employee_id);

CREATE INDEX ix_hr_severance_calcs_employee_status ON hr_severance_calcs (employee_id, status);

CREATE INDEX ix_hr_severance_calcs_retire_case_id ON hr_severance_calcs (retire_case_id);

CREATE INDEX ix_hr_severance_calcs_retire_date ON hr_severance_calcs (retire_date);

DROP TABLE IF EXISTS users;

DROP INDEX IF EXISTS ix_pap_appraisal_masters_appraisal_code;

DROP INDEX IF EXISTS ix_pap_appraisal_masters_appraisal_year;

CREATE INDEX IF NOT EXISTS "ix_PAP_APPRAISAL_MASTERS_appraisal_code" ON "PAP_APPRAISAL_MASTERS" (appraisal_code);

CREATE INDEX IF NOT EXISTS "ix_PAP_APPRAISAL_MASTERS_appraisal_year" ON "PAP_APPRAISAL_MASTERS" (appraisal_year);

DROP INDEX IF EXISTS ux_auth_users_login_id;

ALTER TABLE tim_attendance_daily ALTER COLUMN calculated_at TYPE TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE gl_accounts ADD COLUMN is_cash_account BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE pay_vouchers ADD COLUMN voucher_type VARCHAR(20) DEFAULT 'accrual' NOT NULL;

ALTER TABLE pay_vouchers DROP CONSTRAINT uq_pay_vouchers_run_id;

ALTER TABLE pay_vouchers ADD CONSTRAINT uq_pay_vouchers_run_id_voucher_type UNIQUE (run_id, voucher_type);

ALTER TABLE hr_severance_calcs ADD COLUMN service_years INTEGER DEFAULT '0' NOT NULL;

ALTER TABLE hr_severance_calcs ADD COLUMN income_tax FLOAT DEFAULT '0' NOT NULL;

ALTER TABLE hr_severance_calcs ADD COLUMN local_income_tax FLOAT DEFAULT '0' NOT NULL;

ALTER TABLE hr_severance_calcs ADD COLUMN net_severance FLOAT DEFAULT '0' NOT NULL;

ALTER TABLE hr_severance_calcs ADD COLUMN tax_detail_json VARCHAR;

ALTER TABLE hr_severance_calcs ALTER COLUMN service_years DROP DEFAULT;

ALTER TABLE hr_severance_calcs ALTER COLUMN income_tax DROP DEFAULT;

ALTER TABLE hr_severance_calcs ALTER COLUMN local_income_tax DROP DEFAULT;

ALTER TABLE hr_severance_calcs ALTER COLUMN net_severance DROP DEFAULT;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE org_mapping_type_items (
    id SERIAL NOT NULL,
    type_code VARCHAR(50) NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    erp_employee_code VARCHAR(50),
    cost_center_type VARCHAR(50),
    remark VARCHAR(500),
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_org_mapping_type_items_created_by FOREIGN KEY(created_by) REFERENCES auth_users (id) ON DELETE SET NULL,
    CONSTRAINT fk_org_mapping_type_items_updated_by FOREIGN KEY(updated_by) REFERENCES auth_users (id) ON DELETE SET NULL,
    CONSTRAINT uq_org_mapping_type_items_id_type UNIQUE (id, type_code),
    CONSTRAINT ck_org_mapping_type_items_date_order CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX ix_org_mapping_type_items_type_item_from ON org_mapping_type_items (type_code, item_code, effective_from);

ALTER TABLE org_mapping_type_items
        ADD CONSTRAINT ex_org_mapping_type_items_period
        EXCLUDE USING gist (
            type_code WITH =,
            item_code WITH =,
            daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') WITH &&
        );

CREATE TABLE org_mapping_assignments (
    id SERIAL NOT NULL,
    department_id INTEGER NOT NULL,
    type_code VARCHAR(50) NOT NULL,
    item_id INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_org_mapping_assignments_department FOREIGN KEY(department_id) REFERENCES org_departments (id) ON DELETE RESTRICT,
    CONSTRAINT fk_org_mapping_assignments_created_by FOREIGN KEY(created_by) REFERENCES auth_users (id) ON DELETE SET NULL,
    CONSTRAINT fk_org_mapping_assignments_updated_by FOREIGN KEY(updated_by) REFERENCES auth_users (id) ON DELETE SET NULL,
    CONSTRAINT fk_org_mapping_assignments_item_type FOREIGN KEY(item_id, type_code) REFERENCES org_mapping_type_items (id, type_code) ON DELETE RESTRICT,
    CONSTRAINT ck_org_mapping_assignments_date_order CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX ix_org_mapping_assignments_department_type_from ON org_mapping_assignments (department_id, type_code, effective_from);

CREATE INDEX ix_org_mapping_assignments_item_id ON org_mapping_assignments (item_id);

ALTER TABLE org_mapping_assignments
        ADD CONSTRAINT ex_org_mapping_assignments_period
        EXCLUDE USING gist (
            department_id WITH =,
            type_code WITH =,
            daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') WITH &&
        );
