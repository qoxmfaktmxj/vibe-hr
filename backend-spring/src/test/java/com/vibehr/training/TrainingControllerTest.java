package com.vibehr.training;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.appraisal.DomainAuthorization;
import com.vibehr.platform.error.ApiExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

class TrainingControllerTest {

    @Test
    void personalApplicationBindsExplicitFalseWithNullableFieldsOmitted() throws Exception {
        TrainingService service = mock(TrainingService.class);
        DomainAuthorization authorization = mock(DomainAuthorization.class);
        var authentication = new TestingAuthenticationToken("9", "token");
        when(authorization.requireAnyRole(authentication, "employee", "hr_manager", "admin")).thenReturn(9);
        when(service.createApplication(eq(9), any(ApplicationCreateRequest.class))).thenReturn(new ApplicationActionResponse(null));

        mockMvc(service, authorization).perform(post("/api/v1/tra/my-applications")
                        .principal(authentication)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"course_id\":1,\"year_plan_yn\":false,\"note\":\"업무 관련 교육\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<ApplicationCreateRequest> request = ArgumentCaptor.forClass(ApplicationCreateRequest.class);
        verify(service).createApplication(eq(9), request.capture());
        assertThat(request.getValue()).isEqualTo(new ApplicationCreateRequest(1, null, null, false, null, "업무 관련 교육"));
    }

    @Test
    void personalApplicationWithoutPrimitiveYearPlanFlagRejectsBeforeService() throws Exception {
        TrainingService service = mock(TrainingService.class);
        DomainAuthorization authorization = mock(DomainAuthorization.class);

        mockMvc(service, authorization).perform(post("/api/v1/tra/my-applications")
                        .principal(new TestingAuthenticationToken("9", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"course_id\":1,\"note\":\"업무 관련 교육\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("json_invalid"))
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"));

        verifyNoInteractions(authorization, service);
    }

    private MockMvc mockMvc(TrainingService service, DomainAuthorization authorization) {
        JsonMapper mapper = JsonMapper.builder().propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE).build();
        return MockMvcBuilders.standaloneSetup(new TrainingController(service, authorization))
                .setMessageConverters(new JacksonJsonHttpMessageConverter(mapper))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

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
