package com.vibehr.appraisal;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

class AppraisalServiceTest {

    @Test
    void targetBatchExplicitScoreClearRemovesAnExistingScore() {
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<AppraisalTargetProjectionMapper> mapper = Mockito.mock(ObjectProvider.class);
        AppraisalService service = new AppraisalService(entityManager, mapper);
        PapAppraisalTarget existing = new PapAppraisalTarget();
        existing.score = 80.0;
        Mockito.when(entityManager.find(PapAppraisalTarget.class, 101, LockModeType.PESSIMISTIC_WRITE)).thenReturn(existing);

        TargetBatchResponse result = service.saveTargetBatch(new TargetBatchRequest(List.of(
                new TargetBatchRow(101, null, null, null, null, null, null, "updated", true))));

        assertThat(existing.score).isNull();
        assertThat(result).isEqualTo(new TargetBatchResponse(0, 1, 0));
    }

    @Test
    void targetBatchLegacyPartialUpdatePreservesAnOmittedScore() {
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<AppraisalTargetProjectionMapper> mapper = Mockito.mock(ObjectProvider.class);
        AppraisalService service = new AppraisalService(entityManager, mapper);
        PapAppraisalTarget existing = new PapAppraisalTarget();
        existing.score = 80.0;
        Mockito.when(entityManager.find(PapAppraisalTarget.class, 101, LockModeType.PESSIMISTIC_WRITE)).thenReturn(existing);

        TargetBatchRow item = new TargetBatchRow(101, null, null, null, null, "메모만 수정", null, "updated");
        service.saveTargetBatch(new TargetBatchRequest(List.of(item)));

        assertThat(item.clearScore()).isFalse();
        assertThat(existing.score).isEqualTo(80.0);
        assertThat(existing.evaluator_note).isEqualTo("메모만 수정");
    }

    @Test
    void targetBatchCreatesASelectedEmployee() {
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<AppraisalTargetProjectionMapper> mapper = Mockito.mock(ObjectProvider.class);
        AppraisalService service = new AppraisalService(entityManager, mapper);

        TargetBatchResponse result = service.saveTargetBatch(new TargetBatchRequest(List.of(
                new TargetBatchRow(null, 5, 27, 95.0, "A", "평가 완료", "evaluated", "added"))));

        ArgumentCaptor<PapAppraisalTarget> saved = ArgumentCaptor.forClass(PapAppraisalTarget.class);
        Mockito.verify(entityManager).persist(saved.capture());
        assertThat(result).isEqualTo(new TargetBatchResponse(1, 0, 0));
        assertThat(saved.getValue().appraisal_id).isEqualTo(5);
        assertThat(saved.getValue().employee_id).isEqualTo(27);
        assertThat(saved.getValue().score).isEqualTo(95.0);
        assertThat(saved.getValue().evaluated_at).isNotNull();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {0, -1})
    void targetBatchRejectsMissingEmployeeBeforeAnyCreateUpdateOrDelete(Integer employeeId) {
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<AppraisalTargetProjectionMapper> mapper = Mockito.mock(ObjectProvider.class);
        AppraisalService service = new AppraisalService(entityManager, mapper);
        TargetBatchRequest request = new TargetBatchRequest(List.of(
                new TargetBatchRow(1, 5, 10, null, null, null, null, "deleted"),
                new TargetBatchRow(2, 5, 11, 80.0, null, null, null, "updated"),
                new TargetBatchRow(null, 5, 27, null, null, null, null, "added"),
                new TargetBatchRow(null, 5, employeeId, null, null, null, null, "added")));

        assertThatThrownBy(() -> service.saveTargetBatch(request))
                .isInstanceOf(ApiException.class)
                .hasMessage("신규 평가 대상자의 사원을 선택해주세요.");

        Mockito.verifyNoInteractions(entityManager);
    }

    @Test
    void targetBatchRejectsMissingAppraisalForImplicitNewRowsBeforeAnyWrite() {
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<AppraisalTargetProjectionMapper> mapper = Mockito.mock(ObjectProvider.class);
        AppraisalService service = new AppraisalService(entityManager, mapper);
        TargetBatchRequest request = new TargetBatchRequest(List.of(
                new TargetBatchRow(null, 5, 27, null, null, null, null, "added"),
                new TargetBatchRow(null, null, 28, null, null, null, null, null)));

        assertThatThrownBy(() -> service.saveTargetBatch(request))
                .isInstanceOf(ApiException.class)
                .hasMessage("신규 평가 대상자의 평가를 선택해주세요.");

        Mockito.verifyNoInteractions(entityManager);
    }

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
