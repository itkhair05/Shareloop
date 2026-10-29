package com.shareloop.security.ratelimit;

import com.shareloop.repository.LoginAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class LoginAttemptCleanupService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptCleanupService.class);

    private final LoginAttemptRepository loginAttemptRepository;
    private final RateLimitProperties properties;
    private final Clock clock;

    public LoginAttemptCleanupService(
            LoginAttemptRepository loginAttemptRepository,
            RateLimitProperties properties,
            Clock clock
    ) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Purges login attempts older than the configured retention period (default: 24 hours).
     * Runs periodically (default: once per hour).
     *
     * @return number of deleted records
     */
    @Scheduled(cron = "${app.security.rate-limit.cleanup-cron:0 0 * * * *}")
    @Transactional
    public int cleanupExpiredAttempts() {
        int retentionHours = Math.max(1, properties.getLoginAttemptRetentionHours());
        Instant cutoff = clock.instant().minus(retentionHours, ChronoUnit.HOURS);
        try {
            int deleted = loginAttemptRepository.deleteByCreatedAtBefore(cutoff);
            if (deleted > 0) {
                log.info("Purged {} expired login attempts created before {}", deleted, cutoff);
            }
            return deleted;
        } catch (Exception e) {
            log.error("Failed to clean up expired login attempts: {}", e.getMessage(), e);
            return 0;
        }
    }
}
