package com.vibehr.welfare;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class WelfareRouteContractTest {
    @Test
    void exposesExactlyTheEightCanonicalWelfareRoutes() {
        Set<String> expected = Set.of(
                "GET /benefit-types", "POST /benefit-types/batch", "GET /requests", "POST /requests",
                "GET /my-requests", "POST /requests/{req_id}/approve", "POST /requests/{req_id}/reject",
                "PUT /requests/{req_id}/withdraw");
        Set<String> actual = new LinkedHashSet<>();
        for (Method method : WelfareController.class.getDeclaredMethods()) {
            add(actual, "GET", method.getAnnotation(GetMapping.class) == null ? null : method.getAnnotation(GetMapping.class).value());
            add(actual, "POST", method.getAnnotation(PostMapping.class) == null ? null : method.getAnnotation(PostMapping.class).value());
            add(actual, "PUT", method.getAnnotation(PutMapping.class) == null ? null : method.getAnnotation(PutMapping.class).value());
        }
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected).hasSize(8);
    }

    private void add(Set<String> routes, String verb, String[] paths) {
        if (paths == null) return;
        for (String path : paths) routes.add(verb + " " + path);
    }
}
