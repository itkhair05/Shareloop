package com.shareloop.security.ratelimit;

import com.shareloop.repository.ForgotPasswordAttemptRepository;
import com.shareloop.repository.PasswordResetTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetCleanupServiceTest {

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private ForgotPasswordAttemptRepository forgotPasswordAttemptRepository;

    private RateLimitProperties properties;
    private Clock fixedClock;
    private PasswordResetCleanupService cleanupService;

    private final Instant now = Instant.parse("2026-10-29T12:00:00Z");

    @BeforeEach
    void setUp() {
        properties = new RateLimitProperties();
        properties.setForgotPasswordAttemptRetentionHours(24);
        properties.setPasswordResetTokenRetentionDays(7);

        fixedClock = Clock.fixed(now, ZoneId.of("UTC"));
        cleanupService = new PasswordResetCleanupService(
                passwordResetTokenRepository,
                forgotPasswordAttemptRepository,
                properties,
                fixedClock
        );
    }

    @Test
    @DisplayName("cleanupExpiredAttempts deletes attempts older than configured retention cutoff (24 hours)")
    void cleanupExpiredAttemptsUsesCorrectCutoff() {
        when(forgotPasswordAttemptRepository.deleteByCreatedAtBefore(any(Instant.class))).thenReturn(15);

        int deleted = cleanupService.cleanupExpiredAttempts();

        assertThat(deleted).isEqualTo(15);

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(forgotPasswordAttemptRepository).deleteByCreatedAtBefore(cutoffCaptor.capture());

        Instant expectedCutoff = now.minus(24, ChronoUnit.HOURS);
        assertThat(cutoffCaptor.getValue()).isEqualTo(expectedCutoff);
    }

    @Test
    @DisplayName("cleanupExpiredTokens deletes tokens older than configured retention cutoff (7 days)")
    void cleanupExpiredTokensUsesCorrectCutoff() {
        when(passwordResetTokenRepository.deleteExpiredOrUsedBefore(any(Instant.class))).thenReturn(8);

        int deleted = cleanupService.cleanupExpiredTokens();

        assertThat(deleted).isEqualTo(8);

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(passwordResetTokenRepository).deleteExpiredOrUsedBefore(cutoffCaptor.capture());

        Instant expectedCutoff = now.minus(7, ChronoUnit.DAYS);
        assertThat(cutoffCaptor.getValue()).isEqualTo(expectedCutoff);
    }

    @Test
    @DisplayName("performCleanup invokes both attempt cleanup and token cleanup")
    void performCleanupInvokesBoth() {
        when(forgotPasswordAttemptRepository.deleteByCreatedAtBefore(any(Instant.class))).thenReturn(5);
        when(passwordResetTokenRepository.deleteExpiredOrUsedBefore(any(Instant.class))).thenReturn(3);

        PasswordResetCleanupService.CleanupSummary summary = cleanupService.performCleanup();

        assertThat(summary.purgedAttempts()).isEqualTo(5);
        assertThat(summary.purgedTokens()).isEqualTo(3);

        verify(forgotPasswordAttemptRepository).deleteByCreatedAtBefore(now.minus(24, ChronoUnit.HOURS));
        verify(passwordResetTokenRepository).deleteExpiredOrUsedBefore(now.minus(7, ChronoUnit.DAYS));
    }
}
