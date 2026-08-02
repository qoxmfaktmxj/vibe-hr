package com.vibehr.platform.error;

import jakarta.validation.ConstraintViolationException;
import jakarta.validation.constraints.Min;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.util.ContentCachingRequestWrapper;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApiException(ApiException exception) {
        return ResponseEntity.status(exception.status()).body(new ApiError(exception.detail()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException invalidArguments) {
        List<ValidationError> detail = invalidArguments.getBindingResult().getFieldErrors().stream()
                .map(this::fieldError)
                .toList();
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(detail));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiError> handleMethodValidation(HandlerMethodValidationException exception, HttpServletRequest request) {
        List<ValidationError> detail = exception.getParameterValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream().map(error -> parameterError(result, error, request)))
                .toList();
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(detail));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ApiError> handleMissingParameter(MissingServletRequestParameterException exception) {
        ValidationError detail = new ValidationError(
                "missing",
                List.of("query", exception.getParameterName()),
                "Field required",
                null
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(List.of(detail)));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException exception, HttpServletRequest request) {
        String parameterName = exception.getName();
        String type = integerType(exception) ? "int_parsing" : "value_error";
        String message = integerType(exception)
                ? "Input should be a valid integer, unable to parse string as an integer"
                : "Input should be a valid value";
        ValidationError detail = new ValidationError(type, List.of("query", parameterName), message, request.getParameter(parameterName));
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(List.of(detail)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleMalformedJson(HttpMessageNotReadableException exception, HttpServletRequest request) {
        long position = exception.getMostSpecificCause() instanceof tools.jackson.core.JacksonException jacksonException
                && jacksonException.getLocation() != null
                ? jacksonException.getLocation().getCharOffset()
                : 0;
        if (position < 0 && request.getAttribute(RequestBodyCachingFilter.CACHED_REQUEST_ATTRIBUTE) instanceof ContentCachingRequestWrapper cachedRequest) {
            position = new String(cachedRequest.getContentAsByteArray(), StandardCharsets.UTF_8).length();
        }
        ValidationError detail = new ValidationError("json_invalid", List.of("body", position), "JSON decode error", Map.of());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(List.of(detail)));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiError(List.of(
                new ValidationError("validation_error", List.of("request"), exception.getMessage(), null)
        )));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleConflict(DataIntegrityViolationException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError("Data integrity conflict."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> handleAccessDenied() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError("Access denied."));
    }

    private ValidationError fieldError(FieldError error) {
        String type = error.getCode() == null ? "validation_error" : error.getCode().toLowerCase(Locale.ROOT);
        return new ValidationError(type, List.of("body", snakeCase(error.getField())), error.getDefaultMessage(), error.getRejectedValue());
    }

    private ValidationError parameterError(ParameterValidationResult result, MessageSourceResolvable error, HttpServletRequest request) {
        MethodParameter parameter = result.getMethodParameter();
        Min minimum = parameter.getParameterAnnotation(Min.class);
        if (minimum != null) {
            return new ValidationError(
                    "greater_than_equal",
                    List.of(parameterLocation(parameter), parameterName(parameter)),
                    "Input should be greater than or equal to " + minimum.value(),
                    parameterInput(parameter, result, request)
            );
        }
        String type = error.getCodes() == null || error.getCodes().length == 0
                ? "validation_error"
                : error.getCodes()[0].toLowerCase(Locale.ROOT);
        return new ValidationError(
                type,
                List.of(parameterLocation(parameter), parameterName(parameter)),
                error.getDefaultMessage(),
                parameterInput(parameter, result, request)
        );
    }

    private Object parameterInput(MethodParameter parameter, ParameterValidationResult result, HttpServletRequest request) {
        String name = parameterName(parameter);
        return switch (parameterLocation(parameter)) {
            case "query" -> request.getParameter(name);
            case "header" -> request.getHeader(name);
            default -> result.getArgument();
        };
    }

    private boolean integerType(MethodArgumentTypeMismatchException exception) {
        Class<?> requiredType = exception.getRequiredType();
        return requiredType == int.class || requiredType == Integer.class || requiredType == long.class || requiredType == Long.class;
    }

    private String parameterLocation(MethodParameter parameter) {
        if (parameter.hasParameterAnnotation(RequestParam.class)) {
            return "query";
        }
        if (parameter.hasParameterAnnotation(PathVariable.class)) {
            return "path";
        }
        if (parameter.hasParameterAnnotation(RequestHeader.class)) {
            return "header";
        }
        return "request";
    }

    private String parameterName(MethodParameter parameter) {
        RequestParam requestParam = parameter.getParameterAnnotation(RequestParam.class);
        if (requestParam != null && !requestParam.name().isBlank()) {
            return requestParam.name();
        }
        PathVariable pathVariable = parameter.getParameterAnnotation(PathVariable.class);
        if (pathVariable != null && !pathVariable.name().isBlank()) {
            return pathVariable.name();
        }
        RequestHeader requestHeader = parameter.getParameterAnnotation(RequestHeader.class);
        if (requestHeader != null && !requestHeader.name().isBlank()) {
            return requestHeader.name();
        }
        return parameter.getParameterName() == null ? "value" : parameter.getParameterName();
    }

    private static String snakeCase(String value) {
        StringBuilder result = new StringBuilder(value.length() + 4);
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isUpperCase(character)) {
                result.append('_');
            }
            result.append(Character.toLowerCase(character));
        }
        return result.toString();
    }

    public record ValidationError(String type, List<?> loc, String msg, Object input) {
    }
}
