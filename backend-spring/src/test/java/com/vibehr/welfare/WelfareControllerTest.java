package com.vibehr.welfare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.hri.HriAuthorization;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

class WelfareControllerTest {
    @Test
    void requestListUsesTheManagerRoleGateAndDelegatesPagination() {
        WelfareApplicationService service = mock(WelfareApplicationService.class);
        HriAuthorization authorization = mock(HriAuthorization.class);
        WelfareController controller = new WelfareController(service, authorization);
        var authentication = new TestingAuthenticationToken("8", "token");
        WelBenefitRequestListResponse expected = new WelBenefitRequestListResponse(java.util.List.of(), 0, 1, 50);
        when(authorization.requireAnyRole(authentication, "hr_manager", "payroll_mgr", "admin")).thenReturn(8);
        when(service.requests(1, 50)).thenReturn(expected);

        assertThat(controller.requests(authentication, 1, 50)).isSameAs(expected);
        verify(service).requests(1, 50);
    }
}
