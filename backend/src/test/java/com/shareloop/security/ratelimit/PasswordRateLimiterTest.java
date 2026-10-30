package com.shareloop.security.ratelimit;

import com.shareloop.exception.RateLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordRateLimiterTest {

    private RateLimitProperties properties;
    private MutableClock clock;
    private PasswordRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        properties = new RateLimitProperties();
        properties.setChangePasswordUserLimit(5);
        properties.setChangePasswordIpLimit(10);
        properties.setChangePasswordWindowSeconds(60);

        properties.setSetPasswordUserLimit(5);
        properties.setSetPasswordIpLimit(10);
        properties.setSetPasswordWindowSeconds(60);

        clock = new MutableClock(Instant.parse("2026-10-30T10:00:00Z"));
        rateLimiter = new PasswordRateLimiter(properties, clock);
    }

    @Test
    @DisplayName("Change-password allows requests up to user limit and rejects subsequent requests")
    void changePassword_AllowsUpToUserLimit_RejectsSubsequent() {
        UUID userId = UUID.randomUUID();
        String ip = "192.168.1.100";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkChangePasswordRateLimit(userId, ip + i);
        }

        assertThatThrownBy(() -> rateLimiter.checkChangePasswordRateLimit(userId, "192.168.1.200"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(PasswordRateLimiter.CHANGE_PASSWORD_RATE_LIMIT_MESSAGE);
    }

    @Test
    @DisplayName("Change-password allows requests up to IP limit and rejects subsequent requests")
    void changePassword_AllowsUpToIpLimit_RejectsSubsequent() {
        String ip = "192.168.1.105";

        for (int i = 0; i < 10; i++) {
            UUID distinctUser = UUID.randomUUID();
            assertThatCode(() -> rateLimiter.checkChangePasswordRateLimit(distinctUser, ip)).doesNotThrowAnyException();
        }

        UUID anotherUser = UUID.randomUUID();
        assertThatThrownBy(() -> rateLimiter.checkChangePasswordRateLimit(anotherUser, ip))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(PasswordRateLimiter.CHANGE_PASSWORD_RATE_LIMIT_MESSAGE);
    }

    @Test
    @DisplayName("Change-password user rate limit resets after rolling window expires")
    void changePassword_ResetsAfterWindow() {
        UUID userId = UUID.randomUUID();
        String ip = "192.168.1.101";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkChangePasswordRateLimit(userId, ip + i);
        }

        // Advance clock past 60s window
        clock.advanceSeconds(61);

        assertThatCode(() -> rateLimiter.checkChangePasswordRateLimit(userId, "192.168.1.200")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Different users are tracked independently for change-password")
    void changePassword_DifferentUsersTrackedIndependently() {
        UUID user1 = UUID.randomUUID();
        UUID user2 = UUID.randomUUID();

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkChangePasswordRateLimit(user1, "10.0.0." + i);
        }

        assertThatThrownBy(() -> rateLimiter.checkChangePasswordRateLimit(user1, "10.0.0.99"))
                .isInstanceOf(RateLimitExceededException.class);

        // user2 is untouched
        assertThatCode(() -> rateLimiter.checkChangePasswordRateLimit(user2, "10.0.0.99")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Different IPs are tracked independently for change-password")
    void changePassword_DifferentIpsTrackedIndependently() {
        String ip1 = "10.10.10.1";
        String ip2 = "10.10.10.2";

        for (int i = 0; i < 10; i++) {
            rateLimiter.checkChangePasswordRateLimit(UUID.randomUUID(), ip1);
        }

        assertThatThrownBy(() -> rateLimiter.checkChangePasswordRateLimit(UUID.randomUUID(), ip1))
                .isInstanceOf(RateLimitExceededException.class);

        // ip2 is untouched
        assertThatCode(() -> rateLimiter.checkChangePasswordRateLimit(UUID.randomUUID(), ip2)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Set-password allows requests up to user limit and rejects subsequent requests")
    void setPassword_AllowsUpToUserLimit_RejectsSubsequent() {
        UUID userId = UUID.randomUUID();
        String ip = "192.168.2.100";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkSetPasswordRateLimit(userId, ip + i);
        }

        assertThatThrownBy(() -> rateLimiter.checkSetPasswordRateLimit(userId, "192.168.2.200"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(PasswordRateLimiter.SET_PASSWORD_RATE_LIMIT_MESSAGE);
    }

    @Test
    @DisplayName("Set-password allows requests up to IP limit and rejects subsequent requests")
    void setPassword_AllowsUpToIpLimit_RejectsSubsequent() {
        String ip = "192.168.2.105";

        for (int i = 0; i < 10; i++) {
            UUID distinctUser = UUID.randomUUID();
            assertThatCode(() -> rateLimiter.checkSetPasswordRateLimit(distinctUser, ip)).doesNotThrowAnyException();
        }

        UUID anotherUser = UUID.randomUUID();
        assertThatThrownBy(() -> rateLimiter.checkSetPasswordRateLimit(anotherUser, ip))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(PasswordRateLimiter.SET_PASSWORD_RATE_LIMIT_MESSAGE);
    }

    @Test
    @DisplayName("Set-password user rate limit resets after rolling window expires")
    void setPassword_ResetsAfterWindow() {
        UUID userId = UUID.randomUUID();
        String ip = "192.168.2.101";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkSetPasswordRateLimit(userId, ip + i);
        }

        // Advance clock past 60s window
        clock.advanceSeconds(61);

        assertThatCode(() -> rateLimiter.checkSetPasswordRateLimit(userId, "192.168.2.200")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Different users are tracked independently for set-password")
    void setPassword_DifferentUsersTrackedIndependently() {
        UUID user1 = UUID.randomUUID();
        UUID user2 = UUID.randomUUID();

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkSetPasswordRateLimit(user1, "10.0.1." + i);
        }

        assertThatThrownBy(() -> rateLimiter.checkSetPasswordRateLimit(user1, "10.0.1.99"))
                .isInstanceOf(RateLimitExceededException.class);

        // user2 is untouched
        assertThatCode(() -> rateLimiter.checkSetPasswordRateLimit(user2, "10.0.1.99")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Different IPs are tracked independently for set-password")
    void setPassword_DifferentIpsTrackedIndependently() {
        String ip1 = "10.20.20.1";
        String ip2 = "10.20.20.2";

        for (int i = 0; i < 10; i++) {
            rateLimiter.checkSetPasswordRateLimit(UUID.randomUUID(), ip1);
        }

        assertThatThrownBy(() -> rateLimiter.checkSetPasswordRateLimit(UUID.randomUUID(), ip1))
                .isInstanceOf(RateLimitExceededException.class);

        // ip2 is untouched
        assertThatCode(() -> rateLimiter.checkSetPasswordRateLimit(UUID.randomUUID(), ip2)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("reset() clears all tracked attempts for both change-password and set-password")
    void reset_ClearsAllAttempts() {
        UUID user = UUID.randomUUID();
        String ip = "10.30.30.1";

        for (int i = 0; i < 5; i++) {
            rateLimiter.checkChangePasswordRateLimit(user, ip);
            rateLimiter.checkSetPasswordRateLimit(user, ip);
        }

        rateLimiter.reset();

        assertThatCode(() -> rateLimiter.checkChangePasswordRateLimit(user, ip)).doesNotThrowAnyException();
        assertThatCode(() -> rateLimiter.checkSetPasswordRateLimit(user, ip)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Handles null or blank IP by normalizing to default")
    void handlesNullOrBlankIpGracefully() {
        UUID user = UUID.randomUUID();
        assertThatCode(() -> rateLimiter.checkChangePasswordRateLimit(user, null)).doesNotThrowAnyException();
        assertThatCode(() -> rateLimiter.checkSetPasswordRateLimit(user, "   ")).doesNotThrowAnyException();
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
