package com.vibehr.training;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import java.lang.reflect.Field;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class TrainingService {

    private record ResourceDefinition(Class<?> type, List<String> fields, List<String> order, boolean supportsYear) { }
    private record EmployeeReference(Integer id, String employeeNo) { }

    private static final Map<String, ResourceDefinition> RESOURCES = Map.of(
            "organizations", new ResourceDefinition(TraOrganization.class, List.of("code", "name", "business_no", "contact_name", "contact_phone", "contact_email", "is_active"), List.of("code", "id"), false),
            "courses", new ResourceDefinition(TraCourse.class, List.of("course_code", "course_name", "in_out_type", "branch_code", "sub_branch_code", "method_code", "status_code", "organization_id", "mandatory_yn", "job_code", "edu_level", "memo", "note", "manager_employee_no", "manager_phone", "is_active"), List.of("course_code", "id"), false),
            "events", new ResourceDefinition(TraEvent.class, List.of("course_id", "event_code", "event_name", "status_code", "organization_id", "place", "start_date", "end_date", "start_time", "end_time", "edu_day", "edu_hour", "appl_start_date", "appl_end_date", "currency_code", "per_expense_amount", "real_expense_amount", "labor_apply_yn", "labor_amount", "labor_return_yn", "labor_return_date", "result_app_skip_yn", "max_person", "note", "manager_employee_no", "manager_phone", "is_active"), List.of("start_date", "id"), false),
            "required-standards", new ResourceDefinition(TraRequiredRule.class, List.of("year", "rule_code", "order_seq", "job_grade_code", "job_grade_year", "job_code", "search_seq", "entry_month", "start_month", "end_month", "course_id", "edu_level", "note", "is_active"), List.of("year", "rule_code", "order_seq", "id"), true),
            "required-targets", new ResourceDefinition(TraRequiredTarget.class, List.of("year", "employee_id", "rule_code", "course_id", "edu_month", "event_id", "application_id", "standard_rule_id", "edu_level", "completion_status", "completed_count", "note", "error_note"), List.of("year", "edu_month", "employee_id", "id"), true),
            "applications", new ResourceDefinition(TraApplication.class, List.of("application_no", "employee_id", "course_id", "event_id", "in_out_type", "job_code", "year_plan_yn", "edu_memo", "note", "survey_yn", "approval_request_id", "status"), List.of("id"), false),
            "elearning-windows", new ResourceDefinition(TraElearningWindow.class, List.of("year_month", "start_date", "end_date", "app_count", "note"), List.of("year_month", "id"), false),
            "histories", new ResourceDefinition(TraHistory.class, List.of("employee_id", "course_id", "event_id", "application_id", "confirm_type", "unconfirm_reason", "app_point", "job_code", "note", "completed_at"), List.of("completed_at", "id"), false),
            "cyber-uploads", new ResourceDefinition(TraCyberUpload.class, List.of("upload_ym", "employee_no", "employee_id", "course_name", "start_date", "end_date", "reward_hour", "edu_hour", "labor_apply_yn", "labor_amount", "per_expense_amount", "real_expense_amount", "confirm_type", "unconfirm_reason", "edu_branch_code", "edu_sub_branch_code", "in_out_type", "method_code", "organization_name", "business_no", "mandatory_yn", "job_code", "edu_level", "event_name", "place", "close_yn", "applied_course_id", "applied_event_id", "applied_history_id", "note"), List.of("upload_ym", "id"), false));

    private final EntityManager entityManager;
    private final ObjectProvider<TrainingApplicationProjectionMapper> projectionMapper;
    private final PlatformTransactionManager transactionManager;

    @Autowired
    public TrainingService(EntityManager entityManager, ObjectProvider<TrainingApplicationProjectionMapper> projectionMapper,
            ObjectProvider<PlatformTransactionManager> transactionManager) {
        this.entityManager = entityManager;
        this.projectionMapper = projectionMapper;
        this.transactionManager = transactionManager.getIfAvailable();
    }

    TrainingService(EntityManager entityManager, ObjectProvider<TrainingApplicationProjectionMapper> projectionMapper) {
        this.entityManager = entityManager;
        this.projectionMapper = projectionMapper;
        this.transactionManager = null;
    }

    public GenerationResponse generateRequiredEvents(int year) {
        int created = inApplicationTransaction(() -> generateRequiredEventsInTransaction(year));
        return new GenerationResponse(created, "Required events generated.");
    }

    private int generateRequiredEventsInTransaction(int year) {
        List<TraRequiredRule> rules = entityManager.createQuery("select r from TraRequiredRule r where r.year = :year and r.is_active = true order by r.id", TraRequiredRule.class)
                .setParameter("year", year).getResultList();
        int created = 0;
        for (TraRequiredRule rule : rules) {
            int startMonth = Math.min(Math.max(rule.start_month, 1), 12);
            int endMonth = Math.min(Math.max(rule.end_month, startMonth), 12);
            TraCourse course = entityManager.find(TraCourse.class, rule.course_id);
            for (int month = startMonth; month <= endMonth; month++) {
                String eventCode = "%04d%02d".formatted(year, month);
                lockNaturalKey("tra:event:" + rule.course_id + ":" + eventCode);
                Long existing = entityManager.createQuery("select count(e) from TraEvent e where e.course_id = :courseId and e.event_code = :eventCode", Long.class)
                        .setParameter("courseId", rule.course_id).setParameter("eventCode", eventCode).getSingleResult();
                if (existing > 0) continue;
                LocalDate start = LocalDate.of(year, month, 1);
                TraEvent event = new TraEvent();
                initialize(event);
                event.course_id = rule.course_id;
                event.event_code = eventCode;
                event.event_name = (course == null ? "Course-" + rule.course_id : course.course_name) + "(%04d-%02d)".formatted(year, month);
                event.status_code = "open";
                event.start_date = start;
                event.end_date = start.plusMonths(1).minusDays(1);
                event.appl_start_date = LocalDate.of(year, 1, 1);
                event.appl_end_date = start.minusDays(1);
                event.result_app_skip_yn = true;
                event.max_person = 999;
                entityManager.persist(event);
                created++;
            }
        }
        return created;
    }

    public GenerationResponse generateRequiredTargets(int year, String ruleCode) {
        int created = inApplicationTransaction(() -> generateRequiredTargetsInTransaction(year, ruleCode));
        return new GenerationResponse(created, "Required targets generated.");
    }

    private int generateRequiredTargetsInTransaction(int year, String ruleCode) {
        String query = "select r from TraRequiredRule r where r.year = :year and r.is_active = true" + (ruleCode == null || ruleCode.isBlank() ? "" : " and r.rule_code = :ruleCode") + " order by r.id";
        TypedQuery<TraRequiredRule> ruleQuery = entityManager.createQuery(query, TraRequiredRule.class).setParameter("year", year);
        if (ruleCode != null && !ruleCode.isBlank()) ruleQuery.setParameter("ruleCode", ruleCode);
        List<TraRequiredRule> rules = ruleQuery.getResultList();
        if (rules.isEmpty()) return 0;
        List<Map<String, Object>> employees = projection().findActiveEmployees();
        int created = 0;
        for (TraRequiredRule rule : rules) {
            int month = rule.entry_month == null ? rule.start_month : rule.entry_month;
            month = Math.min(Math.max(month, 1), 12);
            String eduMonth = "%04d%02d".formatted(year, month);
            for (Map<String, Object> employee : employees) {
                Integer employeeId = integer(employee.get("id"));
                if (employeeId == null) continue;
                String key = "tra:required-target:" + year + ":" + employeeId + ":" + rule.rule_code + ":" + rule.course_id + ":" + eduMonth;
                lockNaturalKey(key);
                Long existing = entityManager.createQuery("select count(t) from TraRequiredTarget t where t.year = :year and t.employee_id = :employeeId and t.rule_code = :ruleCode and t.course_id = :courseId and t.edu_month = :eduMonth", Long.class)
                        .setParameter("year", year).setParameter("employeeId", employeeId).setParameter("ruleCode", rule.rule_code)
                        .setParameter("courseId", rule.course_id).setParameter("eduMonth", eduMonth).getSingleResult();
                if (existing > 0) continue;
                TraRequiredTarget target = new TraRequiredTarget();
                initialize(target);
                target.year = year; target.employee_id = employeeId; target.rule_code = rule.rule_code; target.course_id = rule.course_id;
                target.edu_month = eduMonth; target.standard_rule_id = rule.id; target.edu_level = rule.edu_level; target.completion_status = "pending";
                entityManager.persist(target); created++;
            }
        }
        return created;
    }

    @Transactional
    public GenerationResponse generateElearningWindows(int year, int appCount) {
        Map<String, TraElearningWindow> existing = new HashMap<>();
        for (TraElearningWindow row : entityManager.createQuery("select w from TraElearningWindow w where w.year_month like :year", TraElearningWindow.class)
                .setParameter("year", year + "%").getResultList()) existing.put(row.year_month, row);
        for (int month = 1; month <= 12; month++) {
            String yearMonth = "%04d%02d".formatted(year, month);
            LocalDate start = LocalDate.of(year, month, 1);
            while (start.getDayOfWeek().getValue() != 1) start = start.plusDays(1);
            TraElearningWindow row = existing.get(yearMonth);
            if (row == null) { row = new TraElearningWindow(); initialize(row); row.year_month = yearMonth; entityManager.persist(row); }
            row.start_date = start; row.end_date = start.plusDays(4); row.app_count = appCount; row.updated_at = Instant.now();
        }
        return new GenerationResponse(12, "E-learning windows generated.");
    }

    public GenerationResponse applyCyberResults(String uploadYm) {
        int processed = inApplicationTransaction(() -> applyCyberResultsInTransaction(uploadYm));
        return new GenerationResponse(processed, "Cyber upload results applied.");
    }

    private int applyCyberResultsInTransaction(String uploadYm) {
        String query = "select u.id from TraCyberUpload u where u.close_yn = false" + (uploadYm == null || uploadYm.isBlank() ? "" : " and u.upload_ym = :uploadYm") + " order by u.id";
        TypedQuery<Integer> uploadQuery = entityManager.createQuery(query, Integer.class);
        if (uploadYm != null && !uploadYm.isBlank()) uploadQuery.setParameter("uploadYm", uploadYm);
        List<Integer> uploadIds = uploadQuery.getResultList();
        int processed = 0;
        for (Integer uploadId : uploadIds) {
            lockNaturalKey("tra:cyber-upload:" + uploadId);
            TraCyberUpload upload = entityManager.find(TraCyberUpload.class, uploadId, LockModeType.PESSIMISTIC_WRITE);
            if (upload == null || upload.close_yn) continue;
            Integer organizationId = organizationFor(upload);
            TraCourse course = courseFor(upload, organizationId);
            TraEvent event = eventFor(upload, course, organizationId);
            EmployeeReference employee = upload.employee_no == null ? null : employeeByNumber(upload.employee_no);
            Integer historyId = null;
            if (employee != null) {
                lockNaturalKey("tra:history:" + employee.id() + ":" + course.id + ":" + event.id);
                TraHistory history = historyFor(employee.id(), course.id, event.id);
                if (history == null) { history = new TraHistory(); initialize(history); history.employee_id = employee.id(); history.course_id = course.id; history.event_id = event.id; entityManager.persist(history); }
                history.confirm_type = upload.confirm_type; history.unconfirm_reason = upload.unconfirm_reason; history.app_point = upload.reward_hour;
                history.job_code = upload.job_code; history.note = upload.note; history.completed_at = upload.end_date; history.updated_at = Instant.now();
                entityManager.flush(); historyId = history.id; upload.employee_id = employee.id();
            }
            upload.close_yn = true; upload.applied_course_id = course.id; upload.applied_event_id = event.id; upload.applied_history_id = historyId; upload.updated_at = Instant.now();
            processed++;
        }
        return processed;
    }

    @Transactional
    public ApplicationListResponse myApplications(int userId) {
        EmployeeReference employee = employeeForUser(userId);
        if (employee == null) return new ApplicationListResponse(List.of(), 0);
        return applications(projection().findByEmployeeId(employee.id()));
    }

    @Transactional
    public ApplicationActionResponse createApplication(int userId, ApplicationCreateRequest request) {
        EmployeeReference employee = employeeForUser(userId);
        if (employee == null) throw ApiException.notFound("Employee record not found.");
        TraCourse course = entityManager.find(TraCourse.class, request.courseId());
        if (course == null) throw ApiException.notFound("Course not found.");
        TraApplication application = new TraApplication(); initialize(application);
        application.application_no = nextApplicationNumber();
        application.employee_id = employee.id(); application.course_id = request.courseId(); application.event_id = request.eventId();
        application.in_out_type = request.inOutType() == null ? course.in_out_type : request.inOutType(); application.year_plan_yn = request.yearPlanYn();
        application.edu_memo = request.eduMemo(); application.note = request.note(); application.status = "submitted";
        entityManager.persist(application); entityManager.flush();
        return new ApplicationActionResponse(applicationItem(application));
    }

    @Transactional
    public ApplicationListResponse applicationsDetail() {
        TrainingApplicationProjectionMapper mapper = projectionMapper.getIfAvailable();
        return applications(mapper == null ? applicationRows(null, true) : mapper.findAll());
    }

    @Transactional
    public ApplicationActionResponse approveApplication(int id) {
        TraApplication application = application(id);
        if (!"submitted".equals(application.status)) throw ApiException.conflict("Only submitted applications can be approved.");
        application.status = "approved"; application.updated_at = Instant.now(); entityManager.flush();
        return new ApplicationActionResponse(applicationItem(application));
    }

    @Transactional
    public ApplicationActionResponse rejectApplication(int id, ApplicationRejectRequest request) {
        TraApplication application = application(id);
        if (!"submitted".equals(application.status) && !"draft".equals(application.status)) throw ApiException.conflict("Only submitted or draft applications can be rejected.");
        application.status = "rejected";
        if (request.reason() != null && !request.reason().isBlank()) application.note = application.note == null ? "반려사유: " + request.reason() : application.note + "\n반려사유: " + request.reason();
        application.updated_at = Instant.now(); entityManager.flush();
        return new ApplicationActionResponse(applicationItem(application));
    }

    @Transactional
    public ApplicationActionResponse withdrawApplication(int id, int userId) {
        TraApplication application = application(id);
        EmployeeReference employee = employeeForUser(userId);
        if (employee == null || !Objects.equals(application.employee_id, employee.id())) throw ApiException.forbidden("Cannot withdraw another employee's application.");
        if (!"submitted".equals(application.status) && !"draft".equals(application.status)) throw ApiException.conflict("Only submitted or draft applications can be withdrawn.");
        application.status = "canceled"; application.updated_at = Instant.now(); entityManager.flush();
        return new ApplicationActionResponse(applicationItem(application));
    }

    @Transactional
    public ResourceListResponse listResource(String resource, Integer year) {
        ResourceDefinition definition = resource(resource);
        String query = "select e from " + definition.type().getSimpleName() + " e" + (year != null && definition.supportsYear() ? " where e.year = :year" : "") + " order by e." + String.join(", e.", definition.order());
        @SuppressWarnings("unchecked") TypedQuery<Object> typedQuery = (TypedQuery<Object>) entityManager.createQuery(query, definition.type());
        if (year != null && definition.supportsYear()) typedQuery.setParameter("year", year);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Object row : typedQuery.getResultList()) items.add(enrich(resource, toMap(row)));
        return new ResourceListResponse(items, items.size());
    }

    @Transactional
    public ResourceBatchResponse saveResourceBatch(String resource, ResourceBatchRequest request) {
        ResourceDefinition definition = resource(resource);
        int created = 0, updated = 0, deleted = 0;
        for (Map<String, Object> item : request.items()) {
            String status = String.valueOf(item.getOrDefault("_status", "clean")).toLowerCase(Locale.ROOT);
            Integer id = integer(item.get("id"));
            if ("clean".equals(status)) continue;
            if ("added".equals(status)) {
                Object row = create(definition);
                for (String field : definition.fields()) if (item.containsKey(field)) assign(row, field, item.get(field));
                assignGeneratedCodeIfBlank(row);
                entityManager.persist(row); created++; continue;
            }
            if (id == null) continue;
            Object row = entityManager.find(definition.type(), id, LockModeType.PESSIMISTIC_WRITE);
            if (row == null) continue;
            if ("deleted".equals(status)) { entityManager.remove(row); deleted++; continue; }
            if ("updated".equals(status)) { for (String field : definition.fields()) if (item.containsKey(field)) assign(row, field, item.get(field)); touch(row); updated++; }
        }
        return new ResourceBatchResponse(created, updated, deleted);
    }

    private ResourceDefinition resource(String name) {
        ResourceDefinition definition = RESOURCES.get(name);
        if (definition == null) throw ApiException.notFound("Unknown TRA resource: " + name);
        return definition;
    }

    private Object create(ResourceDefinition definition) {
        try {
            Object row = definition.type().getDeclaredConstructor().newInstance();
            initialize(row);
            return row;
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException("TRA entity cannot be constructed.", exception);
        }
    }

    private void assignGeneratedCodeIfBlank(Object row) {
        if (row instanceof TraApplication application && (application.application_no == null || application.application_no.isBlank())) {
            application.application_no = nextApplicationNumber();
        }
        if (row instanceof TraOrganization organization && (organization.code == null || organization.code.isBlank())) {
            organization.code = "TRORG%05d".formatted(nextId(TraOrganization.class));
        }
        if (row instanceof TraCourse course && (course.course_code == null || course.course_code.isBlank())) {
            course.course_code = "TRAC%05d".formatted(nextId(TraCourse.class));
        }
    }

    private void initialize(Object row) {
        Instant now = Instant.now();
        if (row instanceof TrainingAudit audit) { audit.created_at = now; audit.updated_at = now; }
        if (row instanceof TraOrganization value) value.is_active = true;
        if (row instanceof TraCourse value) { value.in_out_type = "INTERNAL"; value.status_code = "open"; value.is_active = true; }
        if (row instanceof TraEvent value) { value.status_code = "open"; value.currency_code = "KRW"; value.is_active = true; }
        if (row instanceof TraRequiredRule value) { value.order_seq = 1; value.start_month = 1; value.end_month = 12; value.is_active = true; }
        if (row instanceof TraApplication value) { value.status = "draft"; }
        if (row instanceof TraRequiredTarget value) { value.completion_status = "pending"; }
        if (row instanceof TraHistory value) value.confirm_type = "0";
        if (row instanceof TraElearningWindow value) value.app_count = 2;
        if (row instanceof TraCyberUpload value) value.confirm_type = "0";
    }

    private void touch(Object row) { if (row instanceof TrainingAudit audit) audit.updated_at = Instant.now(); }

    private String nextApplicationNumber() {
        lockNaturalKey("tra:application-sequence");
        return "TRA-" + Year.now().getValue() + "-%06d".formatted(nextId(TraApplication.class));
    }

    private int nextId(Class<?> type) {
        Number max = (Number) entityManager.createQuery("select coalesce(max(e.id), 0) from " + type.getSimpleName() + " e").getSingleResult();
        return max.intValue() + 1;
    }

    private void assign(Object row, String name, Object value) {
        try {
            Field field = row.getClass().getField(name);
            Class<?> type = field.getType();
            if (value instanceof String string && string.isEmpty()) value = null;
            if (type == String.class) field.set(row, value == null ? null : String.valueOf(value));
            else if (type == int.class) field.setInt(row, integer(value) == null ? 0 : integer(value));
            else if (type == Integer.class) field.set(row, integer(value));
            else if (type == double.class) field.setDouble(row, decimal(value) == null ? 0D : decimal(value));
            else if (type == Double.class) field.set(row, decimal(value));
            else if (type == boolean.class) field.setBoolean(row, truth(value));
            else if (type == LocalDate.class) field.set(row, localDate(value));
        } catch (ReflectiveOperationException exception) {
            throw new IllegalArgumentException("Invalid TRA field: " + name, exception);
        }
    }

    private Map<String, Object> toMap(Object row) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (Field field : row.getClass().getFields()) {
            try { map.put(field.getName(), field.get(row)); }
            catch (IllegalAccessException exception) { throw new IllegalStateException(exception); }
        }
        return map;
    }

    private Map<String, Object> enrich(String resource, Map<String, Object> row) {
        if (resource.equals("courses")) row.put("organization_name", name(TraOrganization.class, integer(row.get("organization_id")), "name"));
        if (resource.equals("events")) { row.put("course_name", name(TraCourse.class, integer(row.get("course_id")), "course_name")); row.put("organization_name", name(TraOrganization.class, integer(row.get("organization_id")), "name")); }
        if (resource.equals("required-standards")) row.put("course_name", name(TraCourse.class, integer(row.get("course_id")), "course_name"));
        if (resource.equals("required-targets") || resource.equals("applications") || resource.equals("histories")) {
            row.put("course_name", name(TraCourse.class, integer(row.get("course_id")), "course_name"));
            row.put("event_name", name(TraEvent.class, integer(row.get("event_id")), "event_name"));
            Integer employeeId = integer(row.get("employee_id"));
            EmployeeReference employee = employeeId == null ? null : employeeById(employeeId);
            row.put("employee_no", employee == null ? null : employee.employeeNo());
        }
        return row;
    }

    private String name(Class<?> type, Integer id, String fieldName) {
        if (id == null) return null;
        Object row = entityManager.find(type, id);
        if (row == null) return null;
        try { return (String) row.getClass().getField(fieldName).get(row); }
        catch (ReflectiveOperationException exception) { throw new IllegalStateException(exception); }
    }

    private Integer organizationFor(TraCyberUpload upload) {
        if (upload.organization_name == null || upload.organization_name.isBlank()) return null;
        lockNaturalKey("tra:organization-name:" + upload.organization_name.strip());
        List<TraOrganization> rows = entityManager.createQuery("select o from TraOrganization o where o.name = :name", TraOrganization.class).setParameter("name", upload.organization_name).setMaxResults(1).getResultList();
        if (!rows.isEmpty()) return rows.getFirst().id;
        lockNaturalKey("tra:organization-sequence");
        TraOrganization organization = new TraOrganization(); initialize(organization); organization.code = "TRORG%05d".formatted(nextId(TraOrganization.class)); organization.name = upload.organization_name; organization.business_no = upload.business_no;
        entityManager.persist(organization); entityManager.flush(); return organization.id;
    }

    private TraCourse courseFor(TraCyberUpload upload, Integer organizationId) {
        lockNaturalKey("tra:course-name:" + upload.course_name.strip());
        List<TraCourse> rows = entityManager.createQuery("select c from TraCourse c where c.course_name = :name", TraCourse.class).setParameter("name", upload.course_name).setMaxResults(1).getResultList();
        if (!rows.isEmpty()) return rows.getFirst();
        lockNaturalKey("tra:course-sequence");
        TraCourse course = new TraCourse(); initialize(course); course.course_code = "TRAC%05d".formatted(nextId(TraCourse.class)); course.course_name = upload.course_name; course.in_out_type = upload.in_out_type == null ? "EXTERNAL" : upload.in_out_type;
        course.branch_code = upload.edu_branch_code; course.sub_branch_code = upload.edu_sub_branch_code; course.method_code = upload.method_code; course.organization_id = organizationId;
        course.mandatory_yn = upload.mandatory_yn; course.job_code = upload.job_code; course.edu_level = upload.edu_level;
        entityManager.persist(course); entityManager.flush(); return course;
    }

    private TraEvent eventFor(TraCyberUpload upload, TraCourse course, Integer organizationId) {
        String eventCode = upload.start_date == null ? upload.upload_ym + "01" : upload.start_date.toString().replace("-", "");
        lockNaturalKey("tra:event:" + course.id + ":" + eventCode);
        List<TraEvent> rows = entityManager.createQuery("select e from TraEvent e where e.course_id = :courseId and e.event_code = :eventCode", TraEvent.class)
                .setParameter("courseId", course.id).setParameter("eventCode", eventCode).setMaxResults(1).getResultList();
        if (!rows.isEmpty()) return rows.getFirst();
        TraEvent event = new TraEvent(); initialize(event); event.course_id = course.id; event.event_code = eventCode; event.event_name = upload.event_name == null ? course.course_name + "(" + eventCode + ")" : upload.event_name;
        event.status_code = upload.close_yn ? "closed" : "open"; event.organization_id = organizationId; event.place = upload.place; event.start_date = upload.start_date; event.end_date = upload.end_date;
        event.edu_hour = upload.edu_hour; event.per_expense_amount = upload.per_expense_amount; event.real_expense_amount = upload.real_expense_amount; event.labor_apply_yn = upload.labor_apply_yn; event.labor_amount = upload.labor_amount;
        entityManager.persist(event); entityManager.flush(); return event;
    }

    private TraHistory historyFor(int employeeId, int courseId, int eventId) {
        List<TraHistory> rows = entityManager.createQuery("select h from TraHistory h where h.employee_id = :employeeId and h.course_id = :courseId and h.event_id = :eventId", TraHistory.class)
                .setParameter("employeeId", employeeId).setParameter("courseId", courseId).setParameter("eventId", eventId).setMaxResults(1).getResultList();
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private EmployeeReference employeeByNumber(String employeeNo) {
        return employee(projection().findEmployeeByNumber(employeeNo));
    }

    private EmployeeReference employeeForUser(int userId) {
        return employee(projection().findEmployeeByUserId(userId));
    }

    private EmployeeReference employeeById(int employeeId) {
        return employee(projection().findEmployeeById(employeeId));
    }

    private EmployeeReference employee(Map<String, Object> row) {
        if (row == null || row.isEmpty()) return null;
        return new EmployeeReference(integer(row.get("id")), string(row.get("employee_no")));
    }

    private TrainingApplicationProjectionMapper projection() {
        TrainingApplicationProjectionMapper mapper = projectionMapper.getIfAvailable();
        if (mapper == null) throw new IllegalStateException("Training projection mapper is unavailable.");
        return mapper;
    }

    private TraApplication application(int id) {
        TraApplication application = entityManager.find(TraApplication.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (application == null) throw ApiException.notFound("Application not found.");
        return application;
    }

    private List<Map<String, Object>> applicationRows(Integer employeeId, boolean all) {
        String query = "select a from TraApplication a" + (all ? "" : " where a.employee_id = :employeeId") + " order by a.id desc";
        TypedQuery<TraApplication> typedQuery = entityManager.createQuery(query, TraApplication.class);
        if (!all) typedQuery.setParameter("employeeId", employeeId);
        return typedQuery.getResultList().stream().map(this::applicationMap).toList();
    }

    private Map<String, Object> applicationMap(TraApplication application) {
        Map<String, Object> map = toMap(application);
        EmployeeReference employee = employeeById(application.employee_id);
        map.put("employee_no", employee == null ? null : employee.employeeNo()); map.put("employee_name", null); map.put("department_name", null);
        map.put("course_name", name(TraCourse.class, application.course_id, "course_name")); map.put("event_name", name(TraEvent.class, application.event_id, "event_name"));
        return map;
    }

    private ApplicationListResponse applications(List<Map<String, Object>> rows) {
        return new ApplicationListResponse(rows.stream().map(this::applicationItem).toList(), rows.size());
    }

    private ApplicationItem applicationItem(TraApplication application) {
        TrainingApplicationProjectionMapper mapper = projectionMapper.getIfAvailable();
        if (mapper != null) { entityManager.flush(); List<Map<String, Object>> rows = mapper.findAll().stream().filter(row -> Objects.equals(integer(row.get("id")), application.id)).toList(); if (!rows.isEmpty()) return applicationItem(rows.getFirst()); }
        return applicationItem(applicationMap(application));
    }

    private ApplicationItem applicationItem(Map<String, Object> row) {
        return new ApplicationItem(integer(row.get("id")), string(row.get("application_no")), integer(row.get("employee_id")), string(row.get("employee_no")), string(row.get("employee_name")), string(row.get("department_name")), integer(row.get("course_id")), string(row.get("course_name")), integer(row.get("event_id")), string(row.get("event_name")), string(row.get("in_out_type")), string(row.get("status")), truth(row.get("year_plan_yn")), truth(row.get("survey_yn")), string(row.get("edu_memo")), string(row.get("note")), instant(row.get("created_at")), instant(row.get("updated_at")));
    }

    private void lockNaturalKey(String key) {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(cast(:lockKey as text), 0))")
                .setParameter("lockKey", key)
                .getSingleResult();
    }

    private <T> T inApplicationTransaction(Supplier<T> work) {
        if (transactionManager == null) return work.get();
        try {
            return executeTransaction(work);
        } catch (RuntimeException exception) {
            if (!isUniqueConflict(exception)) throw exception;
            return executeTransaction(work);
        }
    }

    private <T> T executeTransaction(Supplier<T> work) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return transaction.execute(status -> work.get());
    }

    private boolean isUniqueConflict(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sqlException && "23505".equals(sqlException.getSQLState())) return true;
        }
        return false;
    }

    private Integer integer(Object value) { if (value == null || "".equals(value)) return null; return value instanceof Number number ? number.intValue() : Integer.valueOf(String.valueOf(value)); }
    private Double decimal(Object value) { if (value == null || "".equals(value)) return null; return value instanceof Number number ? number.doubleValue() : Double.valueOf(String.valueOf(value)); }
    private boolean truth(Object value) { if (value instanceof Boolean bool) return bool; if (value instanceof Number number) return number.doubleValue() != 0D; return value != null && Set.of("1", "true", "t", "y", "yes").contains(String.valueOf(value).strip().toLowerCase(Locale.ROOT)); }
    private LocalDate localDate(Object value) { if (value == null || "".equals(value)) return null; if (value instanceof LocalDate date) return date; String text = String.valueOf(value).strip(); return text.matches("\\d{8}") ? LocalDate.parse(text, java.time.format.DateTimeFormatter.BASIC_ISO_DATE) : LocalDate.parse(text); }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private Instant instant(Object value) { if (value instanceof Instant instant) return instant; if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant(); if (value instanceof java.time.LocalDateTime dateTime) return dateTime.toInstant(ZoneOffset.UTC); return value == null ? null : Instant.parse(String.valueOf(value)); }
}
