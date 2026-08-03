package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

class TimeRouteContractTest {
    @Test
    void exposesExactlyTheThirtySixCanonicalTimRoutes() {
        Set<String> expected = Set.of(
                "GET /tim/attendance-codes", "POST /tim/attendance-codes/batch",
                "GET /tim/work-schedules", "POST /tim/work-schedules/batch",
                "GET /tim/holidays", "POST /tim/holidays/batch", "POST /tim/holidays/copy-year",
                "GET /tim/schedules/patterns", "GET /tim/schedules/departments", "POST /tim/schedules/departments/batch",
                "GET /tim/schedules/exceptions/employees", "POST /tim/schedules/exceptions/employees/batch",
                "POST /tim/schedules/generate", "GET /tim/schedules/me/today",
                "GET /tim/attendance-daily", "GET /tim/attendance-daily/today", "GET /tim/attendance-daily/today-schedule",
                "GET /tim/attendance-daily/detail/{attendance_id}", "POST /tim/attendance-daily/check-in",
                "POST /tim/attendance-daily/check-out", "POST /tim/attendance-daily/{attendance_id}/correct",
                "GET /tim/attendance-daily/{attendance_id}/corrections",
                "GET /tim/annual-leave/employee/{employee_id}", "GET /tim/annual-leave/my", "POST /tim/annual-leave/adjust",
                "GET /tim/annual-leave/list", "GET /tim/leave-requests", "GET /tim/leave-requests/my", "POST /tim/leave-requests",
                "POST /tim/leave-requests/{request_id}/approve", "POST /tim/leave-requests/{request_id}/reject",
                "POST /tim/leave-requests/{request_id}/cancel", "GET /tim/month-close", "POST /tim/month-close",
                "POST /tim/month-close/{year}/{month}/reopen", "GET /tim/reports/summary");
        List<String> actual = new ArrayList<>();
        for (Method method : TimeController.class.getDeclaredMethods()) {
            add(actual, "GET", method.getAnnotation(GetMapping.class) == null ? null : method.getAnnotation(GetMapping.class).value());
            add(actual, "POST", method.getAnnotation(PostMapping.class) == null ? null : method.getAnnotation(PostMapping.class).value());
        }
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected).hasSize(36);
    }

    @Test
    void attendanceDailyKeepsTheFrontendSnakeCaseQueryContract() {
        Method method = java.util.Arrays.stream(TimeController.class.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals("attendanceDaily"))
                .findFirst().orElseThrow();

        assertThat(method.getParameters()[1].getAnnotation(RequestParam.class).name()).isEqualTo("start_date");
        assertThat(method.getParameters()[2].getAnnotation(RequestParam.class).name()).isEqualTo("end_date");
        assertThat(method.getParameters()[3].getAnnotation(RequestParam.class).name()).isEqualTo("employee_id");
    }

    private void add(List<String> routes, String verb, String[] paths) {
        if (paths == null) return;
        for (String path : paths) routes.add(verb + " " + path);
    }
}
