package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.service.AvatarService;
import com.shareloop.service.filestorage.LocalStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class AvatarControllerIntegrationTest {

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
    private AvatarService avatarService;

    @Autowired
    private LocalStorageService localStorageService;

    private User testUser;
    private String userToken;

    @BeforeEach
    void setUp() {
        testUser = new User(
                "Avatar Tester",
                "avatar.tester." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        );
        testUser.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar-test");
        testUser = userRepository.saveAndFlush(testUser);

        userToken = jwtService.generateToken(
                testUser.getId(),
                testUser.getEmail(),
                testUser.getRole(),
                testUser.getStatus()
        );
    }

    private byte[] createTestImage(String format) throws IOException {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, format, baos);
        return baos.toByteArray();
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Successfully upload valid JPEG custom avatar")
    void uploadAvatar_validJpeg_success() throws Exception {
        byte[] jpegBytes = createTestImage("jpg");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", jpegBytes);

        String responseBody = mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(testUser.getId().toString()))
                .andExpect(jsonPath("$.avatarUrl").isString())
                .andExpect(jsonPath("$.customAvatarUrl").isString())
                .andExpect(jsonPath("$.googleAvatarUrl").value("https://lh3.googleusercontent.com/a/google-avatar-test"))
                .andReturn().getResponse().getContentAsString();

        UserProfileResponse response = objectMapper.readValue(responseBody, UserProfileResponse.class);
        assertThat(response.getAvatarUrl()).startsWith("/api/v1/files/");
        assertThat(response.getCustomAvatarUrl()).isEqualTo(response.getAvatarUrl());

        // Verify file exists on disk
        String filename = avatarService.extractManagedFilename(response.getAvatarUrl());
        assertThat(filename).isNotNull();
        Path filePath = localStorageService.getRootPath().resolve(filename);
        assertThat(Files.exists(filePath)).isTrue();
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Successfully upload valid PNG custom avatar")
    void uploadAvatar_validPng_success() throws Exception {
        byte[] pngBytes = createTestImage("png");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", pngBytes);

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.endsWith(".png")))
                .andExpect(jsonPath("$.customAvatarUrl").value(org.hamcrest.Matchers.endsWith(".png")));
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: JPEG payload declared as image/png is accepted and normalized to .jpg")
    void uploadAvatar_jpegDeclaredAsPng_succeedsAndNormalizes() throws Exception {
        byte[] jpegBytes = createTestImage("jpg");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", jpegBytes);

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.endsWith(".jpg")))
                .andExpect(jsonPath("$.customAvatarUrl").value(org.hamcrest.Matchers.endsWith(".jpg")));
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: PNG payload declared as image/jpeg is accepted and normalized to .png")
    void uploadAvatar_pngDeclaredAsJpeg_succeedsAndNormalizes() throws Exception {
        byte[] pngBytes = createTestImage("png");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", pngBytes);

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.endsWith(".png")))
                .andExpect(jsonPath("$.customAvatarUrl").value(org.hamcrest.Matchers.endsWith(".png")));
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Replacing custom avatar cleans up old file and persists new")
    void uploadAvatar_replaceExisting_cleansUpOldFile() throws Exception {
        // First upload
        byte[] firstBytes = createTestImage("jpg");
        MockMultipartFile firstFile = new MockMultipartFile("file", "first.jpg", "image/jpeg", firstBytes);
        String firstRespBody = mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(firstFile)
                        .header("Authorization", "Bearer " + userToken)
        ).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        UserProfileResponse firstResp = objectMapper.readValue(firstRespBody, UserProfileResponse.class);
        String firstFilename = avatarService.extractManagedFilename(firstResp.getAvatarUrl());
        Path firstPath = localStorageService.getRootPath().resolve(firstFilename);
        assertThat(Files.exists(firstPath)).isTrue();

        // Second upload (replacement)
        byte[] secondBytes = createTestImage("png");
        MockMultipartFile secondFile = new MockMultipartFile("file", "second.png", "image/png", secondBytes);
        String secondRespBody = mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(secondFile)
                        .header("Authorization", "Bearer " + userToken)
        ).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        UserProfileResponse secondResp = objectMapper.readValue(secondRespBody, UserProfileResponse.class);
        String secondFilename = avatarService.extractManagedFilename(secondResp.getAvatarUrl());
        Path secondPath = localStorageService.getRootPath().resolve(secondFilename);

        assertThat(secondFilename).isNotEqualTo(firstFilename);
        assertThat(Files.exists(secondPath)).isTrue();
        // Old file must be cleaned up
        assertThat(Files.exists(firstPath)).isFalse();
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Empty file returns 400 Bad Request")
    void uploadAvatar_emptyFile_badRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Corrupted/fake image file returns 400 Bad Request")
    void uploadAvatar_fakeImage_badRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "fake.jpg", "image/jpeg", "not-a-real-jpeg".getBytes());

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: SVG file is rejected with 400 Bad Request")
    void uploadAvatar_svgFile_badRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.svg", "image/svg+xml", "<svg></svg>".getBytes());

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Unauthenticated request is rejected with 401")
    void uploadAvatar_unauthenticated_rejected() throws Exception {
        byte[] jpegBytes = createTestImage("jpg");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", jpegBytes);

        mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
        )
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PUT /api/v1/auth/me/avatar: Request with Content-Type application/json returns 415 Unsupported Media Type")
    void uploadAvatar_nonMultipartContentType_returns415() throws Exception {
        mockMvc.perform(
                MockMvcRequestBuilders.put("/api/v1/auth/me/avatar")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.status").value(415))
                .andExpect(jsonPath("$.error").value("Unsupported Media Type"));
    }

    @Test
    @DisplayName("DELETE /api/v1/auth/me/avatar: Successfully delete custom avatar and restore Google fallback")
    void deleteAvatar_withCustomAvatar_restoresGoogleFallback() throws Exception {
        // Upload custom avatar first
        byte[] jpegBytes = createTestImage("jpg");
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", jpegBytes);
        String uploadResp = mockMvc.perform(
                MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/v1/auth/me/avatar")
                        .file(file)
                        .header("Authorization", "Bearer " + userToken)
        ).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        UserProfileResponse profileAfterUpload = objectMapper.readValue(uploadResp, UserProfileResponse.class);
        String filename = avatarService.extractManagedFilename(profileAfterUpload.getAvatarUrl());
        Path filePath = localStorageService.getRootPath().resolve(filename);
        assertThat(Files.exists(filePath)).isTrue();

        // Delete custom avatar
        String deleteResp = mockMvc.perform(
                delete("/api/v1/auth/me/avatar")
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customAvatarUrl").doesNotExist())
                .andExpect(jsonPath("$.googleAvatarUrl").value("https://lh3.googleusercontent.com/a/google-avatar-test"))
                .andExpect(jsonPath("$.avatarUrl").value("https://lh3.googleusercontent.com/a/google-avatar-test"))
                .andReturn().getResponse().getContentAsString();

        // Verify file deleted from disk
        assertThat(Files.exists(filePath)).isFalse();

        // Verify database state
        User updated = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(updated.getAvatarUrl()).isNull();
        assertThat(updated.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/a/google-avatar-test");
    }

    @Test
    @DisplayName("DELETE /api/v1/auth/me/avatar: Idempotent when no custom avatar exists")
    void deleteAvatar_noCustomAvatar_isIdempotent() throws Exception {
        mockMvc.perform(
                delete("/api/v1/auth/me/avatar")
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customAvatarUrl").doesNotExist())
                .andExpect(jsonPath("$.googleAvatarUrl").value("https://lh3.googleusercontent.com/a/google-avatar-test"))
                .andExpect(jsonPath("$.avatarUrl").value("https://lh3.googleusercontent.com/a/google-avatar-test"));
    }

    @Test
    @DisplayName("DELETE /api/v1/auth/me/avatar: Without Google avatar, effective avatar becomes null")
    void deleteAvatar_withoutGoogleAvatar_effectiveBecomesNull() throws Exception {
        testUser.setGoogleAvatarUrl(null);
        userRepository.saveAndFlush(testUser);

        mockMvc.perform(
                delete("/api/v1/auth/me/avatar")
                        .header("Authorization", "Bearer " + userToken)
        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customAvatarUrl").doesNotExist())
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());
    }

    @Test
    @DisplayName("DELETE /api/v1/auth/me/avatar: Unauthenticated request is rejected with 401")
    void deleteAvatar_unauthenticated_rejected() throws Exception {
        mockMvc.perform(delete("/api/v1/auth/me/avatar"))
                .andExpect(status().isUnauthorized());
    }
}
