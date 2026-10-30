package com.shareloop.security.ratelimit;

import com.shareloop.exception.RateLimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GoogleAuthRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthRateLimiter.class);

    public static final String LOGIN_RATE_LIMIT_MESSAGE = "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 1 phút.";
    public static final String LINK_RATE_LIMIT_MESSAGE = "Quá nhiều yêu cầu liên kết tài khoản. Vui lòng thử lại sau 1 phút.";

    private final RateLimitProperties properties;
    private final Clock clock;

    // In-memory sliding-window attempts, completely decoupled from password-login database attempts
    private final Map<String, Deque<Instant>> ipLoginAttempts = new ConcurrentHashMap<>();
    private final Map<UUID, Deque<Instant>> userLinkAttempts = new ConcurrentHashMap<>();

    public GoogleAuthRateLimiter(RateLimitProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Checks and records a Google Sign-In attempt by client IP.
     * Prevents automated brute-force attempts on public /api/v1/auth/google
     * without interfering with or double-counting password-login attempts.
     */
    public void checkLoginRateLimit(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "127.0.0.1";
        }

        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getLoginWindowSeconds(), ChronoUnit.SECONDS);
        int limit = properties.getLoginLimit();

        ipLoginAttempts.compute(clientIp, (key, deque) -> {
            if (deque == null) {
                deque = new ArrayDeque<>();
            }
            // Purge expired attempts outside rolling window
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }

            if (deque.size() >= limit) {
                log.warn("Google login rate limit exceeded for client IP '{}' (attempts: {})", key, deque.size());
                throw new RateLimitExceededException(LOGIN_RATE_LIMIT_MESSAGE);
            }

            deque.addLast(now);
            return deque;
        });
    }

    /**
     * Checks and records an explicit Google account-linking attempt by authenticated user ID.
     */
    public void checkLinkRateLimit(UUID userId) {
        if (userId == null) {
            return;
        }

        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getLoginWindowSeconds(), ChronoUnit.SECONDS);
        int limit = properties.getLoginLimit();

        userLinkAttempts.compute(userId, (key, deque) -> {
            if (deque == null) {
                deque = new ArrayDeque<>();
            }
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }

            if (deque.size() >= limit) {
                log.warn("Google account-link rate limit exceeded for user ID '{}' (attempts: {})", key, deque.size());
                throw new RateLimitExceededException(LINK_RATE_LIMIT_MESSAGE);
            }

            deque.addLast(now);
            return deque;
        });
    }

    /**
     * Resets rate-limiting attempts (used in test setup).
     */
    public void reset() {
        ipLoginAttempts.clear();
        userLinkAttempts.clear();
    }
}
