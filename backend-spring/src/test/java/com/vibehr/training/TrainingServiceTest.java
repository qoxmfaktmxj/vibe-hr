package com.vibehr.training;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.time.Year;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

class TrainingServiceTest {

    @Test
    void uniqueConflictRollsBackTheWholeGenerationAndRetriesAsAnIdempotentSkip() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> mapperProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked") ObjectProvider<PlatformTransactionManager> transactionProvider = mock(ObjectProvider.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        TransactionStatus transactionStatus = mock(TransactionStatus.class);
        @SuppressWarnings("unchecked") TypedQuery<TraRequiredRule> rules = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<Long> existing = mock(TypedQuery.class);
        Query lock = mock(Query.class);
        TraRequiredRule rule = new TraRequiredRule();
        rule.id = 3;
        rule.year = 2026;
        rule.course_id = 8;
        rule.start_month = 4;
        rule.end_month = 4;
        when(transactionProvider.getIfAvailable()).thenReturn(transactionManager);
        when(transactionManager.getTransaction(any(TransactionDefinition.class))).thenReturn(transactionStatus);
        when(entityManager.createQuery(anyString(), eq(TraRequiredRule.class))).thenReturn(rules);
        when(rules.setParameter("year", 2026)).thenReturn(rules);
        when(rules.getResultList()).thenReturn(List.of(rule));
        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(existing);
        when(existing.setParameter(anyString(), any())).thenReturn(existing);
        when(existing.getSingleResult()).thenReturn(0L, 1L);
        when(entityManager.createNativeQuery(anyString())).thenReturn(lock);
        when(lock.setParameter(eq("lockKey"), anyString())).thenReturn(lock);
        doAnswer(invocation -> { throw new DataIntegrityViolationException("duplicate", new SQLException("duplicate", "23505")); })
                .when(entityManager).persist(any(TraEvent.class));
        TrainingService service = new TrainingService(entityManager, mapperProvider, transactionProvider);

        assertThat(service.generateRequiredEvents(2026).processed()).isZero();

