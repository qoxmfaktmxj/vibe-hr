package com.vibehr.payroll;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith(OutputCaptureExtension.class)
class PayrollVoucherLoggingTest {
    @Test
    void isolatedAutomaticVoucherFailureIsObservableWithRunAndAction(CapturedOutput output) {
        PayrollService.logAutomaticVoucherFailure(73, new IllegalStateException("missing GL mapping"));

        assertThat(output.getOut() + output.getErr())
                .contains("WARN", "Failed to auto-generate accrual voucher draft", "run_id=73", "action=close", "missing GL mapping");
    }
}
