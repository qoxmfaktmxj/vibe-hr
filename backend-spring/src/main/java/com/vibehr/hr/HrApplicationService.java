package com.vibehr.hr;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.TypedQuery;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
class HrApplicationService {
    private static final Set<String> EMPLOYMENT_STATUSES = Set.of("active", "leave", "resigned");
    private static final Set<String> BASIC_CATEGORIES = Set.of("appointment", "reward_punish", "contact_points", "education", "careers", "licenses", "military", "evaluation");
    private static final String EMPLOYEE_NUMBER_NAMESPACE_LOCK = "hr_employee_number_namespace";
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final HrGridMapper gridMapper;
    private final ApplicationEventPublisher events;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    HrApplicationService(EntityManager entityManager, ObjectMapper objectMapper, HrGridMapper gridMapper, ApplicationEventPublisher events) {
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
        this.gridMapper = gridMapper;
        this.events = events;
    }

    HrApplicationService(EntityManager entityManager, ObjectMapper objectMapper, HrGridMapper gridMapper) { this(entityManager, objectMapper, gridMapper, event -> { }); }

    @Transactional(readOnly = true)
    Map<String, Object> listEmployees(Integer page, Integer limit, boolean all, String employeeNo, String name, String department, String employmentStatus, Boolean active) {
        Integer offset = all ? null : Math.max(0, (page - 1) * limit);
        List<Map<String, Object>> rows = gridMapper.employeeRows(employeeNo, name, department, employmentStatus, active, offset, all ? null : limit);
        long total = gridMapper.employeeCount(employeeNo, name, department, employmentStatus, active);
        Map<String, Object> result = new LinkedHashMap<>(); result.put("employees", rows); result.put("total_count", total);
        if (!all) { result.put("page", page); result.put("limit", limit); } return result;
    }

    @Transactional(readOnly = true)
    Map<String, Object> departments() {
        @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("select id,code,name from org_departments order by code").getResultList();
        return Map.of("departments", rows.stream().map(row -> map("id", integer(row[0]), "code", row[1], "name", row[2])).toList());
    }

    @Transactional
    Map<String, Object> createEmployee(HrRequests.EmployeeCreate payload) { return Map.of("employee", createEmployeeInternal(payload)); }

    @Transactional
    Map<String, Object> batchEmployees(HrRequests.EmployeeBatch payload) {
        if (!"atomic".equals(payload.mode)) throw ApiException.badRequest("Unsupported batch mode.");
        int inserted = 0, updated = 0, deleted = 0;
        List<Integer> ids = payload.delete.stream().filter(id -> id != null && id > 0).distinct().sorted().toList();
        if (!ids.isEmpty()) { deleteEmployees(ids); deleted = ids.size(); }
        for (int index = 0; index < payload.update.size(); index++) { HrRequests.EmployeeUpdate item = payload.update.get(index); if (item.id == null || item.id <= 0) throw ApiException.badRequest("update[" + (index + 1) + "] requires valid id."); updateEmployeeInternal(item.id, item); updated++; }
        for (HrRequests.EmployeeCreate item : payload.insert) { createEmployeeInternal(item); inserted++; }
        return map("inserted_count", inserted, "updated_count", updated, "deleted_count", deleted);
    }

    @Transactional(readOnly = true)
    Map<String, Object> employeeForUser(int userId) { return Map.of("employee", employeeByUser(userId)); }

    @Transactional
    Map<String, Object> updateEmployee(int id, HrRequests.EmployeeUpdate payload) { return Map.of("employee", updateEmployeeInternal(id, payload)); }

    @Transactional
    void deleteEmployee(int id) { deleteEmployees(List.of(id)); }

    private Map<String, Object> createEmployeeInternal(HrRequests.EmployeeCreate payload) {
        return createEmployeeInternal(payload, null);
    }

    private Map<String, Object> createEmployeeInternal(HrRequests.EmployeeCreate payload, Integer finalistReservationId) {
        int departmentId = payload.departmentId; ensureDepartment(departmentId);
        String displayName = payload.displayName; String position = payload.positionTitle;
        lockEmployeeNumberNamespace();
        String employeeNo = present(payload.employeeNo) ? payload.employeeNo.trim() : generatedEmployeeNo();
        String loginId = present(payload.loginId) ? payload.loginId.trim() : generatedLoginId();
        assertEmployeeNumberAvailable(employeeNo, finalistReservationId);
        if (exists("select 1 from auth_users where login_id=:value", loginId)) throw ApiException.conflict("login_id already exists.");
        String email = payload.email == null ? loginId + "@vibe-hr.local" : payload.email; if (exists("select 1 from auth_users where email=:value", email)) throw ApiException.conflict("email already exists.");
        String status = payload.employmentStatus;
        int userId = integer(entityManager.createNativeQuery("insert into auth_users(login_id,email,password_hash,display_name,is_active,created_at,updated_at) values(:login,:email,:hash,:name,true,:now,:now) returning id")
                .setParameter("login", loginId).setParameter("email", email).setParameter("hash", passwordHash(payload.password)).setParameter("name", displayName).setParameter("now", now()).getSingleResult());
        entityManager.createNativeQuery("insert into auth_user_roles(user_id,role_id,assigned_at) select :userId,id,:now from auth_roles where code='employee' on conflict do nothing")
                .setParameter("userId", userId).setParameter("now", now()).executeUpdate();
        HrEmployee employee = new HrEmployee(); employee.user_id = userId; employee.employee_no = employeeNo; employee.department_id = departmentId; employee.position_title = position; employee.hire_date = payload.hireDate == null ? businessToday() : payload.hireDate; employee.employment_status = status; employee.created_at = now(); employee.updated_at = employee.created_at;
        entityManager.persist(employee); entityManager.flush(); return employeeById(employee.id);
    }

    private Map<String, Object> updateEmployeeInternal(int id, HrRequests.EmployeeUpdate payload) {
        HrEmployee employee = lockedEmployee(id);
        if (!exists("select 1 from auth_users where id=:value", employee.user_id)) throw ApiException.notFound("Employee user not found.");
        Map<String, Object> current = employeeById(id); int userId = integer(current.get("user_id"));
        if (payload.departmentId != null) { ensureDepartment(payload.departmentId); employee.department_id = payload.departmentId; }
        if (payload.positionTitle != null) employee.position_title = payload.positionTitle;
        if (payload.hireDate != null) employee.hire_date = payload.hireDate;
        if (payload.employmentStatus != null) employee.employment_status = payload.employmentStatus;
        if (payload.email != null && !Objects.equals(payload.email, current.get("email"))) { if (exists("select 1 from auth_users where email=:value", payload.email)) throw ApiException.conflict("email already exists."); entityManager.createNativeQuery("update auth_users set email=:email,updated_at=:now where id=:id").setParameter("email", payload.email).setParameter("now", now()).setParameter("id", userId).executeUpdate(); }
        if (payload.displayName != null) entityManager.createNativeQuery("update auth_users set display_name=:name,updated_at=:now where id=:id").setParameter("name", payload.displayName).setParameter("now", now()).setParameter("id", userId).executeUpdate();
        if (payload.isActive != null) entityManager.createNativeQuery("update auth_users set is_active=:active,updated_at=:now where id=:id").setParameter("active", payload.isActive).setParameter("now", now()).setParameter("id", userId).executeUpdate();
        if (present(payload.password)) entityManager.createNativeQuery("update auth_users set password_hash=:hash,updated_at=:now where id=:id").setParameter("hash", passwordHash(payload.password)).setParameter("now", now()).setParameter("id", userId).executeUpdate();
        employee.updated_at = now(); entityManager.flush(); return employeeById(id);
    }

    private void deleteEmployees(List<Integer> ids) {
        List<Integer> actual = ids.stream().filter(id -> id != null && id > 0).distinct().sorted().toList(); if (actual.isEmpty()) return;
        @SuppressWarnings("unchecked") List<Number> existingIds = entityManager.createNativeQuery("select id from hr_employees where id in (:ids)").setParameter("ids", actual).getResultList();
        Set<Integer> existing = existingIds.stream().map(Number::intValue).collect(java.util.stream.Collectors.toSet());
        Integer missing = actual.stream().filter(id -> !existing.contains(id)).findFirst().orElse(null);
        if (missing != null) throw ApiException.notFound("Employee not found: " + missing);
        for (Integer id : actual) lockedEmployee(id);
        try {
            @SuppressWarnings("unchecked") List<Number> appointmentOrders = entityManager.createNativeQuery("select distinct order_id from hr_appointment_order_items where employee_id in (:ids)").setParameter("ids", actual).getResultList();
            entityManager.createNativeQuery("update tim_leave_requests set approver_employee_id=null,updated_at=:now where approver_employee_id in (:ids)").setParameter("now", now()).setParameter("ids", actual).executeUpdate();
            for (String table : List.of("tim_leave_requests", "tim_annual_leaves", "tim_attendance_daily", "hr_personnel_histories", "hr_employee_info_records", "hr_employee_basic_profiles", "hr_appointment_order_items")) entityManager.createNativeQuery("delete from " + table + " where employee_id in (:ids)").setParameter("ids", actual).executeUpdate();
            if (!appointmentOrders.isEmpty()) { List<Integer> orderIds = appointmentOrders.stream().map(Number::intValue).toList(); entityManager.createNativeQuery("delete from hr_appointment_orders o where o.id in (:ids) and not exists (select 1 from hr_appointment_order_items i where i.order_id=o.id)").setParameter("ids", orderIds).executeUpdate(); }
            @SuppressWarnings("unchecked") List<Number> users = entityManager.createNativeQuery("select user_id from hr_employees where id in (:ids)").setParameter("ids", actual).getResultList();
            entityManager.createNativeQuery("delete from hr_employees where id in (:ids)").setParameter("ids", actual).executeUpdate();
            if (!users.isEmpty()) { List<Integer> userIds = users.stream().map(Number::intValue).toList(); entityManager.createNativeQuery("delete from auth_user_roles where user_id in (:ids)").setParameter("ids", userIds).executeUpdate(); entityManager.createNativeQuery("delete from auth_users where id in (:ids)").setParameter("ids", userIds).executeUpdate(); }
        } catch (PersistenceException exception) { throw ApiException.conflict("Cannot delete employee linked to existing attendance/leave/schedule/payroll or related records."); }
    }

    @Transactional(readOnly = true)
    Map<String, Object> basicDetail(int employeeId) {
        Map<String, Object> employee = employeeById(employeeId); HrEmployeeBasicProfile profile = optionalProfile(employeeId);
        Map<String, Object> result = new LinkedHashMap<>(); result.put("profile", map("employee_id", employeeId, "employee_no", employee.get("employee_no"), "full_name", employee.get("display_name"), "gender", profile == null ? null : profile.gender, "resident_no_masked", profile == null ? null : profile.resident_no_masked, "birth_date", profile == null ? null : profile.birth_date, "hire_date", employee.get("hire_date"), "retire_date", profile == null ? null : profile.retire_date, "blood_type", profile == null ? null : profile.blood_type, "marital_status", profile == null ? null : profile.marital_status, "mbti", profile == null ? null : profile.mbti, "probation_end_date", profile == null ? null : profile.probation_end_date, "department_name", employee.get("department_name"), "position_title", employee.get("position_title"), "job_family", profile == null ? null : profile.job_family, "job_role", profile == null || profile.job_role == null ? employee.get("position_title") : profile.job_role, "grade", profile == null ? null : profile.grade));
        result.put("appointments", basicRecords(employeeId, "appointment")); result.put("rewards_penalties", basicRecords(employeeId, "reward_punish")); result.put("contacts", basicRecords(employeeId, "contact_points")); result.put("educations", basicRecords(employeeId, "education")); result.put("careers", basicRecords(employeeId, "careers")); result.put("certificates", basicRecords(employeeId, "licenses")); result.put("military", basicRecords(employeeId, "military")); result.put("evaluations", basicRecords(employeeId, "evaluation")); return result;
    }

