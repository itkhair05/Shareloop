package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.GoogleLoginRequest;
import com.shareloop.entity.User;
import com.shareloop.entity.UserIdentity;
import com.shareloop.entity.enums.IdentityProvider;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GoogleAvatarSyncIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserIdentityRepository userIdentityRepository;

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

    @Test
    @DisplayName("1. Google registration with picture URL persists google_avatar_url and resolves effective avatar")
    void registration_withPictureUrl_persistsGoogleAvatar() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "reg.avatar." + UUID.randomUUID() + "@shareloop.vn";
        String picture = "https://lh3.googleusercontent.com/a/initial-photo.jpg";

        when(googleIdTokenVerifierService.verify("token-reg-1"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Google Newbie", picture));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-reg-1"))))
                .andExpect(status().isOk());

        User user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getGoogleAvatarUrl()).isEqualTo(picture);
        assertThat(user.getAvatarUrl()).isNull();
        assertThat(user.getEffectiveAvatarUrl()).isEqualTo(picture);
        assertThat(user.getAvatarUpdatedAt()).isNull();

        String token = "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());
        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(picture))
                .andExpect(jsonPath("$.customAvatarUrl").isEmpty())
                .andExpect(jsonPath("$.googleAvatarUrl").value(picture));
    }

    @Test
    @DisplayName("2. Google registration without picture URL leaves both avatar fields null")
    void registration_withoutPictureUrl_leavesAvatarsNull() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "reg.nopic." + UUID.randomUUID() + "@shareloop.vn";

        when(googleIdTokenVerifierService.verify("token-reg-2"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Google NoPic", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-reg-2"))))
                .andExpect(status().isOk());

        User user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getGoogleAvatarUrl()).isNull();
        assertThat(user.getAvatarUrl()).isNull();
        assertThat(user.getEffectiveAvatarUrl()).isNull();
    }

    @Test
    @DisplayName("3. Existing Google login with changed picture URL synchronizes updated google_avatar_url")
    void existingLogin_changedPictureUrl_updatesGoogleAvatar() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "login.change." + UUID.randomUUID() + "@shareloop.vn";
        String oldPic = "https://lh3.googleusercontent.com/a/old-pic.jpg";
        String newPic = "https://lh3.googleusercontent.com/a/new-pic-2026.jpg";

        User user = new User("User One", email, null, UserRole.USER, UserStatus.ACTIVE);
        user.setGoogleAvatarUrl(oldPic);
        user = userRepository.saveAndFlush(user);
        userIdentityRepository.saveAndFlush(new UserIdentity(user, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("token-login-changed"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "User One", newPic));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-login-changed"))))
                .andExpect(status().isOk());

        User updatedUser = userRepository.findById(user.getId()).orElseThrow();
        assertThat(updatedUser.getGoogleAvatarUrl()).isEqualTo(newPic);
        assertThat(updatedUser.getEffectiveAvatarUrl()).isEqualTo(newPic);
    }

    @Test
    @DisplayName("4. Existing Google login with unchanged picture URL preserves state")
    void existingLogin_unchangedPictureUrl_preservesState() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "login.same." + UUID.randomUUID() + "@shareloop.vn";
        String samePic = "https://lh3.googleusercontent.com/a/same-pic.jpg";

        User user = new User("User Same", email, null, UserRole.USER, UserStatus.ACTIVE);
        user.setGoogleAvatarUrl(samePic);
        user = userRepository.saveAndFlush(user);
        userIdentityRepository.saveAndFlush(new UserIdentity(user, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("token-login-same"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "User Same", samePic));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-login-same"))))
                .andExpect(status().isOk());

        User reloadedUser = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloadedUser.getGoogleAvatarUrl()).isEqualTo(samePic);
    }

    @Test
    @DisplayName("5. Existing Google login without picture URL preserves previously stored Google avatar")
    void existingLogin_withoutPictureUrl_preservesExistingGoogleAvatar() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "login.preserve." + UUID.randomUUID() + "@shareloop.vn";
        String existingPic = "https://lh3.googleusercontent.com/a/existing-pic.jpg";

        User user = new User("User Preserve", email, null, UserRole.USER, UserStatus.ACTIVE);
        user.setGoogleAvatarUrl(existingPic);
        user = userRepository.saveAndFlush(user);
        userIdentityRepository.saveAndFlush(new UserIdentity(user, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("token-login-nopic"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "User Preserve", null));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-login-nopic"))))
                .andExpect(status().isOk());

        User reloadedUser = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloadedUser.getGoogleAvatarUrl()).isEqualTo(existingPic);
        assertThat(reloadedUser.getEffectiveAvatarUrl()).isEqualTo(existingPic);
    }

    @Test
    @DisplayName("6 & 7. Existing user with custom avatar logs in via Google: updates google_avatar_url but custom avatar takes priority and is never overwritten")
    void existingUserWithCustomAvatar_googleLoginDoesNotOverwriteCustom() throws Exception {
        String sub = "google-sub-" + UUID.randomUUID();
        String email = "custom.avatar." + UUID.randomUUID() + "@shareloop.vn";
        String customUrl = "/api/v1/files/my-uploaded-avatar.png";
        String newGooglePic = "https://lh3.googleusercontent.com/a/brand-new-google.jpg";

        User user = new User("Custom User", email, null, UserRole.USER, UserStatus.ACTIVE);
        user.updateCustomAvatar(customUrl);
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/initial.jpg");
        user = userRepository.saveAndFlush(user);
        userIdentityRepository.saveAndFlush(new UserIdentity(user, IdentityProvider.GOOGLE, sub, email));

        when(googleIdTokenVerifierService.verify("token-custom-user"))
                .thenReturn(new GoogleUserClaims(sub, email, true, "Custom User", newGooglePic));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-custom-user"))))
                .andExpect(status().isOk());

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        // Google avatar updated in background
        assertThat(reloaded.getGoogleAvatarUrl()).isEqualTo(newGooglePic);
        // Custom avatar is untouched
        assertThat(reloaded.getAvatarUrl()).isEqualTo(customUrl);
        // Effective avatar is strictly the custom avatar
        assertThat(reloaded.getEffectiveAvatarUrl()).isEqualTo(customUrl);
    }

    @Test
    @DisplayName("8. Google account linking with picture URL synchronizes google_avatar_url")
    void linkGoogleAccount_withPictureUrl_syncsGoogleAvatar() throws Exception {
        String email = "link.user." + UUID.randomUUID() + "@shareloop.vn";
        User user = userRepository.saveAndFlush(new User("Link User", email, "passHash", UserRole.USER, UserStatus.ACTIVE));
        String token = "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

        String sub = "google-sub-link-" + UUID.randomUUID();
        String googlePic = "https://lh3.googleusercontent.com/a/linked-photo.jpg";

        when(googleIdTokenVerifierService.verify("token-link-pic"))
                .thenReturn(new GoogleUserClaims(sub, "google.link@gmail.com", true, "Link User", googlePic));

        mockMvc.perform(post("/api/v1/auth/google/link")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-link-pic"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(true));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getGoogleAvatarUrl()).isEqualTo(googlePic);
        assertThat(reloaded.getEffectiveAvatarUrl()).isEqualTo(googlePic);
    }

    @Test
    @DisplayName("9. Google account linking without picture URL does not fail and leaves Google avatar null")
    void linkGoogleAccount_withoutPictureUrl_succeedsWithoutAvatar() throws Exception {
        String email = "link.nopic." + UUID.randomUUID() + "@shareloop.vn";
        User user = userRepository.saveAndFlush(new User("Link NoPic", email, "passHash", UserRole.USER, UserStatus.ACTIVE));
        String token = "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

        String sub = "google-sub-link-nopic-" + UUID.randomUUID();

        when(googleIdTokenVerifierService.verify("token-link-nopic"))
                .thenReturn(new GoogleUserClaims(sub, "google.nopic@gmail.com", true, "Link NoPic", null));

        mockMvc.perform(post("/api/v1/auth/google/link")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new GoogleLoginRequest("token-link-nopic"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(true));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getGoogleAvatarUrl()).isNull();
        assertThat(reloaded.getEffectiveAvatarUrl()).isNull();
    }

    @Test
    @DisplayName("10. Deleting custom avatar restores synchronized Google picture as effective avatar")
    void deleteCustomAvatar_restoresSynchronizedGooglePicture() throws Exception {
        String googlePic = "https://lh3.googleusercontent.com/a/synced-photo.jpg";
        String customUrl = "/api/v1/files/e9b89ad3-bce5-419b-a010-06487ffc76c0.png";

        User user = new User("Delete Custom User", "del." + UUID.randomUUID() + "@shareloop.vn", "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setGoogleAvatarUrl(googlePic);
        user.updateCustomAvatar(customUrl);
        user = userRepository.saveAndFlush(user);

        String token = "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole(), user.getStatus());

        // Prior to deletion: custom
        assertThat(user.getEffectiveAvatarUrl()).isEqualTo(customUrl);

        // Delete custom avatar
        mockMvc.perform(delete("/api/v1/auth/me/avatar")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(googlePic))
                .andExpect(jsonPath("$.customAvatarUrl").isEmpty())
                .andExpect(jsonPath("$.googleAvatarUrl").value(googlePic));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getAvatarUrl()).isNull();
        assertThat(reloaded.getGoogleAvatarUrl()).isEqualTo(googlePic);
        assertThat(reloaded.getEffectiveAvatarUrl()).isEqualTo(googlePic);
    }
}
