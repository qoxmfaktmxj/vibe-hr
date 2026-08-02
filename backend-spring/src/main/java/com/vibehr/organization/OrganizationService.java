package com.vibehr.organization;

import static com.vibehr.organization.OrganizationContracts.*;

import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application transaction boundary for the complete ORG migration. */
@Service
public class OrganizationService {
    private static final LocalDate OPEN_END = LocalDate.of(9999, 12, 31);
    private static final String MAPPING_TYPE_GROUP = "ORG_MAPPING_TYPE";
    private static final int PERSONAL_STATUS_CHUNK_SIZE = 200;
    private static final Set<String> EDITABLE_PLAN_STATUSES = Set.of("draft", "reviewing", "cancelled");
    private static final Set<String> PLAN_ACTIONS = Set.of("move", "rename", "create", "deactivate", "reactivate");

    private final EntityManager entityManager;
    private final OrganizationReferenceReadMapper references;

    public OrganizationService(EntityManager entityManager, OrganizationReferenceReadMapper references) {
        this.entityManager = entityManager;
        this.references = references;
    }

    @Transactional(readOnly = true)
    public CorporationListResponse corporations(int page, int limit, boolean all, String enterCd, String companyCode, String corporationName) {
        List<OrgCorporation> rows = entityManager.createQuery("select c from OrgCorporation c order by c.enterCd, c.companyCode", OrgCorporation.class)
                .getResultList().stream()
                .filter(c -> contains(c.enterCd, enterCd) && contains(c.companyCode, companyCode) && contains(c.corporationName, corporationName))
                .toList();
        List<CorporationItem> items = rows.stream().map(this::corporationItem).toList();
        return new CorporationListResponse(all ? items : page(items, page, limit), items.size(), all ? null : page, all ? null : limit);
    }

    @Transactional
    public CorporationDetailResponse createCorporation(CorporationCreateRequest request) {
        String enterCd = code(request.enterCd());
        String companyCode = code(request.companyCode());
        if (exists("select c.id from OrgCorporation c where c.enterCd = :value", enterCd)) throw ApiException.conflict("enter_cd already exists.");
        if (exists("select c.id from OrgCorporation c where c.companyCode = :value", companyCode)) throw ApiException.conflict("company_code already exists.");
        Instant now = now();
        OrgCorporation row = new OrgCorporation();
        row.enterCd = enterCd;
        row.companyCode = companyCode;
        row.corporationName = requiredTrim(request.corporationName());
        row.corporationNumber = nullable(request.corporationNumber());
        row.businessNumber = nullable(request.businessNumber());
        row.companySealUrl = nullable(request.companySealUrl());
        row.certificateSealUrl = nullable(request.certificateSealUrl());
        row.companyLogoUrl = nullable(request.companyLogoUrl());
        row.active = request.isActive() == null || request.isActive();
        row.createdAt = now;
        row.updatedAt = now;
        persistConflict(row, "Corporation conflict.");
        return new CorporationDetailResponse(corporationItem(row));
    }

    @Transactional
    public CorporationDetailResponse updateCorporation(long corporationId, CorporationUpdateRequest patch) {
        OrgCorporation row = corporation(corporationId, LockModeType.PESSIMISTIC_WRITE);
        if (patch.enterCd() != null) {
            String next = code(patch.enterCd());
            if (existsExcluding("select c.id from OrgCorporation c where c.enterCd = :value", next, row.id, "c")) throw ApiException.conflict("enter_cd already exists.");
            row.enterCd = next;
        }
        if (patch.companyCode() != null) {
            String next = code(patch.companyCode());
            if (existsExcluding("select c.id from OrgCorporation c where c.companyCode = :value", next, row.id, "c")) throw ApiException.conflict("company_code already exists.");
            row.companyCode = next;
        }
        if (patch.corporationName() != null) row.corporationName = requiredTrim(patch.corporationName());
        if (patch.corporationNumber() != null) row.corporationNumber = nullable(patch.corporationNumber());
        if (patch.businessNumber() != null) row.businessNumber = nullable(patch.businessNumber());
        if (patch.companySealUrl() != null) row.companySealUrl = nullable(patch.companySealUrl());
        if (patch.certificateSealUrl() != null) row.certificateSealUrl = nullable(patch.certificateSealUrl());
        if (patch.companyLogoUrl() != null) row.companyLogoUrl = nullable(patch.companyLogoUrl());
        if (patch.isActive() != null) row.active = patch.isActive();
        row.updatedAt = now();
        flushConflict("Corporation conflict.");
        return new CorporationDetailResponse(corporationItem(row));
    }

    @Transactional
    public void deleteCorporation(long corporationId) {
        entityManager.remove(corporation(corporationId, LockModeType.PESSIMISTIC_WRITE));
        flushConflict("Corporation conflict.");
    }

    @Transactional(readOnly = true)
    public DepartmentListResponse departments(int page, int limit, boolean all, String code, String name, String organizationType,
                                              String costCenterCode, LocalDate referenceDate) {
        List<DepartmentItem> items = departmentItems(entityManager.createQuery("select d from OrgDepartment d order by d.code", OrgDepartment.class)
                .getResultList().stream()
                .filter(d -> contains(d.code, code) && contains(d.name, name) && contains(d.organizationType, organizationType)
                        && contains(d.costCenterCode, costCenterCode)).toList());
        return new DepartmentListResponse(all ? items : page(items, page, limit), items.size(), referenceDate,
                all ? null : page, all ? null : limit);
    }

    @Transactional(readOnly = true)
    public ChartResponse chart() {
        List<DepartmentItem> items = departmentItems(entityManager.createQuery("select d from OrgDepartment d order by d.code", OrgDepartment.class).getResultList());
        return new ChartResponse(items, items.size());
    }

    @Transactional
    public DepartmentDetailResponse createDepartment(DepartmentCreateRequest request) {
        String nextCode = requiredTrim(request.code());
        if (exists("select d.id from OrgDepartment d where d.code = :value", nextCode)) throw ApiException.conflict("code already exists.");
        Integer parentId = IntegerId.optional(request.parentId(), "parent_id");
        departmentOrNull(parentId, LockModeType.PESSIMISTIC_READ);
        Instant now = now();
        OrgDepartment row = new OrgDepartment();
        row.code = nextCode;
        row.name = requiredTrim(request.name());
        row.parentId = parentId;
        row.organizationType = nullable(request.organizationType());
        row.costCenterCode = nullable(request.costCenterCode());
        row.description = nullable(request.description());
        row.active = request.isActive() == null || request.isActive();
        row.createdAt = now;
        row.updatedAt = now;
        persistConflict(row, "Department conflict.");
        return new DepartmentDetailResponse(departmentItem(row, Map.of(), Map.of()));
    }

    @Transactional
    public DepartmentDetailResponse updateDepartment(long departmentId, DepartmentUpdateRequest patch, long changedBy) {
        OrgDepartment row = department(departmentId, LockModeType.PESSIMISTIC_WRITE);
        if (patch.code() != null) {
            String next = requiredTrim(patch.code());
            if (existsExcluding("select d.id from OrgDepartment d where d.code = :value", next, row.id, "d")) throw ApiException.conflict("code already exists.");
            recordChange(row.id, changedBy, "code", row.code, next, null);
            row.code = next;
        }
        if (patch.name() != null) {
            String next = requiredTrim(patch.name());
            recordChange(row.id, changedBy, "name", row.name, next, null);
            row.name = next;
        }
        if (patch.organizationType() != null) {
            String next = nullable(patch.organizationType());
            recordChange(row.id, changedBy, "organization_type", row.organizationType, next, null);
            row.organizationType = next;
        }
        if (patch.costCenterCode() != null) {
            String next = nullable(patch.costCenterCode());
            recordChange(row.id, changedBy, "cost_center_code", row.costCenterCode, next, null);
            row.costCenterCode = next;
        }
        if (patch.description() != null) row.description = nullable(patch.description());
        if (patch.has("parent_id")) {
            Integer next = IntegerId.optional(patch.parentId(), "parent_id");
            if (Objects.equals(next, row.id)) throw ApiException.badRequest("Department cannot be its own parent.");
            departmentOrNull(next, LockModeType.PESSIMISTIC_READ);
            ensureNoCycle(row.id, next);
            recordChange(row.id, changedBy, "parent_id", legacyNullable(row.parentId), legacyNullable(next), null);
            row.parentId = next;
        }
        if (patch.isActive() != null) {
            boolean next = patch.isActive();
            recordChange(row.id, changedBy, "is_active", legacyBoolean(row.active), legacyBoolean(next), null);
            row.active = next;
        }
        row.updatedAt = now();
        flushConflict("Department conflict.");
        return new DepartmentDetailResponse(departmentItem(row, parentNames(), employeeCounts()));
    }

