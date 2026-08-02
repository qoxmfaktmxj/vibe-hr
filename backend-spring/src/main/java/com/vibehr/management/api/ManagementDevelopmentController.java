package com.vibehr.management.api;

import com.vibehr.management.api.ManagementDtos.BulkDeleteRequest;
import com.vibehr.management.api.ManagementDtos.BulkDeleteResponse;
import com.vibehr.management.api.ManagementDtos.DetailResponse;
import com.vibehr.management.api.ManagementDtos.DevInquiryCreateRequest;
import com.vibehr.management.api.ManagementDtos.DevInquiryItem;
import com.vibehr.management.api.ManagementDtos.DevInquiryUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevProjectCreateRequest;
import com.vibehr.management.api.ManagementDtos.DevProjectItem;
import com.vibehr.management.api.ManagementDtos.DevProjectUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevRequestCreateRequest;
import com.vibehr.management.api.ManagementDtos.DevRequestItem;
import com.vibehr.management.api.ManagementDtos.DevRequestMonthlySummaryItem;
import com.vibehr.management.api.ManagementDtos.DevRequestUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevStaffProjectItem;
import com.vibehr.management.api.ManagementDtos.DevStaffRevenueItem;
import com.vibehr.management.api.ManagementDtos.ListResponse;
import com.vibehr.management.application.ManagementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
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

@RestController
@Validated
@RequestMapping("/api/v1/mng")
public class ManagementDevelopmentController {
    private final ManagementService service;
    private final ManagementAuthorization authorization;
    public ManagementDevelopmentController(ManagementService service, ManagementAuthorization authorization) { this.service = service; this.authorization = authorization; }

    @GetMapping("/dev-requests")
    public ListResponse<DevRequestItem> devRequests(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "status_code", required = false) String statusCode, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.devRequests(companyId, statusCode, page, limit); }
    @GetMapping("/dev-requests/monthly-summary")
    public ListResponse<DevRequestMonthlySummaryItem> devRequestMonthlySummary(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "status_code", required = false) String statusCode, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.devRequestMonthlySummary(companyId, statusCode, page, limit); }
    @GetMapping("/dev-requests/{request_id}")
    public DetailResponse<DevRequestItem> devRequest(Authentication authentication, @PathVariable("request_id") int requestId) { user(authentication); return service.devRequest(requestId); }
    @PostMapping("/dev-requests") @ResponseStatus(HttpStatus.CREATED)
    public DetailResponse<DevRequestItem> createDevRequest(Authentication authentication, @Valid @RequestBody DevRequestCreateRequest request) { user(authentication); return service.createDevRequest(request); }
    @PutMapping("/dev-requests/{request_id}")
    public DetailResponse<DevRequestItem> updateDevRequest(Authentication authentication, @PathVariable("request_id") int requestId, @Valid @NotNull @RequestBody DevRequestUpdateRequest request) { user(authentication); return service.updateDevRequest(requestId, request); }
    @DeleteMapping("/dev-requests")
    public BulkDeleteResponse deleteDevRequests(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { user(authentication); return new BulkDeleteResponse(service.deleteDevRequests(request.ids())); }

    @GetMapping("/dev-projects")
    public ListResponse<DevProjectItem> devProjects(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.devProjects(companyId, page, limit); }
    @GetMapping("/dev-projects/{project_id}")
    public DetailResponse<DevProjectItem> devProject(Authentication authentication, @PathVariable("project_id") int projectId) { user(authentication); return service.devProject(projectId); }
    @PostMapping("/dev-projects") @ResponseStatus(HttpStatus.CREATED)
    public DetailResponse<DevProjectItem> createDevProject(Authentication authentication, @Valid @RequestBody DevProjectCreateRequest request) { user(authentication); return service.createDevProject(request); }
    @PutMapping("/dev-projects/{project_id}")
    public DetailResponse<DevProjectItem> updateDevProject(Authentication authentication, @PathVariable("project_id") int projectId, @Valid @NotNull @RequestBody DevProjectUpdateRequest request) { user(authentication); return service.updateDevProject(projectId, request); }
    @DeleteMapping("/dev-projects")
    public BulkDeleteResponse deleteDevProjects(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { user(authentication); return new BulkDeleteResponse(service.deleteDevProjects(request.ids())); }

    @GetMapping("/dev-inquiries")
    public ListResponse<DevInquiryItem> devInquiries(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "progress_code", required = false) String progressCode, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.devInquiries(companyId, progressCode, page, limit); }
    @GetMapping("/dev-inquiries/{inquiry_id}")
    public DetailResponse<DevInquiryItem> devInquiry(Authentication authentication, @PathVariable("inquiry_id") int inquiryId) { user(authentication); return service.devInquiry(inquiryId); }
    @PostMapping("/dev-inquiries") @ResponseStatus(HttpStatus.CREATED)
    public DetailResponse<DevInquiryItem> createDevInquiry(Authentication authentication, @Valid @RequestBody DevInquiryCreateRequest request) { user(authentication); return service.createDevInquiry(request); }
    @PutMapping("/dev-inquiries/{inquiry_id}")
    public DetailResponse<DevInquiryItem> updateDevInquiry(Authentication authentication, @PathVariable("inquiry_id") int inquiryId, @Valid @NotNull @RequestBody DevInquiryUpdateRequest request) { user(authentication); return service.updateDevInquiry(inquiryId, request); }
    @DeleteMapping("/dev-inquiries")
    public BulkDeleteResponse deleteDevInquiries(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { user(authentication); return new BulkDeleteResponse(service.deleteDevInquiries(request.ids())); }

    @GetMapping("/dev-staff/projects")
    public ListResponse<DevStaffProjectItem> devStaffProjects(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.devStaffProjects(companyId, page, limit); }
    @GetMapping("/dev-staff/revenue-summary")
    public ListResponse<DevStaffRevenueItem> devStaffRevenue(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.devStaffRevenue(companyId, page, limit); }

    private int user(Authentication authentication) { return authorization.requireAnyRole(authentication, "admin", "hr_manager"); }
}
