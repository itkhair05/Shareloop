package com.shareloop.service.filestorage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageFileValidatorTest {

    private ImageFileValidator validator;

    @BeforeEach
    void setUp() {
        validator = new ImageFileValidator();
    }

    private byte[] createValidImage(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, format, baos);
        return baos.toByteArray();
    }

    @Test
    @DisplayName("Valid JPEG declared as image/jpeg succeeds with detected jpg and image/jpeg")
    void validate_validJpeg_succeeds() throws Exception {
        byte[] bytes = createValidImage("jpg", 50, 50);
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", bytes);

        ImageFileValidator.ValidationResult result = validator.validate(file);

        assertThat(result.extension()).isEqualTo("jpg");
        assertThat(result.contentType()).isEqualTo("image/jpeg");
        assertThat(result.bytes()).isEqualTo(bytes);
    }

    @Test
    @DisplayName("Valid PNG declared as image/png succeeds with detected png and image/png")
    void validate_validPng_succeeds() throws Exception {
        byte[] bytes = createValidImage("png", 50, 50);
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", bytes);

        ImageFileValidator.ValidationResult result = validator.validate(file);

        assertThat(result.extension()).isEqualTo("png");
        assertThat(result.contentType()).isEqualTo("image/png");
        assertThat(result.bytes()).isEqualTo(bytes);
    }

    @Test
    @DisplayName("Valid JPEG declared as image/png is normalized to detected jpg and image/jpeg")
    void validate_jpegDeclaredAsPng_normalizesToJpeg() throws Exception {
        byte[] bytes = createValidImage("jpg", 50, 50);
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", bytes);

        ImageFileValidator.ValidationResult result = validator.validate(file);

        assertThat(result.extension()).isEqualTo("jpg");
        assertThat(result.contentType()).isEqualTo("image/jpeg");
        assertThat(result.bytes()).isEqualTo(bytes);
    }

    @Test
    @DisplayName("Valid PNG declared as image/jpeg is normalized to detected png and image/png")
    void validate_pngDeclaredAsJpeg_normalizesToPng() throws Exception {
        byte[] bytes = createValidImage("png", 50, 50);
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", bytes);

        ImageFileValidator.ValidationResult result = validator.validate(file);

        assertThat(result.extension()).isEqualTo("png");
        assertThat(result.contentType()).isEqualTo("image/png");
        assertThat(result.bytes()).isEqualTo(bytes);
    }

    @Test
    @DisplayName("Empty file is rejected")
    void validate_emptyFile_throws() {
        MockMultipartFile file = new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }

    @Test
    @DisplayName("File exceeding 5 MiB is rejected")
    void validate_exceeding5MiB_throws() {
        byte[] largeBytes = new byte[5 * 1024 * 1024 + 1];
        largeBytes[0] = (byte) 0xFF;
        largeBytes[1] = (byte) 0xD8;
        largeBytes[2] = (byte) 0xFF;
        MockMultipartFile file = new MockMultipartFile("file", "large.jpg", "image/jpeg", largeBytes);

        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("5 MiB");
    }

    @Test
    @DisplayName("Unsupported file type (PDF) is rejected")
    void validate_unsupportedPdf_throws() {
        byte[] pdfBytes = "%PDF-1.4 dummy content".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "doc.pdf", "application/pdf", pdfBytes);

        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported file type");
    }

    @Test
    @DisplayName("SVG file is rejected")
    void validate_svgFile_throws() {
        byte[] svgBytes = "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"10\"/></svg>".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "avatar.svg", "image/svg+xml", svgBytes);

        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported file type");
    }

    @Test
    @DisplayName("Corrupted/fake image bytes are rejected")
    void validate_corruptedImage_throws() {
        byte[] fakeJpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'F', 'A', 'K', 'E', 'B', 'Y', 'T', 'E', 'S'};
        MockMultipartFile file = new MockMultipartFile("file", "fake.jpg", "image/jpeg", fakeJpeg);

        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Corrupted or undecodable image file");
    }

    @Test
    @DisplayName("Declared unsupported Content-Type (image/svg+xml) on genuine JPEG is rejected")
    void validate_unsupportedDeclaredContentType_throws() throws Exception {
        byte[] jpegBytes = createValidImage("jpg", 30, 30);
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/svg+xml", jpegBytes);

        assertThatThrownBy(() -> validator.validate(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Declared content type is not supported");
    }
}
