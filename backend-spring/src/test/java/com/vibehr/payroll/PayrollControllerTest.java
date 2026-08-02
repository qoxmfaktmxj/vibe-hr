package com.vibehr.payroll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.error.ApiExceptionHandler;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

class PayrollControllerTest {
    private final PayrollService service = mock(PayrollService.class);
    private final PayrollAuthorization authorization = mock(PayrollAuthorization.class);
    private final PayslipPdfService pdf = mock(PayslipPdfService.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = mockMvc(authorization);
    }

    @Test
    void invalidNestedBatchItemReturnsPythonStyle422BeforeAuthorizationOrService() throws Exception {
        mockMvc.perform(post("/api/v1/pay/setup/codes/batch")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"code\":\"\",\"name\":\"Monthly\",\"pay_type\":\"regular\",\"payment_day\":\"25\"}]}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"));

        verifyNoInteractions(authorization, service, pdf);
    }

    @Test
    void explicitNullDeleteIdsIsRejectedWhileOmissionRemainsValid() throws Exception {
        mockMvc.perform(post("/api/v1/pay/setup/codes/batch")
                        .principal(new TestingAuthenticationToken("17", "token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"code\":\"M01\",\"name\":\"Monthly\",\"pay_type\":\"regular\",\"payment_day\":\"25\"}],\"delete_ids\":null}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail[0].loc[0]").value("body"));

        verifyNoInteractions(authorization, service, pdf);
    }

    @Test
    void unauthenticatedPayrollRouteReturns401() throws Exception {
        MockMvc unauthenticated = mockMvc(new PayrollAuthorization(mock(EntityManager.class)));

        unauthenticated.perform(get("/api/v1/pay/gl-accounts"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Not authenticated."));
    }

    @Test
    void deniedSetupActionReturns403BeforeTheService() throws Exception {
        when(authorization.requireAnyRole(any(), eq("payroll_mgr"), eq("admin"))).thenReturn(17);
        doThrow(ApiException.forbidden("Action not allowed.")).when(authorization)
                .requireMenuAction(17, "payroll.codes", "query");

        mockMvc.perform(get("/api/v1/pay/setup/codes").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Action not allowed."));

        verifyNoInteractions(service, pdf);
    }

    @Test
    void successResponseUsesSnakeCaseAndTheSourceRoleGate() throws Exception {
        when(authorization.requireAnyRole(any(), eq("payroll_mgr"), eq("admin"))).thenReturn(17);
        PayrollContracts.PayrollCodeItem item = new PayrollContracts.PayrollCodeItem(1, "M01", "Monthly", "regular", "25", true, true, true, null, null);
        when(service.listPayrollCodes()).thenReturn(new PayrollContracts.PayrollCodeListResponse(List.of(item), 1));

        mockMvc.perform(get("/api/v1/pay/setup/codes").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_count").value(1))
                .andExpect(jsonPath("$.items[0].pay_type").value("regular"))
                .andExpect(jsonPath("$.items[0].social_ins_deductible").value(true));

        verify(authorization).requireMenuAction(17, "payroll.codes", "query");
    }

    @Test
    void service404And409DetailsPassThroughUnchanged() throws Exception {
        when(authorization.requireAnyRole(any(), eq("payroll_mgr"), eq("admin"))).thenReturn(17);
        when(service.calculatePayrollRun(81)).thenThrow(ApiException.notFound("Payroll run not found."));
        when(service.calculatePayrollRun(82)).thenThrow(ApiException.conflict("Closed/paid run cannot be recalculated."));

        mockMvc.perform(post("/api/v1/pay/runs/81/calculate").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Payroll run not found."));
        mockMvc.perform(post("/api/v1/pay/runs/82/calculate").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Closed/paid run cannot be recalculated."));
    }

    @Test
    void voucherExportsAndPdfsRetainTheLegacyBinaryHeaders() throws Exception {
        when(authorization.requireAnyRole(any(), eq("payroll_mgr"), eq("admin"))).thenReturn(17);
        PayrollService.VoucherExport export = new PayrollService.VoucherExport("PV-202601-0001", LocalDate.of(2026, 1, 31), "accrual",
                List.of(new PayrollService.VoucherExportLine("PV-202601-0001", LocalDate.of(2026, 1, 31), 1, "5100", "Salary, expense", null, 10, 0, "January \"salary\"")));
        when(service.voucherExport(7)).thenReturn(export);
        when(pdf.generate(8, 9)).thenReturn("%PDF-1.4\n".getBytes());

        mockMvc.perform(get("/api/v1/pay/vouchers/7/export").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/csv;charset=utf-8"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"PV-202601-0001.csv\""))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\uFEFFvoucher_no")));
        mockMvc.perform(get("/api/v1/pay/runs/8/employees/9/pdf").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=payslip-8-9.pdf"))
                .andExpect(content().bytes("%PDF-1.4\n".getBytes()));

        assertThat(export.lines()).hasSize(1);
    }

    @Test
    void voucherCsvDefangsSpreadsheetFormulasAndPreservesRfc4180Structure() throws Exception {
        when(authorization.requireAnyRole(any(), eq("payroll_mgr"), eq("admin"))).thenReturn(17);
        PayrollService.VoucherExport export = new PayrollService.VoucherExport("PV-202601-0002", LocalDate.of(2026, 1, 31), "accrual",
                List.of(
                        new PayrollService.VoucherExportLine("=formula", LocalDate.of(2026, 1, 31), 1, "+account", "-name", "@center", -125.50, 0, "\tcommand"),
                        new PayrollService.VoucherExportLine("PV-202601-0002", LocalDate.of(2026, 1, 31), 2, "\rformula", " \tformula", "A,B", 0, 25, "line1\r\nline\"2\"")
                ));
        when(service.voucherExport(7)).thenReturn(export);

        String body = mockMvc.perform(get("/api/v1/pay/vouchers/7/export").principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("'=formula", "'+account", "'-name", "'@center", "'\tcommand", "\"'\rformula\"");
        assertThat(body).contains("' \tformula", "\"A,B\"", "\"line1\r\nline\"\"2\"\"\"");
        assertThat(body).contains(",-125.5,0.0,");
    }

    @Test
    void myPayslipListUsesOnlyTheAuthenticatedUsersEmployeeEvenWhenAnEmployeeParameterIsSupplied() throws Exception {
        when(authorization.currentUserId(any())).thenReturn(17);
        when(service.employeeIdForUser(17)).thenReturn(71);
        when(service.listMyPayslips(71)).thenReturn(new PayrollContracts.MyPayslipListResponse(List.of(), 0));

        mockMvc.perform(get("/api/v1/pay/my/payslips")
                        .param("employee_id", "999")
                        .principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_count").value(0));

        verify(service).employeeIdForUser(17);
        verify(service).listMyPayslips(71);
        verify(service, never()).employeeIdForUser(999);
    }

    @Test
    void myPayslipDetailAndPdfUseOnlyTheAuthenticatedUsersEmployee() throws Exception {
        when(authorization.currentUserId(any())).thenReturn(17);
        when(service.employeeIdForUser(17)).thenReturn(71);
        when(service.myPayslipDetail(71, 81)).thenReturn(new PayrollContracts.MyPayslipDetailResponse(null, List.of()));
        when(pdf.generate(81, 71)).thenReturn("%PDF-1.4\n".getBytes());

        mockMvc.perform(get("/api/v1/pay/my/payslips/81")
                        .param("employee_id", "999")
                        .principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/pay/my/payslips/81/pdf")
                        .param("employee_id", "999")
                        .principal(new TestingAuthenticationToken("17", "token")))
                .andExpect(status().isOk())
                .andExpect(content().bytes("%PDF-1.4\n".getBytes()));

        verify(service).myPayslipDetail(71, 81);
        verify(pdf).generate(81, 71);
        verify(service, never()).employeeIdForUser(999);
    }

    private MockMvc mockMvc(PayrollAuthorization testedAuthorization) {
        JsonMapper mapper = JsonMapper.builder().propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE).build();
        return MockMvcBuilders.standaloneSetup(new PayrollController(service, testedAuthorization, pdf))
                .setMessageConverters(new ByteArrayHttpMessageConverter(), new JacksonJsonHttpMessageConverter(mapper))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }
}
