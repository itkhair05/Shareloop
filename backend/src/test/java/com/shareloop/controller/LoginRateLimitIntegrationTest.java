package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.entity.LoginAttempt;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.LoginAttemptRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.ratelimit.LoginAttemptCleanupService;
import com.shareloop.security.ratelimit.LoginRateLimiter;
import com.shareloop.security.ratelimit.RateLimitProperties;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoginRateLimitIntegrationTest {

    private static final String RATE_LIMIT_MESSAGE = "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 1 phút.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RateLimitProperties rateLimitProperties;

    @Autowired
    private LoginAttemptCleanupService cleanupService;

    private User normalUser;
    private User adminUser;

    @BeforeEach
    void setUp() {
        loginAttemptRepository.deleteAll();

        normalUser = userRepository.saveAndFlush(new User(
                "Normal User",
                "normal." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminUser = userRepository.saveAndFlush(new User(
                "Admin User",
                "admin." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        rateLimitProperties.setTrustedProxies(Collections.emptyList());
    }

    @AfterEach
    void tearDown() {
        loginAttemptRepository.deleteAll();
        if (normalUser != null && normalUser.getId() != null) {
            userRepository.deleteById(normalUser.getId());
        }
        if (adminUser != null && adminUser.getId() != null) {
            userRepository.deleteById(adminUser.getId());
        }
        rateLimitProperties.setTrustedProxies(Collections.emptyList());
    }

    private LoginRequest buildValidLogin(User user) {
        return new LoginRequest(user.getEmail(), "Password123!");
    }

    private LoginRequest buildWrongPasswordLogin(User user) {
        return new LoginRequest(user.getEmail(), "WrongPassword999!");
    }

    @Test
    @DisplayName("TC 1: The first login request is permitted by the limiter")
    void firstLoginRequestPermitted() throws Exception {
        LoginRequest request = buildValidLogin(normalUser);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("192.168.1.1");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(normalUser.getEmail()));

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter("192.168.1.1", Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 2: Exactly 5 requests from the same IP are permitted")
    void fiveRequestsFromSameIpPermitted() throws Exception {
        String clientIp = "192.168.1.2";
        LoginRequest request = buildValidLogin(normalUser);

        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .with(req -> {
                                req.setRemoteAddr(clientIp);
                                return req;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("TC 3: The 6th request within the rolling minute receives HTTP 429 with exact Vietnamese message")
    void sixthRequestReceives429WithVietnameseMessage() throws Exception {
        String clientIp = "192.168.1.3";
        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) {
            loginAttemptRepository.save(new LoginAttempt(clientIp, now.minus(i + 1, ChronoUnit.SECONDS)));
        }
        loginAttemptRepository.flush();

        LoginRequest request = buildValidLogin(normalUser);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE))
                .andExpect(jsonPath("$.path").value("/api/v1/auth/login"));

        // Confirm attempts count remains 5 (rejected request was not saved as a 6th attempt)
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, now.minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("TC 4: Attempts outside the rolling 1-minute window do not consume current quota")
    void attemptsOutsideRollingMinuteDoNotConsumeQuota() throws Exception {
        String clientIp = "192.168.1.4";
        Instant expiredTime = Instant.now().minus(65, ChronoUnit.SECONDS);
        for (int i = 0; i < 5; i++) {
            loginAttemptRepository.save(new LoginAttempt(clientIp, expiredTime.minus(i, ChronoUnit.SECONDS)));
        }
        loginAttemptRepository.flush();

        LoginRequest request = buildValidLogin(normalUser);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // In active 1-min window, there is now exactly 1 attempt
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 5 & 14: Both successful and failed authentication requests consume quota and persist")
    void successfulAndFailedRequestsConsumeQuotaAndPersist() throws Exception {
        String clientIp = "192.168.1.5";

        // 1. Successful login
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildValidLogin(normalUser))))
                .andExpect(status().isOk());

        // 2. Failed login (wrong password -> 401)
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildWrongPasswordLogin(normalUser))))
                .andExpect(status().isUnauthorized());

        // 3. Failed login (nonexistent email -> 401)
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("ghost@example.com", "Password123!"))))
                .andExpect(status().isUnauthorized());

        // All 3 attempts must be committed in the database
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(3);
    }

    @Test
    @DisplayName("TC 6: A rate-limited request does not trigger user lookup or BCrypt verification")
    void rateLimitedRequestDoesNotTriggerUserLookupOrBcrypt() throws Exception {
        String clientIp = "192.168.1.6";
        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) {
            loginAttemptRepository.save(new LoginAttempt(clientIp, now.minus(i + 1, ChronoUnit.SECONDS)));
        }
        loginAttemptRepository.flush();

        // Send a request with completely invalid credentials
        // If user lookup/BCrypt were evaluated first, it would return 401 Unauthorized
        // Because rate limit is evaluated before user lookup, it returns 429 Too Many Requests
        LoginRequest request = new LoginRequest("definitely_not_existing@example.com", "InvalidPass123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));
    }

    @Test
    @DisplayName("TC 7: Admin login receives no rate limit exemption")
    void adminLoginReceivesNoExemption() throws Exception {
        String clientIp = "192.168.1.7";
        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) {
            loginAttemptRepository.save(new LoginAttempt(clientIp, now.minus(i + 1, ChronoUnit.SECONDS)));
        }
        loginAttemptRepository.flush();

        // Admin attempt on 6th request must still receive 429
        LoginRequest adminRequest = buildValidLogin(adminUser);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(adminRequest)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));
    }

    @Test
    @DisplayName("TC 8: Two different client IPs have independent quotas")
    void differentIpsHaveIndependentQuotas() throws Exception {
        String ipA = "192.168.1.8";
        String ipB = "192.168.1.9";

        Instant now = Instant.now();
        for (int i = 0; i < 5; i++) {
            loginAttemptRepository.save(new LoginAttempt(ipA, now.minus(i + 1, ChronoUnit.SECONDS)));
        }
        loginAttemptRepository.flush();

        // IP A is throttled
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(ipA);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildValidLogin(normalUser))))
                .andExpect(status().isTooManyRequests());

        // IP B can successfully log in
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(ipB);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildValidLogin(normalUser))))
                .andExpect(status().isOk());

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(ipB, now.minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 9: Concurrent requests from the same IP cannot exceed the limit")
    void concurrentRequestsFromSameIpCannotExceedLimit() throws Exception {
        String clientIp = "192.168.1.10";
        int totalRequests = 10;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger throttledCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    LoginRequest req = buildValidLogin(normalUser);
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                                    .with(r -> {
                                        r.setRemoteAddr(clientIp);
                                        return r;
                                    })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    int status = result.getResponse().getStatus();
                    if (status == 200) {
                        successCount.incrementAndGet();
                    } else if (status == 429) {
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

        assertThat(otherCount.get()).as("Unexpected status codes").isZero();
        assertThat(successCount.get()).as("Exactly 5 requests must succeed").isEqualTo(5);
        assertThat(throttledCount.get()).as("Exactly 5 requests must receive 429").isEqualTo(5);

        // Verify exactly 5 attempts committed in PostgreSQL
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(clientIp, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("TC 10: Concurrent requests from different IPs do not share quota")
    void concurrentRequestsFromDifferentIpsDoNotShareQuota() throws Exception {
        int totalRequests = 10;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        // 5 requests from IP 192.168.1.21, 5 requests from IP 192.168.1.22
        for (int i = 0; i < totalRequests; i++) {
            final String assignedIp = (i % 2 == 0) ? "192.168.1.21" : "192.168.1.22";
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    LoginRequest req = buildValidLogin(normalUser);
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                                    .with(r -> {
                                        r.setRemoteAddr(assignedIp);
                                        return r;
                                    })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    if (result.getResponse().getStatus() == 200) {
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
        assertThat(successCount.get()).as("All 10 requests (5 per IP) must succeed").isEqualTo(10);

        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter("192.168.1.21", Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(5);
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter("192.168.1.22", Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(5);
    }

    @Test
    @DisplayName("TC 11: Trusted proxy forwarding chain resolves to correct client IP")
    void trustedProxyForwardingChainResolvesCorrectly() throws Exception {
        // Configure 10.0.0.1 as a trusted proxy
        rateLimitProperties.setTrustedProxies(List.of("10.0.0.1"));

        String realClientIp = "203.0.113.195";
        LoginRequest request = buildValidLogin(normalUser);

        // Immediate remote address is trusted proxy (10.0.0.1)
        // X-Forwarded-For contains real client IP
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("10.0.0.1");
                            return req;
                        })
                        .header("X-Forwarded-For", realClientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Quota attempt must be attributed to real client IP, NOT 10.0.0.1
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(realClientIp, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(1);
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter("10.0.0.1", Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isZero();
    }

    @Test
    @DisplayName("TC 12: Forwarded headers from untrusted remote address cannot spoof client IP")
    void untrustedRemoteAddressCannotSpoofClientIp() throws Exception {
        // No trusted proxies configured
        rateLimitProperties.setTrustedProxies(Collections.emptyList());

        String attackerRemoteAddr = "198.51.100.50";
        String spoofedIp = "1.2.3.4";
        LoginRequest request = buildValidLogin(normalUser);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr(attackerRemoteAddr);
                            return req;
                        })
                        .header("X-Forwarded-For", spoofedIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Attempt must be attributed to the remote address, NOT spoofed header
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(attackerRemoteAddr, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(1);
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter(spoofedIp, Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isZero();
    }

    @Test
    @DisplayName("TC 13: Malformed forwarded headers are handled safely without crashing")
    void malformedForwardedHeadersHandledSafely() throws Exception {
        rateLimitProperties.setTrustedProxies(List.of("10.0.0.1"));

        LoginRequest request = buildValidLogin(normalUser);

        // Malformed IP header
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("10.0.0.1");
                            return req;
                        })
                        .header("X-Forwarded-For", "malformed<script>invalid_ip, 10.0.0.1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Safely falls back to remote address
        assertThat(loginAttemptRepository.countByIpAddressAndCreatedAtAfter("10.0.0.1", Instant.now().minus(1, ChronoUnit.MINUTES)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 15: Cleanup removes only expired records older than retention period")
    void cleanupRemovesOnlyExpiredRecords() {
        String clientIp = "192.168.1.30";
        Instant now = Instant.now();

        // 1. Expired attempt (26 hours old)
        loginAttemptRepository.save(new LoginAttempt(clientIp, now.minus(26, ChronoUnit.HOURS)));

        // 2. Expired attempt (30 hours old)
        loginAttemptRepository.save(new LoginAttempt(clientIp, now.minus(30, ChronoUnit.HOURS)));

        // 3. Active attempt (30 seconds old)
        LoginAttempt activeAttempt = loginAttemptRepository.save(new LoginAttempt(clientIp, now.minus(30, ChronoUnit.SECONDS)));
        loginAttemptRepository.flush();

        // Run cleanup
        int deletedCount = cleanupService.cleanupExpiredAttempts();

        assertThat(deletedCount).isEqualTo(2);

        // Active attempt must remain
        assertThat(loginAttemptRepository.findById(activeAttempt.getId())).isPresent();
    }
}
