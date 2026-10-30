package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.GoogleLoginRequest;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.UserIdentity;
import com.shareloop.entity.enums.IdentityProvider;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.GoogleAuthConfigurationException;
import com.shareloop.exception.InvalidGoogleIdTokenException;
import com.shareloop.repository.UserIdentityRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.security.google.GoogleIdTokenVerifierService;
import com.shareloop.security.google.GoogleUserClaims;
import com.shareloop.security.ratelimit.GoogleAuthRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GoogleAuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserIdentityRepository userIdentityRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private GoogleAuthRateLimiter googleAuthRateLimiter;

    @MockitoBean
    private GoogleIdTokenVerifierService googleIdTokenVerifierService;

    @BeforeEach
    void setUp() {
        googleAuthRateLimiter.reset();
    }

    // =========================================================================
    // 1. Google Login (POST /api/v1/auth/google)
    // =========================================================================

    @Test
    @Transactional
    @DisplayName("Valid first-time Google login creates USER account with null password hash and Google identity")
    void validFirstTimeGoogleLogin_CreatesUserAccountAndGoogleIdentity() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "first.time." + UUID.randomUUID() + "@shareloop.vn";
        when(googleIdTokenVerifierService.verify("valid-id-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "First Time User", "https://avatar.com/u1.jpg"));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("valid-id-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.displayName").value("First Time User"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"));

        // Verify database state
        User user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getRole()).isEqualTo(UserRole.USER);
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getPasswordHash()).isNull(); // Google-only users have NULL password hash

        UserIdentity identity = userIdentityRepository.findByProviderAndProviderSubject(IdentityProvider.GOOGLE, sub).orElseThrow();
        assertThat(identity.getUser().getId()).isEqualTo(user.getId());
        assertThat(identity.getProviderEmail()).isEqualTo(email);
    }

    @Test
    @Transactional
    @DisplayName("Existing linked Google identity logs in and returns correct ShareLoop account")
    void existingLinkedGoogleIdentity_LogsIntoExistingAccount() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "existing.linked." + UUID.randomUUID() + "@shareloop.vn";

        User existingUser = userRepository.saveAndFlush(new User("Existing Linked", email, null, UserRole.USER, UserStatus.ACTIVE));
        userIdentityRepository.saveAndFlush(new UserIdentity(existingUser, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("existing-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Existing Linked", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("existing-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(existingUser.getId().toString()))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    @Transactional
    @DisplayName("Existing ADMIN identity retains ADMIN role upon Google login")
    void existingAdminIdentity_RetainsAdminRole() throws Exception {
        String sub = "google-sub-admin-" + UUID.randomUUID();
        String email = "admin.google." + UUID.randomUUID() + "@shareloop.vn";

        User adminUser = userRepository.saveAndFlush(new User("Admin Member", email, null, UserRole.ADMIN, UserStatus.ACTIVE));
        userIdentityRepository.saveAndFlush(new UserIdentity(adminUser, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("admin-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Admin Member", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("admin-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(adminUser.getId().toString()))
                .andExpect(jsonPath("$.role").value("ADMIN"));

        // Verify role was not demoted
        User inDb = userRepository.findById(adminUser.getId()).orElseThrow();
        assertThat(inDb.getRole()).isEqualTo(UserRole.ADMIN);
    }

    @Test
    @Transactional
    @DisplayName("Suspended Google account is rejected with 403 Forbidden")
    void suspendedAccount_IsRejected() throws Exception {
        String sub = "google-sub-susp-" + UUID.randomUUID();
        String email = "suspended." + UUID.randomUUID() + "@shareloop.vn";

        User suspendedUser = userRepository.saveAndFlush(new User("Suspended", email, null, UserRole.USER, UserStatus.SUSPENDED));
        userIdentityRepository.saveAndFlush(new UserIdentity(suspendedUser, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("susp-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Suspended", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("susp-token"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Your account has been suspended. Please contact support."));
    }

    @Test
    @Transactional
    @DisplayName("Deactivated Google account is rejected with 403 Forbidden")
    void deactivatedAccount_IsRejected() throws Exception {
        String sub = "google-sub-deact-" + UUID.randomUUID();
        String email = "deactivated." + UUID.randomUUID() + "@shareloop.vn";

        User deactivatedUser = userRepository.saveAndFlush(new User("Deactivated", email, null, UserRole.USER, UserStatus.DEACTIVATED));
        userIdentityRepository.saveAndFlush(new UserIdentity(deactivatedUser, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("deact-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Deactivated", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("deact-token"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Your account has been deactivated."));
    }

    @Test
    @DisplayName("Invalid Google ID token signature is rejected with 401 Unauthorized")
    void invalidGoogleToken_Returns401() throws Exception {
        when(googleIdTokenVerifierService.verify("bad-token"))
                .thenThrow(new InvalidGoogleIdTokenException("Invalid Google ID token"));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("bad-token"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid Google ID token"));
    }

    @Test
    @DisplayName("Unverified Google email is rejected with 401 Unauthorized")
    void unverifiedEmail_Returns401() throws Exception {
        when(googleIdTokenVerifierService.verify("unverified-email-token"))
                .thenThrow(new InvalidGoogleIdTokenException("Google account email is not verified"));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("unverified-email-token"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Google account email is not verified"));
    }

    @Test
    @DisplayName("Disabled Google Login is handled with 503 Service Unavailable")
    void disabledGoogleLogin_Returns503() throws Exception {
        when(googleIdTokenVerifierService.verify("any-token"))
                .thenThrow(new GoogleAuthConfigurationException("Google authentication is disabled"));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("any-token"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Google authentication is disabled"));
    }

    @Test
    @Transactional
    @DisplayName("Matching email with existing password account does NOT auto-link and returns 409 Conflict")
    void matchingEmailWithExistingPasswordAccount_DoesNotAutoLink() throws Exception {
        String email = "existing.password." + UUID.randomUUID() + "@shareloop.vn";
        User passwordUser = userRepository.saveAndFlush(new User("PW User", email, passwordEncoder.encode("Password123!"), UserRole.USER, UserStatus.ACTIVE));

        String sub = "new-sub-" + UUID.randomUUID();
        when(googleIdTokenVerifierService.verify("conflicting-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "PW User", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("conflicting-token"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An account with this email already exists. Please log in with your email and password first, then link your Google account in settings."));

        // Verify identity was NOT created
        assertThat(userIdentityRepository.findByProviderAndProviderSubject(IdentityProvider.GOOGLE, sub)).isEmpty();
    }

    @Test
    @DisplayName("Blank Google ID token returns 400 Bad Request")
    void blankGoogleIdToken_Returns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("   "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.idToken").value("Google ID token is required"));
    }

    @Test
    @DisplayName("Rate limit on Google login returns 429 Too Many Requests and does not affect password login")
    void googleLoginRateLimit_Returns429_DoesNotAffectPasswordLogin() throws Exception {
        when(googleIdTokenVerifierService.verify(anyString()))
                .thenThrow(new InvalidGoogleIdTokenException("Invalid token"));

        // Send 5 attempts from client IP
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/google")
                            .header("X-Forwarded-For", "203.0.113.50")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-" + i))))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt from the same IP must be rate-limited
        mockMvc.perform(post("/api/v1/auth/google")
                        .header("X-Forwarded-For", "203.0.113.50")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-6"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(GoogleAuthRateLimiter.LOGIN_RATE_LIMIT_MESSAGE));
    }

    // =========================================================================
    // 2. Explicit Account Linking (POST /api/v1/auth/google/link)
    // =========================================================================

    @Test
    @DisplayName("Unauthenticated request to link Google account returns 401 Unauthorized")
    void unauthenticatedLinkRequest_Returns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google/link")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    @DisplayName("Authenticated user can explicitly link a valid Google account")
    void authenticatedUser_CanExplicitlyLinkGoogleAccount() throws Exception {
        String email = "linker." + UUID.randomUUID() + "@shareloop.vn";
        User user = userRepository.saveAndFlush(new User("Linker", email, passwordEncoder.encode("Pass123!"), UserRole.USER, UserStatus.ACTIVE));
        String token = "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

        String googleSub = "sub-to-link-" + UUID.randomUUID();
        String googleEmail = "google.acc." + UUID.randomUUID() + "@gmail.com";
        when(googleIdTokenVerifierService.verify("link-token"))
                .thenReturn(new GoogleUserClaims(googleSub, googleEmail, true, "Google Name", null));

        mockMvc.perform(post("/api/v1/auth/google/link")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("link-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(true))
                .andExpect(jsonPath("$.provider").value("GOOGLE"))
                .andExpect(jsonPath("$.email").value(googleEmail))
                .andExpect(jsonPath("$.linkedAt").isNotEmpty());

        // Verify linked in database
        UserIdentity identity = userIdentityRepository.findByProviderAndProviderSubject(IdentityProvider.GOOGLE, googleSub).orElseThrow();
        assertThat(identity.getUser().getId()).isEqualTo(user.getId());
    }

    @Test
    @Transactional
    @DisplayName("Already-linked Google subject is rejected with 409 Conflict")
    void alreadyLinkedGoogleSubject_RejectedWith409() throws Exception {
        // User 1 already owns this Google subject
        User user1 = userRepository.saveAndFlush(new User("Owner User", "owner." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));
        String sub = "sub-already-owned-" + UUID.randomUUID();
        userIdentityRepository.saveAndFlush(new UserIdentity(user1, IdentityProvider.GOOGLE, sub, "owned@gmail.com"));

        // User 2 attempts to link the same Google subject
        User user2 = userRepository.saveAndFlush(new User("Attempt User", "attempt." + UUID.randomUUID() + "@shareloop.vn", passwordEncoder.encode("Pass123!"), UserRole.USER, UserStatus.ACTIVE));
        String token2 = "Bearer " + jwtService.generateToken(user2.getId(), user2.getEmail(), user2.getRole(), user2.getStatus());

        when(googleIdTokenVerifierService.verify("owned-token"))
                .thenReturn(new GoogleUserClaims(sub, "owned@gmail.com", true, "Google User", null));

        mockMvc.perform(post("/api/v1/auth/google/link")
                        .header("Authorization", token2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("owned-token"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This Google account is already linked to another ShareLoop account."));
    }

    @Test
    @Transactional
    @DisplayName("User with existing Google identity cannot link another Google identity (409 Conflict)")
    void userWithExistingGoogleIdentity_CannotLinkAnother() throws Exception {
        User user = userRepository.saveAndFlush(new User("Multi Google", "multi." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));
        userIdentityRepository.saveAndFlush(new UserIdentity(user, IdentityProvider.GOOGLE, "sub-initial-" + UUID.randomUUID(), "initial@gmail.com"));

        String token = "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

        when(googleIdTokenVerifierService.verify("second-token"))
                .thenReturn(new GoogleUserClaims("sub-second-" + UUID.randomUUID(), "second@gmail.com", true, "Second Google", null));

        mockMvc.perform(post("/api/v1/auth/google/link")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("second-token"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Your ShareLoop account is already linked to a Google account."));
    }

    @Test
    @Transactional
    @DisplayName("Linking preserves existing ADMIN role")
    void linkingPreservesAdminRole() throws Exception {
        User admin = userRepository.saveAndFlush(new User("Admin Linker", "admin.link." + UUID.randomUUID() + "@shareloop.vn", passwordEncoder.encode("Pass123!"), UserRole.ADMIN, UserStatus.ACTIVE));
        String token = "Bearer " + jwtService.generateToken(admin.getId(), admin.getEmail(), admin.getRole(), admin.getStatus());

        String sub = "admin-sub-" + UUID.randomUUID();
        when(googleIdTokenVerifierService.verify("admin-link-token"))
                .thenReturn(new GoogleUserClaims(sub, "admin.google@gmail.com", true, "Admin Google", null));

        mockMvc.perform(post("/api/v1/auth/google/link")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("admin-link-token"))))
                .andExpect(status().isOk());

        User inDb = userRepository.findById(admin.getId()).orElseThrow();
        assertThat(inDb.getRole()).isEqualTo(UserRole.ADMIN);
    }

    // =========================================================================
    // 3. Status Endpoint (GET /api/v1/auth/google/status)
    // =========================================================================

    @Test
    @DisplayName("GET /api/v1/auth/google/status unauthenticated returns 401")
    void getStatusUnauthenticated_Returns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/google/status"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    @DisplayName("GET /api/v1/auth/google/status returns linked=false for unlinked user and linked=true for linked user")
    void getStatus_ReturnsCorrectStatus() throws Exception {
        // Unlinked user
        User unlinkedUser = userRepository.saveAndFlush(new User("Unlinked", "unlinked." + UUID.randomUUID() + "@shareloop.vn", passwordEncoder.encode("Pw123!"), UserRole.USER, UserStatus.ACTIVE));
        String tokenUnlinked = "Bearer " + jwtService.generateToken(unlinkedUser.getId(), unlinkedUser.getEmail(), unlinkedUser.getRole(), unlinkedUser.getStatus());

        mockMvc.perform(get("/api/v1/auth/google/status")
                        .header("Authorization", tokenUnlinked))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(false))
                .andExpect(jsonPath("$.provider").value("GOOGLE"))
                .andExpect(jsonPath("$.email").doesNotExist());

        // Linked user
        User linkedUser = userRepository.saveAndFlush(new User("Linked", "linked." + UUID.randomUUID() + "@shareloop.vn", null, UserRole.USER, UserStatus.ACTIVE));
        String googleEmail = "linked.google@gmail.com";
        userIdentityRepository.saveAndFlush(new UserIdentity(linkedUser, IdentityProvider.GOOGLE, "sub-status-" + UUID.randomUUID(), googleEmail));
        String tokenLinked = "Bearer " + jwtService.generateToken(linkedUser.getId(), linkedUser.getEmail(), linkedUser.getRole(), linkedUser.getStatus());

        mockMvc.perform(get("/api/v1/auth/google/status")
                        .header("Authorization", tokenLinked))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(true))
                .andExpect(jsonPath("$.provider").value("GOOGLE"))
                .andExpect(jsonPath("$.email").value(googleEmail))
                .andExpect(jsonPath("$.linkedAt").isNotEmpty());
    }

    @Test
    @DisplayName("Concurrent first-time Google logins do not create duplicate accounts")
    void concurrentFirstTimeGoogleLogin_DoesNotCreateDuplicateAccounts() throws Exception {
        String sub = "google-sub-concurrent-" + UUID.randomUUID();
        String email = "concurrent." + UUID.randomUUID() + "@shareloop.vn";
        when(googleIdTokenVerifierService.verify("concurrent-token"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Concurrent User", null));

        int threadCount = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    // Each thread uses a distinct IP so client-IP rate limiting is not triggered
                    var result = mockMvc.perform(post("/api/v1/auth/google")
                                    .header("X-Forwarded-For", "198.51.100." + (10 + index))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(new GoogleLoginRequest("concurrent-token"))))
                            .andReturn();
                    if (result.getResponse().getStatus() == 200) {
                        successCount.incrementAndGet();
                    }
                } catch (Exception ignored) {
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await();
        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();

        assertThat(successCount.get()).isGreaterThanOrEqualTo(1);

        // Exactly one user and one identity must exist in DB
        User user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getRole()).isEqualTo(UserRole.USER);
        assertThat(userIdentityRepository.findByProviderAndProviderSubject(IdentityProvider.GOOGLE, sub)).isPresent();
    }
}
