package com.vibehr.appraisal;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
public class AppraisalService {

    private final EntityManager entityManager;
    private final ObjectProvider<AppraisalTargetProjectionMapper> targetProjectionMapper;

    public AppraisalService(EntityManager entityManager, ObjectProvider<AppraisalTargetProjectionMapper> targetProjectionMapper) {
        this.entityManager = entityManager;
        this.targetProjectionMapper = targetProjectionMapper;
    }

    @Transactional
    public AppraisalListResponse listAppraisals(String code, String name, Integer year, Boolean activeOnly, int page, int limit, boolean allRows) {
        StringBuilder query = new StringBuilder("select a from PapAppraisalMaster a where 1 = 1");
        if (year != null) query.append(" and a.appraisal_year = :year");
        if (code != null && !code.isBlank()) query.append(" and a.appraisal_code like :code");
        if (name != null && !name.isBlank()) query.append(" and a.appraisal_name like :name");
        if (activeOnly != null) query.append(" and a.is_active = :activeOnly");
        query.append(" order by a.appraisal_year desc, a.sort_order, a.id");
        TypedQuery<PapAppraisalMaster> typedQuery = entityManager.createQuery(query.toString(), PapAppraisalMaster.class);
        if (year != null) typedQuery.setParameter("year", year);
        if (code != null && !code.isBlank()) typedQuery.setParameter("code", "%" + code.strip().toUpperCase(Locale.ROOT) + "%");
        if (name != null && !name.isBlank()) typedQuery.setParameter("name", "%" + name.strip() + "%");
        if (activeOnly != null) typedQuery.setParameter("activeOnly", activeOnly);
        List<PapAppraisalMaster> rows = typedQuery.getResultList();
        int total = rows.size();
        if (!allRows) {
            int from = Math.min((page - 1) * limit, total);
            rows = rows.subList(from, Math.min(from + limit, total));
        }
        Map<Integer, PapFinalResult> finals = finalResults(rows.stream().map(row -> row.final_result_id).toList());
        return new AppraisalListResponse(rows.stream().map(row -> appraisalItem(row, finals.get(row.final_result_id))).toList(), total, page, limit);
    }

    @Transactional
    public AppraisalDetailResponse createAppraisal(AppraisalCreateRequest request) {
        if (request.finalResultId() == null) throw ApiException.badRequest("final_result_id is required.");
        validateDateRange(request.startDate(), request.endDate());
        String code = request.appraisalCode().strip().toUpperCase(Locale.ROOT);
        assertAppraisalCodeAvailable(request.appraisalYear(), code, null);
        PapFinalResult finalResult = finalResult(request.finalResultId());
        PapAppraisalMaster row = new PapAppraisalMaster();
        row.appraisal_code = code;
        row.appraisal_name = request.appraisalName().strip();
        row.appraisal_year = request.appraisalYear();
        row.final_result_id = finalResult.id;
        row.appraisal_type = request.appraisalType();
        row.start_date = request.startDate();
        row.end_date = request.endDate();
        row.is_active = request.effectiveIsActive();
        row.sort_order = request.sortOrder();
        row.description = request.description();
        row.created_at = Instant.now();
        row.updated_at = row.created_at;
        entityManager.persist(row);
        entityManager.flush();
        return new AppraisalDetailResponse(appraisalItem(row, finalResult));
    }

    @Transactional
    public AppraisalDetailResponse updateAppraisal(int id, AppraisalUpdateRequest request) {
        PapAppraisalMaster row = appraisal(id, LockModeType.PESSIMISTIC_WRITE);
        int nextYear = request.appraisalYear() == null ? row.appraisal_year : request.appraisalYear();
        String nextCode = request.appraisalCode() == null
                ? row.appraisal_code : request.appraisalCode().strip().toUpperCase(Locale.ROOT);
        assertAppraisalCodeAvailable(nextYear, nextCode, id);
        LocalDate start = request.hasStartDate() ? request.startDate() : row.start_date;
        LocalDate end = request.hasEndDate() ? request.endDate() : row.end_date;
        validateDateRange(start, end);
        row.appraisal_year = nextYear;
        row.appraisal_code = nextCode;
        if (request.hasFinalResultId()) {
            if (request.finalResultId() == null) throw ApiException.badRequest("final_result_id is required.");
            row.final_result_id = finalResult(request.finalResultId()).id;
        }
        if (request.appraisalName() != null) row.appraisal_name = request.appraisalName().strip();
        if (request.hasAppraisalType()) row.appraisal_type = request.appraisalType();
        if (request.hasStartDate()) row.start_date = start;
        if (request.hasEndDate()) row.end_date = end;
        if (request.isActive() != null) row.is_active = request.isActive();
        if (request.sortOrder() != null) row.sort_order = request.sortOrder();
        if (request.hasDescription()) row.description = request.description();
        row.updated_at = Instant.now();
        return new AppraisalDetailResponse(appraisalItem(row, finalResult(row.final_result_id)));
    }

