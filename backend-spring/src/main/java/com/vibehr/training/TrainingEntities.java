package com.vibehr.training;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@MappedSuperclass
abstract class TrainingAudit {
    protected TrainingAudit() { }
    @Column(nullable = false) public Instant created_at;
    @Column(nullable = false) public Instant updated_at;
}

@Entity(name = "TraOrganization") @Table(name = "tra_organizations")
class TraOrganization extends TrainingAudit {
    protected TraOrganization() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 30) public String code;
    @Column(nullable = false, length = 200) public String name;
    @Column(length = 40) public String business_no;
    @Column(length = 100) public String contact_name;
    @Column(length = 40) public String contact_phone;
    @Column(length = 320) public String contact_email;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TraCourse") @Table(name = "tra_courses")
class TraCourse extends TrainingAudit {
    protected TraCourse() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 40) public String course_code;
    @Column(nullable = false, length = 200) public String course_name;
    @Column(nullable = false, length = 20) public String in_out_type;
    @Column(length = 30) public String branch_code;
    @Column(length = 30) public String sub_branch_code;
    @Column(length = 30) public String method_code;
    @Column(nullable = false, length = 30) public String status_code;
    public Integer organization_id;
    @Column(nullable = false) public boolean mandatory_yn;
    @Column(length = 30) public String job_code;
    @Column(length = 30) public String edu_level;
    @Column(length = 2000) public String memo;
    @Column(length = 2000) public String note;
    @Column(length = 40) public String manager_employee_no;
    @Column(length = 40) public String manager_phone;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TraEvent") @Table(name = "tra_events")
class TraEvent extends TrainingAudit {
    protected TraEvent() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int course_id;
    @Column(nullable = false, length = 40) public String event_code;
    @Column(nullable = false, length = 200) public String event_name;
    @Column(nullable = false, length = 30) public String status_code;
    public Integer organization_id;
    @Column(length = 200) public String place;
    public LocalDate start_date;
    public LocalDate end_date;
    @Column(length = 10) public String start_time;
    @Column(length = 10) public String end_time;
    @Column(nullable = false) public int edu_day;
    @Column(nullable = false) public double edu_hour;
    public LocalDate appl_start_date;
    public LocalDate appl_end_date;
    @Column(nullable = false, length = 20) public String currency_code;
    @Column(nullable = false) public double per_expense_amount;
    @Column(nullable = false) public double real_expense_amount;
    @Column(nullable = false) public boolean labor_apply_yn;
    @Column(nullable = false) public double labor_amount;
    @Column(nullable = false) public boolean labor_return_yn;
    public LocalDate labor_return_date;
    @Column(nullable = false) public boolean result_app_skip_yn;
    @Column(nullable = false) public int max_person;
    @Column(length = 2000) public String note;
    @Column(length = 40) public String manager_employee_no;
    @Column(length = 40) public String manager_phone;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TraRequiredRule") @Table(name = "tra_required_rules")
class TraRequiredRule extends TrainingAudit {
    protected TraRequiredRule() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int year;
    @Column(nullable = false, length = 30) public String rule_code;
    @Column(nullable = false) public int order_seq;
    @Column(length = 30) public String job_grade_code;
    public Integer job_grade_year;
    @Column(length = 30) public String job_code;
    public Integer search_seq;
    public Integer entry_month;
    @Column(nullable = false) public int start_month;
    @Column(nullable = false) public int end_month;
    @Column(nullable = false) public int course_id;
    @Column(length = 30) public String edu_level;
    @Column(length = 2000) public String note;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TraApplication") @Table(name = "tra_applications")
class TraApplication extends TrainingAudit {
    protected TraApplication() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 40) public String application_no;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int course_id;
    public Integer event_id;
    @Column(length = 20) public String in_out_type;
    @Column(length = 30) public String job_code;
    @Column(nullable = false) public boolean year_plan_yn;
    @Column(length = 2000) public String edu_memo;
    @Column(length = 2000) public String note;
    @Column(nullable = false) public boolean survey_yn;
    public Integer approval_request_id;
    @Column(nullable = false, length = 20) public String status;
}

@Entity(name = "TraRequiredTarget") @Table(name = "tra_required_targets")
class TraRequiredTarget extends TrainingAudit {
    protected TraRequiredTarget() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int year;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false, length = 30) public String rule_code;
    @Column(nullable = false) public int course_id;
    @Column(nullable = false, length = 6) public String edu_month;
    public Integer event_id;
    public Integer application_id;
    public Integer standard_rule_id;
    @Column(length = 30) public String edu_level;
    @Column(nullable = false, length = 20) public String completion_status;
    @Column(nullable = false) public int completed_count;
    @Column(length = 1000) public String note;
    @Column(length = 1000) public String error_note;
}

@Entity(name = "TraHistory") @Table(name = "tra_histories")
class TraHistory extends TrainingAudit {
    protected TraHistory() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int course_id;
    public Integer event_id;
    public Integer application_id;
    @Column(nullable = false, length = 1) public String confirm_type;
    @Column(length = 1000) public String unconfirm_reason;
    public Double app_point;
    @Column(length = 30) public String job_code;
    @Column(length = 2000) public String note;
    public LocalDate completed_at;
}

@Entity(name = "TraElearningWindow") @Table(name = "tra_elearning_windows")
class TraElearningWindow extends TrainingAudit {
    protected TraElearningWindow() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 6) public String year_month;
    @Column(nullable = false) public LocalDate start_date;
    @Column(nullable = false) public LocalDate end_date;
    @Column(nullable = false) public int app_count;
    @Column(length = 1000) public String note;
}

@Entity(name = "TraCyberUpload") @Table(name = "tra_cyber_uploads")
class TraCyberUpload extends TrainingAudit {
    protected TraCyberUpload() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 6) public String upload_ym;
    @Column(length = 40) public String employee_no;
    public Integer employee_id;
    @Column(nullable = false, length = 200) public String course_name;
    public LocalDate start_date;
    public LocalDate end_date;
    @Column(nullable = false) public double reward_hour;
    @Column(nullable = false) public double edu_hour;
    @Column(nullable = false) public boolean labor_apply_yn;
    @Column(nullable = false) public double labor_amount;
    @Column(nullable = false) public double per_expense_amount;
    @Column(nullable = false) public double real_expense_amount;
    @Column(nullable = false, length = 1) public String confirm_type;
    @Column(length = 1000) public String unconfirm_reason;
    @Column(length = 30) public String edu_branch_code;
    @Column(length = 30) public String edu_sub_branch_code;
    @Column(length = 20) public String in_out_type;
    @Column(length = 30) public String method_code;
    @Column(length = 200) public String organization_name;
    @Column(length = 40) public String business_no;
    @Column(nullable = false) public boolean mandatory_yn;
    @Column(length = 30) public String job_code;
    @Column(length = 30) public String edu_level;
    @Column(length = 200) public String event_name;
    @Column(length = 200) public String place;
    @Column(nullable = false) public boolean close_yn;
    public Integer applied_course_id;
    public Integer applied_event_id;
    public Integer applied_history_id;
    @Column(length = 2000) public String note;
}
