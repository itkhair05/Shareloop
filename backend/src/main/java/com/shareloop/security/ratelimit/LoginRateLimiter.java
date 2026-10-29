package com.shareloop.security.ratelimit;

import com.shareloop.entity.LoginAttempt;
import com.shareloop.exception.RateLimitExceededException;
import com.shareloop.repository.LoginAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);
    public static final String RATE_LIMIT_MESSAGE = "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 1 phút.";

    private final LoginAttemptRepository loginAttemptRepository;
    private final RateLimitProperties properties;
    private final Clock clock;

    public LoginRateLimiter(
            LoginAttemptRepository loginAttemptRepository,
            RateLimitProperties properties,
            Clock clock
    ) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Checks if the client IP has exceeded the allowed login rate limit and records the current attempt.
     * Executes in a separate transaction (REQUIRES_NEW) so that:
     * 1. The PostgreSQL transaction-scoped advisory lock is acquired and held only for this check.
     * 2. The login attempt is committed immediately and persists even if authentication later fails.
     * 3. Concurrent requests for the same IP are serialized at the database level.
     *
     * @param clientIp The normalized client IP address
     * @throws RateLimitExceededException if 5 or more attempts occurred in the last rolling window
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkAndRecordAttempt(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "127.0.0.1";
        }

        // 1. Acquire transaction-scoped advisory lock for the client IP hash
        loginAttemptRepository.acquireAdvisoryLock(clientIp);

        // 2. Count existing attempts within the rolling window
        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getLoginWindowSeconds(), ChronoUnit.SECONDS);
        long attemptCount = loginAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, windowStart);

        if (attemptCount >= properties.getLoginLimit()) {
            log.warn("Rate limit exceeded for client IP '{}' (attempts: {})", clientIp, attemptCount);
            throw new RateLimitExceededException(RATE_LIMIT_MESSAGE);
        }

        // 3. Record this attempt and commit immediately
        LoginAttempt attempt = new LoginAttempt(clientIp, now);
        loginAttemptRepository.save(attempt);
    }
}
