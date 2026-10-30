package com.shareloop.security.google;

/**
 * Immutable representation of verified Google user claims extracted from an authenticated ID Token.
 */
public record GoogleUserClaims(
        String subject,
        String email,
        boolean emailVerified,
        String displayName,
        String pictureUrl
) {
    public GoogleUserClaims {
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("Subject (sub) claim must not be null or blank");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email claim must not be null or blank");
        }
    }
}
