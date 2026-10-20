package com.shareloop.security;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {

    private String secret;
    private long expirationMs = 86400000L; // Default 24 hours

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public void setExpirationMs(long expirationMs) {
        this.expirationMs = expirationMs;
    }

    @PostConstruct
    public void validate() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT secret must be configured via jwt.secret or JWT_SECRET environment variable");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT secret must be at least 256 bits (32 bytes) for HMAC-SHA256 signature verification");
        }
        if (expirationMs <= 0) {
            throw new IllegalStateException("JWT expiration-ms must be greater than 0");
        }
    }
}
