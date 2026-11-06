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

/**
 * Cross-instance registration throttle keyed by the resolved client IP.
 * Attempts are stored in the existing login_attempts ledger under a
 * namespaced key ("reg:" + IPv4/IPv6) so no schema change is required.
 */
@Service
public class RegistrationRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RegistrationRateLimiter.class);
    public static final String RATE_LIMIT_MESSAGE = "Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.";
    static final String KEY_PREFIX = "reg:";

    private final LoginAttemptRepository loginAttemptRepository;
    private final RateLimitProperties properties;
    private final Clock clock;

    public RegistrationRateLimiter(
            LoginAttemptRepository loginAttemptRepository,
            RateLimitProperties properties,
            Clock clock
    ) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Checks and records a registration attempt atomically for one client IP.
     * The advisory transaction lock serializes concurrent requests across instances.
     *
     * @throws RateLimitExceededException when the rolling registration limit is reached
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkAndRecordAttempt(String clientIp) {
        String key = registrationKey(clientIp);

        loginAttemptRepository.acquireRegistrationAdvisoryLock(key);

        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getRegistrationWindowSeconds(), ChronoUnit.SECONDS);
        long attemptCount = loginAttemptRepository.countByIpAddressAndCreatedAtAfter(key, windowStart);

        if (attemptCount >= properties.getRegistrationIpLimit()) {
            log.warn("Registration rate limit exceeded for client IP '{}' (attempts: {})", clientIp, attemptCount);
            throw new RateLimitExceededException(RATE_LIMIT_MESSAGE);
        }

        loginAttemptRepository.save(new LoginAttempt(key, now));
    }

    static String registrationKey(String clientIp) {
        String normalized = clientIp == null || clientIp.isBlank() ? "127.0.0.1" : clientIp.trim();
        return KEY_PREFIX + normalized;
    }
}
