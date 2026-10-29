package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.ForgotPasswordRequest;
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

import java.util.ArrayList;
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
class ForgotPasswordIntegrationTest {

    private static final String GENERIC_FORGOT_PASSWORD_MESSAGE =
            "Nếu email của bạn tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.";
    private static final String RATE_LIMIT_MESSAGE =
            "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau.";

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
    private User suspendedUser;
    private User deactivatedUser;

    @BeforeEach
    void setUp() {
        mockEmailService.clear();
        passwordResetTokenRepository.deleteAll();
        forgotPasswordAttemptRepository.deleteAll();
        userRepository.deleteAll();

        rateLimitProperties.setForgotPasswordIpLimit(5);
        rateLimitProperties.setForgotPasswordEmailLimit(3);
        rateLimitProperties.setForgotPasswordWindowSeconds(900);

        activeUser = userRepository.saveAndFlush(new User(
                "Active User",
                "active.forgot." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        suspendedUser = userRepository.saveAndFlush(new User(
                "Suspended User",
                "suspended.forgot." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.SUSPENDED
        ));

        deactivatedUser = userRepository.saveAndFlush(new User(
                "Deactivated User",
                "deactivated.forgot." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.DEACTIVATED
        ));
    }

    @AfterEach
    void tearDown() {
        mockEmailService.clear();
        passwordResetTokenRepository.deleteAll();
        forgotPasswordAttemptRepository.deleteAll();
        userRepository.deleteAll();

        rateLimitProperties.setForgotPasswordIpLimit(5);
        rateLimitProperties.setForgotPasswordEmailLimit(3);
        rateLimitProperties.setForgotPasswordWindowSeconds(900);
    }

    @Test
    @DisplayName("TC 1: Existing active email returns generic 200 response and dispatches email via mock service")
    void existingActiveEmailReturns200AndSendsEmail() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest(activeUser.getEmail());

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        assertThat(mockEmailService.getSentEmails()).hasSize(1);
        MockEmailService.SentResetEmail sentEmail = mockEmailService.getLastSentEmail();
        assertThat(sentEmail.toEmail()).isEqualTo(activeUser.getEmail());
        assertThat(sentEmail.resetToken()).isNotBlank();
        assertThat(sentEmail.resetUrl()).contains("token=" + sentEmail.resetToken());

        assertThat(passwordResetTokenRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("TC 2: Non-existent email returns identical generic 200 response and does not issue token or send email")
    void nonExistentEmailReturnsGeneric200AndDoesNotSendEmail() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("nonexistent." + UUID.randomUUID() + "@example.com");

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        assertThat(mockEmailService.getSentEmails()).isEmpty();
        assertThat(passwordResetTokenRepository.count()).isZero();
    }

    @Test
    @DisplayName("TC 3: Suspended or deactivated account returns identical generic 200 without leaking account status")
    void suspendedOrDeactivatedAccountReturnsGeneric200WithoutEmail() throws Exception {
        ForgotPasswordRequest suspendedRequest = new ForgotPasswordRequest(suspendedUser.getEmail());
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(suspendedRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        ForgotPasswordRequest deactivatedRequest = new ForgotPasswordRequest(deactivatedUser.getEmail());
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(deactivatedRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        // Neither suspended nor deactivated accounts receive reset tokens or emails
        assertThat(mockEmailService.getSentEmails()).isEmpty();
        assertThat(passwordResetTokenRepository.count()).isZero();
    }

    @Test
    @DisplayName("TC 4: Per-email rate limit enforces threshold (3 attempts succeed, 4th receives 429)")
    void perEmailRateLimitEnforced() throws Exception {
        // Use different client IPs to isolate email rate limit from IP rate limit
        for (int i = 1; i <= 3; i++) {
            final String ip = "10.0.1." + i;
            mockMvc.perform(post("/api/v1/auth/forgot-password")
                            .with(req -> {
                                req.setRemoteAddr(ip);
                                return req;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(activeUser.getEmail()))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));
        }

        // 4th attempt targeting the same email from a distinct IP -> throttled with 429
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .with(req -> {
                            req.setRemoteAddr("10.0.1.4");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(activeUser.getEmail()))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));
    }

    @Test
    @DisplayName("TC 5: IP rate limit enforces threshold (5 attempts succeed, 6th receives 429)")
    void ipRateLimitEnforced() throws Exception {
        String fixedIp = "192.168.10.99";

        // 5 requests targeting different emails from the same IP
        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/v1/auth/forgot-password")
                            .with(req -> {
                                req.setRemoteAddr(fixedIp);
                                return req;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ForgotPasswordRequest("user." + i + "@example.com"))))
                    .andExpect(status().isOk());
        }

        // 6th attempt from the same IP -> throttled with 429
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .with(req -> {
                            req.setRemoteAddr(fixedIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest("user.6@example.com"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));
    }

    @Test
    @DisplayName("TC 6: Concurrent requests from same IP cannot bypass rate limit")
    void concurrentRequestsFromSameIpCannotBypassRateLimit() throws Exception {
        int totalRequests = 10;
        String concurrentIp = "172.16.50.20";
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger throttledCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final int index = i;
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    ForgotPasswordRequest req = new ForgotPasswordRequest("user.concurrent." + index + "@example.com");
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/auth/forgot-password")
                                    .with(r -> {
                                        r.setRemoteAddr(concurrentIp);
                                        return r;
                                    })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    int statusCode = result.getResponse().getStatus();
                    if (statusCode == 200) {
                        successCount.incrementAndGet();
                    } else if (statusCode == 429) {
                        throttledCount.incrementAndGet();
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
        assertThat(successCount.get()).as("At most 5 requests must succeed").isEqualTo(5);
        assertThat(throttledCount.get()).as("Remaining 5 requests must be throttled").isEqualTo(5);
    }

    @Test
    @DisplayName("TC 7: Email provider failure policy: returns generic 200 without leaking error and invalidates created token")
    void emailProviderFailureReturnsGeneric200AndInvalidatesToken() throws Exception {
        mockEmailService.setShouldFail(true);

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ForgotPasswordRequest(activeUser.getEmail()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(GENERIC_FORGOT_PASSWORD_MESSAGE));

        // The token created for this attempt must have been invalidated (usedAt is not null)
        assertThat(passwordResetTokenRepository.findAll())
                .allMatch(token -> token.getUsedAt() != null);
    }

    @Test
    @DisplayName("TC 8: Concurrent requests from distinct IPs targeting the same email cannot exceed email quota")
    void concurrentRequestsFromDistinctIpsTargetingSameEmailCannotExceedEmailQuota() throws Exception {
        int totalRequests = 10;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger throttledCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final String distinctIp = "10.50.1." + (i + 1);
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    ForgotPasswordRequest req = new ForgotPasswordRequest(activeUser.getEmail());
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/auth/forgot-password")
                                    .with(r -> {
                                        r.setRemoteAddr(distinctIp);
                                        return r;
                                    })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    int statusCode = result.getResponse().getStatus();
                    if (statusCode == 200) {
                        successCount.incrementAndGet();
                    } else if (statusCode == 429) {
                        throttledCount.incrementAndGet();
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
        assertThat(successCount.get()).as("Exactly 3 requests targeting the same email must succeed").isEqualTo(3);
        assertThat(throttledCount.get()).as("Remaining 7 requests must receive HTTP 429").isEqualTo(7);
    }

    @Test
    @DisplayName("TC 9: Concurrent token issuance requests for the same account leave at most one usable reset token")
    void concurrentIssuanceRequestsForSameAccountLeaveAtMostOneUsableToken() throws Exception {
        // Set higher rate limits for this test to focus strictly on issuance concurrency and user-row locking
        rateLimitProperties.setForgotPasswordIpLimit(20);
        rateLimitProperties.setForgotPasswordEmailLimit(20);

        int totalRequests = 5;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final String ip = "10.60.1." + (i + 1);
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    ForgotPasswordRequest req = new ForgotPasswordRequest(activeUser.getEmail());
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/auth/forgot-password")
                                    .with(r -> {
                                        r.setRemoteAddr(ip);
                                        return r;
                                    })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    int statusCode = result.getResponse().getStatus();
                    if (statusCode == 200) {
                        successCount.incrementAndGet();
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
        assertThat(successCount.get()).isEqualTo(totalRequests);

        // Verify tokens in DB: exactly 1 token remains usable (usedAt is null and not expired)
        List<com.shareloop.entity.PasswordResetToken> allTokens = passwordResetTokenRepository.findAll();
        assertThat(allTokens).hasSize(totalRequests);

        List<com.shareloop.entity.PasswordResetToken> usableTokens = allTokens.stream()
                .filter(t -> t.getUsedAt() == null && t.getExpiresAt().isAfter(java.time.Instant.now()))
                .toList();

        assertThat(usableTokens).as("At most 1 token can remain usable after concurrent issuances").hasSize(1);
    }
}
