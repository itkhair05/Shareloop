package com.shareloop.security.ratelimit;

import com.shareloop.repository.ForgotPasswordAttemptRepository;
import com.shareloop.repository.PasswordResetTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class PasswordResetCleanupService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetCleanupService.class);

    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final ForgotPasswordAttemptRepository forgotPasswordAttemptRepository;
    private final RateLimitProperties properties;
    private final Clock clock;

    public PasswordResetCleanupService(
            PasswordResetTokenRepository passwordResetTokenRepository,
            ForgotPasswordAttemptRepository forgotPasswordAttemptRepository,
            RateLimitProperties properties,
            Clock clock
    ) {
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.forgotPasswordAttemptRepository = forgotPasswordAttemptRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Periodically cleans up expired/consumed password reset tokens and old rate-limit attempt audit records.
     * Scheduled via cron (default: hourly at minute 0).
     */
    @Scheduled(cron = "${app.security.rate-limit.password-reset-cleanup-cron:0 0 * * * *}")
    @Transactional
    public CleanupSummary performCleanup() {
        int purgedAttempts = cleanupExpiredAttempts();
        int purgedTokens = cleanupExpiredTokens();
        return new CleanupSummary(purgedAttempts, purgedTokens);
    }

    /**
     * Purges forgot-password attempt audit records older than the configured retention period (default: 24 hours).
     * Enforces a minimum retention of 1 hour to prevent deleting records needed by the active 15-minute window.
     *
     * @return number of purged attempt records
     */
    @Transactional
    public int cleanupExpiredAttempts() {
        int retentionHours = Math.max(1, properties.getForgotPasswordAttemptRetentionHours());
        Instant cutoff = clock.instant().minus(retentionHours, ChronoUnit.HOURS);
        try {
            int deleted = forgotPasswordAttemptRepository.deleteByCreatedAtBefore(cutoff);
            if (deleted > 0) {
                log.info("Purged {} expired forgot-password rate-limit attempts created before {}", deleted, cutoff);
            }
            return deleted;
        } catch (Exception e) {
            log.error("Failed to clean up expired forgot-password rate-limit attempts: {}", e.getMessage(), e);
            return 0;
        }
    }

    /**
     * Purges password reset tokens that are expired or consumed and older than the configured retention period (default: 7 days).
     *
     * @return number of purged token records
     */
    @Transactional
    public int cleanupExpiredTokens() {
        int retentionDays = Math.max(1, properties.getPasswordResetTokenRetentionDays());
        Instant cutoff = clock.instant().minus(retentionDays, ChronoUnit.DAYS);
        try {
            int deleted = passwordResetTokenRepository.deleteExpiredOrUsedBefore(cutoff);
            if (deleted > 0) {
                log.info("Purged {} expired/consumed password-reset tokens older than {}", deleted, cutoff);
            }
            return deleted;
        } catch (Exception e) {
            log.error("Failed to clean up expired password-reset tokens: {}", e.getMessage(), e);
            return 0;
        }
    }

    public record CleanupSummary(int purgedAttempts, int purgedTokens) {}
}
