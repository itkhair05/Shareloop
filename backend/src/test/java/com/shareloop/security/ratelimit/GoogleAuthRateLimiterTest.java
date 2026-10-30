package com.shareloop.security.ratelimit;

import com.shareloop.exception.RateLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleAuthRateLimiterTest {

    private RateLimitProperties properties;
    private MutableClock clock;
    private GoogleAuthRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        properties = new RateLimitProperties();
        properties.setLoginLimit(5);
        properties.setLoginWindowSeconds(60);
        clock = new MutableClock(Instant.parse("2026-10-30T10:00:00Z"));
        rateLimiter = new GoogleAuthRateLimiter(properties, clock);
    }

    @Test
    @DisplayName("Login rate limit allows requests up to limit and rejects subsequent requests")
    void loginRateLimit_AllowsUpToLimit_RejectsSubsequent() {
        String ip = "192.168.1.100";

        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> rateLimiter.checkLoginRateLimit(ip)).doesNotThrowAnyException();
        }

        assertThatThrownBy(() -> rateLimiter.checkLoginRateLimit(ip))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(GoogleAuthRateLimiter.LOGIN_RATE_LIMIT_MESSAGE);
    }

    @Test
    @DisplayName("Login rate limit resets after rolling window expires")
    void loginRateLimit_ResetsAfterWindow() {
        String ip = "192.168.1.101";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkLoginRateLimit(ip);
        }

        // Advance clock past 60s window
        clock.advanceSeconds(61);

        assertThatCode(() -> rateLimiter.checkLoginRateLimit(ip)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Different IPs are tracked independently for Google login")
    void loginRateLimit_DifferentIpsTrackedIndependently() {
        String ip1 = "10.0.0.1";
        String ip2 = "10.0.0.2";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkLoginRateLimit(ip1);
        }

        assertThatThrownBy(() -> rateLimiter.checkLoginRateLimit(ip1))
                .isInstanceOf(RateLimitExceededException.class);

        // IP2 is untouched
        assertThatCode(() -> rateLimiter.checkLoginRateLimit(ip2)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Account link rate limit allows requests up to limit and rejects subsequent requests")
    void linkRateLimit_AllowsUpToLimit_RejectsSubsequent() {
        UUID userId = UUID.randomUUID();

        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> rateLimiter.checkLinkRateLimit(userId)).doesNotThrowAnyException();
        }

        assertThatThrownBy(() -> rateLimiter.checkLinkRateLimit(userId))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(GoogleAuthRateLimiter.LINK_RATE_LIMIT_MESSAGE);
    }

    @Test
    @DisplayName("Different users are tracked independently for account linking")
    void linkRateLimit_DifferentUsersTrackedIndependently() {
        UUID user1 = UUID.randomUUID();
        UUID user2 = UUID.randomUUID();

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkLinkRateLimit(user1);
        }

        assertThatThrownBy(() -> rateLimiter.checkLinkRateLimit(user1))
                .isInstanceOf(RateLimitExceededException.class);

        assertThatCode(() -> rateLimiter.checkLinkRateLimit(user2)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("reset() clears all tracked attempts")
    void reset_ClearsAttempts() {
        String ip = "10.0.0.3";
        for (int i = 0; i < 5; i++) {
            rateLimiter.checkLoginRateLimit(ip);
        }

        rateLimiter.reset();

        assertThatCode(() -> rateLimiter.checkLoginRateLimit(ip)).doesNotThrowAnyException();
    }

    private static class MutableClock extends Clock {
        private Instant currentInstant;
        private final ZoneId zoneId = ZoneId.of("UTC");

        public MutableClock(Instant initialInstant) {
            this.currentInstant = initialInstant;
        }

        public void advanceSeconds(long seconds) {
            this.currentInstant = currentInstant.plusSeconds(seconds);
        }

        @Override
        public ZoneId getZone() {
            return zoneId;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return currentInstant;
        }
    }
}
