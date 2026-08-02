package com.vibehr.payroll;

import static com.vibehr.payroll.PayrollContracts.*;

import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The 41 canonical FastAPI PAY method/path contracts. */
@Validated
@RestController
@RequestMapping("/api/v1/pay")
public class PayrollController {
    private final PayrollService service;
    private final PayrollAuthorization authorization;
    private final PayslipPdfService payslipPdfService;

    public PayrollController(PayrollService service, PayrollAuthorization authorization, PayslipPdfService payslipPdfService) {
        this.service = service;
        this.authorization = authorization;
        this.payslipPdfService = payslipPdfService;
    }

    @GetMapping("/setup/codes")
    public PayrollCodeListResponse payrollCodes(Authentication authentication) { setup(authentication, "payroll.codes", "query"); return service.listPayrollCodes(); }
    @PostMapping("/setup/codes/batch")
    public PayrollCodeBatchResponse savePayrollCodes(Authentication authentication, @Valid @RequestBody PayrollCodeBatchRequest request) { setup(authentication, "payroll.codes", "save"); return service.savePayrollCodes(request); }
    @GetMapping("/setup/tax-rates")
    public TaxRateListResponse taxRates(Authentication authentication) { setup(authentication, "payroll.tax-rates", "query"); return service.listTaxRates(); }
    @PostMapping("/setup/tax-rates/batch")
    public TaxRateBatchResponse saveTaxRates(Authentication authentication, @Valid @RequestBody TaxRateBatchRequest request) { setup(authentication, "payroll.tax-rates", "save"); return service.saveTaxRates(request); }
    @GetMapping("/setup/income-tax-brackets")
    public IncomeTaxBracketListResponse incomeTaxBrackets(Authentication authentication) { setup(authentication, "payroll.income-tax-brackets", "query"); return service.listIncomeTaxBrackets(); }
    @PostMapping("/setup/income-tax-brackets/batch")
    public IncomeTaxBracketBatchResponse saveIncomeTaxBrackets(Authentication authentication, @Valid @RequestBody IncomeTaxBracketBatchRequest request) { setup(authentication, "payroll.income-tax-brackets", "save"); return service.saveIncomeTaxBrackets(request); }
    @GetMapping("/setup/allowance-deductions")
    public AllowanceDeductionListResponse allowanceDeductions(Authentication authentication) { setup(authentication, "payroll.allowance-deduction-items", "query"); return service.listAllowanceDeductions(); }
    @PostMapping("/setup/allowance-deductions/batch")
    public AllowanceDeductionBatchResponse saveAllowanceDeductions(Authentication authentication, @Valid @RequestBody AllowanceDeductionBatchRequest request) { setup(authentication, "payroll.allowance-deduction-items", "save"); return service.saveAllowanceDeductions(request); }
    @GetMapping("/setup/item-groups")
    public ItemGroupListResponse itemGroups(Authentication authentication) { setup(authentication, "payroll.item-groups", "query"); return service.listItemGroups(); }
    @PostMapping("/setup/item-groups/batch")
    public ItemGroupBatchResponse saveItemGroups(Authentication authentication, @Valid @RequestBody ItemGroupBatchRequest request) { setup(authentication, "payroll.item-groups", "save"); return service.saveItemGroups(request); }

    @GetMapping("/severance-item-rules")
    public SeveranceItemRuleListResponse severanceItemRules(Authentication authentication) { payrollOrHr(authentication); return service.listSeveranceItemRules(); }
    @PostMapping("/severance-item-rules/batch")
    public SeveranceItemRuleBatchResponse saveSeveranceItemRules(Authentication authentication, @Valid @RequestBody SeveranceItemRuleBatchRequest request) { payrollOrHr(authentication); return service.saveSeveranceItemRules(request); }