    @Transactional
    public void deleteDepartment(long departmentId) {
        OrgDepartment row = department(departmentId, LockModeType.PESSIMISTIC_WRITE);
        if (count("select count(d) from OrgDepartment d where d.parentId = :id", IntegerId.required(departmentId, "department_id")) > 0) {
            throw ApiException.conflict("Cannot delete department with child departments.");
        }
        if (references.employeeCountForDepartment(IntegerId.required(departmentId, "department_id")) > 0) {
            throw ApiException.conflict("Cannot delete department linked to employees.");
        }
        entityManager.remove(row);
        flushConflict("Department conflict.");
    }

    @Transactional(readOnly = true)
    public LookupItemsResponse mappingTypes() {
        return new LookupItemsResponse(mappingTypeLookups());
    }

    @Transactional(readOnly = true)
    public LookupItemsResponse mappingTypeOptions() {
        return new LookupItemsResponse(mappingTypeLookups());
    }

    @Transactional(readOnly = true)
    public LookupItemsResponse mappingItemOptions(String typeCode) {
        String normalized = code(typeCode);
        List<LookupItem> items = entityManager.createQuery("select i from OrgMappingTypeItem i where i.typeCode = :type and i.active = true order by i.sortOrder, i.id", OrgMappingTypeItem.class)
                .setParameter("type", normalized).getResultList().stream().map(i -> new LookupItem(i.id.longValue(), i.itemCode, i.name)).toList();
        return new LookupItemsResponse(items);
    }

    @Transactional(readOnly = true)
    public LookupItemsResponse departmentOptions() {
        return new LookupItemsResponse(entityManager.createQuery("select d from OrgDepartment d where d.active = true order by d.code", OrgDepartment.class)
                .getResultList().stream().map(d -> new LookupItem(d.id.longValue(), d.code, d.name)).toList());
    }

    @Transactional(readOnly = true)
    public MappingTypeItemListResponse mappingTypeItems(int page, int limit, String typeCode, LocalDate referenceDate) {
        List<MappingTypeItem> items = entityManager.createQuery("select i from OrgMappingTypeItem i order by i.typeCode, i.sortOrder, i.itemCode, i.effectiveFrom, i.id", OrgMappingTypeItem.class)
                .getResultList().stream().filter(i -> (typeCode == null || i.typeCode.equals(code(typeCode))) && activeAt(i.effectiveFrom, i.effectiveTo, referenceDate))
                .map(this::mappingTypeItem).toList();
        return new MappingTypeItemListResponse(page(items, page, limit), items.size(), page, limit);
    }

    @Transactional
    public MappingTypeItemDetailResponse createMappingTypeItem(MappingTypeItemCreateRequest request) {
        String typeCode = code(request.typeCode());
        String itemCode = code(request.itemCode());
        LocalDate effectiveFrom = requiredDate(request.effectiveFrom(), "effective_from is required.");
        validatePeriod(effectiveFrom, request.effectiveTo());
        lockMappingItemGroup(typeCode, itemCode);
        ensureNoItemOverlap(typeCode, itemCode, effectiveFrom, request.effectiveTo(), null);
        Instant now = now();
        OrgMappingTypeItem row = new OrgMappingTypeItem();
        row.typeCode = typeCode;
        row.itemCode = itemCode;
        row.name = requiredTrim(request.name());
        row.effectiveFrom = effectiveFrom;
        row.effectiveTo = request.effectiveTo();
        row.erpEmployeeCode = nullable(request.erpEmployeeCode());
        row.costCenterType = nullable(request.costCenterType());
        row.remark = nullable(request.remark());
        row.sortOrder = request.sortOrder() == null ? 0 : request.sortOrder();
        row.active = request.isActive() == null || request.isActive();
        row.createdAt = now;
        row.updatedAt = now;
        persistConflict(row, "Mapping item conflict.");
        return new MappingTypeItemDetailResponse(mappingTypeItem(row));
    }

    @Transactional
    public MappingTypeItemDetailResponse updateMappingTypeItem(long itemId, MappingTypeItemUpdateRequest patch) {
        OrgMappingTypeItem row = mappingItem(itemId, LockModeType.PESSIMISTIC_WRITE);
        String nextType = patch.typeCode() != null ? code(patch.typeCode()) : row.typeCode;
        String nextItem = patch.itemCode() != null ? code(patch.itemCode()) : row.itemCode;
        LocalDate nextFrom = patch.effectiveFrom() != null ? patch.effectiveFrom() : row.effectiveFrom;
        LocalDate nextTo = patch.has("effective_to") ? patch.effectiveTo() : row.effectiveTo;
        validatePeriod(nextFrom, nextTo);
        lockMappingItemGroup(nextType, nextItem);
        ensureNoItemOverlap(nextType, nextItem, nextFrom, nextTo, row.id);
        if (hasAssignments(row.id)) {
            if (!nextType.equals(row.typeCode) || !nextItem.equals(row.itemCode)) throw ApiException.conflict("Referenced mapping item type_code/item_code cannot be changed.");
            if (!itemPeriodContainsAssignments(row.id, nextFrom, nextTo)) throw ApiException.conflict("Referenced mapping item period must contain existing assignments.");
            if (Boolean.FALSE.equals(patch.isActive())) throw ApiException.conflict("Referenced mapping item cannot be deactivated.");
        }
        row.typeCode = nextType;
        row.itemCode = nextItem;
        if (patch.name() != null) row.name = requiredTrim(patch.name());
        row.effectiveFrom = nextFrom;
        row.effectiveTo = nextTo;
        if (patch.has("erp_employee_code")) row.erpEmployeeCode = nullable(patch.erpEmployeeCode());
        if (patch.has("cost_center_type")) row.costCenterType = nullable(patch.costCenterType());
        if (patch.sortOrder() != null) row.sortOrder = patch.sortOrder();
        if (patch.has("remark")) row.remark = nullable(patch.remark());
        if (patch.isActive() != null) row.active = patch.isActive();
        row.updatedAt = now();
        flushConflict("Mapping item conflict.");
        return new MappingTypeItemDetailResponse(mappingTypeItem(row));
    }

    @Transactional
    public void deleteMappingTypeItem(long itemId) {
        OrgMappingTypeItem row = mappingItem(itemId, LockModeType.PESSIMISTIC_WRITE);
        if (hasAssignments(row.id)) throw ApiException.conflict("Referenced mapping item cannot be deleted.");
        entityManager.remove(row);
        flushConflict("Mapping item conflict.");
    }

    @Transactional(readOnly = true)
    public MappingAssignmentListResponse mappingAssignments(int page, int limit, Long departmentId, String typeCode, LocalDate referenceDate) {
        Integer filterDepartmentId = IntegerId.optional(departmentId, "department_id");
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createQuery("""
                select a, d, i from OrgMappingAssignment a
                join OrgDepartment d on d.id = a.departmentId
                join OrgMappingTypeItem i on i.id = a.itemId and i.typeCode = a.typeCode
                """, Object[].class).getResultList();
        List<MappingAssignmentItem> items = rows.stream()
                .filter(row -> filterDepartmentId == null || ((OrgMappingAssignment) row[0]).departmentId.equals(filterDepartmentId))
                .filter(row -> typeCode == null || ((OrgMappingAssignment) row[0]).typeCode.equals(code(typeCode)))
                .filter(row -> activeAt(((OrgMappingAssignment) row[0]).effectiveFrom, ((OrgMappingAssignment) row[0]).effectiveTo, referenceDate))
                .sorted(Comparator.comparing((Object[] row) -> ((OrgDepartment) row[1]).code)
                        .thenComparing(row -> ((OrgMappingAssignment) row[0]).typeCode)
                        .thenComparing(row -> ((OrgMappingAssignment) row[0]).effectiveFrom)
                        .thenComparing(row -> ((OrgMappingAssignment) row[0]).id))
                .map(row -> mappingAssignmentItem((OrgMappingAssignment) row[0], (OrgDepartment) row[1], (OrgMappingTypeItem) row[2])).toList();
        return new MappingAssignmentListResponse(page(items, page, limit), items.size(), page, limit);
    }

