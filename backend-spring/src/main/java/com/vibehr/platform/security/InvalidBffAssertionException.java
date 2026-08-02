package com.vibehr.platform.security;

final class InvalidBffAssertionException extends RuntimeException {

    InvalidBffAssertionException(String message) {
        super(message);
    }

    InvalidBffAssertionException(String message, Throwable cause) {
        super(message, cause);
    }
}