    @GetMapping("/gl-accounts")
    public GlAccountListResponse glAccounts(Authentication authentication) { payroll(authentication); return service.listGlAccounts(); }
    @PostMapping("/gl-accounts/batch")
    public GlAccountBatchResponse saveGlAccounts(Authentication authentication, @Valid @RequestBody GlAccountBatchRequest request) { payroll(authentication); return service.saveGlAccounts(request); }
    @GetMapping("/gl-mappings")
    public GlMappingListResponse glMappings(Authentication authentication) { payroll(authentication); return service.listGlMappings(); }
    @PostMapping("/gl-mappings/batch")
    public GlMappingBatchResponse saveGlMappings(Authentication authentication, @Valid @RequestBody GlMappingBatchRequest request) { payroll(authentication); return service.saveGlMappings(request); }
    @PostMapping("/vouchers/generate")
    public VoucherActionResponse generateVoucher(Authentication authentication, @Valid @RequestBody VoucherGenerateRequest request) { return service.generateVoucher(request.runId(), payroll(authentication)); }
    @PostMapping("/vouchers/generate-disbursement")
    public VoucherActionResponse generateDisbursementVoucher(Authentication authentication, @Valid @RequestBody VoucherGenerateRequest request) { return service.generateDisbursementVoucher(request.runId(), payroll(authentication)); }
    @GetMapping("/vouchers")
    public VoucherListResponse vouchers(Authentication authentication, @RequestParam(name = "year_month", required = false) String yearMonth, @RequestParam(name = "status", required = false) String status) { payroll(authentication); return service.listVouchers(yearMonth, status); }
    @GetMapping("/vouchers/mapping-gaps")
    public MappingGapsResponse mappingGaps(Authentication authentication, @RequestParam(name = "run_id") int runId) { payroll(authentication); return service.mappingGaps(runId); }
    @GetMapping("/vouchers/{voucher_id}")
    public VoucherDetailResponse voucher(Authentication authentication, @PathVariable("voucher_id") int voucherId) { payroll(authentication); return service.voucherDetail(voucherId); }
    @GetMapping("/vouchers/{voucher_id}/export")
    public ResponseEntity<?> exportVoucher(Authentication authentication, @PathVariable("voucher_id") int voucherId, @RequestParam(defaultValue = "csv") @Pattern(regexp = "^(csv|json)$") String format) {
        payroll(authentication);
        PayrollService.VoucherExport export = service.voucherExport(voucherId);
        if ("json".equals(format)) return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + export.voucherNo() + ".json\"").contentType(MediaType.APPLICATION_JSON).body(export);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + export.voucherNo() + ".csv\"").contentType(MediaType.parseMediaType("text/csv; charset=utf-8")).body(csv(export).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    @PostMapping("/vouchers/{voucher_id}/confirm")
    public VoucherActionResponse confirmVoucher(Authentication authentication, @PathVariable("voucher_id") int voucherId) { return service.confirmVoucher(voucherId, payroll(authentication)); }
    @PostMapping("/vouchers/{voucher_id}/cancel")
    public VoucherActionResponse cancelVoucher(Authentication authentication, @PathVariable("voucher_id") int voucherId) { payroll(authentication); return service.cancelVoucher(voucherId); }

    @GetMapping("/employee-profiles")
    public EmployeeProfileListResponse employeeProfiles(Authentication authentication) { payroll(authentication); return service.listEmployeeProfiles(); }
    @PostMapping("/employee-profiles/batch")
    public EmployeeProfileBatchResponse saveEmployeeProfiles(Authentication authentication, @Valid @RequestBody EmployeeProfileBatchRequest request) { payroll(authentication); return service.saveEmployeeProfiles(request); }
    @GetMapping("/variable-inputs")
    public VariableInputListResponse variableInputs(Authentication authentication, @RequestParam(name = "year_month", required = false) String yearMonth) { payroll(authentication); return service.listVariableInputs(yearMonth); }
    @PostMapping("/variable-inputs/batch")
    public VariableInputBatchResponse saveVariableInputs(Authentication authentication, @Valid @RequestBody VariableInputBatchRequest request) { payroll(authentication); return service.saveVariableInputs(request); }
    @GetMapping("/runs")
    public PayrollRunListResponse payrollRuns(Authentication authentication, @RequestParam(name = "year_month", required = false) String yearMonth, @RequestParam(name = "status", required = false) String status) { payroll(authentication); return service.listPayrollRuns(yearMonth, status); }
    @PostMapping("/runs")
    public PayrollRunActionResponse createPayrollRun(Authentication authentication, @Valid @RequestBody PayrollRunCreateRequest request) { payroll(authentication); return service.createPayrollRun(request); }
    @PostMapping("/runs/{run_id}/calculate")
    public PayrollRunActionResponse calculatePayrollRun(Authentication authentication, @PathVariable("run_id") int runId) { payroll(authentication); return service.calculatePayrollRun(runId); }
    @PostMapping("/runs/{run_id}/recalculate")
    public PayrollRunActionResponse recalculatePayrollRun(Authentication authentication, @PathVariable("run_id") int runId) { payroll(authentication); return service.calculatePayrollRun(runId); }
    @PostMapping("/runs/{run_id}/snapshot-backfill")
    public PayrollRunActionResponse refreshSnapshot(Authentication authentication, @PathVariable("run_id") int runId) { payroll(authentication); return service.refreshPayrollRunSnapshot(runId); }
    @PostMapping("/runs/{run_id}/close")
    public PayrollRunActionResponse closePayrollRun(Authentication authentication, @PathVariable("run_id") int runId) { payroll(authentication); return service.closePayrollRun(runId); }
    @PostMapping("/runs/{run_id}/mark-paid")
    public PayrollRunActionResponse markPayrollRunPaid(Authentication authentication, @PathVariable("run_id") int runId) { payroll(authentication); return service.markPayrollRunPaid(runId); }
    @GetMapping("/runs/{run_id}/employees")
    public PayrollRunEmployeeListResponse payrollRunEmployees(Authentication authentication, @PathVariable("run_id") int runId) { payroll(authentication); return service.listPayrollRunEmployees(runId); }
    @GetMapping("/runs/{run_id}/employees/{run_employee_id}")
    public PayrollRunEmployeeDetailResponse payrollRunEmployee(Authentication authentication, @PathVariable("run_id") int runId, @PathVariable("run_employee_id") int runEmployeeId) { payroll(authentication); return service.payrollRunEmployeeDetail(runId, runEmployeeId); }
    @GetMapping("/my/payslips")
    public MyPayslipListResponse myPayslips(Authentication authentication) { return service.listMyPayslips(resolveEmployeeId(authorization.currentUserId(authentication))); }
    @GetMapping("/my/payslips/{run_id}")
    public MyPayslipDetailResponse myPayslip(Authentication authentication, @PathVariable("run_id") int runId) { return service.myPayslipDetail(resolveEmployeeId(authorization.currentUserId(authentication)), runId); }
    @GetMapping("/my/payslips/{run_id}/pdf")
    public ResponseEntity<byte[]> myPayslipPdf(Authentication authentication, @PathVariable("run_id") int runId) { int employeeId = resolveEmployeeId(authorization.currentUserId(authentication)); return pdf(payslipPdfService.generate(runId, employeeId), "payslip-" + runId + ".pdf"); }
    @GetMapping("/runs/{run_id}/employees/{employee_id}/pdf")
    public ResponseEntity<byte[]> adminPayslipPdf(Authentication authentication, @PathVariable("run_id") int runId, @PathVariable("employee_id") int employeeId) { payroll(authentication); return pdf(payslipPdfService.generate(runId, employeeId), "payslip-" + runId + "-" + employeeId + ".pdf"); }

    private int payroll(Authentication authentication) { return authorization.requireAnyRole(authentication, "payroll_mgr", "admin"); }
    private int payrollOrHr(Authentication authentication) { return authorization.requireAnyRole(authentication, "hr_manager", "payroll_mgr", "admin"); }
    private void setup(Authentication authentication, String menuCode, String action) { authorization.requireMenuAction(payroll(authentication), menuCode, action); }
    private int resolveEmployeeId(int userId) { return service.employeeIdForUser(userId); }
    private static ResponseEntity<byte[]> pdf(byte[] bytes, String filename) { return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename).contentType(MediaType.APPLICATION_PDF).body(bytes); }
    private static String csv(PayrollService.VoucherExport export) {
        StringBuilder result = new StringBuilder("\uFEFFvoucher_no,voucher_date,line_no,gl_account_code,gl_account_name,cost_center_code,debit,credit,summary\r\n");
        for (PayrollService.VoucherExportLine line : export.lines()) result.append(csvField(line.voucherNo())).append(',').append(csvField(line.voucherDate().toString())).append(',').append(line.lineNo()).append(',').append(csvField(line.glAccountCode())).append(',').append(csvField(line.glAccountName())).append(',').append(csvField(line.costCenterCode())).append(',').append(line.debit()).append(',').append(line.credit()).append(',').append(csvField(line.summary())).append("\r\n");
        return result.toString();
    }
    private static String csvField(String value) {
        String text = value == null ? "" : value;
        if (requiresSpreadsheetLiteral(text)) text = "'" + text;
        return text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")
                ? "\"" + text.replace("\"", "\"\"") + "\""
                : text;
    }

    private static boolean requiresSpreadsheetLiteral(String text) {
        for (int index = 0; index < text.length(); index++) {
            char character = text.charAt(index);
            if (character == '=' || character == '+' || character == '-' || character == '@') return true;
            if (character == '\t' || character == '\r') return true;
            if (!Character.isWhitespace(character) && !Character.isISOControl(character)
                    && Character.getType(character) != Character.FORMAT) return false;
        }
        return false;
    }
}
