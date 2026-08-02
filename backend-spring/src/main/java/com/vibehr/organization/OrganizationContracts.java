package com.vibehr.organization;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** FastAPI-compatible request and response shapes for the organization domain. */
public final class OrganizationContracts {
    private OrganizationContracts() {
    }

    public abstract static class PatchRequest {
        @JsonIgnore
        private final Set<String> suppliedFields = new HashSet<>();

        protected final void supplied(String field) {
            suppliedFields.add(field);
        }

        @JsonIgnore
        public final boolean has(String field) {
            return suppliedFields.contains(field);
        }
    }

    public record CorporationItem(long id, String enterCd, String companyCode, String corporationName,
                                  String corporationNumber, String businessNumber, String companySealUrl,
                                  String certificateSealUrl, String companyLogoUrl, boolean isActive,
                                  Instant createdAt, Instant updatedAt) {
    }
    public record CorporationListResponse(List<CorporationItem> corporations, long totalCount, Integer page, Integer limit) {
    }
    public record CorporationDetailResponse(CorporationItem corporation) {
    }
    public record CorporationCreateRequest(@NotBlank @Size(max = 20) String enterCd,
                                           @NotBlank @Size(max = 20) String companyCode,
                                           @NotBlank @Size(max = 120) String corporationName,
                                           @Size(max = 30) String corporationNumber,
                                           @Size(max = 30) String businessNumber,
                                           @Size(max = 500) String companySealUrl,
                                           @Size(max = 500) String certificateSealUrl,
                                           @Size(max = 500) String companyLogoUrl,
                                           Boolean isActive) {
    }

    public static final class CorporationUpdateRequest extends PatchRequest {
        @Size(min = 1, max = 20) private String enterCd;
        @Size(min = 1, max = 20) private String companyCode;
        @Size(min = 1, max = 120) private String corporationName;
        @Size(max = 30) private String corporationNumber;
        @Size(max = 30) private String businessNumber;
        @Size(max = 500) private String companySealUrl;
        @Size(max = 500) private String certificateSealUrl;
        @Size(max = 500) private String companyLogoUrl;
        private Boolean isActive;

        @JsonSetter("enter_cd") public void setEnterCd(String value) { supplied("enter_cd"); enterCd = value; }
        @JsonSetter("company_code") public void setCompanyCode(String value) { supplied("company_code"); companyCode = value; }
        @JsonSetter("corporation_name") public void setCorporationName(String value) { supplied("corporation_name"); corporationName = value; }
        @JsonSetter("corporation_number") public void setCorporationNumber(String value) { supplied("corporation_number"); corporationNumber = value; }
        @JsonSetter("business_number") public void setBusinessNumber(String value) { supplied("business_number"); businessNumber = value; }
        @JsonSetter("company_seal_url") public void setCompanySealUrl(String value) { supplied("company_seal_url"); companySealUrl = value; }
        @JsonSetter("certificate_seal_url") public void setCertificateSealUrl(String value) { supplied("certificate_seal_url"); certificateSealUrl = value; }
        @JsonSetter("company_logo_url") public void setCompanyLogoUrl(String value) { supplied("company_logo_url"); companyLogoUrl = value; }
        @JsonSetter("is_active") public void setIsActive(Boolean value) { supplied("is_active"); isActive = value; }

        public String enterCd() { return enterCd; }
        public String companyCode() { return companyCode; }
        public String corporationName() { return corporationName; }
        public String corporationNumber() { return corporationNumber; }
        public String businessNumber() { return businessNumber; }
        public String companySealUrl() { return companySealUrl; }
        public String certificateSealUrl() { return certificateSealUrl; }
        public String companyLogoUrl() { return companyLogoUrl; }
        public Boolean isActive() { return isActive; }
    }

