package com.vibehr.payroll;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * PAY owns these tables. References to HR, organization, welfare, and auth remain scalar keys so
 * this package never becomes a second JPA owner for another domain's aggregate.
 */
public final class PayrollEntities {
    private PayrollEntities() {
    }

    @MappedSuperclass
    public abstract static class Audited {
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
        @Column(name = "updated_at", nullable = false) public LocalDateTime updatedAt;
    }

    @Entity(name = "PayrollCode")
    @Table(name = "pay_payroll_codes", uniqueConstraints = @UniqueConstraint(name = "uq_pay_payroll_codes_code", columnNames = "code"))
    public static class PayrollCode extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(nullable = false, length = 20) public String code;
        @Column(nullable = false, length = 100) public String name;
        @Column(name = "pay_type", nullable = false, length = 20) public String payType;
        @Column(name = "payment_day", nullable = false, length = 20) public String paymentDay;
        @Column(name = "tax_deductible", nullable = false) public boolean taxDeductible;
        @Column(name = "social_ins_deductible", nullable = false) public boolean socialInsuranceDeductible;
        @Column(name = "is_active", nullable = false) public boolean active;
    }

    @Entity(name = "TaxRate")
    @Table(name = "pay_tax_rates", uniqueConstraints = @UniqueConstraint(name = "uq_pay_tax_rates_year_type", columnNames = {"year", "rate_type"}))
    public static class TaxRate extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(nullable = false) public int year;
        @Column(name = "rate_type", nullable = false, length = 50) public String rateType;
        @Column(name = "employee_rate") public Double employeeRate;
        @Column(name = "employer_rate") public Double employerRate;
        @Column(name = "min_limit") public Integer minLimit;
        @Column(name = "max_limit") public Integer maxLimit;
    }

    @Entity(name = "IncomeTaxBracket")
    @Table(name = "pay_income_tax_brackets", uniqueConstraints = @UniqueConstraint(name = "uq_pay_income_tax_brackets_year_from", columnNames = {"year", "annual_taxable_from"}), indexes = @Index(name = "ix_pay_income_tax_brackets_year_range", columnList = "year,annual_taxable_from,annual_taxable_to"))
    public static class IncomeTaxBracket extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(nullable = false) public int year;
        @Column(name = "annual_taxable_from", nullable = false) public int annualTaxableFrom;
        @Column(name = "annual_taxable_to") public Integer annualTaxableTo;
        @Column(name = "tax_rate", nullable = false) public double taxRate;
        @Column(name = "quick_deduction", nullable = false) public double quickDeduction;
    }

    @Entity(name = "AllowanceDeduction")
    @Table(name = "pay_allowance_deductions", uniqueConstraints = @UniqueConstraint(name = "uq_pay_allowance_deductions_code", columnNames = "code"))
    public static class AllowanceDeduction extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(nullable = false, length = 20) public String code;
        @Column(nullable = false, length = 100) public String name;
        @Column(nullable = false, length = 20) public String type;
        @Column(name = "tax_type", nullable = false, length = 20) public String taxType;
        @Column(name = "calculation_type", nullable = false, length = 20) public String calculationType;
        @Column(name = "is_active", nullable = false) public boolean active;
        @Column(name = "sort_order", nullable = false) public int sortOrder;
    }

    @Entity(name = "ItemGroup")
    @Table(name = "pay_item_groups", uniqueConstraints = @UniqueConstraint(name = "uq_pay_item_groups_code", columnNames = "code"))
    public static class ItemGroup extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(nullable = false, length = 20) public String code;
        @Column(nullable = false, length = 100) public String name;
        @Column(length = 200) public String description;
        @Column(name = "is_active", nullable = false) public boolean active;
    }

    @Entity(name = "ItemGroupDetail")
    @Table(name = "pay_item_group_details", uniqueConstraints = @UniqueConstraint(name = "uq_pay_item_group_details_link", columnNames = {"group_id", "item_id"}))
    public static class ItemGroupDetail {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "group_id", nullable = false) public int groupId;
        @Column(name = "item_id", nullable = false) public int itemId;
        @Column(nullable = false, length = 20) public String type;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
    }

    @Entity(name = "EmployeeProfile")
    @Table(name = "pay_employee_profiles", uniqueConstraints = @UniqueConstraint(name = "uq_pay_employee_profiles_employee_period", columnNames = {"employee_id", "effective_from"}))
    public static class EmployeeProfile extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "employee_id", nullable = false) public int employeeId;
        @Column(name = "payroll_code_id", nullable = false) public int payrollCodeId;
        @Column(name = "item_group_id") public Integer itemGroupId;
        @Column(name = "base_salary", nullable = false) public double baseSalary;
        @Column(name = "pay_type_code", nullable = false, length = 20) public String payTypeCode;
        @Column(name = "payment_day_type", nullable = false, length = 20) public String paymentDayType;
        @Column(name = "payment_day_value") public Integer paymentDayValue;
        @Column(name = "holiday_adjustment", nullable = false, length = 30) public String holidayAdjustment;
        @Column(name = "effective_from", nullable = false) public LocalDate effectiveFrom;
        @Column(name = "effective_to") public LocalDate effectiveTo;
        @Column(name = "is_active", nullable = false) public boolean active;
    }

    @Entity(name = "VariableInput")
    @Table(name = "pay_variable_inputs", uniqueConstraints = @UniqueConstraint(name = "uq_pay_variable_inputs_month_employee_item", columnNames = {"year_month", "employee_id", "item_code"}), indexes = @Index(name = "ix_pay_variable_inputs_year_month", columnList = "year_month,employee_id"))
    public static class VariableInput extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "year_month", nullable = false, length = 7) public String yearMonth;
        @Column(name = "employee_id", nullable = false) public int employeeId;
        @Column(name = "item_code", nullable = false, length = 20) public String itemCode;
        @Column(nullable = false, length = 20) public String direction;
        @Column(nullable = false) public double amount;
        @Column(length = 200) public String memo;
    }

    @Entity(name = "PayrollRun")
    @Table(name = "pay_payroll_runs", uniqueConstraints = @UniqueConstraint(name = "uq_pay_payroll_runs_month_code", columnNames = {"year_month", "payroll_code_id"}), indexes = @Index(name = "ix_pay_payroll_runs_month_status", columnList = "year_month,status"))
    public static class PayrollRun extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "year_month", nullable = false, length = 7) public String yearMonth;
        @Column(name = "payroll_code_id", nullable = false) public int payrollCodeId;
        @Column(name = "run_name", length = 120) public String runName;
        @Column(nullable = false, length = 20) public String status;
        @Column(name = "total_employees", nullable = false) public int totalEmployees;
        @Column(name = "total_gross", nullable = false) public double totalGross;
        @Column(name = "total_deductions", nullable = false) public double totalDeductions;
        @Column(name = "total_net", nullable = false) public double totalNet;
        @Column(name = "calculated_at") public LocalDateTime calculatedAt;
        @Column(name = "closed_at") public LocalDateTime closedAt;
        @Column(name = "paid_at") public LocalDateTime paidAt;
    }

    @Entity(name = "PayrollRunTarget")
    @Table(name = "pay_payroll_run_targets", uniqueConstraints = @UniqueConstraint(name = "uq_pay_payroll_run_targets_run_employee", columnNames = {"run_id", "employee_id"}), indexes = @Index(name = "ix_pay_payroll_run_targets_run", columnList = "run_id,employee_id"))
    public static class PayrollRunTarget extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "run_id", nullable = false) public int runId;
        @Column(name = "employee_id", nullable = false) public int employeeId;
        @Column(name = "profile_id") public Integer profileId;
        @Column(name = "event_count", nullable = false) public int eventCount;
        @Column(name = "review_required", nullable = false) public boolean reviewRequired;
        @JdbcTypeCode(SqlTypes.JSON) @Column(name = "snapshot_json", nullable = false, columnDefinition = "json") public String snapshotJson;
    }

    @Entity(name = "PayrollRunEmployee")
    @Table(name = "pay_payroll_run_employees", uniqueConstraints = @UniqueConstraint(name = "uq_pay_payroll_run_employees_run_employee", columnNames = {"run_id", "employee_id"}), indexes = @Index(name = "ix_pay_payroll_run_employees_run", columnList = "run_id,employee_id"))
    public static class PayrollRunEmployee extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "run_id", nullable = false) public int runId;
        @Column(name = "employee_id", nullable = false) public int employeeId;
        @Column(name = "profile_id") public Integer profileId;
        @Column(name = "gross_pay", nullable = false) public double grossPay;
        @Column(name = "taxable_income", nullable = false) public double taxableIncome;
        @Column(name = "non_taxable_income", nullable = false) public double nonTaxableIncome;
        @Column(name = "total_deductions", nullable = false) public double totalDeductions;
        @Column(name = "net_pay", nullable = false) public double netPay;
        @Column(nullable = false, length = 20) public String status;
        @Column(name = "warning_message", length = 500) public String warningMessage;
    }

    @Entity(name = "RunItemEntity")
    @Table(name = "pay_payroll_run_items", indexes = @Index(name = "ix_pay_payroll_run_items_run_employee", columnList = "run_employee_id,direction"))
    public static class RunItemEntity {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "run_employee_id", nullable = false) public int runEmployeeId;
        @Column(name = "item_code", nullable = false, length = 30) public String itemCode;
        @Column(name = "item_name", nullable = false, length = 120) public String itemName;
        @Column(nullable = false, length = 20) public String direction;
        @Column(nullable = false) public double amount;
        @Column(name = "tax_type", nullable = false, length = 30) public String taxType;
        @Column(name = "calculation_type", nullable = false, length = 30) public String calculationType;
        @Column(name = "source_type", nullable = false, length = 30) public String sourceType;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
    }

    @Entity(name = "PayrollRunEvent")
    @Table(name = "pay_payroll_run_events", indexes = @Index(name = "ix_pay_payroll_run_events_run", columnList = "run_id,created_at"))
    public static class PayrollRunEvent {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "run_id", nullable = false) public int runId;
        @Column(name = "event_type", nullable = false, length = 30) public String eventType;
        @Column(nullable = false, length = 500) public String message;
        @Column(name = "created_by") public Integer createdBy;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
    }

    @Entity(name = "PayrollRunTargetEvent")
    @Table(name = "pay_payroll_run_target_events", indexes = {
            @Index(name = "ix_pay_payroll_run_target_events_run_employee", columnList = "run_id,employee_id,effective_date"),
            @Index(name = "ix_pay_payroll_run_target_events_run_code", columnList = "run_id,event_code")
    })
    public static class PayrollRunTargetEvent {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "run_id", nullable = false) public int runId;
        @Column(name = "target_id") public Integer targetId;
        @Column(name = "employee_id", nullable = false) public int employeeId;
        @Column(name = "event_code", nullable = false, length = 50) public String eventCode;
        @Column(name = "event_name", nullable = false, length = 120) public String eventName;
        @Column(name = "source_type", nullable = false, length = 30) public String sourceType;
        @Column(name = "source_table", nullable = false, length = 50) public String sourceTable;
        @Column(name = "source_id") public Integer sourceId;
        @Column(name = "effective_date", nullable = false) public LocalDate effectiveDate;
        @Column(name = "decision_code", nullable = false, length = 20) public String decisionCode;
        @JdbcTypeCode(SqlTypes.JSON) @Column(name = "payload_json", nullable = false, columnDefinition = "json") public String payloadJson;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
    }

    @Entity(name = "GlAccount")
    @Table(name = "gl_accounts", uniqueConstraints = @UniqueConstraint(name = "uq_gl_accounts_code", columnNames = "code"))
    public static class GlAccount extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(nullable = false, length = 20) public String code;
        @Column(nullable = false, length = 100) public String name;
        @Column(name = "account_type", nullable = false, length = 20) public String accountType;
        @Column(name = "is_net_pay_account", nullable = false) public boolean netPayAccount;
        @Column(name = "is_cash_account", nullable = false) public boolean cashAccount;
        @Column(name = "is_active", nullable = false) public boolean active;
        @Column(name = "sort_order", nullable = false) public int sortOrder;
    }

    @Entity(name = "GlMapping")
    @Table(name = "pay_gl_mappings", uniqueConstraints = @UniqueConstraint(name = "uq_pay_gl_mappings_item_period", columnNames = {"pay_item_code", "effective_from"}), indexes = @Index(name = "ix_pay_gl_mappings_item_code", columnList = "pay_item_code"))
    public static class GlMapping extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "pay_item_code", nullable = false, length = 30) public String payItemCode;
        @Column(name = "gl_account_code", nullable = false, length = 20) public String glAccountCode;
        @Column(name = "effective_from", nullable = false) public LocalDate effectiveFrom;
        @Column(length = 200) public String note;
        @Column(name = "is_active", nullable = false) public boolean active;
    }

    @Entity(name = "Voucher")
    @Table(name = "pay_vouchers", uniqueConstraints = {
            @UniqueConstraint(name = "uq_pay_vouchers_voucher_no", columnNames = "voucher_no"),
            @UniqueConstraint(name = "uq_pay_vouchers_run_id_voucher_type", columnNames = {"run_id", "voucher_type"})
    })
    public static class Voucher extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "voucher_no", nullable = false, length = 30) public String voucherNo;
        @Column(name = "run_id", nullable = false) public int runId;
        @Column(name = "voucher_type", nullable = false, length = 20) public String voucherType;
        @Column(name = "voucher_date", nullable = false) public LocalDate voucherDate;
        @Column(nullable = false, length = 20) public String status;
        @Column(name = "total_debit", nullable = false) public double totalDebit;
        @Column(name = "total_credit", nullable = false) public double totalCredit;
        @Column(length = 200) public String summary;
        @Column(name = "created_by") public Integer createdBy;
        @Column(name = "confirmed_by") public Integer confirmedBy;
        @Column(name = "confirmed_at") public LocalDateTime confirmedAt;
    }

    @Entity(name = "VoucherLine")
    @Table(name = "pay_voucher_lines", indexes = @Index(name = "ix_pay_voucher_lines_voucher", columnList = "voucher_id,line_no"))
    public static class VoucherLine {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "voucher_id", nullable = false) public int voucherId;
        @Column(name = "line_no", nullable = false) public int lineNo;
        @Column(name = "gl_account_code", nullable = false, length = 20) public String glAccountCode;
        @Column(name = "cost_center_code", length = 30) public String costCenterCode;
        @Column(name = "debit_amount", nullable = false) public double debitAmount;
        @Column(name = "credit_amount", nullable = false) public double creditAmount;
        @Column(length = 200) public String summary;
        @Column(name = "source_item_code", length = 30) public String sourceItemCode;
        @Column(name = "created_at", nullable = false) public LocalDateTime createdAt;
    }

    @Entity(name = "SeveranceItemRule")
    @Table(name = "pay_severance_item_rules", uniqueConstraints = @UniqueConstraint(name = "uq_pay_severance_item_rules_item_code", columnNames = "pay_item_code"))
    public static class SeveranceItemRule extends Audited {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
        @Column(name = "pay_item_code", nullable = false, length = 30) public String payItemCode;
        @Column(name = "include_type", nullable = false, length = 20) public String includeType;
        @Column(length = 200) public String note;
        @Column(name = "is_active", nullable = false) public boolean active;
    }
}
