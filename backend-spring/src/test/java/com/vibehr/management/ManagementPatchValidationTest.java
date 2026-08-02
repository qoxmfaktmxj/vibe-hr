package com.vibehr.management;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.management.api.ManagementAuthorization;
import com.vibehr.management.api.ManagementCompanyController;
import com.vibehr.management.api.ManagementDevelopmentController;
import com.vibehr.management.api.ManagementOutsourceController;
import com.vibehr.management.application.ManagementService;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.error.ApiExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ManagementPatchValidationTest {
    private MockMvc mockMvc;
    private ManagementService service;

    @BeforeEach
    void setUp() {
        service = org.mockito.Mockito.mock(ManagementService.class);
        ManagementAuthorization authorization = org.mockito.Mockito.mock(ManagementAuthorization.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new ManagementCompanyController(service, authorization),
                        new ManagementDevelopmentController(service, authorization),
                        new ManagementOutsourceController(service, authorization))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void invalidDateReturns422() throws Exception {
        mockMvc.perform(put("/api/v1/mng/companies/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"start_date\":\"not-a-date\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.detail[0].type").value("json_invalid"));
    }

    @Test
    void invalidNumberReturns422() throws Exception {
        mockMvc.perform(put("/api/v1/mng/dev-projects/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contract_amount\":\"not-a-number\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.detail[0].type").value("json_invalid"));
    }

    @Test
    void invalidBooleanReturns422() throws Exception {
        mockMvc.perform(put("/api/v1/mng/outsource-contracts/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"is_active\":\"not-a-boolean\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.detail[0].type").value("json_invalid"));
    }

    @Test
    void nullPatchBodyReturns422() throws Exception {
        mockMvc.perform(put("/api/v1/mng/dev-inquiries/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("null"))
                .andExpect(status().is(422));
    }

    @Test
    void pydanticStringBoundsReturn422() throws Exception {
        mockMvc.perform(put("/api/v1/mng/dev-projects/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"project_name\":\"\"}"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.detail[0].loc[1]").value("project_name"));
    }

    @Test
    void koreanPythonErrorDetailIsPreservedOverHttp() throws Exception {
        when(service.devRequest(404)).thenThrow(ApiException.notFound("추가개발 요청을 찾을 수 없습니다."));

        mockMvc.perform(get("/api/v1/mng/dev-requests/404"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("추가개발 요청을 찾을 수 없습니다."));
    }
}
