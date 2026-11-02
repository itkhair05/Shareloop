package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.service.filestorage.LocalStorageService;
import com.shareloop.testsupport.TestStorageSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FileControllerIntegrationTest {

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
    private LocalStorageService localStorageService;

    private User alice;
    private String aliceToken;

    private final Set<String> uploadedFilenames = new HashSet<>();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        TestStorageSupport.registerIsolatedRoot(registry);
    }

    @BeforeEach
    void setUp() {
        TestStorageSupport.assertEffectiveRootIsIsolated(localStorageService.getRootPath());

        alice = userRepository.saveAndFlush(new User(
                "Alice Uploader",
                "alice.upload." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(alice.getId(), alice.getEmail(), alice.getRole(), alice.getStatus());
    }

    @AfterEach
    void tearDown() {
        TestStorageSupport.deleteOwnedFiles(localStorageService.getRootPath(), uploadedFilenames);
        uploadedFilenames.clear();

        if (alice != null && alice.getId() != null) {
            userRepository.deleteById(alice.getId());
        }
    }

    private void trackUploadResponse(String responseContent) throws IOException {
        uploadedFilenames.add(objectMapper.readTree(responseContent).get("filename").asText());
    }

    private byte[] createValidImage(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, format, baos);
        return baos.toByteArray();
    }

    private byte[] createPngHeaderWithDimensions(int width, int height) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        // PNG Signature (8 bytes)
        baos.write(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});

        // IHDR chunk
        ByteArrayOutputStream ihdr = new ByteArrayOutputStream();
        ihdr.write("IHDR".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        ihdr.write(java.nio.ByteBuffer.allocate(4).putInt(width).array());
        ihdr.write(java.nio.ByteBuffer.allocate(4).putInt(height).array());
        ihdr.write(8); // bit depth 8
        ihdr.write(2); // color type RGB
        ihdr.write(0); // compression method
        ihdr.write(0); // filter method
        ihdr.write(0); // interlace method

        byte[] ihdrData = ihdr.toByteArray();

        // 4 bytes length
        baos.write(java.nio.ByteBuffer.allocate(4).putInt(13).array());
        // chunk type and data
        baos.write(ihdrData);
        // CRC32
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        crc.update(ihdrData);
        baos.write(java.nio.ByteBuffer.allocate(4).putInt((int) crc.getValue()).array());

        return baos.toByteArray();
    }

    // =========================================================================
    // 1. Authentication and Authorization Tests
    // =========================================================================

    @Test
    @DisplayName("POST /api/v1/files/upload with valid JPEG returns 201 Created and safe DTO")
    void uploadFile_authenticatedValidJpeg_returns201WithSafeDto() throws Exception {
        byte[] jpegBytes = createValidImage("jpg", 100, 100);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "my_vacation_photo.jpg",
                "image/jpeg",
                jpegBytes
        );

        String responseContent = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.filename", endsWith(".jpg")))
                .andExpect(jsonPath("$.contentType", is("image/jpeg")))
                .andExpect(jsonPath("$.size", is(jpegBytes.length)))
                .andExpect(jsonPath("$.url", startsWith("/api/v1/files/")))
                // Ensure no server absolute filesystem path or credentials leaked
                .andExpect(jsonPath("$.url", not(containsString("uploads\\"))))
                .andExpect(jsonPath("$.url", not(containsString("C:\\"))))
                .andReturn().getResponse().getContentAsString();

        // Verify file actually exists in storage root
        String filename = objectMapper.readTree(responseContent).get("filename").asText();
        uploadedFilenames.add(filename);
        Path savedPath = localStorageService.getRootPath().resolve(filename);
        assertThat(Files.exists(savedPath)).isTrue();
        assertThat(Files.readAllBytes(savedPath)).isEqualTo(jpegBytes);
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with valid PNG returns 201 Created and safe DTO")
    void uploadFile_authenticatedValidPng_returns201WithSafeDto() throws Exception {
        byte[] pngBytes = createValidImage("png", 50, 50);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "item_diagram.png",
                "image/png",
                pngBytes
        );

        String responseContent = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.filename", endsWith(".png")))
                .andExpect(jsonPath("$.contentType", is("image/png")))
                .andExpect(jsonPath("$.size", is(pngBytes.length)))
                .andExpect(jsonPath("$.url", startsWith("/api/v1/files/")))
                .andReturn().getResponse().getContentAsString();

        trackUploadResponse(responseContent);
    }

    @Test
    @DisplayName("POST /api/v1/files/upload anonymous access returns 401 Unauthorized")
    void uploadFile_anonymous_returns401() throws Exception {
        byte[] jpegBytes = createValidImage("jpg", 10, 10);
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", jpegBytes);

        mockMvc.perform(multipart("/api/v1/files/upload").file(file))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // 2. Input Validation and Security Tests
    // =========================================================================

    @Test
    @DisplayName("POST /api/v1/files/upload with empty file returns 400 Bad Request")
    void uploadFile_emptyFile_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("empty")));
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with unsupported format (PDF) returns 400 Bad Request")
    void uploadFile_unsupportedFormat_returns400() throws Exception {
        byte[] pdfBytes = "%PDF-1.4 dummy pdf content".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "document.pdf", "application/pdf", pdfBytes);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("unsupported")));
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with fake JPEG magic bytes and corrupted body returns 400 Bad Request")
    void uploadFile_fakeJpegSignature_returns400() throws Exception {
        // Start with FF D8 FF (JPEG magic bytes) but follow with invalid binary data
        byte[] fakeJpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'F', 'A', 'K', 'E', 'D', 'A', 'T', 'A'};
        MockMultipartFile file = new MockMultipartFile("file", "fake.jpg", "image/jpeg", fakeJpeg);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("corrupted")));
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with declared PNG header but actual JPEG content succeeds and normalizes to JPEG")
    void uploadFile_mismatchedContentType_normalizesAndSucceeds() throws Exception {
        byte[] jpegBytes = createValidImage("jpg", 20, 20);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "mismatch.png", // Declares PNG, but payload is JPEG
                "image/png",
                jpegBytes
        );

        String responseContent = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.filename", endsWith(".jpg")))
                .andExpect(jsonPath("$.contentType").value("image/jpeg"))
                .andReturn().getResponse().getContentAsString();

        trackUploadResponse(responseContent);
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with declared JPEG header but actual PNG content succeeds and normalizes to PNG")
    void uploadFile_mismatchedPngDeclaredAsJpeg_normalizesAndSucceeds() throws Exception {
        byte[] pngBytes = createValidImage("png", 20, 20);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "mismatch.jpg", // Declares JPEG, but payload is PNG
                "image/jpeg",
                pngBytes
        );

        String responseContent = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.filename", endsWith(".png")))
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andReturn().getResponse().getContentAsString();

        trackUploadResponse(responseContent);
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with file exceeding 5 MiB returns 400 Bad Request")
    void uploadFile_exceeding5MiB_returns400() throws Exception {
        // 5 MiB + 1 byte
        byte[] largeBytes = new byte[5 * 1024 * 1024 + 1];
        largeBytes[0] = (byte) 0xFF;
        largeBytes[1] = (byte) 0xD8;
        largeBytes[2] = (byte) 0xFF;

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "large.jpg",
                "image/jpeg",
                largeBytes
        );

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("5 MiB")));
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with width exceeding 4,096 px returns 400 Bad Request before raster decoding")
    void uploadFile_widthExceeding4096_returns400BeforeDecode() throws Exception {
        byte[] oversizedHeader = createPngHeaderWithDimensions(4097, 100);
        MockMultipartFile file = new MockMultipartFile("file", "wide.png", "image/png", oversizedHeader);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("exceed the maximum permitted limit of 4096x4096 pixels")));
    }

    @Test
    @DisplayName("POST /api/v1/files/upload with height exceeding 4,096 px returns 400 Bad Request before raster decoding")
    void uploadFile_heightExceeding4096_returns400BeforeDecode() throws Exception {
        byte[] oversizedHeader = createPngHeaderWithDimensions(100, 4097);
        MockMultipartFile file = new MockMultipartFile("file", "tall.png", "image/png", oversizedHeader);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("exceed the maximum permitted limit of 4096x4096 pixels")));
    }

    @Test
    @DisplayName("POST /api/v1/files/upload exceeding 16,000,000 total pixels returns 400 Bad Request even when dimensions <= 4,096")
    void uploadFile_totalPixelsExceeding16MP_returns400BeforeDecode() throws Exception {
        // 4001 x 4000 = 16,004,000 total pixels (both <= 4096, but product > 16,000,000)
        byte[] oversizedPixels = createPngHeaderWithDimensions(4001, 4000);
        MockMultipartFile file = new MockMultipartFile("file", "dense.png", "image/png", oversizedPixels);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Total image pixels (16004000) exceed the maximum permitted limit of 16000000 pixels")));
    }

    // =========================================================================
    // 3. Path Traversal and Server-Side Filename Security
    // =========================================================================

    @Test
    @DisplayName("POST /api/v1/files/upload ignores client-supplied path traversal filename")
    void uploadFile_pathTraversalFilename_isSanitizedAndContained() throws Exception {
        byte[] jpegBytes = createValidImage("jpg", 20, 20);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "../../../../etc/passwd.jpg",
                "image/jpeg",
                jpegBytes
        );

        String responseContent = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String generatedFilename = objectMapper.readTree(responseContent).get("filename").asText();
        uploadedFilenames.add(generatedFilename);

        // Generated filename must be a clean UUID + .jpg, not the malicious client string
        assertThat(generatedFilename).doesNotContain("..");
        assertThat(generatedFilename).doesNotContain("passwd");
        assertThat(generatedFilename).matches("^[a-f0-9\\-]{36}\\.jpg$");

        Path savedPath = localStorageService.getRootPath().resolve(generatedFilename);
        assertThat(Files.exists(savedPath)).isTrue();
    }

    @Test
    @DisplayName("Invalid upload attempts leave no persistent files in storage")
    void uploadFile_invalidUpload_leavesNoPersistentFile() throws Exception {
        long initialCount;
        Path root = localStorageService.getRootPath();
        try (var stream = Files.list(root)) {
            initialCount = stream.count();
        }

        byte[] fakeBytes = "Not an image at all".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "fake.jpg", "image/jpeg", fakeBytes);

        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest());

        long finalCount;
        try (var stream = Files.list(root)) {
            finalCount = stream.count();
        }

        assertThat(finalCount).isEqualTo(initialCount);
    }

    // =========================================================================
    // 4. Content Serving Tests (GET /api/v1/files/{filename})
    // =========================================================================

    @Test
    @DisplayName("GET /api/v1/files/{filename} serves image with correct Content-Type and security headers")
    void getFile_existingImage_servedPubliclyWithSecurityHeaders() throws Exception {
        byte[] pngBytes = createValidImage("png", 32, 32);
        MockMultipartFile upload = new MockMultipartFile("file", "logo.png", "image/png", pngBytes);

        String responseContent = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(upload)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String filename = objectMapper.readTree(responseContent).get("filename").asText();
        uploadedFilenames.add(filename);

        // Anonymous retrieval of uploaded image must succeed
        mockMvc.perform(get("/api/v1/files/" + filename))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("inline")))
                .andExpect(content().bytes(pngBytes));
    }

    @Test
    @DisplayName("GET /api/v1/files/{filename} returns 404 for nonexistent file")
    void getFile_nonexistent_returns404() throws Exception {
        String randomFilename = UUID.randomUUID() + ".jpg";

        mockMvc.perform(get("/api/v1/files/" + randomFilename))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)));
    }

    @Test
    @DisplayName("GET /api/v1/files/{filename} rejects invalid or traversal filename with 404")
    void getFile_invalidOrTraversalFilename_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/files/invalid-filename-attempt.jpg"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)));

        // Directly verify storage service prevents directory traversal and rejects invalid filenames
        org.junit.jupiter.api.Assertions.assertThrows(
                com.shareloop.exception.ResourceNotFoundException.class,
                () -> localStorageService.loadAsResource("../../etc/passwd")
        );
        org.junit.jupiter.api.Assertions.assertThrows(
                com.shareloop.exception.ResourceNotFoundException.class,
                () -> localStorageService.loadAsResource("..\\..\\windows\\win.ini")
        );
    }
}
