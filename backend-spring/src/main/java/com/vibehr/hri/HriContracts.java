package com.vibehr.hri;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;

record HriFormTypeItem(int id, String formCode, String formNameKo, String formNameEn, String moduleCode,
        boolean isActive, boolean allowDraft, boolean allowWithdraw, boolean requiresReceive, int defaultPriority,
        Integer createdBy, Integer updatedBy, Instant createdAt, Instant updatedAt) { }
record HriFormTypeListResponse(List<HriFormTypeItem> items, int totalCount) { }
record HriFormTypeBatchItem(Integer id, @NotBlank @Size(max = 30) String formCode,
        @NotBlank @Size(max = 100) String formNameKo, @Size(max = 100) String formNameEn,
        @Size(max = 30) String moduleCode, Boolean isActive, Boolean allowDraft, Boolean allowWithdraw,
        Boolean requiresReceive, Integer defaultPriority) { }
record HriFormTypeBatchRequest(@Valid List<HriFormTypeBatchItem> items, @JsonProperty("delete_ids") List<Integer> deleteIds) { }
record HriFormTypeBatchResponse(List<HriFormTypeItem> items, int totalCount, int insertedCount, int updatedCount, int deletedCount) { }

record HriApprovalTemplateStepItem(int id, int stepOrder, String stepType, String actorResolveType,
        String actorRoleCode, Integer actorUserId, boolean allowDelegate, String requiredAction,
        Instant createdAt, Instant updatedAt) { }
record HriApprovalTemplateItem(int id, String templateCode, String templateName, String scopeType,
        String scopeId, boolean isDefault, boolean isActive, int priority, Instant createdAt, Instant updatedAt,
        List<HriApprovalTemplateStepItem> steps) { }
record HriApprovalTemplateListResponse(List<HriApprovalTemplateItem> items, int totalCount) { }
record HriApprovalTemplateStepBatchItem(Integer id, @Min(1) @Max(99) int stepOrder,
        @Pattern(regexp = "^(APPROVAL|RECEIVE|REFERENCE)$") String stepType,
        @Pattern(regexp = "^(ROLE_BASED|USER_FIXED)$") String actorResolveType,
        @Size(max = 30) String actorRoleCode, Integer actorUserId, Boolean allowDelegate,
        @Pattern(regexp = "^(APPROVE|RECEIVE)$") String requiredAction) { }
record HriApprovalTemplateBatchItem(Integer id, @NotBlank @Size(max = 30) String templateCode,
        @NotBlank @Size(max = 100) String templateName,
        @Pattern(regexp = "^(GLOBAL|COMPANY|DEPT|TEAM|USER)$") String scopeType, @Size(max = 40) String scopeId,
        Boolean isDefault, Boolean isActive, Integer priority, @Valid List<HriApprovalTemplateStepBatchItem> steps) { }
record HriApprovalTemplateBatchRequest(@Valid List<HriApprovalTemplateBatchItem> items,
        @JsonProperty("delete_ids") List<Integer> deleteIds) { }
record HriApprovalTemplateBatchResponse(List<HriApprovalTemplateItem> items, int totalCount,
        int insertedCount, int updatedCount, int deletedCount) { }

record HriRequestItem(int id, String requestNo, int formTypeId, String formName, int requesterId, String title,
        String statusCode, Integer currentStepOrder, String currentActorName, Instant submittedAt, Instant completedAt,
        Instant createdAt, Instant updatedAt, Map<String, Object> contentJson) { }
record HriRequestListResponse(List<HriRequestItem> items, int totalCount, int page, int limit) { }
record HriTaskItem(int requestId, String requestNo, String title, String statusCode, int stepOrder, String stepType,
        int requesterId, Instant requestedAt, String formName) { }
record HriTaskListResponse(List<HriTaskItem> items, int totalCount, int page, int limit) { }
record HriRequestDraftUpsertRequest(@JsonProperty("request_id") Integer requestId,
        @JsonProperty("form_type_id") @Min(1) int formTypeId, @NotBlank @Size(max = 200) String title,
        @JsonProperty("content_json") Map<String, Object> contentJson) { }
record HriRequestStepSnapshotItem(int id, int stepOrder, String stepType, String actorName, String actionStatus,
        Instant actedAt, String comment) { }
record HriRequestDetailFull(int id, String requestNo, int formTypeId, String formCode, String formName,
        int requesterId, String title, String statusCode, Integer currentStepOrder, String currentActorName,
        Instant submittedAt, Instant completedAt, Instant createdAt, Instant updatedAt, Map<String, Object> contentJson,
        List<HriRequestStepSnapshotItem> steps, Map<String, Object> detailData) { }
record HriRequestDetailResponse(HriRequestItem request) { }
record HriRequestDetailFullResponse(HriRequestDetailFull request) { }
record HriRequestSubmitResponse(int requestId, String statusCode, Integer currentStepOrder) { }
record HriRequestActionRequest(@Size(max = 1000) String comment) { }
record HriRequestActionResponse(int requestId, String statusCode) { }
