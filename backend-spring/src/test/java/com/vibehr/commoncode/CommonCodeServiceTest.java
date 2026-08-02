package com.vibehr.commoncode;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vibehr.platform.error.ApiException;
import java.time.Clock;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CommonCodeServiceTest {

    private final CodeGroupRepository groups = mock(CodeGroupRepository.class);
    private final CodeRepository codes = mock(CodeRepository.class);
    private final CommonCodeService service = new CommonCodeService(groups, codes, Clock.systemUTC());

    @Test
    void rejectsDuplicateGroupCodesAfterPythonCompatibleNormalization() {
        when(groups.findByCode("PAY")).thenReturn(Optional.of(mock(AppCodeGroup.class)));

        assertThatThrownBy(() -> service.createGroup(new CommonCodeService.CodeGroupRequest(" pay ", "Payroll", null, true, 0)))
                .isInstanceOf(ApiException.class)
                .hasMessage("group code already exists.");
    }
}
