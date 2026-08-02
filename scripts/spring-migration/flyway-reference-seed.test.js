"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { buildArtifact } = require("./flyway-reference-seed");

const artifact = buildArtifact(`-- pg_dump fixture
INSERT INTO public.auth_roles VALUES (1, 'employee', 'Employee', '2024-10-11 12:13:14');
INSERT INTO public.org_departments VALUES (1, 'HQ-HR', 'HR', NULL, 'HQ', 'CC-01', 'People', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.org_corporations VALUES (1, 'VIBE', 'VIBE', 'Vibe HR', '111', '222', NULL, NULL, NULL, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_code_groups VALUES (1, 'ORG_MAPPING_TYPE', 'Mapping', 'Types', true, 10, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_codes VALUES (1, 1, 'HQ', 'HQ', NULL, true, 10, NULL, NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_menus VALUES (1, 'dashboard', 'Dashboard', NULL, '/dashboard', 'Home', 10, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_menus VALUES (2, 'wel', 'Welfare', NULL, NULL, 'Heart', 20, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_menus VALUES (3, 'wel.requests', 'Requests', 2, '/wel/requests', 'List', 21, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_menus VALUES (4, 'wel.my-requests', 'My requests', 2, '/wel/my-requests', 'Clipboard', 22, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_menus VALUES (5, 'wel.benefit-types', 'Benefit types', 2, '/wel/benefit-types', 'Gift', 23, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_menu_roles VALUES (1, 1);
INSERT INTO public.app_menu_roles VALUES (2, 1);
INSERT INTO public.app_menu_roles VALUES (3, 1);
INSERT INTO public.app_menu_roles VALUES (4, 1);
INSERT INTO public.app_menu_roles VALUES (5, 1);
INSERT INTO public.app_menu_actions VALUES (1, 1, 'query', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.app_system_settings VALUES (1, 'auth.session.access_ttl_min', 'auth', 'int', '120', 'Access TTL', true, NULL, '2024-10-11 12:13:14');
INSERT INTO public.hr_retire_checklist_items VALUES (1, 'asset_return', 'Asset return', 'Laptop', true, true, 10, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.tim_attendance_codes VALUES (1, 'C01', 'Leave', 'leave', 'day', true, 1, 25, true, true, 10, NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.tim_work_schedule_codes VALUES (1, 'WS01', 'Standard', '09:00', '18:00', 60, false, 8, true, 10, NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.tim_schedule_patterns VALUES (1, 'PTN_DEPT_STD', 'Standard', NULL, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.tim_schedule_pattern_days VALUES (1, 1, 0, true, '09:00', '18:00', 60, 480, false);
INSERT INTO public.tim_department_schedule_assignments VALUES (1, 1, 1, '2026-01-01', NULL, 100, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.tim_holidays VALUES (1, '2026-01-01', 'New year', 'legal', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public."PAP_FINAL_RESULTS" VALUES (1, 'S', 'Superior', 100, true, 10, NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public."PAP_APPRAISAL_MASTERS" VALUES (1, 'ANNUAL', 'Annual', 2026, 1, 'annual', '2026-01-01', '2026-12-31', true, 10, NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.pay_payroll_codes VALUES (1, 'P100', 'Payroll', 'monthly', '25', true, true, true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.pay_allowance_deductions VALUES (1, 'BSC', 'Base', 'allowance', 'taxable', 'fixed', true, 10, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.pay_item_groups VALUES (1, 'GR-OFFICE', 'Office', 'Office items', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.gl_accounts VALUES (1, '5100', 'Expense', 'expense', false, true, 10, '2024-10-11 12:13:14', '2024-10-11 12:13:14', false);
INSERT INTO public.pay_gl_mappings VALUES (1, 'BSC', '5100', '2020-01-01', 'Seed', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.pay_severance_item_rules VALUES (1, 'BSC', 'full', 'Base', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.hri_form_types VALUES (1, 'LEAVE_REQUEST', 'Leave request', NULL, 'TIM', true, true, true, false, 10, NULL, NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.hri_form_type_policies VALUES (1, 1, 'attachment_required', 'false', '2026-01-01', NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.hri_approval_actor_rules VALUES (1, 'TEAM_LEADER', 'ORG_CHAIN', 'HR_ADMIN', '["team lead"]', true, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.hri_approval_line_templates VALUES (1, 'HRI_TMPL_CERT', 'Certificate', 'GLOBAL', NULL, false, true, 10, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.hri_approval_line_steps VALUES (1, 1, 1, 'APPROVAL', 'ROLE_BASED', 'TEAM_LEADER', NULL, true, 'APPROVE', '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.hri_form_type_approval_maps VALUES (1, 1, 1, true, '2026-01-01', NULL, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.pay_tax_rates VALUES (1, 2026, 'PENSION', 4.5, 4.5, 0, 100, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.pay_income_tax_brackets VALUES (1, 2026, 0, 100, 6, 0, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
INSERT INTO public.wel_benefit_types VALUES (1, 'MEDICAL', 'Medical', '/wel/medical', false, NULL, true, 10, '2024-10-11 12:13:14', '2024-10-11 12:13:14');
`);

assert.strictEqual(artifact.rowCount, 41);
assert.strictEqual(artifact.tables.length, 33);
assert.ok(artifact.sql.includes("target.\"code\" IS NOT DISTINCT FROM source.\"code\""));
assert.ok(artifact.sql.includes("SET \"name\" = source.\"name\""));
assert.ok(artifact.sql.includes("SET \"is_active\" = false"));
assert.ok(artifact.sql.includes("Python welfare overrides replace role links"));
assert.ok(artifact.sql.includes("Python replaces steps only for canonical templates"));
assert.ok(!artifact.sql.includes("ON CONFLICT DO NOTHING"));
assert.ok(!artifact.sql.includes('"app_menus"_ids'));
assert.ok(!artifact.sql.includes("SELECT 'app_menu_roles', source.\"id\""));

function assertParseSafeTypedCtes(sql) {
  assert.match(sql, /WITH source_rows \([^)]*\) AS \(/);
  assert.doesNotMatch(sql, /\bWITH\s+seed\b/i);
  assert.match(sql, /VALUES\s*\n\s*\(CAST\(1 AS integer\), CAST\('[^']+' AS character varying\)/);
  assert.match(sql, /CAST\('2026-01-01 00:00:00' AS timestamp without time zone\)/);
}

assertParseSafeTypedCtes(artifact.sql);
assertParseSafeTypedCtes(fs.readFileSync(path.resolve(__dirname, "..", "..", "backend-spring", "src", "main", "resources", "db", "migration", "V3__required_reference_data.sql"), "utf8"));
process.stdout.write("flyway-reference-seed unit checks passed.\n");
