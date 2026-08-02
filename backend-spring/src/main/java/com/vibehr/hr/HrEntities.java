package com.vibehr.hr;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@MappedSuperclass
abstract class HrAuditedEntity {
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant created_at;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant updated_at;
}

@Entity(name = "HrEmployee")
@Table(name = "hr_employees", uniqueConstraints = {
        @UniqueConstraint(name = "uq_hr_employees_user_id", columnNames = "user_id"),
        @UniqueConstraint(name = "uq_hr_employees_employee_no", columnNames = "employee_no")
}, indexes = @Index(name = "ix_hr_employees_employee_no", columnList = "employee_no"))
@Check(name = "ck_hr_employees_employment_status", constraints = "employment_status IN ('active', 'leave', 'resigned')")
class HrEmployee extends HrAuditedEntity {
    protected HrEmployee() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int user_id;
    @Column(nullable = false, length = 30) public String employee_no;
    @Column(nullable = false) public int department_id;
    @Column(nullable = false, length = 80) public String position_title;
    @Column(nullable = false) public LocalDate hire_date;
    @Column(nullable = false, length = 20) public String employment_status;
}

@Entity(name = "HrEmployeeBasicProfile")
@Table(name = "hr_employee_basic_profiles",
        uniqueConstraints = @UniqueConstraint(name = "uq_hr_employee_basic_profiles_employee_id", columnNames = "employee_id"),
        indexes = @Index(name = "ix_hr_employee_basic_profiles_employee_id", columnList = "employee_id"))
class HrEmployeeBasicProfile extends HrAuditedEntity {
    protected HrEmployeeBasicProfile() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(length = 20) public String gender;
    @Column(length = 30) public String resident_no_masked;
    public LocalDate birth_date;
    public LocalDate retire_date;
    @Column(length = 10) public String blood_type;
    @Column(length = 20) public String marital_status;
    @Column(length = 10) public String mbti;
    public LocalDate probation_end_date;
    @Column(length = 80) public String job_family;
    @Column(length = 80) public String job_role;
    @Column(length = 40) public String grade;
}

@Entity(name = "HrEmployeeInfoRecord")
@Table(name = "hr_employee_info_records", indexes = {
        @Index(name = "ix_hr_employee_info_records_category", columnList = "category"),
        @Index(name = "ix_hr_employee_info_records_employee_id", columnList = "employee_id")
})
class HrEmployeeInfoRecord {
    protected HrEmployeeInfoRecord() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false, length = 40) public String category;
    public LocalDate record_date;
    @Column(length = 120) public String title;
    @Column(length = 80) public String type;
    @Column(length = 120) public String organization;
    @Column(length = 200) public String value;
    @Column(length = 500) public String note;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant created_at;
}

@Entity(name = "HrContactPoint")
@Table(name = "hr_contact_points", indexes = {
        @Index(name = "ix_hr_contact_points_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_contact_points_employee_record_date", columnList = "employee_id,record_date")
})
class HrContactPoint extends HrAuditedEntity {
    protected HrContactPoint() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int seq;
    @Column(length = 50) public String contact_type;
    public LocalDate record_date;
    @Column(length = 20) public String zip_code;
    @Column(length = 300) public String addr1;
    @Column(length = 300) public String addr2;
    @Column(length = 40) public String phone_mobile;
    @Column(length = 40) public String phone_home;
    @Column(length = 40) public String phone_work;
    @Column(length = 320) public String email;
    @Column(length = 100) public String emergency_name;
    @Column(length = 50) public String emergency_relation;
    @Column(length = 40) public String emergency_phone;
    @Column(nullable = false) public boolean is_primary;
    public LocalDate valid_from;
    public LocalDate valid_to;
    @Column(length = 500) public String note;
    public Integer created_by;
    public Integer updated_by;
}

@Entity(name = "HrCareer")
@Table(name = "hr_careers", indexes = {
        @Index(name = "ix_hr_careers_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_careers_employee_record_date", columnList = "employee_id,record_date")
})
@Check(name = "ck_hr_careers_scope", constraints = "career_scope IN ('INTERNAL', 'EXTERNAL')")
class HrCareer extends HrAuditedEntity {
    protected HrCareer() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int seq;
    @Column(nullable = false, length = 20) public String career_scope;
    public LocalDate record_date;
    @Column(length = 120) public String company_name;
    @Column(length = 120) public String department_name;
    @Column(length = 120) public String position_title;
    @Column(length = 120) public String job_title;
    public LocalDate start_date;
    public LocalDate end_date;
    @Column(nullable = false) public boolean is_current;
    public Integer career_years;
    public Integer career_months;
    @Column(length = 1000) public String description;
    @Column(length = 500) public String note;
    public Integer created_by;
    public Integer updated_by;
}

