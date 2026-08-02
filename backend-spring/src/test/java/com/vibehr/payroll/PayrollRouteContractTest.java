package com.vibehr.payroll;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

class PayrollRouteContractTest {
    @Test
    void implementsExactlyThe41CanonicalPayRoutes() {
        Set<String> expected = Set.of(
                "GET /api/v1/pay/severance-item-rules", "POST /api/v1/pay/severance-item-rules/batch",
                "GET /api/v1/pay/setup/codes", "POST /api/v1/pay/setup/codes/batch",
                "GET /api/v1/pay/setup/tax-rates", "POST /api/v1/pay/setup/tax-rates/batch",
                "GET /api/v1/pay/setup/income-tax-brackets", "POST /api/v1/pay/setup/income-tax-brackets/batch",
                "GET /api/v1/pay/setup/allowance-deductions", "POST /api/v1/pay/setup/allowance-deductions/batch",
                "GET /api/v1/pay/setup/item-groups", "POST /api/v1/pay/setup/item-groups/batch",
                "GET /api/v1/pay/gl-accounts", "POST /api/v1/pay/gl-accounts/batch",
                "GET /api/v1/pay/gl-mappings", "POST /api/v1/pay/gl-mappings/batch",
                "POST /api/v1/pay/vouchers/generate", "POST /api/v1/pay/vouchers/generate-disbursement",
                "GET /api/v1/pay/vouchers", "GET /api/v1/pay/vouchers/mapping-gaps",
                "GET /api/v1/pay/vouchers/{voucher_id}", "GET /api/v1/pay/vouchers/{voucher_id}/export",
                "POST /api/v1/pay/vouchers/{voucher_id}/confirm", "POST /api/v1/pay/vouchers/{voucher_id}/cancel",
                "GET /api/v1/pay/employee-profiles", "POST /api/v1/pay/employee-profiles/batch",
                "GET /api/v1/pay/variable-inputs", "POST /api/v1/pay/variable-inputs/batch",
                "GET /api/v1/pay/runs", "POST /api/v1/pay/runs", "POST /api/v1/pay/runs/{run_id}/calculate",
                "POST /api/v1/pay/runs/{run_id}/recalculate", "POST /api/v1/pay/runs/{run_id}/snapshot-backfill",
                "POST /api/v1/pay/runs/{run_id}/close", "POST /api/v1/pay/runs/{run_id}/mark-paid",
                "GET /api/v1/pay/runs/{run_id}/employees", "GET /api/v1/pay/runs/{run_id}/employees/{run_employee_id}",
                "GET /api/v1/pay/my/payslips", "GET /api/v1/pay/my/payslips/{run_id}",
                "GET /api/v1/pay/my/payslips/{run_id}/pdf", "GET /api/v1/pay/runs/{run_id}/employees/{employee_id}/pdf");

        RequestMapping base = PayrollController.class.getAnnotation(RequestMapping.class);
        Set<String> actual = new HashSet<>();
        for (Method method : PayrollController.class.getDeclaredMethods()) {
            GetMapping get = method.getAnnotation(GetMapping.class);
            if (get != null) Arrays.stream(get.value()).forEach(path -> actual.add("GET " + base.value()[0] + path));
            PostMapping post = method.getAnnotation(PostMapping.class);
            if (post != null) Arrays.stream(post.value()).forEach(path -> actual.add("POST " + base.value()[0] + path));
        }

        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected);
    }
}
