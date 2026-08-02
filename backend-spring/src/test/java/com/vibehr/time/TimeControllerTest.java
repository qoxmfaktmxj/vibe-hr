package com.vibehr.time;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.menu.MenuPermissionService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

class TimeControllerTest {
    @Test
    void checkInUsesTheAuthenticatedEmployeesOwnRecordWhenNoTargetIsProvided() {
        TimeApplicationService service = mock(TimeApplicationService.class);
        TimeAuthorization authorization = mock(TimeAuthorization.class);
        MenuPermissionService menuPermissions = mock(MenuPermissionService.class);
        Authentication authentication = mock(Authentication.class);
        TimAttendanceDailyItem expected = new TimAttendanceDailyItem(1, 22, "E-22", "Kim", 3, "People", null,
                null, null, null, "present", 0, 0, 0, 0, 0, 0, 0, false);
        when(authorization.userId(authentication)).thenReturn(7);
        when(authorization.employeeIdForUser(7)).thenReturn(22);
        when(service.checkIn(22)).thenReturn(expected);
        TimeController controller = new TimeController(service, authorization, menuPermissions);

        TimAttendanceDailyItem actual = controller.checkIn(authentication, new TimCheckInOutRequest(null));

        assertThat(actual).isSameAs(expected);
        verify(authorization).requireSelfOrManager(authentication, null);
        verify(service).checkIn(22);
    }

    @Test
    void attendanceCodeReadRequiresTheLegacyCodesQueryAction() {
        TimeApplicationService service = mock(TimeApplicationService.class);
        TimeAuthorization authorization = mock(TimeAuthorization.class);
        MenuPermissionService menuPermissions = mock(MenuPermissionService.class);
        Authentication authentication = mock(Authentication.class);
        TimAttendanceCodeListResponse expected = new TimAttendanceCodeListResponse(java.util.List.of(), 0);
        when(authorization.requireAnyRole(authentication, "hr_manager", "admin")).thenReturn(7);
        when(service.attendanceCodes()).thenReturn(expected);
        TimeController controller = new TimeController(service, authorization, menuPermissions);

        assertThat(controller.attendanceCodes(authentication)).isSameAs(expected);

        verify(menuPermissions).requireMenuAction(7, "/tim/codes", "query");
    }
}
