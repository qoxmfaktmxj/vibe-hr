package com.vibehr.welfare;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class WelfareApplicationService {
    private final EntityManager entityManager;

    public WelfareApplicationService(EntityManager entityManager) { this.entityManager = entityManager; }

    @Transactional
    public WelBenefitTypeListResponse benefitTypes(int page, int limit) {
        List<WelBenefitTypeItem> items = entityManager.createQuery("select b from WelBenefitType b order by b.sort_order, b.id", WelBenefitType.class)
                .getResultList().stream().map(this::typeItem).toList();
        return new WelBenefitTypeListResponse(page(items, page, limit), items.size(), page, limit);
    }

    @Transactional
    public WelBenefitTypeBatchResponse saveBenefitTypes(WelBenefitTypeBatchRequest request) {
        int created = 0, updated = 0, deleted = 0;
        for (WelBenefitTypeRowInput item : items(request.items())) {
            String rowStatus = value(item.rowStatus(), "clean").toLowerCase(Locale.ROOT);
            if ("added".equals(rowStatus)) {
                WelBenefitType row = new WelBenefitType();
                assign(row, item);
                row.created_at = now(); row.updated_at = row.created_at;
                entityManager.persist(row);
                created++;
                continue;
            }
            if (item.id() == null) continue;
            WelBenefitType row = entityManager.find(WelBenefitType.class, item.id(), LockModeType.PESSIMISTIC_WRITE);
            if (row == null) continue;
            if ("deleted".equals(rowStatus)) {
                entityManager.remove(row);
                deleted++;
            } else if ("updated".equals(rowStatus)) {
                assign(row, item);
                row.updated_at = now();
                updated++;
            }
        }
        return new WelBenefitTypeBatchResponse(created, updated, deleted);
    }

    @Transactional
    public WelBenefitRequestListResponse requests(int page, int limit) {
        List<WelBenefitRequestItem> items = requestRows(null).stream().map(this::requestItem).toList();
        return new WelBenefitRequestListResponse(page(items, page, limit), items.size(), page, limit);
    }

    @Transactional
    public WelBenefitRequestActionResponse createRequest(int userId, WelBenefitRequestCreateRequest request) {
        WelBenefitType benefitType = entityManager.createQuery(
                "select b from WelBenefitType b where b.code = :code and b.is_active = true", WelBenefitType.class)
                .setParameter("code", request.benefitTypeCode()).setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> ApiException.notFound("복리후생 유형을 찾을 수 없습니다."));
        EmployeeReference employee = employeeForUser(userId);
        if (employee == null) throw ApiException.badRequest("사원 프로필을 찾을 수 없습니다.");
        WelBenefitRequest row = new WelBenefitRequest();
        Instant now = now();
        row.request_no = nextRequestNo(now);
        row.benefit_type_code = benefitType.code;
        row.benefit_type_name = benefitType.name;
        row.employee_id = employee.id();
        row.employee_no = employee.employeeNo();
        row.employee_name = employee.employeeName();
        row.department_name = employee.departmentName();
        row.status_code = "submitted";
        row.requested_amount = request.requestedAmount();
        row.description = request.description();
        row.requested_at = now;
        row.created_at = now;
        row.updated_at = now;
        entityManager.persist(row);
        entityManager.flush();
        return new WelBenefitRequestActionResponse(requestItem(row));
    }

    @Transactional
    public WelBenefitRequestListResponse myRequests(int userId) {
        EmployeeReference employee = employeeForUser(userId);
        List<WelBenefitRequestItem> items = employee == null ? List.of() : requestRows(employee.id()).stream().map(this::requestItem).toList();
        return new WelBenefitRequestListResponse(items, items.size(), 1, items.isEmpty() ? 1 : items.size());
    }

    @Transactional
    public WelBenefitRequestActionResponse approve(int requestId, WelBenefitRequestApproveRequest request) {
        WelBenefitRequest row = requestForUpdate(requestId);
        if (!"submitted".equals(row.status_code)) {
            throw ApiException.conflict("승인 대기(submitted) 상태가 아닙니다. 현재 상태: " + row.status_code);
        }
        row.status_code = "approved";
        row.approved_amount = request.approvedAmount();
        row.approved_at = now();
        if (notBlank(request.note())) row.description = value(row.description, "") + "\n[승인메모] " + request.note();
        row.updated_at = now();
        return new WelBenefitRequestActionResponse(requestItem(row));
    }

    @Transactional
    public WelBenefitRequestActionResponse reject(int requestId, WelBenefitRequestRejectRequest request) {
        WelBenefitRequest row = requestForUpdate(requestId);
        if (!"submitted".equals(row.status_code) && !"draft".equals(row.status_code)) {
            throw ApiException.conflict("반려할 수 없는 상태입니다. 현재 상태: " + row.status_code);
        }
        row.status_code = "rejected";
        if (notBlank(request.reason())) row.description = value(row.description, "") + "\n[반려사유] " + request.reason();
        row.updated_at = now();
        return new WelBenefitRequestActionResponse(requestItem(row));
    }

    @Transactional
    public WelBenefitRequestActionResponse withdraw(int requestId, int userId) {
        WelBenefitRequest row = requestForUpdate(requestId);
        EmployeeReference employee = employeeForUser(userId);
        if (employee == null || !Integer.valueOf(employee.id()).equals(row.employee_id)) {
            throw ApiException.forbidden("본인의 신청 건만 회수할 수 있습니다.");
        }
        if (!"submitted".equals(row.status_code) && !"draft".equals(row.status_code)) {
            throw ApiException.conflict("회수할 수 없는 상태입니다. 현재 상태: " + row.status_code);
        }
        row.status_code = "withdrawn";
        row.updated_at = now();
        return new WelBenefitRequestActionResponse(requestItem(row));
    }

    /** HRI writes the same natural key repeatedly as its workflow advances. */
    @Transactional
    public void syncFromHri(HriWelfareProjection projection) {
        lockNaturalKey("wel:hri:" + projection.requestNo());
        WelBenefitRequest row = entityManager.createQuery(
                "select r from WelBenefitRequest r where r.request_no = :requestNo", WelBenefitRequest.class)
                .setParameter("requestNo", projection.requestNo()).setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .setMaxResults(1).getResultStream().findFirst().orElse(null);
        String benefitTypeName = notBlank(projection.benefitTypeName()) ? projection.benefitTypeName() : benefitTypeName(projection.benefitTypeCode());
        String mappedStatus = hriStatus(projection.statusCode());
        Integer approvedAmount = "approved".equals(mappedStatus) || "payroll_reflected".equals(mappedStatus)
                ? projection.requestedAmount() : null;
        Instant approvedAt = approvedAmount == null ? null : (projection.completedAt() == null ? projection.updatedAt() : projection.completedAt());
        String payrollRunLabel = "payroll_reflected".equals(mappedStatus)
                ? YearMonth.from((projection.completedAt() == null ? projection.updatedAt() : projection.completedAt()).atZone(ZoneOffset.UTC)) + " 정기급여" : null;
        boolean isNew = row == null;
        if (isNew) {
            row = new WelBenefitRequest();
            row.request_no = projection.requestNo();
            row.created_at = projection.createdAt();
        }
        row.benefit_type_code = value(projection.benefitTypeCode(), "");
        row.benefit_type_name = value(benefitTypeName, value(projection.benefitTypeCode(), "WEL"));
        row.employee_id = projection.employeeId();
        row.employee_no = value(projection.employeeNo(), "");
        row.employee_name = value(projection.employeeName(), "");
        row.department_name = value(projection.departmentName(), "-");
        row.status_code = mappedStatus;
        row.requested_amount = projection.requestedAmount();
        row.approved_amount = approvedAmount;
        row.payroll_run_label = payrollRunLabel;
        row.description = projection.description();
        row.requested_at = projection.submittedAt() == null ? projection.createdAt() : projection.submittedAt();
        row.approved_at = approvedAt;
        row.updated_at = projection.updatedAt();
        if (isNew) entityManager.persist(row);
    }

    private List<WelBenefitRequest> requestRows(Integer employeeId) {
        String query = "select r from WelBenefitRequest r" + (employeeId == null ? "" : " where r.employee_id = :employeeId")
                + " order by r.requested_at desc, r.id desc";
        var typed = entityManager.createQuery(query, WelBenefitRequest.class);
        if (employeeId != null) typed.setParameter("employeeId", employeeId);
        return typed.getResultList();
    }

    private WelBenefitRequest requestForUpdate(int id) {
        WelBenefitRequest row = entityManager.find(WelBenefitRequest.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (row == null) throw ApiException.notFound("신청 건을 찾을 수 없습니다.");
        return row;
    }

    private String nextRequestNo(Instant now) {
        String month = YearMonth.from(now.atZone(ZoneOffset.UTC)).toString().replace("-", "");
        String prefix = "WEL-" + month + "-";
        lockNaturalKey("wel:request-number:" + month);
        List<String> values = entityManager.createQuery("select r.request_no from WelBenefitRequest r where r.request_no like :prefix order by r.id desc", String.class)
                .setParameter("prefix", prefix + "%").setMaxResults(1).getResultList();
        int next = values.isEmpty() ? 1 : sequence(values.getFirst()) + 1;
        return prefix + "%05d".formatted(next);
    }

    private EmployeeReference employeeForUser(int userId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select e.id, e.employee_no, coalesce(u.display_name, u.login_id), coalesce(d.name, '')
                from hr_employees e join auth_users u on u.id = e.user_id
                left join org_departments d on d.id = e.department_id
                where e.user_id = :userId limit 1
                """).setParameter("userId", userId).getResultList();
        if (rows.isEmpty()) return null;
        Object[] row = rows.getFirst();
        return new EmployeeReference(((Number) row[0]).intValue(), value(row[1], ""), value(row[2], ""), value(row[3], ""));
    }

    private String benefitTypeName(String code) {
        if (!notBlank(code)) return "";
        return entityManager.createQuery("select b.name from WelBenefitType b where b.code = :code", String.class)
                .setParameter("code", code).setMaxResults(1).getResultStream().findFirst().orElse(code);
    }

    private void assign(WelBenefitType row, WelBenefitTypeRowInput item) {
        row.code = item.code(); row.name = item.name(); row.module_path = item.modulePath();
        row.is_deduction = bool(item.isDeduction(), false); row.pay_item_code = item.payItemCode();
        row.is_active = bool(item.isActive(), true); row.sort_order = integer(item.sortOrder(), 0);
    }

    private WelBenefitTypeItem typeItem(WelBenefitType row) {
        return new WelBenefitTypeItem(row.id, row.code, row.name, row.module_path, row.is_deduction, row.pay_item_code,
                row.is_active, row.sort_order, row.created_at, row.updated_at);
    }

    private WelBenefitRequestItem requestItem(WelBenefitRequest row) {
        return new WelBenefitRequestItem(row.id, row.request_no, row.benefit_type_code, row.benefit_type_name,
                row.employee_no, row.employee_name, row.department_name, row.status_code, row.requested_amount,
                row.approved_amount, row.payroll_run_label, row.description, row.requested_at, row.approved_at,
                row.created_at, row.updated_at);
    }

    private String hriStatus(String status) {
        return switch (status) {
            case "DRAFT" -> "draft";
            case "APPROVAL_IN_PROGRESS" -> "submitted";
            case "APPROVAL_REJECTED", "RECEIVE_REJECTED" -> "rejected";
            case "RECEIVE_IN_PROGRESS" -> "approved";
            case "COMPLETED" -> "payroll_reflected";
            case "WITHDRAWN" -> "withdrawn";
            default -> "draft";
        };
    }

    private void lockNaturalKey(String key) {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(cast(:lockKey as text), 0))")
                .setParameter("lockKey", key).getSingleResult();
    }

    private <T> List<T> page(List<T> values, int page, int limit) {
        int start = Math.min((page - 1) * limit, values.size());
        return new ArrayList<>(values.subList(start, Math.min(start + limit, values.size())));
    }

    private static <T> List<T> items(List<T> values) { return values == null ? List.of() : values; }

    private static int sequence(String value) {
        try { return Integer.parseInt(value.substring(value.lastIndexOf('-') + 1)); }
        catch (RuntimeException exception) { return 0; }
    }
    private static Instant now() { return Instant.now(); }
    private static boolean bool(Boolean value, boolean fallback) { return value == null ? fallback : value; }
    private static int integer(Integer value, int fallback) { return value == null ? fallback : value; }
    private static String value(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private static boolean notBlank(String value) { return value != null && !value.isBlank(); }
    private record EmployeeReference(int id, String employeeNo, String employeeName, String departmentName) { }
}
