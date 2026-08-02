package com.vibehr.appraisal;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

class AppraisalServiceTest {

    @Test
    void typedPatchDistinguishesOmittedDescriptionFromExplicitNull() {
        AppraisalUpdateRequest request = new AppraisalUpdateRequest();

        assertThat(request.hasDescription()).isFalse();

        request.setDescription(null);

        assertThat(request.hasDescription()).isTrue();
        assertThat(request.description()).isNull();
    }

    @Test
    void finalResultPatchDistinguishesOmittedScoreFromExplicitNull() {
        FinalResultUpdateRequest request = new FinalResultUpdateRequest();

        assertThat(request.hasScoreGrade()).isFalse();

        request.setScoreGrade(null);

        assertThat(request.hasScoreGrade()).isTrue();
        assertThat(request.scoreGrade()).isNull();
    }

    @Test
    void createRejectsAnInvertedDateRangeBeforeAnyWrite() {
        @SuppressWarnings("unchecked") ObjectProvider<AppraisalTargetProjectionMapper> mapper = Mockito.mock(ObjectProvider.class);
        AppraisalService service = new AppraisalService(Mockito.mock(EntityManager.class), mapper);
        AppraisalCreateRequest request = new AppraisalCreateRequest("A1", "Annual", 2026, 1, null,
                java.time.LocalDate.of(2026, 12, 2), java.time.LocalDate.of(2026, 12, 1), true, 0, null);

        assertThatThrownBy(() -> service.createAppraisal(request))
                .isInstanceOf(ApiException.class)
                .hasMessage("start_date must be earlier than or equal to end_date.");
    }
}
