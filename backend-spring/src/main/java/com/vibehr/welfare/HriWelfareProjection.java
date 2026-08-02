package com.vibehr.welfare;

import java.time.Instant;

/** Immutable HRI input keeps this module independent from HRI's JPA entities. */
public record HriWelfareProjection(String requestNo, String statusCode, String benefitTypeCode, String benefitTypeName,
        int requestedAmount, String description, Instant submittedAt, Instant completedAt, Instant createdAt,
        Instant updatedAt, Integer employeeId, String employeeNo, String employeeName, String departmentName) { }
