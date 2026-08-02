package com.vibehr.management.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** API DTOs mirror the current FastAPI mng schema; global Jackson configuration supplies snake_case. */
public final class ManagementDtos {
    private ManagementDtos() {
    }

    public record BulkDeleteRequest(@NotEmpty List<Integer> ids) { }
    public record BulkDeleteResponse(int deletedCount) { }
    public record ListResponse<T>(List<T> items, int totalCount, int page, int limit) { }
    public record DetailResponse<T>(T item) { }

    public record CompanyItem(Integer id, String companyCode, String companyName, String companyGroupCode,
                              String companyType, String managementType, String representativeCompany,
                              LocalDate startDate, boolean isActive, LocalDateTime createdAt,
                              LocalDateTime updatedAt) { }
    public record CompanyListResponse(List<CompanyItem> companies, int totalCount, int page, int limit) { }
    public record CompanyDetailResponse(CompanyItem company) { }
    public record CompanyDropdownItem(Integer id, String companyName) { }
    public record CompanyDropdownResponse(List<CompanyDropdownItem> companies) { }
    public record CompanyCreateRequest(@NotBlank @Size(max = 20) String companyCode,
                                       @NotBlank @Size(max = 100) String companyName,
                                       String companyGroupCode, String companyType, String managementType,
                                       String representativeCompany, LocalDate startDate) { }

    public static final class CompanyUpdateRequest extends PatchRequest {
        @Size(min = 1, max = 100) private String companyName;
        private String companyGroupCode;
        private String companyType;
        private String managementType;
        private String representativeCompany;
        private LocalDate startDate;
        private Boolean isActive;

        public String companyName() { return companyName; }
        @JsonSetter("company_name") public void companyName(String value) { supplied("company_name"); companyName = value; }
        public String companyGroupCode() { return companyGroupCode; }
        @JsonSetter("company_group_code") public void companyGroupCode(String value) { supplied("company_group_code"); companyGroupCode = value; }
        public String companyType() { return companyType; }
        @JsonSetter("company_type") public void companyType(String value) { supplied("company_type"); companyType = value; }
        public String managementType() { return managementType; }
        @JsonSetter("management_type") public void managementType(String value) { supplied("management_type"); managementType = value; }
        public String representativeCompany() { return representativeCompany; }
        @JsonSetter("representative_company") public void representativeCompany(String value) { supplied("representative_company"); representativeCompany = value; }
        public LocalDate startDate() { return startDate; }
        @JsonSetter("start_date") public void startDate(LocalDate value) { supplied("start_date"); startDate = value; }
        public Boolean isActive() { return isActive; }
        @JsonSetter("is_active") public void isActive(Boolean value) { supplied("is_active"); isActive = value; }
    }

