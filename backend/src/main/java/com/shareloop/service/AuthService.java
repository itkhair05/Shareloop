package com.shareloop.service;

import com.shareloop.dto.auth.AuthResponse;
import com.shareloop.dto.auth.ForgotPasswordRequest;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.dto.auth.MessageResponse;
import com.shareloop.dto.auth.RegisterRequest;
import com.shareloop.dto.auth.ResetPasswordRequest;
import com.shareloop.dto.auth.UpdateProfileRequest;
import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.entity.PasswordResetToken;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.*;
import com.shareloop.repository.PasswordResetTokenRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.security.ratelimit.ForgotPasswordRateLimiter;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
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
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String FORGOT_PASSWORD_GENERIC_MESSAGE =
            "Nếu email của bạn tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.";
    private static final String RESET_PASSWORD_SUCCESS_MESSAGE =
            "Mật khẩu của bạn đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới.";
    private static final String INVALID_OR_EXPIRED_TOKEN_MESSAGE =
            "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final ForgotPasswordRateLimiter forgotPasswordRateLimiter;
    private final RateLimitProperties rateLimitProperties;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailService emailService,
            ForgotPasswordRateLimiter forgotPasswordRateLimiter,
            RateLimitProperties rateLimitProperties,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
        this.forgotPasswordRateLimiter = forgotPasswordRateLimiter;
        this.rateLimitProperties = rateLimitProperties;
        this.clock = clock;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateEmailException("An account with email " + normalizedEmail + " already exists");
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());
        User user = new User(
                request.getDisplayName().trim(),
                normalizedEmail,
                passwordHash,
                UserRole.USER,
                UserStatus.ACTIVE
        );

        User savedUser;
        try {
            savedUser = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Guard against concurrent registration race conditions
            throw new DuplicateEmailException("An account with email " + normalizedEmail + " already exists");
        }

        String token = jwtService.generateToken(
                savedUser.getId(),
                savedUser.getEmail(),
                savedUser.getRole(),
                savedUser.getStatus()
        );

        return new AuthResponse(
                savedUser.getId(),
                savedUser.getDisplayName(),
                savedUser.getEmail(),
                savedUser.getRole(),
                savedUser.getStatus(),
                savedUser.getCreatedAt(),
                token
        );
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new AccountSuspendedException("Your account has been suspended. Please contact support.");
        }

        if (user.getStatus() == UserStatus.DEACTIVATED) {
            throw new AccountDeactivatedException("Your account has been deactivated.");
        }

        String token = jwtService.generateToken(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                user.getStatus()
        );

        return new AuthResponse(
                user.getId(),
                user.getDisplayName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt(),
                token
        );
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        return UserProfileResponse.fromEntity(user);
    }

    @Transactional
    public UserProfileResponse updateCurrentUser(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        user.setDisplayName(request.getDisplayName().trim());

        String rawPhone = request.getPhoneNumber();
        String normalizedPhone = (rawPhone == null || rawPhone.trim().isEmpty())
                ? null
                : rawPhone.trim();
        user.setPhoneNumber(normalizedPhone);

        User savedUser = userRepository.save(user);
        return UserProfileResponse.fromEntity(savedUser);
    }

    /**
     * Handles forgot password requests with IP/Email rate limiting and privacy-safe generic response.
     * Enforces single-use token lifecycle: issuing a new token invalidates previous unused tokens for the user.
     */
    @Transactional
    public MessageResponse forgotPassword(ForgotPasswordRequest request, String clientIp) {
        // 1. Normalize target email
        String normalizedEmail = request != null && request.getEmail() != null
                ? request.getEmail().trim().toLowerCase(Locale.ROOT)
                : "";

        // 2. Enforce IP rate limit and email rate limit atomically before any DB account lookup or email provider execution
        forgotPasswordRateLimiter.checkRateLimitAndRecord(clientIp, normalizedEmail);

        // 3. Look up account
        Optional<User> userOpt = userRepository.findByEmail(normalizedEmail);
        if (userOpt.isEmpty()) {
            // Non-existent email: return identical generic response
            return new MessageResponse(FORGOT_PASSWORD_GENERIC_MESSAGE);
        }

        User user = userOpt.get();

        // 5. Check account status: do not leak status via response, but do not send reset link if suspended/deactivated
        if (user.getStatus() != UserStatus.ACTIVE) {
            log.warn("Forgot password requested for inactive user id '{}' with status '{}'", user.getId(), user.getStatus());
            return new MessageResponse(FORGOT_PASSWORD_GENERIC_MESSAGE);
        }

        // 6. Lock user row to serialize concurrent reset requests for the same account
        User lockedUser = userRepository.findByIdForUpdate(user.getId()).orElse(user);

        // 7. Invalidate prior unused tokens for this account
        Instant now = clock.instant();
        passwordResetTokenRepository.invalidatePreviousTokensForUser(lockedUser.getId(), now);

        // 8. Generate 32 cryptographically secure random bytes encoded as URL-safe Base64
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

        // 9. Dispatch reset email via email provider abstraction
        try {
            emailService.sendPasswordResetEmail(lockedUser.getEmail(), lockedUser.getDisplayName(), rawToken);
        } catch (Exception e) {
            log.error("Failed to deliver password reset email: {}", e.getMessage());
            // Provider-failure policy: invalidate specifically the token associated with this failed delivery
            passwordResetTokenRepository.invalidateTokenById(resetToken.getId(), clock.instant());
        }

        return new MessageResponse(FORGOT_PASSWORD_GENERIC_MESSAGE);
    }

    /**
     * Atomically validates and consumes the reset token, then updates the user's password in the same transaction.
     */
    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        String rawToken = request != null && request.getToken() != null ? request.getToken().trim() : "";
        if (rawToken.isEmpty()) {
            throw new InvalidResetTokenException(INVALID_OR_EXPIRED_TOKEN_MESSAGE);
        }

        String newPassword = request != null ? request.getNewPassword() : null;
        if (newPassword == null || newPassword.isBlank() || newPassword.length() < 8 || newPassword.length() > 100) {
            throw new IllegalArgumentException("Password must be between 8 and 100 characters");
        }

        String tokenHash = hashToken(rawToken);
        Instant now = clock.instant();

        // 1. Atomic conditional update: claim token if valid, unused, and not expired
        int rowsUpdated = passwordResetTokenRepository.markTokenAsUsedIfValid(tokenHash, now);
        if (rowsUpdated == 0) {
            throw new InvalidResetTokenException(INVALID_OR_EXPIRED_TOKEN_MESSAGE);
        }

        // 2. Fetch token entity to get user
        PasswordResetToken token = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new InvalidResetTokenException(INVALID_OR_EXPIRED_TOKEN_MESSAGE));

        User user = token.getUser();
        if (user.getStatus() != UserStatus.ACTIVE) {
            // Suspended or deactivated user cannot reset password
            throw new InvalidResetTokenException(INVALID_OR_EXPIRED_TOKEN_MESSAGE);
        }

        // 3. Update password in the same transaction
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return new MessageResponse(RESET_PASSWORD_SUCCESS_MESSAGE);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
