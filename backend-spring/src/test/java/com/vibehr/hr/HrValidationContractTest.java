package com.vibehr.hr;

import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

class HrValidationContractTest {
    private HrApplicationService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(HrApplicationService.class);
        JsonMapper mapper = JsonMapper.builder().propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE).build();
        mvc = MockMvcBuilders.standaloneSetup(new HrController(service, mock(HrAuthorization.class)))
                .setMessageConverters(new JacksonJsonHttpMessageConverter(mapper))
                .setControllerAdvice(new HrValidationExceptionHandler())
                .build();
    }

    @Test
    void missingRequiredEmployeeFieldUsesFastApi422Shape() throws Exception {
        mvc.perform(post("/api/v1/employees").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[?(@.loc[1] == 'display_name')].type", contains("missing")))
                .andExpect(jsonPath("$.detail[?(@.loc[1] == 'display_name')].msg", contains("Field required")))
                .andExpect(jsonPath("$.detail[?(@.loc[1] == 'display_name')].input", contains((Object) null)));
    }

    @Test
    void nestedBatchConstraintKeepsIndexedLocationAndPydanticMessage() throws Exception {
        mvc.perform(post("/api/v1/employees/batch").contentType(MediaType.APPLICATION_JSON).content("""
                {"insert":[{"display_name":"A","department_id":1,"position_title":"개발자","password":"test-password"}]}
                """))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("string_too_short"))
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("insert"))
                .andExpect(jsonPath("$.detail[0].loc[2]").value(0))
                .andExpect(jsonPath("$.detail[0].loc[3]").value("display_name"))
                .andExpect(jsonPath("$.detail[0].msg").value("String should have at least 2 characters"))
                .andExpect(jsonPath("$.detail[0].input").value("A"));
    }

    @Test
    void explicitNullForNonNullableDefaultIsRejectedAsATypeError() throws Exception {
        mvc.perform(post("/api/v1/employees").contentType(MediaType.APPLICATION_JSON).content("""
                {"display_name":"홍길동","department_id":1,"position_title":"개발자","employment_status":null,"password":"test-password"}
                """))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].type").value("string_type"))
                .andExpect(jsonPath("$.detail[0].loc", contains("body", "employment_status")))
                .andExpect(jsonPath("$.detail[0].msg").value("Input should be a valid string"))
                .andExpect(jsonPath("$.detail[0].input").value((Object) null));
    }

    @Test
    void nullablePatchAcceptsNullButTracksItSeparatelyFromOmission() throws Exception {
        org.mockito.Mockito.when(service.updateEmployee(eq(9), any())).thenReturn(Map.of());
        mvc.perform(put("/api/v1/employees/9").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/employees/9").contentType(MediaType.APPLICATION_JSON).content("{\"position_title\":null}"))
                .andExpect(status().isOk());

        ArgumentCaptor<HrRequests.EmployeeUpdate> captor = ArgumentCaptor.forClass(HrRequests.EmployeeUpdate.class);
        verify(service, org.mockito.Mockito.times(2)).updateEmployee(eq(9), captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getAllValues().get(0).has("position_title")).isFalse();
        org.assertj.core.api.Assertions.assertThat(captor.getAllValues().get(1).has("position_title")).isTrue();
        org.assertj.core.api.Assertions.assertThat(captor.getAllValues().get(1).positionTitle).isNull();
    }
}
