package com.vibehr.management;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.management.api.ManagementAuthorization;
import com.vibehr.management.api.ManagementCompanyController;
import com.vibehr.management.api.ManagementDevelopmentController;
import com.vibehr.management.api.ManagementInfrastructureController;
import com.vibehr.management.api.ManagementOutsourceController;
import com.vibehr.management.api.ManagementDtos.CompanyListResponse;
import com.vibehr.management.api.ManagementDtos.ListResponse;
import com.vibehr.management.application.ManagementService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

class ManagementControllerTest {
    private final ManagementService service = mock(ManagementService.class);
    private final ManagementAuthorization authorization = mock(ManagementAuthorization.class);
    private final Authentication authentication = mock(Authentication.class);

    @Test
    void companyListRetainsTheLegacyQueryActionCheck() {
        when(authorization.requireAnyRole(authentication, "admin", "hr_manager")).thenReturn(10);
        when(service.companies(null, 1, 50)).thenReturn(new CompanyListResponse(java.util.List.of(), 0, 1, 50));

        var response = new ManagementCompanyController(service, authorization).companies(authentication, null, 1, 50);

        assertThat(response.totalCount()).isZero();
        verify(authorization).requireCompanyAction(10, "query");
    }

    @Test
    void roleOnlyLegacyRoutesDoNotAddACompanyMenuActionCheck() {
        when(authorization.requireAnyRole(authentication, "admin", "hr_manager")).thenReturn(10);
        when(service.devRequests(null, null, 1, 50)).thenReturn(new ListResponse<>(java.util.List.of(), 0, 1, 50));

        var response = new ManagementDevelopmentController(service, authorization).devRequests(authentication, null, null, 1, 50);

        assertThat(response.totalCount()).isZero();
        verify(authorization).requireAnyRole(authentication, "admin", "hr_manager");
    }

    @Test
    void infraRoutesRemainAdminOnly() {
        when(authorization.requireAnyRole(authentication, "admin")).thenReturn(10);
        when(service.infraMasters(null, 1, 50)).thenReturn(new ListResponse<>(java.util.List.of(), 0, 1, 50));

        var response = new ManagementInfrastructureController(service, authorization).infraMasters(authentication, null, 1, 50);

        assertThat(response.totalCount()).isZero();
        verify(authorization).requireAnyRole(authentication, "admin");
    }

    @Test
    void outsourceControllerRetainsTheManagementRoleSet() {
        when(authorization.requireAnyRole(authentication, "admin", "hr_manager")).thenReturn(10);
        when(service.outsourceContracts(null, 1, 50)).thenReturn(new ListResponse<>(java.util.List.of(), 0, 1, 50));

        var response = new ManagementOutsourceController(service, authorization).outsourceContracts(authentication, null, 1, 50);

        assertThat(response.totalCount()).isZero();
        verify(authorization).requireAnyRole(authentication, "admin", "hr_manager");
    }
}