    @Transactional
    public MappingAssignmentDetailResponse createMappingAssignment(MappingAssignmentCreateRequest request) {
        String typeCode = code(request.typeCode());
        OrgDepartment department = department(request.departmentId(), LockModeType.PESSIMISTIC_READ);
        OrgMappingTypeItem item = assignmentItem(request.itemId(), typeCode);
        LocalDate effectiveFrom = requiredDate(request.effectiveFrom(), "effective_from is required.");
        validatePeriod(effectiveFrom, request.effectiveTo());
        validateAssignmentWithinItem(item, effectiveFrom, request.effectiveTo());
        lockAssignmentGroup(department.id, typeCode);
        ensureNoAssignmentOverlap(department.id, typeCode, effectiveFrom, request.effectiveTo(), null);
        Instant now = now();
        OrgMappingAssignment row = new OrgMappingAssignment();
        row.departmentId = department.id;
        row.typeCode = typeCode;
        row.itemId = item.id;
        row.effectiveFrom = effectiveFrom;
        row.effectiveTo = request.effectiveTo();
        row.createdAt = now;
        row.updatedAt = now;
        persistConflict(row, "Mapping assignment conflict.");
        return new MappingAssignmentDetailResponse(mappingAssignmentItem(row, department, item));
    }

    @Transactional
    public MappingAssignmentDetailResponse updateMappingAssignment(long assignmentId, MappingAssignmentUpdateRequest patch) {
        OrgMappingAssignment row = assignment(assignmentId, LockModeType.PESSIMISTIC_WRITE);
        int nextDepartmentId = patch.departmentId() != null ? IntegerId.required(patch.departmentId(), "department_id") : row.departmentId;
        String nextType = patch.typeCode() != null ? code(patch.typeCode()) : row.typeCode;
        int nextItemId = patch.itemId() != null ? IntegerId.required(patch.itemId(), "item_id") : row.itemId;
        LocalDate nextFrom = patch.effectiveFrom() != null ? patch.effectiveFrom() : row.effectiveFrom;
        LocalDate nextTo = patch.has("effective_to") ? patch.effectiveTo() : row.effectiveTo;
        OrgDepartment department = department(nextDepartmentId, LockModeType.PESSIMISTIC_READ);
        OrgMappingTypeItem item = assignmentItem(nextItemId, nextType);
        validatePeriod(nextFrom, nextTo);
        validateAssignmentWithinItem(item, nextFrom, nextTo);
        lockAssignmentGroup(nextDepartmentId, nextType);
        ensureNoAssignmentOverlap(nextDepartmentId, nextType, nextFrom, nextTo, row.id);
        row.departmentId = department.id;
        row.typeCode = nextType;
        row.itemId = item.id;
        row.effectiveFrom = nextFrom;
        row.effectiveTo = nextTo;
        row.updatedAt = now();
        flushConflict("Mapping assignment conflict.");
        return new MappingAssignmentDetailResponse(mappingAssignmentItem(row, department, item));
    }

    @Transactional
    public void deleteMappingAssignment(long assignmentId) {
        entityManager.remove(assignment(assignmentId, LockModeType.PESSIMISTIC_WRITE));
        flushConflict("Mapping assignment conflict.");
    }

    @Transactional(readOnly = true)
    public MappingAssignmentUploadPreviewResponse previewUpload(List<MappingAssignmentUploadRow> rows) {
        return validateUpload(rows).preview();
    }

    @Transactional
    public MappingAssignmentUploadConfirmResponse confirmUpload(List<MappingAssignmentUploadRow> rows, long actorId) {
        int actor = IntegerId.required(actorId, "actor_id");
        UploadValidation initial = validateUpload(rows);
        if (initial.preview().invalidCount() > 0) throw uploadValidation(initial.preview());
        for (PreparedUploadRow prepared : initial.prepared()) lockAssignmentGroup(prepared.department.id, prepared.typeCode);
        UploadValidation validation = validateUpload(rows);
        if (validation.preview().invalidCount() > 0) throw uploadValidation(validation.preview());
        int inserted = 0;
        int updated = 0;
        Instant now = now();
        try {
            for (PreparedUploadRow prepared : validation.prepared()) {
                if (prepared.existing == null) {
                    OrgMappingAssignment row = new OrgMappingAssignment();
                    row.departmentId = prepared.department.id;
                    row.typeCode = prepared.typeCode;
                    row.itemId = prepared.item.id;
                    row.effectiveFrom = prepared.effectiveFrom;
                    row.effectiveTo = prepared.effectiveTo;
                    row.createdBy = actor;
                    row.updatedBy = actor;
                    row.createdAt = now;
                    row.updatedAt = now;
                    entityManager.persist(row);
                    inserted++;
                } else {
                    prepared.existing.itemId = prepared.item.id;
                    prepared.existing.effectiveTo = prepared.effectiveTo;
                    prepared.existing.updatedBy = actor;
                    prepared.existing.updatedAt = now;
                    updated++;
                }
            }
            entityManager.flush();
        } catch (PersistenceException exception) {
            throw uploadValidation(overlapPreview(rows));
        }
        return new MappingAssignmentUploadConfirmResponse(inserted, updated);
    }

    @Transactional(readOnly = true)
    public PersonalStatusListResponse personalStatus(LocalDate referenceDate, int page, int limit) {
        List<PersonalStatusTypeColumn> typeColumns = mappingTypeLookups().stream().map(row -> new PersonalStatusTypeColumn(row.code(), row.name())).toList();
        List<Long> candidateIds = references.employeeIdsHiredOnOrBefore(referenceDate);
        List<PersonalSnapshot> active = new ArrayList<>();
        for (int start = 0; start < candidateIds.size(); start += PERSONAL_STATUS_CHUNK_SIZE) {
            List<Long> ids = candidateIds.subList(start, Math.min(candidateIds.size(), start + PERSONAL_STATUS_CHUNK_SIZE));
            active.addAll(loadSnapshots(ids, referenceDate).stream().filter(snapshot -> "active".equals(snapshot.employmentStatus)).toList());
        }
        List<PersonalSnapshot> selected = page(active, page, limit);
        Set<Long> departmentIds = selected.stream().map(snapshot -> snapshot.departmentId).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Map<Long, OrgDepartment> departments = departmentsById(departmentIds);
        Map<String, PersonalStatusCell> mappings = personalStatusMappings(departmentIds, referenceDate);
        List<PersonalStatusRow> rows = selected.stream().map(snapshot -> {
            OrgDepartment department = departments.get(snapshot.departmentId);
            Map<String, PersonalStatusCell> cells = new LinkedHashMap<>();
            for (PersonalStatusTypeColumn column : typeColumns) {
                cells.put(column.typeCode(), mappings.getOrDefault(snapshot.departmentId + "|" + column.typeCode(), new PersonalStatusCell("", "")));
            }
            return new PersonalStatusRow(snapshot.employeeId, snapshot.employeeNo, snapshot.displayName, snapshot.departmentId,
                    department == null ? "" : department.code, department == null ? "" : department.name, snapshot.positionTitle, cells);
        }).toList();
        return new PersonalStatusListResponse(rows, typeColumns, active.size(), page, limit);
    }

