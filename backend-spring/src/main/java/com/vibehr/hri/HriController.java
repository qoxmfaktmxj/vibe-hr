package com.vibehr.hri;

import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1")
public class HriController {
    private final HriApplicationService service;
    private final HriAuthorization authorization;

    HriController(HriApplicationService service, HriAuthorization authorization) {
        this.service = service;
        this.authorization = authorization;
    }

    @GetMapping("/hri/form-types")
    public HriFormTypeListResponse formTypes(Authentication authentication) {
        authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.listFormTypes();
    }

    @PostMapping("/hri/form-types/batch")
    public HriFormTypeBatchResponse saveFormTypes(Authentication authentication, @Valid @RequestBody HriFormTypeBatchRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.saveFormTypes(request, userId);
    }

    @GetMapping("/hri/approval-templates")
    public HriApprovalTemplateListResponse approvalTemplates(Authentication authentication) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.listApprovalTemplates();
    }

    @PostMapping("/hri/approval-templates/batch")
    public HriApprovalTemplateBatchResponse saveApprovalTemplates(Authentication authentication,
            @Valid @RequestBody HriApprovalTemplateBatchRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.saveApprovalTemplates(request);
    }

    @PostMapping("/hri/requests/draft")
    public HriRequestDetailResponse saveDraft(Authentication authentication, @Valid @RequestBody HriRequestDraftUpsertRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return new HriRequestDetailResponse(service.saveDraft(userId, request));
    }

    @PostMapping("/hri/requests/{request_id}/submit")
    public HriRequestSubmitResponse submit(Authentication authentication, @PathVariable("request_id") int requestId) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.submit(userId, requestId);
    }

    @PostMapping("/hri/requests/{request_id}/withdraw")
    public HriRequestActionResponse withdraw(Authentication authentication, @PathVariable("request_id") int requestId) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.withdraw(userId, requestId);
    }

    @PostMapping("/hri/requests/{request_id}/approve")
    public HriRequestActionResponse approve(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody HriRequestActionRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.approve(userId, requestId, request.comment());
    }

    @PostMapping("/hri/requests/{request_id}/reject")
    public HriRequestActionResponse reject(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody HriRequestActionRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.reject(userId, requestId, request.comment());
    }

    @PostMapping("/hri/requests/{request_id}/receive-complete")
    public HriRequestActionResponse receiveComplete(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody HriRequestActionRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.receiveComplete(userId, requestId, request.comment());
    }

    @PostMapping("/hri/requests/{request_id}/receive-reject")
    public HriRequestActionResponse receiveReject(Authentication authentication, @PathVariable("request_id") int requestId,
            @Valid @RequestBody HriRequestActionRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.receiveReject(userId, requestId, request.comment());
    }

    @GetMapping("/hri/requests/my")
    public HriRequestListResponse myRequests(Authentication authentication,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.myRequests(userId, page, limit);
    }

    @GetMapping("/hri/requests/{request_id}")
    public HriRequestDetailFullResponse detail(Authentication authentication, @PathVariable("request_id") int requestId) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return new HriRequestDetailFullResponse(service.detail(userId, requestId));
    }

    @GetMapping("/hri/tasks/my-approvals")
    public HriTaskListResponse myApprovalTasks(Authentication authentication,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.approvalTasks(userId, page, limit);
    }

    @GetMapping("/hri/tasks/my-receives")
    public HriTaskListResponse myReceiveTasks(Authentication authentication,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.receiveTasks(userId, page, limit);
    }
}
