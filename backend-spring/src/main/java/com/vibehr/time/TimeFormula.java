package com.vibehr.time;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

final class TimeFormula {
    static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int HOLIDAY_BASE_MINUTES = 480;

    private TimeFormula() { }

    static WorkMinutes calculate(Instant checkInAt, Instant checkOutAt, String attendanceStatus,
            int breakMinutes, int expectedMinutes, boolean isHoliday, boolean isWorkday) {
        if (checkInAt == null || checkOutAt == null || !checkOutAt.isAfter(checkInAt)
                || "absent".equals(attendanceStatus) || "leave".equals(attendanceStatus)) {
            return WorkMinutes.empty();
        }
        int actual = Math.max(0, (int) Duration.between(checkInAt, checkOutAt).toMinutes() - Math.max(0, breakMinutes));
        int night = nightOverlapMinutes(checkInAt.atZone(KST), checkOutAt.atZone(KST));
        if (isHoliday || !isWorkday) {
            return new WorkMinutes(actual, 0, 0, 0, Math.min(actual, HOLIDAY_BASE_MINUTES),
                    Math.max(0, actual - HOLIDAY_BASE_MINUTES), night, true);
        }
        return new WorkMinutes(actual, Math.min(actual, Math.max(0, expectedMinutes)),
                Math.max(0, actual - Math.max(0, expectedMinutes)), night, 0, 0, 0, false);
    }

    static int nightOverlapMinutes(ZonedDateTime start, ZonedDateTime end) {
        if (!end.isAfter(start)) return 0;
        int total = 0;
        for (LocalDate day = start.toLocalDate(); !day.isAfter(end.toLocalDate()); day = day.plusDays(1)) {
            total += overlapMinutes(start, end, day.atTime(LocalTime.MIDNIGHT).atZone(KST), day.atTime(6, 0).atZone(KST));
            total += overlapMinutes(start, end, day.atTime(22, 0).atZone(KST), day.plusDays(1).atStartOfDay(KST));
        }
        return total;
    }

    private static int overlapMinutes(ZonedDateTime start, ZonedDateTime end, ZonedDateTime rangeStart, ZonedDateTime rangeEnd) {
        ZonedDateTime overlapStart = start.isAfter(rangeStart) ? start : rangeStart;
        ZonedDateTime overlapEnd = end.isBefore(rangeEnd) ? end : rangeEnd;
        return overlapEnd.isAfter(overlapStart) ? (int) Duration.between(overlapStart, overlapEnd).toMinutes() : 0;
    }

    static Instant scheduledInstant(LocalDate workDate, String hhmm) {
        if (hhmm == null) return null;
        return LocalDateTime.of(workDate, LocalTime.parse(hhmm)).atZone(KST).toInstant();
    }

    static LocalDateTime scheduledLocalDateTime(LocalDate workDate, String hhmm) {
        return hhmm == null ? null : LocalDateTime.of(workDate, LocalTime.parse(hhmm));
    }

    static Instant normalizeNaivePlannedKst(LocalDateTime plannedAt) {
        return plannedAt == null ? null : plannedAt.atZone(KST).toInstant();
    }

    record WorkMinutes(int actualMinutes, int regularMinutes, int overtimeMinutes, int nightMinutes,
            int holidayWorkMinutes, int holidayOvertimeMinutes, int holidayNightMinutes, boolean holidayWork) {
        static WorkMinutes empty() { return new WorkMinutes(0, 0, 0, 0, 0, 0, 0, false); }
    }
}
