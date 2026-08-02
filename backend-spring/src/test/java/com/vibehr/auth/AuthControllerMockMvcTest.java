package com.vibehr.auth;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vibehr.auth.AuthService.CorporationResponse;
import com.vibehr.platform.error.ApiExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuthControllerMockMvcTest {

    private final AuthService service = mock(AuthService.class);
    private final LoginRateLimiter rateLimiter = mock(LoginRateLimiter.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(service, rateLimiter))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void exposesTheLegacyCorporationRoute() throws Exception {
        when(service.corporations()).thenReturn(List.of(new CorporationResponse("VIBE", "VIBE", "Vibe HR", null)));

        mockMvc.perform(get("/api/v1/auth/enter-cds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corporations[0].enterCd").value("VIBE"))
                .andExpect(jsonPath("$.totalCount").value(1));
    }
}
