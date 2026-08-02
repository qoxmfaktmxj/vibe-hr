package com.vibehr.dashboard;

import com.vibehr.dashboard.DashboardService.DashboardSummary;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@Profile("!test")
public class DashboardController {

    private final DashboardService service;

    DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    DashboardSummary summary() {
        return service.summary();
    }
}
