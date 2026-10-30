package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.ChangePasswordRequest;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.dto.auth.SetPasswordRequest;
import com.shareloop.dto.auth.UpdateProfileRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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

import com.shareloop.exception.AccountDeactivatedException;
import com.shareloop.exception.AccountSuspendedException;
import com.shareloop.security.ratelimit.PasswordRateLimiter;
import com.shareloop.service.AuthService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthService authService;

    @Autowired(required = false)
    private PasswordRateLimiter passwordRateLimiter;

    @Autowired(required = false)
    private com.shareloop.repository.LoginAttemptRepository loginAttemptRepository;

    @org.junit.jupiter.api.BeforeEach
    void cleanRateLimits() {
        if (loginAttemptRepository != null) {
            loginAttemptRepository.deleteAll();
        }
        if (passwordRateLimiter != null) {
            passwordRateLimiter.reset();
        }
    }

    private User createTestUserWithPassword(String email, String rawPassword) {
        User user = new User(
                "Test User",
                email,
                passwordEncoder.encode(rawPassword),
                UserRole.USER,
                UserStatus.ACTIVE
        );
        return userRepository.saveAndFlush(user);
    }

    private User createGoogleOnlyUser(String email) {
        User user = new User(
                "Google User",
                email,
                null,
                UserRole.USER,
                UserStatus.ACTIVE
        );
        return userRepository.saveAndFlush(user);
    }

    private String generateBearerToken(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());
    }

    private User createSuspendedUserWithPassword(String email, String rawPassword) {
        User user = new User(
                "Suspended User",
                email,
                passwordEncoder.encode(rawPassword),
                UserRole.USER,
                UserStatus.SUSPENDED
        );
        return userRepository.saveAndFlush(user);
    }

    private User createDeactivatedUserWithPassword(String email, String rawPassword) {
        User user = new User(
                "Deactivated User",
                email,
                passwordEncoder.encode(rawPassword),
                UserRole.USER,
                UserStatus.DEACTIVATED
        );
        return userRepository.saveAndFlush(user);
    }

    private User createSuspendedGoogleOnlyUser(String email) {
        User user = new User(
                "Suspended Google User",
                email,
                null,
                UserRole.USER,
                UserStatus.SUSPENDED
        );
        return userRepository.saveAndFlush(user);
    }

    private User createDeactivatedGoogleOnlyUser(String email) {
        User user = new User(
                "Deactivated Google User",
                email,
                null,
                UserRole.USER,
                UserStatus.DEACTIVATED
        );
        return userRepository.saveAndFlush(user);
    }

    // =========================================================================
    // 1. Profile response tests (hasPassword field contract)
    // =========================================================================
    @Nested
    @DisplayName("Profile Contract Tests (hasPassword)")
    class ProfileContractTests {

        @Test
        @Transactional
        @DisplayName("Local-password account returns hasPassword = true")
        void localPasswordAccount_ReturnsHasPasswordTrue() throws Exception {
            User user = createTestUserWithPassword("local." + UUID.randomUUID() + "@shareloop.vn", "Password123!");
            String token = generateBearerToken(user);

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(user.getId().toString()))
                    .andExpect(jsonPath("$.hasPassword").value(true))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.password").doesNotExist());
        }

        @Test
        @Transactional
        @DisplayName("Google-only account returns hasPassword = false")
        void googleOnlyAccount_ReturnsHasPasswordFalse() throws Exception {
            User user = createGoogleOnlyUser("google." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(user.getId().toString()))
                    .andExpect(jsonPath("$.hasPassword").value(false))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.password").doesNotExist());
        }

        @Test
        @Transactional
        @DisplayName("Profile update preserves hasPassword = true for local account")
        void profileUpdate_PreservesHasPasswordTrue_ForLocalAccount() throws Exception {
            User user = createTestUserWithPassword("local.update." + UUID.randomUUID() + "@shareloop.vn", "Password123!");
            String token = generateBearerToken(user);

            UpdateProfileRequest updateRequest = new UpdateProfileRequest("Updated Name", "0912345678");

            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.displayName").value("Updated Name"))
                    .andExpect(jsonPath("$.hasPassword").value(true))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist());
        }

        @Test
        @Transactional
        @DisplayName("Profile update preserves hasPassword = false for Google-only account")
        void profileUpdate_PreservesHasPasswordFalse_ForGoogleOnlyAccount() throws Exception {
            User user = createGoogleOnlyUser("google.update." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            UpdateProfileRequest updateRequest = new UpdateProfileRequest("Updated Google Name", "0987654321");

            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.displayName").value("Updated Google Name"))
                    .andExpect(jsonPath("$.hasPassword").value(false))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist());
        }
    }

    // =========================================================================
    // 2. Change-password tests (POST /api/v1/auth/change-password)
    // =========================================================================
    @Nested
    @DisplayName("Change Password Tests (POST /api/v1/auth/change-password)")
    class ChangePasswordTests {

        @org.junit.jupiter.api.BeforeEach
        void cleanRateLimitsInNested() {
            if (loginAttemptRepository != null) {
                loginAttemptRepository.deleteAll();
            }
            if (passwordRateLimiter != null) {
                passwordRateLimiter.reset();
            }
        }

        @Test
        @Transactional
        @DisplayName("Authenticated user changes password successfully")
        void authenticatedUserChangesPasswordSuccessfully() throws Exception {
            String email = "changepw.success." + UUID.randomUUID() + "@shareloop.vn";
            User user = createTestUserWithPassword(email, "OldPassword123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("OldPassword123!", "NewPassword123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Đổi mật khẩu thành công."));

            User updatedUser = userRepository.findById(user.getId()).orElseThrow();
            assertThat(passwordEncoder.matches("NewPassword123!", updatedUser.getPasswordHash())).isTrue();
            assertThat(passwordEncoder.matches("OldPassword123!", updatedUser.getPasswordHash())).isFalse();
        }

        @Test
        @Transactional
        @DisplayName("Old password no longer authenticates, new password authenticates successfully")
        void oldPasswordNoLongerAuthenticates_and_newPasswordAuthenticates() throws Exception {
            String email = "login.test." + UUID.randomUUID() + "@shareloop.vn";
            User user = createTestUserWithPassword(email, "OldPassword123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest changeReq = new ChangePasswordRequest("OldPassword123!", "NewPassword123!");
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(changeReq)))
                    .andExpect(status().isOk());

            // Attempt login with old password -> must fail with 401
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new LoginRequest(email, "OldPassword123!"))))
                    .andExpect(status().isUnauthorized());

            // Attempt login with new password -> must succeed with 200
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new LoginRequest(email, "NewPassword123!"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty());
        }

        @Test
        @Transactional
        @DisplayName("Incorrect current password is rejected with 400 Bad Request")
        void incorrectCurrentPasswordIsRejected() throws Exception {
            String email = "wrongpw." + UUID.randomUUID() + "@shareloop.vn";
            User user = createTestUserWithPassword(email, "CorrectPassword123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("IncorrectPassword123!", "NewPassword123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Mật khẩu hiện tại không chính xác."));

            User dbUser = userRepository.findById(user.getId()).orElseThrow();
            assertThat(passwordEncoder.matches("CorrectPassword123!", dbUser.getPasswordHash())).isTrue();
        }

        @Test
        @Transactional
        @DisplayName("Google-only account attempting change-password is rejected with 409 Conflict")
        void googleOnlyAccount_IsRejectedFromChangePassword() throws Exception {
            String email = "google.changepw." + UUID.randomUUID() + "@shareloop.vn";
            User user = createGoogleOnlyUser(email);
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("AnyPassword123!", "NewPassword123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Tài khoản chưa thiết lập mật khẩu. Vui lòng sử dụng chức năng thiết lập mật khẩu lần đầu."));
        }

        @Test
        @Transactional
        @DisplayName("New password matching current password is rejected with 400 Bad Request")
        void newPasswordMatchingCurrentPasswordIsRejected() throws Exception {
            String email = "samepw." + UUID.randomUUID() + "@shareloop.vn";
            User user = createTestUserWithPassword(email, "SamePassword123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("SamePassword123!", "SamePassword123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Mật khẩu mới không được trùng với mật khẩu hiện tại."));
        }

        @Test
        @Transactional
        @DisplayName("Invalid password lengths and blanks are rejected with 400 Bad Request")
        void invalidPasswordLengthsAreRejected() throws Exception {
            User user = createTestUserWithPassword("lengths." + UUID.randomUUID() + "@shareloop.vn", "ValidCurrent123!");
            String token = generateBearerToken(user);

            // Too short (< 8 chars)
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("ValidCurrent123!", "short"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());

            // Blank new password
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("ValidCurrent123!", ""))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());

            // Blank current password
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("", "ValidNewPassword123!"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.currentPassword").isNotEmpty());

            // Exceeds 100 characters
            String longPassword = "a".repeat(101);
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("ValidCurrent123!", longPassword))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());
        }

        @Test
        @DisplayName("Unauthenticated change-password request is rejected with 401 Unauthorized")
        void unauthenticatedChangePasswordIsRejected() throws Exception {
            ChangePasswordRequest request = new ChangePasswordRequest("OldPassword123!", "NewPassword123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @Transactional
        @DisplayName("One user cannot change another user's password")
        void oneUserCannotChangeAnotherUsersPassword() throws Exception {
            User userA = createTestUserWithPassword("usera." + UUID.randomUUID() + "@shareloop.vn", "UserAPassword123!");
            User userB = createTestUserWithPassword("userb." + UUID.randomUUID() + "@shareloop.vn", "UserBPassword123!");

            String tokenA = generateBearerToken(userA);

            ChangePasswordRequest request = new ChangePasswordRequest("UserAPassword123!", "UserANewPassword123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", tokenA)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());

            // Verify User B's password in DB is completely untouched
            User freshUserB = userRepository.findById(userB.getId()).orElseThrow();
            assertThat(passwordEncoder.matches("UserBPassword123!", freshUserB.getPasswordHash())).isTrue();
        }

        @Test
        @Transactional
        @DisplayName("Suspended user attempting change-password is rejected")
        void suspendedUserCannotChangePassword() throws Exception {
            User user = createSuspendedUserWithPassword("suspended." + UUID.randomUUID() + "@shareloop.vn", "ValidPass123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("ValidPass123!", "NewValidPass123!");

            // HTTP filter layer: unauthenticated because suspended user is rejected by JwtAuthenticationFilter
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());

            // Service layer: direct check throws AccountSuspendedException
            assertThatThrownBy(() -> authService.changePassword(user.getId(), request))
                    .isInstanceOf(AccountSuspendedException.class);
        }

        @Test
        @Transactional
        @DisplayName("Deactivated user attempting change-password is rejected")
        void deactivatedUserCannotChangePassword() throws Exception {
            User user = createDeactivatedUserWithPassword("deactivated." + UUID.randomUUID() + "@shareloop.vn", "ValidPass123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("ValidPass123!", "NewValidPass123!");

            // HTTP filter layer: unauthenticated because deactivated user is rejected by JwtAuthenticationFilter
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());

            // Service layer: direct check throws AccountDeactivatedException
            assertThatThrownBy(() -> authService.changePassword(user.getId(), request))
                    .isInstanceOf(AccountDeactivatedException.class);
        }

        @Test
        @Transactional
        @DisplayName("Change-password user rate limit returns HTTP 429 when quota is exceeded")
        void changePasswordRateLimitExceededForUserReturns429() throws Exception {
            User user = createTestUserWithPassword("ratelimit.user." + UUID.randomUUID() + "@shareloop.vn", "CorrectPassword123!");
            String token = generateBearerToken(user);

            // Send 5 incorrect-password attempts: all pass validation & hit rate limiter, returning 400 Bad Request
            for (int i = 0; i < 5; i++) {
                ChangePasswordRequest req = new ChangePasswordRequest("WrongPassword" + i + "!", "NewPassword123!");
                mockMvc.perform(post("/api/v1/auth/change-password")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                        .andExpect(status().isBadRequest());
            }

            // 6th attempt hits user rate limit and returns 429 Too Many Requests
            ChangePasswordRequest sixthReq = new ChangePasswordRequest("WrongPassword6!", "NewPassword123!");
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(sixthReq)))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.status").value(429))
                    .andExpect(jsonPath("$.error").value("Too Many Requests"))
                    .andExpect(jsonPath("$.message").value(PasswordRateLimiter.CHANGE_PASSWORD_RATE_LIMIT_MESSAGE))
                    .andExpect(jsonPath("$.path").value("/api/v1/auth/change-password"));
        }

        @Test
        @Transactional
        @DisplayName("Different users are isolated under change-password rate limiting")
        void changePasswordRateLimitDifferentUsersAreIsolated() throws Exception {
            User userA = createTestUserWithPassword("isolated.a." + UUID.randomUUID() + "@shareloop.vn", "PassA123!");
            User userB = createTestUserWithPassword("isolated.b." + UUID.randomUUID() + "@shareloop.vn", "PassB123!");

            String tokenA = generateBearerToken(userA);
            String tokenB = generateBearerToken(userB);

            // Exhaust user A's limit
            for (int i = 0; i < 5; i++) {
                ChangePasswordRequest req = new ChangePasswordRequest("WrongA" + i + "!", "NewPassA123!");
                mockMvc.perform(post("/api/v1/auth/change-password")
                                .header("Authorization", tokenA)
                                .with(r -> { r.setRemoteAddr("10.10.1.1"); return r; })
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                        .andExpect(status().isBadRequest());
            }

            // User A is blocked
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", tokenA)
                            .with(r -> { r.setRemoteAddr("10.10.1.1"); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("PassA123!", "NewPassA123!"))))
                    .andExpect(status().isTooManyRequests());

            // User B on a different IP can still successfully change their password
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", tokenB)
                            .with(r -> { r.setRemoteAddr("10.10.2.1"); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("PassB123!", "NewPassB123!"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Đổi mật khẩu thành công."));
        }

        @Test
        @Transactional
        @DisplayName("Change-password IP rate limit returns HTTP 429 when IP quota is exceeded")
        void changePasswordRateLimitExceededForIpReturns429() throws Exception {
            String sharedIp = "192.168.10.50";

            // Two distinct users send 5 requests each from the same client IP -> 10 attempts
            for (int u = 0; u < 2; u++) {
                User user = createTestUserWithPassword("ip.limit." + u + "." + UUID.randomUUID() + "@shareloop.vn", "Pass" + u + "123!");
                String token = generateBearerToken(user);
                for (int i = 0; i < 5; i++) {
                    ChangePasswordRequest req = new ChangePasswordRequest("WrongPass" + i + "!", "NewPass123!");
                    mockMvc.perform(post("/api/v1/auth/change-password")
                                    .header("Authorization", token)
                                    .with(r -> { r.setRemoteAddr(sharedIp); return r; })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(req)))
                            .andExpect(status().isBadRequest());
                }
            }

            // 11th request from a 3rd distinct user from the same IP is blocked by IP limit
            User user3 = createTestUserWithPassword("ip.limit.third." + UUID.randomUUID() + "@shareloop.vn", "PassThird123!");
            String token3 = generateBearerToken(user3);

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token3)
                            .with(r -> { r.setRemoteAddr(sharedIp); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChangePasswordRequest("PassThird123!", "NewPassThird123!"))))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.status").value(429))
                    .andExpect(jsonPath("$.message").value(PasswordRateLimiter.CHANGE_PASSWORD_RATE_LIMIT_MESSAGE));
        }

        @Test
        @Transactional
        @DisplayName("Change-password response does not leak sensitive information")
        void changePasswordResponseDoesNotLeakSensitiveInformation() throws Exception {
            User user = createTestUserWithPassword("leakcheck." + UUID.randomUUID() + "@shareloop.vn", "CurrentSecret123!");
            String token = generateBearerToken(user);

            ChangePasswordRequest request = new ChangePasswordRequest("CurrentSecret123!", "NewSecret123!");

            mockMvc.perform(post("/api/v1/auth/change-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Đổi mật khẩu thành công."))
                    .andExpect(jsonPath("$.password").doesNotExist())
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.currentPassword").doesNotExist())
                    .andExpect(jsonPath("$.newPassword").doesNotExist())
                    .andExpect(jsonPath("$.token").doesNotExist())
                    .andExpect(jsonPath("$.accessToken").doesNotExist());
        }
    }

    // =========================================================================
    // 3. Set-password tests (POST /api/v1/auth/set-password)
    // =========================================================================
    @Nested
    @DisplayName("Set Password Tests (POST /api/v1/auth/set-password)")
    class SetPasswordTests {

        @org.junit.jupiter.api.BeforeEach
        void cleanRateLimitsInNested() {
            if (loginAttemptRepository != null) {
                loginAttemptRepository.deleteAll();
            }
            if (passwordRateLimiter != null) {
                passwordRateLimiter.reset();
            }
        }

        @Test
        @Transactional
        @DisplayName("Google-only account sets first password successfully and hasPassword transitions from false to true")
        void googleOnlyAccountSetsFirstPasswordSuccessfully() throws Exception {
            String email = "google.firstpw." + UUID.randomUUID() + "@shareloop.vn";
            User user = createGoogleOnlyUser(email);
            String token = generateBearerToken(user);

            // Verify initially hasPassword = false
            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.hasPassword").value(false));

            // Set initial password
            SetPasswordRequest request = new SetPasswordRequest("FirstTimePassword123!");
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Thiết lập mật khẩu thành công."));

            // Verify hasPassword is now true
            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.hasPassword").value(true));

            // Verify the newly established password can be used for normal email/password login
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new LoginRequest(email, "FirstTimePassword123!"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty());
        }

        @Test
        @Transactional
        @DisplayName("Existing local-password account cannot use set-password and is rejected with 409 Conflict")
        void existingLocalPasswordAccountCannotUseSetPassword() throws Exception {
            User user = createTestUserWithPassword("local.cannotset." + UUID.randomUUID() + "@shareloop.vn", "AlreadyHasPassword123!");
            String token = generateBearerToken(user);

            SetPasswordRequest request = new SetPasswordRequest("NewInitialPassword123!");

            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Tài khoản đã có mật khẩu. Vui lòng sử dụng chức năng đổi mật khẩu."));
        }

        @Test
        @Transactional
        @DisplayName("Repeated set-password request is rejected with 409 Conflict")
        void repeatedSetPasswordRequestIsRejected() throws Exception {
            User user = createGoogleOnlyUser("google.repeat." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            SetPasswordRequest request1 = new SetPasswordRequest("FirstPassword123!");
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request1)))
                    .andExpect(status().isOk());

            // Immediate repeat
            SetPasswordRequest request2 = new SetPasswordRequest("SecondPassword123!");
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request2)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Tài khoản đã có mật khẩu. Vui lòng sử dụng chức năng đổi mật khẩu."));
        }

        @Test
        @Transactional
        @DisplayName("Invalid password lengths are rejected with 400 Bad Request")
        void invalidPasswordLengthsAreRejectedForSetPassword() throws Exception {
            User user = createGoogleOnlyUser("google.lengths." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            // < 8 chars
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetPasswordRequest("short"))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());

            // Blank
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetPasswordRequest(""))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());

            // > 100 chars
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetPasswordRequest("a".repeat(101)))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.newPassword").isNotEmpty());
        }

        @Test
        @DisplayName("Unauthenticated set-password request is rejected with 401 Unauthorized")
        void unauthenticatedSetPasswordIsRejected() throws Exception {
            SetPasswordRequest request = new SetPasswordRequest("SomePassword123!");

            mockMvc.perform(post("/api/v1/auth/set-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Concurrent set-password requests result in exactly one successful operation")
        void concurrentSetPasswordRequests_ResultInExactlyOneSuccess() throws Exception {
            User user = createGoogleOnlyUser("concurrent.setpw." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            int threadCount = 4;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch readyLatch = new CountDownLatch(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch doneLatch = new CountDownLatch(threadCount);
            AtomicInteger successCount = new AtomicInteger(0);
            AtomicInteger conflictCount = new AtomicInteger(0);

            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    readyLatch.countDown();
                    try {
                        startLatch.await();
                        var result = mockMvc.perform(post("/api/v1/auth/set-password")
                                        .header("Authorization", token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(new SetPasswordRequest("ConcurrentPassword123!"))))
                                .andReturn();

                        int responseStatus = result.getResponse().getStatus();
                        if (responseStatus == 200) {
                            successCount.incrementAndGet();
                        } else if (responseStatus == 409) {
                            conflictCount.incrementAndGet();
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

            assertThat(successCount.get()).isEqualTo(1);
            assertThat(conflictCount.get()).isEqualTo(threadCount - 1);

            User dbUser = userRepository.findById(user.getId()).orElseThrow();
            assertThat(passwordEncoder.matches("ConcurrentPassword123!", dbUser.getPasswordHash())).isTrue();
        }

        @Test
        @Transactional
        @DisplayName("Suspended Google user attempting set-password is rejected")
        void suspendedGoogleUserCannotSetPassword() throws Exception {
            User user = createSuspendedGoogleOnlyUser("suspended.google." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            SetPasswordRequest request = new SetPasswordRequest("FirstPassword123!");

            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());

            assertThatThrownBy(() -> authService.setPassword(user.getId(), request))
                    .isInstanceOf(AccountSuspendedException.class);
        }

        @Test
        @Transactional
        @DisplayName("Deactivated Google user attempting set-password is rejected")
        void deactivatedGoogleUserCannotSetPassword() throws Exception {
            User user = createDeactivatedGoogleOnlyUser("deactivated.google." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            SetPasswordRequest request = new SetPasswordRequest("FirstPassword123!");

            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());

            assertThatThrownBy(() -> authService.setPassword(user.getId(), request))
                    .isInstanceOf(AccountDeactivatedException.class);
        }

        @Test
        @Transactional
        @DisplayName("Set-password user rate limit returns HTTP 429 when quota is exceeded")
        void setPasswordRateLimitExceededForUserReturns429() throws Exception {
            User user = createTestUserWithPassword("already.has.pw." + UUID.randomUUID() + "@shareloop.vn", "AlreadyHasPass123!");
            String token = generateBearerToken(user);

            // 5 attempts by this user: each gets 409 Conflict because password is already set, but increments rate limiter
            for (int i = 0; i < 5; i++) {
                SetPasswordRequest req = new SetPasswordRequest("NewAttemptPassword" + i + "!");
                mockMvc.perform(post("/api/v1/auth/set-password")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                        .andExpect(status().isConflict());
            }

            // 6th attempt is blocked by rate limiter with 429 Too Many Requests
            SetPasswordRequest sixthReq = new SetPasswordRequest("NewAttemptPassword6!");
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(sixthReq)))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.status").value(429))
                    .andExpect(jsonPath("$.error").value("Too Many Requests"))
                    .andExpect(jsonPath("$.message").value(PasswordRateLimiter.SET_PASSWORD_RATE_LIMIT_MESSAGE))
                    .andExpect(jsonPath("$.path").value("/api/v1/auth/set-password"));
        }

        @Test
        @Transactional
        @DisplayName("Different users are isolated under set-password rate limiting")
        void setPasswordRateLimitDifferentUsersAreIsolated() throws Exception {
            User userA = createTestUserWithPassword("setpw.a." + UUID.randomUUID() + "@shareloop.vn", "HasPassA123!");
            User userB = createGoogleOnlyUser("setpw.b." + UUID.randomUUID() + "@shareloop.vn");

            String tokenA = generateBearerToken(userA);
            String tokenB = generateBearerToken(userB);

            // Exhaust user A's limit
            for (int i = 0; i < 5; i++) {
                SetPasswordRequest req = new SetPasswordRequest("NewPassA" + i + "!");
                mockMvc.perform(post("/api/v1/auth/set-password")
                                .header("Authorization", tokenA)
                                .with(r -> { r.setRemoteAddr("10.20.1.1"); return r; })
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                        .andExpect(status().isConflict());
            }

            // User A is blocked
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", tokenA)
                            .with(r -> { r.setRemoteAddr("10.20.1.1"); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetPasswordRequest("NewPassA99!"))))
                    .andExpect(status().isTooManyRequests());

            // User B on a different IP can still successfully set their initial password
            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", tokenB)
                            .with(r -> { r.setRemoteAddr("10.20.2.1"); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetPasswordRequest("BrandNewPassB123!"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Thiết lập mật khẩu thành công."));
        }

        @Test
        @Transactional
        @DisplayName("Set-password IP rate limit returns HTTP 429 when IP quota is exceeded")
        void setPasswordRateLimitExceededForIpReturns429() throws Exception {
            String sharedIp = "192.168.20.50";

            // Two distinct users send 5 requests each from the same client IP -> 10 attempts
            for (int u = 0; u < 2; u++) {
                User user = createTestUserWithPassword("setpw.ip." + u + "." + UUID.randomUUID() + "@shareloop.vn", "Pass" + u + "123!");
                String token = generateBearerToken(user);
                for (int i = 0; i < 5; i++) {
                    SetPasswordRequest req = new SetPasswordRequest("TryPassword" + i + "!");
                    mockMvc.perform(post("/api/v1/auth/set-password")
                                    .header("Authorization", token)
                                    .with(r -> { r.setRemoteAddr(sharedIp); return r; })
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(req)))
                            .andExpect(status().isConflict());
                }
            }

            // 11th request from a 3rd distinct Google-only user from the same IP is blocked by IP limit
            User user3 = createGoogleOnlyUser("setpw.ip.third." + UUID.randomUUID() + "@shareloop.vn");
            String token3 = generateBearerToken(user3);

            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token3)
                            .with(r -> { r.setRemoteAddr(sharedIp); return r; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetPasswordRequest("ValidNewPasswordThird123!"))))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.status").value(429))
                    .andExpect(jsonPath("$.message").value(PasswordRateLimiter.SET_PASSWORD_RATE_LIMIT_MESSAGE));
        }

        @Test
        @Transactional
        @DisplayName("Set-password response does not leak sensitive information")
        void setPasswordResponseDoesNotLeakSensitiveInformation() throws Exception {
            User user = createGoogleOnlyUser("setpw.leakcheck." + UUID.randomUUID() + "@shareloop.vn");
            String token = generateBearerToken(user);

            SetPasswordRequest request = new SetPasswordRequest("InitialSecret123!");

            mockMvc.perform(post("/api/v1/auth/set-password")
                            .header("Authorization", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Thiết lập mật khẩu thành công."))
                    .andExpect(jsonPath("$.password").doesNotExist())
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.newPassword").doesNotExist())
                    .andExpect(jsonPath("$.token").doesNotExist())
                    .andExpect(jsonPath("$.accessToken").doesNotExist());
        }
    }
}