@Entity(name = "HrLicense")
@Table(name = "hr_licenses", indexes = {
        @Index(name = "ix_hr_licenses_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_licenses_employee_record_date", columnList = "employee_id,record_date")
})
class HrLicense extends HrAuditedEntity {
    protected HrLicense() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int seq;
    @Column(length = 60) public String license_type;
    @Column(length = 60) public String license_code;
    @Column(length = 120) public String license_name;
    @Column(length = 60) public String license_grade;
    @Column(length = 120) public String license_no;
    @Column(length = 120) public String issued_org;
    public LocalDate record_date;
    public LocalDate issued_date;
    public LocalDate renewal_date;
    public LocalDate expire_date;
    @Column(nullable = false) public boolean allowance_yn;
    public Double allowance_rate;
    public Double allowance_amount;
    @Column(length = 500) public String note;
    public Integer created_by;
    public Integer updated_by;
}

@Entity(name = "HrMilitary")
@Table(name = "hr_military", indexes = {
        @Index(name = "ix_hr_military_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_military_employee_record_date", columnList = "employee_id,record_date")
})
class HrMilitary extends HrAuditedEntity {
    protected HrMilitary() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int seq;
    @Column(length = 60) public String military_type;
    @Column(length = 60) public String branch;
    @Column(length = 60) public String rank;
    public LocalDate record_date;
    public LocalDate service_start_date;
    public LocalDate service_end_date;
    @Column(length = 60) public String discharge_type;
    @Column(length = 500) public String exemption_reason;
    @Column(nullable = false) public boolean special_case_yn;
    @Column(length = 60) public String special_case_type;
    @Column(length = 500) public String note;
    public Integer created_by;
    public Integer updated_by;
}

@Entity(name = "HrRewardPunish")
@Table(name = "hr_reward_punish", indexes = {
        @Index(name = "ix_hr_reward_punish_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_reward_punish_employee_action_date", columnList = "employee_id,action_date"),
        @Index(name = "ix_hr_reward_punish_request_status", columnList = "hri_request_id,status")
})
@Check(name = "ck_hr_reward_punish_type", constraints = "reward_punish_type IN ('REWARD', 'PUNISH')")
@Check(name = "ck_hr_reward_punish_status", constraints = "status IN ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'CONFIRMED')")
class HrRewardPunish extends HrAuditedEntity {
    protected HrRewardPunish() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int seq;
    @Column(nullable = false, length = 20) public String reward_punish_type;
    @Column(length = 60) public String code;
    @Column(length = 120) public String title;
    @Column(length = 1000) public String reason;
    public LocalDate action_date;
    @Column(length = 120) public String office_name;
    public Double amount;
    @Column(nullable = false, length = 20) public String status;
    public Integer hri_request_id;
    @Column(length = 500) public String note;
    public Integer created_by;
    public Integer updated_by;
}

@Entity(name = "HrAppointmentOrder")
@Table(name = "hr_appointment_orders",
        uniqueConstraints = @UniqueConstraint(name = "uq_hr_appointment_orders_no", columnNames = "appointment_no"),
        indexes = {
                @Index(name = "ix_hr_appointment_orders_appointment_no", columnList = "appointment_no"),
                @Index(name = "ix_hr_appointment_orders_effective_date", columnList = "effective_date"),
                @Index(name = "ix_hr_appointment_orders_status_effective", columnList = "status,effective_date")
        })
@Check(name = "ck_hr_appointment_orders_status", constraints = "status IN ('draft', 'confirmed', 'cancelled')")
class HrAppointmentOrder extends HrAuditedEntity {
    protected HrAppointmentOrder() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 30) public String appointment_no;
    public Integer appointment_code_id;
    @Column(nullable = false, length = 120) public String title;
    @Column(length = 500) public String description;
    @Column(nullable = false) public LocalDate effective_date;
    @Column(nullable = false, length = 20) public String status;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant confirmed_at;
    public Integer confirmed_by;
    public Integer created_by;
}

@Entity(name = "HrAppointmentOrderItem")
@Table(name = "hr_appointment_order_items",
        uniqueConstraints = @UniqueConstraint(name = "uq_hr_appointment_order_items_order_employee", columnNames = {"order_id", "employee_id"}),
        indexes = {
                @Index(name = "ix_hr_appointment_order_items_employee_id", columnList = "employee_id"),
                @Index(name = "ix_hr_appointment_order_items_employee_start", columnList = "employee_id,start_date"),
                @Index(name = "ix_hr_appointment_order_items_end_date", columnList = "end_date"),
                @Index(name = "ix_hr_appointment_order_items_kind", columnList = "appointment_kind"),
                @Index(name = "ix_hr_appointment_order_items_order_apply", columnList = "order_id,apply_status"),
                @Index(name = "ix_hr_appointment_order_items_order_id", columnList = "order_id"),
                @Index(name = "ix_hr_appointment_order_items_start_date", columnList = "start_date")
        })
