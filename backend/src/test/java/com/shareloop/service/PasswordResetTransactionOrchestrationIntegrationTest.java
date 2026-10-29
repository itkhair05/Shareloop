package com.shareloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.ForgotPasswordRequest;
import com.shareloop.dto.auth.ResetPasswordRequest;
import com.shareloop.entity.PasswordResetToken;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.ForgotPasswordAttemptRepository;
import com.shareloop.repository.PasswordResetTokenRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.service.mail.MockEmailService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetTransactionOrchestrationIntegrationTest {

    private static final String GENERIC_FORGOT_PASSWORD_MESSAGE =
            "Nếu email của bạn tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.";
    private static final String RESET_PASSWORD_SUCCESS_MESSAGE =
            "Mật khẩu của bạn đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới.";
    private static final String INVALID_OR_EXPIRED_TOKEN_MESSAGE =
            "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private ForgotPasswordAttemptRepository forgotPasswordAttemptRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MockEmailService mockEmailService;

    @Autowired
    private RateLimitProperties rateLimitProperties;

    @Autowired
    private PasswordResetTokenService passwordResetTokenService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User activeUser;

    @BeforeEach
    void setUp() {
        mockEmailService.clear();
        passwordResetTokenRepository.deleteAll();
        forgotPasswordAttemptRepository.deleteAll();
        userRepository.deleteAll();

        rateLimitProperties.setForgotPasswordIpLimit(10);
        rateLimitProperties.setForgotPasswordEmailLimit(10);
        rateLimitProperties.setForgotPasswordWindowSeconds(900);

        activeUser = userRepository.saveAndFlush(new User(
                "Orchestration Test User",
                "orchestration." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("InitialPassword123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
    }

    @AfterEach
    void tearDown() {
        mockEmailService.clear();
        passwordResetTokenRepository.deleteAll();
        forgotPasswordAttemptRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("F-01: Token preparation commits to database before external email provider is called")
    void tokenPreparationCommitsBeforeEmailProviderCall() throws Exception {
        AtomicBoolean tokenFoundDuringEmailSend = new AtomicBoolean(false);
        CountDownLatch callbackEnteredLatch = new CountDownLatch(1);

        mockEmailService.setOnBeforeSendCallback(email -> {
            // Verify in a separate transaction that the reset token is already committed in the DB
            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            tt.execute(status -> {
                List<PasswordResetToken> tokens = passwordResetTokenRepository.findAll();
                if (!tokens.isEmpty() && tokens.get(0).getUsedAt() == null) {
                    tokenFoundDuringEmailSend.set(true);
                }
                return null;
            });
            callbackEnteredLatch.countDown();
        });

        ForgotPasswordRequest request = new ForgotPasswordRequest(activeUser.getEmail());
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        assertThat(callbackEnteredLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(tokenFoundDuringEmailSend.get())
                .as("Reset token must be committed in database before email provider is called")
                .isTrue();
    }

    @Test
    @DisplayName("F-01: No user-row lock is held while waiting for external email provider")
    void noUserRowLockHeldDuringEmailRequest() throws Exception {
        CountDownLatch inEmailProviderLatch = new CountDownLatch(1);
        CountDownLatch finishEmailProviderLatch = new CountDownLatch(1);
        AtomicBoolean concurrentLockAcquired = new AtomicBoolean(false);

        mockEmailService.setOnBeforeSendCallback(email -> {
            inEmailProviderLatch.countDown();
            try {
                // Simulate slow external network I/O
                finishEmailProviderLatch.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        // Launch forgot password in background thread
        CompletableFuture<Void> forgotPasswordFuture = CompletableFuture.runAsync(() -> {
            try {
                ForgotPasswordRequest request = new ForgotPasswordRequest(activeUser.getEmail());
                mockMvc.perform(post("/api/v1/auth/forgot-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                        .andExpect(status().isOk());
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        // Wait until execution enters mock email provider
        assertThat(inEmailProviderLatch.await(5, TimeUnit.SECONDS)).isTrue();

        // While email provider is executing, another thread acquires user-row lock immediately
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        CompletableFuture<Void> lockCheckFuture = CompletableFuture.runAsync(() -> {
            tt.execute(status -> {
                Optional<User> lockedUser = userRepository.findByIdForUpdate(activeUser.getId());
                if (lockedUser.isPresent()) {
                    concurrentLockAcquired.set(true);
                }
                return null;
            });
        });

        // The lock check must succeed immediately without blocking on the email provider
        lockCheckFuture.get(2, TimeUnit.SECONDS);
        assertThat(concurrentLockAcquired.get())
                .as("User row lock must NOT be held while external email provider is running")
                .isTrue();

        // Allow email provider to complete
        finishEmailProviderLatch.countDown();
        forgotPasswordFuture.get(5, TimeUnit.SECONDS);
    }

    @Test
    @DisplayName("F-01: Provider failure invalidates only the newly created token via compensating transaction")
    void providerFailureInvalidatesOnlyNewlyCreatedToken() throws Exception {
        mockEmailService.setShouldFail(true);

        ForgotPasswordRequest request = new ForgotPasswordRequest(activeUser.getEmail());
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        // Token was created, but compensating transaction marked it as used
        List<PasswordResetToken> tokens = passwordResetTokenRepository.findAll();
        assertThat(tokens).hasSize(1);
        PasswordResetToken failedToken = tokens.get(0);
        assertThat(failedToken.isUsed()).isTrue();
        assertThat(failedToken.getUsedAt()).isNotNull();

        // Attempting to consume this token fails
        ResetPasswordRequest resetReq = new ResetPasswordRequest("any-raw-token", "NewPassword123!");
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(INVALID_OR_EXPIRED_TOKEN_MESSAGE));
    }

    @Test
    @DisplayName("F-01: A subsequent request's token is not invalidated by an earlier request's delivery failure")
    void subsequentRequestTokenNotInvalidatedByEarlierDeliveryFailure() throws Exception {
        // Request 1: fails delivery
        mockEmailService.setShouldFail(true);
        ForgotPasswordRequest req1 = new ForgotPasswordRequest(activeUser.getEmail());
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .with(r -> { r.setRemoteAddr("10.70.1.1"); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isOk());

        List<PasswordResetToken> tokensAfterFirst = passwordResetTokenRepository.findAll();
        assertThat(tokensAfterFirst).hasSize(1);
        assertThat(tokensAfterFirst.get(0).isUsed()).isTrue();

        // Request 2: succeeds delivery
        mockEmailService.setShouldFail(false);
        ForgotPasswordRequest req2 = new ForgotPasswordRequest(activeUser.getEmail());
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .with(r -> { r.setRemoteAddr("10.70.1.2"); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isOk());

        List<PasswordResetToken> tokensAfterSecond = passwordResetTokenRepository.findAll();
        assertThat(tokensAfterSecond).hasSize(2);

        // Find the second token
        PasswordResetToken secondToken = tokensAfterSecond.stream()
                .filter(t -> !t.getId().equals(tokensAfterFirst.get(0).getId()))
                .findFirst()
                .orElseThrow();

        assertThat(secondToken.isUsed()).isFalse();
        assertThat(secondToken.getUsedAt()).isNull();

        // The second token can be consumed successfully
        MockEmailService.SentResetEmail lastSent = mockEmailService.getLastSentEmail();
        assertThat(lastSent).isNotNull();

        ResetPasswordRequest resetReq = new ResetPasswordRequest(lastSent.resetToken(), "BrandNewPassword123!");
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(RESET_PASSWORD_SUCCESS_MESSAGE));
    }

    @Test
    @DisplayName("F-01: Compensating transaction invalidates specifically target tokenId without touching subsequent token")
    void compensatingTransactionInvalidatesSpecificallyTargetTokenId() {
        Optional<PasswordResetTokenService.PreparedResetToken> prepared1 =
                passwordResetTokenService.preparePasswordResetToken(activeUser.getEmail());
        assertThat(prepared1).isPresent();

        Optional<PasswordResetTokenService.PreparedResetToken> prepared2 =
                passwordResetTokenService.preparePasswordResetToken(activeUser.getEmail());
        assertThat(prepared2).isPresent();

        // Token 1 was invalidated by token 2 preparation
        PasswordResetToken t1 = passwordResetTokenRepository.findById(prepared1.get().tokenId()).orElseThrow();
        assertThat(t1.isUsed()).isTrue();

        // Token 2 is currently active
        PasswordResetToken t2Before = passwordResetTokenRepository.findById(prepared2.get().tokenId()).orElseThrow();
        assertThat(t2Before.isUsed()).isFalse();

        // If delivery failure handler runs for token 1, it must not invalidate token 2
        passwordResetTokenService.invalidateFailedToken(prepared1.get().tokenId());

        PasswordResetToken t2After = passwordResetTokenRepository.findById(prepared2.get().tokenId()).orElseThrow();
        assertThat(t2After.isUsed()).as("Token 2 must remain valid when token 1 failure is handled").isFalse();
    }
}
