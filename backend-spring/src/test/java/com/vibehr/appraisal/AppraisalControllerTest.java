package com.vibehr.appraisal;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.platform.error.ApiExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AppraisalControllerTest {

    private final AppraisalService service = mock(AppraisalService.class);
    private final DomainAuthorization authorization = mock(DomainAuthorization.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AppraisalController(service, authorization))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void invalidTypedPatchReturnsPythonStyle422BeforeAuthorizationOrService() throws Exception {
        mockMvc.perform(put("/api/v1/pap/appraisals/41")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"appraisal_code\":\"\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("appraisal_code"));

        verifyNoInteractions(authorization, service);
    }

    @Test
    void invalidNestedBatchItemCascadesToPythonStyle422() throws Exception {
        mockMvc.perform(post("/api/v1/pap/targets/batch")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"grade_code\":\"1234567890123456789012345678901\"}]}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"));

        verifyNoInteractions(authorization, service);
    }

    @Test
    void invalidFinalResultPatchReturns422AtTheTypedBoundary() throws Exception {
        String tooLong = "x".repeat(121);

        mockMvc.perform(put("/api/v1/pap/final-results/7")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"result_name\":\"" + tooLong + "\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("result_name"));

        verifyNoInteractions(authorization, service);
    }

    @Test
    void listAppraisalsRequiresThePythonQueryMenuActionBeforeCallingTheService() {
        AppraisalController controller = new AppraisalController(service, authorization);
        var authentication = new TestingAuthenticationToken("17", "token");
        AppraisalListResponse expected = new AppraisalListResponse(List.of(), 0, 1, 100);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(17);
        when(service.listAppraisals(null, null, null, null, 1, 100, false)).thenReturn(expected);

        AppraisalListResponse actual = controller.listAppraisals(authentication, null, null, null, null, 1, 100, false);

        assertSame(expected, actual);
        verify(authorization).requireMenuAction(17, "pap.appraisals", "query");
        verify(service).listAppraisals(null, null, null, null, 1, 100, false);
    }

    @Test
    void targetBatchRetainsTheSourceRoleGateWithoutAddingAnUnspecifiedMenuActionGate() {
        AppraisalController controller = new AppraisalController(service, authorization);
        var authentication = new TestingAuthenticationToken("17", "token");
        TargetBatchRequest request = new TargetBatchRequest(List.of());
        TargetBatchResponse expected = new TargetBatchResponse(0, 0, 0);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(17);
        when(service.saveTargetBatch(request)).thenReturn(expected);

        assertSame(expected, controller.saveTargetBatch(authentication, request));
        verify(service).saveTargetBatch(request);
    }
}