    @Transactional
    public void deleteAppraisal(int id) {
        entityManager.remove(appraisal(id, LockModeType.PESSIMISTIC_WRITE));
    }

    @Transactional
    public FinalResultListResponse listFinalResults(String code, String name, Boolean activeOnly, int page, int limit, boolean allRows) {
        StringBuilder query = new StringBuilder("select r from PapFinalResult r where 1 = 1");
        if (code != null && !code.isBlank()) query.append(" and r.result_code like :code");
        if (name != null && !name.isBlank()) query.append(" and r.result_name like :name");
        if (activeOnly != null) query.append(" and r.is_active = :activeOnly");
        query.append(" order by r.sort_order, r.id");
        TypedQuery<PapFinalResult> typedQuery = entityManager.createQuery(query.toString(), PapFinalResult.class);
        if (code != null && !code.isBlank()) typedQuery.setParameter("code", "%" + code.strip().toUpperCase(Locale.ROOT) + "%");
        if (name != null && !name.isBlank()) typedQuery.setParameter("name", "%" + name.strip() + "%");
        if (activeOnly != null) typedQuery.setParameter("activeOnly", activeOnly);
        List<PapFinalResult> rows = typedQuery.getResultList();
        int total = rows.size();
        if (!allRows) {
            int from = Math.min((page - 1) * limit, total);
            rows = rows.subList(from, Math.min(from + limit, total));
        }
        return new FinalResultListResponse(rows.stream().map(this::finalResultItem).toList(), total, page, limit);
    }

    @Transactional
    public FinalResultDetailResponse createFinalResult(FinalResultCreateRequest request) {
        String code = request.resultCode().strip().toUpperCase(Locale.ROOT);
        assertFinalResultCodeAvailable(code, null);
        PapFinalResult row = new PapFinalResult();
        row.result_code = code;
        row.result_name = request.resultName().strip();
        row.score_grade = request.scoreGrade();
        row.is_active = request.effectiveIsActive();
        row.sort_order = request.sortOrder();
        row.description = request.description();
        row.created_at = Instant.now();
        row.updated_at = row.created_at;
        entityManager.persist(row);
        entityManager.flush();
        return new FinalResultDetailResponse(finalResultItem(row));
    }

    @Transactional
    public FinalResultDetailResponse updateFinalResult(int id, FinalResultUpdateRequest request) {
        PapFinalResult row = finalResult(id, LockModeType.PESSIMISTIC_WRITE);
        String nextCode = request.resultCode() == null
                ? row.result_code : request.resultCode().strip().toUpperCase(Locale.ROOT);
        assertFinalResultCodeAvailable(nextCode, id);
        row.result_code = nextCode;
        if (request.resultName() != null) row.result_name = request.resultName().strip();
        if (request.hasScoreGrade()) row.score_grade = request.scoreGrade();
        if (request.isActive() != null) row.is_active = request.isActive();
        if (request.sortOrder() != null) row.sort_order = request.sortOrder();
        if (request.hasDescription()) row.description = request.description();
        row.updated_at = Instant.now();
        return new FinalResultDetailResponse(finalResultItem(row));
    }

    @Transactional
    public void deleteFinalResult(int id) {
        entityManager.remove(finalResult(id, LockModeType.PESSIMISTIC_WRITE));
    }

    @Transactional
    public TargetListResponse listTargets(Integer appraisalId) {
        AppraisalTargetProjectionMapper mapper = targetProjectionMapper.getIfAvailable();
        if (mapper == null) throw new IllegalStateException("Appraisal target projection mapper is unavailable.");
        List<Map<String, Object>> rows = appraisalId == null ? mapper.findAll() : mapper.findByAppraisalId(appraisalId);
        return new TargetListResponse(rows.stream().map(this::targetItem).toList(), rows.size());
    }

