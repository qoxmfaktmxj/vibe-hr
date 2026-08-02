package com.vibehr.welfare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;

class WelfareStateLockingTest {
    @Test
    void repeatedApprovalUsesAWriteLockAndReturnsTheLegacyConflict() {
        EntityManager entityManager = mock(EntityManager.class);
        WelBenefitRequest request = new WelBenefitRequest();
        request.status_code = "approved";
        when(entityManager.find(WelBenefitRequest.class, 18, LockModeType.PESSIMISTIC_WRITE)).thenReturn(request);
        WelfareApplicationService service = new WelfareApplicationService(entityManager);

        assertThatThrownBy(() -> service.approve(18, new WelBenefitRequestApproveRequest(100, null)))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status().value()).isEqualTo(409);
                    assertThat(error.detail()).isEqualTo("승인 대기(submitted) 상태가 아닙니다. 현재 상태: approved");
                });
        verify(entityManager).find(WelBenefitRequest.class, 18, LockModeType.PESSIMISTIC_WRITE);
    }
}
