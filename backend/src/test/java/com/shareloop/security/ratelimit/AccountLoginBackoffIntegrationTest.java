package com.shareloop.security.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.entity.LoginAttempt;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.LoginAttemptRepository;
import com.shareloop.repository.UserRepository;
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
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountLoginBackoffIntegrationTest {

    private static final String PASSWORD = "Password123!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountLoginBackoffService backoffService;

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RateLimitProperties rateLimitProperties;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private final List<String> createdEmails = new ArrayList<>();

    @BeforeEach
    void setUp() {
        loginAttemptRepository.deleteAll();
        rateLimitProperties.setAccountBackoffEnabled(true);
        rateLimitProperties.setAccountFailureLimit(5);
        rateLimitProperties.setAccountWindowSeconds(900);
        rateLimitProperties.setAccountBackoffBaseSeconds(30);
        rateLimitProperties.setAccountBackoffMaxSeconds(900);
        rateLimitProperties.setClientIpMode(RateLimitProperties.ClientIpMode.DIRECT);
        rateLimitProperties.setTrustedProxies(List.of());
    }

    @AfterEach
    void tearDown() {
        transactionTemplate.executeWithoutResult(status -> {
            for (String email : createdEmails) {
                loginAttemptRepository.deleteByIpAddress(accountKey(email));
                userRepository.findByEmail(email).ifPresent(userRepository::delete);
            }
            loginAttemptRepository.deleteAll();
        });
        createdEmails.clear();
        rateLimitProperties.setAccountBackoffEnabled(true);
        rateLimitProperties.setAccountFailureLimit(5);
        rateLimitProperties.setAccountWindowSeconds(900);
        rateLimitProperties.setAccountBackoffBaseSeconds(30);
        rateLimitProperties.setAccountBackoffMaxSeconds(900);
    }

    private String accountKey(String email) {
        return AccountLoginBackoffService.accountKey(email, rateLimitProperties.getForgotPasswordSecret());
    }

    private long failureCount(String email) {
        return loginAttemptRepository.countByIpAddressAndCreatedAtAfter(
                accountKey(email), Instant.now().minusSeconds(900));
    }

    private void seedFailures(String email, int count) {
        Instant now = Instant.now();
        for (int i = 0; i < count; i++) {
            loginAttemptRepository.save(new LoginAttempt(accountKey(email), now.minusSeconds(i + 1)));
        }
        loginAttemptRepository.flush();
    }

    private User createUser() {
        String email = "backoff." + UUID.randomUUID() + "@example.com";
        User user = userRepository.saveAndFlush(new User(
                "Backoff User", email, passwordEncoder.encode(PASSWORD), UserRole.USER, UserStatus.ACTIVE));
        createdEmails.add(email);
        return user;
    }

    @Test
    @DisplayName("Progressive backoff starts on the sixth consecutive failure")
    void progressiveBackoffStartsOnSixthFailure() {
        String email = "unknown." + UUID.randomUUID() + "@example.com";
        createdEmails.add(email);

        int[] delays = new int[6];
        for (int i = 0; i < 6; i++) {
            delays[i] = backoffService.recordFailure(email);
        }

        assertThat(delays).containsExactly(0, 0, 0, 0, 0, 30);
        assertThat(failureCount(email)).isEqualTo(6);
        assertThat(backoffService.recordFailure(email)).isEqualTo(60);
    }

    @Test
    @DisplayName("Successful authentication clears the account failure state")
    void successfulLoginClearsFailures() throws Exception {
        User user = createUser();
        seedFailures(user.getEmail(), 4);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("203.0.113.60");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(user.getEmail(), PASSWORD))))
                .andExpect(status().isOk());

        assertThat(failureCount(user.getEmail())).isZero();
    }

    @Test
    @DisplayName("Account backoff never blocks a correct password")
    void backoffNeverBlocksCorrectPassword() throws Exception {
        User user = createUser();
        seedFailures(user.getEmail(), 10);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("203.0.113.61");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(user.getEmail(), PASSWORD))))
                .andExpect(status().isOk());

        assertThat(failureCount(user.getEmail())).isZero();
    }

    @Test
    @DisplayName("Known and unknown emails receive the same backoff response")
    void knownAndUnknownEmailsReceiveSameResponse() throws Exception {
        User user = createUser();
        String unknown = "missing." + UUID.randomUUID() + "@example.com";
        createdEmails.add(unknown);
        seedFailures(user.getEmail(), 5);
        seedFailures(unknown, 5);

        MvcResult known = mockMvc.perform(post("/api/v1/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("203.0.113.62");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(user.getEmail(), "WrongPassword1!"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "30"))
                .andExpect(jsonPath("$.message").value(AccountLoginBackoffService.BACKOFF_MESSAGE))
                .andReturn();

        MvcResult missing = mockMvc.perform(post("/api/v1/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("203.0.113.63");
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(unknown, "WrongPassword1!"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "30"))
                .andExpect(jsonPath("$.message").value(AccountLoginBackoffService.BACKOFF_MESSAGE))
                .andReturn();

        assertThat(known.getResponse().getContentAsString())
                .doesNotContain(user.getEmail())
                .doesNotContain(unknown);
        assertThat(missing.getResponse().getContentAsString())
                .doesNotContain(user.getEmail())
                .doesNotContain(unknown);
    }

    @Test
    @DisplayName("Failures for different accounts are isolated")
    void failuresAreIsolatedPerAccount() {
        String first = "first." + UUID.randomUUID() + "@example.com";
        String second = "second." + UUID.randomUUID() + "@example.com";
        createdEmails.add(first);
        createdEmails.add(second);
        seedFailures(first, 5);

        assertThat(backoffService.recordFailure(second)).isZero();
        assertThat(failureCount(first)).isEqualTo(5);
        assertThat(failureCount(second)).isEqualTo(1);
    }

    @Test
    @DisplayName("Success clears only its own account state")
    void successClearsOnlyOwnState() {
        String first = "first." + UUID.randomUUID() + "@example.com";
        String second = "second." + UUID.randomUUID() + "@example.com";
        createdEmails.add(first);
        createdEmails.add(second);
        seedFailures(first, 5);
        seedFailures(second, 5);

        backoffService.recordSuccess(first);

        assertThat(failureCount(first)).isZero();
        assertThat(failureCount(second)).isEqualTo(5);
    }

    @Test
    @DisplayName("Concurrent failures are serialized and all persisted")
    void concurrentFailuresAreSerialized() throws Exception {
        String email = "concurrent." + UUID.randomUUID() + "@example.com";
        createdEmails.add(email);
        int totalRequests = 10;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);
        AtomicInteger throttledCount = new AtomicInteger();
        AtomicInteger otherCount = new AtomicInteger();
        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);
                    if (backoffService.recordFailure(email) > 0) {
                        throttledCount.incrementAndGet();
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
        assertThat(failureCount(email)).isEqualTo(10);
        assertThat(throttledCount.get())
                .as("Failures 6 through 10 back off")
                .isEqualTo(5);
    }

    @Test
    @DisplayName("Disabled backoff preserves existing rows and returns no delay")
    void disabledBackoffReturnsNoDelay() {
        String email = "disabled." + UUID.randomUUID() + "@example.com";
        createdEmails.add(email);
        seedFailures(email, 10);
        rateLimitProperties.setAccountBackoffEnabled(false);

        assertThat(backoffService.recordFailure(email)).isZero();
        assertThat(failureCount(email)).isEqualTo(10);
    }
}
