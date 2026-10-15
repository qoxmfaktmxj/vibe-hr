package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import java.util.List;
import java.util.Map;
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

    @Test
    void directSubmissionUsesTheEmployeeRoleGateAndAtomicServiceBoundary() {
        HriApplicationService service = mock(HriApplicationService.class);
        HriAuthorization authorization = mock(HriAuthorization.class);
        HriController controller = new HriController(service, authorization);
        var authentication = new TestingAuthenticationToken("7", "token");
        var command = new HriRequestDraftUpsertRequest(null, 11, "Request", Map.of());
        var expected = new HriRequestSubmitResponse(42, "APPROVAL_IN_PROGRESS", 1);
        when(authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin")).thenReturn(7);
        when(service.saveAndSubmit(7, command)).thenReturn(expected);

        assertThat(controller.saveAndSubmit(authentication, command)).isSameAs(expected);
        verify(service).saveAndSubmit(7, command);
    }

    @Test
    void directSubmissionDoesNotReachTheServiceWhenRoleAccessIsDenied() {
        HriApplicationService service = mock(HriApplicationService.class);
        HriAuthorization authorization = mock(HriAuthorization.class);
        HriController controller = new HriController(service, authorization);
        var authentication = new TestingAuthenticationToken("7", "token");
        when(authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin"))
                .thenThrow(ApiException.forbidden("Forbidden."));

        assertThatThrownBy(() -> controller.saveAndSubmit(authentication,
                new HriRequestDraftUpsertRequest(null, 11, "Request", Map.of()))).isInstanceOf(ApiException.class);
        verifyNoInteractions(service);
    }
}
