package com.shareloop.service;

import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.StorageException;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.filestorage.FileStorageService;
import com.shareloop.service.filestorage.ImageFileValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FileUploadServiceTest {

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private ImageFileValidator imageFileValidator;

    @Mock
    private UploadedFileRepository uploadedFileRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserPrincipal principal;

    private FileUploadService fileUploadService;

    private final UUID userId = UUID.randomUUID();
    private final UUID fileId = UUID.randomUUID();
    private final byte[] bytes = new byte[]{1, 2, 3, 4};
    private MockMultipartFile multipartFile;
    private FileUploadResponse storedResponse;

    @BeforeEach
    void setUp() {
        fileUploadService = new FileUploadService(
                fileStorageService,
                imageFileValidator,
                uploadedFileRepository,
                userRepository
        );
        multipartFile = new MockMultipartFile("file", "photo.png", "image/png", bytes);
        storedResponse = new FileUploadResponse(
                fileId.toString(),
                fileId + ".png",
                "image/png",
                bytes.length,
                "/api/v1/files/" + fileId + ".png"
        );

        User owner = new User("Owner", "owner@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        owner.setId(userId);

        lenient().when(principal.getId()).thenReturn(userId);
        lenient().when(userRepository.getReferenceById(userId)).thenReturn(owner);
    }

    @Test
    @DisplayName("Successful upload persists ownership metadata and returns the unchanged response")
    void successfulUploadRegistersOwnership() {
        when(imageFileValidator.validate(multipartFile))
                .thenReturn(new ImageFileValidator.ValidationResult(bytes, "png", "image/png"));
        when(fileStorageService.store(bytes, "png", "image/png")).thenReturn(storedResponse);

        FileUploadResponse response = fileUploadService.uploadImage(multipartFile, UploadPurpose.CHAT, principal);

        assertThat(response).isSameAs(storedResponse);
        assertThat(response.getId()).isEqualTo(fileId.toString());
        assertThat(response.getFilename()).isEqualTo(fileId + ".png");
        assertThat(response.getContentType()).isEqualTo("image/png");
        assertThat(response.getSize()).isEqualTo(bytes.length);
        assertThat(response.getUrl()).isEqualTo("/api/v1/files/" + fileId + ".png");

        ArgumentCaptor<UploadedFile> captor = ArgumentCaptor.forClass(UploadedFile.class);
        verify(uploadedFileRepository).saveAndFlush(captor.capture());
        UploadedFile registered = captor.getValue();
        assertThat(registered.getId()).isEqualTo(fileId);
        assertThat(registered.getFilename()).isEqualTo(fileId + ".png");
        assertThat(registered.getOwner().getId()).isEqualTo(userId);
        assertThat(registered.getContentType()).isEqualTo("image/png");
        assertThat(registered.getSizeBytes()).isEqualTo(bytes.length);
        assertThat(registered.getPurpose()).isEqualTo(UploadPurpose.CHAT);
        assertThat(registered.isBound()).isFalse();

        verify(fileStorageService, never()).delete(anyString());
    }

    @Test
    @DisplayName("Two-argument upload defaults to GENERAL purpose")
    void defaultPurposeIsGeneral() {
        when(imageFileValidator.validate(multipartFile))
                .thenReturn(new ImageFileValidator.ValidationResult(bytes, "png", "image/png"));
        when(fileStorageService.store(bytes, "png", "image/png")).thenReturn(storedResponse);

        fileUploadService.uploadImage(multipartFile, principal);

        ArgumentCaptor<UploadedFile> captor = ArgumentCaptor.forClass(UploadedFile.class);
        verify(uploadedFileRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getPurpose()).isEqualTo(UploadPurpose.GENERAL);
    }

    @Test
    @DisplayName("Registry persistence failure compensates by deleting the stored file")
    void registryFailureCompensatesStoredFile() {
        when(imageFileValidator.validate(multipartFile))
                .thenReturn(new ImageFileValidator.ValidationResult(bytes, "png", "image/png"));
        when(fileStorageService.store(bytes, "png", "image/png")).thenReturn(storedResponse);
        when(uploadedFileRepository.saveAndFlush(any(UploadedFile.class)))
                .thenThrow(new DataIntegrityViolationException("registry insert failed"));

        assertThatThrownBy(() -> fileUploadService.uploadImage(multipartFile, UploadPurpose.CHAT, principal))
                .isInstanceOf(DataIntegrityViolationException.class);

        verify(fileStorageService).delete(fileId + ".png");
    }

    @Test
    @DisplayName("Storage failure never creates a registry record")
    void storageFailureSkipsRegistry() {
        when(imageFileValidator.validate(multipartFile))
                .thenReturn(new ImageFileValidator.ValidationResult(bytes, "png", "image/png"));
        when(fileStorageService.store(bytes, "png", "image/png"))
                .thenThrow(new StorageException("disk full"));

        assertThatThrownBy(() -> fileUploadService.uploadImage(multipartFile, UploadPurpose.CHAT, principal))
                .isInstanceOf(StorageException.class);

        verifyNoInteractions(uploadedFileRepository);
        verify(fileStorageService, never()).delete(anyString());
    }

    @Test
    @DisplayName("Unauthenticated upload is rejected before any validation or storage")
    void unauthenticatedUploadRejected() {
        assertThatThrownBy(() -> fileUploadService.uploadImage(multipartFile, UploadPurpose.CHAT, null))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

        verifyNoInteractions(imageFileValidator, fileStorageService, uploadedFileRepository);
    }
}
