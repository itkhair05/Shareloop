package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.LoginRequest;
import com.shareloop.dto.auth.RegisterRequest;
import com.shareloop.dto.auth.UpdateProfileRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

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

    @Autowired(required = false)
    private com.shareloop.repository.LoginAttemptRepository loginAttemptRepository;

    @org.junit.jupiter.api.BeforeEach
    void cleanLoginRateLimit() {
        if (loginAttemptRepository != null) {
            loginAttemptRepository.deleteAll();
        }
    }

    private User createTestUser(String email, String rawPassword, UserRole role, UserStatus status) {
        User user = new User(
                "Test User",
                email,
                passwordEncoder.encode(rawPassword),
                role,
                status
        );
        return userRepository.saveAndFlush(user);
    }

    @Nested
    @DisplayName("Registration Endpoint Tests")
    class RegistrationTests {

        @Test
        @DisplayName("Successful registration returns 201, access token, and safe user profile")
        void successfulRegistration() throws Exception {
            RegisterRequest request = new RegisterRequest("Minh Tran", "minh.tran@example.com", "Password123!");

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.displayName").value("Minh Tran"))
                    .andExpect(jsonPath("$.email").value("minh.tran@example.com"))
                    .andExpect(jsonPath("$.role").value("USER"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.accessToken").isString())
                    .andExpect(jsonPath("$.tokenType").value("Bearer"))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.password").doesNotExist());

            Optional<User> persisted = userRepository.findByEmail("minh.tran@example.com");
            assertThat(persisted).isPresent();
            assertThat(persisted.get().getRole()).isEqualTo(UserRole.USER);
            assertThat(persisted.get().getStatus()).isEqualTo(UserStatus.ACTIVE);
        }

        @Test
        @DisplayName("Password is stored as BCrypt hash, never as plaintext")
        void passwordStoredAsBCryptHash() throws Exception {
            String rawPassword = "StrongSecretPassword#2026";
            RegisterRequest request = new RegisterRequest("Secure User", "secure.user@example.com", rawPassword);

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());

            User user = userRepository.findByEmail("secure.user@example.com").orElseThrow();
            assertThat(user.getPasswordHash()).isNotEqualTo(rawPassword);
            assertThat(user.getPasswordHash()).startsWith("$2a$");
            assertThat(passwordEncoder.matches(rawPassword, user.getPasswordHash())).isTrue();
        }

        @Test
        @DisplayName("Registration email is normalized with trimming and lowercase")
        void emailIsNormalizedOnRegistration() throws Exception {
            RegisterRequest request = new RegisterRequest("Trim User", "  CaSe.SeNsItIvE@ExAmPlE.CoM  ", "Password123!");

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.email").value("case.sensitive@example.com"));

            assertThat(userRepository.findByEmail("case.sensitive@example.com")).isPresent();
        }

        @Test
        @DisplayName("Duplicate email registration is rejected with HTTP 409 Conflict")
        void duplicateEmailRejected() throws Exception {
            createTestUser("existing@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);

            RegisterRequest duplicate = new RegisterRequest("Another Person", "EXISTING@example.com", "Password123!");

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(duplicate)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.error").value("Conflict"))
                    .andExpect(jsonPath("$.message").value("An account with email existing@example.com already exists"));
        }

        @Test
        @DisplayName("Invalid registration payloads are rejected with HTTP 400 Bad Request")
        void invalidRegistrationPayloadsRejected() throws Exception {
            // 1. Blank display name
            RegisterRequest blankName = new RegisterRequest("", "valid@example.com", "Password123!");
            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(blankName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.displayName").exists());

            // 2. Malformed email
            RegisterRequest badEmail = new RegisterRequest("Valid Name", "not-an-email", "Password123!");
            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badEmail)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.email").exists());

            // 3. Short password (< 8 chars)
            RegisterRequest shortPassword = new RegisterRequest("Valid Name", "short@example.com", "short");
            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(shortPassword)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.password").exists());
        }

        @Test
        @DisplayName("Public registration cannot assign ADMIN role even if supplied in JSON")
        void cannotAssignAdminRoleViaRegistration() throws Exception {
            String jsonPayloadWithAdmin = """
                    {
                        "displayName": "Hacker Attempt",
                        "email": "hacker@example.com",
                        "password": "Password123!",
                        "role": "ADMIN"
                    }
                    """;

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(jsonPayloadWithAdmin))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.role").value("USER"));

            User user = userRepository.findByEmail("hacker@example.com").orElseThrow();
            assertThat(user.getRole()).isEqualTo(UserRole.USER);
        }
    }

    @Nested
    @DisplayName("Login Endpoint Tests")
    class LoginTests {

        @org.junit.jupiter.api.BeforeEach
        void cleanLoginRateLimitInNested() {
            if (loginAttemptRepository != null) {
                loginAttemptRepository.deleteAll();
            }
        }

        @Test
        @DisplayName("Successful login returns 200 and usable JWT access token")
        void successfulLogin() throws Exception {
            createTestUser("login.success@example.com", "CorrectPassword123", UserRole.USER, UserStatus.ACTIVE);

            LoginRequest request = new LoginRequest("LOGIN.SUCCESS@EXAMPLE.COM", "CorrectPassword123");

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email").value("login.success@example.com"))
                    .andExpect(jsonPath("$.accessToken").isString())
                    .andExpect(jsonPath("$.tokenType").value("Bearer"));
        }

        @Test
        @DisplayName("Incorrect password rejected with generic 401 without revealing account existence")
        void incorrectPasswordRejectedGenerically() throws Exception {
            createTestUser("existing.account@example.com", "CorrectPassword123", UserRole.USER, UserStatus.ACTIVE);

            LoginRequest wrongPassRequest = new LoginRequest("existing.account@example.com", "WrongPassword999");

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(wrongPassRequest)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401))
                    .andExpect(jsonPath("$.message").value("Invalid email or password"));
        }

        @Test
        @DisplayName("Non-existent email rejected with identical generic 401 error message")
        void nonexistentEmailRejectedGenerically() throws Exception {
            LoginRequest nonexistentRequest = new LoginRequest("ghost@example.com", "SomePassword123");

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(nonexistentRequest)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401))
                    .andExpect(jsonPath("$.message").value("Invalid email or password"));
        }

        @Test
        @DisplayName("Suspended user is rejected with HTTP 403 Forbidden")
        void suspendedUserCannotLogin() throws Exception {
            createTestUser("suspended@example.com", "Password123!", UserRole.USER, UserStatus.SUSPENDED);

            LoginRequest request = new LoginRequest("suspended@example.com", "Password123!");

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.message").value("Your account has been suspended. Please contact support."));
        }

        @Test
        @DisplayName("Deactivated user is rejected with HTTP 403 Forbidden")
        void deactivatedUserCannotLogin() throws Exception {
            createTestUser("deactivated@example.com", "Password123!", UserRole.USER, UserStatus.DEACTIVATED);

            LoginRequest request = new LoginRequest("deactivated@example.com", "Password123!");

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.message").value("Your account has been deactivated."));
        }
    }

    @Nested
    @DisplayName("Protected /me Endpoint & JWT Filter Tests")
    class ProtectedMeAndJwtFilterTests {

        @Test
        @DisplayName("Valid token can access GET /api/v1/auth/me")
        void validTokenCanAccessAuthMe() throws Exception {
            User user = createTestUser("profile.user@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(user.getId().toString()))
                    .andExpect(jsonPath("$.displayName").value("Test User"))
                    .andExpect(jsonPath("$.email").value("profile.user@example.com"))
                    .andExpect(jsonPath("$.role").value("USER"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist());
        }

        @Test
        @DisplayName("Missing Authorization header returns 401 Unauthorized")
        void missingTokenReturns401() throws Exception {
            mockMvc.perform(get("/api/v1/auth/me"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401))
                    .andExpect(jsonPath("$.error").value("Unauthorized"));
        }

        @Test
        @DisplayName("Malformed token returns 401 Unauthorized")
        void malformedTokenReturns401() throws Exception {
            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer not.a.valid.jwt.token"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401));
        }

        @Test
        @DisplayName("Expired token returns 401 Unauthorized")
        void expiredTokenReturns401() throws Exception {
            UUID userId = UUID.randomUUID();
            String expiredToken = Jwts.builder()
                    .subject(userId.toString())
                    .claim("email", "expired@example.com")
                    .claim("role", "USER")
                    .claim("status", "ACTIVE")
                    .issuedAt(new Date(System.currentTimeMillis() - 600000))
                    .expiration(new Date(System.currentTimeMillis() - 300000))
                    .signWith(Keys.hmacShaKeyFor("shareloop-dev-super-secret-key-that-is-at-least-32-bytes-long!".getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                    .compact();

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + expiredToken))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401));
        }

        @Test
        @DisplayName("Token with invalid signature returns 401 Unauthorized")
        void invalidSignatureTokenReturns401() throws Exception {
            UUID userId = UUID.randomUUID();
            String foreignToken = Jwts.builder()
                    .subject(userId.toString())
                    .claim("email", "fake@example.com")
                    .claim("role", "USER")
                    .claim("status", "ACTIVE")
                    .issuedAt(new Date())
                    .expiration(new Date(System.currentTimeMillis() + 3600000))
                    .signWith(Keys.hmacShaKeyFor("different-unauthorized-secret-key-of-32-bytes!".getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                    .compact();

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + foreignToken))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401));
        }

        @Test
        @DisplayName("Suspended user cannot access /me even with an unexpired previously issued token")
        void suspendedUserTokenRejected() throws Exception {
            User user = createTestUser("was.active@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            // Admin subsequently suspends the user
            user.setStatus(UserStatus.SUSPENDED);
            userRepository.saveAndFlush(user);

            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Health endpoint /api/health remains publicly accessible without token")
        void healthEndpointAccessibleWithoutToken() throws Exception {
            mockMvc.perform(get("/api/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("UP"))
                    .andExpect(jsonPath("$.service").value("shareloop-backend"));
        }

        @Test
        @DisplayName("Unauthenticated request to admin endpoint is rejected with 401 Unauthorized")
        void unauthenticatedAdminAccessRejected() throws Exception {
            mockMvc.perform(get("/api/v1/admin/dashboard"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401));
        }

        @Test
        @DisplayName("Authenticated USER account cannot access ADMIN endpoint, returning 403 Forbidden")
        void userRoleForbiddenFromAdminEndpoint() throws Exception {
            User user = createTestUser("regular.user@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            mockMvc.perform(get("/api/v1/admin/dashboard")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.error").value("Forbidden"))
                    .andExpect(jsonPath("$.message").value("Access is denied"));
        }

        @Test
        @DisplayName("Revoking ADMIN role in database immediately denies access for existing token")
        void revokedAdminRoleTakesEffectImmediatelyForExistingToken() throws Exception {
            User adminUser = createTestUser("promoted.admin@example.com", "Password123!", UserRole.ADMIN, UserStatus.ACTIVE);
            // Token issued while user was ADMIN (contains role: ADMIN claim)
            String adminToken = jwtService.generateToken(adminUser.getId(), adminUser.getEmail(), adminUser.getRole(), adminUser.getStatus());

            // User is demoted in database to USER
            adminUser.setRole(UserRole.USER);
            userRepository.saveAndFlush(adminUser);

            // Access to admin endpoint is denied with 403 because fresh DB role is used
            mockMvc.perform(get("/api/v1/admin/dashboard")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403));
        }
    }

    @Nested
    @DisplayName("Profile Update Endpoint Tests (PUT /api/v1/auth/me)")
    class ProfileUpdateTests {

        @Test
        @DisplayName("Authenticated user can update displayName and valid phone number")
        void updateDisplayNameAndPhoneNumberSuccessfully() throws Exception {
            User user = createTestUser("update.profile@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            UpdateProfileRequest request = new UpdateProfileRequest("Nguyễn Văn Updated", "0912345678");

            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(user.getId().toString()))
                    .andExpect(jsonPath("$.displayName").value("Nguyễn Văn Updated"))
                    .andExpect(jsonPath("$.email").value(user.getEmail()))
                    .andExpect(jsonPath("$.phoneNumber").value("0912345678"))
                    .andExpect(jsonPath("$.role").value("USER"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"));

            // Verify persistence in DB
            User updatedUser = userRepository.findById(user.getId()).orElseThrow();
            assertThat(updatedUser.getDisplayName()).isEqualTo("Nguyễn Văn Updated");
            assertThat(updatedUser.getPhoneNumber()).isEqualTo("0912345678");

            // Verify subsequent GET /api/v1/auth/me reflects the update
            mockMvc.perform(get("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.displayName").value("Nguyễn Văn Updated"))
                    .andExpect(jsonPath("$.phoneNumber").value("0912345678"));
        }

        @Test
        @DisplayName("Authenticated user can set phoneNumber to null or empty string to clear it")
        void clearingPhoneNumberSetsDatabaseNull() throws Exception {
            User user = createTestUser("clear.phone@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            user.setPhoneNumber("0987654321");
            userRepository.saveAndFlush(user);

            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            // 1. Update with empty string clears phone number to null
            UpdateProfileRequest emptyRequest = new UpdateProfileRequest("New Name 1", "");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(emptyRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.phoneNumber").isEmpty());

            User dbUser1 = userRepository.findById(user.getId()).orElseThrow();
            assertThat(dbUser1.getPhoneNumber()).isNull();

            // 2. Update with null clears phone number
            user.setPhoneNumber("0987654321");
            userRepository.saveAndFlush(user);

            UpdateProfileRequest nullRequest = new UpdateProfileRequest("New Name 2", null);
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(nullRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.phoneNumber").isEmpty());

            User dbUser2 = userRepository.findById(user.getId()).orElseThrow();
            assertThat(dbUser2.getPhoneNumber()).isNull();
        }

        @Test
        @DisplayName("Blank, null, or out-of-range displayName returns 400 Bad Request")
        void invalidDisplayNameRejectedWith400() throws Exception {
            User user = createTestUser("invalid.name@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            // Blank displayName
            UpdateProfileRequest blankRequest = new UpdateProfileRequest("   ", "0912345678");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(blankRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.displayName").exists());

            // Null displayName
            UpdateProfileRequest nullRequest = new UpdateProfileRequest(null, "0912345678");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(nullRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.displayName").exists());

            // Oversized displayName (> 100 chars)
            String overlong = "A".repeat(101);
            UpdateProfileRequest overlongRequest = new UpdateProfileRequest(overlong, "0912345678");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(overlongRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.displayName").exists());
        }

        @Test
        @DisplayName("Invalid phone number format returns 400 Bad Request before database check constraint")
        void invalidPhoneNumberFormatRejectedWith400() throws Exception {
            User user = createTestUser("invalid.phone@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

            // Legacy +84 format rejected
            UpdateProfileRequest legacyPlus84Request = new UpdateProfileRequest("Valid Name", "+84912345678");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(legacyPlus84Request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.phoneNumber").value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"));

            // 9-digit phone number rejected
            UpdateProfileRequest nineDigitsRequest = new UpdateProfileRequest("Valid Name", "091234567");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(nineDigitsRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.phoneNumber").value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"));

            // 11-digit phone number rejected
            UpdateProfileRequest elevenDigitsRequest = new UpdateProfileRequest("Valid Name", "09123456789");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(elevenDigitsRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.phoneNumber").value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"));

            // Non-numeric phone string
            UpdateProfileRequest nonNumericRequest = new UpdateProfileRequest("Valid Name", "abc-def-ghij");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(nonNumericRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.phoneNumber").value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"));

            // Whitespace-only phone number rejected
            UpdateProfileRequest whitespaceRequest = new UpdateProfileRequest("Valid Name", "    ");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(whitespaceRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.phoneNumber").value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"));

            // Punctuation / spaces inside phone number rejected
            UpdateProfileRequest punctuationRequest = new UpdateProfileRequest("Valid Name", "091-234-5678");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(punctuationRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.phoneNumber").value("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0"));
        }

        @Test
        @DisplayName("Unauthenticated update request returns 401 Unauthorized")
        void unauthenticatedUpdateRequestRejected() throws Exception {
            UpdateProfileRequest request = new UpdateProfileRequest("Valid Name", "0912345678");

            mockMvc.perform(put("/api/v1/auth/me")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Updating one user's profile cannot affect another user")
        void updatingProfileDoesNotAffectOtherUsers() throws Exception {
            User user1 = createTestUser("user1@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);
            User user2 = createTestUser("user2@example.com", "Password123!", UserRole.USER, UserStatus.ACTIVE);

            String token1 = jwtService.generateToken(user1.getId(), user1.getEmail(), user1.getRole(), user1.getStatus());

            UpdateProfileRequest request = new UpdateProfileRequest("User 1 Updated", "0911111111");
            mockMvc.perform(put("/api/v1/auth/me")
                            .header("Authorization", "Bearer " + token1)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());

            // Verify user 2 was completely unchanged
            User dbUser2 = userRepository.findById(user2.getId()).orElseThrow();
            assertThat(dbUser2.getDisplayName()).isEqualTo("Test User");
            assertThat(dbUser2.getPhoneNumber()).isNull();
            assertThat(dbUser2.getEmail()).isEqualTo("user2@example.com");
        }
    }
}
