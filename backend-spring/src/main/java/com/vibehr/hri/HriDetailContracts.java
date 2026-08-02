package com.vibehr.hri;

import com.vibehr.platform.error.ApiException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

final class HriDetailContracts {
    private static final Pattern TIME = Pattern.compile("^(?:[01]\\d|2[0-3]):[0-5]\\d$");

    private HriDetailContracts() { }

    static ValidatedDetail validate(String formCode, Map<String, Object> input, Map<String, String> policies,
            LocalDate businessDate, boolean submitting) {
        Map<String, Object> values = new LinkedHashMap<>(input == null ? Map.of() : input);
        List<Map<String, Object>> errors = new ArrayList<>();
        boolean materializable = switch (formCode) {
            case "TIM_CORRECTION" -> timCorrection(values, errors, submitting);
            case "CERT_EMPLOYMENT" -> employmentCertificate(values, errors, submitting);
            case "LEAVE_REQUEST" -> leave(values, errors, policies, businessDate, submitting);
            case "WEL_BENEFIT_REQUEST" -> welfare(values, errors, policies, submitting);
            default -> generic(values, errors, policies, submitting);
        };
        if (!errors.isEmpty()) throw ApiException.unprocessable(errors);
        return new ValidatedDetail(values, materializable);
    }

    private static boolean timCorrection(Map<String, Object> values, List<Map<String, Object>> errors, boolean required) {
        LocalDate workDate = date(values, "work_date", errors, required);
        String before = text(values, "before_status", 30, errors, required);
        String after = text(values, "after_status", 30, errors, required);
        text(values, "reason", 1000, errors, false);
        return workDate != null && before != null && after != null;
    }

    private static boolean employmentCertificate(Map<String, Object> values, List<Map<String, Object>> errors, boolean required) {
        String purpose = text(values, "purpose", 200, errors, required);
        Integer copies = integer(values, "copies", errors, required, 1);
        text(values, "recipient", 200, errors, false);
        text(values, "reason", 1000, errors, false);
        return purpose != null && copies != null;
    }

    private static boolean leave(Map<String, Object> values, List<Map<String, Object>> errors,
            Map<String, String> policies, LocalDate businessDate, boolean required) {
        String type = text(values, "leave_type_code", 30, errors, required);
        LocalDate start = date(values, "start_date", errors, required);
        LocalDate end = date(values, "end_date", errors, required);
        time(values, "start_time", errors);
        time(values, "end_time", errors);
        Integer minutes = integer(values, "applied_minutes", errors, required, 1);
        String reason = text(values, "reason", 1000, errors, required && policyBoolean(policies, "require_reason", false));
        if (start != null && end != null && end.isBefore(start)) {
            error(errors, "end_date", "value_error", "end_date must be on or after start_date", values.get("end_date"));
        }
        if (required && start != null && !policyBoolean(policies, "allow_past_date", true) && start.isBefore(businessDate)) {
            error(errors, "start_date", "value_error", "Past dates are not allowed for this form type.", values.get("start_date"));
        }
        Integer maximumSpan = policyInteger(policies, "max_span_days");
        if (required && maximumSpan != null && start != null && end != null
                && ChronoUnit.DAYS.between(start, end) + 1 > maximumSpan) {
            error(errors, "end_date", "value_error", "Date span exceeds max_span_days policy.", values.get("end_date"));
        }
        return type != null && start != null && end != null && minutes != null
                && (!policyBoolean(policies, "require_reason", false) || reason != null);
    }

    private static boolean welfare(Map<String, Object> values, List<Map<String, Object>> errors,
            Map<String, String> policies, boolean required) {
        boolean benefitRequired = policyBoolean(policies, "benefit_type_required", true);
        String benefitCode = text(values, "benefit_type_code", 40, errors, required && benefitRequired);
        text(values, "benefit_type_name", 100, errors, false);
        Integer amount = integer(values, "requested_amount", errors, required, 1);
        text(values, "description", 500, errors, false);
        String reason = text(values, "reason", 1000, errors, required && policyBoolean(policies, "require_reason", false));
        return (!benefitRequired || benefitCode != null) && amount != null
                && (!policyBoolean(policies, "require_reason", false) || reason != null);
    }

