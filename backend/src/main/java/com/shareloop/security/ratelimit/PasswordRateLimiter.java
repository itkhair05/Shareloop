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

/**
 * In-memory sliding-window rate limiter protecting password management endpoints:
 * - POST /api/v1/auth/change-password: prevents brute-force guessing of current passwords.
 * - POST /api/v1/auth/set-password: prevents rapid abuse and CPU exhaustion from BCrypt hashing.
 *
 * Identity Dimensions:
 * - Primary: Authenticated user ID (UUID).
 * - Secondary: Client IP address (resolved via ClientIpResolver).
 *
 * Operational Limitations (In-Memory Implementation):
 * - Per-Process Isolation: Rate-limiting counters reside in local JVM memory.
 * - Multi-Instance Deployments: In a clustered environment behind a load balancer,
 *   attempts are tracked independently per node (unless sticky sessions or external caching like Redis is added).
 * - Process Restarts: Counters reset to zero upon application restart.
 */
@Service
public class PasswordRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(PasswordRateLimiter.class);

    public static final String CHANGE_PASSWORD_RATE_LIMIT_MESSAGE = "Quá nhiều yêu cầu đổi mật khẩu. Vui lòng thử lại sau 1 phút.";
    public static final String SET_PASSWORD_RATE_LIMIT_MESSAGE = "Quá nhiều yêu cầu thiết lập mật khẩu. Vui lòng thử lại sau 1 phút.";
    private static final String DEFAULT_CLIENT_IP = "127.0.0.1";

    private final RateLimitProperties properties;
    private final Clock clock;

    private final Map<UUID, Deque<Instant>> userChangePasswordAttempts = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> ipChangePasswordAttempts = new ConcurrentHashMap<>();

    private final Map<UUID, Deque<Instant>> userSetPasswordAttempts = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> ipSetPasswordAttempts = new ConcurrentHashMap<>();

    public PasswordRateLimiter(RateLimitProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Checks and records a change-password attempt by authenticated user ID and client IP.
     * Throws RateLimitExceededException if user quota or IP quota is exceeded.
     *
     * @param userId   Authenticated user ID (primary identity key)
     * @param clientIp Client IP address (defense-in-depth)
     */
    public void checkChangePasswordRateLimit(UUID userId, String clientIp) {
        String normalizedIp = normalizeClientIp(clientIp);
        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getChangePasswordWindowSeconds(), ChronoUnit.SECONDS);

        if (userId != null) {
            int userLimit = properties.getChangePasswordUserLimit();
            userChangePasswordAttempts.compute(userId, (key, deque) -> {
                if (deque == null) {
                    deque = new ArrayDeque<>();
                }
                while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                    deque.pollFirst();
                }

                if (deque.size() >= userLimit) {
                    log.warn("Change password rate limit exceeded for user ID '{}' (attempts: {})", key, deque.size());
                    throw new RateLimitExceededException(CHANGE_PASSWORD_RATE_LIMIT_MESSAGE);
                }

                deque.addLast(now);
                return deque;
            });
        }

        int ipLimit = properties.getChangePasswordIpLimit();
        ipChangePasswordAttempts.compute(normalizedIp, (key, deque) -> {
            if (deque == null) {
                deque = new ArrayDeque<>();
            }
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }

            if (deque.size() >= ipLimit) {
                log.warn("Change password rate limit exceeded for client IP '{}' (attempts: {})", key, deque.size());
                throw new RateLimitExceededException(CHANGE_PASSWORD_RATE_LIMIT_MESSAGE);
            }

            deque.addLast(now);
            return deque;
        });
    }

    /**
     * Checks and records a set-password attempt by authenticated user ID and client IP.
     * Throws RateLimitExceededException if user quota or IP quota is exceeded.
     *
     * @param userId   Authenticated user ID (primary identity key)
     * @param clientIp Client IP address (defense-in-depth)
     */
    public void checkSetPasswordRateLimit(UUID userId, String clientIp) {
        String normalizedIp = normalizeClientIp(clientIp);
        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getSetPasswordWindowSeconds(), ChronoUnit.SECONDS);

        if (userId != null) {
            int userLimit = properties.getSetPasswordUserLimit();
            userSetPasswordAttempts.compute(userId, (key, deque) -> {
                if (deque == null) {
                    deque = new ArrayDeque<>();
                }
                while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                    deque.pollFirst();
                }

                if (deque.size() >= userLimit) {
                    log.warn("Set password rate limit exceeded for user ID '{}' (attempts: {})", key, deque.size());
                    throw new RateLimitExceededException(SET_PASSWORD_RATE_LIMIT_MESSAGE);
                }

                deque.addLast(now);
                return deque;
            });
        }

        int ipLimit = properties.getSetPasswordIpLimit();
        ipSetPasswordAttempts.compute(normalizedIp, (key, deque) -> {
            if (deque == null) {
                deque = new ArrayDeque<>();
            }
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }

            if (deque.size() >= ipLimit) {
                log.warn("Set password rate limit exceeded for client IP '{}' (attempts: {})", key, deque.size());
                throw new RateLimitExceededException(SET_PASSWORD_RATE_LIMIT_MESSAGE);
            }

            deque.addLast(now);
            return deque;
        });
    }

    /**
     * Resets all rate-limiting attempt counters (primarily for test isolation).
     */
    public void reset() {
        userChangePasswordAttempts.clear();
        ipChangePasswordAttempts.clear();
        userSetPasswordAttempts.clear();
        ipSetPasswordAttempts.clear();
    }

    private String normalizeClientIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return DEFAULT_CLIENT_IP;
        }
        return clientIp.trim();
    }
}
