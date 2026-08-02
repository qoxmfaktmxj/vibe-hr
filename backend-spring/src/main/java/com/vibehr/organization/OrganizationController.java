package com.vibehr.organization;

import static com.vibehr.organization.OrganizationContracts.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.List;
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

/** All 35 canonical /api/v1/org routes migrated from backend/app/api/organization.py. */
@RestController
@Validated
@RequestMapping("/api/v1/org")
public class OrganizationController {
    private final OrganizationService service;
    private final OrganizationAuthorization authorization;

    public OrganizationController(OrganizationService service, OrganizationAuthorization authorization) {
        this.service = service;
        this.authorization = authorization;
    }

    @GetMapping("/corporations")
    public CorporationListResponse corporations(Authentication authentication,
                                                @RequestParam(defaultValue = "1") @Min(1) int page,
                                                @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit,
                                                @RequestParam(name = "all", defaultValue = "false") boolean all,
                                                @RequestParam(name = "enter_cd", required = false) String enterCd,
                                                @RequestParam(name = "company_code", required = false) String companyCode,
                                                @RequestParam(name = "corporation_name", required = false) String corporationName) {
        privileged(authentication);
        return service.corporations(page, limit, all, enterCd, companyCode, corporationName);
    }

    @PostMapping("/corporations") @ResponseStatus(HttpStatus.CREATED)
    public CorporationDetailResponse createCorporation(Authentication authentication, @Valid @RequestBody CorporationCreateRequest request) {
        privileged(authentication);
        return service.createCorporation(request);
    }

    @PutMapping("/corporations/{corporation_id}")
    public CorporationDetailResponse updateCorporation(Authentication authentication, @PathVariable("corporation_id") long corporationId,
                                                       @Valid @RequestBody CorporationUpdateRequest patch) {
        privileged(authentication);
        return service.updateCorporation(corporationId, patch);
    }

    @DeleteMapping("/corporations/{corporation_id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCorporation(Authentication authentication, @PathVariable("corporation_id") long corporationId) {
        privileged(authentication);
        service.deleteCorporation(corporationId);
    }

