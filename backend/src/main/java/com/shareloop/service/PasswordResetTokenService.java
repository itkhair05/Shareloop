package com.shareloop.service;

import com.shareloop.entity.PasswordResetToken;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.PasswordResetTokenRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.ratelimit.RateLimitProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetTokenService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetTokenService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RateLimitProperties rateLimitProperties;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetTokenService(
            UserRepository userRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            RateLimitProperties rateLimitProperties,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.rateLimitProperties = rateLimitProperties;
        this.clock = clock;
    }

    /**
     * Executes a short database transaction that locks the user row, invalidates previous tokens,
     * generates and persists a new token, and returns the preparation result for dispatch.
     * The transaction COMMITS immediately upon return, releasing the user-row lock before any network I/O.
     */
    @Transactional
    public Optional<PreparedResetToken> preparePasswordResetToken(String normalizedEmail) {
        Optional<User> userOpt = userRepository.findByEmail(normalizedEmail);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        User user = userOpt.get();
        if (user.getStatus() != UserStatus.ACTIVE) {
            log.warn("Forgot password requested for inactive user id '{}' with status '{}'", user.getId(), user.getStatus());
            return Optional.empty();
        }

        // Lock user row to serialize concurrent reset requests for the same account
        User lockedUser = userRepository.findByIdForUpdate(user.getId()).orElse(user);

        Instant now = clock.instant();
        passwordResetTokenRepository.invalidatePreviousTokensForUser(lockedUser.getId(), now);

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        String tokenHash = hashToken(rawToken);

        int expirationMinutes = rateLimitProperties != null && rateLimitProperties.getResetTokenExpirationMinutes() > 0
                ? rateLimitProperties.getResetTokenExpirationMinutes()
                : 15;
        Instant expiresAt = now.plus(expirationMinutes, ChronoUnit.MINUTES);

        PasswordResetToken resetToken = new PasswordResetToken(lockedUser, tokenHash, expiresAt, now);
        passwordResetTokenRepository.saveAndFlush(resetToken);

        return Optional.of(new PreparedResetToken(
                resetToken.getId(),
                lockedUser.getEmail(),
                lockedUser.getDisplayName(),
                rawToken,
                expirationMinutes
        ));
    }

    /**
     * Short compensating transaction: invalidates specifically the token created by that request if delivery fails.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void invalidateFailedToken(UUID tokenId) {
        if (tokenId != null) {
            passwordResetTokenRepository.invalidateTokenById(tokenId, clock.instant());
        }
    }

    public String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    public record PreparedResetToken(
            UUID tokenId,
            String email,
            String displayName,
            String rawToken,
            int expirationMinutes
    ) {}
}
