package com.vibehr.management.api;

import com.vibehr.management.api.ManagementDtos.BulkDeleteRequest;
import com.vibehr.management.api.ManagementDtos.BulkDeleteResponse;
import com.vibehr.management.api.ManagementDtos.CompanyCreateRequest;
import com.vibehr.management.api.ManagementDtos.CompanyDetailResponse;
import com.vibehr.management.api.ManagementDtos.CompanyDropdownResponse;
import com.vibehr.management.api.ManagementDtos.CompanyListResponse;
import com.vibehr.management.api.ManagementDtos.CompanyUpdateRequest;
import com.vibehr.management.api.ManagementDtos.ListResponse;
import com.vibehr.management.api.ManagementDtos.ManagerCompanyCreateRequest;
import com.vibehr.management.api.ManagementDtos.ManagerCompanyItem;
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
public class ManagementCompanyController {
    private final ManagementService service;
    private final ManagementAuthorization authorization;

    public ManagementCompanyController(ManagementService service, ManagementAuthorization authorization) { this.service = service; this.authorization = authorization; }

    @GetMapping("/companies")
    public CompanyListResponse companies(Authentication authentication, @RequestParam(name = "search", required = false) String search,
                                         @RequestParam(name = "page", defaultValue = "1") @Min(1) int page,
                                         @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) {
        authorization.requireCompanyAction(user(authentication), "query");
        return service.companies(search, page, limit);
    }

    @GetMapping("/companies/dropdown")
    public CompanyDropdownResponse companyDropdown(Authentication authentication) { user(authentication); return service.companyDropdown(); }

    @GetMapping("/companies/{company_id}")
    public CompanyDetailResponse company(Authentication authentication, @PathVariable("company_id") int companyId) { user(authentication); return service.company(companyId); }

    @PostMapping("/companies")
    @ResponseStatus(HttpStatus.CREATED)
    public CompanyDetailResponse createCompany(Authentication authentication, @Valid @RequestBody CompanyCreateRequest request) { authorization.requireCompanyAction(user(authentication), "save"); return service.createCompany(request); }

    @PutMapping("/companies/{company_id}")
    public CompanyDetailResponse updateCompany(Authentication authentication, @PathVariable("company_id") int companyId, @Valid @NotNull @RequestBody CompanyUpdateRequest request) { authorization.requireCompanyAction(user(authentication), "save"); return service.updateCompany(companyId, request); }

    @DeleteMapping("/companies")
    public BulkDeleteResponse deleteCompanies(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { authorization.requireCompanyAction(user(authentication), "save"); return new BulkDeleteResponse(service.deleteCompanies(request.ids())); }

    @GetMapping("/manager-status")
    public ListResponse<ManagerCompanyItem> managerCompanies(Authentication authentication, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page,
                                                              @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) {
        user(authentication);
        return service.managerCompanies(page, limit);
    }

    @PostMapping("/manager-status")
    @ResponseStatus(HttpStatus.CREATED)
    public ListResponse<ManagerCompanyItem> createManagerCompany(Authentication authentication, @Valid @RequestBody ManagerCompanyCreateRequest request) { user(authentication); return service.createManagerCompany(request); }

    @DeleteMapping("/manager-status")
    public BulkDeleteResponse deleteManagerCompanies(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { user(authentication); return new BulkDeleteResponse(service.deleteManagerCompanies(request.ids())); }

    private int user(Authentication authentication) { return authorization.requireAnyRole(authentication, "admin", "hr_manager"); }
}
