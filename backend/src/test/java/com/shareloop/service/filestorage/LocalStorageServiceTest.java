package com.shareloop.service.filestorage;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.exception.StorageException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalStorageServiceTest {

    @TempDir
    Path tempStorageDir;

    private LocalStorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new LocalStorageService(tempStorageDir.toString(), "/api/v1/files");
        storageService.init();
    }

    @Test
    @DisplayName("Successfully delete an existing UUID .jpg file")
    void delete_existingJpgFile_returnsTrueAndRemovesFile() throws IOException {
        String filename = UUID.randomUUID() + ".jpg";
        Path filePath = tempStorageDir.resolve(filename);
        Files.write(filePath, "fake-jpg-content".getBytes());
        assertThat(Files.exists(filePath)).isTrue();

        boolean result = storageService.delete(filename);

        assertThat(result).isTrue();
        assertThat(Files.exists(filePath)).isFalse();
    }

    @Test
    @DisplayName("Successfully delete an existing UUID .png file")
    void delete_existingPngFile_returnsTrueAndRemovesFile() throws IOException {
        String filename = UUID.randomUUID() + ".png";
        Path filePath = tempStorageDir.resolve(filename);
        Files.write(filePath, "fake-png-content".getBytes());
        assertThat(Files.exists(filePath)).isTrue();

        boolean result = storageService.delete(filename);

        assertThat(result).isTrue();
        assertThat(Files.exists(filePath)).isFalse();
    }

    @Test
    @DisplayName("Deleting a nonexistent file with valid UUID filename returns false")
    void delete_nonExistentValidFilename_returnsFalse() {
        String filename = UUID.randomUUID() + ".jpg";

        boolean result = storageService.delete(filename);

        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("Delete rejects null and blank filename without touching filesystem")
    void delete_nullOrBlankFilename_returnsFalse() {
        assertThat(storageService.delete(null)).isFalse();
        assertThat(storageService.delete("")).isFalse();
        assertThat(storageService.delete("   ")).isFalse();
    }

    @Test
    @DisplayName("Delete rejects arbitrary/non-UUID filenames")
    void delete_arbitraryFilename_returnsFalse() {
        assertThat(storageService.delete("avatar.jpg")).isFalse();
        assertThat(storageService.delete("script.sh")).isFalse();
        assertThat(storageService.delete("photo.png")).isFalse();
        assertThat(storageService.delete("12345.jpg")).isFalse();
    }

    @Test
    @DisplayName("Delete rejects path traversal attempts")
    void delete_pathTraversalAttempt_returnsFalse() {
        assertThat(storageService.delete("../" + UUID.randomUUID() + ".jpg")).isFalse();
        assertThat(storageService.delete("../../etc/passwd")).isFalse();
        assertThat(storageService.delete("..\\uploads\\" + UUID.randomUUID() + ".jpg")).isFalse();
    }

    @Test
    @DisplayName("Delete rejects absolute paths")
    void delete_absolutePath_returnsFalse() {
        assertThat(storageService.delete("/tmp/" + UUID.randomUUID() + ".jpg")).isFalse();
        assertThat(storageService.delete("C:\\uploads\\" + UUID.randomUUID() + ".jpg")).isFalse();
    }

    @Test
    @DisplayName("Delete rejects full URLs")
    void delete_fullUrl_returnsFalse() {
        assertThat(storageService.delete("http://localhost:8080/api/v1/files/" + UUID.randomUUID() + ".jpg")).isFalse();
        assertThat(storageService.delete("https://lh3.googleusercontent.com/a/photo.jpg")).isFalse();
    }

    @Test
    @DisplayName("Delete rejects unsupported extensions (e.g. svg, gif, webp)")
    void delete_unsupportedExtension_returnsFalse() {
        assertThat(storageService.delete(UUID.randomUUID() + ".svg")).isFalse();
        assertThat(storageService.delete(UUID.randomUUID() + ".gif")).isFalse();
        assertThat(storageService.delete(UUID.randomUUID() + ".webp")).isFalse();
        assertThat(storageService.delete(UUID.randomUUID() + ".exe")).isFalse();
    }

    @Test
    @DisplayName("Full lifecycle: store file, verify load, delete file, verify load fails")
    void lifecycle_storeLoadDelete_verified() {
        byte[] content = "valid-image-bytes".getBytes();
        FileUploadResponse response = storageService.store(content, "jpg", "image/jpeg");

        assertThat(response.getFilename()).isNotNull();
        Resource resource = storageService.loadAsResource(response.getFilename());
        assertThat(resource.exists()).isTrue();

        boolean deleted = storageService.delete(response.getFilename());
        assertThat(deleted).isTrue();

        assertThatThrownBy(() -> storageService.loadAsResource(response.getFilename()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