    @Transactional(readOnly = true)
    public DeptChangeHistoryListResponse deptHistory(Long departmentId, int limit) {
        Integer filterDepartmentId = IntegerId.optional(departmentId, "department_id");
        List<OrgDeptChangeHistory> rows = entityManager.createQuery("select h from OrgDeptChangeHistory h order by h.changedAt desc", OrgDeptChangeHistory.class)
                .getResultList().stream().filter(h -> filterDepartmentId == null || h.departmentId.equals(filterDepartmentId)).limit(limit).toList();
        return new DeptChangeHistoryListResponse(rows.stream().map(this::historyItem).toList(), rows.size());
    }

    @Transactional(readOnly = true)
    public RestructurePlanListResponse restructurePlans(String status) {
        List<RestructurePlanItem> items = entityManager.createQuery("select p from OrgRestructurePlan p order by p.createdAt desc", OrgRestructurePlan.class)
                .getResultList().stream().filter(p -> status == null || status.equals(p.status)).map(this::planItem).toList();
        return new RestructurePlanListResponse(items, items.size());
    }

    @Transactional
    public RestructurePlanItem createRestructurePlan(RestructurePlanCreateRequest request, long userId) {
        Instant now = now();
        OrgRestructurePlan plan = new OrgRestructurePlan();
        plan.title = requiredTrim(request.title());
        plan.description = request.description();
        plan.plannedDate = request.plannedDate();
        plan.status = "draft";
        plan.createdBy = IntegerId.required(userId, "user_id");
        plan.createdAt = now;
        plan.updatedAt = now;
        persistConflict(plan, "Restructure plan conflict.");
        return planItem(plan);
    }

    @Transactional
    public RestructurePlanItem updateRestructurePlan(long planId, RestructurePlanUpdateRequest patch) {
        OrgRestructurePlan plan = plan(planId, LockModeType.PESSIMISTIC_WRITE);
        if ("applied".equals(plan.status) || "cancelled".equals(plan.status)) {
            throw ApiException.conflict("이미 적용됐거나 취소된 개편안은 수정할 수 없습니다.");
        }
        if (patch.title() != null) plan.title = requiredTrim(patch.title());
        if (patch.description() != null) plan.description = patch.description();
        if (patch.plannedDate() != null) plan.plannedDate = patch.plannedDate();
        if (patch.status() != null) {
            String next = patch.status();
            if (!EDITABLE_PLAN_STATUSES.contains(next)) {
                throw ApiException.badRequest("상태는 draft/reviewing/cancelled만 직접 변경 가능합니다.");
            }
            plan.status = next;
        }
        plan.updatedAt = now();
        flushConflict("Restructure plan conflict.");
        return planItem(plan);
    }

    @Transactional
    public void deleteRestructurePlan(long planId) {
        OrgRestructurePlan plan = plan(planId, LockModeType.PESSIMISTIC_WRITE);
        if ("applied".equals(plan.status)) throw ApiException.conflict("이미 적용된 개편안은 삭제할 수 없습니다.");
        entityManager.createQuery("delete from OrgRestructurePlanItem i where i.planId = :id").setParameter("id", IntegerId.required(planId, "plan_id")).executeUpdate();
        entityManager.remove(plan);
        flushConflict("Restructure plan conflict.");
    }

    @Transactional(readOnly = true)
    public RestructurePlanItemListResponse restructurePlanItems(long planId) {
        plan(planId, LockModeType.NONE);
        List<RestructurePlanItemDetail> items = entityManager.createQuery("select i from OrgRestructurePlanItem i where i.planId = :id order by i.sortOrder, i.id", OrgRestructurePlanItem.class)
                .setParameter("id", IntegerId.required(planId, "plan_id")).getResultList().stream().map(this::planItemDetail).toList();
        return new RestructurePlanItemListResponse(items, items.size());
    }

    @Transactional
    public RestructurePlanItemDetail addRestructurePlanItem(long planId, RestructurePlanItemCreateRequest request) {
        OrgRestructurePlan plan = plan(planId, LockModeType.PESSIMISTIC_WRITE);
        ensurePlanEditable(plan);
        validatePlanItem(request.actionType(), request.targetDeptId(), request.newParentId(), request.newName(), request.newCode());
        Instant now = now();
        OrgRestructurePlanItem row = new OrgRestructurePlanItem();
        row.planId = plan.id;
        row.actionType = request.actionType();
        row.targetDeptId = IntegerId.optional(request.targetDeptId(), "target_dept_id");
        row.newParentId = IntegerId.optional(request.newParentId(), "new_parent_id");
        row.newName = request.newName();
        row.newCode = request.newCode();
        row.newOrganizationType = request.newOrganizationType();
        row.newCostCenterCode = request.newCostCenterCode();
        row.sortOrder = request.sortOrder() == null ? 0 : request.sortOrder();
        row.itemStatus = "pending";
        row.memo = request.memo();
        row.createdAt = now;
        row.updatedAt = now;
        persistConflict(row, "Restructure plan item conflict.");
        return planItemDetail(row);
    }

    @Transactional
    public RestructurePlanItemDetail updateRestructurePlanItem(long planId, long itemId, RestructurePlanItemUpdateRequest patch) {
        OrgRestructurePlan plan = plan(planId, LockModeType.PESSIMISTIC_WRITE);
        ensurePlanEditable(plan);
        OrgRestructurePlanItem row = planItemEntity(itemId, LockModeType.PESSIMISTIC_WRITE);
        if (!row.planId.equals(IntegerId.required(planId, "plan_id"))) throw ApiException.notFound("항목을 찾을 수 없습니다.");
        if ("applied".equals(row.itemStatus)) throw ApiException.conflict("이미 적용된 항목은 수정할 수 없습니다.");
        if (patch.actionType() != null) row.actionType = patch.actionType();
        if (patch.targetDeptId() != null) row.targetDeptId = IntegerId.required(patch.targetDeptId(), "target_dept_id");
        if (patch.newParentId() != null) row.newParentId = IntegerId.required(patch.newParentId(), "new_parent_id");
        if (patch.newName() != null) row.newName = patch.newName();
        if (patch.newCode() != null) row.newCode = patch.newCode();
        if (patch.newOrganizationType() != null) row.newOrganizationType = patch.newOrganizationType();
        if (patch.newCostCenterCode() != null) row.newCostCenterCode = patch.newCostCenterCode();
        if (patch.sortOrder() != null) row.sortOrder = patch.sortOrder();
        if (patch.memo() != null) row.memo = patch.memo();
        row.updatedAt = now();
        flushConflict("Restructure plan item conflict.");
        return planItemDetail(row);
    }

    @Transactional
    public void deleteRestructurePlanItem(long planId, long itemId) {
        OrgRestructurePlan plan = plan(planId, LockModeType.PESSIMISTIC_WRITE);
        ensurePlanEditable(plan);
        OrgRestructurePlanItem row = planItemEntity(itemId, LockModeType.PESSIMISTIC_WRITE);
        if (!row.planId.equals(IntegerId.required(planId, "plan_id"))) throw ApiException.notFound("항목을 찾을 수 없습니다.");
        entityManager.remove(row);
        flushConflict("Restructure plan item conflict.");
    }

    @Transactional
    public RestructureApplyResponse applyRestructurePlan(long planId, long userId) {
        OrgRestructurePlan plan = plan(planId, LockModeType.PESSIMISTIC_WRITE);
        if ("applied".equals(plan.status)) throw ApiException.conflict("이미 적용된 개편안입니다.");
        if ("cancelled".equals(plan.status)) throw ApiException.conflict("취소된 개편안은 적용할 수 없습니다.");
        List<OrgRestructurePlanItem> pending = entityManager.createQuery("select i from OrgRestructurePlanItem i where i.planId = :id and i.itemStatus = 'pending' order by i.sortOrder, i.id", OrgRestructurePlanItem.class)
                .setParameter("id", IntegerId.required(planId, "plan_id")).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        Instant now = now();
        int applied = 0;
        int skipped = 0;
        List<String> messages = new ArrayList<>();
        for (OrgRestructurePlanItem item : pending) {
            try {
                String message = applyPlanItem(item, userId, now);
                item.itemStatus = "applied";
                item.appliedAt = now;
                applied++;
                if (message != null) messages.add(message);
            } catch (ApiException exception) {
                item.itemStatus = "skipped";
                skipped++;
                messages.add("[SKIP] " + item.actionType + " id=" + item.id + ": " + exception.getMessage());
            }
        }
        plan.status = "applied";
        plan.appliedAt = now;
        plan.appliedBy = IntegerId.required(userId, "user_id");
        plan.updatedAt = now;
        flushConflict("Restructure apply conflict.");
        return new RestructureApplyResponse(planId, applied, skipped, messages);
    }