    public record DepartmentItem(long id, String code, String name, Long parentId, String parentName,
                                 String organizationType, String costCenterCode, String description,
                                 long employeeCount, boolean isActive, Instant createdAt, Instant updatedAt) {
    }
    public record DepartmentListResponse(List<DepartmentItem> departments, long totalCount, LocalDate referenceDate,
                                         Integer page, Integer limit) {
    }
    public record DepartmentDetailResponse(DepartmentItem department) {
    }
    public record ChartResponse(List<DepartmentItem> departments, long totalCount) {
    }
    public record DepartmentCreateRequest(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 100) String name,
                                          Long parentId, @Size(max = 50) String organizationType,
                                          @Size(max = 30) String costCenterCode, @Size(max = 500) String description,
                                          Boolean isActive) {
    }

    public static final class DepartmentUpdateRequest extends PatchRequest {
        @Size(min = 1, max = 30) private String code;
        @Size(min = 1, max = 100) private String name;
        private Long parentId;
        @Size(max = 50) private String organizationType;
        @Size(max = 30) private String costCenterCode;
        @Size(max = 500) private String description;
        private Boolean isActive;

        @JsonSetter("code") public void setCode(String value) { supplied("code"); code = value; }
        @JsonSetter("name") public void setName(String value) { supplied("name"); name = value; }
        @JsonSetter("parent_id") public void setParentId(Long value) { supplied("parent_id"); parentId = value; }
        @JsonSetter("organization_type") public void setOrganizationType(String value) { supplied("organization_type"); organizationType = value; }
        @JsonSetter("cost_center_code") public void setCostCenterCode(String value) { supplied("cost_center_code"); costCenterCode = value; }
        @JsonSetter("description") public void setDescription(String value) { supplied("description"); description = value; }
        @JsonSetter("is_active") public void setIsActive(Boolean value) { supplied("is_active"); isActive = value; }

        public String code() { return code; }
        public String name() { return name; }
        public Long parentId() { return parentId; }
        public String organizationType() { return organizationType; }
        public String costCenterCode() { return costCenterCode; }
        public String description() { return description; }
        public Boolean isActive() { return isActive; }
    }

    public record LookupItem(Long id, String code, String name) {
    }
    public record LookupItemsResponse(List<LookupItem> items) {
    }

    public record MappingTypeItem(long id, String typeCode, String itemCode, String name, LocalDate effectiveFrom,
                                  LocalDate effectiveTo, String erpEmployeeCode, String costCenterType, String remark,
                                  int sortOrder, boolean isActive, Instant createdAt, Instant updatedAt) {
    }
    public record MappingTypeItemListResponse(List<MappingTypeItem> items, long totalCount, int page, int limit) {
    }
    public record MappingTypeItemDetailResponse(MappingTypeItem item) {
    }
    public record MappingTypeItemCreateRequest(@NotBlank @Size(max = 50) String typeCode,
                                               @NotBlank @Size(max = 50) String itemCode,
                                               @NotBlank @Size(max = 100) String name, @NotNull LocalDate effectiveFrom,
                                               LocalDate effectiveTo, @Size(max = 50) String erpEmployeeCode,
                                               @Size(max = 50) String costCenterType, Integer sortOrder,
                                               @Size(max = 500) String remark, Boolean isActive) {
    }

    public static final class MappingTypeItemUpdateRequest extends PatchRequest {
        @Size(min = 1, max = 50) private String typeCode;
        @Size(min = 1, max = 50) private String itemCode;
        @Size(min = 1, max = 100) private String name;
        private LocalDate effectiveFrom;
        private LocalDate effectiveTo;
        @Size(max = 50) private String erpEmployeeCode;
        @Size(max = 50) private String costCenterType;
        private Integer sortOrder;
        @Size(max = 500) private String remark;
        private Boolean isActive;

        @JsonSetter("type_code") public void setTypeCode(String value) { supplied("type_code"); typeCode = value; }
        @JsonSetter("item_code") public void setItemCode(String value) { supplied("item_code"); itemCode = value; }
        @JsonSetter("name") public void setName(String value) { supplied("name"); name = value; }
        @JsonSetter("effective_from") public void setEffectiveFrom(LocalDate value) { supplied("effective_from"); effectiveFrom = value; }
        @JsonSetter("effective_to") public void setEffectiveTo(LocalDate value) { supplied("effective_to"); effectiveTo = value; }
        @JsonSetter("erp_employee_code") public void setErpEmployeeCode(String value) { supplied("erp_employee_code"); erpEmployeeCode = value; }
        @JsonSetter("cost_center_type") public void setCostCenterType(String value) { supplied("cost_center_type"); costCenterType = value; }
        @JsonSetter("sort_order") public void setSortOrder(Integer value) { supplied("sort_order"); sortOrder = value; }
        @JsonSetter("remark") public void setRemark(String value) { supplied("remark"); remark = value; }
        @JsonSetter("is_active") public void setIsActive(Boolean value) { supplied("is_active"); isActive = value; }

        public String typeCode() { return typeCode; }
        public String itemCode() { return itemCode; }
        public String name() { return name; }
        public LocalDate effectiveFrom() { return effectiveFrom; }
        public LocalDate effectiveTo() { return effectiveTo; }
        public String erpEmployeeCode() { return erpEmployeeCode; }
        public String costCenterType() { return costCenterType; }
        public Integer sortOrder() { return sortOrder; }
        public String remark() { return remark; }
        public Boolean isActive() { return isActive; }
    }

    public record MappingAssignmentItem(long id, long departmentId, String departmentCode, String departmentName,
                                        String typeCode, long itemId, String itemCode, String itemName,
                                        LocalDate effectiveFrom, LocalDate effectiveTo, Instant createdAt, Instant updatedAt) {
    }
    public record MappingAssignmentListResponse(List<MappingAssignmentItem> items, long totalCount, int page, int limit) {
    }
    public record MappingAssignmentDetailResponse(MappingAssignmentItem item) {
    }
    public record MappingAssignmentCreateRequest(long departmentId, @NotBlank @Size(max = 50) String typeCode,
                                                 long itemId, @NotNull LocalDate effectiveFrom, LocalDate effectiveTo) {
    }

    public static final class MappingAssignmentUpdateRequest extends PatchRequest {
        private Long departmentId;
        @Size(min = 1, max = 50) private String typeCode;
        private Long itemId;
        private LocalDate effectiveFrom;
        private LocalDate effectiveTo;

        @JsonSetter("department_id") public void setDepartmentId(Long value) { supplied("department_id"); departmentId = value; }
        @JsonSetter("type_code") public void setTypeCode(String value) { supplied("type_code"); typeCode = value; }
        @JsonSetter("item_id") public void setItemId(Long value) { supplied("item_id"); itemId = value; }
        @JsonSetter("effective_from") public void setEffectiveFrom(LocalDate value) { supplied("effective_from"); effectiveFrom = value; }
        @JsonSetter("effective_to") public void setEffectiveTo(LocalDate value) { supplied("effective_to"); effectiveTo = value; }

        public Long departmentId() { return departmentId; }
        public String typeCode() { return typeCode; }
        public Long itemId() { return itemId; }
        public LocalDate effectiveFrom() { return effectiveFrom; }
        public LocalDate effectiveTo() { return effectiveTo; }
    }

    public record MappingAssignmentUploadRow(@NotBlank @Size(max = 30) String departmentCode,
                                              @NotBlank @Size(max = 50) String typeCode,
                                              @NotBlank @Size(max = 50) String itemCode,
                                              @NotNull LocalDate effectiveFrom, LocalDate effectiveTo) {
    }
    public record MappingAssignmentUploadRequest(@NotBlank @Pattern(regexp = "atomic") String mode,
                                                  @NotEmpty @Size(max = 1000) List<MappingAssignmentUploadRow> rows) {
    }
    public record MappingAssignmentUploadPreviewRow(int rowNumber, boolean valid, List<String> errors,
                                                     Map<String, Object> normalized) {
    }
    public record MappingAssignmentUploadPreviewResponse(List<MappingAssignmentUploadPreviewRow> rows,
                                                          int validCount, int invalidCount) {
    }
    public record MappingAssignmentUploadConfirmResponse(int insertedCount, int updatedCount) {
    }
    public record MappingAssignmentUploadTemplateResponse(List<String> headers) {
    }

    public record PersonalStatusTypeColumn(String typeCode, String name) {
    }
    public record PersonalStatusCell(String itemCode, String itemName) {
    }
    public record PersonalStatusRow(long employeeId, String employeeNo, String displayName, long departmentId,
                                    String departmentCode, String departmentName, String positionTitle,
                                    Map<String, PersonalStatusCell> mappings) {
    }
    public record PersonalStatusListResponse(List<PersonalStatusRow> items, List<PersonalStatusTypeColumn> typeColumns,
                                             long totalCount, int page, int limit) {
    }

    public record DeptChangeHistoryItem(long id, long departmentId, String departmentName, Long changedBy,
                                        String changedByName, String fieldName, String beforeValue, String afterValue,
                                        String changeReason, Instant changedAt) {
    }
    public record DeptChangeHistoryListResponse(List<DeptChangeHistoryItem> items, long totalCount) {
    }

    public record RestructurePlanItem(long id, String title, String description, LocalDate plannedDate, String status,
                                      Instant appliedAt, Long appliedBy, long createdBy, Instant createdAt,
                                      Instant updatedAt, long itemCount) {
    }
    public record RestructurePlanListResponse(List<RestructurePlanItem> items, long totalCount) {
    }
    public record RestructurePlanCreateRequest(@NotBlank @Size(max = 200) String title, @Size(max = 1000) String description,
                                               LocalDate plannedDate) {
    }

    public static final class RestructurePlanUpdateRequest extends PatchRequest {
        @Size(min = 1, max = 200) private String title;
        @Size(max = 1000) private String description;
        private LocalDate plannedDate;
        private String status;

        @JsonSetter("title") public void setTitle(String value) { supplied("title"); title = value; }
        @JsonSetter("description") public void setDescription(String value) { supplied("description"); description = value; }
        @JsonSetter("planned_date") public void setPlannedDate(LocalDate value) { supplied("planned_date"); plannedDate = value; }
        @JsonSetter("status") public void setStatus(String value) { supplied("status"); status = value; }

        public String title() { return title; }
        public String description() { return description; }
        public LocalDate plannedDate() { return plannedDate; }
        public String status() { return status; }
    }
    public record RestructurePlanItemDetail(long id, long planId, String actionType, Long targetDeptId,
                                            String targetDeptName, String targetDeptCode, Long newParentId,
                                            String newParentName, String newName, String newCode,
                                            String newOrganizationType, String newCostCenterCode, int sortOrder,
                                            String itemStatus, String memo, Instant appliedAt, Instant createdAt,
                                            Instant updatedAt) {
    }
    public record RestructurePlanItemListResponse(List<RestructurePlanItemDetail> items, long totalCount) {
    }
    public record RestructurePlanItemCreateRequest(@NotBlank @Pattern(regexp = "^(move|rename|create|deactivate|reactivate)$") String actionType,
                                                   Long targetDeptId, Long newParentId,
                                                   @Size(max = 100) String newName, @Size(max = 30) String newCode,
                                                   @Size(max = 50) String newOrganizationType,
                                                   @Size(max = 30) String newCostCenterCode, Integer sortOrder,
                                                   @Size(max = 500) String memo) {
    }
    public static final class RestructurePlanItemUpdateRequest extends PatchRequest {
        @Pattern(regexp = "^(move|rename|create|deactivate|reactivate)$") private String actionType;
        private Long targetDeptId;
        private Long newParentId;
        @Size(max = 100) private String newName;
        @Size(max = 30) private String newCode;
        @Size(max = 50) private String newOrganizationType;
        @Size(max = 30) private String newCostCenterCode;
        private Integer sortOrder;
        @Size(max = 500) private String memo;

        @JsonSetter("action_type") public void setActionType(String value) { supplied("action_type"); actionType = value; }
        @JsonSetter("target_dept_id") public void setTargetDeptId(Long value) { supplied("target_dept_id"); targetDeptId = value; }
        @JsonSetter("new_parent_id") public void setNewParentId(Long value) { supplied("new_parent_id"); newParentId = value; }
        @JsonSetter("new_name") public void setNewName(String value) { supplied("new_name"); newName = value; }
        @JsonSetter("new_code") public void setNewCode(String value) { supplied("new_code"); newCode = value; }
        @JsonSetter("new_organization_type") public void setNewOrganizationType(String value) { supplied("new_organization_type"); newOrganizationType = value; }
        @JsonSetter("new_cost_center_code") public void setNewCostCenterCode(String value) { supplied("new_cost_center_code"); newCostCenterCode = value; }
        @JsonSetter("sort_order") public void setSortOrder(Integer value) { supplied("sort_order"); sortOrder = value; }
        @JsonSetter("memo") public void setMemo(String value) { supplied("memo"); memo = value; }

        public String actionType() { return actionType; }
        public Long targetDeptId() { return targetDeptId; }
        public Long newParentId() { return newParentId; }
        public String newName() { return newName; }
        public String newCode() { return newCode; }
        public String newOrganizationType() { return newOrganizationType; }
        public String newCostCenterCode() { return newCostCenterCode; }
        public Integer sortOrder() { return sortOrder; }
        public String memo() { return memo; }
    }
    public record RestructureApplyResponse(long planId, int appliedCount, int skippedCount, List<String> messages) {
    }

}