    public record ManagerCompanyItem(Integer id, Integer employeeId, String employeeName, Integer companyId,
                                     String companyName, LocalDate startDate, LocalDate endDate, String note,
                                     boolean isActive, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record ManagerCompanyCreateRequest(@NotNull Integer employeeId, @NotNull Integer companyId,
                                              @NotNull LocalDate startDate, LocalDate endDate, String note) { }

    public record DevRequestItem(Integer id, Integer companyId, String companyName, LocalDate requestYm,
                                 int requestSeq, String statusCode, String statusName, String partCode,
                                 String partName, String requesterName, String requestContent,
                                 Integer managerEmployeeId, String managerName, Integer developerEmployeeId,
                                 String developerName, boolean isPaid, String paidContent, boolean hasTaxBill,
                                 LocalDate startYm, LocalDate endYm, LocalDate devStartDate, LocalDate devEndDate,
                                 Double paidManMonths, Double actualManMonths, String note,
                                 LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record DevRequestMonthlySummaryItem(LocalDate requestYm, int totalCount, int paidCount,
                                               double paidManMonthsTotal, double actualManMonthsTotal) { }
    public record DevRequestCreateRequest(@NotNull Integer companyId, @NotNull LocalDate requestYm,
                                          int requestSeq, String statusCode, String partCode,
                                          String requesterName, String requestContent, Integer managerEmployeeId,
                                          Integer developerEmployeeId, Boolean isPaid, String paidContent,
                                          Boolean hasTaxBill, LocalDate startYm, LocalDate endYm,
                                          LocalDate devStartDate, LocalDate devEndDate, Double paidManMonths,
                                          Double actualManMonths, String note) { }

    public static final class DevRequestUpdateRequest extends PatchRequest {
        private Integer companyId;
        private LocalDate requestYm;
        private String statusCode;
        private String partCode;
        private String requesterName;
        private String requestContent;
        private Integer managerEmployeeId;
        private Integer developerEmployeeId;
        private Boolean isPaid;
        private String paidContent;
        private Boolean hasTaxBill;
        private LocalDate startYm;
        private LocalDate endYm;
        private LocalDate devStartDate;
        private LocalDate devEndDate;
        private Double paidManMonths;
        private Double actualManMonths;
        private String note;

        public Integer companyId() { return companyId; }
        @JsonSetter("company_id") public void companyId(Integer value) { supplied("company_id"); companyId = value; }
        public LocalDate requestYm() { return requestYm; }
        @JsonSetter("request_ym") public void requestYm(LocalDate value) { supplied("request_ym"); requestYm = value; }
        public String statusCode() { return statusCode; }
        @JsonSetter("status_code") public void statusCode(String value) { supplied("status_code"); statusCode = value; }
        public String partCode() { return partCode; }
        @JsonSetter("part_code") public void partCode(String value) { supplied("part_code"); partCode = value; }
        public String requesterName() { return requesterName; }
        @JsonSetter("requester_name") public void requesterName(String value) { supplied("requester_name"); requesterName = value; }
        public String requestContent() { return requestContent; }
        @JsonSetter("request_content") public void requestContent(String value) { supplied("request_content"); requestContent = value; }
        public Integer managerEmployeeId() { return managerEmployeeId; }
        @JsonSetter("manager_employee_id") public void managerEmployeeId(Integer value) { supplied("manager_employee_id"); managerEmployeeId = value; }
        public Integer developerEmployeeId() { return developerEmployeeId; }
        @JsonSetter("developer_employee_id") public void developerEmployeeId(Integer value) { supplied("developer_employee_id"); developerEmployeeId = value; }
        public Boolean isPaid() { return isPaid; }
        @JsonSetter("is_paid") public void isPaid(Boolean value) { supplied("is_paid"); isPaid = value; }
        public String paidContent() { return paidContent; }
        @JsonSetter("paid_content") public void paidContent(String value) { supplied("paid_content"); paidContent = value; }
        public Boolean hasTaxBill() { return hasTaxBill; }
        @JsonSetter("has_tax_bill") public void hasTaxBill(Boolean value) { supplied("has_tax_bill"); hasTaxBill = value; }
        public LocalDate startYm() { return startYm; }
        @JsonSetter("start_ym") public void startYm(LocalDate value) { supplied("start_ym"); startYm = value; }
        public LocalDate endYm() { return endYm; }
        @JsonSetter("end_ym") public void endYm(LocalDate value) { supplied("end_ym"); endYm = value; }
        public LocalDate devStartDate() { return devStartDate; }
        @JsonSetter("dev_start_date") public void devStartDate(LocalDate value) { supplied("dev_start_date"); devStartDate = value; }
        public LocalDate devEndDate() { return devEndDate; }
        @JsonSetter("dev_end_date") public void devEndDate(LocalDate value) { supplied("dev_end_date"); devEndDate = value; }
        public Double paidManMonths() { return paidManMonths; }
        @JsonSetter("paid_man_months") public void paidManMonths(Double value) { supplied("paid_man_months"); paidManMonths = value; }
        public Double actualManMonths() { return actualManMonths; }
        @JsonSetter("actual_man_months") public void actualManMonths(Double value) { supplied("actual_man_months"); actualManMonths = value; }
        public String note() { return note; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
    }

    public record DevProjectItem(Integer id, String projectName, Integer companyId, String companyName, String partCode,
                                 String partName, String assignedStaff, LocalDate contractStartDate,
                                 LocalDate contractEndDate, LocalDate devStartDate, LocalDate devEndDate,
                                 String inspectionStatus, String inspectionName, boolean hasTaxBill,
                                 Double actualManMonths, Integer contractAmount, String note,
                                 LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record DevProjectCreateRequest(@NotBlank @Size(max = 200) String projectName, @NotNull Integer companyId,
                                          String partCode, String assignedStaff, LocalDate contractStartDate,
                                          LocalDate contractEndDate, LocalDate devStartDate, LocalDate devEndDate,
                                          String inspectionStatus, Boolean hasTaxBill, Double actualManMonths,
                                          Integer contractAmount, String note) { }

    public static final class DevProjectUpdateRequest extends PatchRequest {
        @Size(min = 1, max = 200) private String projectName;
        private Integer companyId;
        private String partCode;
        private String assignedStaff;
        private LocalDate contractStartDate;
        private LocalDate contractEndDate;
        private LocalDate devStartDate;
        private LocalDate devEndDate;
        private String inspectionStatus;
        private Boolean hasTaxBill;
        private Double actualManMonths;
        private Integer contractAmount;
        private String note;

        public String projectName() { return projectName; }
        @JsonSetter("project_name") public void projectName(String value) { supplied("project_name"); projectName = value; }
        public Integer companyId() { return companyId; }
        @JsonSetter("company_id") public void companyId(Integer value) { supplied("company_id"); companyId = value; }
        public String partCode() { return partCode; }
        @JsonSetter("part_code") public void partCode(String value) { supplied("part_code"); partCode = value; }
        public String assignedStaff() { return assignedStaff; }
        @JsonSetter("assigned_staff") public void assignedStaff(String value) { supplied("assigned_staff"); assignedStaff = value; }
        public LocalDate contractStartDate() { return contractStartDate; }
        @JsonSetter("contract_start_date") public void contractStartDate(LocalDate value) { supplied("contract_start_date"); contractStartDate = value; }
        public LocalDate contractEndDate() { return contractEndDate; }
        @JsonSetter("contract_end_date") public void contractEndDate(LocalDate value) { supplied("contract_end_date"); contractEndDate = value; }
        public LocalDate devStartDate() { return devStartDate; }
        @JsonSetter("dev_start_date") public void devStartDate(LocalDate value) { supplied("dev_start_date"); devStartDate = value; }
        public LocalDate devEndDate() { return devEndDate; }
        @JsonSetter("dev_end_date") public void devEndDate(LocalDate value) { supplied("dev_end_date"); devEndDate = value; }
        public String inspectionStatus() { return inspectionStatus; }
        @JsonSetter("inspection_status") public void inspectionStatus(String value) { supplied("inspection_status"); inspectionStatus = value; }
        public Boolean hasTaxBill() { return hasTaxBill; }
        @JsonSetter("has_tax_bill") public void hasTaxBill(Boolean value) { supplied("has_tax_bill"); hasTaxBill = value; }
        public Double actualManMonths() { return actualManMonths; }
        @JsonSetter("actual_man_months") public void actualManMonths(Double value) { supplied("actual_man_months"); actualManMonths = value; }
        public Integer contractAmount() { return contractAmount; }
        @JsonSetter("contract_amount") public void contractAmount(Integer value) { supplied("contract_amount"); contractAmount = value; }
        public String note() { return note; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
    }

    public record DevInquiryItem(Integer id, Integer companyId, String companyName, String inquiryContent,
                                 LocalDate hopedStartDate, Double estimatedManMonths, String salesRepName,
                                 String clientContactName, String progressCode, String progressName,
                                 boolean isConfirmed, String projectName, String note,
                                 LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record DevInquiryCreateRequest(@NotNull Integer companyId, String inquiryContent,
                                          LocalDate hopedStartDate, Double estimatedManMonths, String salesRepName,
                                          String clientContactName, String progressCode, Boolean isConfirmed,
                                          String projectName, String note) { }

    public static final class DevInquiryUpdateRequest extends PatchRequest {
        private Integer companyId;
        private String inquiryContent;
        private LocalDate hopedStartDate;
        private Double estimatedManMonths;
        private String salesRepName;
        private String clientContactName;
        private String progressCode;
        private Boolean isConfirmed;
        private String projectName;
        private String note;

        public Integer companyId() { return companyId; }
        @JsonSetter("company_id") public void companyId(Integer value) { supplied("company_id"); companyId = value; }
        public String inquiryContent() { return inquiryContent; }
        @JsonSetter("inquiry_content") public void inquiryContent(String value) { supplied("inquiry_content"); inquiryContent = value; }
        public LocalDate hopedStartDate() { return hopedStartDate; }
        @JsonSetter("hoped_start_date") public void hopedStartDate(LocalDate value) { supplied("hoped_start_date"); hopedStartDate = value; }
        public Double estimatedManMonths() { return estimatedManMonths; }
        @JsonSetter("estimated_man_months") public void estimatedManMonths(Double value) { supplied("estimated_man_months"); estimatedManMonths = value; }
        public String salesRepName() { return salesRepName; }
        @JsonSetter("sales_rep_name") public void salesRepName(String value) { supplied("sales_rep_name"); salesRepName = value; }
        public String clientContactName() { return clientContactName; }
        @JsonSetter("client_contact_name") public void clientContactName(String value) { supplied("client_contact_name"); clientContactName = value; }
        public String progressCode() { return progressCode; }
        @JsonSetter("progress_code") public void progressCode(String value) { supplied("progress_code"); progressCode = value; }
        public Boolean isConfirmed() { return isConfirmed; }
        @JsonSetter("is_confirmed") public void isConfirmed(Boolean value) { supplied("is_confirmed"); isConfirmed = value; }
        public String projectName() { return projectName; }
        @JsonSetter("project_name") public void projectName(String value) { supplied("project_name"); projectName = value; }
        public String note() { return note; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
    }

    public record DevStaffProjectItem(Integer projectId, String projectName, Integer companyId, String companyName,
                                      String assignedStaff, LocalDate contractStartDate, LocalDate contractEndDate,
                                      LocalDate devStartDate, LocalDate devEndDate, Double actualManMonths,
                                      Integer contractAmount) { }
    public record DevStaffRevenueItem(LocalDate month, int projectCount, int contractAmountTotal,
                                      double actualManMonthsTotal) { }

    public record OutsourceContractItem(Integer id, Integer employeeId, String employeeName, String employeeNo,
                                        LocalDate startDate, LocalDate endDate, double totalLeaveCount,
                                        double extraLeaveCount, String note, boolean isActive,
                                        LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record OutsourceContractDuplicateResponse(boolean isDuplicate) { }
    public record OutsourceContractCreateRequest(@NotNull Integer employeeId, @NotNull LocalDate startDate,
                                                 @NotNull LocalDate endDate, Double totalLeaveCount,
                                                 Double extraLeaveCount, String note) { }

    public static final class OutsourceContractUpdateRequest extends PatchRequest {
        private LocalDate startDate;
        private LocalDate endDate;
        private Double totalLeaveCount;
        private Double extraLeaveCount;
        private String note;
        private Boolean isActive;

        public LocalDate startDate() { return startDate; }
        @JsonSetter("start_date") public void startDate(LocalDate value) { supplied("start_date"); startDate = value; }
        public LocalDate endDate() { return endDate; }
        @JsonSetter("end_date") public void endDate(LocalDate value) { supplied("end_date"); endDate = value; }
        public Double totalLeaveCount() { return totalLeaveCount; }
        @JsonSetter("total_leave_count") public void totalLeaveCount(Double value) { supplied("total_leave_count"); totalLeaveCount = value; }
        public Double extraLeaveCount() { return extraLeaveCount; }
        @JsonSetter("extra_leave_count") public void extraLeaveCount(Double value) { supplied("extra_leave_count"); extraLeaveCount = value; }
        public String note() { return note; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
        public Boolean isActive() { return isActive; }
        @JsonSetter("is_active") public void isActive(Boolean value) { supplied("is_active"); isActive = value; }
    }

    public record OutsourceAttendanceSummaryItem(Integer contractId, Integer employeeId, String employeeName,
                                                 String employeeNo, LocalDate startDate, LocalDate endDate,
                                                 double totalCount, double usedCount, double remainCount,
                                                 String note) { }
    public record OutsourceAttendanceItem(Integer id, Integer contractId, Integer employeeId, String attendanceCode,
                                          String attendanceName, LocalDate applyDate, String statusCode,
                                          String statusName, LocalDate startDate, LocalDate endDate,
                                          Double applyCount, String note, LocalDateTime createdAt,
                                          LocalDateTime updatedAt) { }
    public record OutsourceAttendanceCreateRequest(@NotNull Integer contractId, @NotNull Integer employeeId,
                                                   @NotBlank @Size(max = 20) String attendanceCode,
                                                   LocalDate applyDate, String statusCode,
                                                   @NotNull LocalDate startDate, @NotNull LocalDate endDate,
                                                   Double applyCount, String note) { }

    public record InfraMasterItem(Integer id, Integer companyId, String companyName, String serviceType,
                                  String serviceTypeName, String envType, boolean isActive,
                                  LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record InfraMasterCreateRequest(@NotNull Integer companyId, @NotBlank @Size(max = 40) String serviceType,
                                           @NotBlank @Size(max = 10) String envType) { }
    public record InfraConfigItem(Integer id, Integer masterId, String section, String configKey, String configValue,
                                  int sortOrder, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record InfraConfigUpsertRow(@NotBlank @Size(max = 100) String section,
                                       @NotBlank @Size(max = 100) String configKey,
                                       String configValue, int sortOrder) { }
    public record InfraConfigUpsertRequest(@NotNull List<@NotNull InfraConfigUpsertRow> rows) { }

    public abstract static class PatchRequest {
        @JsonIgnore
        private final Set<String> suppliedFields = new HashSet<>();

        protected final void supplied(String field) { suppliedFields.add(field); }

        @JsonIgnore
        public final boolean has(String field) { return suppliedFields.contains(field); }
    }
}
