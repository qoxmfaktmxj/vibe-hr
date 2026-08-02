package com.vibehr.payroll;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Typed request and response contracts mirroring the FastAPI snake_case PAY schemas. */
public final class PayrollContracts {
    private PayrollContracts() {
    }

    public record PayrollCodeItem(int id, String code, String name, String payType, String paymentDay,
            boolean taxDeductible, boolean socialInsDeductible, boolean isActive,
            LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record PayrollCodeListResponse(List<PayrollCodeItem> items, int totalCount) { }
    public record PayrollCodeBatchItem(Integer id, @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 100) String name, @NotBlank @Size(max = 20) String payType,
            @NotBlank @Size(max = 20) String paymentDay, Boolean taxDeductible,
            Boolean socialInsDeductible, Boolean isActive) { }
    public record PayrollCodeBatchRequest(@NotNull @Valid List<PayrollCodeBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record PayrollCodeBatchResponse(List<PayrollCodeItem> items, int totalCount, int insertedCount,
            int updatedCount, int deletedCount) { }

    public record TaxRateItem(int id, int year, String rateType, Double employeeRate, Double employerRate,
            Integer minLimit, Integer maxLimit, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record TaxRateListResponse(List<TaxRateItem> items, int totalCount) { }
    public record TaxRateBatchItem(Integer id, @NotNull Integer year, @NotBlank @Size(max = 50) String rateType,
            Double employeeRate, Double employerRate, Integer minLimit, Integer maxLimit) { }
    public record TaxRateBatchRequest(@NotNull @Valid List<TaxRateBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record TaxRateBatchResponse(List<TaxRateItem> items, int totalCount, int insertedCount,
            int updatedCount, int deletedCount) { }

    public record IncomeTaxBracketItem(int id, int year, int annualTaxableFrom, Integer annualTaxableTo,
            double taxRate, double quickDeduction, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record IncomeTaxBracketListResponse(List<IncomeTaxBracketItem> items, int totalCount) { }
    public record IncomeTaxBracketBatchItem(Integer id, @NotNull Integer year,
            @NotNull @Min(0) Integer annualTaxableFrom, Integer annualTaxableTo,
            @NotNull @DecimalMin("0.0") Double taxRate, @NotNull @DecimalMin("0.0") Double quickDeduction) { }
    public record IncomeTaxBracketBatchRequest(@NotNull @Valid List<IncomeTaxBracketBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record IncomeTaxBracketBatchResponse(List<IncomeTaxBracketItem> items, int totalCount,
            int insertedCount, int updatedCount, int deletedCount) { }

    public record AllowanceDeductionItem(int id, String code, String name, String type, String taxType,
            String calculationType, boolean isActive, int sortOrder, LocalDateTime createdAt,
            LocalDateTime updatedAt) { }
    public record AllowanceDeductionListResponse(List<AllowanceDeductionItem> items, int totalCount) { }
    public record AllowanceDeductionBatchItem(Integer id, @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 100) String name, @NotBlank @Pattern(regexp = "^(allowance|deduction)$") String type,
            @NotBlank @Pattern(regexp = "^(taxable|non-taxable|tax|insurance)$") String taxType,
            @Pattern(regexp = "^(fixed|hourly|formula)$") String calculationType, Boolean isActive, Integer sortOrder) { }
    public record AllowanceDeductionBatchRequest(@NotNull @Valid List<AllowanceDeductionBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record AllowanceDeductionBatchResponse(List<AllowanceDeductionItem> items, int totalCount,
            int insertedCount, int updatedCount, int deletedCount) { }

    public record ItemGroupDetailItem(int id, int groupId, int itemId, String type, LocalDateTime createdAt) { }
    public record ItemGroupItem(int id, String code, String name, String description, boolean isActive,
            LocalDateTime createdAt, LocalDateTime updatedAt, List<ItemGroupDetailItem> details) { }
    public record ItemGroupListResponse(List<ItemGroupItem> items, int totalCount) { }
    public record ItemGroupDetailBatchItem(Integer id, @NotNull Integer itemId,
            @NotBlank @Pattern(regexp = "^(allowance|deduction)$") String type) { }
    public record ItemGroupBatchItem(Integer id, @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 100) String name, @Size(max = 200) String description, Boolean isActive,
            @Valid List<ItemGroupDetailBatchItem> details) { }
    public record ItemGroupBatchRequest(@NotNull @Valid List<ItemGroupBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record ItemGroupBatchResponse(List<ItemGroupItem> items, int totalCount, int insertedCount,
            int updatedCount, int deletedCount) { }

    public record GlAccountItem(int id, String code, String name, String accountType, boolean isNetPayAccount,
            boolean isCashAccount, boolean isActive, int sortOrder, LocalDateTime createdAt,
            LocalDateTime updatedAt) { }
    public record GlAccountListResponse(List<GlAccountItem> items, int totalCount) { }
    public record GlAccountBatchItem(Integer id, @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = "^(expense|liability|asset|equity|revenue)$") String accountType,
            Boolean isNetPayAccount, Boolean isCashAccount, Boolean isActive, Integer sortOrder) { }
    public record GlAccountBatchRequest(@NotNull @Valid List<GlAccountBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record GlAccountBatchResponse(List<GlAccountItem> items, int totalCount, int insertedCount,
            int updatedCount, int deletedCount) { }

    public record GlMappingItem(int id, String payItemCode, String payItemName, String glAccountCode,
            String glAccountName, LocalDate effectiveFrom, String note, boolean isActive,
            LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record GlMappingListResponse(List<GlMappingItem> items, int totalCount) { }
    public record GlMappingBatchItem(Integer id, @NotBlank @Size(max = 30) String payItemCode,
            @NotBlank @Size(max = 20) String glAccountCode, @NotNull LocalDate effectiveFrom,
            @Size(max = 200) String note, Boolean isActive) { }
    public record GlMappingBatchRequest(@NotNull @Valid List<GlMappingBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record GlMappingBatchResponse(List<GlMappingItem> items, int totalCount, int insertedCount,
            int updatedCount, int deletedCount) { }

    public record VoucherLineItem(int id, int lineNo, String glAccountCode, String glAccountName,
            String costCenterCode, double debitAmount, double creditAmount, String summary,
            String sourceItemCode, LocalDateTime createdAt) { }
    public record VoucherItem(int id, String voucherNo, int runId, String voucherType, String yearMonth,
            LocalDate voucherDate, String status, double totalDebit, double totalCredit, String summary,
            Integer createdBy, Integer confirmedBy, LocalDateTime confirmedAt, LocalDateTime createdAt,
            LocalDateTime updatedAt) { }
    public record VoucherListResponse(List<VoucherItem> items, int totalCount) { }
    public record VoucherDetailResponse(VoucherItem voucher, List<VoucherLineItem> lines) { }
    public record VoucherGenerateRequest(@NotNull Integer runId) { }
    public record VoucherActionResponse(VoucherItem voucher) { }
    public record MappingGapItem(String itemCode, String itemName, String direction) { }
    public record MappingGapsResponse(int runId, List<MappingGapItem> missingItemCodes) { }

    public record EmployeeProfileItem(int id, int employeeId, String employeeNo, String employeeName,
            int payrollCodeId, String payrollCodeName, Integer itemGroupId, String itemGroupName,
            double baseSalary, String payTypeCode, String paymentDayType, Integer paymentDayValue,
            String holidayAdjustment, LocalDate effectiveFrom, LocalDate effectiveTo, boolean isActive,
            LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record EmployeeProfileListResponse(List<EmployeeProfileItem> items, int totalCount) { }
    public record EmployeeProfileBatchItem(Integer id, @NotNull Integer employeeId,
            @NotNull Integer payrollCodeId, Integer itemGroupId, @DecimalMin("0.0") Double baseSalary,
            @Size(min = 1, max = 20) String payTypeCode,
            @Pattern(regexp = "^(fixed_day|month_end)$") String paymentDayType,
            @Min(1) @Max(31) Integer paymentDayValue,
            @Pattern(regexp = "^(previous_business_day|next_business_day|none)$") String holidayAdjustment,
            @NotNull LocalDate effectiveFrom, LocalDate effectiveTo, Boolean isActive) { }
    public record EmployeeProfileBatchRequest(@NotNull @Valid List<EmployeeProfileBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record EmployeeProfileBatchResponse(List<EmployeeProfileItem> items, int totalCount,
            int insertedCount, int updatedCount, int deletedCount) { }

    public record VariableInputItem(int id, String yearMonth, int employeeId, String employeeNo,
            String employeeName, String itemCode, String itemName, String direction, double amount,
            String memo, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record VariableInputListResponse(List<VariableInputItem> items, int totalCount) { }
    public record VariableInputBatchItem(Integer id,
            @NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$") String yearMonth,
            @NotNull Integer employeeId, @NotBlank @Size(max = 20) String itemCode,
            @NotBlank @Pattern(regexp = "^(earning|deduction)$") String direction, @NotNull Double amount,
            @Size(max = 200) String memo) { }
    public record VariableInputBatchRequest(@NotNull @Valid List<VariableInputBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record VariableInputBatchResponse(List<VariableInputItem> items, int totalCount,
            int insertedCount, int updatedCount, int deletedCount) { }

    public record PayrollRunItem(int id, String yearMonth, int payrollCodeId, String payrollCodeName,
            String runName, String status, int totalEmployees, double totalGross, double totalDeductions,
            double totalNet, LocalDateTime calculatedAt, LocalDateTime closedAt, LocalDateTime paidAt,
            LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record PayrollRunListResponse(List<PayrollRunItem> items, int totalCount) { }
    public record PayrollRunCreateRequest(@NotBlank @Pattern(regexp = "^\\d{4}-(0[1-9]|1[0-2])$") String yearMonth,
            @NotNull Integer payrollCodeId, @Size(max = 120) String runName) { }
    public record PayrollRunActionResponse(PayrollRunItem run) { }

    public record PayrollRunEmployeeItem(int id, int runId, int employeeId, String employeeNo,
            String employeeName, Integer profileId, double grossPay, double taxableIncome,
            double nonTaxableIncome, double totalDeductions, double netPay, String status,
            String warningMessage, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record PayrollRunEmployeeListResponse(List<PayrollRunEmployeeItem> items, int totalCount) { }
    public record PayrollRunEmployeeDetailItem(int id, int runEmployeeId, String itemCode, String itemName,
            String direction, double amount, String taxType, String calculationType, String sourceType,
            LocalDateTime createdAt) { }
    public record PayrollRunEmployeeDetailResponse(PayrollRunEmployeeItem employee,
            List<PayrollRunEmployeeDetailItem> items) { }
    public record MyPayslipSummary(int runId, int runEmployeeId, String yearMonth, String runName,
            String runStatus, double grossPay, double taxableIncome, double nonTaxableIncome,
            double totalDeductions, double netPay, LocalDateTime paidAt) { }
    public record MyPayslipListResponse(List<MyPayslipSummary> items, int totalCount) { }
    public record MyPayslipDetailResponse(MyPayslipSummary summary, List<PayrollRunEmployeeDetailItem> items) { }

    public record SeveranceItemRuleItem(int id, String payItemCode, String payItemName, String includeType,
            String note, boolean isActive, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record SeveranceItemRuleListResponse(List<SeveranceItemRuleItem> items, int totalCount) { }
    public record SeveranceItemRuleBatchItem(Integer id, @NotBlank @Size(max = 30) String payItemCode,
            @NotBlank @Pattern(regexp = "^(full|prorate_12|exclude)$") String includeType,
            @Size(max = 200) String note, Boolean isActive) { }
    public record SeveranceItemRuleBatchRequest(@NotNull @Valid List<SeveranceItemRuleBatchItem> items,
            @JsonSetter(nulls = Nulls.FAIL) List<Integer> deleteIds) { }
    public record SeveranceItemRuleBatchResponse(List<SeveranceItemRuleItem> items, int totalCount,
            int insertedCount, int updatedCount, int deletedCount) { }
}