        verify(transactionManager).rollback(transactionStatus);
        verify(transactionManager).commit(transactionStatus);
    }

    @Test
    void requiredEventGenerationRechecksTheNaturalKeyAndReportsRepeatAsSkipped() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> provider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked") TypedQuery<TraRequiredRule> rules = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<Long> existing = mock(TypedQuery.class);
        Query lock = mock(Query.class);
        TraRequiredRule rule = new TraRequiredRule();
        rule.id = 3;
        rule.year = 2026;
        rule.course_id = 8;
        rule.start_month = 4;
        rule.end_month = 4;
        TraCourse course = new TraCourse();
        course.course_name = "Privacy";
        when(entityManager.createQuery(anyString(), eq(TraRequiredRule.class))).thenReturn(rules);
        when(rules.setParameter("year", 2026)).thenReturn(rules);
        when(rules.getResultList()).thenReturn(List.of(rule));
        when(entityManager.find(TraCourse.class, 8)).thenReturn(course);
        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(existing);
        when(existing.setParameter(eq("courseId"), any())).thenReturn(existing);
        when(existing.setParameter(eq("eventCode"), any())).thenReturn(existing);
        when(existing.getSingleResult()).thenReturn(0L, 1L);
        when(entityManager.createNativeQuery(anyString())).thenReturn(lock);
        when(lock.setParameter(eq("lockKey"), anyString())).thenReturn(lock);
        TrainingService service = new TrainingService(entityManager, provider);

        assertThat(service.generateRequiredEvents(2026).processed()).isEqualTo(1);
        assertThat(service.generateRequiredEvents(2026).processed()).isZero();
        verify(entityManager, times(1)).persist(any(TraEvent.class));
    }

    @Test
    void requiredTargetGenerationRechecksTheNaturalKeyAndReportsRepeatAsSkipped() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> provider = mock(ObjectProvider.class);
        TrainingApplicationProjectionMapper mapper = mock(TrainingApplicationProjectionMapper.class);
        @SuppressWarnings("unchecked") TypedQuery<TraRequiredRule> rules = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<Long> existing = mock(TypedQuery.class);
        Query lock = mock(Query.class);
        TraRequiredRule rule = new TraRequiredRule();
        rule.id = 5;
        rule.year = 2026;
        rule.rule_code = "LEGAL";
        rule.course_id = 8;
        rule.start_month = 2;
        when(provider.getIfAvailable()).thenReturn(mapper);
        when(mapper.findActiveEmployees()).thenReturn(List.of(Map.of("id", 300)));
        when(entityManager.createQuery(anyString(), eq(TraRequiredRule.class))).thenReturn(rules);
        when(rules.setParameter("year", 2026)).thenReturn(rules);
        when(rules.getResultList()).thenReturn(List.of(rule));
        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(existing);
        when(existing.setParameter(anyString(), any())).thenReturn(existing);
        when(existing.getSingleResult()).thenReturn(0L, 1L);
        when(entityManager.createNativeQuery(anyString())).thenReturn(lock);
        when(lock.setParameter(eq("lockKey"), anyString())).thenReturn(lock);
        TrainingService service = new TrainingService(entityManager, provider);

        assertThat(service.generateRequiredTargets(2026, null).processed()).isEqualTo(1);
        assertThat(service.generateRequiredTargets(2026, null).processed()).isZero();
        verify(entityManager, times(1)).persist(any(TraRequiredTarget.class));
    }

    @Test
    void cyberApplicationLocksAndRechecksAnUploadSoARepeatProcessesNothing() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> provider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked") TypedQuery<Integer> uploadIds = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<TraCourse> courses = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<TraEvent> events = mock(TypedQuery.class);
        Query lock = mock(Query.class);
        TraCyberUpload upload = new TraCyberUpload();
        upload.id = 600;
        upload.upload_ym = "202608";
        upload.course_name = "Cyber Security";
        TraCourse course = new TraCourse();
        course.id = 51;
        TraEvent event = new TraEvent();
        event.id = 52;
        when(entityManager.createQuery(anyString(), eq(Integer.class))).thenReturn(uploadIds);
        when(uploadIds.getResultList()).thenReturn(List.of(600));
        when(entityManager.find(TraCyberUpload.class, 600, LockModeType.PESSIMISTIC_WRITE)).thenReturn(upload);
        when(entityManager.createQuery(anyString(), eq(TraCourse.class))).thenReturn(courses);
        when(courses.setParameter("name", "Cyber Security")).thenReturn(courses);
        when(courses.setMaxResults(1)).thenReturn(courses);
        when(courses.getResultList()).thenReturn(List.of(course));
        when(entityManager.createQuery(anyString(), eq(TraEvent.class))).thenReturn(events);
        when(events.setParameter(anyString(), any())).thenReturn(events);
        when(events.setMaxResults(1)).thenReturn(events);
        when(events.getResultList()).thenReturn(List.of(event));
        when(entityManager.createNativeQuery(anyString())).thenReturn(lock);
        when(lock.setParameter(eq("lockKey"), anyString())).thenReturn(lock);
        TrainingService service = new TrainingService(entityManager, provider);

        assertThat(service.applyCyberResults(null).processed()).isEqualTo(1);
        assertThat(service.applyCyberResults(null).processed()).isZero();
        assertThat(upload.close_yn).isTrue();
    }

    @Test
    void applicationNumberUsesPythonTraYearAndNextTableIdAndReturnsEnrichedProjectionAboveIntegerCache() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> provider = mock(ObjectProvider.class);
        TrainingApplicationProjectionMapper mapper = mock(TrainingApplicationProjectionMapper.class);
        Query maxIdQuery = mock(Query.class);
        Query lockQuery = mock(Query.class);
        TraCourse course = new TraCourse();
        course.id = 9;
        course.in_out_type = "EXTERNAL";
        when(provider.getIfAvailable()).thenReturn(mapper);
        when(mapper.findEmployeeByUserId(17)).thenReturn(Map.of("id", 346, "employee_no", "E0346"));
        when(entityManager.find(TraCourse.class, 9)).thenReturn(course);
        when(entityManager.createQuery(anyString())).thenReturn(maxIdQuery);
        when(maxIdQuery.getSingleResult()).thenReturn(345L);
        when(entityManager.createNativeQuery(anyString())).thenReturn(lockQuery);
        when(lockQuery.setParameter(eq("lockKey"), anyString())).thenReturn(lockQuery);
        when(lockQuery.getSingleResult()).thenReturn(null);
        doAnswer(invocation -> {
            TraApplication application = invocation.getArgument(0);
            application.id = 346;
            return null;
        }).when(entityManager).persist(any(TraApplication.class));
        Instant now = Instant.parse("2026-08-01T00:00:00Z");
        when(mapper.findAll()).thenReturn(List.of(Map.ofEntries(
                Map.entry("id", 346L),
                Map.entry("application_no", "TRA-" + Year.now().getValue() + "-000346"),
                Map.entry("employee_id", 346),
                Map.entry("employee_no", "E0346"),
                Map.entry("employee_name", "Employee 346"),
                Map.entry("department_name", "Platform"),
                Map.entry("course_id", 9),
                Map.entry("course_name", "Secure Coding"),
                Map.entry("in_out_type", "EXTERNAL"),
                Map.entry("status", "submitted"),
                Map.entry("year_plan_yn", false),
                Map.entry("survey_yn", false),
                Map.entry("created_at", now),
                Map.entry("updated_at", now))));
        TrainingService service = new TrainingService(entityManager, provider);

        ApplicationItem item = service.createApplication(17,
                new ApplicationCreateRequest(9, null, null, false, null, null)).item();

        assertThat(item.applicationNo()).isEqualTo("TRA-" + Year.now().getValue() + "-000346");
        assertThat(item.employeeId()).isEqualTo(346);
        assertThat(item.employeeName()).isEqualTo("Employee 346");
        assertThat(item.departmentName()).isEqualTo("Platform");
    }

    @Test
    void approvingAnAlreadyApprovedApplicationIsTheSourceConflictAndDoesNotRepeatTheTransition() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> mapper = mock(ObjectProvider.class);
        TrainingService service = new TrainingService(entityManager, mapper);
        TraApplication application = new TraApplication();
        application.status = "approved";
        when(entityManager.find(TraApplication.class, 44, LockModeType.PESSIMISTIC_WRITE)).thenReturn(application);

        assertThatThrownBy(() -> service.approveApplication(44))
                .isInstanceOf(ApiException.class)
                .hasMessage("Only submitted applications can be approved.");
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void unknownGenericResourceRemainsTheSourceNotFoundContract() {
        EntityManager entityManager = mock(EntityManager.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> mapper = mock(ObjectProvider.class);
        TrainingService service = new TrainingService(entityManager, mapper);

        assertThatThrownBy(() -> service.listResource("not-a-tra-resource", null))
                .isInstanceOf(ApiException.class)
                .hasMessage("Unknown TRA resource: not-a-tra-resource");
    }

    @Test
    void blankOrganizationCodeUsesTheSourceGeneratedCodeRule() {
        EntityManager entityManager = mock(EntityManager.class);
        Query sequenceQuery = mock(Query.class);
        @SuppressWarnings("unchecked") ObjectProvider<TrainingApplicationProjectionMapper> mapper = mock(ObjectProvider.class);
        when(entityManager.createQuery(org.mockito.ArgumentMatchers.anyString())).thenReturn(sequenceQuery);
        when(sequenceQuery.getSingleResult()).thenReturn(0L);
        TrainingService service = new TrainingService(entityManager, mapper);

        service.saveResourceBatch("organizations", new ResourceBatchRequest(List.of(Map.of(
                "_status", "added", "code", "", "name", "Training Center"))));

        ArgumentCaptor<Object> persisted = ArgumentCaptor.forClass(Object.class);
        verify(entityManager).persist(persisted.capture());
        org.assertj.core.api.Assertions.assertThat(((TraOrganization) persisted.getValue()).code).isEqualTo("TRORG00001");
    }
}
