package com.vibehr.platform.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @ParameterizedTest
    @MethodSource("fastApiStatuses")
    void returnsFastApiDetailForSupportedStatus(ApiException exception, HttpStatus expectedStatus) {
        ResponseEntity<ApiError> response = handler.handleApiException(exception);

        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isEqualTo(new ApiError("migration error"));
    }

    private static Stream<Arguments> fastApiStatuses() {
        return Stream.of(
                Arguments.of(ApiException.badRequest("migration error"), HttpStatus.BAD_REQUEST),
                Arguments.of(ApiException.unauthorized("migration error"), HttpStatus.UNAUTHORIZED),
                Arguments.of(ApiException.forbidden("migration error"), HttpStatus.FORBIDDEN),
                Arguments.of(ApiException.notFound("migration error"), HttpStatus.NOT_FOUND),
                Arguments.of(ApiException.conflict("migration error"), HttpStatus.CONFLICT),
                Arguments.of(ApiException.unprocessable("migration error"), HttpStatus.UNPROCESSABLE_CONTENT),
                Arguments.of(ApiException.locked("migration error"), HttpStatus.LOCKED)
        );
    }
}
