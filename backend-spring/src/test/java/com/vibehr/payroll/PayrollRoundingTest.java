package com.vibehr.payroll;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PayrollRoundingTest {
    @Test
    void roundsLegacyPythonFloatInputsUsingTheirBinaryHalfEvenValues() {
        assertThat(PayrollService.money(1.005d)).isEqualTo(1.00d);
        assertThat(PayrollService.money(2.345d)).isEqualTo(2.35d);
        assertThat(PayrollService.money(2.355d)).isEqualTo(2.35d);
        assertThat(PayrollService.money(123.455d)).isEqualTo(123.45d);
        assertThat(PayrollService.wholeWon(12.5d)).isEqualTo(12d);
        assertThat(PayrollService.wholeWon(13.5d)).isEqualTo(14d);
    }
}
