package com.vibehr.hr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

class HrGridFilterTest {
    @Test void advancedFiltersUseBoundParametersForBothCountAndRows() {
        var parameters = Map.<String,Object>of("positions", List.of("팀장", "' OR 1=1 --"), "employmentStatuses", List.of("active", "leave"), "hireDateTo", LocalDate.of(2026, 9, 13), "offset", 100, "limit", 100);
        String rows = HrGridMapper.Sql.employees(parameters);
        String count = HrGridMapper.Sql.employeeCount(parameters);
        assertThat(rows).contains("e.position_title in (#{positions[0]},#{positions[1]})", "e.employment_status in (#{employmentStatuses[0]},#{employmentStatuses[1]})", "e.hire_date <= #{hireDateTo}", "offset #{offset} limit #{limit}").doesNotContain("OR 1=1");
        assertThat(count.substring(count.indexOf(" from"))).isEqualTo(rows.substring(rows.indexOf(" from"), rows.indexOf(" order by")));
        assertThat(HrGridMapper.Sql.employees(Map.of())).doesNotContain(" in (", "hire_date <=", " offset ");
    }

    @Test void advancedLookupRetainsReaderPermissionGate() {
        var service = mock(HrApplicationService.class);
        var authorization = mock(HrAuthorization.class);
        var controller = new HrController(service, authorization);
        var auth = new TestingAuthenticationToken("17", "token");
        when(authorization.requireAnyRole(auth, "hr_manager", "admin")).thenReturn(17);
        var positions = List.of("팀장");
        var statuses = List.of("active", "leave");
        var date = LocalDate.of(2026, 9, 13);
        controller.employees(auth, 1, 100, false, null, null, null, null, null, positions, statuses, date);
        verify(authorization).requireEmployeeMenuAction(17, "query");
        verify(service).listEmployees(1, 100, false, null, null, null, null, null, positions, statuses, date);
    }
}