    private List<DepartmentItem> departmentItems(List<OrgDepartment> rows) {
        Map<Integer, String> parents = parentNames();
        Map<Integer, Long> counts = employeeCounts();
        return rows.stream().map(row -> departmentItem(row, parents, counts)).toList();
    }

    private DepartmentItem departmentItem(OrgDepartment row, Map<Integer, String> parents, Map<Integer, Long> counts) {
        return new DepartmentItem(row.id.longValue(), row.code, row.name, row.parentId == null ? null : row.parentId.longValue(), row.parentId == null ? null : parents.get(row.parentId),
                row.organizationType, row.costCenterCode, row.description, counts.getOrDefault(row.id, 0L), row.active, row.createdAt, row.updatedAt);
    }

    private Map<Integer, String> parentNames() {
        return entityManager.createQuery("select d from OrgDepartment d", OrgDepartment.class).getResultList().stream()
                .collect(java.util.stream.Collectors.toMap(d -> d.id, d -> d.name));
    }

    private Map<Integer, Long> employeeCounts() {
        Map<Integer, Long> counts = new HashMap<>();
        for (OrganizationReferenceReadMapper.DepartmentEmployeeCount row : references.employeeCountsByDepartment()) {
            counts.put(IntegerId.required(row.departmentId(), "department_id"), row.employeeCount());
        }
        return counts;
    }

    private CorporationItem corporationItem(OrgCorporation row) {
        return new CorporationItem(row.id.longValue(), row.enterCd, row.companyCode, row.corporationName, row.corporationNumber, row.businessNumber,
                row.companySealUrl, row.certificateSealUrl, row.companyLogoUrl, row.active, row.createdAt, row.updatedAt);
    }

    private MappingTypeItem mappingTypeItem(OrgMappingTypeItem row) {
        return new MappingTypeItem(row.id.longValue(), row.typeCode, row.itemCode, row.name, row.effectiveFrom, row.effectiveTo, row.erpEmployeeCode,
                row.costCenterType, row.remark, row.sortOrder, row.active, row.createdAt, row.updatedAt);
    }

    private MappingAssignmentItem mappingAssignmentItem(OrgMappingAssignment row, OrgDepartment department, OrgMappingTypeItem item) {
        return new MappingAssignmentItem(row.id.longValue(), department.id.longValue(), department.code, department.name, row.typeCode, item.id.longValue(), item.itemCode,
                item.name, row.effectiveFrom, row.effectiveTo, row.createdAt, row.updatedAt);
    }

    private List<LookupItem> mappingTypeLookups() {
        Integer groupId = references.activeCodeGroupId(MAPPING_TYPE_GROUP);
        if (groupId == null) return List.of();
        return references.activeCodes(groupId).stream().map(row -> new LookupItem(null, row.code(), row.name())).toList();
    }

    private OrgCorporation corporation(long id, LockModeType lock) {
        OrgCorporation row = entityManager.find(OrgCorporation.class, IntegerId.required(id, "corporation_id"), lock);
        if (row == null) throw ApiException.notFound("Corporation not found.");
        return row;
    }

    private OrgDepartment department(long id, LockModeType lock) {
        OrgDepartment row = entityManager.find(OrgDepartment.class, IntegerId.required(id, "department_id"), lock);
        if (row == null) throw ApiException.notFound("Department not found.");
        return row;
    }

    private OrgDepartment departmentOrNull(Integer id, LockModeType lock) {
        if (id == null) return null;
        OrgDepartment row = entityManager.find(OrgDepartment.class, id, lock);
        if (row == null) throw ApiException.badRequest("Invalid parent_id.");
        return row;
    }

