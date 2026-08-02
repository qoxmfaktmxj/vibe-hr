package com.vibehr.time;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@MappedSuperclass
abstract class TimeAudit {
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant created_at;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant updated_at;
}

@Entity(name = "TimAttendanceCode") @Table(name = "tim_attendance_codes")
class TimAttendanceCode extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 20) public String code;
    @Column(nullable = false, length = 100) public String name;
    @Column(nullable = false, length = 20) public String category;
    @Column(nullable = false, length = 20) public String unit;
    @Column(nullable = false) public boolean is_requestable;
    public Double min_days;
    public Double max_days;
    @Column(nullable = false) public boolean deduct_annual;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public int sort_order;
    @Column(length = 200) public String description;
}

@Entity(name = "TimWorkScheduleCode") @Table(name = "tim_work_schedule_codes")
class TimWorkScheduleCode extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 20) public String code;
    @Column(nullable = false, length = 100) public String name;
    @Column(nullable = false, length = 5) public String work_start;
    @Column(nullable = false, length = 5) public String work_end;
    @Column(nullable = false) public int break_minutes;
    @Column(nullable = false) public boolean is_overnight;
    @Column(nullable = false) public double work_hours;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public int sort_order;
    @Column(length = 200) public String description;
}

@Entity(name = "TimHoliday") @Table(name = "tim_holidays")
class TimHoliday extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public LocalDate holiday_date;
    @Column(nullable = false, length = 100) public String name;
    @Column(nullable = false, length = 20) public String holiday_type;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TimSchedulePattern") @Table(name = "tim_schedule_patterns")
class TimSchedulePattern extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 40) public String code;
    @Column(nullable = false, length = 120) public String name;
    @Column(length = 255) public String description;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TimSchedulePatternDay") @Table(name = "tim_schedule_pattern_days")
class TimSchedulePatternDay {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int pattern_id;
    @Column(nullable = false) public int weekday;
    @Column(nullable = false) public boolean is_workday;
    @Column(length = 5) public String start_time;
    @Column(length = 5) public String end_time;
    @Column(nullable = false) public int break_minutes;
    @Column(nullable = false) public int expected_minutes;
    @Column(nullable = false) public boolean is_overnight;
}

@Entity(name = "TimDepartmentScheduleAssignment") @Table(name = "tim_department_schedule_assignments")
class TimDepartmentScheduleAssignment extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int department_id;
    @Column(nullable = false) public int pattern_id;
    @Column(nullable = false) public LocalDate effective_from;
    public LocalDate effective_to;
    @Column(nullable = false) public int priority;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TimEmployeeScheduleException") @Table(name = "tim_employee_schedule_exceptions")
class TimEmployeeScheduleException extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int pattern_id;
    @Column(nullable = false) public LocalDate effective_from;
    public LocalDate effective_to;
    @Column(length = 255) public String reason;
    @Column(nullable = false) public int priority;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "TimEmployeeDailySchedule") @Table(name = "tim_employee_daily_schedules")
class TimEmployeeDailySchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public LocalDate work_date;
    @Column(nullable = false, length = 30) public String schedule_source;
    public Integer pattern_id;
    @Column(nullable = false) public boolean is_holiday;
    @Column(length = 120) public String holiday_name;
    @Column(nullable = false) public boolean is_workday;
    public LocalDateTime planned_start_at;
    public LocalDateTime planned_end_at;
    @Column(nullable = false) public int break_minutes;
    @Column(nullable = false) public int expected_minutes;
    @Column(nullable = false) public boolean is_overnight;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant generated_at;
    @Column(length = 50) public String version_tag;
}

@Entity(name = "TimAttendanceDaily") @Table(name = "tim_attendance_daily")
class TimAttendanceDaily extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public LocalDate work_date;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant check_in_at;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant check_out_at;
    @Column(nullable = false, length = 20) public String attendance_status;
    @Column(nullable = false) public int actual_minutes;
    @Column(nullable = false) public int regular_minutes;
    @Column(nullable = false) public int overtime_minutes;
    @Column(nullable = false) public int night_minutes;
    @Column(nullable = false) public int holiday_work_minutes;
    @Column(nullable = false) public int holiday_overtime_minutes;
    @Column(nullable = false) public int holiday_night_minutes;
    @Column(nullable = false) public boolean is_holiday_work;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant calculated_at;
}

@Entity(name = "TimAttendanceCorrection") @Table(name = "tim_attendance_corrections")
class TimAttendanceCorrection {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int attendance_id;
    @Column(nullable = false) public int corrected_by_employee_id;
    @Column(nullable = false, length = 20) public String old_status;
    @Column(nullable = false, length = 20) public String new_status;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant old_check_in_at;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant new_check_in_at;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant old_check_out_at;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant new_check_out_at;
    @Column(nullable = false, length = 500) public String reason;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(nullable = false, columnDefinition = "timestamp without time zone") public Instant corrected_at;
}

@Entity(name = "TimAnnualLeave") @Table(name = "tim_annual_leaves")
class TimAnnualLeave extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false) public int year;
    @Column(nullable = false) public double granted_days;
    @Column(nullable = false) public double used_days;
    @Column(nullable = false) public double carried_over_days;
    @Column(nullable = false) public double remaining_days;
    @Column(nullable = false, length = 20) public String grant_type;
    @Column(length = 500) public String note;
}

@Entity(name = "TimLeaveRequest") @Table(name = "tim_leave_requests")
class TimLeaveRequest extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int employee_id;
    @Column(nullable = false, length = 20) public String leave_type;
    @Column(nullable = false) public LocalDate start_date;
    @Column(nullable = false) public LocalDate end_date;
    @Column(length = 500) public String reason;
    @Column(nullable = false, length = 20) public String request_status;
    public Integer approver_employee_id;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant approved_at;
    @Column(length = 500) public String decision_comment;
    public Integer decided_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant decided_at;
}

@Entity(name = "TimMonthClose") @Table(name = "tim_month_closes")
class TimMonthClose extends TimeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int year;
    @Column(nullable = false) public int month;
    @Column(nullable = false, length = 10) public String close_status;
    @Column(nullable = false) public int employee_count;
    @Column(nullable = false) public int present_days;
    @Column(nullable = false) public int absent_days;
    @Column(nullable = false) public int late_days;
    @Column(nullable = false) public int leave_days;
    @Column(nullable = false) public int total_overtime_minutes;
    @Column(nullable = false) public int total_night_minutes;
    @Column(nullable = false) public int total_holiday_work_minutes;
    @Column(nullable = false) public int total_holiday_overtime_minutes;
    @Column(nullable = false) public int total_holiday_night_minutes;
    public Integer closed_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant closed_at;
    public Integer reopened_by;
    @JdbcTypeCode(SqlTypes.TIMESTAMP) @Column(columnDefinition = "timestamp without time zone") public Instant reopened_at;
    @Column(length = 500) public String note;
}
