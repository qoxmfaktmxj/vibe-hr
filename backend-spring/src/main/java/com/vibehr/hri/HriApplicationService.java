package com.vibehr.hri;

import com.vibehr.platform.error.ApiException;
import com.vibehr.welfare.HriWelfareProjection;
import com.vibehr.welfare.WelfareApplicationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class HriApplicationService {
    private static final Set<String> EDITABLE = Set.of("DRAFT", "APPROVAL_REJECTED", "RECEIVE_REJECTED");
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() { };
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final WelfareApplicationService welfareService;
    private final ObjectProvider<HriRequestProjectionMapper> projectionMapper;
    private final Clock clock;

    @Autowired
    public HriApplicationService(EntityManager entityManager, ObjectMapper objectMapper, WelfareApplicationService welfareService,
            ObjectProvider<HriRequestProjectionMapper> projectionMapper) {
        this(entityManager, objectMapper, welfareService, projectionMapper, Clock.system(BUSINESS_ZONE));
    }

    HriApplicationService(EntityManager entityManager, ObjectMapper objectMapper, WelfareApplicationService welfareService) {
        this(entityManager, objectMapper, welfareService, null, Clock.system(BUSINESS_ZONE));
    }

    HriApplicationService(EntityManager entityManager, ObjectMapper objectMapper, WelfareApplicationService welfareService, Clock clock) {
        this(entityManager, objectMapper, welfareService, null, clock);
    }

    private HriApplicationService(EntityManager entityManager, ObjectMapper objectMapper, WelfareApplicationService welfareService,
            ObjectProvider<HriRequestProjectionMapper> projectionMapper, Clock clock) {
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
        this.welfareService = welfareService;
        this.projectionMapper = projectionMapper;
        this.clock = clock.withZone(BUSINESS_ZONE);
    }

    @Transactional
    public HriFormTypeListResponse listFormTypes() {
        List<HriFormTypeItem> items = entityManager.createQuery(
                "select f from HriFormType f order by f.module_code, f.default_priority, f.id", HriFormType.class)
                .getResultList().stream().map(this::formItem).toList();
        return new HriFormTypeListResponse(items, items.size());
    }

    @Transactional
    public HriFormTypeBatchResponse saveFormTypes(HriFormTypeBatchRequest request, int userId) {
        int inserted = 0, updated = 0, deleted = 0;
        for (Integer id : items(request.deleteIds())) {
            HriFormType row = entityManager.find(HriFormType.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (row != null) { entityManager.remove(row); deleted++; }
        }
        for (HriFormTypeBatchItem item : items(request.items())) {
            if (item.id() != null && item.id() > 0) {
                HriFormType row = entityManager.find(HriFormType.class, item.id(), LockModeType.PESSIMISTIC_WRITE);
                if (row != null) { assign(row, item, userId); updated++; continue; }
            }
            String code = item.formCode().strip().toUpperCase();
            if (exists("select count(f) from HriFormType f where f.form_code = :code", "code", code)) {
                throw ApiException.conflict("form_code '" + code + "' already exists.");
            }
            HriFormType row = new HriFormType();
            row.created_at = now(); row.created_by = userId;
            assign(row, item, userId);
            entityManager.persist(row);
            inserted++;
        }
        HriFormTypeListResponse all = listFormTypes();
        return new HriFormTypeBatchResponse(all.items(), all.totalCount(), inserted, updated, deleted);
    }

    @Transactional
    public HriApprovalTemplateListResponse listApprovalTemplates() {
        List<HriApprovalTemplateItem> items = entityManager.createQuery(
                "select t from HriApprovalLineTemplate t order by t.scope_type, t.priority desc, t.id", HriApprovalLineTemplate.class)
                .getResultList().stream().map(this::templateItem).toList();
        return new HriApprovalTemplateListResponse(items, items.size());
    }

    @Transactional
    public HriApprovalTemplateBatchResponse saveApprovalTemplates(HriApprovalTemplateBatchRequest request) {
        int inserted = 0, updated = 0, deleted = 0;
        for (Integer id : items(request.deleteIds())) {
            HriApprovalLineTemplate row = entityManager.find(HriApprovalLineTemplate.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (row == null) continue;
            templateSteps(row.id).forEach(entityManager::remove);
            entityManager.remove(row);
            deleted++;
        }
        for (HriApprovalTemplateBatchItem item : items(request.items())) {
            validateTemplateInput(item);
            HriApprovalLineTemplate row = item.id() == null || item.id() <= 0 ? null
                    : entityManager.find(HriApprovalLineTemplate.class, item.id(), LockModeType.PESSIMISTIC_WRITE);
            if (row == null) {
                String code = item.templateCode().strip().toUpperCase();
                if (exists("select count(t) from HriApprovalLineTemplate t where t.template_code = :code", "code", code)) {
                    throw ApiException.conflict("template_code '" + code + "' already exists.");
                }
                row = new HriApprovalLineTemplate();
                row.created_at = now();
                assign(row, item);
                entityManager.persist(row);
                entityManager.flush();
                replaceSteps(row.id, item.steps());
                inserted++;
            } else {
                assign(row, item);
                replaceSteps(row.id, item.steps());
                updated++;
            }
        }
        HriApprovalTemplateListResponse all = listApprovalTemplates();
        return new HriApprovalTemplateBatchResponse(all.items(), all.totalCount(), inserted, updated, deleted);
    }

    @Transactional
    public HriRequestItem saveDraft(int userId, HriRequestDraftUpsertRequest command) {
        HriFormType formType = formType(command.formTypeId());
        if (!formType.is_active) throw ApiException.notFound("Form type not found.");
        if (!formType.allow_draft) throw ApiException.conflict("Draft is disabled for this form type.");
        HriDetailContracts.ValidatedDetail detail = HriDetailContracts.validate(formType.form_code,
                map(command.contentJson()), effectivePolicies(formType.id), businessDate(), false);
        Map<String, Object> content = detail.content();
        HriRequestMaster request;
        Instant now = now();
        if (command.requestId() == null) {
            request = new HriRequestMaster();
            request.request_no = nextRequestNo(formType);
            request.form_type_id = formType.id;
            request.requester_id = userId;
            request.requester_org_id = requesterOrgId(userId);
            request.title = command.title().strip();
            request.content_json = json(content);
            request.status_code = "DRAFT";
            request.created_at = now;
            request.updated_at = now;
            entityManager.persist(request);
            entityManager.flush();
            if (detail.materializable()) writeDetail(formType.form_code, request.id, content);
            history(request.id, userId, "CREATE", null, request.status_code, Map.of("title", request.title));
        } else {
            request = requestForUpdate(command.requestId());
            if (request.requester_id != userId) throw ApiException.notFound("Request not found.");
            if (!EDITABLE.contains(request.status_code)) {
                throw ApiException.conflict("Cannot edit request in status '" + request.status_code + "'.");
            }
            String fromStatus = request.status_code;
            request.form_type_id = formType.id;
            request.title = command.title().strip();
            request.content_json = json(content);
            request.status_code = "DRAFT";
            request.current_step_order = null;
            request.updated_at = now;
            if (detail.materializable()) writeDetail(formType.form_code, request.id, content);
            history(request.id, userId, "DRAFT_SAVE", fromStatus, request.status_code, Map.of());
        }
        syncWelfareProjection(request);
        entityManager.flush();
        return requestItem(request);
    }

    @Transactional
    public HriRequestSubmitResponse submit(int userId, int requestId) {
        HriRequestMaster request = requestForUpdate(requestId);
        if (request.requester_id != userId) throw ApiException.notFound("Request not found.");
        if (!EDITABLE.contains(request.status_code)) throw ApiException.conflict("Cannot submit request in status '" + request.status_code + "'.");
        HriFormType formType = formType(request.form_type_id);
        if (!formType.is_active) throw ApiException.notFound("Form type not found.");
        Map<String, String> policies = effectivePolicies(formType.id);
        HriDetailContracts.ValidatedDetail detail = HriDetailContracts.validate(formType.form_code,
                map(read(request.content_json)), policies, businessDate(), true);
        validateAttachmentPolicies(request.id, policies);
        request.content_json = json(detail.content());
        if (detail.materializable()) writeDetail(formType.form_code, request.id, detail.content());
        String fromStatus = request.status_code;
        List<Map<String, Object>> priorSteps = snapshotLineage(request.id);
        resetSnapshots(request.id);
        HriApprovalLineTemplate template = approvalTemplate(request.form_type_id);
        validateReceiveRequirement(formType, template);
        HriRequestStepSnapshot firstWaiting = snapshotTemplate(request.id, userId, template);
        Instant now = now();
        request.submitted_at = now;
        request.completed_at = null;
        if (firstWaiting == null) {
            request.status_code = "COMPLETED";
            request.current_step_order = null;
            request.completed_at = now;
        } else {
            request.current_step_order = firstWaiting.step_order;
            request.status_code = "APPROVAL".equals(firstWaiting.step_type) ? "APPROVAL_IN_PROGRESS" : "RECEIVE_IN_PROGRESS";
        }
        request.updated_at = now;
        Map<String, Object> historyPayload = new LinkedHashMap<>();
        historyPayload.put("template_id", template.id);
        historyPayload.put("resubmission", !priorSteps.isEmpty());
        if (!priorSteps.isEmpty()) historyPayload.put("prior_steps", priorSteps);
        history(request.id, userId, "SUBMIT", fromStatus, request.status_code, historyPayload);
        syncWelfareProjection(request);
        return new HriRequestSubmitResponse(request.id, request.status_code, request.current_step_order);
    }

    @Transactional
    public HriRequestActionResponse withdraw(int userId, int requestId) {
        HriRequestMaster request = requestForUpdate(requestId);
        if (request.requester_id != userId) throw ApiException.notFound("Request not found.");
        if (!"APPROVAL_IN_PROGRESS".equals(request.status_code)) {
            throw ApiException.conflict("Cannot withdraw request in status '" + request.status_code + "'.");
        }
        HriFormType formType = entityManager.find(HriFormType.class, request.form_type_id);
        if (formType != null && !formType.allow_withdraw) throw ApiException.conflict("Withdraw is disabled for this form type.");
        Instant now = now();
        String from = request.status_code;
        request.status_code = "WITHDRAWN";
        request.current_step_order = null;
        request.updated_at = now;
        entityManager.createQuery("select s from HriRequestStepSnapshot s where s.request_id = :id and s.action_status = 'WAITING'", HriRequestStepSnapshot.class)
                .setParameter("id", request.id).getResultList().forEach(step -> {
                    step.action_status = "REJECTED"; step.acted_at = now; step.comment = "WITHDRAWN_BY_REQUESTER"; step.updated_at = now;
                });
        history(request.id, userId, "WITHDRAW", from, request.status_code, Map.of());
        syncWelfareProjection(request);
        return action(request);
    }

    @Transactional
    public HriRequestActionResponse approve(int userId, int requestId, String comment) {
        HriRequestMaster request = requestForUpdate(requestId);
        if (!"APPROVAL_IN_PROGRESS".equals(request.status_code)) throw ApiException.conflict("Cannot approve request in status '" + request.status_code + "'.");
        HriRequestStepSnapshot step = actionable(request, userId, "APPROVAL");
        Instant now = now();
        step.action_status = "APPROVED"; step.acted_at = now; step.comment = comment; step.updated_at = now;
        String from = request.status_code;
        HriRequestStepSnapshot nextApproval = next(request.id, step.step_order, "APPROVAL");
        if (nextApproval != null) request.current_step_order = nextApproval.step_order;
        else {
            HriRequestStepSnapshot nextReceive = firstWaiting(request.id, "RECEIVE");
            if (nextReceive == null) complete(request, now);
            else { request.status_code = "RECEIVE_IN_PROGRESS"; request.current_step_order = nextReceive.step_order; }
        }
        request.updated_at = now;
        history(request.id, userId, "APPROVE", from, request.status_code, commentPayload(comment));
        syncWelfareProjection(request);
        return action(request);
    }

    @Transactional
    public HriRequestActionResponse reject(int userId, int requestId, String comment) {
        HriRequestMaster request = requestForUpdate(requestId);
        if (!"APPROVAL_IN_PROGRESS".equals(request.status_code)) throw ApiException.conflict("Cannot reject request in status '" + request.status_code + "'.");
        HriRequestStepSnapshot step = actionable(request, userId, "APPROVAL");
        Instant now = now();
        step.action_status = "REJECTED"; step.acted_at = now; step.comment = comment; step.updated_at = now;
        String from = request.status_code;
        request.status_code = "APPROVAL_REJECTED"; request.current_step_order = null; request.updated_at = now;
        history(request.id, userId, "REJECT", from, request.status_code, commentPayload(comment));
        syncWelfareProjection(request);
        return action(request);
    }

    @Transactional
    public HriRequestActionResponse receiveComplete(int userId, int requestId, String comment) {
        HriRequestMaster request = requestForUpdate(requestId);
        if (!"RECEIVE_IN_PROGRESS".equals(request.status_code)) throw ApiException.conflict("Cannot complete receive in status '" + request.status_code + "'.");
        HriRequestStepSnapshot step = actionable(request, userId, "RECEIVE");
        Instant now = now();
        step.action_status = "RECEIVED"; step.acted_at = now; step.comment = comment; step.updated_at = now;
        String from = request.status_code;
        HriRequestStepSnapshot next = next(request.id, step.step_order, "RECEIVE");
        if (next == null) complete(request, now); else request.current_step_order = next.step_order;
        request.updated_at = now;
        history(request.id, userId, "RECEIVE_COMPLETE", from, request.status_code, commentPayload(comment));
        syncWelfareProjection(request);
        return action(request);
    }

    @Transactional
    public HriRequestActionResponse receiveReject(int userId, int requestId, String comment) {
        HriRequestMaster request = requestForUpdate(requestId);
        if (!"RECEIVE_IN_PROGRESS".equals(request.status_code)) throw ApiException.conflict("Cannot reject receive in status '" + request.status_code + "'.");
        HriRequestStepSnapshot step = actionable(request, userId, "RECEIVE");
        Instant now = now();
        step.action_status = "REJECTED"; step.acted_at = now; step.comment = comment; step.updated_at = now;
        String from = request.status_code;
        request.status_code = "RECEIVE_REJECTED"; request.current_step_order = null; request.updated_at = now;
        history(request.id, userId, "RECEIVE_REJECT", from, request.status_code, commentPayload(comment));
        syncWelfareProjection(request);
        return action(request);
    }

    @Transactional
    public HriRequestListResponse myRequests(int userId, int page, int limit) {
        List<HriRequestItem> items = entityManager.createQuery(
                "select r from HriRequestMaster r where r.requester_id = :userId order by r.created_at desc, r.id desc", HriRequestMaster.class)
                .setParameter("userId", userId).getResultList().stream().map(this::requestItem).toList();
        return new HriRequestListResponse(page(items, page, limit), items.size(), page, limit);
    }

    @Transactional
    public HriRequestDetailFull detail(int userId, int requestId) {
        HriRequestMaster request = entityManager.find(HriRequestMaster.class, requestId);
        if (request == null || request.requester_id != userId) throw ApiException.notFound("Request not found.");
        HriFormType formType = entityManager.find(HriFormType.class, request.form_type_id);
        List<HriRequestStepSnapshot> snapshots = snapshots(request.id);
        String actorName = request.current_step_order == null ? null : snapshots.stream()
                .filter(step -> step.step_order == request.current_step_order).map(step -> step.actor_name).findFirst().orElse(null);
        Map<String, Object> content = map(read(request.content_json));
        Map<String, Object> detail = readDetail(formType == null ? "" : formType.form_code, request.id);
        return new HriRequestDetailFull(request.id, request.request_no, request.form_type_id, formType == null ? null : formType.form_code,
                formType == null ? null : formType.form_name_ko, request.requester_id, request.title, request.status_code,
                request.current_step_order, actorName, request.submitted_at, request.completed_at, request.created_at, request.updated_at,
                content, snapshots.stream().map(this::snapshotItem).toList(), detail.isEmpty() ? content : detail);
    }

    @Transactional
    public HriTaskListResponse approvalTasks(int userId, int page, int limit) { return taskList(userId, "APPROVAL", "APPROVAL_IN_PROGRESS", page, limit); }
    @Transactional
    public HriTaskListResponse receiveTasks(int userId, int page, int limit) { return taskList(userId, "RECEIVE", "RECEIVE_IN_PROGRESS", page, limit); }

    private HriTaskListResponse taskList(int userId, String type, String status, int page, int limit) {
        List<Object[]> rows = entityManager.createQuery("""
                select s, r from HriRequestStepSnapshot s, HriRequestMaster r
                where s.request_id = r.id and s.actor_user_id = :userId and s.step_type = :type
                  and s.action_status = 'WAITING' and r.status_code = :status
                order by r.created_at desc, s.step_order
                """, Object[].class).setParameter("userId", userId).setParameter("type", type).setParameter("status", status).getResultList();
        List<HriTaskItem> items = rows.stream().map(row -> taskItem((HriRequestStepSnapshot) row[0], (HriRequestMaster) row[1])).toList();
        return new HriTaskListResponse(page(items, page, limit), items.size(), page, limit);
    }

    private void assign(HriFormType row, HriFormTypeBatchItem item, int userId) {
        row.form_code = item.formCode().strip().toUpperCase(); row.form_name_ko = item.formNameKo().strip();
        row.form_name_en = blankToNull(item.formNameEn()); row.module_code = value(item.moduleCode(), "COMMON").strip().toUpperCase();
        row.is_active = bool(item.isActive(), true); row.allow_draft = bool(item.allowDraft(), true);
        row.allow_withdraw = bool(item.allowWithdraw(), true); row.requires_receive = bool(item.requiresReceive(), false);
        row.default_priority = integer(item.defaultPriority(), 50); row.updated_by = userId; row.updated_at = now();
    }

    private void assign(HriApprovalLineTemplate row, HriApprovalTemplateBatchItem item) {
        row.template_code = item.templateCode().strip().toUpperCase(); row.template_name = item.templateName().strip();
        row.scope_type = value(item.scopeType(), "GLOBAL").strip().toUpperCase(); row.scope_id = blankToNull(item.scopeId());
        row.is_default = bool(item.isDefault(), false); row.is_active = bool(item.isActive(), true);
        row.priority = integer(item.priority(), 100); row.updated_at = now();
    }

    private void validateTemplateInput(HriApprovalTemplateBatchItem item) {
        String scopeType = value(item.scopeType(), "GLOBAL").strip().toUpperCase();
        String scopeId = blankToNull(item.scopeId());
        if (!Set.of("GLOBAL", "COMPANY", "DEPT", "TEAM", "USER").contains(scopeType)) {
            throw ApiException.badRequest("Invalid approval template scope_type: " + scopeType);
        }
        if ("GLOBAL".equals(scopeType) && scopeId != null) {
            throw ApiException.badRequest("GLOBAL approval templates must not define scope_id.");
        }
        if (!"GLOBAL".equals(scopeType) && scopeId == null) {
            throw ApiException.badRequest(scopeType + " approval templates require scope_id.");
        }
        validateStepInputs(item.steps());
    }

    private void replaceSteps(int templateId, List<HriApprovalTemplateStepBatchItem> values) {
        templateSteps(templateId).forEach(entityManager::remove);
        entityManager.flush();
        for (HriApprovalTemplateStepBatchItem item : items(values).stream().sorted(Comparator.comparingInt(HriApprovalTemplateStepBatchItem::stepOrder)).toList()) {
            HriApprovalLineStep row = new HriApprovalLineStep();
            row.template_id = templateId; row.step_order = item.stepOrder(); row.step_type = item.stepType().toUpperCase();
            row.actor_resolve_type = item.actorResolveType().toUpperCase(); row.actor_role_code = blankToNull(item.actorRoleCode());
            if (row.actor_role_code != null) row.actor_role_code = row.actor_role_code.toUpperCase();
            row.actor_user_id = item.actorUserId(); row.allow_delegate = bool(item.allowDelegate(), true);
            row.required_action = item.requiredAction().toUpperCase(); row.created_at = now(); row.updated_at = row.created_at;
            entityManager.persist(row);
        }
    }

    HriApprovalLineTemplate approvalTemplate(int formTypeId) {
        LocalDate today = businessDate();
        List<HriFormTypeApprovalMap> mappings = entityManager.createQuery("""
                select m from HriFormTypeApprovalMap m where m.form_type_id = :id and m.is_active = true
                and m.effective_from <= :today and (m.effective_to is null or m.effective_to >= :today)
                order by m.effective_from desc, m.id desc
                """, HriFormTypeApprovalMap.class).setParameter("id", formTypeId).setParameter("today", today).getResultList();
        List<HriApprovalLineTemplate> candidates = mappings.stream().map(m -> entityManager.find(HriApprovalLineTemplate.class, m.template_id))
                .filter(t -> t != null && t.is_active).sorted(Comparator.comparingInt((HriApprovalLineTemplate t) -> t.priority).reversed()
                        .thenComparing(t -> t.id, Comparator.reverseOrder())).toList();
        if (!candidates.isEmpty()) return candidates.getFirst();
        return entityManager.createQuery("select t from HriApprovalLineTemplate t where t.is_active = true and t.is_default = true order by t.priority desc, t.id desc", HriApprovalLineTemplate.class)
                .setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> ApiException.badRequest("No active approval template is available for this form type."));
    }

    LocalDate businessDate() { return LocalDate.now(clock); }

    private Map<String, String> effectivePolicies(int formTypeId) {
        LocalDate today = businessDate();
        List<HriFormTypePolicy> rows = entityManager.createQuery("""
                select p from HriFormTypePolicy p where p.form_type_id = :id
                and p.effective_from <= :today and (p.effective_to is null or p.effective_to >= :today)
                order by p.effective_from desc, p.id desc
                """, HriFormTypePolicy.class).setParameter("id", formTypeId).setParameter("today", today).getResultList();
        Map<String, String> policies = new LinkedHashMap<>();
        for (HriFormTypePolicy row : rows) policies.putIfAbsent(row.policy_key, row.policy_value);
        return policies;
    }

    void validateStepInputs(List<HriApprovalTemplateStepBatchItem> values) {
        List<HriApprovalTemplateStepBatchItem> steps = items(values);
        if (steps.isEmpty()) throw ApiException.badRequest("The selected approval template has no steps.");
        Set<Integer> orders = new HashSet<>();
        boolean receiveSeen = false;
        for (HriApprovalTemplateStepBatchItem step : steps.stream()
                .sorted(Comparator.comparingInt(HriApprovalTemplateStepBatchItem::stepOrder)).toList()) {
            if (!orders.add(step.stepOrder())) throw ApiException.badRequest("Duplicate approval step_order: " + step.stepOrder());
            String type = value(step.stepType(), "").toUpperCase();
            String requiredAction = value(step.requiredAction(), "").toUpperCase();
            String actorType = value(step.actorResolveType(), "").toUpperCase();
            if (!Set.of("APPROVAL", "RECEIVE", "REFERENCE").contains(type)) {
                throw ApiException.badRequest("Invalid approval step_type: " + type);
            }
            if (!Set.of("ROLE_BASED", "USER_FIXED").contains(actorType)) {
                throw ApiException.badRequest("Invalid actor_resolve_type: " + actorType);
            }
            if ("RECEIVE".equals(type)) receiveSeen = true;
            if (receiveSeen && "APPROVAL".equals(type)) {
                throw ApiException.badRequest("APPROVAL steps must precede RECEIVE steps.");
            }
            String expectedAction = "RECEIVE".equals(type) ? "RECEIVE" : "APPROVE";
            if (!expectedAction.equals(requiredAction)) {
                throw ApiException.badRequest("required_action must be '" + expectedAction + "' for step_type '" + type + "'.");
            }
            if ("ROLE_BASED".equals(actorType)) {
                if (!notBlank(step.actorRoleCode()) || step.actorUserId() != null) {
                    throw ApiException.badRequest("ROLE_BASED steps require actor_role_code and prohibit actor_user_id.");
                }
                validateActorRule(step.actorRoleCode().strip().toUpperCase());
            } else if ("USER_FIXED".equals(actorType)) {
                if (step.actorUserId() == null || step.actorUserId() <= 0 || notBlank(step.actorRoleCode())) {
                    throw ApiException.badRequest("USER_FIXED steps require actor_user_id and prohibit actor_role_code.");
                }
                if (user(step.actorUserId()) == null) throw ApiException.badRequest("Fixed approval actor was not found.");
            }
        }
    }

    void validateReceiveRequirement(HriFormType formType, HriApprovalLineTemplate template) {
        List<HriApprovalLineStep> steps = templateSteps(template.id);
        validateStoredSteps(steps);
        boolean hasReceive = steps.stream().anyMatch(step -> "RECEIVE".equals(step.step_type));
        if (formType.requires_receive != hasReceive) {
            throw ApiException.badRequest(formType.requires_receive
                    ? "This form type requires a RECEIVE step in its approval template."
                    : "This form type does not allow RECEIVE steps in its approval template.");
        }
    }

    private void validateStoredSteps(List<HriApprovalLineStep> steps) {
        if (steps.isEmpty()) throw ApiException.badRequest("The selected approval template has no steps.");
        Set<Integer> orders = new HashSet<>();
        boolean receiveSeen = false;
        for (HriApprovalLineStep step : steps) {
            if (!orders.add(step.step_order)) throw ApiException.badRequest("Duplicate approval step_order: " + step.step_order);
            if ("RECEIVE".equals(step.step_type)) receiveSeen = true;
            if (receiveSeen && "APPROVAL".equals(step.step_type)) {
                throw ApiException.badRequest("APPROVAL steps must precede RECEIVE steps.");
            }
            String expectedAction = "RECEIVE".equals(step.step_type) ? "RECEIVE" : "APPROVE";
            if (!expectedAction.equals(step.required_action)) {
                throw ApiException.badRequest("required_action must be '" + expectedAction
                        + "' for step_type '" + step.step_type + "'.");
            }
            if ("ROLE_BASED".equals(step.actor_resolve_type)) {
                if (!notBlank(step.actor_role_code) || step.actor_user_id != null) {
                    throw ApiException.badRequest("ROLE_BASED steps require actor_role_code and prohibit actor_user_id.");
                }
                validateActorRule(step.actor_role_code);
            } else if ("USER_FIXED".equals(step.actor_resolve_type)) {
                if (step.actor_user_id == null || notBlank(step.actor_role_code)) {
                    throw ApiException.badRequest("USER_FIXED steps require actor_user_id and prohibit actor_role_code.");
                }
                if (user(step.actor_user_id) == null) throw ApiException.badRequest("Fixed approval actor was not found.");
            } else {
                throw ApiException.badRequest("Invalid actor_resolve_type: " + step.actor_resolve_type);
            }
        }
    }

    private void validateActorRule(String roleCode) {
        HriApprovalActorRule rule = entityManager.createQuery(
                "select r from HriApprovalActorRule r where r.role_code = :code and r.is_active = true", HriApprovalActorRule.class)
                .setParameter("code", roleCode).setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> ApiException.badRequest(
                        "결재 역할 '" + roleCode + "'에 대한 설정이 없습니다. HriApprovalActorRule 테이블을 확인하세요."));
        if (("ORG_CHAIN".equals(rule.resolve_method) || "JOB_POSITION".equals(rule.resolve_method))
                && keywords(rule.position_keywords_json).isEmpty()) {
            throw ApiException.badRequest("역할 '" + roleCode + "'의 position_keywords 설정이 비어 있습니다.");
        }
    }

    private HriRequestStepSnapshot snapshotTemplate(int requestId, int requesterId, HriApprovalLineTemplate template) {
        List<HriApprovalLineStep> steps = templateSteps(template.id);
        if (steps.isEmpty()) throw ApiException.badRequest("The selected approval template has no steps.");
        for (HriApprovalLineStep definition : steps) {
            int actorId = "ROLE_BASED".equals(definition.actor_resolve_type)
                    ? resolveRoleActor(requesterId, value(definition.actor_role_code, "TEAM_LEADER"))
                    : (definition.actor_user_id == null ? adminFallback() : definition.actor_user_id);
            UserReference actor = user(actorId);
            HriRequestStepSnapshot snapshot = new HriRequestStepSnapshot();
            Instant now = now();
            snapshot.request_id = requestId; snapshot.step_order = definition.step_order; snapshot.step_type = definition.step_type;
            snapshot.actor_user_id = actorId; snapshot.actor_name = actor == null ? "USER-" + actorId : actor.displayName();
            snapshot.actor_org_id = requesterOrgId(actorId); snapshot.actor_role_code = definition.actor_role_code;
            snapshot.action_status = "REFERENCE".equals(definition.step_type) ? "RECEIVED" : "WAITING";
            snapshot.acted_at = "RECEIVED".equals(snapshot.action_status) ? now : null;
            snapshot.comment = "RECEIVED".equals(snapshot.action_status) ? "AUTO_REFERENCE" : null;
            snapshot.created_at = now; snapshot.updated_at = now;
            entityManager.persist(snapshot);
        }
        entityManager.flush();
        return firstWaiting(requestId, null);
    }

    private int resolveRoleActor(int requesterId, String roleCode) {
        HriApprovalActorRule rule = entityManager.createQuery(
                "select r from HriApprovalActorRule r where r.role_code = :code and r.is_active = true", HriApprovalActorRule.class)
                .setParameter("code", roleCode).setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> ApiException.badRequest("결재 역할 '" + roleCode + "'에 대한 설정이 없습니다. HriApprovalActorRule 테이블을 확인하세요."));
        if ("FIXED_USER".equals(rule.resolve_method)) return adminFallback();
        EmployeeReference requester = employee(requesterId);
        if (requester == null) return fallback(rule, roleCode, "신청자 사원 정보를 찾을 수 없습니다.");
        List<String> keywords = keywords(rule.position_keywords_json);
        if (keywords.isEmpty()) return fallback(rule, roleCode, "역할 '" + roleCode + "'의 position_keywords 설정이 비어 있습니다.");
        List<Integer> departments = "ORG_CHAIN".equals(rule.resolve_method) ? departmentChain(requester.departmentId()) : List.of(0);
        for (Integer department : departments) for (String keyword : keywords) {
            Integer candidate = roleCandidate(requesterId, department, keyword, "ORG_CHAIN".equals(rule.resolve_method));
            if (candidate != null) return candidate;
        }
        return fallback(rule, roleCode, "역할 '" + roleCode + "'에 해당하는 결재자를 찾지 못했습니다 (키워드: " + keywords + ").");
    }

    private int fallback(HriApprovalActorRule rule, String roleCode, String reason) {
        if ("HR_ADMIN".equals(rule.fallback_rule) || "SKIP".equals(rule.fallback_rule)) return adminFallback();
        throw ApiException.badRequest("결재자 resolve 실패 [" + roleCode + "]: " + reason);
    }

    private int adminFallback() {
        @SuppressWarnings("unchecked")
        List<Number> rows = entityManager.createNativeQuery("""
                select ur.user_id from auth_user_roles ur join auth_roles r on r.id = ur.role_id
                join auth_users u on u.id = ur.user_id where r.code = 'admin' and u.is_active = true
                order by case when u.login_id = 'admin' then 0 else 1 end, ur.user_id limit 1
                """).getResultList();
        if (rows.isEmpty()) throw ApiException.badRequest("No admin user is available for fallback.");
        return rows.getFirst().intValue();
    }

    private List<Integer> departmentChain(Integer departmentId) {
        List<Integer> chain = new ArrayList<>(); Set<Integer> visited = new HashSet<>(); Integer current = departmentId;
        while (current != null && visited.add(current)) {
            chain.add(current);
            @SuppressWarnings("unchecked")
            List<Number> parent = entityManager.createNativeQuery("select parent_id from org_departments where id = :id")
                    .setParameter("id", current).getResultList();
            current = parent.isEmpty() || parent.getFirst() == null ? null : parent.getFirst().intValue();
        }
        return chain;
    }

    private Integer roleCandidate(int requesterId, Integer departmentId, String keyword, boolean constrainedDepartment) {
        String sql = "select e.user_id from hr_employees e where e.user_id <> :requester and e.employment_status = 'active' "
                + (constrainedDepartment ? "and e.department_id = :department " : "")
                + "and lower(coalesce(e.position_title, '')) like lower(:keyword) order by e.id limit 1";
        var query = entityManager.createNativeQuery(sql).setParameter("requester", requesterId).setParameter("keyword", "%" + keyword + "%");
        if (constrainedDepartment) query.setParameter("department", departmentId);
        @SuppressWarnings("unchecked") List<Number> values = query.getResultList();
        return values.isEmpty() ? null : values.getFirst().intValue();
    }

    private HriRequestStepSnapshot actionable(HriRequestMaster request, int actorId, String type) {
        if (request.current_step_order == null) throw ApiException.conflict("Current step is not set.");
        return entityManager.createQuery("""
                select s from HriRequestStepSnapshot s where s.request_id = :requestId and s.step_order = :order
                and s.actor_user_id = :actorId and s.step_type = :type and s.action_status = 'WAITING'
                """, HriRequestStepSnapshot.class).setParameter("requestId", request.id).setParameter("order", request.current_step_order)
                .setParameter("actorId", actorId).setParameter("type", type).setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> ApiException.forbidden("No actionable task for current user."));
    }

    private HriRequestStepSnapshot next(int requestId, int afterOrder, String type) {
        return entityManager.createQuery("""
                select s from HriRequestStepSnapshot s where s.request_id = :requestId and s.step_order > :afterOrder
                and s.step_type = :type and s.action_status = 'WAITING' order by s.step_order
                """, HriRequestStepSnapshot.class).setParameter("requestId", requestId).setParameter("afterOrder", afterOrder)
                .setParameter("type", type).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }

    private HriRequestStepSnapshot firstWaiting(int requestId, String type) {
        String query = "select s from HriRequestStepSnapshot s where s.request_id = :id and s.action_status = 'WAITING'"
                + (type == null ? "" : " and s.step_type = :type") + " order by s.step_order, s.id";
        var typed = entityManager.createQuery(query, HriRequestStepSnapshot.class).setParameter("id", requestId).setMaxResults(1);
        if (type != null) typed.setParameter("type", type);
        return typed.getResultStream().findFirst().orElse(null);
    }

    private void complete(HriRequestMaster request, Instant when) {
        request.status_code = "COMPLETED"; request.current_step_order = null; request.completed_at = when;
    }

    private void resetSnapshots(int requestId) { snapshots(requestId).forEach(entityManager::remove); entityManager.flush(); }
    private List<Map<String, Object>> snapshotLineage(int requestId) {
        return snapshots(requestId).stream().map(step -> nullableMap(
                "id", step.id, "step_order", step.step_order, "step_type", step.step_type,
                "actor_user_id", step.actor_user_id, "actor_name", step.actor_name,
                "actor_org_id", step.actor_org_id, "actor_role_code", step.actor_role_code,
                "action_status", step.action_status, "acted_at", step.acted_at,
                "comment", step.comment, "created_at", step.created_at, "updated_at", step.updated_at)).toList();
    }
    private List<HriRequestStepSnapshot> snapshots(int requestId) { return entityManager.createQuery("select s from HriRequestStepSnapshot s where s.request_id = :id order by s.step_order, s.id", HriRequestStepSnapshot.class).setParameter("id", requestId).getResultList(); }
    private List<HriApprovalLineStep> templateSteps(int templateId) { return entityManager.createQuery("select s from HriApprovalLineStep s where s.template_id = :id order by s.step_order, s.id", HriApprovalLineStep.class).setParameter("id", templateId).getResultList(); }
    private HriRequestMaster requestForUpdate(int id) { HriRequestMaster row = entityManager.find(HriRequestMaster.class, id, LockModeType.PESSIMISTIC_WRITE); if (row == null) throw ApiException.notFound("Request not found."); return row; }
    private HriFormType formType(int id) { HriFormType row = entityManager.find(HriFormType.class, id); if (row == null) throw ApiException.notFound("Form type not found."); return row; }

    private void history(int requestId, int actorId, String event, String from, String to, Map<String, Object> payload) {
        HriRequestHistory row = new HriRequestHistory(); row.request_id = requestId; row.actor_user_id = actorId;
        row.event_type = event; row.from_status = from; row.to_status = to; row.event_payload_json = json(payload); row.created_at = now(); entityManager.persist(row);
    }

    private void validateAttachmentPolicies(int requestId, Map<String, String> policies) {
        long count = entityManager.createQuery(
                "select count(a) from HriRequestAttachment a where a.request_id = :id", Long.class)
                .setParameter("id", requestId).getSingleResult();
        String required = policies.get("attachment_required");
        if (required != null && !Set.of("true", "false").contains(required.toLowerCase())) {
            throw ApiException.badRequest("Invalid boolean policy 'attachment_required'.");
        }
        if (Boolean.parseBoolean(required) && count == 0) {
            throw detailValidation("attachments", "At least one attachment is required for this form type.", List.of());
        }
        String maximum = policies.get("max_attachment_count");
        if (maximum != null) {
            int limit;
            try { limit = Integer.parseInt(maximum); } catch (NumberFormatException exception) {
                throw ApiException.badRequest("Invalid positive integer policy 'max_attachment_count'.");
            }
            if (limit <= 0) throw ApiException.badRequest("Invalid positive integer policy 'max_attachment_count'.");
            if (count > limit) throw detailValidation("attachments", "Attachment count exceeds max_attachment_count policy.", count);
        }
    }

    private ApiException detailValidation(String field, String message, Object input) {
        return ApiException.unprocessable(List.of(nullableMap(
                "type", "value_error", "loc", List.of("body", field), "msg", message, "input", input)));
    }

    private void writeDetail(String formCode, int requestId, Map<String, Object> content) {
        if ("TIM_CORRECTION".equals(formCode)) {
            HriReqTimCorrection row = one("select d from HriReqTimCorrection d where d.request_id = :id", HriReqTimCorrection.class, requestId);
            boolean isNew = row == null;
            if (isNew) { row = new HriReqTimCorrection(); row.request_id = requestId; row.created_at = now(); }
            row.work_date = date(content.get("work_date"), row.work_date); row.before_status = value(content.get("before_status"), value(row.before_status, "present"));
            row.after_status = value(content.get("after_status"), value(row.after_status, "present")); row.reason = string(content.get("reason")); row.updated_at = now();
            if (isNew) entityManager.persist(row);
        } else if ("CERT_EMPLOYMENT".equals(formCode)) {
            HriReqCertEmployment row = one("select d from HriReqCertEmployment d where d.request_id = :id", HriReqCertEmployment.class, requestId);
            boolean isNew = row == null;
            if (isNew) { row = new HriReqCertEmployment(); row.request_id = requestId; row.created_at = now(); }
            row.purpose = value(content.get("purpose"), value(row.purpose, "")); row.copies = number(content.get("copies"), row.copies == 0 ? 1 : row.copies);
            row.recipient = content.containsKey("recipient") ? string(content.get("recipient")) : row.recipient; row.reason = content.containsKey("reason") ? string(content.get("reason")) : row.reason; row.updated_at = now();
            if (isNew) entityManager.persist(row);
        } else if ("LEAVE_REQUEST".equals(formCode)) {
            HriReqLeave row = one("select d from HriReqLeave d where d.request_id = :id", HriReqLeave.class, requestId);
            boolean isNew = row == null;
            if (isNew) { row = new HriReqLeave(); row.request_id = requestId; row.created_at = now(); }
            row.leave_type_code = value(content.get("leave_type_code"), value(row.leave_type_code, "")); row.start_date = date(content.get("start_date"), row.start_date);
            row.end_date = date(content.get("end_date"), row.end_date); row.start_time = content.containsKey("start_time") ? string(content.get("start_time")) : row.start_time;
            row.end_time = content.containsKey("end_time") ? string(content.get("end_time")) : row.end_time; row.applied_minutes = number(content.get("applied_minutes"), row.applied_minutes == 0 ? 480 : row.applied_minutes);
            row.reason = content.containsKey("reason") ? string(content.get("reason")) : row.reason; row.updated_at = now();
            if (isNew) entityManager.persist(row);
        }
    }

    private Map<String, Object> readDetail(String formCode, int requestId) {
        if ("TIM_CORRECTION".equals(formCode)) { HriReqTimCorrection d = one("select d from HriReqTimCorrection d where d.request_id = :id", HriReqTimCorrection.class, requestId); if (d != null) return nullableMap("work_date", d.work_date.toString(), "before_status", d.before_status, "after_status", d.after_status, "reason", d.reason); }
        if ("CERT_EMPLOYMENT".equals(formCode)) { HriReqCertEmployment d = one("select d from HriReqCertEmployment d where d.request_id = :id", HriReqCertEmployment.class, requestId); if (d != null) return nullableMap("purpose", d.purpose, "copies", d.copies, "recipient", d.recipient, "reason", d.reason); }
        if ("LEAVE_REQUEST".equals(formCode)) { HriReqLeave d = one("select d from HriReqLeave d where d.request_id = :id", HriReqLeave.class, requestId); if (d != null) return nullableMap("leave_type_code", d.leave_type_code, "start_date", d.start_date.toString(), "end_date", d.end_date.toString(), "start_time", d.start_time, "end_time", d.end_time, "applied_minutes", d.applied_minutes, "reason", d.reason); }
        return Map.of();
    }

    private void syncWelfareProjection(HriRequestMaster request) {
        HriFormType form = entityManager.find(HriFormType.class, request.form_type_id);
        if (form == null || !"WEL_BENEFIT_REQUEST".equals(form.form_code)) return;
        Map<String, Object> content = map(read(request.content_json));
        EmployeeReference employee = employee(request.requester_id);
        UserReference requester = user(request.requester_id);
        String benefitCode = value(content.get("benefit_type_code"), "");
        welfareService.syncFromHri(new HriWelfareProjection(request.request_no, request.status_code, benefitCode,
                value(content.get("benefit_type_name"), ""), number(content.get("requested_amount"), 0),
                value(content.get("description"), value(content.get("reason"), "")), request.submitted_at, request.completed_at,
                request.created_at, request.updated_at, employee == null ? null : employee.id(),
                employee == null ? "USER-" + request.requester_id : employee.employeeNo(),
                requester == null ? (employee == null ? "USER-" + request.requester_id : employee.employeeNo()) : requester.displayName(),
                employee == null ? departmentName(request.requester_org_id) : departmentName(employee.departmentId())));
    }

    private EmployeeReference employee(int userId) {
        HriRequestProjectionMapper mapper = projectionMapper == null ? null : projectionMapper.getIfAvailable();
        if (mapper != null) {
            Map<String, Object> row = mapper.employeeForUser(userId);
            if (row != null && !row.isEmpty()) return new EmployeeReference(number(row.get("id"), 0), string(row.get("employee_no")), integer(row.get("department_id"), null));
        }
        @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("select id, employee_no, department_id from hr_employees where user_id = :id limit 1").setParameter("id", userId).getResultList();
        if (rows.isEmpty()) return null; Object[] row = rows.getFirst(); return new EmployeeReference(((Number) row[0]).intValue(), string(row[1]), row[2] == null ? null : ((Number) row[2]).intValue());
    }

    private UserReference user(int userId) {
        HriRequestProjectionMapper mapper = projectionMapper == null ? null : projectionMapper.getIfAvailable();
        if (mapper != null) { Map<String, Object> row = mapper.user(userId); if (row != null && !row.isEmpty()) return new UserReference(value(row.get("display_name"), value(row.get("login_id"), "USER-" + userId))); }
        @SuppressWarnings("unchecked") List<Object[]> rows = entityManager.createNativeQuery("select display_name, login_id from auth_users where id = :id limit 1").setParameter("id", userId).getResultList();
        if (rows.isEmpty()) return null; Object[] row = rows.getFirst(); return new UserReference(value(row[0], value(row[1], "USER-" + userId)));
    }

    private Integer requesterOrgId(int userId) { EmployeeReference employee = employee(userId); return employee == null ? null : employee.departmentId(); }
    private String departmentName(Integer id) { if (id == null) return "-"; HriRequestProjectionMapper mapper = projectionMapper == null ? null : projectionMapper.getIfAvailable(); if (mapper != null) { String name = mapper.departmentName(id); if (name != null) return name; } @SuppressWarnings("unchecked") List<String> names = entityManager.createNativeQuery("select name from org_departments where id = :id").setParameter("id", id).getResultList(); return names.isEmpty() ? "-" : names.getFirst(); }

    private HriRequestItem requestItem(HriRequestMaster row) {
        HriFormType form = entityManager.find(HriFormType.class, row.form_type_id); String actor = row.current_step_order == null ? null : snapshots(row.id).stream().filter(s -> s.step_order == row.current_step_order).map(s -> s.actor_name).findFirst().orElse(null);
        return new HriRequestItem(row.id, row.request_no, row.form_type_id, form == null ? null : form.form_name_ko, row.requester_id, row.title, row.status_code, row.current_step_order, actor, row.submitted_at, row.completed_at, row.created_at, row.updated_at, map(read(row.content_json)));
    }
    private HriTaskItem taskItem(HriRequestStepSnapshot step, HriRequestMaster request) { HriFormType form = entityManager.find(HriFormType.class, request.form_type_id); return new HriTaskItem(request.id, request.request_no, request.title, request.status_code, step.step_order, step.step_type, request.requester_id, request.created_at, form == null ? null : form.form_name_ko); }
    private HriFormTypeItem formItem(HriFormType row) { return new HriFormTypeItem(row.id, row.form_code, row.form_name_ko, row.form_name_en, row.module_code, row.is_active, row.allow_draft, row.allow_withdraw, row.requires_receive, row.default_priority, row.created_by, row.updated_by, row.created_at, row.updated_at); }
    private HriApprovalTemplateItem templateItem(HriApprovalLineTemplate row) { return new HriApprovalTemplateItem(row.id, row.template_code, row.template_name, row.scope_type, row.scope_id, row.is_default, row.is_active, row.priority, row.created_at, row.updated_at, templateSteps(row.id).stream().map(this::templateStepItem).toList()); }
    private HriApprovalTemplateStepItem templateStepItem(HriApprovalLineStep row) { return new HriApprovalTemplateStepItem(row.id, row.step_order, row.step_type, row.actor_resolve_type, row.actor_role_code, row.actor_user_id, row.allow_delegate, row.required_action, row.created_at, row.updated_at); }
    private HriRequestStepSnapshotItem snapshotItem(HriRequestStepSnapshot row) { return new HriRequestStepSnapshotItem(row.id, row.step_order, row.step_type, row.actor_name, row.action_status, row.acted_at, row.comment); }
    private HriRequestActionResponse action(HriRequestMaster row) { return new HriRequestActionResponse(row.id, row.status_code); }

    private String nextRequestNo(HriFormType form) {
        Instant now = now(); String month = YearMonth.from(now.atZone(ZoneOffset.UTC)).toString().replace("-", ""); String key = month + ":" + form.form_code.toUpperCase();
        lockNaturalKey("hri:request-counter:" + key);
        HriRequestCounter counter = entityManager.find(HriRequestCounter.class, key, LockModeType.PESSIMISTIC_WRITE);
        if (counter == null) {
            counter = new HriRequestCounter(); counter.counter_key = key; counter.last_seq = 1; counter.updated_at = now;
            entityManager.persist(counter);
        } else { counter.last_seq++; counter.updated_at = now; }
        entityManager.flush();
        return "HRI-" + month + "-%06d".formatted(counter.last_seq);
    }

    private <T> T one(String jpql, Class<T> type, int id) { return entityManager.createQuery(jpql, type).setParameter("id", id).setMaxResults(1).getResultStream().findFirst().orElse(null); }
    private boolean exists(String jpql, String parameter, String value) { return entityManager.createQuery(jpql, Long.class).setParameter(parameter, value).getSingleResult() > 0; }
    private <T> List<T> page(List<T> values, int page, int limit) { int start = Math.min((page - 1) * limit, values.size()); return new ArrayList<>(values.subList(start, Math.min(start + limit, values.size()))); }
    private static <T> List<T> items(List<T> values) { return values == null ? List.of() : values; }
    private void lockNaturalKey(String key) { entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtextextended(cast(:lockKey as text), 0))").setParameter("lockKey", key).getSingleResult(); }
    private List<String> keywords(String source) { if (source == null || source.isBlank()) return List.of(); try { return objectMapper.readValue(source, STRING_LIST).stream().filter(s -> s != null && !s.isBlank()).toList(); } catch (Exception ignored) { return List.of(); } }
    private Object read(String source) { try { return objectMapper.readValue(value(source, "{}"), Object.class); } catch (Exception ignored) { return Map.of(); } }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> source ? (Map<String, Object>) source : Map.of(); }
    private String json(Object value) { try { return objectMapper.writeValueAsString(value); } catch (Exception exception) { throw new IllegalStateException("HRI content cannot be serialized.", exception); } }
    private Map<String, Object> commentPayload(String comment) { return nullableMap("comment", comment); }
    private Map<String, Object> nullableMap(Object... pairs) { java.util.LinkedHashMap<String, Object> values = new java.util.LinkedHashMap<>(); for (int index = 0; index < pairs.length; index += 2) values.put(String.valueOf(pairs[index]), pairs[index + 1]); return values; }
    private LocalDate date(Object value, LocalDate current) {
        if (value == null) return current;
        try { return LocalDate.parse(String.valueOf(value)); }
        catch (RuntimeException exception) { throw detailValidation("date", "Input should be a valid date in YYYY-MM-DD format", value); }
    }
    private static Instant now() { return Instant.now(); }
    private static boolean bool(Boolean value, boolean fallback) { return value == null ? fallback : value; }
    private static int integer(Integer value, int fallback) { return value == null ? fallback : value; }
    private static Integer integer(Object value, Integer fallback) { if (value == null || "".equals(value)) return fallback; return value instanceof Number number ? number.intValue() : Integer.valueOf(String.valueOf(value)); }
    private static int number(Object value, int fallback) { try { return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value)); } catch (RuntimeException ignored) { return fallback; } }
    private static String string(Object value) { return value == null ? null : String.valueOf(value); }
    private static String value(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private static boolean notBlank(String value) { return value != null && !value.isBlank(); }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private record EmployeeReference(int id, String employeeNo, Integer departmentId) { }
    private record UserReference(String displayName) { }
}