    private OrgDepartment findDepartmentByCode(String code) {
        List<OrgDepartment> rows = entityManager.createQuery("select d from OrgDepartment d where upper(d.code) = :code", OrgDepartment.class)
                .setParameter("code", code).setMaxResults(1).getResultList();
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private OrgMappingTypeItem mappingItem(long id, LockModeType lock) {
        OrgMappingTypeItem row = entityManager.find(OrgMappingTypeItem.class, IntegerId.required(id, "item_id"), lock);
        if (row == null) throw ApiException.notFound("Mapping item not found.");
        return row;
    }

    private OrgMappingTypeItem assignmentItem(long itemId, String typeCode) {
        List<OrgMappingTypeItem> rows = entityManager.createQuery("select i from OrgMappingTypeItem i where i.id = :id and i.typeCode = :type", OrgMappingTypeItem.class)
                .setParameter("id", IntegerId.required(itemId, "item_id")).setParameter("type", typeCode).getResultList();
        if (rows.isEmpty()) throw ApiException.notFound("Mapping item not found.");
        if (!rows.getFirst().active) throw ApiException.conflict("Mapping item is inactive.");
        return rows.getFirst();
    }

    private OrgMappingAssignment assignment(long id, LockModeType lock) {
        OrgMappingAssignment row = entityManager.find(OrgMappingAssignment.class, IntegerId.required(id, "assignment_id"), lock);
        if (row == null) throw ApiException.notFound("Mapping assignment not found.");
        return row;
    }

    private void ensureNoCycle(int departmentId, Integer parentId) {
        Integer current = parentId;
        Set<Integer> visited = new HashSet<>();
        while (current != null) {
            if (current == departmentId) throw ApiException.badRequest("Cyclic parent relation is not allowed.");
            if (!visited.add(current)) return;
            OrgDepartment parent = entityManager.find(OrgDepartment.class, current);
            if (parent == null) return;
            current = parent.parentId;
        }
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (to != null && to.isBefore(from)) throw ApiException.unprocessable("effective_to must be on or after effective_from.");
    }

    private void lockMappingItemGroup(String typeCode, String itemCode) {
        entityManager.createNativeQuery("select id from org_mapping_type_items where type_code = :type and item_code = :item for update")
                .setParameter("type", typeCode).setParameter("item", itemCode).getResultList();
    }

    private void ensureNoItemOverlap(String typeCode, String itemCode, LocalDate from, LocalDate to, Integer excludedId) {
        List<Integer> conflicts = entityManager.createQuery("""
                select i.id from OrgMappingTypeItem i where i.typeCode = :type and i.itemCode = :item
                and i.effectiveFrom <= :end and coalesce(i.effectiveTo, :openEnd) >= :start
                and (:excludedId is null or i.id <> :excludedId)
                """, Integer.class).setParameter("type", typeCode).setParameter("item", itemCode)
                .setParameter("end", to == null ? OPEN_END : to).setParameter("openEnd", OPEN_END).setParameter("start", from)
                .setParameter("excludedId", excludedId).setMaxResults(1).getResultList();
        if (!conflicts.isEmpty()) throw ApiException.conflict("Mapping item period overlaps existing record.");
    }

    private boolean hasAssignments(int itemId) {
        return count("select count(a) from OrgMappingAssignment a where a.itemId = :id", itemId) > 0;
    }

    private boolean itemPeriodContainsAssignments(int itemId, LocalDate from, LocalDate to) {
        for (OrgMappingAssignment assignment : entityManager.createQuery("select a from OrgMappingAssignment a where a.itemId = :id", OrgMappingAssignment.class)
                .setParameter("id", itemId).getResultList()) {
            if (assignment.effectiveFrom.isBefore(from) || (to != null && (assignment.effectiveTo == null || assignment.effectiveTo.isAfter(to)))) return false;
        }
        return true;
    }

    private void validateAssignmentWithinItem(OrgMappingTypeItem item, LocalDate from, LocalDate to) {
        if (from.isBefore(item.effectiveFrom) || (item.effectiveTo != null && (to == null || to.isAfter(item.effectiveTo)))) {
            throw ApiException.conflict("Mapping assignment item period must contain the assignment period.");
        }
    }

    private void lockAssignmentGroup(int departmentId, String typeCode) {
        entityManager.createNativeQuery("select id from org_mapping_assignments where department_id = :departmentId and type_code = :type for update")
                .setParameter("departmentId", departmentId).setParameter("type", typeCode).getResultList();
    }

    private void ensureNoAssignmentOverlap(int departmentId, String typeCode, LocalDate from, LocalDate to, Integer excludedId) {
        List<Integer> conflicts = entityManager.createQuery("""
                select a.id from OrgMappingAssignment a where a.departmentId = :departmentId and a.typeCode = :type
                and a.effectiveFrom <= :end and coalesce(a.effectiveTo, :openEnd) >= :start
                and (:excludedId is null or a.id <> :excludedId)
                """, Integer.class).setParameter("departmentId", departmentId).setParameter("type", typeCode)
                .setParameter("end", to == null ? OPEN_END : to).setParameter("openEnd", OPEN_END).setParameter("start", from)
                .setParameter("excludedId", excludedId).setMaxResults(1).getResultList();
        if (!conflicts.isEmpty()) throw ApiException.conflict("Mapping assignment period overlaps existing record.");
    }

    private UploadValidation validateUpload(List<MappingAssignmentUploadRow> rows) {
        List<List<String>> errors = new ArrayList<>();
        List<PreparedUploadRow> prepared = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            MappingAssignmentUploadRow row = rows.get(index);
            List<String> rowErrors = new ArrayList<>();
            errors.add(rowErrors);
            String departmentCode = code(row.departmentCode());
            String typeCode = code(row.typeCode());
            String itemCode = code(row.itemCode());
            OrgDepartment department = findDepartmentByCode(departmentCode);
            if (department == null) rowErrors.add("Department code not found.");
            List<OrgMappingTypeItem> versions = entityManager.createQuery("select i from OrgMappingTypeItem i where i.typeCode = :type and i.itemCode = :item", OrgMappingTypeItem.class)
                    .setParameter("type", typeCode).setParameter("item", itemCode).getResultList();
            List<OrgMappingTypeItem> candidates = versions.stream().filter(item -> item.active && containsPeriod(item.effectiveFrom, item.effectiveTo, row.effectiveFrom(), row.effectiveTo())).toList();
            if (versions.isEmpty()) rowErrors.add("Mapping item code not found.");
            else if (versions.stream().noneMatch(item -> item.active)) rowErrors.add("Mapping item is inactive.");
            else if (candidates.isEmpty()) rowErrors.add("Mapping assignment item period must contain the assignment period.");
            else if (candidates.size() > 1) rowErrors.add("Mapping item period is ambiguous.");
            if (row.effectiveTo() != null && row.effectiveTo().isBefore(row.effectiveFrom())) rowErrors.add("effective_to must be on or after effective_from.");
            if (rowErrors.isEmpty()) prepared.add(new PreparedUploadRow(index, department, candidates.getFirst(), typeCode, row.effectiveFrom(), row.effectiveTo(), null));
        }
        Map<String, List<PreparedUploadRow>> groups = new LinkedHashMap<>();
        for (PreparedUploadRow row : prepared) groups.computeIfAbsent(row.department.id + "|" + row.typeCode, ignored -> new ArrayList<>()).add(row);
        for (List<PreparedUploadRow> group : groups.values()) validateUploadGroup(group, errors);
        List<MappingAssignmentUploadPreviewRow> previewRows = new ArrayList<>();
        int invalid = 0;
        for (int index = 0; index < rows.size(); index++) {
            MappingAssignmentUploadRow row = rows.get(index);
            List<String> rowErrors = errors.get(index);
            if (!rowErrors.isEmpty()) invalid++;
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("department_code", code(row.departmentCode()));
            normalized.put("type_code", code(row.typeCode()));
            normalized.put("item_code", code(row.itemCode()));
            normalized.put("effective_from", row.effectiveFrom());
            normalized.put("effective_to", row.effectiveTo());
            previewRows.add(new MappingAssignmentUploadPreviewRow(index + 1, rowErrors.isEmpty(), List.copyOf(rowErrors), normalized));
        }
        List<PreparedUploadRow> valid = prepared.stream().filter(row -> errors.get(row.rowIndex).isEmpty()).toList();
        return new UploadValidation(new MappingAssignmentUploadPreviewResponse(previewRows, rows.size() - invalid, invalid), valid);
    }

    private void validateUploadGroup(List<PreparedUploadRow> incoming, List<List<String>> errors) {
        PreparedUploadRow first = incoming.getFirst();
        List<OrgMappingAssignment> existing = entityManager.createQuery("select a from OrgMappingAssignment a where a.departmentId = :department and a.typeCode = :type", OrgMappingAssignment.class)
                .setParameter("department", first.department.id).setParameter("type", first.typeCode).getResultList();
        Map<LocalDate, List<OrgMappingAssignment>> existingStarts = new HashMap<>();
        Map<LocalDate, List<PreparedUploadRow>> incomingStarts = new HashMap<>();
        for (OrgMappingAssignment row : existing) existingStarts.computeIfAbsent(row.effectiveFrom, ignored -> new ArrayList<>()).add(row);
        for (PreparedUploadRow row : incoming) incomingStarts.computeIfAbsent(row.effectiveFrom, ignored -> new ArrayList<>()).add(row);
        for (List<PreparedUploadRow> sameStart : incomingStarts.values()) {
            if (sameStart.size() > 1) sameStart.forEach(row -> addError(errors.get(row.rowIndex), "Mapping assignment period overlaps another upload row."));
            List<OrgMappingAssignment> matching = existingStarts.getOrDefault(sameStart.getFirst().effectiveFrom, List.of());
            if (matching.size() > 1) sameStart.forEach(row -> addError(errors.get(row.rowIndex), "Mapping assignment period overlaps existing record."));
            else if (matching.size() == 1 && sameStart.size() == 1) sameStart.getFirst().existing = matching.getFirst();
        }
        List<Period> finalPeriods = new ArrayList<>();
        for (OrgMappingAssignment row : existing) {
            List<PreparedUploadRow> replacement = incomingStarts.get(row.effectiveFrom);
            if (replacement != null && replacement.size() == 1 && existingStarts.get(row.effectiveFrom).size() == 1) {
                PreparedUploadRow prepared = replacement.getFirst();
                finalPeriods.add(new Period(prepared.effectiveFrom, prepared.effectiveTo, prepared.rowIndex));
            } else finalPeriods.add(new Period(row.effectiveFrom, row.effectiveTo, null));
        }
        for (PreparedUploadRow row : incoming) if (!existingStarts.containsKey(row.effectiveFrom)) finalPeriods.add(new Period(row.effectiveFrom, row.effectiveTo, row.rowIndex));
        for (int left = 0; left < finalPeriods.size(); left++) for (int right = left + 1; right < finalPeriods.size(); right++) {
            Period a = finalPeriods.get(left);
            Period b = finalPeriods.get(right);
            if (!overlaps(a.from, a.to, b.from, b.to)) continue;
            String error = a.rowIndex != null && b.rowIndex != null ? "Mapping assignment period overlaps another upload row." : "Mapping assignment period overlaps existing record.";
            if (a.rowIndex != null) addError(errors.get(a.rowIndex), error);
            if (b.rowIndex != null) addError(errors.get(b.rowIndex), error);
        }
    }

