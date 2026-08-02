package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;

class HrSeveranceMathTest {
    @Test
    void preservesTheLegacyInclusiveServiceDaysAndThreeMonthWindow() {
        assertThat(HrSeveranceMath.serviceDays(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31))).isEqualTo(365);
        assertThat(HrSeveranceMath.averageWagePeriod(LocalDate.of(2026, 5, 31))).containsExactly(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 5, 30));
        assertThat(HrSeveranceMath.severance(100_000d, 365)).isEqualTo(3_000_000d);
    }

    @Test
    void keepsDoublePrecisionApiCompatibilityAfterBigDecimalCalculation() {
        Map<String, Object> tax = HrSeveranceMath.tax(100_000_000d, 3_650, 15d, 1_260_000d, 2026, null);
        assertThat(tax).containsEntry("service_years", 10)
                .containsEntry("service_year_deduction", 15_000_000d)
                .containsEntry("conversion_income", 102_000_000d)
                .containsEntry("conversion_income_deduction", 62_600_000d)
                .containsEntry("taxable_base", 39_400_000d)
                .containsEntry("income_tax", 3_875_000d)
                .containsEntry("local_income_tax", 387_500d)
                .containsEntry("net_severance", 95_737_500d);
        assertThat(tax.get("income_tax")).isInstanceOf(Double.class);
        assertThat(tax.get("net_severance")).isInstanceOf(Double.class);
    }

    @Test
    void underOneYearSnapshotKeepsLegacyZeroTaxAndFinalAmount() {
        Map<String, Object> tax = HrSeveranceMath.tax(125_000d, 364, 99d, 99_999d, 2025, "ignored");
        assertThat(tax).containsEntry("service_years", 1)
                .containsEntry("income_tax", 0d)
                .containsEntry("local_income_tax", 0d)
                .containsEntry("net_severance", 125_000d)
                .containsEntry("tax_table_year", null)
                .containsEntry("warning", null);
        assertThat(tax).doesNotContainKey("bracket_year");
    }
}
