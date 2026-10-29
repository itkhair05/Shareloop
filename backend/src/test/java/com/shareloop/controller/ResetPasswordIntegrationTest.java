package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.ForgotPasswordRequest;
import com.shareloop.dto.auth.LoginRequest;
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
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ResetPasswordIntegrationTest {

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

    private User activeUser;
    private static final String INITIAL_PASSWORD = "OldPassword123!";
    private static final String NEW_PASSWORD = "BrandNewPassword456!";

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
                "Reset Target User",
                "reset.target." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode(INITIAL_PASSWORD),
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

    private String requestResetTokenAndGetRawToken(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(email))))
                .andExpect(status().isOk());

        MockEmailService.SentResetEmail sentEmail = mockEmailService.getLastSentEmail();
        assertThat(sentEmail).isNotNull();
        return sentEmail.resetToken();
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    @DisplayName("TC 1: Valid token changes password successfully and allows login with new password")
    void validTokenChangesPasswordAndAllowsLogin() throws Exception {
        String rawToken = requestResetTokenAndGetRawToken(activeUser.getEmail());

        ResetPasswordRequest resetRequest = new ResetPasswordRequest(rawToken, NEW_PASSWORD);
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(RESET_PASSWORD_SUCCESS_MESSAGE));

        // Token must be marked as used in the database
        PasswordResetToken tokenEntity = passwordResetTokenRepository.findByTokenHash(hashToken(rawToken)).orElseThrow();
        assertThat(tokenEntity.getUsedAt()).isNotNull();

        // 1. Login with NEW password must SUCCEED (200 OK)
        LoginRequest loginWithNewPassword = new LoginRequest(activeUser.getEmail(), NEW_PASSWORD);
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("10.88.1.1");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginWithNewPassword)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString());

        // 2. Login with OLD password must FAIL (401 Unauthorized)
        LoginRequest loginWithOldPassword = new LoginRequest(activeUser.getEmail(), INITIAL_PASSWORD);
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("10.88.1.2");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginWithOldPassword)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("TC 2: A second attempt using the same token fails (single-use enforced)")
    void secondAttemptUsingSameTokenFails() throws Exception {
        String rawToken = requestResetTokenAndGetRawToken(activeUser.getEmail());

        // First attempt succeeds
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isOk());

        // Second attempt with the same token must be rejected with 400
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(rawToken, "AnotherPassword789!"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value(INVALID_OR_EXPIRED_TOKEN_MESSAGE));
    }

    @Test
    @DisplayName("TC 3: Expired token is rejected with 400 and does not change password")
    void expiredTokenIsRejected() throws Exception {
        String rawToken = requestResetTokenAndGetRawToken(activeUser.getEmail());

        // Update token in DB to be expired
        PasswordResetToken tokenEntity = passwordResetTokenRepository.findByTokenHash(hashToken(rawToken)).orElseThrow();
        tokenEntity.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));
        passwordResetTokenRepository.saveAndFlush(tokenEntity);

        // Attempt reset with expired token
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(INVALID_OR_EXPIRED_TOKEN_MESSAGE));

        // Old password remains active
        User reloadedUser = userRepository.findById(activeUser.getId()).orElseThrow();
        assertThat(passwordEncoder.matches(INITIAL_PASSWORD, reloadedUser.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("TC 4: Invalid/fabricated token is rejected with 400")
    void invalidTokenIsRejected() throws Exception {
        String fabricatedToken = "fabricated-token-that-never-existed-in-db-12345";

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(fabricatedToken, NEW_PASSWORD))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(INVALID_OR_EXPIRED_TOKEN_MESSAGE));
    }

    @Test
    @DisplayName("TC 5: Two concurrent requests using the same token result in at most one successful reset")
    void concurrentRequestsUsingSameTokenResultInAtMostOneSuccess() throws Exception {
        String rawToken = requestResetTokenAndGetRawToken(activeUser.getEmail());

        int totalRequests = 2;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final int index = i;
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    ResetPasswordRequest req = new ResetPasswordRequest(rawToken, "ConcurrentPass" + index + "!");
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/auth/reset-password")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    int status = result.getResponse().getStatus();
                    if (status == 200) {
                        successCount.incrementAndGet();
                    } else if (status == 400) {
                        failureCount.incrementAndGet();
                    } else {
                        otherCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    otherCount.incrementAndGet();
                }
            }));
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        assertThat(otherCount.get()).isZero();
        assertThat(successCount.get()).as("Exactly one request must succeed").isEqualTo(1);
        assertThat(failureCount.get()).as("The losing concurrent request must receive 400").isEqualTo(1);
    }

    @Test
    @DisplayName("TC 6: Issuing a new token invalidates earlier token for the same user")
    void issuingNewTokenInvalidatesEarlierToken() throws Exception {
        // Request token 1
        String token1 = requestResetTokenAndGetRawToken(activeUser.getEmail());

        // Request token 2 for the same account
        String token2 = requestResetTokenAndGetRawToken(activeUser.getEmail());
        assertThat(token2).isNotEqualTo(token1);

        // Token 1 must now be invalidated in DB
        PasswordResetToken token1Entity = passwordResetTokenRepository.findByTokenHash(hashToken(token1)).orElseThrow();
        assertThat(token1Entity.getUsedAt()).isNotNull();

        // Attempting to reset using Token 1 must FAIL (400)
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(token1, NEW_PASSWORD))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(INVALID_OR_EXPIRED_TOKEN_MESSAGE));

        // Attempting to reset using Token 2 must SUCCEED (200)
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(token2, NEW_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(RESET_PASSWORD_SUCCESS_MESSAGE));
    }

    @Test
    @DisplayName("TC 7: Password validation failure (< 8 chars) does not consume valid token")
    void passwordValidationFailureDoesNotConsumeToken() throws Exception {
        String rawToken = requestResetTokenAndGetRawToken(activeUser.getEmail());

        // Submit password with length 5 (too short)
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(rawToken, "short"))))
                .andExpect(status().isBadRequest());

        // Token should still be unused in DB
        PasswordResetToken tokenEntity = passwordResetTokenRepository.findByTokenHash(hashToken(rawToken)).orElseThrow();
        assertThat(tokenEntity.getUsedAt()).isNull();

        // Re-submitting with valid password should succeed
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("TC 8: Suspended account token is rejected and cannot be used to bypass suspension")
    void suspendedAccountTokenCannotResetPassword() throws Exception {
        User suspendedUser = userRepository.saveAndFlush(new User(
                "Suspended Victim",
                "suspended.victim." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode(INITIAL_PASSWORD),
                UserRole.USER,
                UserStatus.ACTIVE // initially active to get token
        ));

        String rawToken = requestResetTokenAndGetRawToken(suspendedUser.getEmail());

        // Suspend the user before reset attempt
        suspendedUser.setStatus(UserStatus.SUSPENDED);
        userRepository.saveAndFlush(suspendedUser);

        // Reset attempt must be rejected with 400 generic error
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ResetPasswordRequest(rawToken, NEW_PASSWORD))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(INVALID_OR_EXPIRED_TOKEN_MESSAGE));
    }
}