    @Transactional
    Map<String, Object> updateBasicProfile(int employeeId, HrRequests.BasicProfileUpdate payload) {
        HrEmployee employee = lockedEmployee(employeeId); HrEmployeeBasicProfile profile = optionalProfile(employeeId); if (profile == null) { profile = new HrEmployeeBasicProfile(); profile.employee_id = employeeId; profile.created_at = now(); profile.updated_at = profile.created_at; entityManager.persist(profile); }
        Map<String, Object> values = employeeById(employeeId); if (payload.fullName != null) entityManager.createNativeQuery("update auth_users set display_name=:name,updated_at=:now where id=:id").setParameter("name", payload.fullName).setParameter("now", now()).setParameter("id", integer(values.get("user_id"))).executeUpdate();
        if (payload.hireDate != null) employee.hire_date = payload.hireDate; if (payload.positionTitle != null) employee.position_title = payload.positionTitle;
        setProfile(profile, payload); employee.updated_at = now(); profile.updated_at = now(); entityManager.flush(); return (Map<String, Object>) basicDetail(employeeId).get("profile");
    }

    @Transactional
    Map<String, Object> createBasicRecord(int employeeId, HrRequests.BasicRecordCreate payload) { lockedEmployee(employeeId); return createBasicRecordInternal(employeeId, normalizeCategory(payload.category), payload); }
    @Transactional
    Map<String, Object> updateBasicRecord(int employeeId, int recordId, String category, HrRequests.BasicRecordUpdate payload) { lockedEmployee(employeeId); return updateBasicRecordInternal(employeeId, recordId, normalizeCategory(category), payload); }
    @Transactional
    void deleteBasicRecord(int employeeId, int recordId, String category) { Object row = basicEntity(employeeId, recordId, normalizeCategory(category)); entityManager.remove(row); }
    @Transactional(readOnly = true)
    Map<String, Object> adminRecords(String category, String employeeNo, String name, String department, String employmentStatus) {
        String normalized = normalizeCategory(category); List<Map<String, Object>> output = new ArrayList<>();
        @SuppressWarnings("unchecked") List<Number> ids = entityManager.createNativeQuery("select id from hr_employees order by employee_no").getResultList();
        for (Number id : ids) { Map<String, Object> employee = employeeById(id.intValue()); if (!matches(employee, employeeNo, name, department, employmentStatus)) continue; for (Map<String, Object> record : basicRecords(id.intValue(), normalized)) { Map<String, Object> merged = new LinkedHashMap<>(record); merged.put("employee_id", id.intValue()); merged.put("employee_no", employee.get("employee_no")); merged.put("display_name", employee.get("display_name")); merged.put("department_name", employee.get("department_name")); merged.put("employment_status", employee.get("employment_status")); output.add(merged); } }
        return Map.of("items", output);
    }

