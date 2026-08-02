package com.vibehr.appraisal;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

record AppraisalListResponse(List<AppraisalItem> items, int totalCount, int page, int limit) { }
record AppraisalDetailResponse(AppraisalItem item) { }
record FinalResultListResponse(List<FinalResultItem> items, int totalCount, int page, int limit) { }
record FinalResultDetailResponse(FinalResultItem item) { }
record TargetListResponse(List<TargetItem> items, int totalCount) { }
record TargetBatchResponse(int created, int updated, int deleted) { }

record AppraisalItem(
        int id, String appraisalCode, String appraisalName, int appraisalYear, Integer finalResultId,
        String finalResultCode, String finalResultName, String appraisalType, LocalDate startDate,
        LocalDate endDate, boolean isActive, int sortOrder, String description, Instant createdAt, Instant updatedAt) { }

record FinalResultItem(
        int id, String resultCode, String resultName, Double scoreGrade, boolean isActive, int sortOrder,
        String description, Instant createdAt, Instant updatedAt) { }

record TargetItem(
        int id, int appraisalId, String appraisalName, int employeeId, String employeeNo, String employeeName,
        String departmentName, Double score, String gradeCode, String evaluatorNote, String status,
        Instant evaluatedAt, Instant createdAt, Instant updatedAt) { }

record AppraisalCreateRequest(
        @NotBlank @Size(max = 30) String appraisalCode,
        @NotBlank @Size(max = 120) String appraisalName,
        @Min(2000) @Max(2100) int appraisalYear,
        Integer finalResultId,
        @Size(max = 40) String appraisalType,
        LocalDate startDate,
        LocalDate endDate,
        Boolean isActive,
        int sortOrder,
        @Size(max = 500) String description) {
    boolean effectiveIsActive() { return isActive == null || isActive; }
}

record FinalResultCreateRequest(
        @NotBlank @Size(max = 30) String resultCode,
        @NotBlank @Size(max = 120) String resultName,
        Double scoreGrade,
        Boolean isActive,
        int sortOrder,
        @Size(max = 500) String description) {
    boolean effectiveIsActive() { return isActive == null || isActive; }
}

record TargetBatchRequest(@NotNull List<@NotNull @Valid TargetBatchRow> items) { }
record TargetBatchRow(
        Integer id,
        @JsonProperty("appraisal_id") Integer appraisalId,
        @JsonProperty("employee_id") Integer employeeId,
        Double score,
        @JsonProperty("grade_code") @Size(max = 30) String gradeCode,
        @JsonProperty("evaluator_note") @Size(max = 2000) String evaluatorNote,
        @Size(max = 20) String status,
        @JsonProperty("_status") String rowStatus) {
    String statusOrClean() { return rowStatus == null ? "clean" : rowStatus; }
}

final class AppraisalUpdateRequest {
    @Size(min = 1, max = 30) private String appraisalCode;
    @Size(min = 1, max = 120) private String appraisalName;
    @Min(2000) @Max(2100) private Integer appraisalYear;
    private Integer finalResultId;
    @Size(max = 40) private String appraisalType;
    private LocalDate startDate;
    private LocalDate endDate;
    private Boolean isActive;
    private Integer sortOrder;
    @Size(max = 500) private String description;
    private boolean appraisalCodeSet;
    private boolean appraisalNameSet;
    private boolean appraisalYearSet;
    private boolean finalResultIdSet;
    private boolean appraisalTypeSet;
    private boolean startDateSet;
    private boolean endDateSet;
    private boolean isActiveSet;
    private boolean sortOrderSet;
    private boolean descriptionSet;

