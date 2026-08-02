package com.vibehr.platform.ids;

import com.vibehr.platform.error.ApiException;

/** Converts externally represented numeric IDs before they reach INTEGER-backed persistence. */
public final class IntegerId {
    private IntegerId() {
    }

    public static int required(long value, String fieldName) {
        try {
            return Math.toIntExact(value);
        } catch (ArithmeticException exception) {
            throw ApiException.badRequest(fieldName + " is outside the supported INTEGER range.");
        }
    }

    public static Integer optional(Long value, String fieldName) {
        return value == null ? null : required(value, fieldName);
    }
}