    private MappingAssignmentUploadPreviewResponse overlapPreview(List<MappingAssignmentUploadRow> rows) {
        List<MappingAssignmentUploadPreviewRow> result = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            MappingAssignmentUploadRow row = rows.get(index);
            result.add(new MappingAssignmentUploadPreviewRow(index + 1, false, List.of("Mapping assignment period overlaps existing record."), Map.of(
                    "department_code", code(row.departmentCode()), "type_code", code(row.typeCode()), "item_code", code(row.itemCode()),
                    "effective_from", row.effectiveFrom(), "effective_to", row.effectiveTo())));
        }
        return new MappingAssignmentUploadPreviewResponse(result, 0, result.size());
    }

    private ApiException uploadValidation(MappingAssignmentUploadPreviewResponse preview) {
        return ApiException.unprocessable(Map.of("message", "upload validation failed", "rows", preview.rows(), "valid_count", preview.validCount(), "invalid_count", preview.invalidCount()));
    }

    private List<PersonalSnapshot> loadSnapshots(List<Long> employeeIds, LocalDate referenceDate) {
        if (employeeIds.isEmpty()) return List.of();
        List<OrganizationReferenceReadMapper.EmployeeSnapshotReference> employeeRows = references.employeesWithUsers(employeeIds);
        List<OrganizationReferenceReadMapper.PersonnelHistoryReference> histories = references.personnelHistoriesAfter(employeeIds, referenceDate);
        Map<Long, List<OrganizationReferenceReadMapper.PersonnelHistoryReference>> historyByEmployee = new HashMap<>();
        histories.forEach(history -> historyByEmployee.computeIfAbsent(history.employeeId(), ignored -> new ArrayList<>()).add(history));
        List<PersonalSnapshot> snapshots = new ArrayList<>();
        for (OrganizationReferenceReadMapper.EmployeeSnapshotReference employee : employeeRows) {
            long departmentId = employee.departmentId();
            String employmentStatus = employee.employmentStatus();
            for (OrganizationReferenceReadMapper.PersonnelHistoryReference history : historyByEmployee.getOrDefault(employee.id(), List.of())) {
                if ("department_id".equals(history.fieldName()) && history.beforeValue() != null && !history.beforeValue().isBlank()) departmentId = Long.parseLong(history.beforeValue());
                else if ("employment_status".equals(history.fieldName()) && history.beforeValue() != null) employmentStatus = history.beforeValue();
            }
            snapshots.add(new PersonalSnapshot(employee.id(), employee.employeeNo(), employee.displayName(), departmentId, employee.positionTitle(), employmentStatus));
        }
        return snapshots;
    }

    private Map<Long, OrgDepartment> departmentsById(Collection<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        List<Integer> databaseIds = ids.stream().map(id -> IntegerId.required(id, "department_id")).toList();
        return entityManager.createQuery("select d from OrgDepartment d where d.id in :ids", OrgDepartment.class).setParameter("ids", databaseIds).getResultList().stream()
                .collect(java.util.stream.Collectors.toMap(d -> d.id.longValue(), d -> d));
    }

    private Map<String, PersonalStatusCell> personalStatusMappings(Collection<Long> departmentIds, LocalDate date) {
        if (departmentIds.isEmpty()) return Map.of();
        List<Integer> databaseIds = departmentIds.stream().map(id -> IntegerId.required(id, "department_id")).toList();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createQuery("""
                select a, i from OrgMappingAssignment a join OrgMappingTypeItem i on i.id = a.itemId and i.typeCode = a.typeCode
                where a.departmentId in :ids and a.effectiveFrom <= :date and coalesce(a.effectiveTo, :openEnd) >= :date
                order by a.departmentId, a.typeCode, a.effectiveFrom desc, a.id desc
                """, Object[].class).setParameter("ids", databaseIds).setParameter("date", date).setParameter("openEnd", OPEN_END).getResultList();
        Map<String, PersonalStatusCell> result = new HashMap<>();
        for (Object[] row : rows) {
            OrgMappingAssignment assignment = (OrgMappingAssignment) row[0];
            OrgMappingTypeItem item = (OrgMappingTypeItem) row[1];
            result.put(assignment.departmentId + "|" + assignment.typeCode, new PersonalStatusCell(item.itemCode, item.name));
        }
        return result;
    }

    private DeptChangeHistoryItem historyItem(OrgDeptChangeHistory row) {
        OrgDepartment department = entityManager.find(OrgDepartment.class, row.departmentId);
        String changedByName = row.changedBy == null ? null : references.userDisplayName(row.changedBy);
        return new DeptChangeHistoryItem(row.id.longValue(), row.departmentId.longValue(), department == null ? null : department.name, row.changedBy == null ? null : row.changedBy.longValue(),
                changedByName, row.fieldName, row.beforeValue, row.afterValue, row.changeReason, row.changedAt);
    }

    private void recordChange(long departmentId, Long changedBy, String fieldName, String before, String after, String reason) {
        if (Objects.equals(before, after)) return;
        OrgDeptChangeHistory history = new OrgDeptChangeHistory();
        history.departmentId = IntegerId.required(departmentId, "department_id");
        history.changedBy = IntegerId.optional(changedBy, "changed_by");
        history.fieldName = fieldName;
        history.beforeValue = before;
        history.afterValue = after;
        history.changeReason = reason;
        history.changedAt = now();
        entityManager.persist(history);
    }

    private OrgRestructurePlan plan(long id, LockModeType lock) {
        OrgRestructurePlan row = entityManager.find(OrgRestructurePlan.class, IntegerId.required(id, "plan_id"), lock);
        if (row == null) throw ApiException.notFound("조직개편안을 찾을 수 없습니다.");
        return row;
    }

    private OrgRestructurePlanItem planItemEntity(long id, LockModeType lock) {
        OrgRestructurePlanItem row = entityManager.find(OrgRestructurePlanItem.class, IntegerId.required(id, "item_id"), lock);
        if (row == null) throw ApiException.notFound("항목을 찾을 수 없습니다.");
        return row;
    }

    private RestructurePlanItem planItem(OrgRestructurePlan row) {
        long itemCount = count("select count(i) from OrgRestructurePlanItem i where i.planId = :id", row.id);
        return new RestructurePlanItem(row.id.longValue(), row.title, row.description, row.plannedDate, row.status, row.appliedAt, row.appliedBy == null ? null : row.appliedBy.longValue(),
                row.createdBy, row.createdAt, row.updatedAt, itemCount);
    }

    private RestructurePlanItemDetail planItemDetail(OrgRestructurePlanItem row) {
        OrgDepartment target = row.targetDeptId == null ? null : entityManager.find(OrgDepartment.class, row.targetDeptId);
        OrgDepartment parent = row.newParentId == null ? null : entityManager.find(OrgDepartment.class, row.newParentId);
        return new RestructurePlanItemDetail(row.id.longValue(), row.planId.longValue(), row.actionType, row.targetDeptId == null ? null : row.targetDeptId.longValue(), target == null ? null : target.name,
                target == null ? null : target.code, row.newParentId == null ? null : row.newParentId.longValue(), parent == null ? null : parent.name, row.newName, row.newCode,
                row.newOrganizationType, row.newCostCenterCode, row.sortOrder, row.itemStatus, row.memo, row.appliedAt, row.createdAt, row.updatedAt);
    }

    private void ensurePlanEditable(OrgRestructurePlan plan) {
        if ("applied".equals(plan.status) || "cancelled".equals(plan.status)) {
            throw ApiException.conflict("적용됐거나 취소된 개편안에는 항목을 추가/수정할 수 없습니다.");
        }
    }

    private void validatePlanItem(String actionType, Long targetDeptId, Long newParentId, String newName, String newCode) {
        Integer targetId = IntegerId.optional(targetDeptId, "target_dept_id");
        IntegerId.optional(newParentId, "new_parent_id");
        if (!PLAN_ACTIONS.contains(actionType)) throw ApiException.badRequest("Invalid restructure action_type.");
        if (Set.of("move", "rename", "deactivate", "reactivate").contains(actionType)) {
            if (targetDeptId == null) throw ApiException.badRequest(actionType + " 액션은 target_dept_id가 필요합니다.");
            if (entityManager.find(OrgDepartment.class, targetId) == null) throw ApiException.notFound("대상 부서를 찾을 수 없습니다.");
        }
        if ("move".equals(actionType) && newParentId == null) throw ApiException.badRequest("move 액션은 new_parent_id가 필요합니다.");
        if ("rename".equals(actionType) && (newName == null || newName.isBlank())) throw ApiException.badRequest("rename 액션은 new_name이 필요합니다.");
        if ("create".equals(actionType) && (newName == null || newName.isBlank())) throw ApiException.badRequest("create 액션은 new_name이 필요합니다.");
    }

    private String applyPlanItem(OrgRestructurePlanItem item, long userId, Instant now) {
        String reason = "조직개편 plan_id=" + item.planId;
        return switch (item.actionType) {
            case "move" -> {
                OrgDepartment department = restructureDepartment(item.targetDeptId);
                OrgDepartment parent = restructureDepartment(item.newParentId);
                ensureNoRestructureCycle(department.id, parent.id);
                recordChange(department.id, userId, "parent_id", legacyNullable(department.parentId), legacyNullable(parent.id), reason);
                department.parentId = parent.id;
                department.updatedAt = now;
                yield "[MOVE] " + department.name + " → 상위부서 변경";
            }
            case "rename" -> {
                OrgDepartment department = restructureDepartment(item.targetDeptId);
                String previous = department.name;
                department.name = requiredTrim(item.newName);
                if (item.newCode != null && !item.newCode.isBlank()) {
                    String nextCode = code(item.newCode);
                    recordChange(department.id, userId, "code", department.code, nextCode, reason);
                    department.code = nextCode;
                }
                recordChange(department.id, userId, "name", previous, department.name, reason);
                department.updatedAt = now;
                yield "[RENAME] " + previous + " → " + department.name;
            }
            case "create" -> {
                String nextCode = item.newCode == null ? "" : item.newCode.toUpperCase(Locale.ROOT).strip();
                if (nextCode.isBlank()) throw ApiException.badRequest("create 액션에 new_code가 없습니다.");
                if (exists("select d.id from OrgDepartment d where d.code = :value", nextCode)) {
                    throw ApiException.conflict("코드 '" + nextCode + "'가 이미 존재합니다.");
                }
                OrgDepartment department = new OrgDepartment();
                department.code = nextCode;
                department.name = requiredTrim(item.newName);
                department.parentId = item.newParentId;
                department.organizationType = item.newOrganizationType;
                department.costCenterCode = item.newCostCenterCode;
                department.active = true;
                department.createdAt = now;
                department.updatedAt = now;
                entityManager.persist(department);
                entityManager.flush();
                recordChange(department.id, userId, "created", null, nextCode, reason);
                yield "[CREATE] " + department.name + " (" + nextCode + ")";
            }
            case "deactivate" -> {
                OrgDepartment department = restructureDepartment(item.targetDeptId);
                recordChange(department.id, userId, "is_active", "True", "False", reason);
                department.active = false;
                department.updatedAt = now;
                yield "[DEACTIVATE] " + department.name;
            }
            case "reactivate" -> {
                OrgDepartment department = restructureDepartment(item.targetDeptId);
                recordChange(department.id, userId, "is_active", "False", "True", reason);
                department.active = true;
                department.updatedAt = now;
                yield "[REACTIVATE] " + department.name;
            }
            default -> null;
        };
    }

    private OrgDepartment restructureDepartment(Integer departmentId) {
        if (departmentId == null) throw ApiException.badRequest("부서 ID가 없습니다.");
        OrgDepartment row = entityManager.find(OrgDepartment.class, departmentId, LockModeType.PESSIMISTIC_WRITE);
        if (row == null) throw ApiException.notFound("부서 id=" + departmentId + "를 찾을 수 없습니다.");
        return row;
    }

    private void ensureNoRestructureCycle(int departmentId, int newParentId) {
        if (departmentId == newParentId) throw ApiException.badRequest("자기 자신을 상위 부서로 지정할 수 없습니다.");
        Integer current = newParentId;
        Set<Integer> visited = new HashSet<>();
        visited.add(newParentId);
        while (current != null) {
            OrgDepartment parent = entityManager.find(OrgDepartment.class, current);
            if (parent == null || parent.parentId == null) return;
            if (parent.parentId == departmentId) throw ApiException.badRequest("순환 부서 구조를 만들 수 없습니다.");
            if (!visited.add(parent.parentId)) return;
            current = parent.parentId;
        }
    }

    private boolean exists(String query, String value) {
        return !entityManager.createQuery(query, Integer.class).setParameter("value", value).setMaxResults(1).getResultList().isEmpty();
    }

    private boolean existsExcluding(String query, String value, int id, String alias) {
        return !entityManager.createQuery(query + " and " + alias + ".id <> :id", Integer.class).setParameter("value", value)
                .setParameter("id", id).setMaxResults(1).getResultList().isEmpty();
    }

    private long count(String query, int id) {
        return entityManager.createQuery(query, Long.class).setParameter("id", id).getSingleResult();
    }

    private void flushConflict(String message) {
        try {
            entityManager.flush();
        } catch (PersistenceException exception) {
            throw ApiException.conflict(message);
        }
    }

    private void persistConflict(Object entity, String message) {
        try {
            entityManager.persist(entity);
            entityManager.flush();
        } catch (PersistenceException exception) {
            throw ApiException.conflict(message);
        }
    }

    private static boolean activeAt(LocalDate from, LocalDate to, LocalDate referenceDate) {
        return referenceDate == null || (!from.isAfter(referenceDate) && !(to == null ? OPEN_END : to).isBefore(referenceDate));
    }

    private static boolean containsPeriod(LocalDate itemFrom, LocalDate itemTo, LocalDate assignmentFrom, LocalDate assignmentTo) {
        return !assignmentFrom.isBefore(itemFrom) && (itemTo == null || (assignmentTo != null && !assignmentTo.isAfter(itemTo)));
    }

    private static boolean overlaps(LocalDate leftFrom, LocalDate leftTo, LocalDate rightFrom, LocalDate rightTo) {
        return !leftFrom.isAfter(rightTo == null ? OPEN_END : rightTo) && !rightFrom.isAfter(leftTo == null ? OPEN_END : leftTo);
    }

    private static <T> List<T> page(List<T> rows, int page, int limit) {
        int start = Math.max(0, (page - 1) * limit);
        if (start >= rows.size()) return List.of();
        return rows.subList(start, Math.min(rows.size(), start + limit));
    }

    private static boolean contains(String actual, String search) {
        return search == null || search.isBlank() || actual != null && actual.toLowerCase(Locale.ROOT).contains(search.strip().toLowerCase(Locale.ROOT));
    }

    private static String code(String value) { return requiredTrim(value).toUpperCase(Locale.ROOT); }
    private static String requiredTrim(String value) { if (value == null || value.isBlank()) throw ApiException.unprocessable("A required value is blank."); return value.strip(); }
    private static String nullable(String value) { return value == null || value.strip().isEmpty() ? null : value.strip(); }
    private static String legacyNullable(Number value) { return value == null ? "None" : String.valueOf(value); }
    private static String legacyBoolean(boolean value) { return value ? "True" : "False"; }
    private static Instant now() { return Instant.now().atOffset(ZoneOffset.UTC).toInstant(); }
    private static LocalDate requiredDate(LocalDate value, String detail) { if (value == null) throw ApiException.unprocessable(detail); return value; }
    private static void addError(List<String> errors, String error) { if (!errors.contains(error)) errors.add(error); }

    private static final class PreparedUploadRow {
        private final int rowIndex;
        private final OrgDepartment department;
        private final OrgMappingTypeItem item;
        private final String typeCode;
        private final LocalDate effectiveFrom;
        private final LocalDate effectiveTo;
        private OrgMappingAssignment existing;
        private PreparedUploadRow(int rowIndex, OrgDepartment department, OrgMappingTypeItem item, String typeCode, LocalDate effectiveFrom, LocalDate effectiveTo, OrgMappingAssignment existing) {
            this.rowIndex = rowIndex; this.department = department; this.item = item; this.typeCode = typeCode;
            this.effectiveFrom = effectiveFrom; this.effectiveTo = effectiveTo; this.existing = existing;
        }
    }
    private record UploadValidation(MappingAssignmentUploadPreviewResponse preview, List<PreparedUploadRow> prepared) {
    }
    private record Period(LocalDate from, LocalDate to, Integer rowIndex) {
    }
    private record PersonalSnapshot(long employeeId, String employeeNo, String displayName, long departmentId, String positionTitle, String employmentStatus) {
    }
}
