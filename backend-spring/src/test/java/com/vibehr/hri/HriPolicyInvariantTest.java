package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import com.vibehr.welfare.WelfareApplicationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class HriPolicyInvariantTest {
    @Test
    void saveDraftHonorsTheFormTypeAllowDraftFlag() {
        EntityManager entityManager = mock(EntityManager.class);
        HriFormType form = new HriFormType();
        form.id = 8;
        form.is_active = true;
        form.allow_draft = false;
        when(entityManager.find(HriFormType.class, 8)).thenReturn(form);
        HriApplicationService service = service(entityManager);

        assertThatThrownBy(() -> service.saveDraft(4, new HriRequestDraftUpsertRequest(null, 8, "title", null)))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(409);
                    assertThat(error.detail()).isEqualTo("Draft is disabled for this form type.");
                });
    }

    @Test
    void stepTypeAndRequiredActionMustDescribeTheSameStateMachineAction() {
        HriApplicationService service = service(mock(EntityManager.class));

        assertThatThrownBy(() -> service.validateStepInputs(List.of(
                step(1, "APPROVAL", "USER_FIXED", null, 7, true, "RECEIVE"))))
                .isInstanceOfSatisfying(ApiException.class, error ->
                        assertThat(error.detail()).isEqualTo(
                                "required_action must be 'APPROVE' for step_type 'APPROVAL'."));
        assertThatThrownBy(() -> service.validateStepInputs(List.of(
                step(1, "RECEIVE", "USER_FIXED", null, 7, true, "APPROVE"))))
                .isInstanceOfSatisfying(ApiException.class, error ->
                        assertThat(error.detail()).isEqualTo(
                                "required_action must be 'RECEIVE' for step_type 'RECEIVE'."));
    }

    @Test
    void actorRulesRejectAmbiguousRoleAndFixedUserDefinitions() {
        HriApplicationService service = service(mock(EntityManager.class));

        assertThatThrownBy(() -> service.validateStepInputs(List.of(
                step(1, "APPROVAL", "ROLE_BASED", null, 7, true, "APPROVE"))))
                .isInstanceOfSatisfying(ApiException.class, error ->
                        assertThat(error.detail()).isEqualTo(
                                "ROLE_BASED steps require actor_role_code and prohibit actor_user_id."));
        assertThatThrownBy(() -> service.validateStepInputs(List.of(
                step(1, "APPROVAL", "USER_FIXED", "TEAM_LEADER", 7, true, "APPROVE"))))
                .isInstanceOfSatisfying(ApiException.class, error ->
                        assertThat(error.detail()).isEqualTo(
                                "USER_FIXED steps require actor_user_id and prohibit actor_role_code."));
    }

    @Test
    @SuppressWarnings("unchecked")
    void unknownRoleUsesTheExactKoreanConfigurationError() {
        EntityManager entityManager = mock(EntityManager.class);
        TypedQuery<HriApprovalActorRule> query = mock(TypedQuery.class);
        when(entityManager.createQuery(anyString(), eq(HriApprovalActorRule.class))).thenReturn(query);
        when(query.setParameter("code", "TEAM_LEADER")).thenReturn(query);
        when(query.setMaxResults(1)).thenReturn(query);
        when(query.getResultStream()).thenReturn(List.<HriApprovalActorRule>of().stream());
        HriApplicationService service = service(entityManager);

        assertThatThrownBy(() -> service.validateStepInputs(List.of(
                step(1, "APPROVAL", "ROLE_BASED", "TEAM_LEADER", null, false, "APPROVE"))))
                .isInstanceOfSatisfying(ApiException.class, error ->
                        assertThat(error.detail()).isEqualTo(
                                "결재 역할 'TEAM_LEADER'에 대한 설정이 없습니다. HriApprovalActorRule 테이블을 확인하세요."));
    }

    private HriApplicationService service(EntityManager entityManager) {
        return new HriApplicationService(entityManager, new ObjectMapper(), mock(WelfareApplicationService.class));
    }

    private HriApprovalTemplateStepBatchItem step(int order, String type, String actorType, String role,
            Integer userId, boolean allowDelegate, String action) {
        return new HriApprovalTemplateStepBatchItem(null, order, type, actorType, role, userId, allowDelegate, action);
    }
}
