package com.shareloop.security.google;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.shareloop.exception.GoogleAuthConfigurationException;
import com.shareloop.exception.InvalidGoogleIdTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Service for verifying Google OAuth 2.0 / OpenID Connect ID Tokens using Google's public keys.
 *
 * Guarantees:
 * - Signature verified against cached Google public JWKS keys.
 * - Audience verified strictly against the configured non-blank Google Client ID.
 * - Issuer verified strictly against trusted Google identity providers (accounts.google.com).
 * - Expiration verified using token expiration timestamp.
 * - Subject (sub) claim required and validated.
 * - Email claim required and email_verified claim must be true.
 * - Never trusts client-supplied user parameters.
 * - Raw token values and sensitive credentials are never logged.
 */
@Service
public class GoogleIdTokenVerifierService {

    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifierService.class);

    private static final List<String> ACCEPTED_ISSUERS = Arrays.asList(
            "https://accounts.google.com",
            "accounts.google.com"
    );

    private final GoogleSecurityProperties properties;
    private final GoogleIdTokenVerifier verifier;

    @Autowired
    public GoogleIdTokenVerifierService(GoogleSecurityProperties properties) {
        this.properties = properties;
        this.verifier = createDefaultVerifier(properties);
    }

    // Package-private constructor for deterministic unit testing
    GoogleIdTokenVerifierService(GoogleSecurityProperties properties, GoogleIdTokenVerifier verifier) {
        this.properties = properties;
        this.verifier = verifier;
    }

    private static GoogleIdTokenVerifier createDefaultVerifier(GoogleSecurityProperties properties) {
        if (properties == null || !properties.isEnabled() || properties.getClientId() == null || properties.getClientId().isBlank()) {
            return null;
        }
        return new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(Collections.singletonList(properties.getClientId().trim()))
                .setIssuers(ACCEPTED_ISSUERS)
                .build();
    }

    /**
     * Verifies the authenticity, signature, issuer, audience, expiration, and payload of a raw Google ID Token.
     *
     * @param rawIdToken The raw ID Token string received from the frontend Google Identity Services SDK
     * @return Immutable GoogleUserClaims containing verified subject, normalized email, and profile details
     * @throws GoogleAuthConfigurationException if Google authentication is disabled or missing Client ID
     * @throws InvalidGoogleIdTokenException if token is missing, malformed, expired, invalidly signed, or unverified
     */
    public GoogleUserClaims verify(String rawIdToken) {
        // 1. Verify that Google authentication is enabled and properly configured
        if (properties == null || !properties.isEnabled() || properties.getClientId() == null || properties.getClientId().isBlank()) {
            log.warn("Google token verification rejected: Google authentication is not configured or is disabled");
            throw new GoogleAuthConfigurationException("Google Sign-In is not configured or is disabled on this server");
        }

        // 2. Reject null, empty, or whitespace-only token
        if (rawIdToken == null || rawIdToken.isBlank()) {
            throw new InvalidGoogleIdTokenException("Google ID Token must not be null or empty");
        }

        // 3. Resolve active verifier instance
        GoogleIdTokenVerifier activeVerifier = this.verifier != null ? this.verifier : createDefaultVerifier(properties);
        if (activeVerifier == null) {
            throw new GoogleAuthConfigurationException("Google ID Token verifier could not be initialized");
        }

        // 4. Verify cryptographic signature, expiration, issuer, and audience
        GoogleIdToken idToken;
        try {
            idToken = activeVerifier.verify(rawIdToken.trim());
        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to verify Google ID Token signature due to key retrieval or crypto error: {}", e.getMessage());
            throw new InvalidGoogleIdTokenException("Failed to verify Google ID Token signature", e);
        } catch (IllegalArgumentException e) {
            log.warn("Malformed Google ID Token format: {}", e.getMessage());
            throw new InvalidGoogleIdTokenException("Malformed Google ID Token format", e);
        }

        if (idToken == null) {
            log.warn("Google ID Token verification failed: token is invalid, expired, or audience/issuer mismatch");
            throw new InvalidGoogleIdTokenException("Invalid or expired Google ID Token");
        }

        // 5. Extract and validate claims
        GoogleIdToken.Payload payload = idToken.getPayload();
        if (payload == null) {
            throw new InvalidGoogleIdTokenException("Google ID Token payload is empty");
        }

        // 5a. Subject claim (sub)
        String subject = payload.getSubject();
        if (subject == null || subject.isBlank()) {
            log.warn("Google ID Token rejected: missing subject (sub) claim");
            throw new InvalidGoogleIdTokenException("Google ID Token missing subject claim");
        }

        // 5b. Email claim
        String email = payload.getEmail();
        if (email == null || email.isBlank()) {
            log.warn("Google ID Token rejected: missing email claim");
            throw new InvalidGoogleIdTokenException("Google ID Token missing email claim");
        }

        // 5c. Email verified claim (MUST be explicitly true)
        Boolean emailVerified = payload.getEmailVerified();
        if (!Boolean.TRUE.equals(emailVerified)) {
            log.warn("Google ID Token rejected: email is not verified by Google");
            throw new InvalidGoogleIdTokenException("Google account email is not verified");
        }

        // 5d. Profile metadata (name, picture)
        String displayName = (String) payload.get("name");
        String pictureUrl = (String) payload.get("picture");
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        return new GoogleUserClaims(
                subject.trim(),
                normalizedEmail,
                true,
                displayName != null && !displayName.isBlank() ? displayName.trim() : null,
                pictureUrl != null && !pictureUrl.isBlank() ? pictureUrl.trim() : null
        );
    }

    public boolean isEnabled() {
        return properties != null && properties.isEnabled() && properties.getClientId() != null && !properties.getClientId().isBlank();
    }
}
