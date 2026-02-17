PRAGMA foreign_keys = ON;

-- ===========================================
-- 메뉴 기반 권한 관리 스키마
-- 화면(메뉴)별 역할 매핑을 통한 접근 제어
-- ===========================================

-- 화면/메뉴 마스터 (계층형)
CREATE TABLE IF NOT EXISTS app_menus (
  -- 메뉴 PK
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 메뉴 코드 (고유, 예: 'hr.employee', 'payroll.calc')
  code TEXT NOT NULL UNIQUE,
  -- 메뉴명
  name TEXT NOT NULL,
  -- 상위 메뉴 FK (NULL이면 최상위)
  parent_id INTEGER,
  -- 프론트엔드 라우트 경로 (NULL이면 그룹 메뉴)
  path TEXT,
  -- 아이콘 이름 (lucide-react 아이콘명)
  icon TEXT,
  -- 정렬 순서
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- 사용 여부
  is_active INTEGER NOT NULL DEFAULT 1,
  -- 생성 시간
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 수정 시간
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES app_menus (id) ON DELETE SET NULL
);

-- 메뉴-역할 매핑 (N:M)
CREATE TABLE IF NOT EXISTS app_menu_roles (
  -- 메뉴 FK
  menu_id INTEGER NOT NULL,
  -- 역할 FK
  role_id INTEGER NOT NULL,
  PRIMARY KEY (menu_id, role_id),
  FOREIGN KEY (menu_id) REFERENCES app_menus (id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES auth_roles (id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_app_menus_parent_id ON app_menus (parent_id);
CREATE INDEX IF NOT EXISTS idx_app_menus_sort_order ON app_menus (sort_order);
CREATE INDEX IF NOT EXISTS idx_app_menu_roles_role_id ON app_menu_roles (role_id);

-- ===========================================
-- 추가 역할 시드 데이터
-- ===========================================
INSERT OR IGNORE INTO auth_roles (code, name) VALUES ('payroll_mgr', '급여담당자');

-- ===========================================
-- 메뉴 시드 데이터 (계층형)
-- ===========================================

-- 1) 대시보드 (최상위, 모든 역할)
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('dashboard', '대시보드', NULL, '/dashboard', 'LayoutDashboard', 100);

-- 2) 인사관리 그룹
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('hr', '인사관리', NULL, NULL, 'UsersRound', 200);

-- 3) 인사관리 하위
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('hr.employee', '사원관리', (SELECT id FROM app_menus WHERE code = 'hr'), '/hr/employee', 'UserRound', 210);
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('hr.attendance', '근태관리', (SELECT id FROM app_menus WHERE code = 'hr'), '/hr/attendance', 'Clock', 220);
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('hr.leave', '휴가관리', (SELECT id FROM app_menus WHERE code = 'hr'), '/hr/leave', 'CalendarDays', 230);

-- 4) 급여관리 그룹
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('payroll', '급여관리', NULL, NULL, 'Wallet', 300);

-- 5) 급여관리 하위
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('payroll.calc', '급여계산', (SELECT id FROM app_menus WHERE code = 'payroll'), '/payroll/calc', 'Calculator', 310);
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('payroll.slip', '급여명세서', (SELECT id FROM app_menus WHERE code = 'payroll'), '/payroll/slip', 'FileText', 320);

-- 6) 설정 그룹
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('settings', '설정', NULL, NULL, 'Settings', 900);

-- 7) 설정 하위
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('settings.roles', '권한관리', (SELECT id FROM app_menus WHERE code = 'settings'), '/settings/roles', 'Shield', 910);
INSERT OR IGNORE INTO app_menus (code, name, parent_id, path, icon, sort_order)
VALUES ('settings.menus', '메뉴관리', (SELECT id FROM app_menus WHERE code = 'settings'), '/settings/menus', 'Menu', 920);

-- ===========================================
-- 메뉴-역할 매핑 시드 데이터
-- ===========================================

-- 대시보드: 모든 역할
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'dashboard' AND r.code IN ('employee', 'hr_manager', 'payroll_mgr', 'admin');

-- 인사관리 그룹: hr_manager, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'hr' AND r.code IN ('hr_manager', 'admin');

-- 사원관리: hr_manager, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'hr.employee' AND r.code IN ('hr_manager', 'admin');

-- 근태관리: employee, hr_manager, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'hr.attendance' AND r.code IN ('employee', 'hr_manager', 'admin');

-- 휴가관리: employee, hr_manager, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'hr.leave' AND r.code IN ('employee', 'hr_manager', 'admin');

-- 급여관리 그룹: payroll_mgr, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'payroll' AND r.code IN ('payroll_mgr', 'admin');

-- 급여계산: payroll_mgr, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'payroll.calc' AND r.code IN ('payroll_mgr', 'admin');

-- 급여명세서: employee, payroll_mgr, admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'payroll.slip' AND r.code IN ('employee', 'payroll_mgr', 'admin');

-- 설정 그룹: admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'settings' AND r.code = 'admin';

-- 권한관리: admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'settings.roles' AND r.code = 'admin';

-- 메뉴관리: admin
INSERT OR IGNORE INTO app_menu_roles (menu_id, role_id)
SELECT m.id, r.id FROM app_menus m, auth_roles r
WHERE m.code = 'settings.menus' AND r.code = 'admin';
