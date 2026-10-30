package com.shareloop.service;

import com.shareloop.dto.auth.AuthResponse;
import com.shareloop.dto.auth.ForgotPasswordRequest;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.dto.auth.MessageResponse;
import com.shareloop.dto.auth.RegisterRequest;
import com.shareloop.dto.auth.ResetPasswordRequest;
import com.shareloop.dto.auth.UpdateProfileRequest;
import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.dto.auth.GoogleAccountStatusResponse;
import com.shareloop.dto.auth.GoogleLoginRequest;
import com.shareloop.entity.PasswordResetToken;
import com.shareloop.entity.User;
import com.shareloop.entity.UserIdentity;
import com.shareloop.entity.enums.IdentityProvider;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.*;
import com.shareloop.repository.PasswordResetTokenRepository;
import com.shareloop.repository.UserIdentityRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.security.google.GoogleIdTokenVerifierService;
import com.shareloop.security.google.GoogleUserClaims;
import com.shareloop.security.ratelimit.ForgotPasswordRateLimiter;
import com.shareloop.security.ratelimit.GoogleAuthRateLimiter;
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
    private final PasswordResetTokenService passwordResetTokenService;
    private final UserIdentityRepository userIdentityRepository;
    private final GoogleIdTokenVerifierService googleIdTokenVerifierService;
    private final GoogleAuthRateLimiter googleAuthRateLimiter;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailService emailService,
            ForgotPasswordRateLimiter forgotPasswordRateLimiter,
            RateLimitProperties rateLimitProperties,
            Clock clock,
            PasswordResetTokenService passwordResetTokenService,
            UserIdentityRepository userIdentityRepository,
            GoogleIdTokenVerifierService googleIdTokenVerifierService,
            GoogleAuthRateLimiter googleAuthRateLimiter
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
        this.forgotPasswordRateLimiter = forgotPasswordRateLimiter;
        this.rateLimitProperties = rateLimitProperties;
        this.clock = clock;
        this.passwordResetTokenService = passwordResetTokenService;
        this.userIdentityRepository = userIdentityRepository;
        this.googleIdTokenVerifierService = googleIdTokenVerifierService;
        this.googleAuthRateLimiter = googleAuthRateLimiter;
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

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
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
     * Token preparation is committed in a short transaction before the external email delivery call.
     */
    public MessageResponse forgotPassword(ForgotPasswordRequest request, String clientIp) {
        // 1. Normalize target email
        String normalizedEmail = request != null && request.getEmail() != null
                ? request.getEmail().trim().toLowerCase(Locale.ROOT)
                : "";

        // 2. Enforce IP rate limit and email rate limit atomically before any DB account lookup or email provider execution
        forgotPasswordRateLimiter.checkRateLimitAndRecord(clientIp, normalizedEmail);

        // 3. Prepare token in a short committed transaction (user row locked only during this preparation)
        Optional<PasswordResetTokenService.PreparedResetToken> preparedOpt =
                passwordResetTokenService.preparePasswordResetToken(normalizedEmail);

        if (preparedOpt.isEmpty()) {
            // Non-existent email or inactive account: return identical generic response
            return new MessageResponse(FORGOT_PASSWORD_GENERIC_MESSAGE);
        }

        PasswordResetTokenService.PreparedResetToken prepared = preparedOpt.get();

        // 4. Dispatch reset email outside database transaction and without holding user row lock
        try {
            emailService.sendPasswordResetEmail(
                    prepared.email(),
                    prepared.displayName(),
                    prepared.rawToken(),
                    prepared.expirationMinutes()
            );
        } catch (Exception e) {
            log.error("Failed to deliver password reset email: {}", e.getMessage());
            // Provider-failure policy: compensating transaction invalidates specifically this token
            passwordResetTokenService.invalidateFailedToken(prepared.tokenId());
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
        return passwordResetTokenService.hashToken(rawToken);
    }

    /**
     * Authenticates a user using a verified Google ID Token.
     * Rate limits by client IP and verifies the token outside database transactions.
     */
    public AuthResponse loginWithGoogle(GoogleLoginRequest request, String clientIp) {
        // 1. Rate limiting by Client IP (decoupled from password login limiter)
        googleAuthRateLimiter.checkLoginRateLimit(clientIp);

        // 2. Cryptographic signature and claim verification outside DB transaction/locks
        GoogleUserClaims claims = googleIdTokenVerifierService.verify(request.getIdToken());

        // 3. Orchestrate user lookup/creation and JWT issuance in transaction
        return orchestrateGoogleLogin(claims);
    }

    @Transactional
    public AuthResponse orchestrateGoogleLogin(GoogleUserClaims claims) {
        // 1. Check if identity already exists for Google provider and verified subject
        Optional<UserIdentity> identityOpt = userIdentityRepository.findByProviderAndProviderSubject(
                IdentityProvider.GOOGLE,
                claims.subject()
        );

        User user;
        if (identityOpt.isPresent()) {
            user = identityOpt.get().getUser();
            // Check account status: suspended or deactivated accounts are rejected
            validateAccountStatus(user);
            // Strict rule: preserve existing role (never modify role during login)
        } else {
            // First-time Google Sign-In: Identity does not exist
            // Strict rule: Never auto-link if email matches an existing account without explicit linking
            Optional<User> existingUserByEmail = userRepository.findByEmail(claims.email());
            if (existingUserByEmail.isPresent()) {
                log.warn("Google login rejected: an account with email '{}' already exists without linked Google identity", claims.email());
                throw new AccountLinkingRequiredException(
                        "An account with this email already exists. Please log in with your email and password first, then link your Google account in settings."
                );
            }

            // Create a new ShareLoop user strictly with role USER, status ACTIVE, and null passwordHash
            String displayName = claims.displayName() != null && !claims.displayName().isBlank()
                    ? claims.displayName().trim()
                    : claims.email();

            User newUser = new User(
                    displayName,
                    claims.email(),
                    null, // Google-only users have NULL password hash
                    UserRole.USER,
                    UserStatus.ACTIVE
            );

            try {
                user = userRepository.saveAndFlush(newUser);
                UserIdentity identity = new UserIdentity(
                        user,
                        IdentityProvider.GOOGLE,
                        claims.subject(),
                        claims.email()
                );
                userIdentityRepository.saveAndFlush(identity);
            } catch (DataIntegrityViolationException e) {
                log.warn("Concurrency conflict during first-time Google login for subject '{}': {}", claims.subject(), e.getMessage());
                // Handle potential concurrent first-time login race safely
                Optional<UserIdentity> concurrentIdentity = userIdentityRepository.findByProviderAndProviderSubject(
                        IdentityProvider.GOOGLE,
                        claims.subject()
                );
                if (concurrentIdentity.isPresent()) {
                    user = concurrentIdentity.get().getUser();
                    validateAccountStatus(user);
                } else {
                    throw new AccountLinkingRequiredException(
                            "An account with this email already exists. Please log in with your email and password first, then link your Google account in settings."
                    );
                }
            }
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

    /**
     * Explicitly links a verified Google account to the currently authenticated ShareLoop user.
     * Rate limits by User ID and verifies the token outside database transactions.
     */
    public GoogleAccountStatusResponse linkGoogleAccount(UUID currentUserId, GoogleLoginRequest request) {
        if (currentUserId == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }

        // 1. Abuse protection rate limit by authenticated User ID
        googleAuthRateLimiter.checkLinkRateLimit(currentUserId);

        // 2. Cryptographic signature and claim verification outside DB transaction
        GoogleUserClaims claims = googleIdTokenVerifierService.verify(request.getIdToken());

        // 3. Orchestrate linking in database transaction
        return orchestrateGoogleLink(currentUserId, claims);
    }

    @Transactional
    public GoogleAccountStatusResponse orchestrateGoogleLink(UUID currentUserId, GoogleUserClaims claims) {
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        validateAccountStatus(user);

        // Reject if current ShareLoop account already has a Google identity
        if (userIdentityRepository.existsByUserIdAndProvider(currentUserId, IdentityProvider.GOOGLE)) {
            throw new AccountAlreadyLinkedException("Your ShareLoop account is already linked to a Google account.");
        }

        // Reject if this Google subject is already linked to another ShareLoop account
        if (userIdentityRepository.existsByProviderAndProviderSubject(IdentityProvider.GOOGLE, claims.subject())) {
            throw new GoogleAccountAlreadyInUseException("This Google account is already linked to another ShareLoop account.");
        }

        UserIdentity identity = new UserIdentity(
                user,
                IdentityProvider.GOOGLE,
                claims.subject(),
                claims.email()
        );

        try {
            identity = userIdentityRepository.saveAndFlush(identity);
        } catch (DataIntegrityViolationException e) {
            log.warn("Database constraint conflict during Google account linking: {}", e.getMessage());
            throw new GoogleAccountAlreadyInUseException("This Google account is already linked to a ShareLoop account.");
        }

        return new GoogleAccountStatusResponse(
                true,
                "GOOGLE",
                identity.getProviderEmail(),
                identity.getCreatedAt()
        );
    }

    /**
     * Retrieves whether the authenticated user has a Google identity linked.
     */
    @Transactional(readOnly = true)
    public GoogleAccountStatusResponse getGoogleAccountStatus(UUID currentUserId) {
        if (currentUserId == null) {
            throw new InvalidTokenException("Authenticated principal not found");
        }

        return userIdentityRepository.findByUserIdAndProvider(currentUserId, IdentityProvider.GOOGLE)
                .map(identity -> new GoogleAccountStatusResponse(
                        true,
                        "GOOGLE",
                        identity.getProviderEmail(),
                        identity.getCreatedAt()
                ))
                .orElseGet(() -> new GoogleAccountStatusResponse(
                        false,
                        "GOOGLE",
                        null,
                        null
                ));
    }

    private void validateAccountStatus(User user) {
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new AccountSuspendedException("Your account has been suspended. Please contact support.");
        }
        if (user.getStatus() == UserStatus.DEACTIVATED) {
            throw new AccountDeactivatedException("Your account has been deactivated.");
        }
    }
}