    @Transactional(readOnly = true)
    Map<String, Object> listFinalists(String search) {
        TypedQuery<HrRecruitFinalist> query = entityManager.createQuery("select f from HrRecruitFinalist f order by f.id desc", HrRecruitFinalist.class); List<HrRecruitFinalist> all = query.getResultList();
        List<Map<String, Object>> items = all.stream().filter(f -> !present(search) || contains(f.full_name, search) || contains(f.candidate_no, search) || contains(f.employee_no, search) || contains(f.login_id, search)).map(this::finalistMap).toList(); return map("items", items, "total_count", items.size());
    }
    @Transactional Map<String, Object> createFinalist(HrRequests.FinalistCreate payload) {
        advisoryLock("hr_recruit_candidate_no");
        HrRecruitFinalist f = finalist(payload, null);
        if (present(f.employee_no)) { lockEmployeeNumberNamespace(); assertEmployeeNumberAvailable(f.employee_no, null); }
        f.candidate_no = nextCandidateNo(); f.created_at = now(); f.updated_at = f.created_at;
        entityManager.persist(f); entityManager.flush(); return Map.of("item", finalistMap(f));
    }
    @Transactional Map<String, Object> updateFinalist(int id, HrRequests.FinalistUpdate payload) {
        HrRecruitFinalist f = entityManager.find(HrRecruitFinalist.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (f == null) throw ApiException.notFound("채용합격자 정보를 찾을 수 없습니다.");
        String next = payload.statusCode == null ? f.status_code : payload.statusCode;
        if (!next.equals(f.status_code) && !("draft".equals(f.status_code) && Set.of("draft", "ready").contains(next)) && !("ready".equals(f.status_code) && Set.of("draft", "ready", "appointed").contains(next)) && !("appointed".equals(f.status_code) && "appointed".equals(next))) throw ApiException.unprocessable("상태 전이 불가: '" + f.status_code + "' → '" + next + "'");
        if (payload.employeeNo != null) {
            String employeeNo = emptyNull(payload.employeeNo);
            lockEmployeeNumberNamespace();
            if ("appointed".equals(f.status_code) && !Objects.equals(employeeNo, f.employee_no)) throw ApiException.conflict("Appointed finalist employee_no cannot be changed.");
            if (!"appointed".equals(f.status_code) && employeeNo != null) assertEmployeeNumberAvailable(employeeNo, f.id);
        }
        finalist(payload, f); f.updated_at = now(); return Map.of("item", finalistMap(f));
    }
    @Transactional Map<String, Object> deleteFinalists(HrRequests.Ids payload) { List<HrRecruitFinalist> found = payload.ids.stream().map(id -> entityManager.find(HrRecruitFinalist.class, id, LockModeType.PESSIMISTIC_WRITE)).filter(Objects::nonNull).toList(); if (found.isEmpty()) throw ApiException.notFound("삭제할 채용합격자 데이터가 없습니다."); found.forEach(entityManager::remove); return Map.of("deleted_count", found.size()); }
    @Transactional Map<String, Object> syncFinalists(HrRequests.IfSync payload) { int inserted = 0, updated = 0; advisoryLock("hr_recruit_candidate_no"); for (HrRequests.IfRow inbound : payload.rows) { HrRecruitFinalist f = findFinalistByExternalKey(inbound.externalKey); if (f == null) { f = new HrRecruitFinalist(); f.candidate_no = nextCandidateNo(); f.source_type = "if"; f.external_key = inbound.externalKey; f.status_code = "draft"; f.is_active = true; f.created_at = now(); entityManager.persist(f); inserted++; } else { updated++; } f.full_name = inbound.fullName.trim(); f.phone_mobile = emptyNull(inbound.phoneMobile); f.email = emptyNull(inbound.email); f.hire_type = inbound.hireType; f.expected_join_date = inbound.expectedJoinDate; f.note = emptyNull(inbound.note); f.source_type = "if"; f.updated_at = now(); } return map("inserted_count", inserted, "updated_count", updated); }
    @Transactional Map<String, Object> generateFinalistEmployeeNos(HrRequests.Ids payload) { lockEmployeeNumberNamespace(); List<HrRecruitFinalist> rows = finalists(payload.ids); if (rows.isEmpty()) throw ApiException.notFound("대상 채용합격자 데이터가 없습니다."); int next = nextEmployeeSequence(), updated = 0, skipped = 0; for (HrRecruitFinalist f : rows) { if (present(f.employee_no)) { skipped++; continue; } f.employee_no = String.format("EMP-%06d", next++); if (!present(f.login_id)) f.login_id = f.employee_no.toLowerCase(Locale.ROOT).replace("-", ""); if ("draft".equals(f.status_code)) f.status_code = "ready"; f.updated_at = now(); updated++; } return map("updated_count", updated, "skipped_count", skipped); }
    @Transactional Map<String, Object> createEmployeesFromFinalists(HrRequests.Ids payload) {
        lockEmployeeNumberNamespace(); List<HrRecruitFinalist> rows = finalists(payload.ids); if (rows.isEmpty()) throw ApiException.notFound("대상 채용합격자 데이터가 없습니다."); int departmentId = stagingDepartment(); int next = nextEmployeeSequence(), created = 0, skipped = 0, errors = 0; List<Map<String, Object>> results = new ArrayList<>();
        for (HrRecruitFinalist f : rows) {
            String originalEmployeeNo = f.employee_no, originalLoginId = f.login_id;
            try { if (!present(f.employee_no)) f.employee_no = String.format("EMP-%06d", next++); if (!present(f.login_id)) f.login_id = nextLoginId(f.employee_no); HrEmployee existing = employeeForFinalist(f); if (existing != null) { syncFinalist(existing, f); skipped++; results.add(finalistEmployeeResult(f, "skipped", "이미 생성된 사원과 연결되어 있어 건너뛰었습니다.", existing)); continue; } assertEmployeeNumberAvailable(f.employee_no, f.id); HrRequests.EmployeeCreate request = finalistEmployeeRequest(f, departmentId); Map<String, Object> employee = createEmployeeInternal(request, f.id); HrEmployeeBasicProfile profile = optionalProfile(integer(employee.get("id"))); if (profile == null) { profile = new HrEmployeeBasicProfile(); profile.employee_id = integer(employee.get("id")); profile.created_at = now(); entityManager.persist(profile); } profile.birth_date = f.birth_date; profile.resident_no_masked = f.resident_no_masked; profile.updated_at = now(); if ("draft".equals(f.status_code)) f.status_code = "ready"; f.employee_no = (String) employee.get("employee_no"); f.login_id = (String) employee.get("login_id"); f.updated_at = now(); created++; results.add(finalistEmployeeResult(f, "created", "사원 생성이 완료되었습니다. 발령 전까지 채용대기 상태로 유지됩니다.", entityManager.find(HrEmployee.class, integer(employee.get("id"))))); }
            catch (ApiException exception) { f.employee_no = originalEmployeeNo; f.login_id = originalLoginId; errors++; results.add(finalistEmployeeResult(f, "error", String.valueOf(exception.detail()), null)); }
        }
        return map("created_count", created, "skipped_count", skipped, "error_count", errors, "results", results);
    }

    @Transactional(readOnly = true) Map<String, Object> listAppointmentCodes() { return Map.of("items", codeRows().stream().map(this::codeMap).toList()); }
    @Transactional Map<String, Object> createAppointmentCode(HrRequests.AppointmentCodeCreate payload) {
        Map<String, Object> group = appointmentGroup(true);
        String code = payload.code.trim().toUpperCase(Locale.ROOT);
        if (exists("select 1 from app_codes where group_id=:groupId and code=:value", code, "groupId", integer(group.get("id")))) throw ApiException.conflict("appointment code already exists.");
        int id = integer(entityManager.createNativeQuery("insert into app_codes(group_id,code,name,description,is_active,sort_order,extra_value1,extra_value2,created_at,updated_at) values(:group,:code,:name,:description,:active,:sort,:key,:value,:now,:now) returning id")
                .setParameter("group", integer(group.get("id"))).setParameter("code", code).setParameter("name", payload.name.trim()).setParameter("description", payload.description).setParameter("active", payload.isActive).setParameter("sort", payload.sortOrder).setParameter("key", payload.mappingKey).setParameter("value", payload.mappingValue).setParameter("now", now()).getSingleResult());
        return Map.of("item", codeMap(codeRow(id)));
    }
    @Transactional Map<String, Object> updateAppointmentCode(int id, HrRequests.AppointmentCodeUpdate payload) {
        Map<String, Object> current = codeRow(id);
        if (current == null || integer(current.get("group_id")) != integer(appointmentGroup(true).get("id"))) throw ApiException.notFound("Appointment code not found.");
        String code = payload.code == null ? (String) current.get("code") : payload.code.trim().toUpperCase(Locale.ROOT);
        if (!code.equals(current.get("code")) && exists("select 1 from app_codes where group_id=:groupId and code=:value and id<>:id", code, "groupId", integer(current.get("group_id")), "id", id)) throw ApiException.conflict("appointment code already exists.");
        entityManager.createNativeQuery("update app_codes set code=:code,name=:name,description=:description,is_active=:active,sort_order=:sort,extra_value1=:key,extra_value2=:value,updated_at=:now where id=:id")
                .setParameter("code", code).setParameter("name", payload.name == null ? current.get("name") : payload.name.trim()).setParameter("description", payload.description == null ? current.get("description") : payload.description).setParameter("active", payload.isActive == null ? current.get("is_active") : payload.isActive).setParameter("sort", payload.sortOrder == null ? current.get("sort_order") : payload.sortOrder).setParameter("key", payload.mappingKey == null ? current.get("mapping_key") : payload.mappingKey).setParameter("value", payload.mappingValue == null ? current.get("mapping_value") : payload.mappingValue).setParameter("now", now()).setParameter("id", id).executeUpdate();
        return Map.of("item", codeMap(codeRow(id)));
    }
    @Transactional void deleteAppointmentCode(int id) { Map<String,Object> row=codeRow(id); if (row == null || integer(row.get("group_id")) != integer(appointmentGroup(true).get("id"))) throw ApiException.notFound("Appointment code not found."); entityManager.createNativeQuery("delete from app_codes where id=:id").setParameter("id", id).executeUpdate(); }

    @Transactional(readOnly = true) Map<String,Object> listAppointmentRecords(String employeeNo,String name,String department,String orderStatus,String kind,String appointmentNo) {
        if (present(orderStatus) && !Set.of("draft", "confirmed", "cancelled").contains(orderStatus.trim().toLowerCase(Locale.ROOT))) throw ApiException.badRequest("Invalid order status.");
        if (present(kind) && !Set.of("permanent", "temporary").contains(kind.trim().toLowerCase(Locale.ROOT))) throw ApiException.badRequest("Invalid appointment kind.");
        String normalizedStatus = present(orderStatus) ? orderStatus.trim().toLowerCase(Locale.ROOT) : null;
        String normalizedKind = present(kind) ? kind.trim().toLowerCase(Locale.ROOT) : null;
        List<Map<String,Object>> all = appointmentItems().stream().map(this::appointmentMap).filter(row -> matches(row, employeeNo, name, department, null) && (normalizedStatus == null || normalizedStatus.equals(row.get("order_status"))) && (normalizedKind == null || normalizedKind.equals(row.get("appointment_kind"))) && (!present(appointmentNo) || contains((String)row.get("appointment_no"), appointmentNo))).toList();
        return Map.of("items", all);
    }
    @Transactional Map<String,Object> createAppointmentRecord(HrRequests.AppointmentRecordCreate payload,int actor) {
        HrEmployee employee = lockedEmployee(payload.employeeId);
        String kind = payload.appointmentKind.trim().toLowerCase(Locale.ROOT);
        appointmentRules(employee.id, kind, payload.startDate, payload.endDate, null);
        advisoryLock("hr_appointment_no");
        HrAppointmentOrder order = new HrAppointmentOrder();
        order.appointment_no = present(payload.appointmentNo) ? payload.appointmentNo.trim() : nextAppointmentNo();
        if (exists("select 1 from hr_appointment_orders where appointment_no=:value", order.appointment_no)) throw ApiException.conflict("Appointment number already exists.");
        order.appointment_code_id = validCodeId(payload.orderAppointmentCodeId);
        order.title = payload.orderTitle.trim();
        order.description = emptyNull(payload.orderDescription);
        order.effective_date = payload.effectiveDate;
        order.status = "draft";
        order.created_by = actor;
        order.created_at = now();
        order.updated_at = order.created_at;
        entityManager.persist(order);
        entityManager.flush();
        HrAppointmentOrderItem item = new HrAppointmentOrderItem();
        item.order_id = order.id;
        item.employee_id = employee.id;
        item.appointment_code_id = validCodeId(payload.itemAppointmentCodeId);
        item.appointment_kind = kind;
        item.action_type = payload.actionType.trim();
        item.start_date = payload.startDate;
        item.end_date = payload.endDate;
        item.from_department_id = employee.department_id;
        item.to_department_id = payload.toDepartmentId;
        item.from_position_title = employee.position_title;
        item.to_position_title = emptyNull(payload.toPositionTitle);
        item.from_employment_status = employee.employment_status;
        item.to_employment_status = resolvedEmploymentStatus(employee, payload.toEmploymentStatus, item.action_type);
        item.apply_status = "pending";
        item.temporary_reason = emptyNull(payload.temporaryReason);
        item.note = emptyNull(payload.note);
        item.created_at = now();
        item.updated_at = item.created_at;
        entityManager.persist(item);
        entityManager.flush();
        return Map.of("item", appointmentMap(item));
    }
    @Transactional Map<String,Object> updateAppointmentRecord(int id,HrRequests.AppointmentRecordUpdate payload) {
        HrAppointmentOrderItem item = entityManager.find(HrAppointmentOrderItem.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (item == null) throw ApiException.notFound("Appointment record not found.");
        HrAppointmentOrder order = entityManager.find(HrAppointmentOrder.class, item.order_id, LockModeType.PESSIMISTIC_WRITE);
        if (order == null) throw ApiException.notFound("Appointment order not found.");
        if (!"draft".equals(order.status)) throw ApiException.conflict("Only draft appointment orders can be modified.");
        HrEmployee employee = lockedEmployee(payload.employeeId == null ? item.employee_id : payload.employeeId);
        if (payload.employeeId != null && payload.employeeId != item.employee_id) { item.employee_id = employee.id; item.from_department_id = employee.department_id; item.from_position_title = employee.position_title; item.from_employment_status = employee.employment_status; }
        if (payload.appointmentNo != null) { String value = present(payload.appointmentNo) ? payload.appointmentNo.trim() : nextAppointmentNo(); if (exists("select 1 from hr_appointment_orders where appointment_no=:value and id<>:id", value, "id", order.id)) throw ApiException.conflict("Appointment number already exists."); order.appointment_no = value; }
        if (payload.orderTitle != null) order.title = payload.orderTitle.trim();
        if (payload.orderDescription != null) order.description = emptyNull(payload.orderDescription);
        if (payload.effectiveDate != null) order.effective_date = payload.effectiveDate;
        if (payload.orderAppointmentCodeId != null) order.appointment_code_id = validCodeId(payload.orderAppointmentCodeId);
        if (payload.itemAppointmentCodeId != null) item.appointment_code_id = validCodeId(payload.itemAppointmentCodeId);
        if (payload.appointmentKind != null) item.appointment_kind = payload.appointmentKind.trim().toLowerCase(Locale.ROOT);
        if (payload.actionType != null) item.action_type = payload.actionType.trim();
        if (payload.startDate != null) item.start_date = payload.startDate;
        if (payload.endDate != null) item.end_date = payload.endDate;
        if (payload.toDepartmentId != null) item.to_department_id = payload.toDepartmentId;
        if (payload.toPositionTitle != null) item.to_position_title = emptyNull(payload.toPositionTitle);
        if (payload.toEmploymentStatus != null) item.to_employment_status = resolvedEmploymentStatus(employee, payload.toEmploymentStatus, item.action_type);
        if (payload.temporaryReason != null) item.temporary_reason = emptyNull(payload.temporaryReason);
        if (payload.note != null) item.note = emptyNull(payload.note);
        appointmentRules(item.employee_id, item.appointment_kind, item.start_date, item.end_date, item.id);
        order.updated_at = now();
        item.updated_at = order.updated_at;
        return Map.of("item", appointmentMap(item));
    }
    @Transactional void deleteAppointmentRecord(int id){HrAppointmentOrderItem item=entityManager.find(HrAppointmentOrderItem.class,id,LockModeType.PESSIMISTIC_WRITE);if(item==null)throw ApiException.notFound("Appointment record not found.");HrAppointmentOrder order=entityManager.find(HrAppointmentOrder.class,item.order_id,LockModeType.PESSIMISTIC_WRITE);if(order==null)throw ApiException.notFound("Appointment order not found.");if(!"draft".equals(order.status))throw ApiException.conflict("Only draft appointment orders can be modified.");entityManager.remove(item);entityManager.flush();if(entityManager.createQuery("select count(i) from HrAppointmentOrderItem i where i.order_id=:id",Long.class).setParameter("id",order.id).getSingleResult()==0)entityManager.remove(order);}
    @Transactional Map<String,Object> confirmAppointment(int orderId,int actor) {
        HrAppointmentOrder order = entityManager.find(HrAppointmentOrder.class, orderId, LockModeType.PESSIMISTIC_WRITE);
        if (order == null) throw ApiException.notFound("Appointment order not found.");
        if (!"draft".equals(order.status)) throw ApiException.conflict("Only draft order can be confirmed.");
        List<HrAppointmentOrderItem> items = entityManager.createQuery("select i from HrAppointmentOrderItem i where i.order_id=:id order by i.id", HrAppointmentOrderItem.class).setParameter("id", orderId).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        if (items.isEmpty()) throw ApiException.badRequest("No appointment items to confirm.");
        Instant time = now();
        int applied = 0;
        for (HrAppointmentOrderItem item : items) {
            if ("cancelled".equals(item.apply_status)) continue;
            HrEmployee employee = lockedEmployee(item.employee_id);
            List<String[]> changes = new ArrayList<>();
            if (item.to_department_id != null && item.to_department_id != employee.department_id) { changes.add(new String[] { "department_id", String.valueOf(employee.department_id), String.valueOf(item.to_department_id) }); employee.department_id = item.to_department_id; }
            if (item.to_position_title != null && !Objects.equals(item.to_position_title, employee.position_title)) { changes.add(new String[] { "position_title", employee.position_title, item.to_position_title }); employee.position_title = item.to_position_title; }
            if (item.to_employment_status != null && !Objects.equals(item.to_employment_status, employee.employment_status)) { changes.add(new String[] { "employment_status", employee.employment_status, item.to_employment_status }); employee.employment_status = item.to_employment_status; }
            if (!changes.isEmpty()) employee.updated_at = time;
            if (changes.isEmpty()) writeHistory(employee.id, item.action_type, "hr_appointment_order_items", item.id, order.id, item.start_date, null, null, null, order.appointment_no + " " + item.action_type, actor);
            for (String[] change : changes) writeHistory(employee.id, item.action_type, "hr_appointment_order_items", item.id, order.id, item.start_date, change[0], change[1], change[2], order.appointment_no + " " + item.action_type, actor);
            writeInfoRecord(employee.id, item.start_date, order.title, item.action_type, departmentName(item.to_department_id == null ? employee.department_id : item.to_department_id), present(item.to_position_title) ? item.to_position_title : (present(item.to_employment_status) ? item.to_employment_status : order.appointment_no), item.note, time);
            entityManager.createNativeQuery("update hr_recruit_finalists set status_code='appointed',updated_at=:now where status_code<>'appointed' and employee_no=:employeeNo and login_id=(select login_id from auth_users where id=:userId)").setParameter("now", time).setParameter("employeeNo", employee.employee_no).setParameter("userId", employee.user_id).executeUpdate();
            item.apply_status = "applied";
            item.applied_at = time;
            item.updated_at = time;
            applied++;
        }
        order.status = "confirmed";
        order.confirmed_at = time;
        order.confirmed_by = actor;
        order.updated_at = time;
        return map("order_id", order.id, "status", order.status, "confirmed_at", order.confirmed_at, "confirmed_by", order.confirmed_by, "applied_count", applied);
    }

    @Transactional(readOnly=true) Map<String,Object> listChecklist(boolean includeInactive,int page,int limit){List<HrRetireChecklistItem> rows=entityManager.createQuery("select i from HrRetireChecklistItem i"+(includeInactive?"":" where i.is_active=true")+" order by i.sort_order,i.id",HrRetireChecklistItem.class).getResultList();return map("items",page(rows.stream().map(this::checklistMap).toList(),page,limit),"total_count",rows.size(),"page",page,"limit",limit);}
    @Transactional Map<String,Object> createChecklist(HrRequests.ChecklistCreate payload) {
        String code = payload.code.trim().toLowerCase(Locale.ROOT), title = payload.title.trim();
        if (code.isEmpty()) throw ApiException.badRequest("Checklist code is required.");
        if (title.isEmpty()) throw ApiException.badRequest("Checklist title is required.");
        if (exists("select 1 from hr_retire_checklist_items where code=:value", code)) throw ApiException.conflict("Checklist code already exists.");
        HrRetireChecklistItem item = new HrRetireChecklistItem();
        item.code = code; item.title = title; item.description = payload.description; item.is_required = payload.isRequired; item.is_active = payload.isActive; item.sort_order = payload.sortOrder; item.created_at = now(); item.updated_at = item.created_at;
        entityManager.persist(item); entityManager.flush(); return checklistMap(item);
    }
    @Transactional Map<String,Object> updateChecklist(int id,HrRequests.ChecklistUpdate payload) {
        HrRetireChecklistItem item = entityManager.find(HrRetireChecklistItem.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (item == null) throw ApiException.notFound("Checklist item not found.");
        if (payload.title != null) { String title = payload.title.trim(); if (title.isEmpty()) throw ApiException.badRequest("Checklist title is required."); item.title = title; }
        if (payload.description != null) item.description = payload.description;
        if (payload.isRequired != null) item.is_required = payload.isRequired;
        if (payload.isActive != null) item.is_active = payload.isActive;
        if (payload.sortOrder != null) item.sort_order = payload.sortOrder;
        item.updated_at = now();
        return checklistMap(item);
    }
    @Transactional(readOnly=true) Map<String,Object> listRetireCases(String status,int page,int limit){TypedQuery<HrRetireCase> query=entityManager.createQuery("select c from HrRetireCase c"+(present(status)?" where c.status=:status":"")+" order by c.created_at desc,c.id desc",HrRetireCase.class);if(present(status))query.setParameter("status",status);List<HrRetireCase> rows=query.getResultList();return map("items",page(rows.stream().map(this::retireListMap).toList(),page,limit),"total_count",rows.size(),"page",page,"limit",limit);}
    @Transactional Map<String,Object> createRetireCase(HrRequests.RetireCaseCreate payload,int actor) {
        HrEmployee employee = lockedEmployee(payload.employeeId);
        if ("resigned".equals(employee.employment_status)) throw ApiException.badRequest("Employee is already resigned.");
        List<HrRetireChecklistItem> checklist = entityManager.createQuery("select i from HrRetireChecklistItem i where i.is_active=true order by i.sort_order,i.id", HrRetireChecklistItem.class).getResultList();
        if (checklist.isEmpty()) throw ApiException.badRequest("No active retire checklist items.");
        Instant time = now();
        HrRetireCase c = new HrRetireCase();
        c.employee_id = employee.id; c.retire_date = payload.retireDate; c.reason = payload.reason; c.status = "draft"; c.requested_by = actor; c.created_at = time; c.updated_at = time;
        entityManager.persist(c); entityManager.flush();
        for (HrRetireChecklistItem item : checklist) { HrRetireCaseItem row = new HrRetireCaseItem(); row.case_id = c.id; row.checklist_item_id = item.id; row.is_required = item.is_required; row.is_checked = false; row.created_at = time; row.updated_at = time; entityManager.persist(row); }
        audit(c.id, "create", actor, "retire_date=" + c.retire_date);
        return retireDetail(c.id);
    }
    @Transactional(readOnly=true) Map<String,Object> retireDetail(int id){HrRetireCase c=retireCase(id,LockModeType.NONE);Map<String,Object> employee=employeeById(c.employee_id);List<HrRetireCaseItem> rows=entityManager.createQuery("select i from HrRetireCaseItem i, HrRetireChecklistItem c where i.checklist_item_id=c.id and i.case_id=:id order by c.sort_order,i.id",HrRetireCaseItem.class).setParameter("id",id).getResultList();List<Map<String,Object>> checks=new ArrayList<>();for(HrRetireCaseItem row:rows){HrRetireChecklistItem item=entityManager.find(HrRetireChecklistItem.class,row.checklist_item_id);checks.add(map("id",row.id,"checklist_item_id",item.id,"checklist_code",item.code,"checklist_title",item.title,"checklist_description",item.description,"is_required",row.is_required,"is_checked",row.is_checked,"checked_by",row.checked_by,"checked_at",row.checked_at,"note",row.note));}List<Map<String,Object>> logs=entityManager.createQuery("select l from HrRetireAuditLog l where l.case_id=:id order by l.created_at desc,l.id desc",HrRetireAuditLog.class).setParameter("id",id).getResultList().stream().map(l->map("id",l.id,"action_type",l.action_type,"actor_user_id",l.actor_user_id,"detail",l.detail,"created_at",l.created_at)).toList();return map("id",c.id,"employee_id",c.employee_id,"employee_no",employee.get("employee_no"),"employee_name",employee.get("display_name"),"department_name",employee.get("department_name"),"position_title",employee.get("position_title"),"retire_date",c.retire_date,"reason",c.reason,"status",c.status,"previous_employment_status",c.previous_employment_status,"requested_by",c.requested_by,"confirmed_by",c.confirmed_by,"confirmed_at",c.confirmed_at,"cancelled_by",c.cancelled_by,"cancelled_at",c.cancelled_at,"cancel_reason",c.cancel_reason,"created_at",c.created_at,"updated_at",c.updated_at,"checklist_items",checks,"audit_logs",logs);}
    @Transactional Map<String,Object> updateRetireItem(int caseId,int itemId,HrRequests.RetireItemUpdate payload,int actor) {
        HrRetireCase c = retireCase(caseId, LockModeType.PESSIMISTIC_WRITE);
        if (!"draft".equals(c.status)) throw ApiException.conflict("Only draft cases can be edited.");
        HrRetireCaseItem item = entityManager.find(HrRetireCaseItem.class, itemId, LockModeType.PESSIMISTIC_WRITE);
        if (item == null || item.case_id != caseId) throw ApiException.notFound("Case checklist item not found.");
        Instant time = now();
        item.is_checked = payload.isChecked; item.note = payload.note; item.checked_by = item.is_checked ? actor : null; item.checked_at = item.is_checked ? time : null; item.updated_at = time; c.updated_at = time;
        audit(caseId, item.is_checked ? "check" : "uncheck", actor, "case_item_id=" + itemId);
        return retireDetail(caseId);
    }
    @Transactional Map<String,Object> confirmRetireCase(int caseId,int actor) {
        HrRetireCase c = retireCase(caseId, LockModeType.PESSIMISTIC_WRITE);
        if (!"draft".equals(c.status)) throw ApiException.conflict("Only draft cases can be confirmed.");
        Long incomplete = entityManager.createQuery("select count(i) from HrRetireCaseItem i where i.case_id=:id and i.is_required=true and i.is_checked=false", Long.class).setParameter("id", caseId).getSingleResult();
        if (incomplete > 0) throw ApiException.badRequest("Required checklist items are not completed.");
        HrEmployee employee = lockedEmployee(c.employee_id);
        Instant time = now();
        String before = employee.employment_status;
        c.previous_employment_status = before; c.status = "confirmed"; c.confirmed_by = actor; c.confirmed_at = time; c.updated_at = time;
        employee.employment_status = "resigned"; employee.updated_at = time;
        HrEmployeeBasicProfile profile = optionalProfile(employee.id);
        if (profile == null) { profile = new HrEmployeeBasicProfile(); profile.employee_id = employee.id; profile.created_at = time; profile.updated_at = time; entityManager.persist(profile); }
        profile.retire_date = c.retire_date; profile.updated_at = time;
        writeInfoRecord(employee.id, c.retire_date, "퇴직처리", "retire", null, c.reason, "퇴직처리 확정(case_id=" + c.id + ")", time);
        writeHistory(employee.id, "retire", "hr_retire_cases", c.id, null, c.retire_date, "employment_status", before, "resigned", "Retire case confirmed.", actor);
        audit(caseId, "confirm", actor, "employment_status:" + before + "->resigned");
        events.publishEvent(new HrRetireConfirmedEvent(c.id));
        return retireDetail(caseId);
    }
    @Transactional Map<String,Object> cancelRetireCase(int caseId,HrRequests.RetireCancel payload,int actor) {
        HrRetireCase c = retireCase(caseId, LockModeType.PESSIMISTIC_WRITE);
        if (!"confirmed".equals(c.status)) throw ApiException.conflict("Only confirmed cases can be cancelled.");
        HrEmployee employee = lockedEmployee(c.employee_id);
        Instant time = now();
        String before = employee.employment_status, restore = present(c.previous_employment_status) ? c.previous_employment_status : "active";
        c.status = "cancelled"; c.cancelled_by = actor; c.cancelled_at = time; c.cancel_reason = payload.cancelReason; c.updated_at = time;
        employee.employment_status = restore; employee.updated_at = time;
        HrEmployeeBasicProfile profile = optionalProfile(employee.id);
        if (profile != null) { profile.retire_date = null; profile.updated_at = time; }
        writeInfoRecord(employee.id, c.retire_date, "퇴직처리 취소", "retire_cancel", null, payload.cancelReason, "퇴직처리 취소(case_id=" + c.id + ")", time);
        writeHistory(employee.id, "retire_cancel", "hr_retire_cases", c.id, null, c.retire_date, "employment_status", before, restore, "Retire case cancelled.", actor);
        audit(caseId, "cancel", actor, "employment_status:" + before + "->" + restore);
        return retireDetail(caseId);
    }

    @Transactional(readOnly=true) Map<String,Object> listSeverance(String status,String year,int page,int limit){TypedQuery<HrSeveranceCalc> query=entityManager.createQuery("select c from HrSeveranceCalc c"+(present(status)?" where c.status=:status":"")+" order by c.created_at desc,c.id desc",HrSeveranceCalc.class);if(present(status))query.setParameter("status",status);List<HrSeveranceCalc> rows=query.getResultList().stream().filter(c->!present(year)||year.equals(String.valueOf(c.retire_date.getYear()))).toList();return map("items",page(rows.stream().map(this::severanceMap).toList(),page,limit),"total_count",rows.size(),"page",page,"limit",limit);}
    @Transactional(readOnly=true) Map<String,Object> severanceDetail(int id){HrSeveranceCalc c=severance(id,LockModeType.NONE);return map("calc",severanceMap(c),"wage_details",wageDetails(c),"tax_detail",readTax(c));}
    @Transactional Map<String,Object> recalculateSeverance(int id){HrSeveranceCalc c=severance(id,LockModeType.PESSIMISTIC_WRITE);if("confirmed".equals(c.status))throw ApiException.conflict("Confirmed calc cannot be recalculated.");buildSeverance(c,retireCase(c.retire_case_id,LockModeType.PESSIMISTIC_READ),lockedEmployee(c.employee_id));return severanceDetail(id);}
    @Transactional Map<String,Object> updateSeverance(int id,HrRequests.SeveranceAdjustment payload) {
        HrSeveranceCalc c = severance(id, LockModeType.PESSIMISTIC_WRITE);
        if ("confirmed".equals(c.status)) throw ApiException.conflict("Confirmed calc cannot be modified.");
        String reason = payload.adjustmentReason.trim();
        if (reason.isEmpty()) throw ApiException.badRequest("adjustment_reason is required.");
        c.adjustment_amount = payload.adjustmentAmount; c.adjustment_reason = reason; c.final_amount = c.severance_amount + c.adjustment_amount; c.status = "reviewed";
        String taxWarning = applyTax(c);
        if (present(taxWarning) && (c.warning == null || !c.warning.contains(taxWarning))) c.warning = present(c.warning) ? c.warning + " " + taxWarning : taxWarning;
        c.updated_at = now();
        return severanceDetail(id);
    }
    @Transactional Map<String,Object> confirmSeverance(int id,int actor){HrSeveranceCalc c=severance(id,LockModeType.PESSIMISTIC_WRITE);if("confirmed".equals(c.status))throw ApiException.conflict("Calc is already confirmed.");c.status="confirmed";c.confirmed_by=actor;c.confirmed_at=now();c.updated_at=c.confirmed_at;return severanceDetail(id);}

    private void createSeveranceDraft(HrRetireCase retireCase,HrEmployee employee){HrSeveranceCalc existing=entityManager.createQuery("select c from HrSeveranceCalc c where c.retire_case_id=:id",HrSeveranceCalc.class).setParameter("id",retireCase.id).getResultStream().findFirst().orElse(null);if(existing!=null)return;HrSeveranceCalc c=new HrSeveranceCalc();c.retire_case_id=retireCase.id;c.employee_id=employee.id;c.adjustment_amount=0d;c.status="draft";c.created_at=now();c.updated_at=c.created_at;buildSeverance(c,retireCase,employee);entityManager.persist(c);}
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void createSeveranceDraftFromRetireCase(int caseId) {
        HrRetireCase retireCase = retireCase(caseId, LockModeType.PESSIMISTIC_WRITE);
        HrEmployee employee = lockedEmployee(retireCase.employee_id);
        createSeveranceDraft(retireCase, employee);
        entityManager.flush();
    }
    private void buildSeverance(HrSeveranceCalc c,HrRetireCase retireCase,HrEmployee employee) {
        c.hire_date = employee.hire_date; c.retire_date = retireCase.retire_date; c.service_days = HrSeveranceMath.serviceDays(c.hire_date, c.retire_date);
        LocalDate[] period = HrSeveranceMath.averageWagePeriod(c.retire_date); c.avg_wage_base_from = period[0]; c.avg_wage_base_to = period[1]; c.base_days_3m = HrSeveranceMath.baseDays(period[0], period[1]);
        double wages = wageDetails(c).stream().mapToDouble(row -> ((Number) row.get("included_amount")).doubleValue()).sum();
        c.wage_total_3m = wages; c.avg_daily_wage = c.base_days_3m == 0 ? 0d : wages / c.base_days_3m; c.severance_amount = HrSeveranceMath.severance(c.avg_daily_wage, c.service_days); c.final_amount = c.severance_amount + (c.adjustment_amount == null ? 0d : c.adjustment_amount); c.calculated_at = now();
        String warning = wages == 0d ? "직전 3개월 내 확정(paid) 급여 데이터가 없습니다." : null;
        if (c.service_days < HrSeveranceMath.MIN_SERVICE_DAYS) warning = appendWarning(warning, "근속일수가 1년 미만이라 퇴직금이 발생하지 않습니다.");
        warning = appendWarning(warning, applyTax(c));
        c.warning = warning; c.updated_at = now();
    }
    private String applyTax(HrSeveranceCalc c) {
        if (c.service_days < HrSeveranceMath.MIN_SERVICE_DAYS || c.final_amount <= 0d) {
            Map<String,Object> tax = HrSeveranceMath.tax(c.final_amount, c.service_days, 0d, 0d, null, null);
            storeTax(c, tax);
            return null;
        }
        double taxable = HrSeveranceMath.taxableBase(c.final_amount, c.service_days);
        TaxBracket bracket = taxBracket(c.retire_date.getYear(), taxable);
        String tableWarning = c.retire_date.getYear() == 2026 ? null : c.retire_date.getYear() + "년 기본세율 구간이 없어 최신 연도(2026) 기준으로 계산했습니다.";
        String warning = tableWarning != null ? tableWarning : bracket.warning;
        Map<String,Object> tax = HrSeveranceMath.tax(c.final_amount, c.service_days, bracket.rate, bracket.quickDeduction, bracket.year, warning);
        storeTax(c, tax);
        return warning;
    }
    private void storeTax(HrSeveranceCalc c, Map<String,Object> tax) { c.service_years = integer(tax.get("service_years")); c.income_tax = number(tax.get("income_tax")); c.local_income_tax = number(tax.get("local_income_tax")); c.net_severance = number(tax.get("net_severance")); try { c.tax_detail_json = objectMapper.writeValueAsString(tax); } catch (JacksonException exception) { throw new IllegalStateException(exception); } }

    private List<Map<String,Object>> wageDetails(HrSeveranceCalc c){if(c.avg_wage_base_from==null||c.avg_wage_base_to==null)return List.of();@SuppressWarnings("unchecked") List<Object[]> rows=entityManager.createNativeQuery("select i.item_code, max(a.name), sum(i.amount), coalesce(r.include_type,'full') from pay_payroll_run_items i join pay_payroll_run_employees re on re.id=i.run_employee_id join pay_payroll_runs run on run.id=re.run_id left join pay_severance_item_rules r on r.pay_item_code=i.item_code and r.is_active=true left join pay_allowance_deductions a on a.code=i.item_code where re.employee_id=:employeeId and run.status='paid' and i.direction='earning' and to_date(run.year_month || '-01','YYYY-MM-DD') <= :toDate and (to_date(run.year_month || '-01','YYYY-MM-DD') + interval '1 month - 1 day') >= :fromDate group by i.item_code,r.include_type order by i.item_code").setParameter("employeeId",c.employee_id).setParameter("fromDate",c.avg_wage_base_from).setParameter("toDate",c.avg_wage_base_to).getResultList();List<Map<String,Object>> result=new ArrayList<>();for(Object[] row:rows){double raw=number(row[2]);String include=(String)row[3];double included="exclude".equals(include)?0d:"prorate_12".equals(include)?raw*3d/12d:raw;result.add(map("item_code",row[0],"item_name",row[1],"include_type",include,"raw_amount",raw,"included_amount",included));}return result;}
    private TaxBracket taxBracket(int year,double taxable) {
        Integer usedYear = taxBracketYear(year);
        if (usedYear == null) return new TaxBracket(0d, 0d, year, null);
        @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("select tax_rate,quick_deduction,year from pay_income_tax_brackets where year=:year and annual_taxable_from<=:income and (annual_taxable_to is null or annual_taxable_to>=:income) order by annual_taxable_from desc limit 1").setParameter("year", usedYear).setParameter("income", Math.max(taxable, 0d)).getResultList();
        String warning = usedYear == year ? null : year + "년 기본세율 구간이 없어 최신 연도(" + usedYear + ") 기준으로 계산했습니다.";
        if (rows.isEmpty()) return new TaxBracket(0d, 0d, usedYear, warning);
        Object[] row = rows.getFirst();
        return new TaxBracket(number(row[0]), row[1] == null ? 0d : number(row[1]), integer(row[2]), warning);
    }
    private Integer taxBracketYear(int year) {
        Object exact = entityManager.createNativeQuery("select year from pay_income_tax_brackets where year=:year limit 1").setParameter("year", year).getResultStream().findFirst().orElse(null);
        if (exact != null) return integer(exact);
        Object latest = entityManager.createNativeQuery("select year from pay_income_tax_brackets order by year desc limit 1").getResultStream().findFirst().orElse(null);
        return latest == null ? null : integer(latest);
    }
    private Map<String,Object> readTax(HrSeveranceCalc c) { if (!present(c.tax_detail_json)) return null; try { Map<String,Object> result = objectMapper.readValue(c.tax_detail_json, LinkedHashMap.class); result.putIfAbsent("bracket_year", null); return result; } catch (JacksonException exception) { return null; } }
    private record TaxBracket(double rate, double quickDeduction, int year, String warning) { }

    private HrEmployee lockedEmployee(int id){HrEmployee employee=entityManager.find(HrEmployee.class,id,LockModeType.PESSIMISTIC_WRITE);if(employee==null)throw ApiException.notFound("Employee not found.");return employee;}
    private HrRetireCase retireCase(int id,LockModeType lock){HrRetireCase row=entityManager.find(HrRetireCase.class,id,lock);if(row==null)throw ApiException.notFound("Retire case not found.");return row;}
    private HrSeveranceCalc severance(int id,LockModeType lock){HrSeveranceCalc row=entityManager.find(HrSeveranceCalc.class,id,lock);if(row==null)throw ApiException.notFound("Severance calc not found.");return row;}
    private HrEmployeeBasicProfile optionalProfile(int employeeId){return entityManager.createQuery("select p from HrEmployeeBasicProfile p where p.employee_id=:id",HrEmployeeBasicProfile.class).setParameter("id",employeeId).getResultStream().findFirst().orElse(null);}
    private Map<String,Object> employeeById(int id){@SuppressWarnings("unchecked")List<Object[]> rows=entityManager.createNativeQuery("select e.id,e.employee_no,u.login_id,u.display_name,u.email,e.department_id,d.name,e.position_title,e.hire_date,e.employment_status,u.is_active,e.user_id from hr_employees e join auth_users u on u.id=e.user_id join org_departments d on d.id=e.department_id where e.id=:id").setParameter("id",id).getResultList();if(rows.isEmpty())throw ApiException.notFound("Employee not found.");return employeeMap(rows.getFirst());}
    private Map<String,Object> employeeByUser(int userId){@SuppressWarnings("unchecked")List<Object[]> rows=entityManager.createNativeQuery("select e.id,e.employee_no,u.login_id,u.display_name,u.email,e.department_id,d.name,e.position_title,e.hire_date,e.employment_status,u.is_active,e.user_id from hr_employees e join auth_users u on u.id=e.user_id join org_departments d on d.id=e.department_id where e.user_id=:id").setParameter("id",userId).getResultList();if(rows.isEmpty())throw ApiException.notFound("Employee profile not found.");return employeeMap(rows.getFirst());}
    private Map<String,Object> employeeMap(Object[] row){return map("id",integer(row[0]),"employee_no",row[1],"login_id",row[2],"display_name",row[3],"email",row[4],"department_id",integer(row[5]),"department_name",row[6],"position_title",row[7],"hire_date",row[8],"employment_status",row[9],"is_active",row[10],"user_id",row.length>11?integer(row[11]):null);}
    private void ensureDepartment(int id){if(!exists("select 1 from org_departments where id=:value",id))throw ApiException.badRequest("Invalid department_id.");}
    private String departmentName(int id){Object name=entityManager.createNativeQuery("select name from org_departments where id=:id").setParameter("id",id).getResultStream().findFirst().orElse(null);return name==null?null:name.toString();}
    private void advisoryLock(String name){entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtext(:name))").setParameter("name",name).getSingleResult();}
    private void lockEmployeeNumberNamespace(){advisoryLock(EMPLOYEE_NUMBER_NAMESPACE_LOCK);}
    private void assertEmployeeNumberAvailable(String employeeNo, Integer finalistReservationId) {
        if (exists("select 1 from hr_employees where employee_no=:value", employeeNo)) throw ApiException.conflict("employee_no already exists.");
        if (finalistReservationId == null
                ? exists("select 1 from hr_recruit_finalists where employee_no=:value", employeeNo)
                : exists("select 1 from hr_recruit_finalists where employee_no=:value and id<>:finalistId", employeeNo, "finalistId", finalistReservationId)) throw ApiException.conflict("employee_no is reserved by a recruitment finalist.");
    }
    private String generatedEmployeeNo(){for(int i=0;i<30;i++){String value=String.format("EMP-%06d",random.nextInt(1_000_000));if(!exists("select 1 from hr_employees where employee_no=:value",value) && !exists("select 1 from hr_recruit_finalists where employee_no=:value",value))return value;}throw ApiException.badRequest("Failed to generate employee_no.");}
    private String generatedLoginId(){String alphabet="abcdefghijklmnopqrstuvwxyz0123456789";for(int i=0;i<30;i++){StringBuilder token=new StringBuilder(10);for(int index=0;index<10;index++)token.append(alphabet.charAt(random.nextInt(alphabet.length())));String value="usr-"+token;if(!exists("select 1 from auth_users where login_id=:value",value))return value;}throw ApiException.badRequest("Failed to generate login_id.");}
    private String passwordHash(String password){try{byte[] salt=new byte[16];random.nextBytes(salt);byte[] digest=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(new PBEKeySpec(password.toCharArray(),salt,100000,256)).getEncoded();return "pbkdf2_sha256$100000$"+java.util.HexFormat.of().formatHex(salt)+"$"+java.util.HexFormat.of().formatHex(digest);}catch(Exception exception){throw new IllegalStateException("PBKDF2WithHmacSHA256 is unavailable.",exception);}}

    private String normalizeCategory(String value){String normalized=value==null?"":value.trim().toLowerCase(Locale.ROOT);normalized=switch(normalized){case "reward_penalty"->"reward_punish";case "address","contact"->"contact_points";case "career"->"careers";case "certificate"->"licenses";default->normalized;};if(!BASIC_CATEGORIES.contains(normalized))throw ApiException.badRequest("Invalid category.");return normalized;}
    private void setProfile(HrEmployeeBasicProfile profile,HrRequests.BasicProfileUpdate payload){if(payload.gender!=null)profile.gender=payload.gender;if(payload.residentNoMasked!=null)profile.resident_no_masked=payload.residentNoMasked;if(payload.birthDate!=null)profile.birth_date=payload.birthDate;if(payload.retireDate!=null)profile.retire_date=payload.retireDate;if(payload.bloodType!=null)profile.blood_type=payload.bloodType;if(payload.maritalStatus!=null)profile.marital_status=payload.maritalStatus;if(payload.mbti!=null)profile.mbti=payload.mbti;if(payload.probationEndDate!=null)profile.probation_end_date=payload.probationEndDate;if(payload.jobFamily!=null)profile.job_family=payload.jobFamily;if(payload.jobRole!=null)profile.job_role=payload.jobRole;if(payload.grade!=null)profile.grade=payload.grade;}
    private Map<String,Object> createBasicRecordInternal(int employeeId,String category,HrRequests.BasicRecordCreate payload){Instant time=now();switch(category){case "appointment","education","evaluation"->{HrEmployeeInfoRecord row=new HrEmployeeInfoRecord();row.employee_id=employeeId;row.category=category;row.record_date=payload.recordDate;row.title=payload.title;row.type=payload.type;row.organization=payload.organization;row.value=payload.value;row.note=payload.note;row.created_at=time;entityManager.persist(row);entityManager.flush();return legacyMap(row);}case "contact_points"->{HrContactPoint row=new HrContactPoint();row.employee_id=employeeId;row.seq=1;row.contact_type=payload.title;row.record_date=payload.recordDate;row.phone_mobile=payload.type;row.email=payload.organization;row.addr1=payload.value;row.note=payload.note;row.created_at=time;row.updated_at=time;entityManager.persist(row);entityManager.flush();return contactMap(row);}case "careers"->{HrCareer row=new HrCareer();row.employee_id=employeeId;row.seq=1;row.career_scope=careerScope(payload.type);row.record_date=payload.recordDate;row.company_name=payload.title;row.department_name=payload.organization;row.position_title=payload.value;row.note=payload.note;row.created_at=time;row.updated_at=time;entityManager.persist(row);entityManager.flush();return careerMap(row);}case "licenses"->{HrLicense row=new HrLicense();row.employee_id=employeeId;row.seq=1;row.record_date=payload.recordDate;row.license_name=payload.title;row.license_type=payload.type;row.issued_org=payload.organization;row.license_no=payload.value;row.note=payload.note;row.created_at=time;row.updated_at=time;entityManager.persist(row);entityManager.flush();return licenseMap(row);}case "military"->{HrMilitary row=new HrMilitary();row.employee_id=employeeId;row.seq=1;row.record_date=payload.recordDate;row.military_type=payload.title;row.branch=payload.type;row.rank=payload.organization;row.discharge_type=payload.value;row.note=payload.note;row.created_at=time;row.updated_at=time;entityManager.persist(row);entityManager.flush();return militaryMap(row);}case "reward_punish"->{HrRewardPunish row=new HrRewardPunish();row.employee_id=employeeId;row.seq=1;row.reward_punish_type=rewardType(payload.type);row.action_date=payload.recordDate;row.title=payload.title;row.office_name=payload.organization;row.reason=payload.value;row.note=payload.note;row.status="DRAFT";row.created_at=time;row.updated_at=time;entityManager.persist(row);entityManager.flush();return rewardMap(row);}default->throw ApiException.badRequest("Invalid category.");}}
    private Map<String,Object> updateBasicRecordInternal(int employeeId,int id,String category,HrRequests.BasicRecordUpdate payload){Object row=basicEntity(employeeId,id,category);switch(category){case "appointment","education","evaluation"->{HrEmployeeInfoRecord r=(HrEmployeeInfoRecord)row;if(payload.recordDate!=null)r.record_date=payload.recordDate;if(payload.title!=null)r.title=payload.title;if(payload.type!=null)r.type=payload.type;if(payload.organization!=null)r.organization=payload.organization;if(payload.value!=null)r.value=payload.value;if(payload.note!=null)r.note=payload.note;return legacyMap(r);}case "contact_points"->{HrContactPoint r=(HrContactPoint)row;if(payload.recordDate!=null)r.record_date=payload.recordDate;if(payload.title!=null)r.contact_type=payload.title;if(payload.type!=null)r.phone_mobile=payload.type;if(payload.organization!=null)r.email=payload.organization;if(payload.value!=null)r.addr1=payload.value;if(payload.note!=null)r.note=payload.note;r.updated_at=now();return contactMap(r);}case "careers"->{HrCareer r=(HrCareer)row;if(payload.recordDate!=null)r.record_date=payload.recordDate;if(payload.title!=null)r.company_name=payload.title;if(payload.type!=null)r.career_scope=careerScope(payload.type);if(payload.organization!=null)r.department_name=payload.organization;if(payload.value!=null)r.position_title=payload.value;if(payload.note!=null)r.note=payload.note;r.updated_at=now();return careerMap(r);}case "licenses"->{HrLicense r=(HrLicense)row;if(payload.recordDate!=null)r.record_date=payload.recordDate;if(payload.title!=null)r.license_name=payload.title;if(payload.type!=null)r.license_type=payload.type;if(payload.organization!=null)r.issued_org=payload.organization;if(payload.value!=null)r.license_no=payload.value;if(payload.note!=null)r.note=payload.note;r.updated_at=now();return licenseMap(r);}case "military"->{HrMilitary r=(HrMilitary)row;if(payload.recordDate!=null)r.record_date=payload.recordDate;if(payload.title!=null)r.military_type=payload.title;if(payload.type!=null)r.branch=payload.type;if(payload.organization!=null)r.rank=payload.organization;if(payload.value!=null)r.discharge_type=payload.value;if(payload.note!=null)r.note=payload.note;r.updated_at=now();return militaryMap(r);}case "reward_punish"->{HrRewardPunish r=(HrRewardPunish)row;if(payload.recordDate!=null)r.action_date=payload.recordDate;if(payload.title!=null)r.title=payload.title;if(payload.type!=null)r.reward_punish_type=rewardType(payload.type);if(payload.organization!=null)r.office_name=payload.organization;if(payload.value!=null)r.reason=payload.value;if(payload.note!=null)r.note=payload.note;r.updated_at=now();return rewardMap(r);}default->throw ApiException.badRequest("Invalid category.");}}
    private Object basicEntity(int employeeId,int id,String category){Object row=switch(category){case "appointment","education","evaluation"->entityManager.find(HrEmployeeInfoRecord.class,id);case "contact_points"->entityManager.find(HrContactPoint.class,id);case "careers"->entityManager.find(HrCareer.class,id);case "licenses"->entityManager.find(HrLicense.class,id);case "military"->entityManager.find(HrMilitary.class,id);case "reward_punish"->entityManager.find(HrRewardPunish.class,id);default->null;};if(row==null||basicEmployeeId(row)!=employeeId)throw ApiException.notFound("Record not found.");return row;}
    private int basicEmployeeId(Object row){if(row instanceof HrEmployeeInfoRecord r)return r.employee_id;if(row instanceof HrContactPoint r)return r.employee_id;if(row instanceof HrCareer r)return r.employee_id;if(row instanceof HrLicense r)return r.employee_id;if(row instanceof HrMilitary r)return r.employee_id;return ((HrRewardPunish)row).employee_id;}
    private List<Map<String,Object>> basicRecords(int employeeId,String category){return switch(category){case "appointment","education","evaluation"->entityManager.createQuery("select r from HrEmployeeInfoRecord r where r.employee_id=:id and r.category=:category order by r.record_date desc,r.id desc",HrEmployeeInfoRecord.class).setParameter("id",employeeId).setParameter("category",category).getResultList().stream().map(this::legacyMap).toList();case "contact_points"->entityManager.createQuery("select r from HrContactPoint r where r.employee_id=:id order by r.record_date desc,r.id desc",HrContactPoint.class).setParameter("id",employeeId).getResultList().stream().map(this::contactMap).toList();case "careers"->entityManager.createQuery("select r from HrCareer r where r.employee_id=:id order by r.record_date desc,r.id desc",HrCareer.class).setParameter("id",employeeId).getResultList().stream().map(this::careerMap).toList();case "licenses"->entityManager.createQuery("select r from HrLicense r where r.employee_id=:id order by r.record_date desc,r.id desc",HrLicense.class).setParameter("id",employeeId).getResultList().stream().map(this::licenseMap).toList();case "military"->entityManager.createQuery("select r from HrMilitary r where r.employee_id=:id order by r.record_date desc,r.id desc",HrMilitary.class).setParameter("id",employeeId).getResultList().stream().map(this::militaryMap).toList();case "reward_punish"->entityManager.createQuery("select r from HrRewardPunish r where r.employee_id=:id order by r.action_date desc,r.id desc",HrRewardPunish.class).setParameter("id",employeeId).getResultList().stream().map(this::rewardMap).toList();default->List.of();};}
    private Map<String,Object> legacyMap(HrEmployeeInfoRecord r){return map("id",r.id,"category",r.category,"record_date",r.record_date,"title",r.title,"type",r.type,"organization",r.organization,"value",r.value,"note",r.note,"created_at",r.created_at);}
    private Map<String,Object> contactMap(HrContactPoint r){return map("id",r.id,"category","contact_points","record_date",r.record_date==null?r.valid_from:r.record_date,"title",r.contact_type,"type",r.phone_mobile==null?r.phone_home:r.phone_mobile,"organization",r.email,"value",r.addr1,"note",r.note,"created_at",r.created_at);}
    private Map<String,Object> careerMap(HrCareer r){return map("id",r.id,"category","careers","record_date",r.record_date==null?r.start_date:r.record_date,"title",r.company_name,"type",r.career_scope,"organization",r.department_name,"value",r.position_title==null?r.job_title:r.position_title,"note",r.note,"created_at",r.created_at);}
    private Map<String,Object> licenseMap(HrLicense r){return map("id",r.id,"category","licenses","record_date",r.record_date==null?r.issued_date:r.record_date,"title",r.license_name,"type",r.license_type,"organization",r.issued_org,"value",r.license_no,"note",r.note,"created_at",r.created_at);}
    private Map<String,Object> militaryMap(HrMilitary r){return map("id",r.id,"category","military","record_date",r.record_date==null?r.service_start_date:r.record_date,"title",r.military_type,"type",r.branch,"organization",r.rank,"value",r.discharge_type,"note",r.note,"created_at",r.created_at);}
    private Map<String,Object> rewardMap(HrRewardPunish r){return map("id",r.id,"category","reward_punish","record_date",r.action_date,"title",r.title,"type",r.reward_punish_type,"organization",r.office_name,"value",r.reason,"note",r.note,"created_at",r.created_at);}
    private String careerScope(String value){String normalized=textValue(value,"EXTERNAL").toUpperCase(Locale.ROOT);return normalized.startsWith("IN")||normalized.contains("사내")?"INTERNAL":"EXTERNAL";}
    private String rewardType(String value){String normalized=textValue(value,"REWARD").trim().toUpperCase(Locale.ROOT);return normalized.startsWith("PUN")||normalized.startsWith("DIS")||normalized.contains("징계")||normalized.contains("벌")?"PUNISH":"REWARD";}

    private HrRecruitFinalist finalist(HrRequests.FinalistUpdate payload,HrRecruitFinalist existing) {
        HrRecruitFinalist row = existing == null ? new HrRecruitFinalist() : existing;
        if (payload.sourceType != null) row.source_type = payload.sourceType;
        if (payload.externalKey != null) row.external_key = emptyNull(payload.externalKey);
        if (payload.fullName != null) row.full_name = payload.fullName.trim();
        if (payload.residentNoMasked != null) row.resident_no_masked = emptyNull(payload.residentNoMasked);
        if (payload.birthDate != null) row.birth_date = payload.birthDate;
        if (payload.phoneMobile != null) row.phone_mobile = emptyNull(payload.phoneMobile);
        if (payload.email != null) row.email = emptyNull(payload.email);
        if (payload.hireType != null) row.hire_type = payload.hireType;
        if (payload.careerYears != null) row.career_years = payload.careerYears;
        if (payload.loginId != null) row.login_id = emptyNull(payload.loginId);
        if (payload.employeeNo != null) row.employee_no = emptyNull(payload.employeeNo);
        if (payload.expectedJoinDate != null) row.expected_join_date = payload.expectedJoinDate;
        if (payload.statusCode != null) row.status_code = payload.statusCode;
        if (payload.note != null) row.note = emptyNull(payload.note);
        if (payload.isActive != null) row.is_active = payload.isActive;
        return row;
    }
    private String nextCandidateNo(){String prefix="RC"+LocalDate.now(ZoneOffset.UTC).toString().replace("-","");@SuppressWarnings("unchecked")List<String> rows=entityManager.createNativeQuery("select candidate_no from hr_recruit_finalists where candidate_no like :prefix").setParameter("prefix",prefix+"-%").getResultList();int max=rows.stream().mapToInt(value->{try{return Integer.parseInt(value.substring(value.lastIndexOf('-')+1));}catch(RuntimeException ignored){return 0;}}).max().orElse(0);return prefix+"-"+String.format("%04d",max+1);}
    private int nextEmployeeSequence(){@SuppressWarnings("unchecked")List<String> rows=entityManager.createNativeQuery("select employee_no from hr_employees where employee_no like 'EMP-%' union all select employee_no from hr_recruit_finalists where employee_no like 'EMP-%'").getResultList();return rows.stream().mapToInt(value->{try{return Integer.parseInt(value.substring(4));}catch(RuntimeException ignored){return 0;}}).max().orElse(0)+1;}
    private HrRecruitFinalist findFinalistByExternalKey(String key){return entityManager.createQuery("select f from HrRecruitFinalist f where f.external_key=:key",HrRecruitFinalist.class).setParameter("key",key).getResultStream().findFirst().orElse(null);}
    private List<HrRecruitFinalist> finalists(List<Integer> ids){return ids.stream().sorted().map(id -> entityManager.find(HrRecruitFinalist.class,id,LockModeType.PESSIMISTIC_WRITE)).filter(Objects::nonNull).toList();}
    private int stagingDepartment(){Object id=entityManager.createNativeQuery("select id from org_departments where code='HQ-HR' order by id limit 1").getResultStream().findFirst().orElse(null);if(id==null)id=entityManager.createNativeQuery("select id from org_departments where is_active=true order by id limit 1").getResultStream().findFirst().orElse(null);if(id==null)throw ApiException.badRequest("사원 생성에 사용할 기본 부서를 찾을 수 없습니다.");return integer(id);}
    private HrEmployee employeeForFinalist(HrRecruitFinalist f){if(!present(f.employee_no)||!present(f.login_id))return null;Object id=entityManager.createNativeQuery("select e.id from hr_employees e join auth_users u on u.id=e.user_id where e.employee_no=:employeeNo and u.login_id=:loginId").setParameter("employeeNo",f.employee_no).setParameter("loginId",f.login_id).getResultStream().findFirst().orElse(null);return id==null?null:entityManager.find(HrEmployee.class,integer(id));}
    private void syncFinalist(HrEmployee employee,HrRecruitFinalist f){Map<String,Object> data=employeeById(employee.id);f.employee_no=employee.employee_no;f.login_id=(String)data.get("login_id");if("draft".equals(f.status_code))f.status_code="ready";f.updated_at=now();}
    private Map<String,Object> finalistMap(HrRecruitFinalist f){return map("id",f.id,"candidate_no",f.candidate_no,"source_type",f.source_type,"external_key",f.external_key,"full_name",f.full_name,"resident_no_masked",f.resident_no_masked,"birth_date",f.birth_date,"phone_mobile",f.phone_mobile,"email",f.email,"hire_type",f.hire_type,"career_years",f.career_years,"login_id",f.login_id,"employee_no",f.employee_no,"expected_join_date",f.expected_join_date,"status_code",f.status_code,"note",f.note,"is_active",f.is_active,"created_at",f.created_at,"updated_at",f.updated_at);}
    private Map<String,Object> finalistEmployeeResult(HrRecruitFinalist f,String outcome,String detail,HrEmployee employee){Map<String,Object> result=map("finalist_id",f.id,"candidate_no",f.candidate_no,"full_name",f.full_name,"outcome",outcome,"detail",detail,"employee_id",employee==null?null:employee.id,"employee_no",employee==null?f.employee_no:employee.employee_no,"login_id",f.login_id);return result;}
    private String nextLoginId(String employeeNo) { String base = employeeNo.toLowerCase(Locale.ROOT).replace("-", ""); String candidate = base.substring(0, Math.min(50, base.length())); int suffix = 1; while (exists("select 1 from auth_users where login_id=:value", candidate)) { String suffixText = String.valueOf(++suffix); candidate = base.substring(0, Math.min(Math.max(1, 50 - suffixText.length()), base.length())) + suffixText; } return candidate; }
    private HrRequests.EmployeeCreate finalistEmployeeRequest(HrRecruitFinalist finalist, int departmentId) {
        HrRequests.EmployeeCreate request = new HrRequests.EmployeeCreate();
        request.employeeNo = finalist.employee_no; request.displayName = finalist.full_name.trim(); request.departmentId = departmentId; request.positionTitle = "채용대기"; request.hireDate = finalist.expected_join_date == null ? LocalDate.now() : finalist.expected_join_date; request.employmentStatus = "leave"; request.loginId = finalist.login_id; request.email = validEmail(finalist.email) ? finalist.email.trim() : finalist.login_id + "@hr.minosek91.cloud"; request.password = temporaryPassword();
        return request;
    }
    private boolean validEmail(String value) { return present(value) && value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"); }
    private String temporaryPassword(){return "Aa1!"+Base64.getUrlEncoder().withoutPadding().encodeToString(random.generateSeed(9));}

    private Map<String,Object> appointmentGroup(boolean create){@SuppressWarnings("unchecked")List<Object[]> rows=entityManager.createNativeQuery("select id,code,name from app_code_groups where code='HR_APPOINTMENT_CODE'").getResultList();if(!rows.isEmpty())return map("id",integer(rows.getFirst()[0]),"code",rows.getFirst()[1],"name",rows.getFirst()[2]);if(!create)throw ApiException.badRequest("Appointment code group not found.");int id=integer(entityManager.createNativeQuery("insert into app_code_groups(code,name,description,is_active,sort_order,created_at,updated_at) values('HR_APPOINTMENT_CODE','발령코드','발령처리용 코드 그룹',true,150,:now,:now) returning id").setParameter("now",now()).getSingleResult());return map("id",id,"code","HR_APPOINTMENT_CODE","name","발령코드");}
    private List<Map<String,Object>> codeRows(){int group=integer(appointmentGroup(true).get("id"));@SuppressWarnings("unchecked")List<Object[]> rows=entityManager.createNativeQuery("select id,group_id,code,name,description,is_active,sort_order,extra_value1,extra_value2,created_at,updated_at from app_codes where group_id=:id order by sort_order,id").setParameter("id",group).getResultList();return rows.stream().map(this::codeRawMap).toList();}
    private Map<String,Object> codeRow(int id){@SuppressWarnings("unchecked")List<Object[]> rows=entityManager.createNativeQuery("select id,group_id,code,name,description,is_active,sort_order,extra_value1,extra_value2,created_at,updated_at from app_codes where id=:id").setParameter("id",id).getResultList();return rows.isEmpty()?null:codeRawMap(rows.getFirst());}
    private Map<String,Object> codeRawMap(Object[] row){return map("id",integer(row[0]),"group_id",integer(row[1]),"code",row[2],"name",row[3],"description",row[4],"is_active",row[5],"sort_order",integer(row[6]),"mapping_key",row[7],"mapping_value",row[8],"created_at",row[9],"updated_at",row[10]);}
    private Map<String,Object> codeMap(Map<String,Object> row){return map("id",row.get("id"),"code",row.get("code"),"name",row.get("name"),"description",row.get("description"),"is_active",row.get("is_active"),"sort_order",row.get("sort_order"),"mapping_key",row.get("mapping_key"),"mapping_value",row.get("mapping_value"),"created_at",row.get("created_at"),"updated_at",row.get("updated_at"));}
    private Integer validCodeId(Integer id){if(id==null)return null;Map<String,Object> code=codeRow(id);if(code==null||integer(code.get("group_id"))!=integer(appointmentGroup(false).get("id")))throw ApiException.badRequest("Invalid appointment code.");return id;}
    private String nextAppointmentNo(){String prefix="APT-"+LocalDate.now(ZoneOffset.UTC).toString().replace("-","")+"-";@SuppressWarnings("unchecked")List<String> values=entityManager.createNativeQuery("select appointment_no from hr_appointment_orders where appointment_no like :prefix").setParameter("prefix",prefix+"%").getResultList();int max=values.stream().mapToInt(value->{try{return Integer.parseInt(value.substring(prefix.length()));}catch(RuntimeException ignored){return 0;}}).max().orElse(0);return prefix+String.format("%04d",max+1);}
    private void appointmentRules(int employeeId,String kind,LocalDate start,LocalDate end,Integer excludedItem){if(!Set.of("permanent","temporary").contains(kind))throw ApiException.badRequest("Invalid appointment kind.");if("temporary".equals(kind)&&end==null)throw ApiException.badRequest("Temporary appointment requires end_date.");if(start==null)throw ApiException.unprocessable("start_date is required.");if(end!=null&&start.isAfter(end))throw ApiException.badRequest("start_date must be before or equal to end_date.");String sql="select i.start_date,i.end_date from hr_appointment_order_items i join hr_appointment_orders o on o.id=i.order_id where i.employee_id=:employeeId and o.status in ('draft','confirmed')"+(excludedItem==null?"":" and i.id<>:itemId");var query=entityManager.createNativeQuery(sql).setParameter("employeeId",employeeId);if(excludedItem!=null)query.setParameter("itemId",excludedItem);@SuppressWarnings("unchecked")List<Object[]> rows=query.getResultList();for(Object[] row:rows){LocalDate oldStart=localDate(row[0]),oldEnd=localDate(row[1]);if(oldEnd==null)throw ApiException.conflict("해당 직원에게 겹치는 발령이 이미 존재합니다. 기존 발령을 취소한 후 진행하세요.");boolean overlap=start.compareTo(oldEnd)<=0&&(end==null||end.compareTo(oldStart)>=0);if(overlap)throw ApiException.conflict("해당 직원의 기존 발령 기간("+oldStart+"~"+oldEnd+")과 겹칩니다.");}}
    private String resolvedEmploymentStatus(HrEmployee employee,String requested,String action){if(present(requested)){String status=requested.trim().toLowerCase(Locale.ROOT);if(!EMPLOYMENT_STATUSES.contains(status))throw ApiException.badRequest("Invalid employment status.");return status;}String lower=action.toLowerCase(Locale.ROOT);return "leave".equals(employee.employment_status)&&(lower.contains("입사")||lower.contains("신규")||lower.contains("hire")||lower.contains("onboard")||lower.contains("join"))?"active":null;}
    private List<HrAppointmentOrderItem> appointmentItems(){return entityManager.createQuery("select i from HrAppointmentOrderItem i, HrAppointmentOrder o where o.id=i.order_id order by o.effective_date desc,o.id desc,i.id desc",HrAppointmentOrderItem.class).getResultList();}
    private Map<String,Object> appointmentMap(HrAppointmentOrderItem item){HrAppointmentOrder order=entityManager.find(HrAppointmentOrder.class,item.order_id);Map<String,Object> employee=employeeById(item.employee_id);Map<String,Object> itemCode=item.appointment_code_id==null?null:codeRow(item.appointment_code_id),orderCode=order.appointment_code_id==null?null:codeRow(order.appointment_code_id);return map("id",item.id,"order_id",order.id,"appointment_no",order.appointment_no,"order_title",order.title,"order_description",order.description,"effective_date",order.effective_date,"order_status",order.status,"confirmed_at",order.confirmed_at,"confirmed_by",order.confirmed_by,"employee_id",item.employee_id,"employee_no",employee.get("employee_no"),"display_name",employee.get("display_name"),"department_name",employee.get("department_name"),"employment_status",employee.get("employment_status"),"appointment_code_id",item.appointment_code_id==null?order.appointment_code_id:item.appointment_code_id,"appointment_code_name",itemCode==null?(orderCode==null?null:orderCode.get("name")):itemCode.get("name"),"appointment_kind",item.appointment_kind,"action_type",item.action_type,"start_date",item.start_date,"end_date",item.end_date,"from_department_id",item.from_department_id,"to_department_id",item.to_department_id,"from_position_title",item.from_position_title,"to_position_title",item.to_position_title,"from_employment_status",item.from_employment_status,"to_employment_status",item.to_employment_status,"apply_status",item.apply_status,"applied_at",item.applied_at,"temporary_reason",item.temporary_reason,"note",item.note,"created_at",item.created_at,"updated_at",item.updated_at);}
    private void writeHistory(int employeeId,String history,String sourceTable,int sourceId,Integer orderId,LocalDate effective,String field,String before,String after,String description,int actor){HrPersonnelHistory row=new HrPersonnelHistory();row.employee_id=employeeId;row.history_type=history;row.source_table=sourceTable;row.source_id=sourceId;row.appointment_order_id=orderId;row.effective_date=effective;row.field_name=field;row.before_value=before;row.after_value=after;row.description=description;row.created_by=actor;row.created_at=now();entityManager.persist(row);}
    private void writeInfoRecord(int employeeId,LocalDate recordDate,String title,String type,String organization,String value,String note,Instant time){HrEmployeeInfoRecord row=new HrEmployeeInfoRecord();row.employee_id=employeeId;row.category="appointment";row.record_date=recordDate;row.title=title;row.type=type;row.organization=organization;row.value=value;row.note=note;row.created_at=time;entityManager.persist(row);}
    private Map<String,Object> checklistMap(HrRetireChecklistItem item){return map("id",item.id,"code",item.code,"title",item.title,"description",item.description,"is_required",item.is_required,"is_active",item.is_active,"sort_order",item.sort_order,"created_at",item.created_at,"updated_at",item.updated_at);}
    private Map<String,Object> retireListMap(HrRetireCase c){Map<String,Object> employee=employeeById(c.employee_id);return map("id",c.id,"employee_id",c.employee_id,"employee_no",employee.get("employee_no"),"employee_name",employee.get("display_name"),"department_name",employee.get("department_name"),"position_title",employee.get("position_title"),"retire_date",c.retire_date,"reason",c.reason,"status",c.status,"created_at",c.created_at,"confirmed_at",c.confirmed_at,"cancelled_at",c.cancelled_at);}
    private void audit(int caseId,String action,int actor,String detail){HrRetireAuditLog row=new HrRetireAuditLog();row.case_id=caseId;row.action_type=action;row.actor_user_id=actor;row.detail=detail;row.created_at=now();entityManager.persist(row);}
    private Map<String,Object> severanceMap(HrSeveranceCalc c){Map<String,Object> employee=employeeById(c.employee_id);return map("id",c.id,"retire_case_id",c.retire_case_id,"employee_id",c.employee_id,"employee_no",employee.get("employee_no"),"employee_name",employee.get("display_name"),"department_name",employee.get("department_name"),"hire_date",c.hire_date,"retire_date",c.retire_date,"service_days",c.service_days,"avg_wage_base_from",c.avg_wage_base_from,"avg_wage_base_to",c.avg_wage_base_to,"wage_total_3m",c.wage_total_3m,"base_days_3m",c.base_days_3m,"avg_daily_wage",c.avg_daily_wage,"severance_amount",c.severance_amount,"adjustment_amount",c.adjustment_amount,"adjustment_reason",c.adjustment_reason,"final_amount",c.final_amount,"status",c.status,"warning",c.warning,"calculated_at",c.calculated_at,"confirmed_by",c.confirmed_by,"confirmed_at",c.confirmed_at,"service_years",c.service_years,"income_tax",c.income_tax,"local_income_tax",c.local_income_tax,"net_severance",c.net_severance,"created_at",c.created_at,"updated_at",c.updated_at);}

    private static Map<String,Object> map(Object... values){Map<String,Object> map=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)map.put((String)values[i],values[i+1]);return map;}
    private static String textValue(String value,String fallback){return present(value)?value:fallback;}
    private static boolean present(String value){return value!=null&&!value.trim().isEmpty();}
    private static String emptyNull(String value){return present(value)?value.trim():null;}
    private static int integer(Object value){return ((Number)value).intValue();}
    private static double number(Object value){return ((Number)value).doubleValue();}
    private static LocalDate localDate(Object value){if(value instanceof LocalDate date)return date;return LocalDate.parse(value.toString());}
    private static boolean contains(String actual,String expected){return actual!=null&&expected!=null&&actual.toLowerCase(Locale.ROOT).contains(expected.trim().toLowerCase(Locale.ROOT));}
    private static boolean matches(Map<String,Object> row,String employeeNo,String name,String department,String status){return(!present(employeeNo)||contains((String)row.get("employee_no"),employeeNo))&&(!present(name)||contains((String)row.get("display_name"),name))&&(!present(department)||contains((String)row.get("department_name"),department))&&(!present(status)||status.equals(row.get("employment_status")));}
    private static <T> List<T> page(List<T> values,int page,int limit){int start=Math.max(0,(page-1)*limit);return start>=values.size()?List.of():values.subList(start,Math.min(values.size(),start+limit));}
    private Instant now(){return Instant.now();}
    private LocalDate businessToday(){return LocalDate.now(ZoneId.of("Asia/Seoul"));}
    private static String appendWarning(String current,String addition){if(!present(addition))return current;return present(current)?current+" "+addition:addition;}
    private boolean exists(String sql,Object value){return !entityManager.createNativeQuery(sql).setParameter("value",value).getResultList().isEmpty();}
    private boolean exists(String sql,Object value,String parameter,Object parameterValue){return !entityManager.createNativeQuery(sql).setParameter("value",value).setParameter(parameter,parameterValue).getResultList().isEmpty();}
    private boolean exists(String sql,Object value,String parameter1,Object parameterValue1,String parameter2,Object parameterValue2){return !entityManager.createNativeQuery(sql).setParameter("value",value).setParameter(parameter1,parameterValue1).setParameter(parameter2,parameterValue2).getResultList().isEmpty();}
    private List<Object[]> rows(String sql,Map<String,Object> params,Integer page,Integer limit){var query=entityManager.createNativeQuery(sql);params.forEach(query::setParameter);if(page!=null&&limit!=null){query.setFirstResult(Math.max(0,(page-1)*limit));query.setMaxResults(limit);}@SuppressWarnings("unchecked")List<Object[]> result=query.getResultList();return result;}
    private long count(String sql,Map<String,Object> params){var query=entityManager.createNativeQuery("select count(*) from ("+sql+") count_query");params.forEach(query::setParameter);return ((Number)query.getSingleResult()).longValue();}
    private void like(StringBuilder sql,Map<String,Object> params,String column,String parameter,String value){if(present(value)){sql.append(" and lower(").append(column).append(") like :").append(parameter);params.put(parameter,"%"+value.trim().toLowerCase(Locale.ROOT)+"%");}}
}
