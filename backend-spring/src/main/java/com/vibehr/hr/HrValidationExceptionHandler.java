package com.vibehr.hr;

import com.vibehr.platform.error.ApiError;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = HrController.class)
class HrValidationExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        Object target = exception.getBindingResult().getTarget();
        List<FastApiValidationError> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error(target, error))
                .toList();
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(errors));
    }

    private FastApiValidationError error(Object root, FieldError error) {
        Property property = property(root, error.getField());
        String code = error.getCode() == null ? "" : error.getCode();
        Object input = error.getRejectedValue();
        String type;
        String message;

        if ("NotNull".equals(code)) {
            boolean missing = property.owner instanceof HrRequests.Tracked tracked && !tracked.has(property.jsonName);
            type = missing ? "missing" : inputType(property.field == null ? null : property.field.getType());
            message = missing ? "Field required" : inputMessage(property.field == null ? null : property.field.getType());
        } else if ("Size".equals(code)) {
            int min = annotationValue(property.field, jakarta.validation.constraints.Size.class, true);
            int max = annotationValue(property.field, jakarta.validation.constraints.Size.class, false);
            int size = input instanceof CharSequence text ? text.length() : input instanceof List<?> list ? list.size() : 0;
            boolean tooShort = size < min;
            boolean list = input instanceof List<?>;
            type = list ? (tooShort ? "too_short" : "too_long") : (tooShort ? "string_too_short" : "string_too_long");
            if (list) {
                message = tooShort
                        ? "List should have at least " + min + " item after validation, not " + size
                        : "List should have at most " + max + " items after validation, not " + size;
            } else {
                message = tooShort
                        ? "String should have at least " + min + " character" + (min == 1 ? "" : "s")
                        : "String should have at most " + max + " characters";
            }
        } else if ("Pattern".equals(code)) {
            String regexp = property.field == null || property.field.getAnnotation(jakarta.validation.constraints.Pattern.class) == null
                    ? "" : property.field.getAnnotation(jakarta.validation.constraints.Pattern.class).regexp();
            if ("mode".equals(property.jsonName)) {
                type = "literal_error";
                message = "Input should be 'atomic'";
            } else {
                type = "string_pattern_mismatch";
                message = "String should match pattern '" + regexp + "'";
            }
        } else if ("Positive".equals(code)) {
            type = "greater_than";
            message = "Input should be greater than 0";
        } else if ("Min".equals(code)) {
            long minimum = property.field.getAnnotation(jakarta.validation.constraints.Min.class).value();
            type = "greater_than_equal";
            message = "Input should be greater than or equal to " + minimum;
        } else if ("Max".equals(code)) {
            long maximum = property.field.getAnnotation(jakarta.validation.constraints.Max.class).value();
            type = "less_than_equal";
            message = "Input should be less than or equal to " + maximum;
        } else {
            type = "value_error";
            message = error.getDefaultMessage();
        }
        return new FastApiValidationError(type, location(error.getField()), message, input);
    }

    private Property property(Object root, String path) {
        Object owner = root;
        String[] parts = path.split("\\.");
        for (int index = 0; index < parts.length - 1; index++) {
            owner = value(owner, parts[index]);
        }
        String leaf = stripIndex(parts[parts.length - 1]);
        return new Property(owner, field(owner == null ? null : owner.getClass(), leaf), snakeCase(leaf));
    }

    private Object value(Object owner, String part) {
        if (owner == null) return null;
        String fieldName = stripIndex(part);
        Field field = field(owner.getClass(), fieldName);
        if (field == null) return null;
        try {
            field.setAccessible(true);
            Object value = field.get(owner);
            int bracket = part.indexOf('[');
            if (bracket >= 0 && value instanceof List<?> list) {
                int itemIndex = Integer.parseInt(part.substring(bracket + 1, part.indexOf(']', bracket)));
                return itemIndex < list.size() ? list.get(itemIndex) : null;
            }
            return value;
        } catch (ReflectiveOperationException ignored) {
            return null;
        }
    }

    private Field field(Class<?> type, String name) {
        for (Class<?> current = type; current != null; current = current.getSuperclass()) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                // Continue through request inheritance.
            }
        }
        return null;
    }

    private List<Object> location(String path) {
        List<Object> location = new ArrayList<>();
        location.add("body");
        for (String part : path.split("\\.")) {
            int bracket = part.indexOf('[');
            String name = bracket < 0 ? part : part.substring(0, bracket);
            location.add(snakeCase(name));
            while (bracket >= 0) {
                int end = part.indexOf(']', bracket);
                location.add(Integer.parseInt(part.substring(bracket + 1, end)));
                bracket = part.indexOf('[', end);
            }
        }
        return location;
    }

    private static String stripIndex(String value) {
        int bracket = value.indexOf('[');
        return bracket < 0 ? value : value.substring(0, bracket);
    }

    private static String inputType(Class<?> type) {
        if (type == String.class) return "string_type";
        if (type == Integer.class || type == int.class) return "int_type";
        if (type == Double.class || type == double.class) return "float_type";
        if (type == Boolean.class || type == boolean.class) return "bool_type";
        if (type == LocalDate.class) return "date_type";
        if (type != null && List.class.isAssignableFrom(type)) return "list_type";
        return "value_error";
    }

    private static String inputMessage(Class<?> type) {
        return switch (inputType(type)) {
            case "string_type" -> "Input should be a valid string";
            case "int_type" -> "Input should be a valid integer";
            case "float_type" -> "Input should be a valid number";
            case "bool_type" -> "Input should be a valid boolean";
            case "date_type" -> "Input should be a valid date";
            case "list_type" -> "Input should be a valid list";
            default -> "Input should be a valid value";
        };
    }

    private static int annotationValue(Field field, Class<jakarta.validation.constraints.Size> type, boolean minimum) {
        jakarta.validation.constraints.Size size = field == null ? null : field.getAnnotation(type);
        return size == null ? 0 : minimum ? size.min() : size.max();
    }

    private static String snakeCase(String value) {
        return value.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase(java.util.Locale.ROOT);
    }

    private record Property(Object owner, Field field, String jsonName) { }
    record FastApiValidationError(String type, List<Object> loc, String msg, Object input) { }
}
