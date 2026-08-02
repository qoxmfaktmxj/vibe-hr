package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

class HriControllerTest {
    @Test
    void formTypeReadUsesTheEmployeeRoleGateAndDelegatesToTheService() {
        HriApplicationService service = mock(HriApplicationService.class);
        HriAuthorization authorization = mock(HriAuthorization.class);
        HriController controller = new HriController(service, authorization);
        var authentication = new TestingAuthenticationToken("7", "token");
        HriFormTypeListResponse expected = new HriFormTypeListResponse(List.of(), 0);
        when(authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin")).thenReturn(7);
        when(service.listFormTypes()).thenReturn(expected);

        assertThat(controller.formTypes(authentication)).isSameAs(expected);
        verify(service).listFormTypes();
    }
}