    private static boolean generic(Map<String, Object> values, List<Map<String, Object>> errors,
            Map<String, String> policies, boolean required) {
        String reason = text(values, "reason", 1000, errors, required && policyBoolean(policies, "require_reason", false));
        return !policyBoolean(policies, "require_reason", false) || reason != null;
    }

    private static String text(Map<String, Object> values, String field, int maximum,
            List<Map<String, Object>> errors, boolean required) {
        Object raw = values.get(field);
        if (raw == null || raw instanceof String string && string.isBlank()) {
            if (required) error(errors, field, "missing", "Field required", raw);
            if (raw instanceof String) values.put(field, "");
            return null;
        }
        if (!(raw instanceof String string)) {
            error(errors, field, "string_type", "Input should be a valid string", raw);
            return null;
        }
        if (string.length() > maximum) {
            error(errors, field, "string_too_long", "String should have at most " + maximum + " characters", raw);
            return null;
        }
        values.put(field, string);
        return string;
    }

    private static LocalDate date(Map<String, Object> values, String field, List<Map<String, Object>> errors, boolean required) {
        Object raw = values.get(field);
        if (raw == null || raw instanceof String string && string.isBlank()) {
            if (required) error(errors, field, "missing", "Field required", raw);
            return null;
        }
        try {
            LocalDate parsed = raw instanceof LocalDate date ? date : LocalDate.parse(String.valueOf(raw));
            values.put(field, parsed.toString());
            return parsed;
        } catch (RuntimeException exception) {
            error(errors, field, "date_from_datetime_parsing", "Input should be a valid date in YYYY-MM-DD format", raw);
            return null;
        }
    }

    private static void time(Map<String, Object> values, String field, List<Map<String, Object>> errors) {
        Object raw = values.get(field);
        if (raw == null || raw instanceof String string && string.isBlank()) {
            if (raw instanceof String) values.put(field, "");
            return;
        }
        if (!(raw instanceof String string) || !TIME.matcher(string).matches()) {
            error(errors, field, "string_pattern_mismatch", "Input should match HH:mm", raw);
        }
    }

    private static Integer integer(Map<String, Object> values, String field, List<Map<String, Object>> errors,
            boolean required, int minimum) {
        Object raw = values.get(field);
        if (raw == null || raw instanceof String string && string.isBlank()) {
            if (required) error(errors, field, "missing", "Field required", raw);
            return null;
        }
        Integer parsed = null;
        if (raw instanceof Byte || raw instanceof Short || raw instanceof Integer || raw instanceof Long) {
            long number = ((Number) raw).longValue();
            if (number >= Integer.MIN_VALUE && number <= Integer.MAX_VALUE) parsed = (int) number;
        } else if (raw instanceof String string && string.matches("^-?\\d+$")) {
            try { parsed = Integer.valueOf(string); } catch (NumberFormatException ignored) { }
        }
        if (parsed == null) {
            error(errors, field, "int_parsing", "Input should be a valid integer", raw);
            return null;
        }
        if (parsed < minimum) {
            error(errors, field, "greater_than_equal", "Input should be greater than or equal to " + minimum, raw);
            return null;
        }
        values.put(field, parsed);
        return parsed;
    }

    private static boolean policyBoolean(Map<String, String> policies, String key, boolean fallback) {
        String value = policies.get(key);
        if (value == null) return fallback;
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;
        throw ApiException.badRequest("Invalid boolean policy '" + key + "'.");
    }

    private static Integer policyInteger(Map<String, String> policies, String key) {
        String value = policies.get(key);
        if (value == null || value.isBlank()) return null;
        try {
            int parsed = Integer.parseInt(value);
            if (parsed <= 0) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException exception) {
            throw ApiException.badRequest("Invalid positive integer policy '" + key + "'.");
        }
    }

    private static void error(List<Map<String, Object>> errors, String field, String type, String message, Object input) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("type", type);
        error.put("loc", List.of("body", "content_json", field));
        error.put("msg", message);
        error.put("input", input);
        errors.add(error);
    }

    record ValidatedDetail(Map<String, Object> content, boolean materializable) { }
}
