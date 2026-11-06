package com.shareloop.security.ratelimit;

import com.shareloop.entity.LoginAttempt;
import com.shareloop.repository.LoginAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Account-oriented progressive login backoff stored in the existing
 * login_attempts ledger under a namespaced HMAC key ("acct:" + 40 hex chars).
 *
 * <p>Design constraints:</p>
 * <ul>
 *     <li>The key is an HMAC of the normalized email, never the raw address.</li>
 *     <li>Backoff is evaluated only after a password mismatch, so a user with the
 *     correct password is never locked out by an attacker.</li>
 *     <li>Unknown and known emails follow the same path, so responses do not
 *     disclose account existence.</li>
 *     <li>State is database-backed and serialized with an advisory transaction
 *     lock, so multiple application instances share the same counter.</li>
 *     <li>Successful authentication clears the account failure state.</li>
 * </ul>
 */
@Service
public class AccountLoginBackoffService {

    private static final Logger log = LoggerFactory.getLogger(AccountLoginBackoffService.class);

    public static final String BACKOFF_MESSAGE =
            "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.";
    static final String KEY_PREFIX = "acct:";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String FALLBACK_SECRET = "shareloop-account-backoff-fallback-key";
    private static final int KEY_BYTES = 20;

    private final LoginAttemptRepository loginAttemptRepository;
    private final RateLimitProperties properties;
    private final Clock clock;
    private final AtomicBoolean legacyFallbackWarned = new AtomicBoolean(false);

    public AccountLoginBackoffService(
            LoginAttemptRepository loginAttemptRepository,
            RateLimitProperties properties,
            Clock clock
    ) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Records a failed credential check for the account and returns the number of
     * seconds the caller must advertise before another attempt, or 0 when the
     * account is below the failure limit.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int recordFailure(String normalizedEmail) {
        if (!properties.isAccountBackoffEnabled()) {
            return 0;
        }

        String key = accountKeyFor(normalizedEmail);
        loginAttemptRepository.acquireAccountAdvisoryLock(key);

        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getAccountWindowSeconds(), ChronoUnit.SECONDS);
        long previousFailures = loginAttemptRepository.countByIpAddressAndCreatedAtAfter(key, windowStart);
        loginAttemptRepository.save(new LoginAttempt(key, now));

        long failures = previousFailures + 1;
        int limit = Math.max(1, properties.getAccountFailureLimit());
        if (failures <= limit) {
            return 0;
        }

        long overflow = failures - limit;
        long exponent = Math.min(overflow - 1, 20);
        long delay = (long) properties.getAccountBackoffBaseSeconds() << exponent;
        long capped = Math.min(delay, properties.getAccountBackoffMaxSeconds());
        return (int) Math.max(1, capped);
    }

    /**
     * Clears the account failure state after a successful credential check.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(String normalizedEmail) {
        if (!properties.isAccountBackoffEnabled()) {
            return;
        }
        loginAttemptRepository.deleteByIpAddress(accountKeyFor(normalizedEmail));
    }

    static String accountKey(String normalizedEmail) {
        return accountKey(normalizedEmail, FALLBACK_SECRET);
    }

    static String accountKey(String normalizedEmail, String secret) {
        String source = normalizedEmail == null ? "" : normalizedEmail.trim().toLowerCase(Locale.ROOT);
        return KEY_PREFIX + hmac(source, secret);
    }

    private String accountKeyFor(String normalizedEmail) {
        String secret = properties.getAccountBackoffSecret();
        if (secret != null && !secret.isBlank()) {
            return accountKey(normalizedEmail, secret);
        }
        // Transitional fallback: the legacy forgot-password secret keeps existing
        // backoff keys stable until ACCOUNT_BACKOFF_HMAC_SECRET is configured.
        if (legacyFallbackWarned.compareAndSet(false, true)) {
            log.warn("ACCOUNT_BACKOFF_HMAC_SECRET is not configured; the account backoff key is derived from "
                    + "FORGOT_PASSWORD_SECRET. Configure the dedicated secret to decouple the two functions; "
                    + "switching keys resets in-flight backoff state for at most the backoff window.");
        }
        secret = properties.getForgotPasswordSecret();
        if (secret == null || secret.isBlank()) {
            secret = FALLBACK_SECRET;
        }
        return accountKey(normalizedEmail, secret);
    }

    private static String hmac(String email, String secret) {
        Mac mac;
        try {
            mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] digest = mac.doFinal(("login-account:" + email).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, KEY_BYTES);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Unable to compute account backoff key", e);
        }
    }
}
