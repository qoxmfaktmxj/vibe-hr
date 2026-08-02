package com.vibehr.welfare;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

record WelBenefitTypeItem(int id, String code, String name, String modulePath, boolean isDeduction,
        String payItemCode, boolean isActive, int sortOrder, Instant createdAt, Instant updatedAt) { }
record WelBenefitTypeListResponse(List<WelBenefitTypeItem> items, int totalCount, int page, int limit) { }
record WelBenefitRequestItem(int id, String requestNo, String benefitTypeCode, String benefitTypeName,
        String employeeNo, String employeeName, String departmentName, String statusCode, int requestedAmount,
        Integer approvedAmount, String payrollRunLabel, String description, Instant requestedAt, Instant approvedAt,
        Instant createdAt, Instant updatedAt) { }
record WelBenefitRequestListResponse(List<WelBenefitRequestItem> items, int totalCount, int page, int limit) { }
record WelBenefitTypeRowInput(Integer id, @NotBlank String code, @NotBlank String name, @NotBlank String modulePath,
        Boolean isDeduction, @Size(max = 60) String payItemCode, Boolean isActive, Integer sortOrder,
        @JsonProperty("_status") String rowStatus) { }
record WelBenefitTypeBatchRequest(@Valid List<WelBenefitTypeRowInput> items) { }
record WelBenefitTypeBatchResponse(int created, int updated, int deleted) { }
record WelBenefitRequestCreateRequest(@NotBlank String benefitTypeCode, int requestedAmount,
        @Size(max = 500) String description) { }
record WelBenefitRequestApproveRequest(int approvedAmount, @Size(max = 500) String note) { }
record WelBenefitRequestRejectRequest(@Size(max = 500) String reason) { }
record WelBenefitRequestActionResponse(WelBenefitRequestItem item) { }
