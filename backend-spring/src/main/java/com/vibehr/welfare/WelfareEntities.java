package com.vibehr.welfare;

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

@MappedSuperclass
abstract class WelfareAudit {
    @Column(nullable = false) public Instant created_at;
    @Column(nullable = false) public Instant updated_at;
}

@Entity(name = "WelBenefitType")
@Table(name = "wel_benefit_types",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_wel_benefit_types_code", columnNames = "code"),
                @UniqueConstraint(name = "uq_wel_benefit_types_module_path", columnNames = "module_path")
        },
        indexes = @Index(name = "ix_wel_benefit_types_code", columnList = "code"))
class WelBenefitType extends WelfareAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 40) public String code;
    @Column(nullable = false, length = 100) public String name;
    @Column(nullable = false, length = 200) public String module_path;
    @Column(nullable = false) public boolean is_deduction;
    @Column(length = 60) public String pay_item_code;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public int sort_order;
}

@Entity(name = "WelBenefitRequest")
@Table(name = "wel_benefit_requests",
        uniqueConstraints = @UniqueConstraint(name = "uq_wel_benefit_requests_request_no", columnNames = "request_no"),
        indexes = {
                @Index(name = "ix_wel_benefit_requests_benefit_type_code", columnList = "benefit_type_code"),
                @Index(name = "ix_wel_benefit_requests_employee_id", columnList = "employee_id"),
                @Index(name = "ix_wel_benefit_requests_employee_no", columnList = "employee_no"),
                @Index(name = "ix_wel_benefit_requests_request_no", columnList = "request_no"),
                @Index(name = "ix_wel_benefit_requests_status_code", columnList = "status_code")
        })
class WelBenefitRequest extends WelfareAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 40) public String request_no;
    @Column(nullable = false, length = 40) public String benefit_type_code;
    @Column(nullable = false, length = 100) public String benefit_type_name;
    public Integer employee_id;
    @Column(nullable = false, length = 40) public String employee_no;
    @Column(nullable = false, length = 100) public String employee_name;
    @Column(nullable = false, length = 120) public String department_name;
    @Column(nullable = false, length = 30) public String status_code;
    @Column(nullable = false) public int requested_amount;
    public Integer approved_amount;
    @Column(length = 120) public String payroll_run_label;
    @Column(length = 500) public String description;
    @Column(nullable = false) public Instant requested_at;
    public Instant approved_at;
}
