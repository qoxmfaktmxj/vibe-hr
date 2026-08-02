package com.vibehr.training;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.appraisal.DomainAuthorization;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

class TrainingControllerTest {

    @Test
    void canonicalApplicationDetailRouteUsesTheEffectivePythonHandlerContract() {
        TrainingService service = mock(TrainingService.class);
        DomainAuthorization authorization = mock(DomainAuthorization.class);
        TrainingController controller = new TrainingController(service, authorization);
        var authentication = new TestingAuthenticationToken("9", "token");
        ApplicationListResponse expected = new ApplicationListResponse(List.of(), 0);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(9);
        when(service.applicationsDetail()).thenReturn(expected);

        assertSame(expected, controller.applicationsDetail(authentication));
        verify(service).applicationsDetail();
    }
}