    @GetMapping("/departments")
    public DepartmentListResponse departments(Authentication authentication, @RequestParam(defaultValue = "1") @Min(1) int page,
                                              @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit,
                                              @RequestParam(name = "all", defaultValue = "false") boolean all,
                                              @RequestParam(required = false) String code, @RequestParam(required = false) String name,
                                              @RequestParam(name = "organization_type", required = false) String organizationType,
                                              @RequestParam(name = "cost_center_code", required = false) String costCenterCode,
                                              @RequestParam(name = "reference_date", required = false) LocalDate referenceDate) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/departments", "query");
        return service.departments(page, limit, all, code, name, organizationType, costCenterCode, referenceDate);
    }

    @GetMapping("/chart")
    public ChartResponse chart(Authentication authentication) {
        long userId = authorization.userId(authentication);
        authorization.requireMenuAction(userId, "/org/chart", "query");
        return service.chart();
    }

    @PostMapping("/departments") @ResponseStatus(HttpStatus.CREATED)
    public DepartmentDetailResponse createDepartment(Authentication authentication, @Valid @RequestBody DepartmentCreateRequest request) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/departments", "save");
        return service.createDepartment(request);
    }

    @PutMapping("/departments/{department_id}")
    public DepartmentDetailResponse updateDepartment(Authentication authentication, @PathVariable("department_id") long departmentId,
                                                     @Valid @RequestBody DepartmentUpdateRequest patch) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/departments", "save");
        return service.updateDepartment(departmentId, patch, userId);
    }

    @DeleteMapping("/departments/{department_id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDepartment(Authentication authentication, @PathVariable("department_id") long departmentId) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/departments", "save");
        service.deleteDepartment(departmentId);
    }

    @GetMapping("/mapping-types")
    public LookupItemsResponse mappingTypes(Authentication authentication) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-items", "query");
        return service.mappingTypes();
    }

    @GetMapping("/mapping-assignments")
    public MappingAssignmentListResponse mappingAssignments(Authentication authentication, @RequestParam(defaultValue = "1") @Min(1) int page,
                                                             @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit,
                                                             @RequestParam(name = "department_id", required = false) Long departmentId,
                                                             @RequestParam(name = "type_code", required = false) String typeCode,
                                                             @RequestParam(name = "reference_date", required = false) LocalDate referenceDate) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "query");
        return service.mappingAssignments(page, limit, departmentId, typeCode, referenceDate);
    }

    @PostMapping("/mapping-assignments") @ResponseStatus(HttpStatus.CREATED)
    public MappingAssignmentDetailResponse createMappingAssignment(Authentication authentication, @Valid @RequestBody MappingAssignmentCreateRequest request) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "save");
        return service.createMappingAssignment(request);
    }

    @PutMapping("/mapping-assignments/{assignment_id}")
    public MappingAssignmentDetailResponse updateMappingAssignment(Authentication authentication, @PathVariable("assignment_id") long assignmentId,
                                                                    @Valid @RequestBody MappingAssignmentUpdateRequest patch) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "save");
        return service.updateMappingAssignment(assignmentId, patch);
    }

    @DeleteMapping("/mapping-assignments/{assignment_id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMappingAssignment(Authentication authentication, @PathVariable("assignment_id") long assignmentId) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "save");
        service.deleteMappingAssignment(assignmentId);
    }

    @GetMapping("/mapping-assignments/upload-template")
    public MappingAssignmentUploadTemplateResponse uploadTemplate(Authentication authentication) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-upload", "template_download");
        return new MappingAssignmentUploadTemplateResponse(List.of("\uC870\uC9C1\uCF54\uB4DC", "\uC720\uD615\uCF54\uB4DC", "\uD56D\uBAA9\uCF54\uB4DC", "\uC2DC\uC791\uC77C", "\uC885\uB8CC\uC77C"));
    }

    @PostMapping("/mapping-assignments/upload-preview")
    public MappingAssignmentUploadPreviewResponse previewUpload(Authentication authentication, @Valid @RequestBody MappingAssignmentUploadRequest request) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-upload", "upload");
        return service.previewUpload(request.rows());
    }

    @PostMapping("/mapping-assignments/upload-confirm")
    public MappingAssignmentUploadConfirmResponse confirmUpload(Authentication authentication, @Valid @RequestBody MappingAssignmentUploadRequest request) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-upload", "upload");
        return service.confirmUpload(request.rows(), userId);
    }

    @GetMapping("/mapping-personal-status")
    public PersonalStatusListResponse personalStatus(Authentication authentication, @RequestParam(name = "reference_date") LocalDate referenceDate,
                                                     @RequestParam(defaultValue = "1") @Min(1) int page,
                                                     @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-personal-status", "query");
        return service.personalStatus(referenceDate, page, limit);
    }

    @GetMapping("/mapping-type-items")
    public MappingTypeItemListResponse mappingTypeItems(Authentication authentication, @RequestParam(defaultValue = "1") @Min(1) int page,
                                                        @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit,
                                                        @RequestParam(name = "type_code", required = false) String typeCode,
                                                        @RequestParam(name = "reference_date", required = false) LocalDate referenceDate) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-items", "query");
        return service.mappingTypeItems(page, limit, typeCode, referenceDate);
    }

    @PostMapping("/mapping-type-items") @ResponseStatus(HttpStatus.CREATED)
    public MappingTypeItemDetailResponse createMappingTypeItem(Authentication authentication, @Valid @RequestBody MappingTypeItemCreateRequest request) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-items", "save");
        return service.createMappingTypeItem(request);
    }

    @PutMapping("/mapping-type-items/{item_id}")
    public MappingTypeItemDetailResponse updateMappingTypeItem(Authentication authentication, @PathVariable("item_id") long itemId,
                                                                @Valid @RequestBody MappingTypeItemUpdateRequest patch) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-items", "save");
        return service.updateMappingTypeItem(itemId, patch);
    }

    @DeleteMapping("/mapping-type-items/{item_id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMappingTypeItem(Authentication authentication, @PathVariable("item_id") long itemId) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/type-items", "save");
        service.deleteMappingTypeItem(itemId);
    }

    @GetMapping("/mapping-type-options")
    public LookupItemsResponse mappingTypeOptions(Authentication authentication) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "query");
        return service.mappingTypeOptions();
    }

    @GetMapping("/mapping-item-options")
    public LookupItemsResponse mappingItemOptions(Authentication authentication, @RequestParam(name = "type_code") String typeCode) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "query");
        return service.mappingItemOptions(typeCode);
    }

    @GetMapping("/department-options")
    public LookupItemsResponse departmentOptions(Authentication authentication) {
        long userId = privileged(authentication);
        authorization.requireMenuAction(userId, "/org/types", "query");
        return service.departmentOptions();
    }

    @GetMapping("/dept-history")
    public DeptChangeHistoryListResponse deptHistory(Authentication authentication, @RequestParam(name = "department_id", required = false) Long departmentId,
                                                     @RequestParam(defaultValue = "200") @Min(1) @Max(1000) int limit) {
        privileged(authentication);
        return service.deptHistory(departmentId, limit);
    }

    @GetMapping("/restructure/plans")
    public RestructurePlanListResponse restructurePlans(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        privileged(authentication);
        return service.restructurePlans(status);
    }

    @PostMapping("/restructure/plans")
    public RestructurePlanItem createRestructurePlan(Authentication authentication, @Valid @RequestBody RestructurePlanCreateRequest request) {
        return service.createRestructurePlan(request, privileged(authentication));
    }

    @PutMapping("/restructure/plans/{plan_id}")
    public RestructurePlanItem updateRestructurePlan(Authentication authentication, @PathVariable("plan_id") long planId,
                                                     @Valid @RequestBody RestructurePlanUpdateRequest patch) {
        privileged(authentication);
        return service.updateRestructurePlan(planId, patch);
    }

    @DeleteMapping("/restructure/plans/{plan_id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRestructurePlan(Authentication authentication, @PathVariable("plan_id") long planId) {
        privileged(authentication);
        service.deleteRestructurePlan(planId);
    }

    @PostMapping("/restructure/plans/{plan_id}/apply")
    public RestructureApplyResponse applyRestructurePlan(Authentication authentication, @PathVariable("plan_id") long planId) {
        return service.applyRestructurePlan(planId, privileged(authentication));
    }

    @GetMapping("/restructure/plans/{plan_id}/items")
    public RestructurePlanItemListResponse restructurePlanItems(Authentication authentication, @PathVariable("plan_id") long planId) {
        privileged(authentication);
        return service.restructurePlanItems(planId);
    }

    @PostMapping("/restructure/plans/{plan_id}/items")
    public RestructurePlanItemDetail addRestructurePlanItem(Authentication authentication, @PathVariable("plan_id") long planId,
                                                            @Valid @RequestBody RestructurePlanItemCreateRequest request) {
        privileged(authentication);
        return service.addRestructurePlanItem(planId, request);
    }

    @PutMapping("/restructure/plans/{plan_id}/items/{item_id}")
    public RestructurePlanItemDetail updateRestructurePlanItem(Authentication authentication, @PathVariable("plan_id") long planId,
                                                               @PathVariable("item_id") long itemId,
                                                               @Valid @RequestBody RestructurePlanItemUpdateRequest patch) {
        privileged(authentication);
        return service.updateRestructurePlanItem(planId, itemId, patch);
    }

    @DeleteMapping("/restructure/plans/{plan_id}/items/{item_id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRestructurePlanItem(Authentication authentication, @PathVariable("plan_id") long planId, @PathVariable("item_id") long itemId) {
        privileged(authentication);
        service.deleteRestructurePlanItem(planId, itemId);
    }

    private long privileged(Authentication authentication) {
        return authorization.requireAnyRole(authentication, "hr_manager", "admin");
    }
}
