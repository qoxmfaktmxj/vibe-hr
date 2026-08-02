package com.vibehr.organization;

import static com.vibehr.organization.OrganizationContracts.MappingAssignmentCreateRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OrganizationServiceTest {
    private final EntityManager entityManager = mock(EntityManager.class);
    private final OrganizationReferenceReadMapper references = mock(OrganizationReferenceReadMapper.class);
    private final OrganizationService service = new OrganizationService(entityManager, references);

    @Test
    void assignmentCreateLocksItsDepartmentTypeGroupBeforePersisting() {
        OrgDepartment department = new OrgDepartment();
        department.id = 10;
        department.code = "HQ";
        department.name = "Headquarters";
        OrgMappingTypeItem item = new OrgMappingTypeItem();
        item.id = 4;
        item.typeCode = "COST";
        item.itemCode = "CC-100";
        item.name = "Cost center";
        item.effectiveFrom = LocalDate.of(2026, 1, 1);
        item.active = true;

        @SuppressWarnings("unchecked") TypedQuery<OrgMappingTypeItem> itemQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<Integer> overlapQuery = mock(TypedQuery.class);
        Query lockQuery = mock(Query.class);
        when(entityManager.find(OrgDepartment.class, 10, LockModeType.PESSIMISTIC_READ)).thenReturn(department);
        when(entityManager.createQuery(contains("OrgMappingTypeItem i where i.id"), eq(OrgMappingTypeItem.class))).thenReturn(itemQuery);
        when(itemQuery.setParameter(anyString(), any())).thenReturn(itemQuery);
        when(itemQuery.getResultList()).thenReturn(List.of(item));
        when(entityManager.createNativeQuery(contains("org_mapping_assignments"))).thenReturn(lockQuery);
        when(lockQuery.setParameter(anyString(), any())).thenReturn(lockQuery);
        when(lockQuery.getResultList()).thenReturn(List.of());
        when(entityManager.createQuery(contains("select a.id"), eq(Integer.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.setMaxResults(1)).thenReturn(overlapQuery);
        when(overlapQuery.getResultList()).thenReturn(List.of());
        doAnswer(invocation -> {
            ((OrgMappingAssignment) invocation.getArgument(0)).id = 99;
            return null;
        }).when(entityManager).persist(any(OrgMappingAssignment.class));

        var result = service.createMappingAssignment(new MappingAssignmentCreateRequest(10, " cost ", 4,
                LocalDate.of(2026, 8, 1), null));

        ArgumentCaptor<OrgMappingAssignment> persisted = ArgumentCaptor.forClass(OrgMappingAssignment.class);
        verify(entityManager).persist(persisted.capture());
        verify(entityManager).createNativeQuery(contains("for update"));
        assertThat(persisted.getValue().typeCode).isEqualTo("COST");
        assertThat(persisted.getValue().departmentId).isEqualTo(10);
        assertThat(result.item().itemCode()).isEqualTo("CC-100");
    }

    @Test
    void anAlreadyAppliedPlanPreservesSourceConflictIdempotencySemantics() {
        OrgRestructurePlan plan = new OrgRestructurePlan();
        plan.id = 9;
        plan.status = "applied";
        when(entityManager.find(OrgRestructurePlan.class, 9, LockModeType.PESSIMISTIC_WRITE)).thenReturn(plan);

        assertThatThrownBy(() -> service.applyRestructurePlan(9, 17))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(409);
                    assertThat(exception.detail()).isEqualTo("이미 적용된 개편안입니다.");
                });
        verify(entityManager).find(OrgRestructurePlan.class, 9, LockModeType.PESSIMISTIC_WRITE);
    }
}
