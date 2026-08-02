package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class HrUseCaseLockingTest {
    @Test
    void repeatedAppointmentConfirmationUsesAWriteLockAndReturnsLegacyConflict() {
        EntityManager entityManager = mock(EntityManager.class);
        HrAppointmentOrder order = new HrAppointmentOrder();
        order.status = "confirmed";
        when(entityManager.find(HrAppointmentOrder.class, 14, LockModeType.PESSIMISTIC_WRITE)).thenReturn(order);

        HrApplicationService service = new HrApplicationService(entityManager, new ObjectMapper(), mock(HrGridMapper.class));

        ApiException error = catchThrowableOfType(() -> service.confirmAppointment(14, 7), ApiException.class);
        assertThat(error.status().value()).isEqualTo(409);
        verify(entityManager).find(HrAppointmentOrder.class, 14, LockModeType.PESSIMISTIC_WRITE);
    }

    @Test
    void repeatedSeveranceConfirmationUsesAWriteLockAndReturnsLegacyConflict() {
        EntityManager entityManager = mock(EntityManager.class);
        HrSeveranceCalc calculation = new HrSeveranceCalc();
        calculation.status = "confirmed";
        when(entityManager.find(HrSeveranceCalc.class, 22, LockModeType.PESSIMISTIC_WRITE)).thenReturn(calculation);

        HrApplicationService service = new HrApplicationService(entityManager, new ObjectMapper(), mock(HrGridMapper.class));

        ApiException error = catchThrowableOfType(() -> service.confirmSeverance(22, 7), ApiException.class);
        assertThat(error.status().value()).isEqualTo(409);
        verify(entityManager).find(HrSeveranceCalc.class, 22, LockModeType.PESSIMISTIC_WRITE);
        assertThat(calculation.status).isEqualTo("confirmed");
    }
}
