package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.TestingAuthenticationToken;

class HrControllerTest {
    @Test
    void employeeGridRetainsTheLegacyRoleAndMenuQueryGate() {
        HrApplicationService service = mock(HrApplicationService.class);
        HrAuthorization authorization = mock(HrAuthorization.class);
        HrController controller = new HrController(service, authorization);
        var authentication = new TestingAuthenticationToken("17", "token");
        Map<String, Object> expected = Map.of("employees", List.of(), "total_count", 0L, "page", 1, "limit", 100);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(17);
        when(service.listEmployees(1, 100, false, null, null, null, null, null)).thenReturn(expected);

        assertThat(controller.employees(authentication, 1, 100, false, null, null, null, null, null)).isSameAs(expected);
        verify(authorization).requireEmployeeMenuAction(17, "query");
        verify(service).listEmployees(1, 100, false, null, null, null, null, null);
    }

    @Test
    void currentEmployeeAcceptsCurrentUserPrincipal() {
        HrApplicationService service = mock(HrApplicationService.class);
        HrController controller = new HrController(service, mock(HrAuthorization.class));
        var authentication = new TestingAuthenticationToken(new CurrentUser(42L, Set.of("employee")), "token");
        authentication.setAuthenticated(true);
        Map<String, Object> expected = Map.of("employee_id", 42);
        when(service.employeeForUser(42)).thenReturn(expected);

        assertThat(controller.currentEmployee(authentication)).isSameAs(expected);
        verify(service).employeeForUser(42);
    }

    @Test
    void currentEmployeeRejectsOverflowCurrentUserIdWithStandardBadRequest() {
        HrController controller = new HrController(mock(HrApplicationService.class), mock(HrAuthorization.class));
        var authentication = new TestingAuthenticationToken(
                new CurrentUser((long) Integer.MAX_VALUE + 1, Set.of("employee")), "token");
        authentication.setAuthenticated(true);

        ApiException exception = assertThrows(ApiException.class, () -> controller.currentEmployee(authentication));

        assertThat(exception.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(exception.detail()).isEqualTo("user_id is outside the supported INTEGER range.");
    }

    @Test
    void currentEmployeeRejectsUnauthenticatedRequests() {
        HrController controller = new HrController(mock(HrApplicationService.class), mock(HrAuthorization.class));

        ApiException exception = assertThrows(ApiException.class, () -> controller.currentEmployee(null));

        assertThat(exception.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(exception.detail()).isEqualTo("Not authenticated.");
    }
}
