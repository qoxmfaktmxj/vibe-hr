package com.vibehr.management.api;

import com.vibehr.management.api.ManagementDtos.BulkDeleteRequest;
import com.vibehr.management.api.ManagementDtos.BulkDeleteResponse;
import com.vibehr.management.api.ManagementDtos.DetailResponse;
import com.vibehr.management.api.ManagementDtos.ListResponse;
import com.vibehr.management.api.ManagementDtos.OutsourceAttendanceCreateRequest;
import com.vibehr.management.api.ManagementDtos.OutsourceAttendanceItem;
import com.vibehr.management.api.ManagementDtos.OutsourceAttendanceSummaryItem;
import com.vibehr.management.api.ManagementDtos.OutsourceContractCreateRequest;
import com.vibehr.management.api.ManagementDtos.OutsourceContractDuplicateResponse;
import com.vibehr.management.api.ManagementDtos.OutsourceContractItem;
import com.vibehr.management.api.ManagementDtos.OutsourceContractUpdateRequest;
import com.vibehr.management.application.ManagementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
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
public class ManagementOutsourceController {
    private final ManagementService service;
    private final ManagementAuthorization authorization;
    public ManagementOutsourceController(ManagementService service, ManagementAuthorization authorization) { this.service = service; this.authorization = authorization; }

    @GetMapping("/outsource-contracts")
    public ListResponse<OutsourceContractItem> outsourceContracts(Authentication authentication, @RequestParam(name = "search", required = false) String search, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.outsourceContracts(search, page, limit); }
    @GetMapping("/outsource-contracts/check-duplicate")
    public OutsourceContractDuplicateResponse duplicateOutsourceContract(Authentication authentication, @RequestParam(name = "employee_id") int employeeId, @RequestParam(name = "start_date") LocalDate startDate, @RequestParam(name = "exclude_contract_id", required = false) Integer excludeContractId) { user(authentication); return new OutsourceContractDuplicateResponse(service.hasDuplicateOutsourceContract(employeeId, startDate, excludeContractId)); }
    @GetMapping("/outsource-contracts/{contract_id}")
    public DetailResponse<OutsourceContractItem> outsourceContract(Authentication authentication, @PathVariable("contract_id") int contractId) { user(authentication); return service.outsourceContract(contractId); }
    @PostMapping("/outsource-contracts") @ResponseStatus(HttpStatus.CREATED)
    public DetailResponse<OutsourceContractItem> createOutsourceContract(Authentication authentication, @Valid @RequestBody OutsourceContractCreateRequest request) { user(authentication); return service.createOutsourceContract(request); }
    @PutMapping("/outsource-contracts/{contract_id}")
    public DetailResponse<OutsourceContractItem> updateOutsourceContract(Authentication authentication, @PathVariable("contract_id") int contractId, @Valid @NotNull @RequestBody OutsourceContractUpdateRequest request) { user(authentication); return service.updateOutsourceContract(contractId, request); }
    @DeleteMapping("/outsource-contracts")
    public BulkDeleteResponse deleteOutsourceContracts(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { user(authentication); return new BulkDeleteResponse(service.deleteOutsourceContracts(request.ids())); }

    @GetMapping("/outsource-attendances/summary")
    public ListResponse<OutsourceAttendanceSummaryItem> outsourceAttendanceSummary(Authentication authentication, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.outsourceAttendanceSummary(page, limit); }
    @GetMapping("/outsource-attendances/{contract_id}")
    public ListResponse<OutsourceAttendanceItem> outsourceAttendances(Authentication authentication, @PathVariable("contract_id") int contractId, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { user(authentication); return service.outsourceAttendances(contractId, page, limit); }
    @PostMapping("/outsource-attendances") @ResponseStatus(HttpStatus.CREATED)
    public ListResponse<OutsourceAttendanceItem> createOutsourceAttendance(Authentication authentication, @Valid @RequestBody OutsourceAttendanceCreateRequest request) { user(authentication); return service.createOutsourceAttendance(request); }
    @DeleteMapping("/outsource-attendances")
    public BulkDeleteResponse deleteOutsourceAttendances(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { user(authentication); return new BulkDeleteResponse(service.deleteOutsourceAttendances(request.ids())); }

    private int user(Authentication authentication) { return authorization.requireAnyRole(authentication, "admin", "hr_manager"); }
}
