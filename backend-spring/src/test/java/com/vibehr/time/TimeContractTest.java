package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class TimeContractTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void appliesLegacyDefaultsForOptionalCodeAndScheduleFields() {
        TimAttendanceCodeBatchItem attendance = new TimAttendanceCodeBatchItem(null, "ANNUAL", "Annual", "leave",
                null, null, null, null, null, null, null, null);
        TimWorkScheduleCodeBatchItem schedule = new TimWorkScheduleCodeBatchItem(null, "DAY", "Day", "09:00", "18:00",
                null, null, null, null, null, null);
        TimScheduleGenerateRequest generation = new TimScheduleGenerateRequest(null, null, null,
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), null);

        assertThat(attendance.unit()).isEqualTo("day");
        assertThat(attendance.isRequestable()).isTrue();
        assertThat(attendance.deductAnnual()).isFalse();
        assertThat(schedule.breakMinutes()).isEqualTo(60);
        assertThat(schedule.workHours()).isEqualTo(8.0);
        assertThat(generation.target()).isEqualTo("all");
        assertThat(generation.mode()).isEqualTo("create_if_missing");
    }

    @Test
    void rejectsInvalidNestedScheduleTimeWithTypedBeanValidation() {
        TimWorkScheduleCodeBatchItem invalid = new TimWorkScheduleCodeBatchItem(null, "DAY", "Day", "9:00", "18:00",
                60, false, 8.0, true, 0, null);
        TimWorkScheduleCodeBatchRequest request = new TimWorkScheduleCodeBatchRequest(List.of(invalid), List.of());

        assertThat(validator.validate(request)).isNotEmpty();
    }
}