    @Transactional
    public TargetBatchResponse saveTargetBatch(TargetBatchRequest request) {
        int created = 0;
        int updated = 0;
        int deleted = 0;
        Instant now = Instant.now();
        for (TargetBatchRow item : request.items()) {
            String rowStatus = item.statusOrClean();
            if ("deleted".equals(rowStatus)) {
                if (item.id() != null) {
                    PapAppraisalTarget row = entityManager.find(PapAppraisalTarget.class, item.id(), LockModeType.PESSIMISTIC_WRITE);
                    if (row != null) { entityManager.remove(row); deleted++; }
                }
                continue;
            }
            if ("added".equals(rowStatus) || item.id() == null) {
                if (item.appraisalId() == null || item.employeeId() == null) continue;
                PapAppraisalTarget row = new PapAppraisalTarget();
                row.appraisal_id = item.appraisalId(); row.employee_id = item.employeeId(); row.score = item.score();
                row.grade_code = item.gradeCode(); row.evaluator_note = item.evaluatorNote(); row.status = item.status() == null ? "pending" : item.status();
                row.evaluated_at = ("evaluated".equals(row.status) || "finalized".equals(row.status)) ? now : null;
                row.created_at = now; row.updated_at = now;
                entityManager.persist(row); created++;
            } else if ("updated".equals(rowStatus) || "clean".equals(rowStatus)) {
                PapAppraisalTarget row = entityManager.find(PapAppraisalTarget.class, item.id(), LockModeType.PESSIMISTIC_WRITE);
                if (row == null) continue;
                if (item.score() != null) row.score = item.score();
                if (item.gradeCode() != null) row.grade_code = item.gradeCode();
                if (item.evaluatorNote() != null) row.evaluator_note = item.evaluatorNote();
                if (item.status() != null) {
                    if (!item.status().equals(row.status) && ("evaluated".equals(item.status()) || "finalized".equals(item.status()))) row.evaluated_at = now;
                    row.status = item.status();
                }
                row.updated_at = now; updated++;
            }
        }
        return new TargetBatchResponse(created, updated, deleted);
    }

    private PapAppraisalMaster appraisal(int id, LockModeType lockMode) {
        PapAppraisalMaster row = entityManager.find(PapAppraisalMaster.class, id, lockMode);
        if (row == null) throw ApiException.notFound("Appraisal master not found.");
        return row;
    }

    private PapFinalResult finalResult(int id) { return finalResult(id, LockModeType.NONE); }
    private PapFinalResult finalResult(int id, LockModeType lockMode) {
        PapFinalResult row = entityManager.find(PapFinalResult.class, id, lockMode);
        if (row == null) throw ApiException.notFound("Final result not found.");
        return row;
    }

    private void assertAppraisalCodeAvailable(int year, String code, Integer excludedId) {
        String query = "select count(a) from PapAppraisalMaster a where a.appraisal_year = :year and a.appraisal_code = :code" + (excludedId == null ? "" : " and a.id <> :id");
        TypedQuery<Long> typedQuery = entityManager.createQuery(query, Long.class).setParameter("year", year).setParameter("code", code);
        if (excludedId != null) typedQuery.setParameter("id", excludedId);
        if (typedQuery.getSingleResult() > 0) throw ApiException.conflict("Appraisal code already exists in the same year.");
    }

    private void assertFinalResultCodeAvailable(String code, Integer excludedId) {
        String query = "select count(r) from PapFinalResult r where r.result_code = :code" + (excludedId == null ? "" : " and r.id <> :id");
        TypedQuery<Long> typedQuery = entityManager.createQuery(query, Long.class).setParameter("code", code);
        if (excludedId != null) typedQuery.setParameter("id", excludedId);
        if (typedQuery.getSingleResult() > 0) throw ApiException.conflict("Final result code already exists.");
    }

    private Map<Integer, PapFinalResult> finalResults(List<Integer> ids) {
        Map<Integer, PapFinalResult> result = new HashMap<>();
        for (Integer id : ids) if (id != null) result.put(id, entityManager.find(PapFinalResult.class, id));
        return result;
    }

    private AppraisalItem appraisalItem(PapAppraisalMaster row, PapFinalResult finalResult) {
        return new AppraisalItem(row.id, row.appraisal_code, row.appraisal_name, row.appraisal_year, row.final_result_id,
                finalResult == null ? null : finalResult.result_code, finalResult == null ? null : finalResult.result_name,
                row.appraisal_type, row.start_date, row.end_date, row.is_active, row.sort_order, row.description, row.created_at, row.updated_at);
    }

    private FinalResultItem finalResultItem(PapFinalResult row) {
        return new FinalResultItem(row.id, row.result_code, row.result_name, row.score_grade, row.is_active, row.sort_order, row.description, row.created_at, row.updated_at);
    }

    private TargetItem targetItem(Map<String, Object> row) {
        return new TargetItem(integer(row.get("id")), integer(row.get("appraisal_id")), string(row.get("appraisal_name")),
                integer(row.get("employee_id")), string(row.get("employee_no")), string(row.get("employee_name")),
                string(row.get("department_name")), decimal(row.get("score")), string(row.get("grade_code")),
                string(row.get("evaluator_note")), string(row.get("status")), instant(row.get("evaluated_at")),
                instant(row.get("created_at")), instant(row.get("updated_at")));
    }

    private void validateDateRange(LocalDate start, LocalDate end) {
        if (start != null && end != null && start.isAfter(end)) throw ApiException.badRequest("start_date must be earlier than or equal to end_date.");
    }

    private int integer(Object value) { return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value)); }
    private Double decimal(Object value) { return value == null ? null : value instanceof Number number ? number.doubleValue() : Double.valueOf(String.valueOf(value)); }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof LocalDateTime dateTime) return dateTime.toInstant(ZoneOffset.UTC);
        return Instant.parse(String.valueOf(value));
    }
}
