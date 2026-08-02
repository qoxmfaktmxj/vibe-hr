package com.vibehr.training;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;

record GenerationResponse(int processed, String message) { }
record ResourceListResponse(List<Map<String, Object>> items, int totalCount) { }
record ResourceBatchRequest(List<Map<String, Object>> items) { }
record ResourceBatchResponse(int created, int updated, int deleted) { }
record RequiredEventsRequest(@Min(2000) @Max(2100) int year) { }
record RequiredTargetsRequest(@Min(2000) @Max(2100) int year, @Size(max = 30) String ruleCode) { }
record ElearningWindowsRequest(@Min(2000) @Max(2100) int year, @Min(0) @Max(31) Integer appCount) {
    int effectiveAppCount() { return appCount == null ? 2 : appCount; }
}
record CyberResultsRequest(@Pattern(regexp = "^\\d{6}$") String uploadYm) { }
record ApplicationListResponse(List<ApplicationItem> items, int totalCount) { }
record ApplicationActionResponse(ApplicationItem item) { }
record ApplicationCreateRequest(int courseId, Integer eventId, String inOutType, boolean yearPlanYn, @Size(max = 2000) String eduMemo, @Size(max = 2000) String note) { }
record ApplicationRejectRequest(@Size(max = 2000) String reason) { }
record ApplicationItem(
        int id, String applicationNo, int employeeId, String employeeNo, String employeeName, String departmentName,
        int courseId, String courseName, Integer eventId, String eventName, String inOutType, String status,
        boolean yearPlanYn, boolean surveyYn, String eduMemo, String note, Instant createdAt, Instant updatedAt) { }
