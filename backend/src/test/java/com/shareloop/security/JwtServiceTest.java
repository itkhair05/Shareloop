package com.shareloop.security;

import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String TEST_SECRET = "super-secret-key-that-is-at-least-32-bytes-long-for-testing!";
    private JwtProperties jwtProperties;
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtProperties = new JwtProperties();
        jwtProperties.setSecret(TEST_SECRET);
        jwtProperties.setExpirationMs(3600000L); // 1 hour
        jwtService = new JwtService(jwtProperties);
    }

    @Test
    @DisplayName("Generate token and extract claims successfully")
    void generateTokenAndExtractClaims() {
        UUID userId = UUID.randomUUID();
        String email = "linh.nguyen@example.com";
        UserRole role = UserRole.USER;
        UserStatus status = UserStatus.ACTIVE;

        String token = jwtService.generateToken(userId, email, role, status);

        assertThat(token).isNotBlank();
        assertThat(jwtService.isTokenValid(token)).isTrue();
        assertThat(jwtService.extractUserId(token)).isEqualTo(userId);
        assertThat(jwtService.extractEmail(token)).isEqualTo(email);
        assertThat(jwtService.extractRole(token)).isEqualTo(UserRole.USER.name());
    }

    @Test
    @DisplayName("Invalid signature rejects token")
    void invalidSignatureRejectsToken() {
        UUID userId = UUID.randomUUID();
        String token = jwtService.generateToken(userId, "test@example.com", UserRole.USER, UserStatus.ACTIVE);

        // Tamper with the token
        String tamperedToken = token + "tampered";
        assertThat(jwtService.isTokenValid(tamperedToken)).isFalse();
    }

    @Test
    @DisplayName("Token signed with different secret is rejected")
    void differentSecretRejectsToken() {
        UUID userId = UUID.randomUUID();
        String differentSecret = "another-secret-key-that-is-at-least-32-bytes-long!";
        String foreignToken = Jwts.builder()
                .subject(userId.toString())
                .claim("email", "foreign@example.com")
                .claim("role", "USER")
                .claim("status", "ACTIVE")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(Keys.hmacShaKeyFor(differentSecret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        assertThat(jwtService.isTokenValid(foreignToken)).isFalse();
    }

    @Test
    @DisplayName("Expired token is rejected")
    void expiredTokenRejection() {
        UUID userId = UUID.randomUUID();
        // Generate token that already expired 10 minutes ago
        String expiredToken = Jwts.builder()
                .subject(userId.toString())
                .claim("email", "expired@example.com")
                .claim("role", "USER")
                .claim("status", "ACTIVE")
                .issuedAt(new Date(System.currentTimeMillis() - 600000))
                .expiration(new Date(System.currentTimeMillis() - 300000))
                .signWith(Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        assertThat(jwtService.isTokenValid(expiredToken)).isFalse();
    }

    @Test
    @DisplayName("JwtProperties validation rejects short or null secrets")
    void jwtPropertiesValidation() {
        JwtProperties invalidProps = new JwtProperties();
        invalidProps.setSecret("short");
        assertThatThrownBy(invalidProps::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 256 bits (32 bytes)");

        invalidProps.setSecret(null);
        assertThatThrownBy(invalidProps::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be configured");
    }
}
