package com.vibehr.management.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Management tables use scalar foreign keys deliberately. The referenced HR and auth aggregates
 * remain owned by their feature packages.
 */
public final class ManagementEntities {
    private ManagementEntities() {
    }

    @Entity(name = "Company")
    @Table(name = "mng_companies", uniqueConstraints = @UniqueConstraint(name = "uq_mng_companies_code", columnNames = "company_code"), indexes = @Index(name = "ix_mng_companies_company_code", columnList = "company_code"))
    public static class Company {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "company_code", nullable = false, length = 20) public String companyCode;
        @Column(name = "company_name", nullable = false, length = 100) public String companyName;
        @Column(name = "company_group_code", length = 20) public String companyGroupCode;
        @Column(name = "company_type", length = 40) public String companyType;
        @Column(name = "management_type", length = 40) public String managementType;
        @Column(name = "representative_company", length = 20) public String representativeCompany;
        @Column(name = "start_date") public LocalDate startDate;
        @Column(name = "is_active", nullable = false) public boolean active;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public Company() { }
    }

    @Entity(name = "ManagerCompany")
    @Table(name = "mng_manager_companies", uniqueConstraints = @UniqueConstraint(name = "uq_mng_manager_companies_emp_comp_sdate", columnNames = {"employee_id", "company_id", "start_date"}), indexes = {
        @Index(name = "ix_mng_manager_companies_employee_id", columnList = "employee_id"),
        @Index(name = "ix_mng_manager_companies_company_id", columnList = "company_id")
    })
    public static class ManagerCompany {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "employee_id", nullable = false) public Integer employeeId;
        @Column(name = "company_id", nullable = false) public Integer companyId;
        @Column(name = "start_date", nullable = false) public LocalDate startDate;
        @Column(name = "end_date") public LocalDate endDate;
        @Column(name = "note", length = 500) public String note;
        @Column(name = "is_active", nullable = false) public boolean active;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public ManagerCompany() { }
    }

    @Entity(name = "DevRequest")
    @Table(name = "mng_dev_requests", indexes = {
        @Index(name = "ix_mng_dev_requests_company_id", columnList = "company_id"),
        @Index(name = "ix_mng_dev_requests_company_ym", columnList = "company_id,request_ym")
    })
    public static class DevRequest {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "company_id", nullable = false) public Integer companyId;
        @Column(name = "request_ym", nullable = false) public LocalDate requestYm;
        @Column(name = "request_seq", nullable = false) public int requestSeq;
        @Column(name = "status_code", length = 20) public String statusCode;
        @Column(name = "part_code", length = 20) public String partCode;
        @Column(name = "requester_name", length = 100) public String requesterName;
        @Column(name = "request_content", columnDefinition = "varchar") public String requestContent;
        @Column(name = "manager_employee_id") public Integer managerEmployeeId;
        @Column(name = "developer_employee_id") public Integer developerEmployeeId;
        @Column(name = "is_paid", nullable = false) public boolean paid;
        @Column(name = "paid_content", length = 500) public String paidContent;
        @Column(name = "has_tax_bill", nullable = false) public boolean taxBill;
        @Column(name = "start_ym") public LocalDate startYm;
        @Column(name = "end_ym") public LocalDate endYm;
        @Column(name = "dev_start_date") public LocalDate devStartDate;
        @Column(name = "dev_end_date") public LocalDate devEndDate;
        @Column(name = "paid_man_months") public Double paidManMonths;
        @Column(name = "actual_man_months") public Double actualManMonths;
        @Column(name = "note", length = 500) public String note;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public DevRequest() { }
    }

    @Entity(name = "DevProject")
    @Table(name = "mng_dev_projects", indexes = @Index(name = "ix_mng_dev_projects_company_id", columnList = "company_id"))
    public static class DevProject {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "project_name", nullable = false, length = 200) public String projectName;
        @Column(name = "company_id", nullable = false) public Integer companyId;
        @Column(name = "part_code", length = 20) public String partCode;
        @Column(name = "assigned_staff", length = 200) public String assignedStaff;
        @Column(name = "contract_start_date") public LocalDate contractStartDate;
        @Column(name = "contract_end_date") public LocalDate contractEndDate;
        @Column(name = "dev_start_date") public LocalDate devStartDate;
        @Column(name = "dev_end_date") public LocalDate devEndDate;
        @Column(name = "inspection_status", length = 20) public String inspectionStatus;
        @Column(name = "has_tax_bill", nullable = false) public boolean taxBill;
        @Column(name = "actual_man_months") public Double actualManMonths;
        @Column(name = "contract_amount") public Integer contractAmount;
        @Column(name = "note", length = 500) public String note;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public DevProject() { }
    }

    @Entity(name = "DevInquiry")
    @Table(name = "mng_dev_inquiries", indexes = @Index(name = "ix_mng_dev_inquiries_company_id", columnList = "company_id"))
    public static class DevInquiry {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "company_id", nullable = false) public Integer companyId;
        @Column(name = "inquiry_content", columnDefinition = "varchar") public String inquiryContent;
        @Column(name = "hoped_start_date") public LocalDate hopedStartDate;
        @Column(name = "estimated_man_months") public Double estimatedManMonths;
        @Column(name = "sales_rep_name", length = 100) public String salesRepName;
        @Column(name = "client_contact_name", length = 100) public String clientContactName;
        @Column(name = "progress_code", length = 20) public String progressCode;
        @Column(name = "is_confirmed", nullable = false) public boolean confirmed;
        @Column(name = "project_name", length = 200) public String projectName;
        @Column(name = "note", length = 500) public String note;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public DevInquiry() { }
    }

    @Entity(name = "OutsourceContract")
    @Table(name = "mng_outsource_contracts", uniqueConstraints = @UniqueConstraint(name = "uq_mng_outsource_contracts_emp_sdate", columnNames = {"employee_id", "start_date"}), indexes = @Index(name = "ix_mng_outsource_contracts_employee_id", columnList = "employee_id"))
    public static class OutsourceContract {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "employee_id", nullable = false) public Integer employeeId;
        @Column(name = "start_date", nullable = false) public LocalDate startDate;
        @Column(name = "end_date", nullable = false) public LocalDate endDate;
        @Column(name = "total_leave_count", nullable = false) public double totalLeaveCount;
        @Column(name = "extra_leave_count", nullable = false) public double extraLeaveCount;
        @Column(name = "note", length = 500) public String note;
        @Column(name = "is_active", nullable = false) public boolean active;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public OutsourceContract() { }
    }

    @Entity(name = "OutsourceAttendance")
    @Table(name = "mng_outsource_attendances", indexes = {
        @Index(name = "ix_mng_outsource_attendances_contract", columnList = "contract_id"),
        @Index(name = "ix_mng_outsource_attendances_contract_id", columnList = "contract_id"),
        @Index(name = "ix_mng_outsource_attendances_emp", columnList = "employee_id"),
        @Index(name = "ix_mng_outsource_attendances_employee_id", columnList = "employee_id")
    })
    public static class OutsourceAttendance {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "contract_id", nullable = false) public Integer contractId;
        @Column(name = "employee_id", nullable = false) public Integer employeeId;
        @Column(name = "attendance_code", nullable = false, length = 20) public String attendanceCode;
        @Column(name = "apply_date") public LocalDate applyDate;
        @Column(name = "status_code", length = 20) public String statusCode;
        @Column(name = "start_date", nullable = false) public LocalDate startDate;
        @Column(name = "end_date", nullable = false) public LocalDate endDate;
        @Column(name = "apply_count") public Double applyCount;
        @Column(name = "note", length = 500) public String note;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public OutsourceAttendance() { }
    }

    @Entity(name = "InfraMaster")
    @Table(name = "mng_infra_masters", uniqueConstraints = @UniqueConstraint(name = "uq_mng_infra_masters_comp_svc_env", columnNames = {"company_id", "service_type", "env_type"}), indexes = @Index(name = "ix_mng_infra_masters_company_id", columnList = "company_id"))
    public static class InfraMaster {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "company_id", nullable = false) public Integer companyId;
        @Column(name = "service_type", nullable = false, length = 40) public String serviceType;
        @Column(name = "env_type", nullable = false, length = 10) public String envType;
        @Column(name = "is_active", nullable = false) public boolean active;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public InfraMaster() { }
    }

    @Entity(name = "InfraConfig")
    @Table(name = "mng_infra_configs", uniqueConstraints = @UniqueConstraint(name = "uq_mng_infra_configs_master_section_key", columnNames = {"master_id", "section", "config_key"}), indexes = @Index(name = "ix_mng_infra_configs_master_id", columnList = "master_id"))
    public static class InfraConfig {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "master_id", nullable = false) public Integer masterId;
        @Column(name = "section", nullable = false, length = 100) public String section;
        @Column(name = "config_key", nullable = false, length = 100) public String configKey;
        @Column(name = "config_value", columnDefinition = "varchar") public String configValue;
        @Column(name = "sort_order", nullable = false) public int sortOrder;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
        public InfraConfig() { }
    }
}
