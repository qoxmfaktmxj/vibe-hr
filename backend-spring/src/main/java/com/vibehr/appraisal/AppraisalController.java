package com.vibehr.appraisal;

import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1/pap")
public class AppraisalController {

    private final AppraisalService service;
    private final DomainAuthorization authorization;

    public AppraisalController(AppraisalService service, DomainAuthorization authorization) {
        this.service = service;
        this.authorization = authorization;
    }

    @GetMapping("/appraisals")
    public AppraisalListResponse listAppraisals(Authentication authentication,
            @RequestParam(required = false) String code, @RequestParam(required = false) String name,
            @RequestParam(name = "appraisal_year", required = false) @Min(2000) @Max(2100) Integer appraisalYear,
            @RequestParam(name = "active_only", required = false) Boolean activeOnly,
            @RequestParam(defaultValue = "1") @Min(1) int page, @RequestParam(defaultValue = "100") @Min(1) @Max(500) int limit,
            @RequestParam(name = "all", defaultValue = "false") boolean allRows) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.appraisals", "query");
        return service.listAppraisals(code, name, appraisalYear, activeOnly, page, limit, allRows);
    }

    @PostMapping("/appraisals") @ResponseStatus(HttpStatus.CREATED)
    public AppraisalDetailResponse createAppraisal(Authentication authentication, @Valid @RequestBody AppraisalCreateRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.appraisals", "save");
        return service.createAppraisal(request);
    }

    @PutMapping("/appraisals/{appraisalId}")
    public AppraisalDetailResponse updateAppraisal(Authentication authentication, @PathVariable int appraisalId,
            @Valid @RequestBody AppraisalUpdateRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.appraisals", "save");
        return service.updateAppraisal(appraisalId, request);
    }

    @DeleteMapping("/appraisals/{appraisalId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAppraisal(Authentication authentication, @PathVariable int appraisalId) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.appraisals", "save");
        service.deleteAppraisal(appraisalId);
    }

    @GetMapping("/final-results")
    public FinalResultListResponse listFinalResults(Authentication authentication,
            @RequestParam(required = false) String code, @RequestParam(required = false) String name,
            @RequestParam(name = "active_only", required = false) Boolean activeOnly,
            @RequestParam(defaultValue = "1") @Min(1) int page, @RequestParam(defaultValue = "100") @Min(1) @Max(500) int limit,
            @RequestParam(name = "all", defaultValue = "false") boolean allRows) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.final-results", "query");
        return service.listFinalResults(code, name, activeOnly, page, limit, allRows);
    }

    @PostMapping("/final-results") @ResponseStatus(HttpStatus.CREATED)
    public FinalResultDetailResponse createFinalResult(Authentication authentication, @Valid @RequestBody FinalResultCreateRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.final-results", "save");
        return service.createFinalResult(request);
    }

    @PutMapping("/final-results/{resultId}")
    public FinalResultDetailResponse updateFinalResult(Authentication authentication, @PathVariable int resultId,
            @Valid @RequestBody FinalResultUpdateRequest request) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.final-results", "save");
        return service.updateFinalResult(resultId, request);
    }

    @DeleteMapping("/final-results/{resultId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFinalResult(Authentication authentication, @PathVariable int resultId) {
        int userId = authorization.requireAnyRole(authentication, "hr_manager", "admin");
        authorization.requireMenuAction(userId, "pap.final-results", "save");
        service.deleteFinalResult(resultId);
    }

    @GetMapping("/targets")
    public TargetListResponse listTargets(Authentication authentication, @RequestParam(name = "appraisal_id", required = false) Integer appraisalId) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.listTargets(appraisalId);
    }

    @PostMapping("/targets/batch")
    public TargetBatchResponse saveTargetBatch(Authentication authentication, @Valid @RequestBody TargetBatchRequest request) {
        authorization.requireAnyRole(authentication, "hr_manager", "admin");
        return service.saveTargetBatch(request);
    }
}
