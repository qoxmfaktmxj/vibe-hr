package com.vibehr.welfare;

import com.vibehr.hri.HriAuthorization;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/wel")
public class WelfareController {
    private final WelfareApplicationService service;
    private final HriAuthorization authorization;

    WelfareController(WelfareApplicationService service, HriAuthorization authorization) {
        this.service = service;
        this.authorization = authorization;
    }

    @GetMapping("/benefit-types")
    public WelBenefitTypeListResponse benefitTypes(Authentication authentication,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        authorization.requireAnyRole(authentication, "employee", "hr_manager", "payroll_mgr", "admin");
        return service.benefitTypes(page, limit);
    }

    @PostMapping("/benefit-types/batch")
    public WelBenefitTypeBatchResponse saveBenefitTypes(Authentication authentication,
            @Valid @RequestBody WelBenefitTypeBatchRequest request) {
        authorization.requireAnyRole(authentication, "admin");
        return service.saveBenefitTypes(request);
    }

    @GetMapping("/requests")
    public WelBenefitRequestListResponse requests(Authentication authentication,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit) {
        authorization.requireAnyRole(authentication, "hr_manager", "payroll_mgr", "admin");
        return service.requests(page, limit);
    }

    @PostMapping("/requests")
    public WelBenefitRequestActionResponse createRequest(Authentication authentication,
            @Valid @RequestBody WelBenefitRequestCreateRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "payroll_mgr", "admin");
        return service.createRequest(userId, request);
    }

    @GetMapping("/my-requests")
    public WelBenefitRequestListResponse myRequests(Authentication authentication) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "payroll_mgr", "admin");
        return service.myRequests(userId);
    }

    @PostMapping("/requests/{req_id}/approve")
    public WelBenefitRequestActionResponse approve(Authentication authentication, @PathVariable("req_id") int requestId,
            @Valid @RequestBody WelBenefitRequestApproveRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "payroll_mgr", "admin");
        return service.approve(requestId, request);
    }

    @PostMapping("/requests/{req_id}/reject")
    public WelBenefitRequestActionResponse reject(Authentication authentication, @PathVariable("req_id") int requestId,
            @Valid @RequestBody WelBenefitRequestRejectRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "payroll_mgr", "admin");
        return service.reject(requestId, request);
    }

    @PutMapping("/requests/{req_id}/withdraw")
    public WelBenefitRequestActionResponse withdraw(Authentication authentication, @PathVariable("req_id") int requestId) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "payroll_mgr", "admin");
        return service.withdraw(requestId, userId);
    }
}
