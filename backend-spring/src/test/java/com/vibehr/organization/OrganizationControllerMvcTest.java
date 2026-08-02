package com.vibehr.organization;

import static com.vibehr.organization.OrganizationContracts.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.error.ApiExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class OrganizationControllerMvcTest {
    private OrganizationService service;
    private OrganizationAuthorization authorization;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        service = mock(OrganizationService.class);
        authorization = mock(OrganizationAuthorization.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new OrganizationController(service, authorization))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void everyTypedPatchBoundaryReturns422WithThePythonBodyLocation() throws Exception {
        List<InvalidPatch> cases = List.of(
                new InvalidPatch("/api/v1/org/corporations/1", "{\"enter_cd\":\"\"}", "enter_cd"),
                new InvalidPatch("/api/v1/org/departments/1", "{\"name\":\"" + "x".repeat(101) + "\"}", "name"),
                new InvalidPatch("/api/v1/org/mapping-type-items/1", "{\"type_code\":\"\"}", "type_code"),
                new InvalidPatch("/api/v1/org/mapping-assignments/1", "{\"type_code\":\"" + "x".repeat(51) + "\"}", "type_code"),
                new InvalidPatch("/api/v1/org/restructure/plans/1", "{\"title\":\"\"}", "title"),
                new InvalidPatch("/api/v1/org/restructure/plans/1/items/1", "{\"action_type\":\"merge\"}", "action_type")
        );

        for (InvalidPatch invalid : cases) {
            mockMvc.perform(put(invalid.path())
                            .principal(new TestingAuthenticationToken("17", "token"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(invalid.json()))
                    .andExpect(status().isUnprocessableContent())
                    .andExpect(jsonPath("$.detail[0].loc[0]").value("body"))
                    .andExpect(jsonPath("$.detail[0].loc[1]").value(invalid.field()));
        }

        verifyNoInteractions(authorization, service);
    }

    @Test
    void departmentPatchBindingDistinguishesOmittedAndExplicitNullParent() throws Exception {
        when(authorization.requireAnyRole(any(), any(String[].class))).thenReturn(17L);
        when(service.updateDepartment(eq(8L), any(), eq(17L))).thenReturn(new DepartmentDetailResponse(null));

        mockMvc.perform(put("/api/v1/org/departments/8")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/org/departments/8")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parent_id\":null}"))
                .andExpect(status().isOk());

        ArgumentCaptor<DepartmentUpdateRequest> patches = ArgumentCaptor.forClass(DepartmentUpdateRequest.class);
        org.mockito.Mockito.verify(service, org.mockito.Mockito.times(2)).updateDepartment(eq(8L), patches.capture(), eq(17L));
        assertThat(patches.getAllValues().get(0).has("parent_id")).isFalse();
        assertThat(patches.getAllValues().get(1).has("parent_id")).isTrue();
        assertThat(patches.getAllValues().get(1).parentId()).isNull();
    }

    @Test
    void mappingPatchBindingRetainsExplicitNullForClearableFields() throws Exception {
        when(authorization.requireAnyRole(any(), any(String[].class))).thenReturn(17L);
        when(service.updateMappingTypeItem(eq(3L), any())).thenReturn(new MappingTypeItemDetailResponse(null));

        mockMvc.perform(put("/api/v1/org/mapping-type-items/3")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"effective_to\":null,\"remark\":null,\"type_code\":null}"))
                .andExpect(status().isOk());

        ArgumentCaptor<MappingTypeItemUpdateRequest> patch = ArgumentCaptor.forClass(MappingTypeItemUpdateRequest.class);
        org.mockito.Mockito.verify(service).updateMappingTypeItem(eq(3L), patch.capture());
        assertThat(patch.getValue().has("effective_to")).isTrue();
        assertThat(patch.getValue().has("remark")).isTrue();
        assertThat(patch.getValue().has("type_code")).isTrue();
        assertThat(patch.getValue().effectiveTo()).isNull();
        assertThat(patch.getValue().remark()).isNull();
    }

    @Test
    void koreanRestructureConflictDetailIsPreservedOverHttp() throws Exception {
        when(authorization.requireAnyRole(any(), any(String[].class))).thenReturn(17L);
        when(service.applyRestructurePlan(anyLong(), anyLong()))
                .thenThrow(ApiException.conflict("이미 적용된 개편안입니다."));

        mockMvc.perform(post("/api/v1/org/restructure/plans/9/apply")
                        .principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이미 적용된 개편안입니다."));
    }

    private record InvalidPatch(String path, String json, String field) {
    }
}
