# Flyway Seed Ownership Ledger

- Source: `backend/app/bootstrap.py`
- Source SHA-256: `3942aff09372f047d37eaa9938670afb79e72817ba218baf05ed40ff8ff4a285`
- Classified functions: 66

| Function | Category | Java owner | Execution |
| --- | --- | --- | --- |
| `ensure_auth_user_login_id_schema` | schema | `Flyway V1__alembic_head_baseline` | retire |
| `ensure_roles` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_departments` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_corporations` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_department` | dev-fixture | `com.vibehr.seed.DevSeedRunner` | explicit |
| `ensure_user` | dev-fixture | `com.vibehr.seed.DevSeedRunner` | explicit |
| `ensure_user_roles` | dev-fixture | `com.vibehr.seed.DevSeedRunner` | explicit |
| `ensure_employee` | dev-fixture | `com.vibehr.seed.DevSeedRunner` | explicit |
| `_build_korean_name` | large-demo-fixture | `com.vibehr.seed.DemoSeedRunner` | explicit |
| `_build_dev_login_id` | large-demo-fixture | `com.vibehr.seed.DemoSeedRunner` | explicit |
| `_build_position_title` | large-demo-fixture | `com.vibehr.seed.DemoSeedRunner` | explicit |
| `_build_department_distribution` | large-demo-fixture | `com.vibehr.seed.DemoSeedRunner` | explicit |
| `ensure_bulk_korean_employees` | large-demo-fixture | `com.vibehr.seed.DemoSeedRunner` | explicit |
| `ensure_sample_records` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `_get_or_create_menu` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `_link_menu_roles` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_menus` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_menu_actions` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_system_settings` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_common_codes` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `_count_rows` | archive-or-retire | `legacy transactional sample helper` | retire |
| `_seed_record_date` | archive-or-retire | `legacy transactional sample helper` | retire |
| `_recent_business_days` | archive-or-retire | `legacy transactional sample helper` | retire |
| `_build_legacy_hr_basic_seed_fields` | archive-or-retire | `legacy transactional sample helper` | retire |
| `ensure_hr_basic_domain_migration` | archive-or-retire | `retired after Alembic-to-Flyway cutover` | retire |
| `ensure_hr_basic_seed_data` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_hr_retire_checklist_seed` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_remove_legacy_appointment_records` | archive-or-retire | `retired after Alembic-to-Flyway cutover` | retire |
| `ensure_hr_basic_category_mapping` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_attendance_codes` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_work_schedule_codes` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_schedule_foundations` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_holidays` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_annual_leave_seed` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_tim_transaction_samples` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_pap_final_results` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pap_appraisal_masters` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pay_payroll_codes` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pay_allowance_deductions` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pay_item_groups` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_gl_seeds` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_severance_item_rule_seeds` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pay_phase2_samples` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `_month_start_offset` | archive-or-retire | `legacy transactional sample helper` | retire |
| `_build_wel_benefit_request_seed_rows` | archive-or-retire | `legacy transactional sample helper` | retire |
| `ensure_payroll_detail_visual_samples` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_hri_form_types` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_hri_form_type_policies` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_hri_approval_actor_rules` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_hri_approval_templates` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_hri_form_type_template_maps` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_hr_recruitment_cycle_seed` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_org_mapping_type_group` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pay_welfare_allowance_definitions` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_schedule_operational_samples` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_payroll_run_result_samples` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `_serialize_seed_content` | archive-or-retire | `legacy transactional sample helper` | retire |
| `_upsert_hri_request_sample` | archive-or-retire | `legacy transactional sample helper` | retire |
| `ensure_hri_request_samples` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_pay_tax_rates` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_pay_income_tax_brackets` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_wel_benefit_types` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_wel_benefit_requests` | archive-or-retire | `legacy transactional sample data is not carried across the Java cutover` | retire |
| `ensure_welfare_menu_overrides` | required-reference-permission-menu-data | `Flyway V3__required_reference_data` | versioned |
| `ensure_tra_seed_data` | archive-or-retire | `legacy training sample data is not carried across the Java cutover` | retire |
| `seed_initial_data` | archive-or-retire | `replaced by Flyway V3 plus explicit dev-seed and demo-seed profiles` | retire |
