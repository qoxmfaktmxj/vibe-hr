package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import com.vibehr.welfare.WelfareApplicationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class HriStateLockingTest {
    @Test
    void repeatedApprovalUsesAWriteLockAndReturnsTheLegacyConflict() {
        EntityManager entityManager = mock(EntityManager.class);
        HriRequestMaster request = new HriRequestMaster();
        request.status_code = "COMPLETED";
        when(entityManager.find(HriRequestMaster.class, 17, LockModeType.PESSIMISTIC_WRITE)).thenReturn(request);
        HriApplicationService service = new HriApplicationService(entityManager, new ObjectMapper(), mock(WelfareApplicationService.class));

        assertThatThrownBy(() -> service.approve(4, 17, null)).isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).status().value()).isEqualTo(409);
        verify(entityManager).find(HriRequestMaster.class, 17, LockModeType.PESSIMISTIC_WRITE);
    }
}