@Check(name = "ck_hr_appointment_order_items_kind", constraints = "appointment_kind IN ('permanent', 'temporary')")
@Check(name = "ck_hr_appointment_order_items_apply_status", constraints = "apply_status IN ('pending', 'applied', 'cancelled')")
@Check(name = "ck_hr_appointment_order_items_temporary_end_date", constraints = "(appointment_kind = 'permanent') OR (appointment_kind = 'temporary' AND end_date IS NOT NULL)")
class HrAppointmentOrderItem extends HrAuditedEntity {
    protected HrAppointmentOrderItem() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int order_id;
    @Column(nullable = false) public int employee_id;
    public Integer appointment_code_id;
    @Column(nullable = false, length = 20) public String appointment_kind;
    @Column(nullable = false, length = 30) public String action_type;
    @Column(nullable = false) public LocalDate start_date;
    public LocalDate end_date;
    public Integer from_department_id;
    public Integer to_department_id;
    @Column(length = 80) public String from_position_title;
    @Column(length = 80) public String to_position_title;
    @Column(length = 20) public String from_employment_status;
    @Column(length = 20) public String to_employment_status;
    @Column(nullable = false, length = 20) public String apply_status;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant applied_at;
    @Column(length = 500) public String temporary_reason;
    @Column(length = 500) public String note;
}

@Entity(name = "HrPersonnelHistory")
@Table(name = "hr_personnel_histories", indexes = {
        @Index(name = "ix_hr_personnel_histories_effective_date", columnList = "effective_date"),
        @Index(name = "ix_hr_personnel_histories_employee_effective", columnList = "employee_id,effective_date"),
        @Index(name = "ix_hr_personnel_histories_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_personnel_histories_history_type", columnList = "history_type"),
        @Index(name = "ix_hr_personnel_histories_source", columnList = "source_table,source_id"),
        @Index(name = "ix_hr_personnel_histories_source_id", columnList = "source_id")
})
class HrPersonnelHistory {
    protected HrPersonnelHistory() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false, length = 30) public String history_type;
    @Column(nullable = false, length = 50) public String source_table;
    @Column(nullable = false) public int source_id;
    public Integer appointment_order_id;
    @Column(nullable = false) public LocalDate effective_date;
    @Column(length = 60) public String field_name;
    @Column(length = 200) public String before_value;
    @Column(length = 200) public String after_value;
    @Column(length = 500) public String description;
    public Integer created_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant created_at;
}

@Entity(name = "HrRetireChecklistItem")
@Table(name = "hr_retire_checklist_items",
        uniqueConstraints = @UniqueConstraint(name = "uq_hr_retire_checklist_items_code", columnNames = "code"),
        indexes = {
                @Index(name = "ix_hr_retire_checklist_items_active_sort", columnList = "is_active,sort_order"),
                @Index(name = "ix_hr_retire_checklist_items_code", columnList = "code")
        })
class HrRetireChecklistItem extends HrAuditedEntity {
    protected HrRetireChecklistItem() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 50) public String code;
    @Column(nullable = false, length = 120) public String title;
    @Column(length = 500) public String description;
    @Column(nullable = false) public boolean is_required;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public int sort_order;
}

@Entity(name = "HrRetireCase")
@Table(name = "hr_retire_cases", indexes = {
        @Index(name = "ix_hr_retire_cases_employee_created", columnList = "employee_id,created_at"),
        @Index(name = "ix_hr_retire_cases_employee_id", columnList = "employee_id"),
        @Index(name = "ix_hr_retire_cases_retire_date", columnList = "retire_date"),
        @Index(name = "ix_hr_retire_cases_status_date", columnList = "status,retire_date")
})
@Check(name = "ck_hr_retire_cases_status", constraints = "status IN ('draft', 'confirmed', 'cancelled')")
class HrRetireCase extends HrAuditedEntity {
    protected HrRetireCase() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public LocalDate retire_date;
    @Column(length = 500) public String reason;
    @Column(nullable = false, length = 20) public String status;
    @Column(length = 20) public String previous_employment_status;
    public Integer requested_by;
    public Integer confirmed_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant confirmed_at;
    public Integer cancelled_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant cancelled_at;
    @Column(length = 500) public String cancel_reason;
}

@Entity(name = "HrRetireCaseItem")
@Table(name = "hr_retire_case_items",
        uniqueConstraints = @UniqueConstraint(name = "uq_hr_retire_case_items_case_checklist", columnNames = {"case_id", "checklist_item_id"}),
        indexes = {
                @Index(name = "ix_hr_retire_case_items_case_checked", columnList = "case_id,is_checked"),
                @Index(name = "ix_hr_retire_case_items_case_id", columnList = "case_id"),
                @Index(name = "ix_hr_retire_case_items_checklist_item_id", columnList = "checklist_item_id")
        })
