package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class TimeFormulaTest {
    @Test
    void calculatesRegularOvertimeAndKstNightMinutesAcrossMidnight() {
        Instant checkIn = instant("2026-08-03T21:00");
        Instant checkOut = instant("2026-08-04T07:00");

        TimeFormula.WorkMinutes actual = TimeFormula.calculate(checkIn, checkOut, "present", 60, 480, false, true);

        assertThat(actual.actualMinutes()).isEqualTo(540);
        assertThat(actual.regularMinutes()).isEqualTo(480);
        assertThat(actual.overtimeMinutes()).isEqualTo(60);
        assertThat(actual.nightMinutes()).isEqualTo(480);
        assertThat(actual.holidayWork()).isFalse();
    }

    @Test
    void calculatesHolidayBaseOvertimeAndNightBucketsSeparately() {
        TimeFormula.WorkMinutes actual = TimeFormula.calculate(instant("2026-08-02T09:00"), instant("2026-08-02T20:00"),
                "present", 60, 480, true, false);

        assertThat(actual.actualMinutes()).isEqualTo(600);
        assertThat(actual.holidayWorkMinutes()).isEqualTo(480);
        assertThat(actual.holidayOvertimeMinutes()).isEqualTo(120);
        assertThat(actual.holidayNightMinutes()).isZero();
        assertThat(actual.holidayWork()).isTrue();
    }

    @Test
    void excludesAbsentAndLeaveRowsFromCalculatedMinutes() {
        TimeFormula.WorkMinutes actual = TimeFormula.calculate(instant("2026-08-03T09:00"), instant("2026-08-03T18:00"),
                "leave", 60, 480, false, true);

        assertThat(actual).isEqualTo(TimeFormula.WorkMinutes.empty());
    }

    @Test
    void normalizesNaivePlannedKstToThePriorUtcDate() {
        assertThat(TimeFormula.normalizeNaivePlannedKst(LocalDateTime.of(2026, 8, 2, 0, 0)))
                .isEqualTo(Instant.parse("2026-08-01T15:00:00Z"));
    }

    private Instant instant(String localKst) {
        return LocalDateTime.parse(localKst).atZone(TimeFormula.KST).toInstant();
    }
}
