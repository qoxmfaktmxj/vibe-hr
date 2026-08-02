package com.vibehr.platform.error;

import org.springframework.http.HttpStatus;

public final class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final Object detail;

    private ApiException(HttpStatus status, Object detail) {
        super(detail instanceof String message ? message : status.getReasonPhrase());
        this.status = status;
        this.detail = detail;
    }

    public static ApiException badRequest(Object detail) {
        return new ApiException(HttpStatus.BAD_REQUEST, detail);
    }

    public static ApiException unauthorized(Object detail) {
        return new ApiException(HttpStatus.UNAUTHORIZED, detail);
    }

    public static ApiException forbidden(Object detail) {
        return new ApiException(HttpStatus.FORBIDDEN, detail);
    }

    public static ApiException notFound(Object detail) {
        return new ApiException(HttpStatus.NOT_FOUND, detail);
    }

    public static ApiException conflict(Object detail) {
        return new ApiException(HttpStatus.CONFLICT, detail);
    }

    public static ApiException unprocessable(Object detail) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, detail);
    }

    public static ApiException locked(Object detail) {
        return new ApiException(HttpStatus.LOCKED, detail);
    }

    public HttpStatus status() {
        return status;
    }

    public Object detail() {
        return detail;
    }
}
