package com.vibehr.organization;

import static com.vibehr.organization.OrganizationContracts.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class OrganizationControllerTest {
    private final OrganizationService service = mock(OrganizationService.class);
    private final OrganizationAuthorization authorization = mock(OrganizationAuthorization.class);
    private final OrganizationController controller = new OrganizationController(service, authorization);
    private final Authentication authentication = mock(Authentication.class);

    @Test
    void declaresEveryCanonicalFastApiOrganizationRouteExactlyOnce() {
        List<String> actual = List.of(
                mappings(GetMapping.class, "GET"), mappings(PostMapping.class, "POST"),
                mappings(PutMapping.class, "PUT"), mappings(DeleteMapping.class, "DELETE")
        ).stream().flatMap(List::stream).toList();

        assertThat(actual).containsExactlyInAnyOrder(
                "GET /corporations", "POST /corporations", "PUT /corporations/{corporation_id}", "DELETE /corporations/{corporation_id}",
                "GET /departments", "POST /departments", "PUT /departments/{department_id}", "DELETE /departments/{department_id}", "GET /chart",
                "GET /mapping-types", "GET /mapping-assignments", "POST /mapping-assignments", "PUT /mapping-assignments/{assignment_id}",
                "DELETE /mapping-assignments/{assignment_id}", "GET /mapping-assignments/upload-template",
                "POST /mapping-assignments/upload-preview", "POST /mapping-assignments/upload-confirm", "GET /mapping-personal-status",
                "GET /mapping-type-items", "POST /mapping-type-items", "PUT /mapping-type-items/{item_id}", "DELETE /mapping-type-items/{item_id}",
                "GET /mapping-type-options", "GET /mapping-item-options", "GET /department-options", "GET /dept-history",
                "GET /restructure/plans", "POST /restructure/plans", "PUT /restructure/plans/{plan_id}", "DELETE /restructure/plans/{plan_id}",
                "POST /restructure/plans/{plan_id}/apply", "GET /restructure/plans/{plan_id}/items",
                "POST /restructure/plans/{plan_id}/items", "PUT /restructure/plans/{plan_id}/items/{item_id}",
                "DELETE /restructure/plans/{plan_id}/items/{item_id}"
        );
        assertThat(actual).hasSize(35);
    }

    @Test
    void chartRetainsTheLegacyMenuCheckWithoutTheHrRoleGate() {
        ChartResponse expected = new ChartResponse(List.of(), 0);
        when(authorization.userId(authentication)).thenReturn(17L);
        when(service.chart()).thenReturn(expected);

        assertThat(controller.chart(authentication)).isSameAs(expected);

        verify(authorization).userId(authentication);
        verify(authorization).requireMenuAction(17L, "/org/chart", "query");
        verify(service).chart();
        verifyNoMoreInteractions(authorization);
    }

    @Test
    void mappingAssignmentWriteUsesTheLegacyRoleAndSaveActionBoundary() {
        MappingAssignmentCreateRequest request = new MappingAssignmentCreateRequest(10, "COST", 4, LocalDate.of(2026, 8, 1), null);
        MappingAssignmentDetailResponse expected = new MappingAssignmentDetailResponse(null);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(31L);
        when(service.createMappingAssignment(request)).thenReturn(expected);

        assertThat(controller.createMappingAssignment(authentication, request)).isSameAs(expected);

        verify(authorization).requireAnyRole(authentication, "hr_manager", "admin");
        verify(authorization).requireMenuAction(31L, "/org/types", "save");
        verify(service).createMappingAssignment(request);
    }

    @Test
    void uploadConfirmationPassesTheAuthenticatedActorForAuditedAtomicUpsert() {
        MappingAssignmentUploadRequest request = new MappingAssignmentUploadRequest("atomic", List.of(
                new MappingAssignmentUploadRow("HQ", "COST", "CC-100", LocalDate.of(2026, 8, 1), null)));
        MappingAssignmentUploadConfirmResponse expected = new MappingAssignmentUploadConfirmResponse(1, 0);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(55L);
        when(service.confirmUpload(request.rows(), 55L)).thenReturn(expected);

        assertThat(controller.confirmUpload(authentication, request)).isSameAs(expected);

        verify(authorization).requireMenuAction(55L, "/org/type-upload", "upload");
        verify(service).confirmUpload(request.rows(), 55L);
    }

    private static List<String> mappings(Class<? extends Annotation> annotationType, String verb) {
        return java.util.Arrays.stream(OrganizationController.class.getDeclaredMethods())
                .map(method -> mapping(method, annotationType, verb)).filter(java.util.Objects::nonNull).toList();
    }

    private static String mapping(Method method, Class<? extends Annotation> type, String verb) {
        if (type == GetMapping.class && method.isAnnotationPresent(GetMapping.class)) return verb + " " + method.getAnnotation(GetMapping.class).value()[0];
        if (type == PostMapping.class && method.isAnnotationPresent(PostMapping.class)) return verb + " " + method.getAnnotation(PostMapping.class).value()[0];
        if (type == PutMapping.class && method.isAnnotationPresent(PutMapping.class)) return verb + " " + method.getAnnotation(PutMapping.class).value()[0];
        if (type == DeleteMapping.class && method.isAnnotationPresent(DeleteMapping.class)) return verb + " " + method.getAnnotation(DeleteMapping.class).value()[0];
        return null;
    }
}
