package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.RegisterRequest;
import com.shareloop.entity.LoginAttempt;
import com.shareloop.entity.User;
import com.shareloop.exception.RateLimitExceededException;
import com.shareloop.repository.LoginAttemptRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.ratelimit.RateLimitProperties;
import com.shareloop.security.ratelimit.RegistrationRateLimiter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RegistrationRateLimitIntegrationTest {

    private static final String CLIENT_IP = "203.0.113.40";
    private static final String REGISTRATION_KEY = "reg:" + CLIENT_IP;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RegistrationRateLimiter registrationRateLimiter;

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RateLimitProperties rateLimitProperties;

    private final List<String> createdEmails = new ArrayList<>();

    @BeforeEach
    void setUp() {
        loginAttemptRepository.deleteAll();
        rateLimitProperties.setRegistrationIpLimit(5);
        rateLimitProperties.setRegistrationWindowSeconds(3600);
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.DIRECT);
        rateLimitProperties.setTrustedProxies(Collections.emptyList());
    }

    @AfterEach
    void tearDown() {
        loginAttemptRepository.deleteAll();
        for (String email : createdEmails) {
            userRepository.findByEmail(email).ifPresent(userRepository::delete);
        }
        createdEmails.clear();
        rateLimitProperties.setRegistrationIpLimit(5);
        rateLimitProperties.setRegistrationWindowSeconds(3600);
    }

    @Test
    @DisplayName("Allows registrations up to the configured IP limit")
    void allowsUpToLimit() {
        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> registrationRateLimiter.checkAndRecordAttempt(CLIENT_IP))
                    .doesNotThrowAnyException();
        }

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(
                REGISTRATION_KEY, Instant.now().minus(2, ChronoUnit.HOURS)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("Rejects the request at the boundary without recording another attempt")
    void rejectsAtBoundaryWithoutRecording() {
        seedAttempts(REGISTRATION_KEY, 5);

        assertThatThrownBy(() -> registrationRateLimiter.checkAndRecordAttempt(CLIENT_IP))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(RegistrationRateLimiter.RATE_LIMIT_MESSAGE);

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(
                REGISTRATION_KEY, Instant.now().minus(2, ChronoUnit.HOURS)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("Quota is isolated per client IP")
    void quotaIsolatedPerIp() {
        seedAttempts(REGISTRATION_KEY, 5);

        assertThatCode(() -> registrationRateLimiter.checkAndRecordAttempt("203.0.113.41"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Registration attempts do not consume the login IP bucket")
    void registrationDoesNotConsumeLoginBucket() {
        seedAttempts(REGISTRATION_KEY, 5);

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(
                CLIENT_IP, Instant.now().minus(2, ChronoUnit.HOURS)))
                .isZero();
    }

    @Test
    @DisplayName("Attempts outside the rolling window do not consume the quota")
    void expiredAttemptsDoNotConsumeQuota() {
        Instant expired = Instant.now().minus(2, ChronoUnit.HOURS);
        for (int i = 0; i < 5; i++) {
            loginAttemptRepository.save(new LoginAttempt(REGISTRATION_KEY, expired.minusSeconds(i)));
        }
        loginAttemptRepository.flush();

        assertThatCode(() -> registrationRateLimiter.checkAndRecordAttempt(CLIENT_IP))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Concurrent registrations from one IP cannot exceed the limit")
    void concurrentRegistrationsCannotExceedLimit() throws Exception {
        int totalRequests = 10;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger throttledCount = new AtomicInteger();
        AtomicInteger otherCount = new AtomicInteger();
        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);
                    registrationRateLimiter.checkAndRecordAttempt(CLIENT_IP);
                    successCount.incrementAndGet();
                } catch (RateLimitExceededException e) {
                    throttledCount.incrementAndGet();
                } catch (Exception e) {
                    otherCount.incrementAndGet();
                }
            }));
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        assertThat(otherCount.get()).as("Unexpected failures").isZero();
        assertThat(successCount.get()).as("Exactly 5 registrations must be allowed").isEqualTo(5);
        assertThat(throttledCount.get()).as("Exactly 5 must be throttled").isEqualTo(5);
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(
                REGISTRATION_KEY, Instant.now().minus(2, ChronoUnit.HOURS)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("HTTP registration returns 429 with the Vietnamese message and creates no user")
    void httpRegistrationReturns429() throws Exception {
        seedAttempts(REGISTRATION_KEY, 5);
        String email = "throttled." + UUID.randomUUID() + "@example.com";

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(request -> {
                            request.setRemoteAddr(CLIENT_IP);
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterRequest("Throttled User", email, "Password123!"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value(RegistrationRateLimiter.RATE_LIMIT_MESSAGE));

        assertThat(userRepository.findByEmail(email)).isEmpty();
    }

    @Test
    @DisplayName("A legitimate registration under the limit still succeeds")
    void legitimateRegistrationSucceeds() throws Exception {
        String email = "legit." + UUID.randomUUID() + "@example.com";
        createdEmails.add(email);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(request -> {
                            request.setRemoteAddr("203.0.113.42");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterRequest("Legit User", email, "Password123!"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email));

        assertThat(userRepository.findByEmail(email)).isPresent();
    }

    private void seedAttempts(String key, int count) {
        Instant now = Instant.now();
        for (int i = 0; i < count; i++) {
            loginAttemptRepository.save(new LoginAttempt(key, now.minusSeconds(i + 1)));
        }
        loginAttemptRepository.flush();
    }
}
