package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import com.vibehr.welfare.WelfareApplicationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class HriBusinessDateAndDetailValidationTest {
    @Test
    void approvalTemplateSelectionUsesSeoulDateAcrossTheUtcBoundary() {
        assertTemplateQueryDate("2026-01-01T14:59:59Z", LocalDate.of(2026, 1, 1));
        assertTemplateQueryDate("2026-01-01T15:00:00Z", LocalDate.of(2026, 1, 2));
    }

    @Test
    void draftMayRemainIncompleteButSubmitUsesFastApiShapedValidation() {
        var draft = HriDetailContracts.validate("TIM_CORRECTION", Map.of("before_status", "present"),
                Map.of(), LocalDate.of(2026, 1, 2), false);
        assertThat(draft.materializable()).isFalse();

        assertThatThrownBy(() -> HriDetailContracts.validate("TIM_CORRECTION",
                Map.of("work_date", "not-a-date", "before_status", "present", "after_status", "late"),
                Map.of(), LocalDate.of(2026, 1, 2), true))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(422);
                    assertThat((List<?>) error.detail()).first().isEqualTo(Map.of(
                            "type", "date_from_datetime_parsing",
                            "loc", List.of("body", "content_json", "work_date"),
                            "msg", "Input should be a valid date in YYYY-MM-DD format",
                            "input", "not-a-date"));
                });
    }

    @Test
    void leaveAndWelfarePoliciesAreEnforcedAtSubmit() {
        assertThatThrownBy(() -> HriDetailContracts.validate("LEAVE_REQUEST", Map.of(
                        "leave_type_code", "ANNUAL", "start_date", "2026-01-01", "end_date", "2026-02-15",
                        "applied_minutes", 480, "reason", ""),
                Map.of("allow_past_date", "false", "max_span_days", "31", "require_reason", "true"),
                LocalDate.of(2026, 1, 2), true))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(422);
                    assertThat((List<?>) error.detail()).hasSize(3);
                });

        assertThatThrownBy(() -> HriDetailContracts.validate("WEL_BENEFIT_REQUEST",
                Map.of("benefit_type_code", "", "requested_amount", "not-an-int", "reason", ""),
                Map.of("benefit_type_required", "true", "require_reason", "true"),
                LocalDate.of(2026, 1, 2), true))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(422);
                    assertThat((List<?>) error.detail()).hasSize(3);
                });
    }

    @SuppressWarnings("unchecked")
    private void assertTemplateQueryDate(String instant, LocalDate expected) {
        EntityManager entityManager = mock(EntityManager.class);
        TypedQuery<HriFormTypeApprovalMap> mappings = mock(TypedQuery.class);
        TypedQuery<HriApprovalLineTemplate> fallback = mock(TypedQuery.class);
        HriApprovalLineTemplate template = new HriApprovalLineTemplate();
        template.id = 3;
        when(entityManager.createQuery(anyString(), eq(HriFormTypeApprovalMap.class))).thenReturn(mappings);
        when(mappings.setParameter(eq("id"), eq(9))).thenReturn(mappings);
        when(mappings.setParameter(eq("today"), eq(expected))).thenReturn(mappings);
        when(mappings.getResultList()).thenReturn(List.of());
        when(entityManager.createQuery(anyString(), eq(HriApprovalLineTemplate.class))).thenReturn(fallback);
        when(fallback.setMaxResults(1)).thenReturn(fallback);
        when(fallback.getResultStream()).thenReturn(List.of(template).stream());
        HriApplicationService service = new HriApplicationService(entityManager, new ObjectMapper(),
                mock(WelfareApplicationService.class), Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));

        assertThat(service.businessDate()).isEqualTo(expected);
        assertThat(service.approvalTemplate(9)).isSameAs(template);
        verify(mappings).setParameter("today", expected);
    }
}
