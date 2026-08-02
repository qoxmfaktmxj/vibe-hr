package com.vibehr.management.api;

import com.vibehr.management.api.ManagementDtos.BulkDeleteRequest;
import com.vibehr.management.api.ManagementDtos.BulkDeleteResponse;
import com.vibehr.management.api.ManagementDtos.InfraConfigItem;
import com.vibehr.management.api.ManagementDtos.InfraConfigUpsertRequest;
import com.vibehr.management.api.ManagementDtos.InfraMasterCreateRequest;
import com.vibehr.management.api.ManagementDtos.InfraMasterItem;
import com.vibehr.management.api.ManagementDtos.ListResponse;
import com.vibehr.management.application.ManagementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/mng")
public class ManagementInfrastructureController {
    private final ManagementService service;
    private final ManagementAuthorization authorization;
    public ManagementInfrastructureController(ManagementService service, ManagementAuthorization authorization) { this.service = service; this.authorization = authorization; }

    @GetMapping("/infra-masters")
    public ListResponse<InfraMasterItem> infraMasters(Authentication authentication, @RequestParam(name = "company_id", required = false) Integer companyId, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { admin(authentication); return service.infraMasters(companyId, page, limit); }
    @PostMapping("/infra-masters") @ResponseStatus(HttpStatus.CREATED)
    public ListResponse<InfraMasterItem> createInfraMaster(Authentication authentication, @Valid @RequestBody InfraMasterCreateRequest request) { admin(authentication); return service.createInfraMaster(request); }
    @DeleteMapping("/infra-masters")
    public BulkDeleteResponse deleteInfraMasters(Authentication authentication, @Valid @RequestBody BulkDeleteRequest request) { admin(authentication); return new BulkDeleteResponse(service.deleteInfraMasters(request.ids())); }
    @GetMapping("/infra-configs/{master_id}")
    public ListResponse<InfraConfigItem> infraConfigs(Authentication authentication, @PathVariable("master_id") int masterId, @RequestParam(name = "page", defaultValue = "1") @Min(1) int page, @RequestParam(name = "limit", defaultValue = "50") @Min(1) @Max(200) int limit) { admin(authentication); return service.infraConfigs(masterId, page, limit); }
    @PostMapping("/infra-configs/{master_id}")
    public ListResponse<InfraConfigItem> upsertInfraConfigs(Authentication authentication, @PathVariable("master_id") int masterId, @Valid @RequestBody InfraConfigUpsertRequest request) { admin(authentication); return service.upsertInfraConfigs(masterId, request); }
    @DeleteMapping("/infra-configs/{config_id}")
    public ResponseEntity<Void> deleteInfraConfig(Authentication authentication, @PathVariable("config_id") int configId) { admin(authentication); service.deleteInfraConfig(configId); return ResponseEntity.noContent().build(); }

    private int admin(Authentication authentication) { return authorization.requireAnyRole(authentication, "admin"); }
}
