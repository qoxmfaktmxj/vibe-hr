package com.vibehr.auth;

import java.time.Instant;

public record JwtClaims(String subject, String issuer, Instant issuedAt, Instant expiresAt) {
}
