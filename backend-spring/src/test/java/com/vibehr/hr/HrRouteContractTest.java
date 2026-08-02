package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

class HrRouteContractTest {
    @Test
    void exposesExactlyTheSevenEmployeeAndThirtySixHrCanonicalRoutes() {
        Set<String> expected = Set.of(
                "GET /api/v1/employees", "GET /api/v1/employees/departments", "POST /api/v1/employees", "POST /api/v1/employees/batch", "GET /api/v1/employees/me", "PUT /api/v1/employees/{employee_id}", "DELETE /api/v1/employees/{employee_id}",
                "GET /api/v1/hr/basic/admin-records", "GET /api/v1/hr/basic/{employee_id}", "PUT /api/v1/hr/basic/{employee_id}/profile", "POST /api/v1/hr/basic/{employee_id}/records", "PUT /api/v1/hr/basic/{employee_id}/records/{record_id}", "DELETE /api/v1/hr/basic/{employee_id}/records/{record_id}",
                "GET /api/v1/hr/recruit/finalists", "POST /api/v1/hr/recruit/finalists", "PUT /api/v1/hr/recruit/finalists/{finalist_id}", "DELETE /api/v1/hr/recruit/finalists", "POST /api/v1/hr/recruit/finalists/if-sync", "POST /api/v1/hr/recruit/finalists/generate-employee-no", "POST /api/v1/hr/recruit/finalists/create-employees",
                "GET /api/v1/hr/appointment-codes", "POST /api/v1/hr/appointment-codes", "PUT /api/v1/hr/appointment-codes/{code_id}", "DELETE /api/v1/hr/appointment-codes/{code_id}",
                "GET /api/v1/hr/appointments/records", "POST /api/v1/hr/appointments/records", "PUT /api/v1/hr/appointments/records/{item_id}", "DELETE /api/v1/hr/appointments/records/{item_id}", "POST /api/v1/hr/appointments/orders/{order_id}/confirm",
                "GET /api/v1/hr/retire/checklist", "POST /api/v1/hr/retire/checklist", "PUT /api/v1/hr/retire/checklist/{checklist_item_id}", "GET /api/v1/hr/retire/cases", "POST /api/v1/hr/retire/cases", "GET /api/v1/hr/retire/cases/{case_id}", "PUT /api/v1/hr/retire/cases/{case_id}/items/{case_item_id}", "POST /api/v1/hr/retire/cases/{case_id}/confirm", "POST /api/v1/hr/retire/cases/{case_id}/cancel",
                "GET /api/v1/hr/severance/calcs", "GET /api/v1/hr/severance/calcs/{calc_id}", "POST /api/v1/hr/severance/calcs/{calc_id}/recalculate", "PUT /api/v1/hr/severance/calcs/{calc_id}", "POST /api/v1/hr/severance/calcs/{calc_id}/confirm"
        );
        String prefix = HrController.class.getAnnotation(RequestMapping.class).value()[0];
        Set<String> actual = new LinkedHashSet<>();
        for (Method method : HrController.class.getDeclaredMethods()) {
            add(actual, "GET", prefix, method.getAnnotation(GetMapping.class) == null ? null : method.getAnnotation(GetMapping.class).value());
            add(actual, "POST", prefix, method.getAnnotation(PostMapping.class) == null ? null : method.getAnnotation(PostMapping.class).value());
            add(actual, "PUT", prefix, method.getAnnotation(PutMapping.class) == null ? null : method.getAnnotation(PutMapping.class).value());
            add(actual, "DELETE", prefix, method.getAnnotation(DeleteMapping.class) == null ? null : method.getAnnotation(DeleteMapping.class).value());
            for (Parameter parameter : method.getParameters()) {
                if (parameter.isAnnotationPresent(RequestBody.class)) assertThat(parameter.getType()).isAssignableTo(HrRequests.Tracked.class);
            }
        }
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(actual).hasSize(43);
    }

    private void add(Set<String> routes, String verb, String prefix, String[] paths) {
        if (paths == null) return;
        for (String path : paths) routes.add(verb + " " + prefix + path);
    }
}
