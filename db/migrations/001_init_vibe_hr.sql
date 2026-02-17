BEGIN;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS org;
CREATE SCHEMA IF NOT EXISTS hr;

COMMENT ON SCHEMA auth IS 'Authentication and authorization domain.';
COMMENT ON SCHEMA org IS 'Organization structure domain.';
COMMENT ON SCHEMA hr IS 'Human resources domain.';

CREATE TABLE auth.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_users_email UNIQUE (email),
    CONSTRAINT ck_auth_users_email_format CHECK (POSITION('@' IN email) > 1)
);

COMMENT ON TABLE auth.users IS 'Application login accounts.';
COMMENT ON COLUMN auth.users.id IS 'Surrogate primary key.';
COMMENT ON COLUMN auth.users.email IS 'Unique login email.';
COMMENT ON COLUMN auth.users.password_hash IS 'Hashed password value.';
COMMENT ON COLUMN auth.users.display_name IS 'Display name shown in UI.';
COMMENT ON COLUMN auth.users.is_active IS 'Whether login is allowed.';
COMMENT ON COLUMN auth.users.last_login_at IS 'Most recent successful login timestamp.';
COMMENT ON COLUMN auth.users.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN auth.users.updated_at IS 'Row update timestamp.';

CREATE TABLE auth.roles (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_roles_code UNIQUE (code)
);

COMMENT ON TABLE auth.roles IS 'System roles (admin, hr_manager, employee).';
COMMENT ON COLUMN auth.roles.id IS 'Surrogate primary key.';
COMMENT ON COLUMN auth.roles.code IS 'Stable role code used in authorization checks.';
COMMENT ON COLUMN auth.roles.name IS 'Role display name.';
COMMENT ON COLUMN auth.roles.created_at IS 'Row creation timestamp.';

CREATE TABLE auth.user_roles (
    user_id BIGINT NOT NULL,
    role_id SMALLINT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_auth_user_roles_user_id FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_auth_user_roles_role_id FOREIGN KEY (role_id) REFERENCES auth.roles (id) ON DELETE RESTRICT
);

COMMENT ON TABLE auth.user_roles IS 'Many-to-many mapping between users and roles.';
COMMENT ON COLUMN auth.user_roles.user_id IS 'Reference to auth.users.id.';
COMMENT ON COLUMN auth.user_roles.role_id IS 'Reference to auth.roles.id.';
COMMENT ON COLUMN auth.user_roles.assigned_at IS 'Role assignment timestamp.';

CREATE TABLE auth.refresh_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_auth_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

COMMENT ON TABLE auth.refresh_tokens IS 'Stored refresh tokens for session management.';
COMMENT ON COLUMN auth.refresh_tokens.id IS 'Surrogate primary key.';
COMMENT ON COLUMN auth.refresh_tokens.user_id IS 'Owner user id.';
COMMENT ON COLUMN auth.refresh_tokens.token_hash IS 'Hashed refresh token value.';
COMMENT ON COLUMN auth.refresh_tokens.expires_at IS 'Token expiration timestamp.';
COMMENT ON COLUMN auth.refresh_tokens.revoked_at IS 'Revocation timestamp, null if active.';
COMMENT ON COLUMN auth.refresh_tokens.created_at IS 'Row creation timestamp.';

CREATE TABLE org.departments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_departments_code UNIQUE (code),
    CONSTRAINT fk_org_departments_parent_id FOREIGN KEY (parent_id) REFERENCES org.departments (id) ON DELETE SET NULL
);

COMMENT ON TABLE org.departments IS 'Organization department hierarchy.';
COMMENT ON COLUMN org.departments.id IS 'Surrogate primary key.';
COMMENT ON COLUMN org.departments.code IS 'Stable department code.';
COMMENT ON COLUMN org.departments.name IS 'Department name.';
COMMENT ON COLUMN org.departments.parent_id IS 'Parent department id for hierarchy.';
COMMENT ON COLUMN org.departments.is_active IS 'Whether department is active.';
COMMENT ON COLUMN org.departments.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN org.departments.updated_at IS 'Row update timestamp.';

CREATE TABLE hr.employees (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    employee_no VARCHAR(30) NOT NULL,
    department_id BIGINT NOT NULL,
    position_title VARCHAR(80) NOT NULL,
    hire_date DATE NOT NULL,
    employment_status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_employees_user_id UNIQUE (user_id),
    CONSTRAINT uq_hr_employees_employee_no UNIQUE (employee_no),
    CONSTRAINT fk_hr_employees_user_id FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_hr_employees_department_id FOREIGN KEY (department_id) REFERENCES org.departments (id) ON DELETE RESTRICT,
    CONSTRAINT ck_hr_employees_employment_status CHECK (employment_status IN ('active', 'leave', 'resigned'))
);

