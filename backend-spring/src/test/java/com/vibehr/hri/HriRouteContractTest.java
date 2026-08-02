package com.vibehr.hri;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

class HriRouteContractTest {
    @Test
    void exposesExactlyTheFifteenCanonicalHriRoutes() {
        Set<String> expected = Set.of(
                "GET /hri/form-types", "POST /hri/form-types/batch",
                "GET /hri/approval-templates", "POST /hri/approval-templates/batch",
                "POST /hri/requests/draft", "POST /hri/requests/{request_id}/submit", "POST /hri/requests/{request_id}/withdraw",
                "POST /hri/requests/{request_id}/approve", "POST /hri/requests/{request_id}/reject",
                "POST /hri/requests/{request_id}/receive-complete", "POST /hri/requests/{request_id}/receive-reject",
                "GET /hri/requests/my", "GET /hri/requests/{request_id}",
                "GET /hri/tasks/my-approvals", "GET /hri/tasks/my-receives");
        Set<String> actual = new LinkedHashSet<>();
        for (Method method : HriController.class.getDeclaredMethods()) {
            add(actual, "GET", method.getAnnotation(GetMapping.class) == null ? null : method.getAnnotation(GetMapping.class).value());
            add(actual, "POST", method.getAnnotation(PostMapping.class) == null ? null : method.getAnnotation(PostMapping.class).value());
        }
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected).hasSize(15);
    }

    private void add(Set<String> routes, String verb, String[] paths) {
        if (paths == null) return;
        for (String path : paths) routes.add(verb + " " + path);
    }
}
