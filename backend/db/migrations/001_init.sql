PRAGMA foreign_keys = ON;

-- ===========================================
-- Vibe-HR 초기 스키마 (SQLite 테스트용)
-- 요청 규칙: 스키마 분리 없이 prefix 테이블명 사용
-- ===========================================

-- 로그인 사용자 정보
CREATE TABLE IF NOT EXISTS auth_users (
  -- 사용자 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 로그인 이메일 (고유)
  email TEXT NOT NULL UNIQUE,
  -- 해시된 비밀번호
  password_hash TEXT NOT NULL,
  -- 화면 표시용 사용자명
  display_name TEXT NOT NULL,
  -- 로그인 가능 여부
  is_active INTEGER NOT NULL DEFAULT 1,
  -- 마지막 로그인 시간
  last_login_at TEXT,
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 수정 시간
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 시스템 역할 정보
CREATE TABLE IF NOT EXISTS auth_roles (
  -- 역할 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 권한 코드 (admin, hr_manager, employee)
  code TEXT NOT NULL UNIQUE,
  -- 권한명
  name TEXT NOT NULL,
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 사용자-역할 매핑 (N:M)
CREATE TABLE IF NOT EXISTS auth_user_roles (
  -- 사용자 FK
  user_id INTEGER NOT NULL,
  -- 역할 FK
  role_id INTEGER NOT NULL,
  -- 역할 부여 시간
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES auth_users (id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES auth_roles (id) ON DELETE RESTRICT
);

-- 조직 부서 정보
CREATE TABLE IF NOT EXISTS org_departments (
  -- 부서 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 부서 코드 (고유)
  code TEXT NOT NULL UNIQUE,
  -- 부서명
  name TEXT NOT NULL,
  -- 상위 부서 FK
  parent_id INTEGER,
  -- 사용 여부
  is_active INTEGER NOT NULL DEFAULT 1,
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 수정 시간
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES org_departments (id) ON DELETE SET NULL
);

-- 직원 마스터 정보
CREATE TABLE IF NOT EXISTS hr_employees (
  -- 직원 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 사용자 FK (1:1)
  user_id INTEGER NOT NULL UNIQUE,
  -- 사번 (고유)
  employee_no TEXT NOT NULL UNIQUE,
  -- 부서 FK
  department_id INTEGER NOT NULL,
  -- 직책명
  position_title TEXT NOT NULL,
  -- 입사일
  hire_date TEXT NOT NULL,
  -- 재직 상태 (active, leave, resigned)
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'leave', 'resigned')),
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 수정 시간
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES auth_users (id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES org_departments (id) ON DELETE RESTRICT
);

-- 일자별 근태 정보
CREATE TABLE IF NOT EXISTS hr_attendance_daily (
  -- 근태 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 직원 FK
  employee_id INTEGER NOT NULL,
  -- 근무일
  work_date TEXT NOT NULL,
  -- 출근 시간
  check_in_at TEXT,
  -- 퇴근 시간
  check_out_at TEXT,
  -- 근태 상태 (present, late, absent, leave, remote)
  attendance_status TEXT NOT NULL
    CHECK (attendance_status IN ('present', 'late', 'absent', 'leave', 'remote')),
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 수정 시간
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, work_date),
  FOREIGN KEY (employee_id) REFERENCES hr_employees (id) ON DELETE CASCADE
);

-- 휴가 신청 정보
CREATE TABLE IF NOT EXISTS hr_leave_requests (
  -- 신청 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 신청 직원 FK
  employee_id INTEGER NOT NULL,
  -- 휴가 유형 (annual, sick, half_day, unpaid, other)
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('annual', 'sick', 'half_day', 'unpaid', 'other')),
  -- 시작일
  start_date TEXT NOT NULL,
  -- 종료일
  end_date TEXT NOT NULL,
  -- 신청 사유
  reason TEXT,
  -- 결재 상태 (pending, approved, rejected, cancelled)
  request_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  -- 결재자 직원 FK
  approver_employee_id INTEGER,
  -- 결재 완료 시각
  approved_at TEXT,
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 수정 시간
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (start_date <= end_date),
  FOREIGN KEY (employee_id) REFERENCES hr_employees (id) ON DELETE CASCADE,
  FOREIGN KEY (approver_employee_id) REFERENCES hr_employees (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role_id ON auth_user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department_id ON hr_employees (department_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees (employment_status);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_daily_work_date ON hr_attendance_daily (work_date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_daily_status ON hr_attendance_daily (attendance_status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests (request_status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_range ON hr_leave_requests (start_date, end_date);

