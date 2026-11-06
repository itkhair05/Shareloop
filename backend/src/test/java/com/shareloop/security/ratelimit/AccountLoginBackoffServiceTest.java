package com.shareloop.security.ratelimit;

import com.shareloop.entity.LoginAttempt;
import com.shareloop.repository.LoginAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.junit.jupiter.api.Nested;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountLoginBackoffServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-06T10:00:00Z");
    private static final String EMAIL = "user@example.com";
    private static final String SECRET = "unit-test-hmac-secret";

    @Mock
    private LoginAttemptRepository repository;

    private RateLimitProperties properties;
    private AccountLoginBackoffService service;

    @BeforeEach
    void setUp() {
        properties = new RateLimitProperties();
        properties.setAccountBackoffEnabled(true);
        properties.setAccountFailureLimit(5);
        properties.setAccountWindowSeconds(900);
        properties.setAccountBackoffBaseSeconds(30);
        properties.setAccountBackoffMaxSeconds(900);
        properties.setForgotPasswordSecret(SECRET);
        service = new AccountLoginBackoffService(repository, properties, Clock.fixed(NOW, ZoneOffset.UTC));
        lenient().when(repository.acquireAccountAdvisoryLock(any())).thenReturn(1);
    }

    private OngoingStubbing<Long> previousFailures(long... values) {
        OngoingStubbing<Long> stub = when(repository.countByIpAddressAndCreatedAtAfter(any(), any()));
        for (long value : values) {
            stub = stub.thenReturn(value);
        }
        return stub;
    }

    @Test
    @DisplayName("Below the failure limit no backoff is returned but the attempt is recorded")
    void belowLimitRecordsAttempt() {
        previousFailures(0);

        assertThat(service.recordFailure(EMAIL)).isZero();

        verify(repository).save(any(LoginAttempt.class));
    }

    @Test
    @DisplayName("The fifth failure is still below the limit")
    void fifthFailureIsStillAllowed() {
        previousFailures(4);

        assertThat(service.recordFailure(EMAIL)).isZero();
    }

    @Test
    @DisplayName("The sixth failure returns the base delay")
    void sixthFailureReturnsBaseDelay() {
        previousFailures(5);

        assertThat(service.recordFailure(EMAIL)).isEqualTo(30);
    }

    @Test
    @DisplayName("Backoff grows exponentially and respects the configured maximum")
    void backoffGrowsAndCaps() {
        AtomicLong previous = new AtomicLong(5);
        when(repository.countByIpAddressAndCreatedAtAfter(any(), any()))
                .thenAnswer(invocation -> previous.getAndIncrement());

        assertThat(service.recordFailure(EMAIL)).isEqualTo(30);
        assertThat(service.recordFailure(EMAIL)).isEqualTo(60);
        assertThat(service.recordFailure(EMAIL)).isEqualTo(120);
        assertThat(service.recordFailure(EMAIL)).isEqualTo(240);
        assertThat(service.recordFailure(EMAIL)).isEqualTo(480);
        assertThat(service.recordFailure(EMAIL)).isEqualTo(900);
        assertThat(service.recordFailure(EMAIL)).isEqualTo(900);
    }

    @Test
    @DisplayName("A very large failure count cannot overflow the delay")
    void veryLargeFailureCountCaps() {
        previousFailures(10_000);

        assertThat(service.recordFailure(EMAIL)).isEqualTo(900);
    }

    @Test
    @DisplayName("Disabled backoff neither reads nor writes state")
    void disabledBackoffDoesNothing() {
        properties.setAccountBackoffEnabled(false);

        assertThat(service.recordFailure(EMAIL)).isZero();

        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("Account keys are HMAC-derived, namespaced and normalized")
    void accountKeyIsHashedAndNormalized() {
        String key = AccountLoginBackoffService.accountKey("  User@Example.COM ", SECRET);

        assertThat(key).startsWith("acct:").hasSize(45);
        assertThat(key).doesNotContain("user").doesNotContain("example");
        assertThat(AccountLoginBackoffService.accountKey(EMAIL, SECRET)).isEqualTo(key);
        assertThat(AccountLoginBackoffService.accountKey(EMAIL, "other-secret")).isNotEqualTo(key);
    }

    @Test
    @DisplayName("The account key uses the configured secret, not the raw email")
    void accountKeyUsesConfiguredSecret() {
        String key = AccountLoginBackoffService.accountKey(EMAIL, SECRET);

        previousFailures(5);
        service.recordFailure(EMAIL);

        ArgumentCaptor<String> lockKey = ArgumentCaptor.forClass(String.class);
        verify(repository).acquireAccountAdvisoryLock(lockKey.capture());
        assertThat(lockKey.getValue()).isEqualTo(key);
    }

    @Test
    @DisplayName("Successful authentication clears only the account key")
    void recordSuccessClearsAccountKey() {
        service.recordSuccess(EMAIL);

        verify(repository).deleteByIpAddress(AccountLoginBackoffService.accountKey(EMAIL, SECRET));
    }

    @Test
    @DisplayName("The advisory lock is acquired before reading and writing state")
    void locksBeforeReading() {
        previousFailures(5);

        service.recordFailure(EMAIL);

        InOrder order = inOrder(repository);
        order.verify(repository).acquireAccountAdvisoryLock(any());
        order.verify(repository).countByIpAddressAndCreatedAtAfter(any(), eq(NOW.minusSeconds(900)));
        order.verify(repository).save(any(LoginAttempt.class));
    }

    @Test
    @DisplayName("No backoff is computed when disabled, even for many failures")
    void disabledNeverThrottles() {
        properties.setAccountBackoffEnabled(false);

        assertThat(service.recordFailure(EMAIL)).isZero();
        verify(repository, never()).save(any());
    }

    @Nested
    @DisplayName("Dedicated account backoff secret")
    class DedicatedSecret {

        private static final String DEDICATED_SECRET = "dedicated-account-backoff-hmac-secret";

        @Test
        @DisplayName("A dedicated secret produces a different HMAC key than the legacy secret")
        void dedicatedSecretChangesKey() {
            properties.setAccountBackoffSecret(DEDICATED_SECRET);
            previousFailures(0);

            service.recordFailure(EMAIL);

            ArgumentCaptor<String> lockKey = ArgumentCaptor.forClass(String.class);
            verify(repository).acquireAccountAdvisoryLock(lockKey.capture());
            assertThat(lockKey.getValue())
                    .isEqualTo(AccountLoginBackoffService.accountKey(EMAIL, DEDICATED_SECRET))
                    .isNotEqualTo(AccountLoginBackoffService.accountKey(EMAIL, SECRET));
        }

        @Test
        @DisplayName("A missing dedicated secret falls back to the forgot-password secret")
        void missingDedicatedSecretFallsBack() {
            assertThat(properties.getAccountBackoffSecret()).isBlank();
            previousFailures(0);

            service.recordFailure(EMAIL);

            ArgumentCaptor<String> lockKey = ArgumentCaptor.forClass(String.class);
            verify(repository).acquireAccountAdvisoryLock(lockKey.capture());
            assertThat(lockKey.getValue()).isEqualTo(AccountLoginBackoffService.accountKey(EMAIL, SECRET));
        }

        @Test
        @DisplayName("The fallback warning is emitted once and never contains secret values")
        @SuppressWarnings("LocalVariableName")
        void fallbackWarnsOnce() {
            ch.qos.logback.classic.Logger logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory
                    .getLogger(AccountLoginBackoffService.class);
            ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender = new ch.qos.logback.core.read.ListAppender<>();
            appender.start();
            logger.addAppender(appender);
            try {
                previousFailures(0);
                service.recordFailure(EMAIL);
                service.recordFailure(EMAIL);
                service.recordFailure(EMAIL);
                service.recordSuccess(EMAIL);
            } finally {
                logger.detachAppender(appender);
            }

            long warnings = appender.list.stream()
                    .filter(event -> event.getLevel() == ch.qos.logback.classic.Level.WARN)
                    .filter(event -> event.getFormattedMessage().contains("ACCOUNT_BACKOFF_HMAC_SECRET"))
                    .count();
            assertThat(warnings).isEqualTo(1);
            for (ch.qos.logback.classic.spi.ILoggingEvent event : appender.list) {
                assertThat(event.getFormattedMessage()).doesNotContain(SECRET).doesNotContain(EMAIL);
            }
        }

        @Test
        @DisplayName("Raw email never appears in the persisted key with a dedicated secret")
        void rawEmailNeverPersisted() {
            properties.setAccountBackoffSecret(DEDICATED_SECRET);
            previousFailures(0);

            service.recordFailure("attacker@evil.com");

            ArgumentCaptor<String> lockKey = ArgumentCaptor.forClass(String.class);
            verify(repository).acquireAccountAdvisoryLock(lockKey.capture());
            assertThat(lockKey.getValue())
                    .startsWith("acct:").hasSize(45)
                    .doesNotContain("attacker").doesNotContain("evil");
        }

        @Test
        @DisplayName("Successful login clears the state derived from the dedicated secret")
        void successClearsDedicatedKey() {
            properties.setAccountBackoffSecret(DEDICATED_SECRET);

            service.recordSuccess(EMAIL);

            verify(repository).deleteByIpAddress(
                    AccountLoginBackoffService.accountKey(EMAIL, DEDICATED_SECRET));
        }

        @Test
        @DisplayName("Blank dedicated secret is trimmed and treated as missing")
        void blankDedicatedSecretTrimsToMissing() {
            properties.setAccountBackoffSecret("   ");
            previousFailures(0);

            service.recordFailure(EMAIL);

            ArgumentCaptor<String> lockKey = ArgumentCaptor.forClass(String.class);
            verify(repository).acquireAccountAdvisoryLock(lockKey.capture());
            assertThat(lockKey.getValue()).isEqualTo(AccountLoginBackoffService.accountKey(EMAIL, SECRET));
        }
    }
}
