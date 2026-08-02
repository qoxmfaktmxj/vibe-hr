package com.vibehr.management;

import static org.assertj.core.api.Assertions.assertThat;

import com.vibehr.management.api.ManagementCompanyController;
import com.vibehr.management.api.ManagementDevelopmentController;
import com.vibehr.management.api.ManagementInfrastructureController;
import com.vibehr.management.api.ManagementOutsourceController;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class ManagementRouteContractTest {
    @Test
    void exposesExactlyTheFortyThreeLegacyManagementRoutes() {
        assertThat(routes(ManagementCompanyController.class)).hasSize(9);
        assertThat(routes(ManagementDevelopmentController.class)).hasSize(18);
        assertThat(routes(ManagementOutsourceController.class)).hasSize(10);
        assertThat(routes(ManagementInfrastructureController.class)).hasSize(6);

        Set<String> allRoutes = new LinkedHashSet<>();
        allRoutes.addAll(routes(ManagementCompanyController.class));
        allRoutes.addAll(routes(ManagementDevelopmentController.class));
        allRoutes.addAll(routes(ManagementOutsourceController.class));
        allRoutes.addAll(routes(ManagementInfrastructureController.class));
        assertThat(allRoutes).hasSize(43).contains(
                "GET /companies", "POST /companies", "GET /dev-requests/monthly-summary",
                "PUT /dev-projects/{project_id}", "GET /outsource-contracts/check-duplicate",
                "POST /infra-configs/{master_id}", "DELETE /infra-configs/{config_id}");
    }

    private Set<String> routes(Class<?> controller) {
        Set<String> routes = new LinkedHashSet<>();
        for (Method method : controller.getDeclaredMethods()) {
            add(routes, "GET", method.getAnnotation(GetMapping.class) == null ? null : method.getAnnotation(GetMapping.class).value());
            add(routes, "POST", method.getAnnotation(PostMapping.class) == null ? null : method.getAnnotation(PostMapping.class).value());
            add(routes, "PUT", method.getAnnotation(PutMapping.class) == null ? null : method.getAnnotation(PutMapping.class).value());
            add(routes, "DELETE", method.getAnnotation(DeleteMapping.class) == null ? null : method.getAnnotation(DeleteMapping.class).value());
        }
        return routes;
    }

    private void add(Set<String> routes, String method, String[] paths) {
        if (paths != null) Arrays.stream(paths).forEach(path -> routes.add(method + " " + path));
    }
}
