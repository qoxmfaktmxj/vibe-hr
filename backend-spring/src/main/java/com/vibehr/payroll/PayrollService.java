package com.vibehr.payroll;

import static com.vibehr.payroll.PayrollContracts.*;
import static com.vibehr.payroll.PayrollEntities.*;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Application transactions and calculation parity for all canonical PAY routes. */
@Service
public class PayrollService {
    private static final Logger log = LoggerFactory.getLogger(PayrollService.class);
    private static final Set<String> VOUCHER_RUN_STATUSES = Set.of("closed", "paid");
    private static final double ROUNDING_TOLERANCE = 1.0d;

    private final EntityManager entityManager;
    private final PayrollProjectionMapper projections;
    private final Clock clock;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public PayrollService(EntityManager entityManager, PayrollProjectionMapper projections, Clock clock, ObjectMapper objectMapper,
                          PlatformTransactionManager transactionManager) {
        this.entityManager = entityManager;
        this.projections = projections;
        this.clock = clock;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Transactional(readOnly = true)
    public PayrollCodeListResponse listPayrollCodes() {
        List<PayrollCodeItem> items = entityManager.createQuery("select c from PayrollCode c order by c.code", PayrollCode.class)
                .getResultList().stream().map(this::payrollCodeItem).toList();
        return new PayrollCodeListResponse(items, items.size());
    }

    @Transactional
    public PayrollCodeBatchResponse savePayrollCodes(PayrollCodeBatchRequest request) {
        int deleted = deleteByIds(PayrollCode.class, request.deleteIds());
        int inserted = 0;
        int updated = 0;
        for (PayrollCodeBatchItem item : request.items()) {
            PayrollCode row = item.id() != null && item.id() > 0 ? entityManager.find(PayrollCode.class, item.id()) : null;
            if (row == null) {
                String code = item.code().strip();
                if (exists("select c.id from PayrollCode c where c.code = :code", "code", code)) {
                    throw ApiException.conflict("급여코드 '" + item.code() + "'가 이미 존재합니다.");
                }
                row = new PayrollCode();
                row.createdAt = now();
                inserted++;
            } else updated++;
            row.code = item.code().strip(); row.name = item.name().strip(); row.payType = item.payType(); row.paymentDay = item.paymentDay();
            row.taxDeductible = bool(item.taxDeductible(), true); row.socialInsuranceDeductible = bool(item.socialInsDeductible(), true);
            row.active = bool(item.isActive(), true); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        PayrollCodeListResponse result = listPayrollCodes();
        return new PayrollCodeBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public TaxRateListResponse listTaxRates() {
        List<TaxRateItem> items = entityManager.createQuery("select r from TaxRate r order by r.year desc, r.id", TaxRate.class)
                .getResultList().stream().map(this::taxRateItem).toList();
        return new TaxRateListResponse(items, items.size());
    }

    @Transactional
    public TaxRateBatchResponse saveTaxRates(TaxRateBatchRequest request) {
        int deleted = deleteByIds(TaxRate.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (TaxRateBatchItem item : request.items()) {
            TaxRate row = item.id() != null && item.id() > 0 ? entityManager.find(TaxRate.class, item.id()) : null;
            if (row == null) {
                if (exists("select r.id from TaxRate r where r.year = :year and r.rateType = :type", Map.of("year", item.year(), "type", item.rateType().strip()))) {
                    throw ApiException.conflict("연도 '" + item.year() + "'에 해당하는 세율 '" + item.rateType() + "'가 이미 존재합니다.");
                }
                row = new TaxRate(); row.createdAt = now(); inserted++;
            } else updated++;
            row.year = item.year(); row.rateType = item.rateType().strip(); row.employeeRate = item.employeeRate(); row.employerRate = item.employerRate();
            row.minLimit = item.minLimit(); row.maxLimit = item.maxLimit(); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); TaxRateListResponse result = listTaxRates();
        return new TaxRateBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public IncomeTaxBracketListResponse listIncomeTaxBrackets() {
        List<IncomeTaxBracketItem> items = entityManager.createQuery("select b from IncomeTaxBracket b order by b.year desc, b.annualTaxableFrom", IncomeTaxBracket.class)
                .getResultList().stream().map(this::bracketItem).toList();
        return new IncomeTaxBracketListResponse(items, items.size());
    }

    @Transactional
    public IncomeTaxBracketBatchResponse saveIncomeTaxBrackets(IncomeTaxBracketBatchRequest request) {
        int deleted = deleteByIds(IncomeTaxBracket.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (IncomeTaxBracketBatchItem item : request.items()) {
            IncomeTaxBracket row = item.id() != null && item.id() > 0 ? entityManager.find(IncomeTaxBracket.class, item.id()) : null;
            if (row == null) {
                if (exists("select b.id from IncomeTaxBracket b where b.year = :year and b.annualTaxableFrom = :from", Map.of("year", item.year(), "from", item.annualTaxableFrom()))) {
                    throw ApiException.conflict("연도 '" + item.year() + "' 구간 '" + item.annualTaxableFrom() + "'이 이미 존재합니다.");
                }
                row = new IncomeTaxBracket(); row.createdAt = now(); inserted++;
            } else updated++;
            row.year = item.year(); row.annualTaxableFrom = item.annualTaxableFrom(); row.annualTaxableTo = item.annualTaxableTo();
            row.taxRate = item.taxRate(); row.quickDeduction = item.quickDeduction(); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); IncomeTaxBracketListResponse result = listIncomeTaxBrackets();
        return new IncomeTaxBracketBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public AllowanceDeductionListResponse listAllowanceDeductions() {
        List<AllowanceDeductionItem> items = entityManager.createQuery("select i from AllowanceDeduction i order by i.sortOrder", AllowanceDeduction.class)
                .getResultList().stream().map(this::allowanceItem).toList();
        return new AllowanceDeductionListResponse(items, items.size());
    }

    @Transactional
    public AllowanceDeductionBatchResponse saveAllowanceDeductions(AllowanceDeductionBatchRequest request) {
        int deleted = deleteByIds(AllowanceDeduction.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (AllowanceDeductionBatchItem item : request.items()) {
            AllowanceDeduction row = item.id() != null && item.id() > 0 ? entityManager.find(AllowanceDeduction.class, item.id()) : null;
            if (row == null) {
                String code = item.code().strip();
                if (exists("select i.id from AllowanceDeduction i where i.code = :code", "code", code)) {
                    throw ApiException.conflict("수당/공제항목 '" + item.code() + "'가 이미 존재합니다.");
                }
                row = new AllowanceDeduction(); row.createdAt = now(); inserted++;
            } else updated++;
            row.code = item.code().strip(); row.name = item.name().strip(); row.type = item.type(); row.taxType = item.taxType();
            row.calculationType = stringDefault(item.calculationType(), "fixed"); row.active = bool(item.isActive(), true); row.sortOrder = intDefault(item.sortOrder(), 0); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); AllowanceDeductionListResponse result = listAllowanceDeductions();
        return new AllowanceDeductionBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public ItemGroupListResponse listItemGroups() {
        List<ItemGroupItem> items = entityManager.createQuery("select g from ItemGroup g order by g.code", ItemGroup.class).getResultList()
                .stream().map(this::itemGroupItem).toList();
        return new ItemGroupListResponse(items, items.size());
    }

    @Transactional
    public ItemGroupBatchResponse saveItemGroups(ItemGroupBatchRequest request) {
        int deleted = 0;
        for (Integer id : ids(request.deleteIds())) {
            ItemGroup group = entityManager.find(ItemGroup.class, id);
            if (group != null) {
                entityManager.createQuery("delete from ItemGroupDetail d where d.groupId = :id").setParameter("id", id).executeUpdate();
                entityManager.remove(group); deleted++;
            }
        }
        int inserted = 0; int updated = 0;
        for (ItemGroupBatchItem item : request.items()) {
            ItemGroup row = item.id() != null && item.id() > 0 ? entityManager.find(ItemGroup.class, item.id()) : null;
            if (row == null) {
                String code = item.code().strip();
                if (exists("select g.id from ItemGroup g where g.code = :code", "code", code)) throw ApiException.conflict("항목그룹 '" + item.code() + "'가 이미 존재합니다.");
                row = new ItemGroup(); row.createdAt = now(); inserted++;
            } else updated++;
            row.code = item.code().strip(); row.name = item.name().strip(); row.description = item.description(); row.active = bool(item.isActive(), true); row.updatedAt = now();
            if (row.id == null) { entityManager.persist(row); entityManager.flush(); }
            if (item.details() != null) replaceItemGroupDetails(row.id, item.details());
        }
        entityManager.flush(); ItemGroupListResponse result = listItemGroups();
        return new ItemGroupBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public GlAccountListResponse listGlAccounts() {
        List<GlAccountItem> items = entityManager.createQuery("select a from GlAccount a order by a.sortOrder, a.code", GlAccount.class)
                .getResultList().stream().map(this::glAccountItem).toList();
        return new GlAccountListResponse(items, items.size());
    }

    @Transactional
    public GlAccountBatchResponse saveGlAccounts(GlAccountBatchRequest request) {
        int deleted = deleteByIds(GlAccount.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (GlAccountBatchItem item : request.items()) {
            GlAccount row = item.id() != null && item.id() > 0 ? entityManager.find(GlAccount.class, item.id()) : null;
            if (row == null) {
                if (exists("select a.id from GlAccount a where a.code = :code", "code", item.code())) throw ApiException.conflict("gl_account code '" + item.code() + "' already exists.");
                row = new GlAccount(); row.createdAt = now(); inserted++;
            } else updated++;
            row.code = item.code(); row.name = item.name(); row.accountType = item.accountType(); row.netPayAccount = bool(item.isNetPayAccount(), false);
            row.cashAccount = bool(item.isCashAccount(), false); row.active = bool(item.isActive(), true); row.sortOrder = intDefault(item.sortOrder(), 0); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); GlAccountListResponse result = listGlAccounts();
        return new GlAccountBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public GlMappingListResponse listGlMappings() {
        Map<String, String> names = allowanceNames(); Map<String, String> accounts = accountNames();
        List<GlMappingItem> items = entityManager.createQuery("select m from GlMapping m order by m.payItemCode, m.effectiveFrom desc", GlMapping.class)
                .getResultList().stream().map(row -> glMappingItem(row, names, accounts)).toList();
        return new GlMappingListResponse(items, items.size());
    }

    @Transactional
    public GlMappingBatchResponse saveGlMappings(GlMappingBatchRequest request) {
        int deleted = deleteByIds(GlMapping.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (GlMappingBatchItem item : request.items()) {
            if (!exists("select a.id from GlAccount a where a.code = :code", "code", item.glAccountCode())) throw ApiException.badRequest("Invalid gl_account_code: " + item.glAccountCode());
            GlMapping row = item.id() != null && item.id() > 0 ? entityManager.find(GlMapping.class, item.id()) : null;
            if (row == null) {
                if (exists("select m.id from GlMapping m where m.payItemCode = :item and m.effectiveFrom = :date", Map.of("item", item.payItemCode(), "date", item.effectiveFrom()))) {
                    throw ApiException.conflict("pay_item_code '" + item.payItemCode() + "' already has mapping for effective_from '" + item.effectiveFrom() + "'.");
                }
                row = new GlMapping(); row.createdAt = now(); inserted++;
            } else updated++;
            row.payItemCode = item.payItemCode(); row.glAccountCode = item.glAccountCode(); row.effectiveFrom = item.effectiveFrom(); row.note = item.note(); row.active = bool(item.isActive(), true); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); GlMappingListResponse result = listGlMappings();
        return new GlMappingBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public SeveranceItemRuleListResponse listSeveranceItemRules() {
        Map<String, String> names = allowanceNames();
        List<SeveranceItemRuleItem> items = entityManager.createQuery("select r from SeveranceItemRule r order by r.payItemCode", SeveranceItemRule.class).getResultList()
                .stream().map(row -> ruleItem(row, names)).toList();
        return new SeveranceItemRuleListResponse(items, items.size());
    }

    @Transactional
    public SeveranceItemRuleBatchResponse saveSeveranceItemRules(SeveranceItemRuleBatchRequest request) {
        int deleted = deleteByIds(SeveranceItemRule.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (SeveranceItemRuleBatchItem item : request.items()) {
            SeveranceItemRule row = item.id() != null && item.id() > 0 ? entityManager.find(SeveranceItemRule.class, item.id()) : null;
            if (row == null) {
                if (exists("select r.id from SeveranceItemRule r where r.payItemCode = :code", "code", item.payItemCode())) {
                    throw ApiException.conflict("pay_item_code '" + item.payItemCode() + "' already exists.");
                }
                row = new SeveranceItemRule(); row.createdAt = now(); inserted++;
            } else updated++;
            row.payItemCode = item.payItemCode(); row.includeType = item.includeType(); row.note = item.note(); row.active = bool(item.isActive(), true); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); SeveranceItemRuleListResponse result = listSeveranceItemRules();
        return new SeveranceItemRuleBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public EmployeeProfileListResponse listEmployeeProfiles() {
        Map<Integer, EmployeeReference> employees = employeeReferences(entityManager.createQuery("select p.employeeId from EmployeeProfile p", Integer.class).getResultList());
        Map<Integer, String> codes = payrollCodeNames(); Map<Integer, String> groups = itemGroupNames();
        List<EmployeeProfileItem> items = entityManager.createQuery("select p from EmployeeProfile p order by p.employeeId, p.effectiveFrom desc", EmployeeProfile.class).getResultList()
                .stream().map(row -> profileItem(row, employees.get(row.employeeId), codes, groups)).toList();
        return new EmployeeProfileListResponse(items, items.size());
    }

    @Transactional
    public EmployeeProfileBatchResponse saveEmployeeProfiles(EmployeeProfileBatchRequest request) {
        int deleted = deleteByIds(EmployeeProfile.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (EmployeeProfileBatchItem item : request.items()) {
            if (entityManager.find(PayrollCode.class, item.payrollCodeId()) == null) throw ApiException.badRequest("Invalid payroll_code_id: " + item.payrollCodeId());
            if (item.itemGroupId() != null && entityManager.find(ItemGroup.class, item.itemGroupId()) == null) throw ApiException.badRequest("Invalid item_group_id: " + item.itemGroupId());
            EmployeeProfile row = item.id() != null && item.id() > 0 ? entityManager.find(EmployeeProfile.class, item.id()) : null;
            if (row == null) {
                if (exists("select p.id from EmployeeProfile p where p.employeeId = :employee and p.effectiveFrom = :date", Map.of("employee", item.employeeId(), "date", item.effectiveFrom()))) {
                    throw ApiException.conflict("employee_id '" + item.employeeId() + "' already has profile for effective_from '" + item.effectiveFrom() + "'.");
                }
                row = new EmployeeProfile(); row.createdAt = now(); inserted++;
            } else updated++;
            row.employeeId = item.employeeId(); row.payrollCodeId = item.payrollCodeId(); row.itemGroupId = item.itemGroupId(); row.baseSalary = doubleDefault(item.baseSalary(), 0); row.payTypeCode = stringDefault(item.payTypeCode(), "regular");
            row.paymentDayType = stringDefault(item.paymentDayType(), "fixed_day"); row.paymentDayValue = item.paymentDayValue(); row.holidayAdjustment = stringDefault(item.holidayAdjustment(), "previous_business_day"); row.effectiveFrom = item.effectiveFrom(); row.effectiveTo = item.effectiveTo(); row.active = bool(item.isActive(), true); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush(); EmployeeProfileListResponse result = listEmployeeProfiles();
        return new EmployeeProfileBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public VariableInputListResponse listVariableInputs(String yearMonth) {
        String query = "select v from VariableInput v" + (blank(yearMonth) ? "" : " where v.yearMonth = :yearMonth") + " order by v.yearMonth desc, v.employeeId";
        var typed = entityManager.createQuery(query, VariableInput.class); if (!blank(yearMonth)) typed.setParameter("yearMonth", yearMonth);
        List<VariableInput> rows = typed.getResultList(); Map<Integer, EmployeeReference> employees = employeeReferences(rows.stream().map(row -> row.employeeId).toList()); Map<String, String> names = allowanceNames();
        List<VariableInputItem> items = rows.stream().map(row -> variableItem(row, employees.get(row.employeeId), names)).toList();
        return new VariableInputListResponse(items, items.size());
    }

    @Transactional
    public VariableInputBatchResponse saveVariableInputs(VariableInputBatchRequest request) {
        int deleted = deleteByIds(VariableInput.class, request.deleteIds()); int inserted = 0; int updated = 0;
        for (VariableInputBatchItem item : request.items()) {
            parseYearMonth(item.yearMonth());
            if (!employeeExists(item.employeeId())) throw ApiException.badRequest("Invalid employee_id: " + item.employeeId());
            if (!exists("select a.id from AllowanceDeduction a where a.code = :code", "code", item.itemCode())) throw ApiException.badRequest("Invalid item_code: " + item.itemCode());
            VariableInput row = item.id() != null && item.id() > 0 ? entityManager.find(VariableInput.class, item.id()) : null;
            if (row == null) {
                String itemCode = item.itemCode().strip();
                if (exists("select v.id from VariableInput v where v.yearMonth = :month and v.employeeId = :employee and v.itemCode = :code", Map.of("month", item.yearMonth(), "employee", item.employeeId(), "code", itemCode))) {
                    throw ApiException.conflict("year_month '" + item.yearMonth() + "', employee_id '" + item.employeeId() + "', item_code '" + item.itemCode() + "' already exists.");
                }
                row = new VariableInput(); row.createdAt = now(); inserted++;
            } else updated++;
            row.yearMonth = item.yearMonth(); row.employeeId = item.employeeId(); row.itemCode = item.itemCode().strip(); row.direction = item.direction(); row.amount = item.amount(); row.memo = item.memo(); row.updatedAt = now();
            if (row.id == null) entityManager.persist(row);
        }
        entityManager.flush();
        String resultMonth = request.items().stream().map(VariableInputBatchItem::yearMonth).distinct().count() == 1 && !request.items().isEmpty() ? request.items().getFirst().yearMonth() : null;
        VariableInputListResponse result = listVariableInputs(resultMonth);
        return new VariableInputBatchResponse(result.items(), result.totalCount(), inserted, updated, deleted);
    }

    @Transactional(readOnly = true)
    public PayrollRunListResponse listPayrollRuns(String yearMonth, String status) {
        StringBuilder jpql = new StringBuilder("select r from PayrollRun r where 1 = 1");
        if (!blank(yearMonth)) jpql.append(" and r.yearMonth = :yearMonth");
        if (!blank(status)) jpql.append(" and r.status = :status");
        jpql.append(" order by r.yearMonth desc, r.id desc");
        var query = entityManager.createQuery(jpql.toString(), PayrollRun.class);
        if (!blank(yearMonth)) query.setParameter("yearMonth", yearMonth);
        if (!blank(status)) query.setParameter("status", status);
        Map<Integer, String> codeNames = payrollCodeNames();
        List<PayrollRunItem> items = query.getResultList().stream().map(row -> payrollRunItem(row, codeNames)).toList();
        return new PayrollRunListResponse(items, items.size());
    }

    @Transactional
    public PayrollRunActionResponse createPayrollRun(PayrollRunCreateRequest request) {
        YearMonth period = parseYearMonth(request.yearMonth());
        PayrollCode code = entityManager.find(PayrollCode.class, request.payrollCodeId());
        if (code == null) throw ApiException.badRequest("Invalid payroll_code_id: " + request.payrollCodeId());
        advisoryLock("payroll-run:" + request.yearMonth() + ":" + request.payrollCodeId());
        if (exists("select r.id from PayrollRun r where r.yearMonth = :month and r.payrollCodeId = :code", Map.of("month", request.yearMonth(), "code", request.payrollCodeId()))) {
            throw ApiException.conflict("Payroll run already exists for year_month + payroll_code.");
        }
        PayrollRun run = new PayrollRun();
        run.yearMonth = request.yearMonth(); run.payrollCodeId = request.payrollCodeId(); run.runName = request.runName(); run.status = "draft";
        run.totalEmployees = 0; run.totalGross = 0; run.totalDeductions = 0; run.totalNet = 0; run.createdAt = now(); run.updatedAt = now();
        entityManager.persist(run); entityManager.flush();
        Materialization materialization = materializeTargets(run, period, true);
        addRunEvent(run.id, "created", "Payroll run created.");
        addRunEvent(run.id, "snapshot_created", "Payroll target snapshot created for " + materialization.targetCount() + " employees (" + materialization.eventCount() + " events).");
        entityManager.flush();
        return new PayrollRunActionResponse(payrollRunItem(run, Map.of(run.payrollCodeId, code.name)));
    }

    @Transactional
    public PayrollRunActionResponse calculatePayrollRun(int runId) {
        PayrollRun run = lockRun(runId);
        calculateLocked(run);
        return runAction(run);
    }

    @Transactional
    public PayrollRunActionResponse refreshPayrollRunSnapshot(int runId) {
        PayrollRun run = lockRun(runId);
        if (Set.of("closed", "paid").contains(run.status)) throw ApiException.conflict("Closed/paid run cannot refresh snapshot.");
        Materialization materialization = materializeTargets(run, parseYearMonth(run.yearMonth), true);
        run.updatedAt = now();
        addRunEvent(run.id, "snapshot_refreshed", "Payroll target snapshot refreshed for " + materialization.targetCount() + " employees (" + materialization.eventCount() + " events).");
        if ("calculated".equals(run.status)) calculateLocked(run);
        return runAction(run);
    }

    public PayrollRunActionResponse closePayrollRun(int runId) {
        PayrollRunActionResponse response = transactionTemplate.execute(status -> {
            PayrollRun run = lockRun(runId);
            if (!"calculated".equals(run.status)) throw ApiException.conflict("Only calculated run can be closed.");
            run.status = "closed"; run.closedAt = now(); run.updatedAt = now(); addRunEvent(run.id, "closed", "Payroll run closed.");
            entityManager.flush();
            return runAction(run);
        });
        try {
            transactionTemplate.executeWithoutResult(status -> generateVoucherLocked(lockRun(runId), null, "accrual"));
        } catch (RuntimeException exception) {
            logAutomaticVoucherFailure(runId, exception);
        }
        return Objects.requireNonNull(response);
    }

    @Transactional
    public PayrollRunActionResponse markPayrollRunPaid(int runId) {
        PayrollRun run = lockRun(runId);
        if (!"closed".equals(run.status)) throw ApiException.conflict("Only closed run can be marked paid.");
        run.status = "paid"; run.paidAt = now(); run.updatedAt = now(); addRunEvent(run.id, "paid", "Payroll run marked as paid.");
        return runAction(run);
    }

    @Transactional(readOnly = true)
    public PayrollRunEmployeeListResponse listPayrollRunEmployees(int runId) {
        if (entityManager.find(PayrollRun.class, runId) == null) throw ApiException.notFound("Payroll run not found.");
        List<PayrollRunEmployeeItem> items = projections.findRunEmployees(runId).stream().map(this::runEmployeeItem).toList();
        return new PayrollRunEmployeeListResponse(items, items.size());
    }

    @Transactional(readOnly = true)
    public PayrollRunEmployeeDetailResponse payrollRunEmployeeDetail(int runId, int runEmployeeId) {
        if (entityManager.find(PayrollRun.class, runId) == null) throw ApiException.notFound("Payroll run not found.");
        PayrollRunEmployee employee = entityManager.find(PayrollRunEmployee.class, runEmployeeId);
        if (employee == null || employee.runId != runId) throw ApiException.notFound("Run employee not found.");
        PayrollRunEmployeeItem responseEmployee = projections.findRunEmployees(runId).stream()
                .filter(row -> row.id() == runEmployeeId).findFirst().map(this::runEmployeeItem)
                .orElseGet(() -> fallbackRunEmployeeItem(employee));
        List<PayrollRunEmployeeDetailItem> items = entityManager.createQuery("select i from RunItemEntity i where i.runEmployeeId = :id order by i.id", RunItemEntity.class)
                .setParameter("id", runEmployeeId).getResultList().stream().map(this::runItemDetail).toList();
        return new PayrollRunEmployeeDetailResponse(responseEmployee, items);
    }

    @Transactional(readOnly = true)
    public MyPayslipListResponse listMyPayslips(int employeeId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select r.id, re.id, r.year_month, r.run_name, r.status, re.gross_pay, re.taxable_income,
                       re.non_taxable_income, re.total_deductions, re.net_pay, r.paid_at
                  from pay_payroll_run_employees re
                  join pay_payroll_runs r on r.id = re.run_id
                 where re.employee_id = :employeeId and r.status in ('closed', 'paid')
                 order by r.year_month desc
                """).setParameter("employeeId", employeeId).getResultList();
        List<MyPayslipSummary> items = rows.stream().map(this::payslipSummary).toList();
        return new MyPayslipListResponse(items, items.size());
    }

    @Transactional(readOnly = true)
    public int employeeIdForUser(int userId) {
        @SuppressWarnings("unchecked")
        List<Number> employeeIds = entityManager.createNativeQuery("select id from hr_employees where user_id = :userId")
                .setParameter("userId", userId)
                .getResultList();
        if (employeeIds.isEmpty()) throw ApiException.notFound("직원 정보를 찾을 수 없습니다.");
        return employeeIds.getFirst().intValue();
    }

    @Transactional(readOnly = true)
    public MyPayslipDetailResponse myPayslipDetail(int employeeId, int runId) {
        PayrollRun run = entityManager.find(PayrollRun.class, runId);
        if (run == null || !("closed".equals(run.status) || "paid".equals(run.status))) throw payslipNotFound();
        PayrollRunEmployee row = findRunEmployee(runId, employeeId).orElseThrow(this::payslipNotFound);
        MyPayslipSummary summary = new MyPayslipSummary(run.id, row.id, run.yearMonth, run.runName, run.status, row.grossPay,
                row.taxableIncome, row.nonTaxableIncome, row.totalDeductions, row.netPay, run.paidAt);
        List<PayrollRunEmployeeDetailItem> items = entityManager.createQuery("select i from RunItemEntity i where i.runEmployeeId = :id order by i.id", RunItemEntity.class)
                .setParameter("id", row.id).getResultList().stream().map(this::runItemDetail).toList();
        return new MyPayslipDetailResponse(summary, items);
    }

    @Transactional
    public VoucherActionResponse generateVoucher(int runId, Integer createdBy) {
        return generateVoucherLocked(lockRun(runId), createdBy, "accrual");
    }

    @Transactional
    public VoucherActionResponse generateDisbursementVoucher(int runId, Integer createdBy) {
        return generateVoucherLocked(lockRun(runId), createdBy, "disbursement");
    }

    @Transactional(readOnly = true)
    public VoucherListResponse listVouchers(String yearMonth, String status) {
        StringBuilder jpql = new StringBuilder("select v from Voucher v where 1 = 1");
        if (!blank(status)) jpql.append(" and v.status = :status");
        jpql.append(" order by v.voucherDate desc, v.id desc");
        var query = entityManager.createQuery(jpql.toString(), Voucher.class); if (!blank(status)) query.setParameter("status", status);
        List<Voucher> rows = query.getResultList();
        Map<Integer, String> runMonths = runMonths(rows.stream().map(v -> v.runId).toList());
        List<VoucherItem> items = rows.stream().filter(row -> blank(yearMonth) || yearMonth.equals(runMonths.get(row.runId)))
                .map(row -> voucherItem(row, runMonths.get(row.runId))).toList();
        return new VoucherListResponse(items, items.size());
    }

    @Transactional(readOnly = true)
    public MappingGapsResponse mappingGaps(int runId) {
        PayrollRun run = entityManager.find(PayrollRun.class, runId);
        if (run == null) throw ApiException.notFound("Payroll run not found.");
        List<RunItemEntity> items = runItems(runId); List<GlMapping> mappings = entityManager.createQuery("select m from GlMapping m", GlMapping.class).getResultList();
        Map<String, String> names = allowanceNames(); List<MappingGapItem> gaps = new ArrayList<>(); Set<String> seen = new java.util.HashSet<>();
        LocalDate asOf = run.closedAt == null ? today() : run.closedAt.toLocalDate();
        for (RunItemEntity item : items) if (seen.add(item.itemCode) && activeMapping(mappings, item.itemCode, asOf) == null) gaps.add(new MappingGapItem(item.itemCode, names.get(item.itemCode), item.direction));
        return new MappingGapsResponse(runId, gaps);
    }

    @Transactional(readOnly = true)
    public VoucherDetailResponse voucherDetail(int voucherId) {
        Voucher voucher = entityManager.find(Voucher.class, voucherId); if (voucher == null) throw ApiException.notFound("Voucher not found.");
        Map<String, String> names = accountNames();
        List<VoucherLineItem> lines = voucherLines(voucherId).stream().map(line -> voucherLineItem(line, names)).toList();
        return new VoucherDetailResponse(voucherItem(voucher, runMonths(List.of(voucher.runId)).get(voucher.runId)), lines);
    }

    @Transactional
    public VoucherActionResponse confirmVoucher(int voucherId, Integer confirmedBy) {
        Voucher voucher = entityManager.find(Voucher.class, voucherId, LockModeType.PESSIMISTIC_WRITE); if (voucher == null) throw ApiException.notFound("Voucher not found.");
        if (!"draft".equals(voucher.status)) throw ApiException.conflict("Only draft voucher can be confirmed.");
        voucher.status = "confirmed"; voucher.confirmedBy = confirmedBy; voucher.confirmedAt = now(); voucher.updatedAt = now();
        return new VoucherActionResponse(voucherItem(voucher, runMonths(List.of(voucher.runId)).get(voucher.runId)));
    }

    @Transactional
    public VoucherActionResponse cancelVoucher(int voucherId) {
        Voucher voucher = entityManager.find(Voucher.class, voucherId, LockModeType.PESSIMISTIC_WRITE); if (voucher == null) throw ApiException.notFound("Voucher not found.");
        if (!("draft".equals(voucher.status) || "confirmed".equals(voucher.status))) throw ApiException.conflict("Only draft or confirmed voucher can be cancelled.");
        voucher.status = "cancelled"; voucher.updatedAt = now();
        return new VoucherActionResponse(voucherItem(voucher, runMonths(List.of(voucher.runId)).get(voucher.runId)));
    }

    @Transactional(readOnly = true)
    public VoucherExport voucherExport(int voucherId) {
        Voucher voucher = entityManager.find(Voucher.class, voucherId); if (voucher == null) throw ApiException.notFound("Voucher not found.");
        if (!"confirmed".equals(voucher.status)) throw ApiException.conflict("Only confirmed voucher can be exported.");
        Map<String, String> names = accountNames();
        List<VoucherExportLine> lines = voucherLines(voucherId).stream().map(line -> new VoucherExportLine(voucher.voucherNo, voucher.voucherDate, line.lineNo,
                line.glAccountCode, names.getOrDefault(line.glAccountCode, ""), line.costCenterCode == null ? "" : line.costCenterCode,
                line.debitAmount, line.creditAmount, line.summary == null ? "" : line.summary)).toList();
        return new VoucherExport(voucher.voucherNo, voucher.voucherDate, voucher.voucherType, lines);
    }

    public record VoucherExport(String voucherNo, LocalDate voucherDate, String voucherType, List<VoucherExportLine> lines) { }
    public record VoucherExportLine(String voucherNo, LocalDate voucherDate, int lineNo, String glAccountCode,
            String glAccountName, String costCenterCode, double debit, double credit, String summary) { }

    private void calculateLocked(PayrollRun run) {
        if (Set.of("closed", "paid").contains(run.status)) throw ApiException.conflict("Closed/paid run cannot be recalculated.");
        YearMonth period = parseYearMonth(run.yearMonth);
        List<PayrollRunTarget> targets = entityManager.createQuery("select t from PayrollRunTarget t where t.runId = :runId order by t.employeeId, t.id", PayrollRunTarget.class)
                .setParameter("runId", run.id).getResultList();
        if (targets.isEmpty()) targets = materializeTargetsAndRead(run, period);

        List<Integer> priorIds = entityManager.createQuery("select e.id from PayrollRunEmployee e where e.runId = :runId", Integer.class)
                .setParameter("runId", run.id).getResultList();
        if (!priorIds.isEmpty()) {
            entityManager.createQuery("delete from RunItemEntity i where i.runEmployeeId in :ids").setParameter("ids", priorIds).executeUpdate();
            entityManager.createQuery("delete from PayrollRunEmployee e where e.id in :ids").setParameter("ids", priorIds).executeUpdate();
        }
        Map<Integer, List<VariableInput>> variables = variablesByEmployee(run.yearMonth, targets.stream().map(t -> t.employeeId).toList());
        Map<Integer, List<PayrollRunTargetEvent>> targetEvents = targetEventsByEmployee(run.id);
        Map<String, AllowanceDeduction> allowances = allowanceDefinitions();
        Map<Integer, List<PayrollProjectionMapper.WelfareProjection>> welfare = welfareRequestsByEmployee(run, targets, true);
        List<TaxRate> taxRates = entityManager.createQuery("select r from TaxRate r where r.year = :year", TaxRate.class).setParameter("year", period.getYear()).getResultList();
        List<IncomeTaxBracket> brackets = entityManager.createQuery("select b from IncomeTaxBracket b where b.year = :year order by b.annualTaxableFrom", IncomeTaxBracket.class).setParameter("year", period.getYear()).getResultList();

        int count = 0; int reviewTargetCount = 0; double totalGross = 0; double totalDeductions = 0; double totalNet = 0;
        for (PayrollRunTarget target : targets) {
            Snapshot snapshot = snapshot(target.snapshotJson);
            double baseSalary = snapshot.baseSalary;
            double gross = baseSalary, taxable = baseSalary, nonTaxable = 0, deductions = 0;
            PayrollRunEmployee employee = new PayrollRunEmployee();
            employee.runId = run.id; employee.employeeId = target.employeeId; employee.profileId = target.profileId; employee.status = "ok";
            employee.grossPay = 0; employee.taxableIncome = 0; employee.nonTaxableIncome = 0; employee.totalDeductions = 0; employee.netPay = 0; employee.createdAt = now(); employee.updatedAt = now();
            entityManager.persist(employee); entityManager.flush();
            addRunItem(employee.id, "BSC", "기본급", "earning", money(baseSalary), "taxable", "fixed", "snapshot");
            List<String> warnings = new ArrayList<>();
            List<PayrollRunTargetEvent> reviewEvents = targetEvents.getOrDefault(target.employeeId, List.of()).stream()
                    .filter(event -> "review".equals(event.decisionCode)).toList();
            if (!reviewEvents.isEmpty()) {
                warnings.add("payroll events: " + String.join(", ", reviewEvents.stream().map(event -> event.eventName).toList()));
                reviewTargetCount++;
            }
            for (VariableInput variable : variables.getOrDefault(target.employeeId, List.of())) {
                AllowanceDeduction definition = allowances.get(variable.itemCode);
                String taxType = definition == null ? "taxable" : definition.taxType;
                if ("earning".equals(variable.direction)) {
                    gross += variable.amount;
                    if ("non-taxable".equals(taxType)) nonTaxable += variable.amount; else taxable += variable.amount;
                } else deductions += variable.amount;
                addRunItem(employee.id, variable.itemCode, definition == null ? variable.itemCode : definition.name, variable.direction,
                        money(variable.amount), taxType, definition == null ? "manual" : definition.calculationType, "variable");
            }
            for (PayrollProjectionMapper.WelfareProjection request : welfare.getOrDefault(target.employeeId, List.of())) {
                double amount = request.amount();
                if (amount <= 0) continue;
                String code = blank(request.payItemCode()) ? request.benefitTypeCode() : request.payItemCode();
                AllowanceDeduction definition = allowances.get(code);
                String direction = request.deduction() ? "deduction" : "earning";
                String name = definition == null
                        ? (blank(request.benefitTypeName()) ? request.benefitMasterName() : request.benefitTypeName())
                        : definition.name;
                String taxType = definition == null ? (request.deduction() ? "tax" : "taxable") : definition.taxType;
                String calculationType = definition == null ? "fixed" : definition.calculationType;
                if ("earning".equals(direction)) {
                    gross += amount;
                    if ("non-taxable".equals(taxType)) nonTaxable += amount; else taxable += amount;
                } else deductions += amount;
                addRunItem(employee.id, code, name, direction, money(amount), taxType, calculationType, "welfare");
            }
            StatutoryDeductions statutory = statutoryDeductions(taxable, allowances, taxRates, brackets);
            warnings.addAll(statutory.warnings());
            for (Deduction deduction : statutory.items()) {
                deductions += deduction.amount();
                addRunItem(employee.id, deduction.code(), deduction.name(), "deduction", deduction.amount(), deduction.taxType(), deduction.calculationType(), "system");
            }
            double net = money(gross - deductions);
            if (net < 0) warnings.add("net_pay is negative");
            employee.grossPay = money(gross); employee.taxableIncome = money(taxable); employee.nonTaxableIncome = money(nonTaxable);
            employee.totalDeductions = money(deductions); employee.netPay = net; employee.status = warnings.isEmpty() ? "ok" : "warning";
            employee.warningMessage = warnings.isEmpty() ? null : String.join("; ", warnings); employee.updatedAt = now();
            count++; totalGross += employee.grossPay; totalDeductions += employee.totalDeductions; totalNet += employee.netPay;
        }
        run.totalEmployees = count; run.totalGross = money(totalGross); run.totalDeductions = money(totalDeductions); run.totalNet = money(totalNet);
        run.status = "calculated"; run.calculatedAt = now(); run.updatedAt = now();
        addRunEvent(run.id, "calculated", "Payroll calculated for " + count + " employees (review targets: " + reviewTargetCount + ").");
    }

    private VoucherActionResponse generateVoucherLocked(PayrollRun run, Integer createdBy, String voucherType) {
        if ("accrual".equals(voucherType)) return generateAccrualVoucher(run, createdBy);
        return generateDisbursement(run, createdBy);
    }

    private VoucherActionResponse generateAccrualVoucher(PayrollRun run, Integer createdBy) {
        if (!VOUCHER_RUN_STATUSES.contains(run.status)) throw ApiException.conflict("Run status must be one of [closed, paid] to generate a voucher. Current: " + run.status);
        Voucher existing = findVoucher(run.id, "accrual").orElse(null);
        if (existing != null && !"draft".equals(existing.status)) throw ApiException.conflict("Voucher already confirmed or cancelled for this run; regeneration is only allowed before confirm.");
        List<RunItemWithEmployee> sourceItems = runItemsWithEmployees(run.id);
        if (sourceItems.isEmpty()) throw ApiException.badRequest("Run has no payroll items to generate a voucher from.");
        GlAccount netPayAccount = entityManager.createQuery("select a from GlAccount a where a.netPayAccount = true", GlAccount.class).setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> ApiException.badRequest("No GL account flagged as is_net_pay_account."));
        List<GlMapping> mappings = entityManager.createQuery("select m from GlMapping m", GlMapping.class).getResultList(); LocalDate asOf = run.closedAt == null ? today() : run.closedAt.toLocalDate();
        Map<String, String> itemNames = allowanceNames(); Map<Integer, String> centers = costCenters(sourceItems.stream().map(RunItemWithEmployee::employeeId).toList());
        Map<AggregationKey, Double> earnings = new LinkedHashMap<>(), deductions = new LinkedHashMap<>(); Map<String, Double> netByCenter = new LinkedHashMap<>(); List<String> missing = new ArrayList<>();
        Map<Integer, Double> employeeNet = new HashMap<>();
        for (RunItemWithEmployee item : sourceItems) {
            GlMapping mapping = activeMapping(mappings, item.item().itemCode, asOf);
            if (mapping == null) { if (!missing.contains(item.item().itemCode)) missing.add(item.item().itemCode); continue; }
            String center = centers.get(item.employeeId()); AggregationKey key = new AggregationKey(item.item().itemCode, center);
            Map<AggregationKey, Double> aggregate = "earning".equals(item.item().direction) ? earnings : deductions;
            aggregate.merge(key, item.item().amount, Double::sum);
            employeeNet.merge(item.employeeId(), "earning".equals(item.item().direction) ? item.item().amount : -item.item().amount, Double::sum);
        }
        if (!missing.isEmpty()) {
            List<MappingGapItem> gaps = missing.stream().sorted().map(code -> new MappingGapItem(code, itemNames.get(code), "unknown")).toList();
            throw ApiException.unprocessable(new MissingMappingsDetail("GL mapping missing for one or more pay items.", gaps));
        }
        employeeNet.forEach((employeeId, amount) -> netByCenter.merge(centers.get(employeeId), amount, Double::sum));
        List<LineDraft> lines = new ArrayList<>(); double debit = 0; double credit = 0; int lineNo = 1;
        for (Map.Entry<AggregationKey, Double> entry : sorted(earnings)) {
            GlMapping mapping = activeMapping(mappings, entry.getKey().itemCode(), asOf); double amount = wholeWon(entry.getValue());
            lines.add(new LineDraft(lineNo++, mapping.glAccountCode, entry.getKey().costCenter(), amount, 0, run.yearMonth + " 정기급여 " + itemNames.getOrDefault(entry.getKey().itemCode(), entry.getKey().itemCode()), entry.getKey().itemCode())); debit += amount;
        }
        for (Map.Entry<AggregationKey, Double> entry : sorted(deductions)) {
            GlMapping mapping = activeMapping(mappings, entry.getKey().itemCode(), asOf); double amount = wholeWon(entry.getValue());
            lines.add(new LineDraft(lineNo++, mapping.glAccountCode, entry.getKey().costCenter(), 0, amount, run.yearMonth + " 정기급여 " + itemNames.getOrDefault(entry.getKey().itemCode(), entry.getKey().itemCode()), entry.getKey().itemCode())); credit += amount;
        }
        for (Map.Entry<String, Double> entry : netByCenter.entrySet().stream().sorted(Map.Entry.comparingByKey(Comparator.nullsFirst(String::compareTo))).toList()) {
            double amount = wholeWon(entry.getValue()); lines.add(new LineDraft(lineNo++, netPayAccount.code, entry.getKey(), 0, amount, run.yearMonth + " 정기급여 미지급금", null)); credit += amount;
        }
        double diff = money(debit - credit);
        if (Math.abs(diff) > 0 && Math.abs(diff) <= ROUNDING_TOLERANCE) {
            lines.add(new LineDraft(lineNo, netPayAccount.code, null, Math.max(-diff, 0), Math.max(diff, 0), "반올림 조정", null));
            if (diff > 0) credit += diff; else debit -= diff;
        }
        if (Math.abs(money(debit - credit)) > ROUNDING_TOLERANCE) throw ApiException.badRequest("Debit/credit imbalance too large to auto-adjust: debit=" + debit + ", credit=" + credit);
        return replaceDraftVoucher(run, existing, "accrual", createdBy, money(debit), money(credit), run.yearMonth + " 급여 전표", lines);
    }

    private VoucherActionResponse generateDisbursement(PayrollRun run, Integer createdBy) {
        if (!"paid".equals(run.status)) throw ApiException.conflict("Run status must be 'paid' to generate a disbursement voucher. Current: " + run.status);
        Voucher accrual = findVoucher(run.id, "accrual").orElse(null);
        if (accrual == null || !"confirmed".equals(accrual.status)) throw ApiException.conflict("Accrual voucher for this run must be confirmed before generating a disbursement voucher.");
        Voucher existing = findVoucher(run.id, "disbursement").orElse(null);
        if (existing != null && !"draft".equals(existing.status)) throw ApiException.conflict("Disbursement voucher already confirmed or cancelled for this run; regeneration is only allowed before confirm.");
        GlAccount net = entityManager.createQuery("select a from GlAccount a where a.netPayAccount = true", GlAccount.class).setMaxResults(1).getResultStream().findFirst().orElseThrow(() -> ApiException.badRequest("No GL account flagged as is_net_pay_account."));
        GlAccount cash = entityManager.createQuery("select a from GlAccount a where a.cashAccount = true", GlAccount.class).setMaxResults(1).getResultStream().findFirst().orElseThrow(() -> ApiException.badRequest("No GL account flagged as is_cash_account."));
        double amount = money(voucherLines(accrual.id).stream().filter(line -> net.code.equals(line.glAccountCode)).mapToDouble(line -> line.creditAmount).sum());
        if (amount <= 0) throw ApiException.badRequest("Accrual voucher has no net-pay amount to disburse.");
        return replaceDraftVoucher(run, existing, "disbursement", createdBy, amount, amount, run.yearMonth + " 급여 지급전표", List.of(
                new LineDraft(1, net.code, null, amount, 0, run.yearMonth + " 급여 지급(미지급금 상환)", null),
                new LineDraft(2, cash.code, null, 0, amount, run.yearMonth + " 급여 지급(보통예금 출금)", null)));
    }

    private VoucherActionResponse replaceDraftVoucher(PayrollRun run, Voucher previous, String type, Integer createdBy, double debit, double credit, String summary, List<LineDraft> lines) {
        if (previous != null) {
            entityManager.createQuery("delete from VoucherLine l where l.voucherId = :id").setParameter("id", previous.id).executeUpdate();
            entityManager.remove(previous); entityManager.flush();
        }
        Voucher voucher = new Voucher(); voucher.voucherNo = nextVoucherNo(run.yearMonth); voucher.runId = run.id; voucher.voucherType = type; voucher.voucherDate = today(); voucher.status = "draft";
        voucher.totalDebit = debit; voucher.totalCredit = credit; voucher.summary = summary; voucher.createdBy = createdBy; voucher.createdAt = now(); voucher.updatedAt = now(); entityManager.persist(voucher); entityManager.flush();
        for (LineDraft line : lines) { VoucherLine saved = new VoucherLine(); saved.voucherId = voucher.id; saved.lineNo = line.lineNo(); saved.glAccountCode = line.account(); saved.costCenterCode = line.costCenter(); saved.debitAmount = line.debit(); saved.creditAmount = line.credit(); saved.summary = line.summary(); saved.sourceItemCode = line.sourceItem(); saved.createdAt = now(); entityManager.persist(saved); }
        return new VoucherActionResponse(voucherItem(voucher, run.yearMonth));
    }

    private List<PayrollRunTarget> materializeTargetsAndRead(PayrollRun run, YearMonth period) {
        materializeTargets(run, period, false);
        return entityManager.createQuery("select t from PayrollRunTarget t where t.runId = :runId order by t.employeeId, t.id", PayrollRunTarget.class)
                .setParameter("runId", run.id).getResultList();
    }

    private Materialization materializeTargets(PayrollRun run, YearMonth period, boolean replace) {
        if (replace) {
            entityManager.createQuery("delete from PayrollRunTargetEvent e where e.runId = :runId").setParameter("runId", run.id).executeUpdate();
            entityManager.createQuery("delete from PayrollRunTarget t where t.runId = :runId").setParameter("runId", run.id).executeUpdate();
        }
        List<EmployeeProfile> profiles = entityManager.createQuery("""
                select p from EmployeeProfile p
                 where p.payrollCodeId = :code and p.active = true and p.effectiveFrom <= :end
                   and (p.effectiveTo is null or p.effectiveTo >= :start)
                 order by p.employeeId, p.effectiveFrom desc, p.id desc
                """, EmployeeProfile.class).setParameter("code", run.payrollCodeId).setParameter("start", period.atDay(1)).setParameter("end", period.atEndOfMonth()).getResultList();
        Map<Integer, EmployeeProfile> current = new LinkedHashMap<>();
        for (EmployeeProfile profile : profiles) current.putIfAbsent(profile.employeeId, profile);
        Map<Integer, EmployeeReference> employees = employeeReferences(new ArrayList<>(current.keySet()));
        Map<Integer, PayrollRunTarget> targets = new HashMap<>();
        for (EmployeeProfile profile : current.values()) {
            EmployeeReference employee = employees.get(profile.employeeId);
            if (employee == null || employee.hireDate().isAfter(period.atEndOfMonth()) || (employee.retireDate() != null && employee.retireDate().isBefore(period.atDay(1)))) continue;
            PayrollRunTarget target = new PayrollRunTarget(); target.runId = run.id; target.employeeId = profile.employeeId; target.profileId = profile.id; target.eventCount = 0; target.reviewRequired = false;
            target.snapshotJson = snapshotJson(employee, profile, period); target.createdAt = now(); target.updatedAt = now(); entityManager.persist(target); targets.put(target.employeeId, target);
        }
        entityManager.flush();
        int eventCount = materializeAppointmentEvents(run, period, targets);
        eventCount += materializeProfileEvents(run, period, targets);
        eventCount += materializeLeaveEvents(run, period, targets);
        eventCount += materializeWelfareEvents(run, targets);
        return new Materialization(targets.size(), eventCount);
    }

    private int materializeAppointmentEvents(PayrollRun run, YearMonth period, Map<Integer, PayrollRunTarget> targets) {
        if (targets.isEmpty()) return 0;
        int eventCount = 0;
        for (PayrollProjectionMapper.AppointmentProjection item : projections.findAppointmentEvents(
                new ArrayList<>(targets.keySet()), period.atDay(1), period.atEndOfMonth())) {
            PayrollRunTarget target = targets.get(item.employeeId());
            if (target == null) continue;
            String payload = appointmentEventPayload(item);
            List<TargetEventSpec> events = new ArrayList<>();
            events.add(new TargetEventSpec("appointment_order_confirmed", "발령 오더 확정", "apply"));
            if (item.toDepartmentId() != null && !Objects.equals(item.toDepartmentId(), item.fromDepartmentId())) {
                events.add(new TargetEventSpec("department_changed", "부서 변경", "apply"));
            }
            if (item.toPositionTitle() != null && !Objects.equals(item.toPositionTitle(), item.fromPositionTitle())) {
                events.add(new TargetEventSpec("position_changed", "직위 변경", "apply"));
            }
            String action = stringDefault(item.actionType(), "").replace(" ", "").strip().toLowerCase(Locale.ROOT);
            String beforeStatus = stringDefault(item.fromEmploymentStatus(), "").strip().toLowerCase(Locale.ROOT);
            String afterStatus = stringDefault(item.toEmploymentStatus(), "").strip().toLowerCase(Locale.ROOT);
            if ("temporary".equals(item.appointmentKind())) {
                events.add(new TargetEventSpec("temporary_assignment_started", "임시 발령 시작", "review"));
                if (item.endDate() != null) events.add(new TargetEventSpec("temporary_assignment_ended", "임시 발령 종료 예정", "review"));
            }
            if (action.contains("입사")) events.add(new TargetEventSpec("hire_started", "입사 이벤트", "review"));
            if (!afterStatus.isEmpty() && !afterStatus.equals(beforeStatus)) {
                if ("resigned".equals(afterStatus) || action.contains("퇴사")) {
                    events.add(new TargetEventSpec("resigned", "퇴사 이벤트", "review"));
                } else if ("active".equals(beforeStatus) && "leave".equals(afterStatus)) {
                    events.add(new TargetEventSpec("leave_status_started", "휴직 시작", "review"));
                } else if ("leave".equals(beforeStatus) && "active".equals(afterStatus)) {
                    events.add(new TargetEventSpec("leave_status_ended", "복직/휴직 종료", "review"));
                } else {
                    events.add(new TargetEventSpec("employment_status_changed", "고용상태 변경", "apply"));
                }
            }
            Set<String> seen = new java.util.HashSet<>();
            for (TargetEventSpec event : events) {
                if (!seen.add(event.code())) continue;
                persistTargetEvent(run, target, event.code(), event.name(), "appointment", "hr_appointment_order_items",
                        item.id(), item.startDate(), event.decision(), payload);
                eventCount++;
            }
        }
        return eventCount;
    }

    private int materializeProfileEvents(PayrollRun run, YearMonth period, Map<Integer, PayrollRunTarget> targets) {
        if (targets.isEmpty()) return 0;
        List<EmployeeProfile> profiles = entityManager.createQuery("""
                select p from EmployeeProfile p
                 where p.employeeId in :employeeIds and p.payrollCodeId = :payrollCodeId and p.effectiveFrom <= :periodEnd
                 order by p.employeeId, p.effectiveFrom, p.id
                """, EmployeeProfile.class)
                .setParameter("employeeIds", targets.keySet())
                .setParameter("payrollCodeId", run.payrollCodeId)
                .setParameter("periodEnd", period.atEndOfMonth())
                .getResultList();
        Map<Integer, String> groupNames = itemGroupNames();
        Map<Integer, EmployeeProfile> previousByEmployee = new HashMap<>();
        int eventCount = 0;
        for (EmployeeProfile profile : profiles) {
            EmployeeProfile previous = previousByEmployee.put(profile.employeeId, profile);
            PayrollRunTarget target = targets.get(profile.employeeId);
            if (previous == null || target == null || profile.effectiveFrom.isBefore(period.atDay(1))) continue;
            String payload = profileEventPayload(previous, profile, groupNames);
            if (money(previous.baseSalary) != money(profile.baseSalary)) {
                addProfileTargetEvent(run, target, profile, "base_salary_changed", "기본급 변경", payload);
                eventCount++;
            }
            if (!Objects.equals(previous.itemGroupId, profile.itemGroupId)) {
                addProfileTargetEvent(run, target, profile, "pay_item_group_changed", "급여항목 그룹 변경", payload);
                eventCount++;
            }
            if (!Objects.equals(previous.paymentDayType, profile.paymentDayType)
                    || !Objects.equals(previous.paymentDayValue, profile.paymentDayValue)
                    || !Objects.equals(previous.holidayAdjustment, profile.holidayAdjustment)) {
                addProfileTargetEvent(run, target, profile, "payment_schedule_changed", "지급기준 변경", payload);
                eventCount++;
            }
            if (!Objects.equals(previous.payTypeCode, profile.payTypeCode)) {
                addProfileTargetEvent(run, target, profile, "pay_type_changed", "급여유형 변경", payload);
                eventCount++;
            }
        }
        return eventCount;
    }

    private int materializeLeaveEvents(PayrollRun run, YearMonth period, Map<Integer, PayrollRunTarget> targets) {
        if (targets.isEmpty()) return 0;
        int eventCount = 0;
        for (PayrollProjectionMapper.LeaveProjection leave : projections.findApprovedLeaveEvents(
                new ArrayList<>(targets.keySet()), period.atDay(1), period.atEndOfMonth())) {
            PayrollRunTarget target = targets.get(leave.employeeId());
            if (target == null || !"unpaid".equals(leave.leaveType())) continue;
            persistTargetEvent(run, target, "unpaid_leave_approved", "무급휴가 승인", "tim_leave", "tim_leave_requests",
                    leave.id(), leave.startDate(), "review", leaveEventPayload(leave));
            eventCount++;
        }
        return eventCount;
    }

    private int materializeWelfareEvents(PayrollRun run, Map<Integer, PayrollRunTarget> targets) {
        int eventCount = 0;
        for (Map.Entry<Integer, List<PayrollProjectionMapper.WelfareProjection>> entry
                : welfareRequestsByEmployee(run, new ArrayList<>(targets.values()), false).entrySet()) {
            PayrollRunTarget target = targets.get(entry.getKey());
            if (target == null) continue;
            for (PayrollProjectionMapper.WelfareProjection request : entry.getValue()) {
                String code = request.deduction() ? "welfare_deduction_approved" : "welfare_allowance_approved";
                String name = request.deduction() ? "복리후생 공제 승인" : "복리후생 지급 승인";
                LocalDateTime basis = request.approvedAt() == null ? request.requestedAt() : request.approvedAt();
                persistTargetEvent(run, target, code, name, "welfare_request", "wel_benefit_requests", request.id(),
                        basis.toLocalDate(), "apply", welfareEventPayload(request));
                eventCount++;
            }
        }
        return eventCount;
    }

    private void addProfileTargetEvent(PayrollRun run, PayrollRunTarget target, EmployeeProfile profile, String eventCode, String eventName, String payload) {
        persistTargetEvent(run, target, eventCode, eventName, "payroll_profile", "pay_employee_profiles",
                profile.id, profile.effectiveFrom, "review", payload);
    }

    private void persistTargetEvent(PayrollRun run, PayrollRunTarget target, String eventCode, String eventName,
                                    String sourceType, String sourceTable, Integer sourceId, LocalDate effectiveDate,
                                    String decisionCode, String payload) {
        PayrollRunTargetEvent event = new PayrollRunTargetEvent();
        event.runId = run.id; event.targetId = target.id; event.employeeId = target.employeeId; event.eventCode = eventCode; event.eventName = eventName;
        event.sourceType = sourceType; event.sourceTable = sourceTable; event.sourceId = sourceId; event.effectiveDate = effectiveDate;
        event.decisionCode = decisionCode; event.payloadJson = payload; event.createdAt = now(); entityManager.persist(event);
        target.eventCount++;
        if ("review".equals(decisionCode)) target.reviewRequired = true;
        target.updatedAt = now();
    }

    private StatutoryDeductions statutoryDeductions(double taxableIncome, Map<String, AllowanceDeduction> allowances, List<TaxRate> rates, List<IncomeTaxBracket> brackets) {
        TaxRate pension = rate(rates, "국민연금", "pension"); TaxRate health = rate(rates, "건강보험", "health");
        TaxRate longTermCare = rate(rates, "장기요양", "long_term_care"); TaxRate employment = rate(rates, "고용보험", "employment"); TaxRate incomeTax = rate(rates, "소득세", "income_tax");
        List<String> warnings = new ArrayList<>(); List<String> missing = new ArrayList<>();
        if (pension == null) missing.add("국민연금"); if (health == null) missing.add("건강보험"); if (longTermCare == null) missing.add("장기요양"); if (employment == null) missing.add("고용보험");
        if (!missing.isEmpty()) warnings.add("missing tax rate master: " + String.join(", ", missing));
        double pensionAmount = money(rateBase(taxableIncome, pension) * rateValue(pension) / 100d);
        double healthAmount = money(rateBase(taxableIncome, health) * rateValue(health) / 100d);
        double longTermAmount = healthAmount > 0 && rateValue(health) > 0 && rateValue(longTermCare) > 0
                ? money(healthAmount * rateValue(longTermCare) / rateValue(health)) : money(rateBase(taxableIncome, longTermCare) * rateValue(longTermCare) / 100d);
        double employmentAmount = money(rateBase(taxableIncome, employment) * rateValue(employment) / 100d);
        TaxResult income = incomeTax(rateBase(taxableIncome, incomeTax), brackets, incomeTax); warnings.addAll(income.warnings());
        List<Deduction> result = new ArrayList<>();
        addDeduction(result, allowances, "PEN", "국민연금", pensionAmount, "insurance"); addDeduction(result, allowances, "HIN", "건강보험", healthAmount, "insurance");
        addDeduction(result, allowances, "LTC", "장기요양", longTermAmount, "insurance"); addDeduction(result, allowances, "EMP", "고용보험", employmentAmount, "insurance");
        addDeduction(result, allowances, "ITX", "소득세", income.amount(), "tax"); addDeduction(result, allowances, "LTX", "지방소득세", money(income.amount() * .1d), "tax");
        return new StatutoryDeductions(result, warnings.stream().distinct().toList());
    }

    private TaxResult incomeTax(double taxableIncome, List<IncomeTaxBracket> brackets, TaxRate fallback) {
        if (taxableIncome <= 0) return new TaxResult(0, List.of()); double annual = taxableIncome * 12;
        for (IncomeTaxBracket bracket : brackets) {
            if (annual < bracket.annualTaxableFrom || (bracket.annualTaxableTo != null && annual > bracket.annualTaxableTo)) continue;
            return new TaxResult(money(Math.max(annual * bracket.taxRate / 100d - bracket.quickDeduction, 0d) / 12d), List.of());
        }
        if (fallback != null) return new TaxResult(money(rateBase(taxableIncome, fallback) * rateValue(fallback) / 100d), List.of("income tax bracket master missing; legacy flat tax rate used"));
        return new TaxResult(0, List.of("income tax bracket master missing"));
    }

    private void addDeduction(List<Deduction> values, Map<String, AllowanceDeduction> definitions, String code, String fallbackName, double amount, String fallbackTaxType) {
        if (amount <= 0) return; AllowanceDeduction definition = definitions.get(code);
        values.add(new Deduction(code, definition == null ? fallbackName : definition.name, amount,
                definition == null ? fallbackTaxType : definition.taxType, definition == null ? "formula" : definition.calculationType));
    }

    private PayrollRun lockRun(int runId) {
        PayrollRun run = entityManager.find(PayrollRun.class, runId, LockModeType.PESSIMISTIC_WRITE);
        if (run == null) throw ApiException.notFound("Payroll run not found.");
        return run;
    }

    static void logAutomaticVoucherFailure(int runId, RuntimeException exception) {
        log.warn("Failed to auto-generate accrual voucher draft for run_id={} action=close", runId, exception);
    }

    private PayrollRunActionResponse runAction(PayrollRun run) { return new PayrollRunActionResponse(payrollRunItem(run, payrollCodeNames())); }
    private void addRunEvent(int runId, String type, String message) { PayrollRunEvent event = new PayrollRunEvent(); event.runId = runId; event.eventType = type; event.message = message; event.createdAt = now(); entityManager.persist(event); }
    private void addRunItem(int employeeId, String code, String name, String direction, double amount, String taxType, String calculation, String source) { RunItemEntity item = new RunItemEntity(); item.runEmployeeId = employeeId; item.itemCode = code; item.itemName = name; item.direction = direction; item.amount = amount; item.taxType = taxType; item.calculationType = calculation; item.sourceType = source; item.createdAt = now(); entityManager.persist(item); }

    private PayrollCodeItem payrollCodeItem(PayrollCode row) { return new PayrollCodeItem(row.id, row.code, row.name, row.payType, row.paymentDay, row.taxDeductible, row.socialInsuranceDeductible, row.active, row.createdAt, row.updatedAt); }
    private TaxRateItem taxRateItem(TaxRate row) { return new TaxRateItem(row.id, row.year, row.rateType, row.employeeRate, row.employerRate, row.minLimit, row.maxLimit, row.createdAt, row.updatedAt); }
    private IncomeTaxBracketItem bracketItem(IncomeTaxBracket row) { return new IncomeTaxBracketItem(row.id, row.year, row.annualTaxableFrom, row.annualTaxableTo, row.taxRate, row.quickDeduction, row.createdAt, row.updatedAt); }
    private AllowanceDeductionItem allowanceItem(AllowanceDeduction row) { return new AllowanceDeductionItem(row.id, row.code, row.name, row.type, row.taxType, row.calculationType, row.active, row.sortOrder, row.createdAt, row.updatedAt); }
    private GlAccountItem glAccountItem(GlAccount row) { return new GlAccountItem(row.id, row.code, row.name, row.accountType, row.netPayAccount, row.cashAccount, row.active, row.sortOrder, row.createdAt, row.updatedAt); }
    private GlMappingItem glMappingItem(GlMapping row, Map<String, String> names, Map<String, String> accounts) { return new GlMappingItem(row.id, row.payItemCode, names.get(row.payItemCode), row.glAccountCode, accounts.get(row.glAccountCode), row.effectiveFrom, row.note, row.active, row.createdAt, row.updatedAt); }
    private SeveranceItemRuleItem ruleItem(SeveranceItemRule row, Map<String, String> names) { return new SeveranceItemRuleItem(row.id, row.payItemCode, names.get(row.payItemCode), row.includeType, row.note, row.active, row.createdAt, row.updatedAt); }
    private VoucherItem voucherItem(Voucher row, String yearMonth) { return new VoucherItem(row.id, row.voucherNo, row.runId, row.voucherType, yearMonth, row.voucherDate, row.status, row.totalDebit, row.totalCredit, row.summary, row.createdBy, row.confirmedBy, row.confirmedAt, row.createdAt, row.updatedAt); }
    private VoucherLineItem voucherLineItem(VoucherLine row, Map<String, String> names) { return new VoucherLineItem(row.id, row.lineNo, row.glAccountCode, names.get(row.glAccountCode), row.costCenterCode, row.debitAmount, row.creditAmount, row.summary, row.sourceItemCode, row.createdAt); }
    private PayrollRunItem payrollRunItem(PayrollRun row, Map<Integer, String> names) { return new PayrollRunItem(row.id, row.yearMonth, row.payrollCodeId, names.get(row.payrollCodeId), row.runName, row.status, row.totalEmployees, row.totalGross, row.totalDeductions, row.totalNet, row.calculatedAt, row.closedAt, row.paidAt, row.createdAt, row.updatedAt); }
    private EmployeeProfileItem profileItem(EmployeeProfile row, EmployeeReference employee, Map<Integer, String> codes, Map<Integer, String> groups) { return new EmployeeProfileItem(row.id, row.employeeId, employee == null ? null : employee.employeeNo(), employee == null ? null : employee.name(), row.payrollCodeId, codes.get(row.payrollCodeId), row.itemGroupId, row.itemGroupId == null ? null : groups.get(row.itemGroupId), row.baseSalary, row.payTypeCode, row.paymentDayType, row.paymentDayValue, row.holidayAdjustment, row.effectiveFrom, row.effectiveTo, row.active, row.createdAt, row.updatedAt); }
    private VariableInputItem variableItem(VariableInput row, EmployeeReference employee, Map<String, String> names) { return new VariableInputItem(row.id, row.yearMonth, row.employeeId, employee == null ? null : employee.employeeNo(), employee == null ? null : employee.name(), row.itemCode, names.get(row.itemCode), row.direction, row.amount, row.memo, row.createdAt, row.updatedAt); }
    private PayrollRunEmployeeItem runEmployeeItem(PayrollProjectionMapper.RunEmployeeProjection row) { return new PayrollRunEmployeeItem(row.id(), row.runId(), row.employeeId(), row.employeeNo(), row.employeeName(), row.profileId(), row.grossPay(), row.taxableIncome(), row.nonTaxableIncome(), row.totalDeductions(), row.netPay(), row.status(), row.warningMessage(), row.createdAt(), row.updatedAt()); }
    private PayrollRunEmployeeItem fallbackRunEmployeeItem(PayrollRunEmployee row) { return new PayrollRunEmployeeItem(row.id, row.runId, row.employeeId, null, null, row.profileId, row.grossPay, row.taxableIncome, row.nonTaxableIncome, row.totalDeductions, row.netPay, row.status, row.warningMessage, row.createdAt, row.updatedAt); }
    private PayrollRunEmployeeDetailItem runItemDetail(RunItemEntity row) { return new PayrollRunEmployeeDetailItem(row.id, row.runEmployeeId, row.itemCode, row.itemName, row.direction, row.amount, row.taxType, row.calculationType, row.sourceType, row.createdAt); }
    private ItemGroupItem itemGroupItem(ItemGroup group) { List<ItemGroupDetailItem> details = entityManager.createQuery("select d from ItemGroupDetail d where d.groupId = :groupId", ItemGroupDetail.class).setParameter("groupId", group.id).getResultList().stream().map(d -> new ItemGroupDetailItem(d.id, d.groupId, d.itemId, d.type, d.createdAt)).toList(); return new ItemGroupItem(group.id, group.code, group.name, group.description, group.active, group.createdAt, group.updatedAt, details); }

    private MyPayslipSummary payslipSummary(Object[] row) { return new MyPayslipSummary(number(row[0]), number(row[1]), (String) row[2], (String) row[3], (String) row[4], decimal(row[5]), decimal(row[6]), decimal(row[7]), decimal(row[8]), decimal(row[9]), dateTime(row[10])); }
    private ApiException payslipNotFound() { return ApiException.notFound("급여 정보를 찾을 수 없습니다."); }
    private List<RunItemEntity> runItems(int runId) { return entityManager.createQuery("select i from RunItemEntity i where i.runEmployeeId in (select e.id from PayrollRunEmployee e where e.runId = :runId)", RunItemEntity.class).setParameter("runId", runId).getResultList(); }
    private Optional<PayrollRunEmployee> findRunEmployee(int runId, int employeeId) { return entityManager.createQuery("select e from PayrollRunEmployee e where e.runId = :runId and e.employeeId = :employeeId", PayrollRunEmployee.class).setParameter("runId", runId).setParameter("employeeId", employeeId).getResultStream().findFirst(); }
    private List<VoucherLine> voucherLines(int voucherId) { return entityManager.createQuery("select l from VoucherLine l where l.voucherId = :id order by l.lineNo", VoucherLine.class).setParameter("id", voucherId).getResultList(); }
    private Optional<Voucher> findVoucher(int runId, String type) { return entityManager.createQuery("select v from Voucher v where v.runId = :runId and v.voucherType = :type", Voucher.class).setParameter("runId", runId).setParameter("type", type).getResultStream().findFirst(); }
    private List<RunItemWithEmployee> runItemsWithEmployees(int runId) { return entityManager.createQuery("select i, e.employeeId from RunItemEntity i join PayrollRunEmployee e on e.id = i.runEmployeeId where e.runId = :runId", Object[].class).setParameter("runId", runId).getResultList().stream().map(row -> new RunItemWithEmployee((RunItemEntity) row[0], number(row[1]))).toList(); }
    private Map<Integer, List<VariableInput>> variablesByEmployee(String month, List<Integer> employees) { if (employees.isEmpty()) return Map.of(); Map<Integer, List<VariableInput>> result = new HashMap<>(); for (VariableInput row : entityManager.createQuery("select v from VariableInput v where v.yearMonth = :month and v.employeeId in :employees", VariableInput.class).setParameter("month", month).setParameter("employees", employees).getResultList()) result.computeIfAbsent(row.employeeId, ignored -> new ArrayList<>()).add(row); return result; }
    private Map<Integer, List<PayrollRunTargetEvent>> targetEventsByEmployee(int runId) {
        Map<Integer, List<PayrollRunTargetEvent>> result = new HashMap<>();
        entityManager.createQuery("select e from PayrollRunTargetEvent e where e.runId = :runId order by e.employeeId, e.effectiveDate, e.id", PayrollRunTargetEvent.class)
                .setParameter("runId", runId).getResultList()
                .forEach(event -> result.computeIfAbsent(event.employeeId, ignored -> new ArrayList<>()).add(event));
        return result;
    }

    private Map<Integer, List<PayrollProjectionMapper.WelfareProjection>> welfareRequestsByEmployee(
            PayrollRun run, List<PayrollRunTarget> targets, boolean markReflected) {
        if (targets.isEmpty()) return Map.of();
        Map<Integer, EmployeeReference> employees = employeeReferences(targets.stream().map(target -> target.employeeId).toList());
        Map<String, Integer> employeeIdsByNumber = new HashMap<>();
        for (EmployeeReference employee : employees.values()) {
            if (!blank(employee.employeeNo())) employeeIdsByNumber.put(employee.employeeNo(), employee.id());
        }
        if (employeeIdsByNumber.isEmpty()) return Map.of();
        Map<Integer, List<PayrollProjectionMapper.WelfareProjection>> result = new HashMap<>();
        for (PayrollProjectionMapper.WelfareProjection request
                : projections.findWelfareRequests(new ArrayList<>(employeeIdsByNumber.keySet()), run.yearMonth)) {
            if (!welfareRequestMatchesRunMonth(request, run.yearMonth)) continue;
            Integer employeeId = employeeIdsByNumber.get(request.employeeNo());
            if (employeeId == null) continue;
            if (markReflected) {
                entityManager.createNativeQuery("""
                        update wel_benefit_requests
                           set payroll_run_label = :runLabel, status_code = 'payroll_reflected', updated_at = :updatedAt
                         where id = :id
                        """).setParameter("runLabel", run.yearMonth + " 정기급여")
                        .setParameter("updatedAt", now()).setParameter("id", request.id()).executeUpdate();
            }
            result.computeIfAbsent(employeeId, ignored -> new ArrayList<>()).add(request);
        }
        return result;
    }

    private boolean welfareRequestMatchesRunMonth(PayrollProjectionMapper.WelfareProjection request, String yearMonth) {
        if (!blank(request.payrollRunLabel()) && request.payrollRunLabel().contains(yearMonth)) return true;
        if ("payroll_reflected".equals(request.statusCode())) return false;
        LocalDateTime basis = request.approvedAt() != null ? request.approvedAt()
                : request.requestedAt() != null ? request.requestedAt()
                : request.updatedAt() != null ? request.updatedAt() : request.createdAt();
        return basis != null && YearMonth.from(basis).toString().equals(yearMonth);
    }

    private Map<String, AllowanceDeduction> allowanceDefinitions() { Map<String, AllowanceDeduction> result = new HashMap<>(); entityManager.createQuery("select a from AllowanceDeduction a", AllowanceDeduction.class).getResultList().forEach(row -> result.put(row.code, row)); return result; }
    private Map<String, String> allowanceNames() { Map<String, String> names = new HashMap<>(); entityManager.createQuery("select a.code, a.name from AllowanceDeduction a", Object[].class).getResultList().forEach(row -> names.put((String) row[0], (String) row[1])); return names; }
    private Map<String, String> accountNames() { Map<String, String> names = new HashMap<>(); entityManager.createQuery("select a.code, a.name from GlAccount a", Object[].class).getResultList().forEach(row -> names.put((String) row[0], (String) row[1])); return names; }
    private Map<Integer, String> payrollCodeNames() { Map<Integer, String> names = new HashMap<>(); entityManager.createQuery("select c.id, c.name from PayrollCode c", Object[].class).getResultList().forEach(row -> names.put(number(row[0]), (String) row[1])); return names; }
    private Map<Integer, String> itemGroupNames() { Map<Integer, String> names = new HashMap<>(); entityManager.createQuery("select g.id, g.name from ItemGroup g", Object[].class).getResultList().forEach(row -> names.put(number(row[0]), (String) row[1])); return names; }
    private Map<Integer, String> runMonths(Collection<Integer> runIds) { if (runIds.isEmpty()) return Map.of(); Map<Integer, String> result = new HashMap<>(); entityManager.createQuery("select r.id, r.yearMonth from PayrollRun r where r.id in :ids", Object[].class).setParameter("ids", runIds).getResultList().forEach(row -> result.put(number(row[0]), (String) row[1])); return result; }

    private Map<Integer, EmployeeReference> employeeReferences(Collection<Integer> ids) {
        if (ids.isEmpty()) return Map.of();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select e.id, e.employee_no, u.display_name, e.hire_date, b.retire_date, d.cost_center_code,
                       e.department_id, d.name, e.position_title, e.employment_status
                  from hr_employees e
                  left join auth_users u on u.id = e.user_id
                  left join hr_employee_basic_profiles b on b.employee_id = e.id
                  left join org_departments d on d.id = e.department_id
                 where e.id in (:ids)
                """).setParameter("ids", ids).getResultList();
        Map<Integer, EmployeeReference> result = new HashMap<>();
        for (Object[] row : rows) result.put(number(row[0]), new EmployeeReference(number(row[0]), (String) row[1], (String) row[2], localDate(row[3]), localDate(row[4]), (String) row[5], number(row[6]), (String) row[7], (String) row[8], (String) row[9]));
        return result;
    }

    private boolean employeeExists(int employeeId) {
        Number count = (Number) entityManager.createNativeQuery("select count(*) from hr_employees where id = :id").setParameter("id", employeeId).getSingleResult();
        return count.longValue() > 0;
    }

    private Map<Integer, String> costCenters(Collection<Integer> employeeIds) {
        return employeeReferences(employeeIds).entrySet().stream().collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, row -> row.getValue().costCenter()));
    }

    private String snapshotJson(EmployeeReference employee, EmployeeProfile profile, YearMonth period) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("employee_id", employee.id()); value.put("employee_no", employee.employeeNo()); value.put("employee_name", employee.name());
        value.put("department_id", employee.departmentId()); value.put("department_name", employee.departmentName()); value.put("position_title", employee.positionTitle());
        value.put("hire_date", employee.hireDate()); value.put("employment_status", employee.employmentStatus()); value.put("retire_date", employee.retireDate());
        value.put("profile_id", profile.id); value.put("payroll_code_id", profile.payrollCodeId); value.put("item_group_id", profile.itemGroupId);
        value.put("base_salary", money(profile.baseSalary)); value.put("pay_type_code", profile.payTypeCode); value.put("payment_day_type", profile.paymentDayType);
        value.put("payment_day_value", profile.paymentDayValue); value.put("holiday_adjustment", profile.holidayAdjustment); value.put("effective_from", profile.effectiveFrom);
        value.put("effective_to", profile.effectiveTo); value.put("period_start", period.atDay(1)); value.put("period_end", period.atEndOfMonth());
        try { return objectMapper.writeValueAsString(value); } catch (JacksonException exception) { throw new IllegalStateException("Could not serialize payroll target snapshot", exception); }
    }

    private String profileEventPayload(EmployeeProfile previous, EmployeeProfile current, Map<Integer, String> groupNames) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("previous_profile_id", previous.id); value.put("current_profile_id", current.id); value.put("effective_from", current.effectiveFrom); value.put("effective_to", current.effectiveTo);
        value.put("previous_base_salary", money(previous.baseSalary)); value.put("current_base_salary", money(current.baseSalary));
        value.put("previous_item_group_id", previous.itemGroupId); value.put("previous_item_group_name", groupNames.get(previous.itemGroupId));
        value.put("current_item_group_id", current.itemGroupId); value.put("current_item_group_name", groupNames.get(current.itemGroupId));
        value.put("previous_pay_type_code", previous.payTypeCode); value.put("current_pay_type_code", current.payTypeCode);
        value.put("previous_payment_day_type", previous.paymentDayType); value.put("current_payment_day_type", current.paymentDayType);
        value.put("previous_payment_day_value", previous.paymentDayValue); value.put("current_payment_day_value", current.paymentDayValue);
        value.put("previous_holiday_adjustment", previous.holidayAdjustment); value.put("current_holiday_adjustment", current.holidayAdjustment);
        return eventPayload(value);
    }

    private String appointmentEventPayload(PayrollProjectionMapper.AppointmentProjection item) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("appointment_no", item.appointmentNo()); value.put("order_title", item.orderTitle());
        value.put("appointment_kind", item.appointmentKind()); value.put("action_type", item.actionType());
        value.put("from_department_id", item.fromDepartmentId()); value.put("from_department_name", item.fromDepartmentName());
        value.put("to_department_id", item.toDepartmentId()); value.put("to_department_name", item.toDepartmentName());
        value.put("from_position_title", item.fromPositionTitle()); value.put("to_position_title", item.toPositionTitle());
        value.put("from_employment_status", item.fromEmploymentStatus()); value.put("to_employment_status", item.toEmploymentStatus());
        value.put("start_date", item.startDate()); value.put("end_date", item.endDate());
        value.put("temporary_reason", item.temporaryReason()); value.put("note", item.note());
        return eventPayload(value);
    }

    private String leaveEventPayload(PayrollProjectionMapper.LeaveProjection leave) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("leave_type", leave.leaveType()); value.put("start_date", leave.startDate()); value.put("end_date", leave.endDate());
        value.put("reason", leave.reason()); value.put("request_status", leave.requestStatus()); value.put("approved_at", leave.approvedAt());
        value.put("decision_comment", leave.decisionComment());
        return eventPayload(value);
    }

    private String welfareEventPayload(PayrollProjectionMapper.WelfareProjection request) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("request_no", request.requestNo()); value.put("benefit_type_code", request.benefitTypeCode());
        value.put("benefit_type_name", request.benefitTypeName()); value.put("is_deduction", request.deduction());
        value.put("pay_item_code", request.payItemCode()); value.put("requested_amount", request.requestedAmount());
        value.put("approved_amount", (long) request.amount()); value.put("status_code", request.statusCode());
        value.put("payroll_run_label", request.payrollRunLabel()); value.put("approved_at", request.approvedAt());
        value.put("description", request.description());
        return eventPayload(value);
    }

    private String eventPayload(Map<String, Object> value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JacksonException exception) { throw new IllegalStateException("Could not serialize payroll target event", exception); }
    }

    private Snapshot snapshot(String json) {
        try {
            @SuppressWarnings("unchecked") Map<String, Object> value = objectMapper.readValue(json, Map.class);
            Object baseSalary = value.get("base_salary");
            return new Snapshot(baseSalary instanceof Number number ? number.doubleValue() : 0d);
        } catch (JacksonException exception) { throw new IllegalStateException("Could not read payroll target snapshot", exception); }
    }

    private GlMapping activeMapping(List<GlMapping> mappings, String itemCode, LocalDate asOf) {
        return mappings.stream().filter(mapping -> mapping.active && mapping.payItemCode.equals(itemCode) && !mapping.effectiveFrom.isAfter(asOf))
                .max(Comparator.comparing(mapping -> mapping.effectiveFrom)).orElse(null);
    }

    private TaxRate rate(List<TaxRate> rates, String... keywords) {
        for (TaxRate row : rates) {
            String text = row.rateType == null ? "" : row.rateType.replace(" ", "").toLowerCase(Locale.ROOT);
            for (String keyword : keywords) if (text.contains(keyword.replace(" ", "").toLowerCase(Locale.ROOT))) return row;
        }
        return null;
    }

    private double rateValue(TaxRate row) { return row == null || row.employeeRate == null ? 0d : row.employeeRate; }
    private double rateBase(double amount, TaxRate row) {
        if (amount <= 0) return 0; double value = amount;
        if (row != null && row.minLimit != null) value = Math.max(value, row.minLimit);
        if (row != null && row.maxLimit != null) value = Math.min(value, row.maxLimit);
        return money(value);
    }

    private List<Map.Entry<AggregationKey, Double>> sorted(Map<AggregationKey, Double> values) {
        return values.entrySet().stream().sorted(Comparator.comparing(entry -> entry.getKey().itemCode())).toList();
    }

    private String nextVoucherNo(String yearMonth) {
        String prefix = "PV-" + yearMonth.replace("-", "") + "-";
        List<String> existing = entityManager.createQuery("select v.voucherNo from Voucher v where v.voucherNo like :prefix", String.class).setParameter("prefix", prefix + "%").getResultList();
        int sequence = 0;
        for (String number : existing) {
            String suffix = number.substring(number.lastIndexOf('-') + 1);
            try { sequence = Math.max(sequence, Integer.parseInt(suffix)); } catch (NumberFormatException ignored) { }
        }
        return "%s%04d".formatted(prefix, sequence + 1);
    }

    private void replaceItemGroupDetails(int groupId, List<ItemGroupDetailBatchItem> details) {
        entityManager.createQuery("delete from ItemGroupDetail d where d.groupId = :id").setParameter("id", groupId).executeUpdate();
        for (ItemGroupDetailBatchItem detail : details) { ItemGroupDetail saved = new ItemGroupDetail(); saved.groupId = groupId; saved.itemId = detail.itemId(); saved.type = detail.type(); saved.createdAt = now(); entityManager.persist(saved); }
    }

    private int deleteByIds(Class<?> type, List<Integer> deleteIds) {
        int count = 0; for (Integer id : ids(deleteIds)) { Object row = entityManager.find(type, id); if (row != null) { entityManager.remove(row); count++; } } return count;
    }
    private boolean exists(String jpql, String parameter, Object value) { return exists(jpql, Map.of(parameter, value)); }
    private boolean exists(String jpql, Map<String, ?> parameters) { var query = entityManager.createQuery(jpql); parameters.forEach(query::setParameter); return !query.setMaxResults(1).getResultList().isEmpty(); }
    private void advisoryLock(String key) { entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtext(:key))").setParameter("key", key).getSingleResult(); }
    private static List<Integer> ids(List<Integer> ids) { return ids == null ? List.of() : ids; }
    private static boolean bool(Boolean value, boolean fallback) { return value == null ? fallback : value; }
    private static int intDefault(Integer value, int fallback) { return value == null ? fallback : value; }
    private static double doubleDefault(Double value, double fallback) { return value == null ? fallback : value; }
    private static String stringDefault(String value, String fallback) { return value == null ? fallback : value; }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private LocalDateTime now() { return LocalDateTime.now(clock); }
    private LocalDate today() { return LocalDate.now(clock); }
    private static YearMonth parseYearMonth(String value) { try { return YearMonth.parse(value); } catch (RuntimeException exception) { throw ApiException.badRequest("year_month must be YYYY-MM format."); } }
    static double money(double value) { return new BigDecimal(value).setScale(2, RoundingMode.HALF_EVEN).doubleValue(); }
    static double wholeWon(double value) { return new BigDecimal(value).setScale(0, RoundingMode.HALF_EVEN).doubleValue(); }
    private static int number(Object value) { return ((Number) value).intValue(); }
    private static double decimal(Object value) { return value == null ? 0d : ((Number) value).doubleValue(); }
    private static LocalDate localDate(Object value) { if (value == null) return null; if (value instanceof LocalDate date) return date; if (value instanceof Date date) return date.toLocalDate(); return ((java.sql.Timestamp) value).toLocalDateTime().toLocalDate(); }
    private static LocalDateTime dateTime(Object value) { if (value == null) return null; if (value instanceof LocalDateTime dateTime) return dateTime; return ((java.sql.Timestamp) value).toLocalDateTime(); }

    private record EmployeeReference(int id, String employeeNo, String name, LocalDate hireDate, LocalDate retireDate, String costCenter, int departmentId, String departmentName, String positionTitle, String employmentStatus) { }
    private record Materialization(int targetCount, int eventCount) { }
    private record TargetEventSpec(String code, String name, String decision) { }
    private record Snapshot(double baseSalary) { }
    private record Deduction(String code, String name, double amount, String taxType, String calculationType) { }
    private record StatutoryDeductions(List<Deduction> items, List<String> warnings) { }
    private record TaxResult(double amount, List<String> warnings) { }
    private record AggregationKey(String itemCode, String costCenter) { }
    private record RunItemWithEmployee(RunItemEntity item, int employeeId) { }
    private record LineDraft(int lineNo, String account, String costCenter, double debit, double credit, String summary, String sourceItem) { }
    public record MissingMappingsDetail(String message, List<MappingGapItem> missingItemCodes) { }
}
