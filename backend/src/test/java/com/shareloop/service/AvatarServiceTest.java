package com.shareloop.service;

import com.shareloop.dto.auth.UserProfileResponse;
import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.InvalidTokenException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.UserRepository;
import com.shareloop.service.filestorage.FileStorageService;
import com.shareloop.service.filestorage.ImageFileValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AvatarServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private ImageFileValidator imageFileValidator;

    @Mock
    private PlatformTransactionManager transactionManager;

    private AvatarService avatarService;

    @BeforeEach
    void setUp() {
        // Execute transaction callback directly synchronously in unit tests
        lenient().when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        avatarService = new AvatarService(userRepository, fileStorageService, imageFileValidator, transactionManager);
    }

    @Test
    @DisplayName("Upload avatar: success updates user and cleans up previous custom avatar")
    void uploadAvatar_success_updatesUserAndCleansUpPrevious() {
        UUID userId = UUID.randomUUID();
        String oldFilename = "11111111-1111-1111-1111-111111111111.jpg";
        String newFilename = "22222222-2222-2222-2222-222222222222.png";
        String oldAvatarUrl = "/api/v1/files/" + oldFilename;
        String newAvatarUrl = "/api/v1/files/" + newFilename;

        User user = new User("Linh", "linh@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setId(userId);
        user.setAvatarUrl(oldAvatarUrl);
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar");

        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});
        ImageFileValidator.ValidationResult valResult = new ImageFileValidator.ValidationResult(new byte[]{1, 2, 3}, "png", "image/png");
        FileUploadResponse uploadResponse = new FileUploadResponse(UUID.randomUUID().toString(), newFilename, "image/png", 3, newAvatarUrl);

        when(imageFileValidator.validate(file)).thenReturn(valResult);
        when(fileStorageService.store(valResult.bytes(), "png", "image/png")).thenReturn(uploadResponse);
        when(userRepository.findByIdForUpdate(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserProfileResponse response = avatarService.uploadAvatar(userId, file);

        assertThat(response).isNotNull();
        assertThat(response.getAvatarUrl()).isEqualTo(newAvatarUrl);
        assertThat(response.getCustomAvatarUrl()).isEqualTo(newAvatarUrl);
        assertThat(response.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/a/google-avatar");

        // Verify previous custom avatar was deleted post-commit
        verify(fileStorageService).delete(oldFilename);
        // Verify new file was NOT deleted
        verify(fileStorageService, never()).delete(newFilename);
    }

    @Test
    @DisplayName("Upload avatar compensation: when DB fails, newly saved file is deleted")
    void uploadAvatar_dbFailure_compensatesNewFile() {
        UUID userId = UUID.randomUUID();
        String newFilename = "33333333-3333-3333-3333-333333333333.jpg";
        String newAvatarUrl = "/api/v1/files/" + newFilename;

        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2, 3});
        ImageFileValidator.ValidationResult valResult = new ImageFileValidator.ValidationResult(new byte[]{1, 2, 3}, "jpg", "image/jpeg");
        FileUploadResponse uploadResponse = new FileUploadResponse(UUID.randomUUID().toString(), newFilename, "image/jpeg", 3, newAvatarUrl);

        when(imageFileValidator.validate(file)).thenReturn(valResult);
        when(fileStorageService.store(valResult.bytes(), "jpg", "image/jpeg")).thenReturn(uploadResponse);
        when(userRepository.findByIdForUpdate(userId)).thenThrow(new RuntimeException("Database connection timeout"));

        assertThatThrownBy(() -> avatarService.uploadAvatar(userId, file))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Database connection timeout");

        // Verify compensation: newly saved file deleted
        verify(fileStorageService).delete(newFilename);
    }

    @Test
    @DisplayName("Upload avatar: missing or null principal throws InvalidTokenException without file operations")
    void uploadAvatar_nullUserId_throwsInvalidTokenException() {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> avatarService.uploadAvatar(null, file))
                .isInstanceOf(InvalidTokenException.class);

        verifyNoInteractions(fileStorageService);
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("Upload avatar: empty file throws IllegalArgumentException without storage operations")
    void uploadAvatar_emptyFile_throwsIllegalArgumentException() {
        UUID userId = UUID.randomUUID();
        MockMultipartFile emptyFile = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> avatarService.uploadAvatar(userId, emptyFile))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(fileStorageService);
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("Delete avatar: success sets avatar_url to null and deletes file from disk")
    void deleteAvatar_success_clearsAvatarUrlAndDeletesFile() {
        UUID userId = UUID.randomUUID();
        String oldFilename = "44444444-4444-4444-4444-444444444444.jpg";
        String oldAvatarUrl = "/api/v1/files/" + oldFilename;

        User user = new User("Linh", "linh@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setId(userId);
        user.setAvatarUrl(oldAvatarUrl);
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar");

        when(userRepository.findByIdForUpdate(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserProfileResponse response = avatarService.deleteAvatar(userId);

        assertThat(response).isNotNull();
        assertThat(response.getAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/a/google-avatar");
        assertThat(response.getCustomAvatarUrl()).isNull();
        assertThat(response.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/a/google-avatar");

        // Verify file deleted
        verify(fileStorageService).delete(oldFilename);
    }

    @Test
    @DisplayName("Delete avatar: idempotent when user has no custom avatar")
    void deleteAvatar_noCustomAvatar_isIdempotent() {
        UUID userId = UUID.randomUUID();

        User user = new User("Linh", "linh@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setId(userId);
        user.setAvatarUrl(null);
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar");

        when(userRepository.findByIdForUpdate(userId)).thenReturn(Optional.of(user));

        UserProfileResponse response = avatarService.deleteAvatar(userId);

        assertThat(response).isNotNull();
        assertThat(response.getCustomAvatarUrl()).isNull();
        assertThat(response.getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/a/google-avatar");

        // Verify save and fileStorage delete were not called
        verify(userRepository, never()).save(any());
        verify(fileStorageService, never()).delete(any());
    }

    @Test
    @DisplayName("Delete avatar: Google avatar URL is NEVER passed to local file deletion")
    void deleteAvatar_googleAvatar_neverDeletedFromStorage() {
        UUID userId = UUID.randomUUID();

        User user = new User("Linh", "linh@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setId(userId);
        user.setAvatarUrl(null); // No custom avatar
        user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-avatar");

        when(userRepository.findByIdForUpdate(userId)).thenReturn(Optional.of(user));

        avatarService.deleteAvatar(userId);

        verify(fileStorageService, never()).delete(any());
    }

    @Test
    @DisplayName("extractManagedFilename: accurately parses managed paths and rejects unsafe/external paths")
    void extractManagedFilename_parsesValidAndRejectsInvalid() {
        String uuid = "550e8400-e29b-41d4-a716-446655440000";

        // Valid relative path
        assertThat(avatarService.extractManagedFilename("/api/v1/files/" + uuid + ".jpg"))
                .isEqualTo(uuid + ".jpg");

        // Valid relative PNG path
        assertThat(avatarService.extractManagedFilename("/api/v1/files/" + uuid + ".png"))
                .isEqualTo(uuid + ".png");

        // Valid full localhost URL
        assertThat(avatarService.extractManagedFilename("http://localhost:8080/api/v1/files/" + uuid + ".jpg"))
                .isEqualTo(uuid + ".jpg");

        // External Google URL -> must return null
        assertThat(avatarService.extractManagedFilename("https://lh3.googleusercontent.com/a/photo.jpg"))
                .isNull();

        // Arbitrary filename -> must return null
        assertThat(avatarService.extractManagedFilename("/api/v1/files/avatar.jpg"))
                .isNull();

        // Path traversal -> must return null
        assertThat(avatarService.extractManagedFilename("/api/v1/files/../../secret.txt"))
                .isNull();

        // Null and blank -> must return null
        assertThat(avatarService.extractManagedFilename(null)).isNull();
        assertThat(avatarService.extractManagedFilename("   ")).isNull();
    }
}