COMMENT ON TABLE hr.employees IS 'Employee master records linked to login users.';
COMMENT ON COLUMN hr.employees.id IS 'Surrogate primary key.';
COMMENT ON COLUMN hr.employees.user_id IS 'Reference to auth.users.id.';
COMMENT ON COLUMN hr.employees.employee_no IS 'Human-friendly employee number.';
COMMENT ON COLUMN hr.employees.department_id IS 'Reference to org.departments.id.';
COMMENT ON COLUMN hr.employees.position_title IS 'Current position title.';
COMMENT ON COLUMN hr.employees.hire_date IS 'Employment start date.';
COMMENT ON COLUMN hr.employees.employment_status IS 'Current employment status.';
COMMENT ON COLUMN hr.employees.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN hr.employees.updated_at IS 'Row update timestamp.';

CREATE TABLE hr.attendance_daily (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    attendance_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_attendance_daily_employee_work_date UNIQUE (employee_id, work_date),
    CONSTRAINT fk_hr_attendance_daily_employee_id FOREIGN KEY (employee_id) REFERENCES hr.employees (id) ON DELETE CASCADE,
    CONSTRAINT ck_hr_attendance_daily_attendance_status CHECK (attendance_status IN ('present', 'late', 'absent', 'leave', 'remote'))
);

COMMENT ON TABLE hr.attendance_daily IS 'Daily attendance facts per employee.';
COMMENT ON COLUMN hr.attendance_daily.id IS 'Surrogate primary key.';
COMMENT ON COLUMN hr.attendance_daily.employee_id IS 'Reference to hr.employees.id.';
COMMENT ON COLUMN hr.attendance_daily.work_date IS 'Work date.';
COMMENT ON COLUMN hr.attendance_daily.check_in_at IS 'Check-in timestamp.';
COMMENT ON COLUMN hr.attendance_daily.check_out_at IS 'Check-out timestamp.';
COMMENT ON COLUMN hr.attendance_daily.attendance_status IS 'Attendance result for the date.';
COMMENT ON COLUMN hr.attendance_daily.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN hr.attendance_daily.updated_at IS 'Row update timestamp.';

CREATE TABLE hr.leave_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    request_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approver_employee_id BIGINT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_hr_leave_requests_employee_id FOREIGN KEY (employee_id) REFERENCES hr.employees (id) ON DELETE CASCADE,
    CONSTRAINT fk_hr_leave_requests_approver_employee_id FOREIGN KEY (approver_employee_id) REFERENCES hr.employees (id) ON DELETE SET NULL,
    CONSTRAINT ck_hr_leave_requests_leave_type CHECK (leave_type IN ('annual', 'sick', 'half_day', 'unpaid', 'other')),
    CONSTRAINT ck_hr_leave_requests_request_status CHECK (request_status IN ('pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT ck_hr_leave_requests_date_range CHECK (start_date <= end_date)
);

COMMENT ON TABLE hr.leave_requests IS 'Employee leave approval requests.';
COMMENT ON COLUMN hr.leave_requests.id IS 'Surrogate primary key.';
COMMENT ON COLUMN hr.leave_requests.employee_id IS 'Requesting employee id.';
COMMENT ON COLUMN hr.leave_requests.leave_type IS 'Requested leave type.';
COMMENT ON COLUMN hr.leave_requests.start_date IS 'Leave start date.';
COMMENT ON COLUMN hr.leave_requests.end_date IS 'Leave end date.';
COMMENT ON COLUMN hr.leave_requests.reason IS 'Optional leave reason text.';
COMMENT ON COLUMN hr.leave_requests.request_status IS 'Current approval status.';
COMMENT ON COLUMN hr.leave_requests.approver_employee_id IS 'Approver employee id.';
COMMENT ON COLUMN hr.leave_requests.approved_at IS 'Final approval/rejection timestamp.';
COMMENT ON COLUMN hr.leave_requests.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN hr.leave_requests.updated_at IS 'Row update timestamp.';

CREATE INDEX idx_auth_user_roles_role_id ON auth.user_roles (role_id);
CREATE INDEX idx_auth_refresh_tokens_user_id ON auth.refresh_tokens (user_id);
CREATE INDEX idx_auth_refresh_tokens_expires_at ON auth.refresh_tokens (expires_at);
CREATE INDEX idx_org_departments_parent_id ON org.departments (parent_id);
CREATE INDEX idx_hr_employees_department_id ON hr.employees (department_id);
CREATE INDEX idx_hr_employees_employment_status ON hr.employees (employment_status);
CREATE INDEX idx_hr_attendance_daily_work_date ON hr.attendance_daily (work_date);
CREATE INDEX idx_hr_attendance_daily_status ON hr.attendance_daily (attendance_status);
CREATE INDEX idx_hr_leave_requests_status ON hr.leave_requests (request_status);
CREATE INDEX idx_hr_leave_requests_date_range ON hr.leave_requests (start_date, end_date);

COMMIT;
