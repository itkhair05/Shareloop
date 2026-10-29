package com.shareloop.security.ratelimit;

import com.shareloop.entity.ForgotPasswordAttempt;
import com.shareloop.exception.RateLimitExceededException;
import com.shareloop.repository.ForgotPasswordAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
public class ForgotPasswordRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(ForgotPasswordRateLimiter.class);
    public static final String RATE_LIMIT_MESSAGE = "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau.";

    private final ForgotPasswordAttemptRepository forgotPasswordAttemptRepository;
    private final RateLimitProperties properties;
    private final Clock clock;

    public ForgotPasswordRateLimiter(
            ForgotPasswordAttemptRepository forgotPasswordAttemptRepository,
            RateLimitProperties properties,
            Clock clock
    ) {
        this.forgotPasswordAttemptRepository = forgotPasswordAttemptRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Atomically enforces IP quota and target email quota, serializing concurrent requests using
     * PostgreSQL advisory locks (domain 1002 for IP, domain 1003 for Email HMAC) with strict ordering
     * to prevent deadlocks, and records the attempt before any account lookup or email dispatch.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkRateLimitAndRecord(String clientIp, String normalizedEmail) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "127.0.0.1";
        }

        // 1. Acquire transaction-scoped advisory lock for the client IP (domain 1002)
        forgotPasswordAttemptRepository.acquireIpAdvisoryLock(clientIp);

        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.getForgotPasswordWindowSeconds(), ChronoUnit.SECONDS);

        // 2. IP quota enforced first before any further processing
        long ipAttempts = forgotPasswordAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, windowStart);
        if (ipAttempts >= properties.getForgotPasswordIpLimit()) {
            log.warn("Forgot password IP rate limit exceeded for client IP '{}' (attempts: {})", clientIp, ipAttempts);
            throw new RateLimitExceededException(RATE_LIMIT_MESSAGE);
        }

        // 3. Acquire transaction-scoped advisory lock for the email HMAC (domain 1003)
        String emailHash = hashEmail(normalizedEmail);
        forgotPasswordAttemptRepository.acquireEmailAdvisoryLock(emailHash);

        // 4. Target email quota enforced
        long emailAttempts = forgotPasswordAttemptRepository.countByEmailHashAndCreatedAtAfter(emailHash, windowStart);
        if (emailAttempts >= properties.getForgotPasswordEmailLimit()) {
            log.warn("Forgot password email rate limit exceeded for client IP '{}'", clientIp);
            throw new RateLimitExceededException(RATE_LIMIT_MESSAGE);
        }

        // 5. Record the attempt atomically in the same transaction
        ForgotPasswordAttempt attempt = new ForgotPasswordAttempt(clientIp, emailHash, now);
        forgotPasswordAttemptRepository.save(attempt);
    }

    /**
     * Generates a deterministic keyed HMAC-SHA256 hex string for the normalized email.
     */
    public String hashEmail(String normalizedEmail) {
        if (normalizedEmail == null) {
            normalizedEmail = "";
        }
        try {
            String secret = properties.getForgotPasswordSecret();
            if (secret == null || secret.isBlank()) {
                secret = "shareloop-forgot-password-salt-key-default";
            }
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmacBytes = mac.doFinal(normalizedEmail.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hmacBytes);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("Error computing email HMAC", e);
        }
    }
}