class HrRetireCaseItem extends HrAuditedEntity {
    protected HrRetireCaseItem() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int case_id;
    @Column(nullable = false) public int checklist_item_id;
    @Column(nullable = false) public boolean is_required;
    @Column(nullable = false) public boolean is_checked;
    public Integer checked_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant checked_at;
    @Column(length = 500) public String note;
}

@Entity(name = "HrRetireAuditLog")
@Table(name = "hr_retire_audit_logs", indexes = {
        @Index(name = "ix_hr_retire_audit_logs_action_type", columnList = "action_type"),
        @Index(name = "ix_hr_retire_audit_logs_case_created", columnList = "case_id,created_at"),
        @Index(name = "ix_hr_retire_audit_logs_case_id", columnList = "case_id")
})
class HrRetireAuditLog {
    protected HrRetireAuditLog() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int case_id;
    @Column(nullable = false, length = 30) public String action_type;
    public Integer actor_user_id;
    @Column(length = 1000) public String detail;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant created_at;
}

@Entity(name = "HrRecruitFinalist")
@Table(name = "hr_recruit_finalists",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_hr_recruit_finalists_no", columnNames = "candidate_no"),
                @UniqueConstraint(name = "uq_hr_recruit_finalists_external_key", columnNames = "external_key")
        }, indexes = {
                @Index(name = "ix_hr_recruit_finalists_candidate_no", columnList = "candidate_no"),
                @Index(name = "ix_hr_recruit_finalists_employee_no", columnList = "employee_no"),
                @Index(name = "ix_hr_recruit_finalists_external_key", columnList = "external_key"),
                @Index(name = "ix_hr_recruit_finalists_status_created", columnList = "status_code,created_at")
        })
@Check(name = "ck_hr_recruit_finalists_source_type", constraints = "source_type IN ('if', 'manual')")
@Check(name = "ck_hr_recruit_finalists_hire_type", constraints = "hire_type IN ('new', 'experienced')")
@Check(name = "ck_hr_recruit_finalists_status_code", constraints = "status_code IN ('draft', 'ready', 'appointed')")
class HrRecruitFinalist extends HrAuditedEntity {
    protected HrRecruitFinalist() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 30) public String candidate_no;
    @Column(nullable = false, length = 20) public String source_type;
    @Column(length = 100) public String external_key;
    @Column(nullable = false, length = 100) public String full_name;
    @Column(length = 30) public String resident_no_masked;
    public LocalDate birth_date;
    @Column(length = 40) public String phone_mobile;
    @Column(length = 320) public String email;
    @Column(nullable = false, length = 20) public String hire_type;
    public Integer career_years;
    @Column(length = 50) public String login_id;
    @Column(length = 30) public String employee_no;
    public LocalDate expected_join_date;
    @Column(nullable = false, length = 20) public String status_code;
    @Column(length = 500) public String note;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "HrSeveranceCalc")
@Table(name = "hr_severance_calcs",
        uniqueConstraints = @UniqueConstraint(name = "uq_hr_severance_calcs_retire_case_id", columnNames = "retire_case_id"),
        indexes = {
                @Index(name = "ix_hr_severance_calcs_employee_id", columnList = "employee_id"),
                @Index(name = "ix_hr_severance_calcs_employee_status", columnList = "employee_id,status"),
                @Index(name = "ix_hr_severance_calcs_retire_case_id", columnList = "retire_case_id"),
                @Index(name = "ix_hr_severance_calcs_retire_date", columnList = "retire_date")
        })
@Check(name = "ck_hr_severance_calcs_status", constraints = "status IN ('draft', 'reviewed', 'confirmed')")
class HrSeveranceCalc extends HrAuditedEntity {
    protected HrSeveranceCalc() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int retire_case_id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public LocalDate hire_date;
    @Column(nullable = false) public LocalDate retire_date;
    @Column(nullable = false) public int service_days;
    public LocalDate avg_wage_base_from;
    public LocalDate avg_wage_base_to;
    @Column(nullable = false) public Double wage_total_3m;
    @Column(nullable = false) public int base_days_3m;
    @Column(nullable = false) public Double avg_daily_wage;
    @Column(nullable = false) public Double severance_amount;
    @Column(nullable = false) public Double adjustment_amount;
    @Column(length = 500) public String adjustment_reason;
    @Column(nullable = false) public Double final_amount;
    @Column(nullable = false, length = 20) public String status;
    @Column(length = 500) public String warning;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant calculated_at;
    public Integer confirmed_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant confirmed_at;
    @Column(nullable = false) public int service_years;
    @Column(nullable = false) public Double income_tax;
    @Column(nullable = false) public Double local_income_tax;
    @Column(nullable = false) public Double net_severance;
    @Column(columnDefinition = "varchar") public String tax_detail_json;
}
