package com.shareloop.service.filestorage;

import com.shareloop.config.StorageProperties;
import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.exception.StorageException;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.FileUploadService;
import com.shareloop.service.UploadQuotaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class R2StorageServiceTest {

    private static final byte[] CONTENT = "r2-image-content".getBytes();
    private static final String MANAGED_FILENAME = "550e8400-e29b-41d4-a716-446655440000.png";

    @Mock
    private S3Client s3Client;

    @Mock
    private ImageFileValidator imageFileValidator;

    @Mock
    private UploadedFileRepository uploadedFileRepository;

    @Mock
    private UploadQuotaService uploadQuotaService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserPrincipal principal;

    private R2StorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new R2StorageService(r2Properties(), s3Client);
    }

    private StorageProperties r2Properties() {
        StorageProperties properties = new StorageProperties();
        properties.setProvider("r2");
        properties.getR2().setEndpoint("https://account-id.r2.cloudflarestorage.com");
        properties.getR2().setBucketName("shareloop-private");
        properties.getR2().setAccessKeyId("test-access-key-id");
        properties.getR2().setSecretAccessKey("test-secret-access-key");
        return properties;
    }

    private ResponseInputStream<GetObjectResponse> objectStream(byte[] bytes) {
        GetObjectResponse response = GetObjectResponse.builder()
                .contentLength((long) bytes.length)
                .contentType("image/png")
                .build();
        return new ResponseInputStream<>(response, AbortableInputStream.create(new ByteArrayInputStream(bytes)));
    }

    @Test
    @DisplayName("store uploads a server-generated UUID key, verifies it and returns a backend proxy URL")
    void storeUploadsVerifiesAndReturnsProxyUrl() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().contentLength((long) CONTENT.length).build());

        FileUploadResponse response = storageService.store(CONTENT, "png", "image/png");

        UUID fileId = UUID.fromString(response.getId());
        assertThat(response.getFilename()).isEqualTo(fileId + ".png");
        assertThat(response.getContentType()).isEqualTo("image/png");
        assertThat(response.getSize()).isEqualTo(CONTENT.length);
        assertThat(response.getUrl()).isEqualTo("/api/v1/files/" + response.getFilename());

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(RequestBody.class));
        PutObjectRequest putRequest = putCaptor.getValue();
        assertThat(putRequest.bucket()).isEqualTo("shareloop-private");
        assertThat(putRequest.key()).isEqualTo(response.getFilename());
        assertThat(putRequest.contentType()).isEqualTo("image/png");
        assertThat(putRequest.contentLength()).isEqualTo((long) CONTENT.length);

        ArgumentCaptor<HeadObjectRequest> headCaptor = ArgumentCaptor.forClass(HeadObjectRequest.class);
        verify(s3Client).headObject(headCaptor.capture());
        assertThat(headCaptor.getValue().key()).isEqualTo(response.getFilename());

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    @DisplayName("store compensates the uploaded object when the S3-compatible service rejects the PUT")
    void storePutFailureCompensatesObject() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(S3Exception.builder().statusCode(500).message("storage unavailable").build());

        assertThatThrownBy(() -> storageService.store(CONTENT, "png", "image/png"))
                .isInstanceOf(StorageException.class);

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(RequestBody.class));
        String key = putCaptor.getValue().key();

        verify(s3Client).deleteObject(argThat((DeleteObjectRequest request) ->
                request.bucket().equals("shareloop-private") && request.key().equals(key)));
        verify(s3Client, never()).headObject(any(HeadObjectRequest.class));
    }

    @Test
    @DisplayName("store compensates the object when post-upload verification reports a size mismatch")
    void storeVerificationFailureCompensatesObject() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().contentLength(1L).build());

        assertThatThrownBy(() -> storageService.store(CONTENT, "png", "image/png"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("verification");

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(RequestBody.class));
        String key = putCaptor.getValue().key();
        verify(s3Client).deleteObject(argThat((DeleteObjectRequest request) -> request.key().equals(key)));
    }

    @Test
    @DisplayName("Database persistence failure after an R2 upload compensates the stored object")
    void databaseFailureCompensatesObject() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().contentLength((long) CONTENT.length).build());

        FileUploadService uploadService = new FileUploadService(
                storageService, imageFileValidator, uploadQuotaService, userRepository);

        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", CONTENT);
        UUID userId = UUID.randomUUID();
        User owner = new User("Owner", "owner@example.com", "hash", UserRole.USER, UserStatus.ACTIVE);
        owner.setId(userId);

        when(imageFileValidator.validate(file))
                .thenReturn(new ImageFileValidator.ValidationResult(CONTENT, "png", "image/png"));
        when(principal.getId()).thenReturn(userId);
        when(userRepository.getReferenceById(userId)).thenReturn(owner);
        doThrow(new DataIntegrityViolationException("registry insert failed"))
                .when(uploadQuotaService).checkQuotaAndRegister(any(UploadedFile.class));

        assertThatThrownBy(() -> uploadService.uploadImage(file, principal))
                .isInstanceOf(DataIntegrityViolationException.class);

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(RequestBody.class));
        String key = putCaptor.getValue().key();
        verify(s3Client).deleteObject(argThat((DeleteObjectRequest request) -> request.key().equals(key)));
    }

    @Test
    @DisplayName("loadAsResource streams the object with its length and filename")
    void loadAsResourceStreamsObject() throws Exception {
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(objectStream(CONTENT));

        Resource resource = storageService.loadAsResource(MANAGED_FILENAME);

        assertThat(resource.getFilename()).isEqualTo(MANAGED_FILENAME);
        assertThat(resource.contentLength()).isEqualTo(CONTENT.length);
        try (InputStream input = resource.getInputStream()) {
            assertThat(input.readAllBytes()).isEqualTo(CONTENT);
        }

        ArgumentCaptor<GetObjectRequest> captor = ArgumentCaptor.forClass(GetObjectRequest.class);
        verify(s3Client).getObject(captor.capture());
        assertThat(captor.getValue().bucket()).isEqualTo("shareloop-private");
        assertThat(captor.getValue().key()).isEqualTo(MANAGED_FILENAME);
    }

    @Test
    @DisplayName("loadAsResource maps a missing object to ResourceNotFoundException")
    void loadAsResourceMissingObjectIsNotFound() {
        doThrow(NoSuchKeyException.builder().statusCode(404).message("missing").build())
                .when(s3Client).getObject(any(GetObjectRequest.class));
        assertThatThrownBy(() -> storageService.loadAsResource(MANAGED_FILENAME))
                .isInstanceOf(ResourceNotFoundException.class);

        doThrow(S3Exception.builder().statusCode(404).message("missing").build())
                .when(s3Client).getObject(any(GetObjectRequest.class));
        assertThatThrownBy(() -> storageService.loadAsResource(MANAGED_FILENAME))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("loadAsResource converts non-404 storage failures to StorageException")
    void loadAsResourceStorageFailureIsWrapped() {
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(500).message("boom").build());

        assertThatThrownBy(() -> storageService.loadAsResource(MANAGED_FILENAME))
                .isInstanceOf(StorageException.class);
    }

    @Test
    @DisplayName("loadAsResource rejects unsafe filenames without contacting storage")
    void loadAsResourceRejectsUnsafeFilename() {
        assertThatThrownBy(() -> storageService.loadAsResource("../../etc/passwd"))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> storageService.loadAsResource("not-a-managed-file.jpg"))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> storageService.loadAsResource(null))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(s3Client);
    }

    @Test
    @DisplayName("delete is idempotent for existing and missing objects")
    void deleteIsIdempotent() {
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build());

        assertThat(storageService.delete(MANAGED_FILENAME)).isTrue();
        assertThat(storageService.delete(MANAGED_FILENAME)).isTrue();

        verify(s3Client, times(2)).deleteObject(argThat((DeleteObjectRequest request) ->
                request.bucket().equals("shareloop-private") && request.key().equals(MANAGED_FILENAME)));
    }

    @Test
    @DisplayName("delete treats a 404 response as already deleted")
    void deleteTreatsNotFoundAsAlreadyDeleted() {
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(404).message("missing").build());

        assertThat(storageService.delete(MANAGED_FILENAME)).isTrue();
    }

    @Test
    @DisplayName("delete rejects unsafe filenames and wraps storage failures")
    void deleteSafetyAndFailures() {
        assertThat(storageService.delete("invalid.jpg")).isFalse();
        assertThat(storageService.delete(null)).isFalse();
        verifyNoInteractions(s3Client);

        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(500).message("boom").build());
        assertThatThrownBy(() -> storageService.delete(MANAGED_FILENAME))
                .isInstanceOf(StorageException.class);
    }

    @Test
    @DisplayName("The R2 provider fails fast when required configuration is missing")
    void constructorRejectsIncompleteConfiguration() {
        StorageProperties missingEndpoint = new StorageProperties();
        missingEndpoint.setProvider("r2");
        missingEndpoint.getR2().setBucketName("bucket");
        missingEndpoint.getR2().setAccessKeyId("key");
        missingEndpoint.getR2().setSecretAccessKey("secret");
        assertThatThrownBy(() -> new R2StorageService(missingEndpoint))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R2_ENDPOINT");

        StorageProperties httpEndpoint = r2Properties();
        httpEndpoint.getR2().setEndpoint("http://account.r2.cloudflarestorage.com");
        assertThatThrownBy(() -> new R2StorageService(httpEndpoint))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("HTTPS");

        StorageProperties missingSecret = r2Properties();
        missingSecret.getR2().setSecretAccessKey(" ");
        assertThatThrownBy(() -> new R2StorageService(missingSecret))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("R2_SECRET_ACCESS_KEY");
    }
}