    @JsonSetter("appraisal_code") public void setAppraisalCode(String value) { appraisalCode = value; appraisalCodeSet = true; }
    @JsonSetter("appraisal_name") public void setAppraisalName(String value) { appraisalName = value; appraisalNameSet = true; }
    @JsonSetter("appraisal_year") public void setAppraisalYear(Integer value) { appraisalYear = value; appraisalYearSet = true; }
    @JsonSetter("final_result_id") public void setFinalResultId(Integer value) { finalResultId = value; finalResultIdSet = true; }
    @JsonSetter("appraisal_type") public void setAppraisalType(String value) { appraisalType = value; appraisalTypeSet = true; }
    @JsonSetter("start_date") public void setStartDate(LocalDate value) { startDate = value; startDateSet = true; }
    @JsonSetter("end_date") public void setEndDate(LocalDate value) { endDate = value; endDateSet = true; }
    @JsonSetter("is_active") public void setIsActive(Boolean value) { isActive = value; isActiveSet = true; }
    @JsonSetter("sort_order") public void setSortOrder(Integer value) { sortOrder = value; sortOrderSet = true; }
    @JsonSetter("description") public void setDescription(String value) { description = value; descriptionSet = true; }

    String appraisalCode() { return appraisalCode; }
    String appraisalName() { return appraisalName; }
    Integer appraisalYear() { return appraisalYear; }
    Integer finalResultId() { return finalResultId; }
    String appraisalType() { return appraisalType; }
    LocalDate startDate() { return startDate; }
    LocalDate endDate() { return endDate; }
    Boolean isActive() { return isActive; }
    Integer sortOrder() { return sortOrder; }
    String description() { return description; }
    @JsonIgnore boolean hasAppraisalCode() { return appraisalCodeSet; }
    @JsonIgnore boolean hasAppraisalName() { return appraisalNameSet; }
    @JsonIgnore boolean hasAppraisalYear() { return appraisalYearSet; }
    @JsonIgnore boolean hasFinalResultId() { return finalResultIdSet; }
    @JsonIgnore boolean hasAppraisalType() { return appraisalTypeSet; }
    @JsonIgnore boolean hasStartDate() { return startDateSet; }
    @JsonIgnore boolean hasEndDate() { return endDateSet; }
    @JsonIgnore boolean hasIsActive() { return isActiveSet; }
    @JsonIgnore boolean hasSortOrder() { return sortOrderSet; }
    @JsonIgnore boolean hasDescription() { return descriptionSet; }
}

final class FinalResultUpdateRequest {
    @Size(min = 1, max = 30) private String resultCode;
    @Size(min = 1, max = 120) private String resultName;
    private Double scoreGrade;
    private Boolean isActive;
    private Integer sortOrder;
    @Size(max = 500) private String description;
    private boolean resultCodeSet;
    private boolean resultNameSet;
    private boolean scoreGradeSet;
    private boolean isActiveSet;
    private boolean sortOrderSet;
    private boolean descriptionSet;

    @JsonSetter("result_code") public void setResultCode(String value) { resultCode = value; resultCodeSet = true; }
    @JsonSetter("result_name") public void setResultName(String value) { resultName = value; resultNameSet = true; }
    @JsonSetter("score_grade") public void setScoreGrade(Double value) { scoreGrade = value; scoreGradeSet = true; }
    @JsonSetter("is_active") public void setIsActive(Boolean value) { isActive = value; isActiveSet = true; }
    @JsonSetter("sort_order") public void setSortOrder(Integer value) { sortOrder = value; sortOrderSet = true; }
    @JsonSetter("description") public void setDescription(String value) { description = value; descriptionSet = true; }

    String resultCode() { return resultCode; }
    String resultName() { return resultName; }
    Double scoreGrade() { return scoreGrade; }
    Boolean isActive() { return isActive; }
    Integer sortOrder() { return sortOrder; }
    String description() { return description; }
    @JsonIgnore boolean hasResultCode() { return resultCodeSet; }
    @JsonIgnore boolean hasResultName() { return resultNameSet; }
    @JsonIgnore boolean hasScoreGrade() { return scoreGradeSet; }
    @JsonIgnore boolean hasIsActive() { return isActiveSet; }
    @JsonIgnore boolean hasSortOrder() { return sortOrderSet; }
    @JsonIgnore boolean hasDescription() { return descriptionSet; }
}
