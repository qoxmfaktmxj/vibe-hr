package com.vibehr.training;

import com.vibehr.appraisal.DomainAuthorization;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/tra")
public class TrainingController {

    private final TrainingService service;
    private final DomainAuthorization authorization;

    public TrainingController(TrainingService service, DomainAuthorization authorization) {
        this.service = service;
        this.authorization = authorization;
    }

    @PostMapping("/generate/required-events")
    public GenerationResponse generateRequiredEvents(Authentication authentication, @Valid @RequestBody RequiredEventsRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.generateRequiredEvents(request.year());
    }

    @PostMapping("/generate/required-targets")
    public GenerationResponse generateRequiredTargets(Authentication authentication, @Valid @RequestBody RequiredTargetsRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.generateRequiredTargets(request.year(), request.ruleCode());
    }

    @PostMapping("/generate/elearning-windows")
    public GenerationResponse generateElearningWindows(Authentication authentication, @Valid @RequestBody ElearningWindowsRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.generateElearningWindows(request.year(), request.effectiveAppCount());
    }

    @PostMapping("/cyber-results/apply")
    public GenerationResponse applyCyberResults(Authentication authentication, @Valid @RequestBody CyberResultsRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.applyCyberResults(request.uploadYm());
    }

    @GetMapping("/my-applications")
    public ApplicationListResponse myApplications(Authentication authentication) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.myApplications(userId);
    }

    @PostMapping("/my-applications") @ResponseStatus(HttpStatus.OK)
    public ApplicationActionResponse createApplication(Authentication authentication, @Valid @RequestBody ApplicationCreateRequest request) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.createApplication(userId, request);
    }

    @GetMapping("/applications-detail")
    public ApplicationListResponse applicationsDetail(Authentication authentication) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.applicationsDetail();
    }

    @PostMapping("/applications/{appId}/approve")
    public ApplicationActionResponse approveApplication(Authentication authentication, @PathVariable int appId) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.approveApplication(appId);
    }

    @PostMapping("/applications/{appId}/reject")
    public ApplicationActionResponse rejectApplication(Authentication authentication, @PathVariable int appId, @Valid @RequestBody ApplicationRejectRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.rejectApplication(appId, request);
    }

    @PutMapping("/applications/{appId}/withdraw")
    public ApplicationActionResponse withdrawApplication(Authentication authentication, @PathVariable int appId) {
        int userId = authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.withdrawApplication(appId, userId);
    }

    @GetMapping("/{resource}")
    public ResourceListResponse listResource(Authentication authentication, @PathVariable String resource,
            @RequestParam(required = false) @Min(2000) @Max(2100) Integer year) {
        authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin");
        return service.listResource(resource, year);
    }

    @PostMapping("/{resource}/batch")
    public ResourceBatchResponse saveResourceBatch(Authentication authentication, @PathVariable String resource, @Valid @RequestBody ResourceBatchRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.saveResourceBatch(resource, request);
    }
}
