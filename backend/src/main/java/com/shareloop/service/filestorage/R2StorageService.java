package com.shareloop.service.filestorage;

import com.shareloop.config.StorageProperties;
import com.shareloop.dto.file.FileUploadResponse;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.exception.StorageException;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.InputStream;
import java.net.URI;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Cloudflare R2 backed storage using the S3-compatible API.
 *
 * <p>The bucket is treated as private: every object is served through the backend
 * so that existing domain authorization (chat membership, review visibility,
 * report/support ownership) stays authoritative. No presigned or public URL is
 * ever generated for private purposes.</p>
 *
 * <p>Object keys are server-generated UUID filenames; client-supplied names are
 * never used. Every destructive operation is idempotent: a missing object is
 * reported as already deleted.</p>
 */
@Service
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "r2")
public class R2StorageService implements FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(R2StorageService.class);

    private static final String BACKEND_FILES_PATH = "/api/v1/files";

    private static final Pattern SAFE_FILENAME_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.(jpg|jpeg|png)$");

    private final S3Client s3Client;
    private final String bucketName;

    @Autowired
    public R2StorageService(StorageProperties storageProperties) {
        this(storageProperties, buildClient(storageProperties));
    }

    R2StorageService(StorageProperties storageProperties, S3Client s3Client) {
        this.s3Client = s3Client;
        this.bucketName = storageProperties.getR2().getBucketName();
        log.info("Initialized Cloudflare R2 storage for bucket '{}' via backend proxy", this.bucketName);
    }

    @Override
    public FileUploadResponse store(byte[] bytes, String extension, String contentType) {
        String cleanExtension = extension.startsWith(".") ? extension : "." + extension;
        UUID fileId = UUID.randomUUID();
        String filename = fileId + cleanExtension;

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filename)
                    .contentType(contentType)
                    .contentLength((long) bytes.length)
                    .build();
            s3Client.putObject(request, software.amazon.awssdk.core.sync.RequestBody.fromBytes(bytes));

            HeadObjectResponse head = s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filename)
                    .build());
            Long storedLength = head.contentLength();
            if (storedLength == null || storedLength != bytes.length) {
                throw new StorageException("Stored object size verification failed for " + filename);
            }
        } catch (StorageException ex) {
            deleteQuietly(filename);
            throw ex;
        } catch (RuntimeException ex) {
            deleteQuietly(filename);
            throw new StorageException("Failed to store file in object storage", ex);
        }

        return new FileUploadResponse(
                fileId.toString(),
                filename,
                contentType,
                bytes.length,
                BACKEND_FILES_PATH + "/" + filename
        );
    }

    @Override
    public Resource loadAsResource(String filename) {
        if (filename == null || !SAFE_FILENAME_PATTERN.matcher(filename).matches()) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }

        try {
            ResponseInputStream<GetObjectResponse> object = s3Client.getObject(GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filename)
                    .build());
            GetObjectResponse metadata = object.response();
            long contentLength = metadata.contentLength() != null ? metadata.contentLength() : -1L;
            return new ManagedObjectResource(object, filename, contentLength);
        } catch (NoSuchKeyException ex) {
            throw new ResourceNotFoundException("File not found: " + filename);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new ResourceNotFoundException("File not found: " + filename);
            }
            throw new StorageException("Failed to load file from object storage", ex);
        } catch (RuntimeException ex) {
            throw new StorageException("Failed to load file from object storage", ex);
        }
    }

    @Override
    public boolean delete(String filename) {
        if (filename == null || !SAFE_FILENAME_PATTERN.matcher(filename).matches()) {
            log.warn("Attempted to delete object with invalid filename pattern: {}", filename);
            return false;
        }

        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filename)
                    .build());
            // S3 DeleteObject is idempotent and succeeds even when the key is absent.
            return true;
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                log.debug("Object to delete does not exist: {}", filename);
                return true;
            }
            log.error("Failed to delete object {}: status {}", filename, ex.statusCode());
            throw new StorageException("Failed to delete stored file: " + filename, ex);
        } catch (RuntimeException ex) {
            log.error("Failed to delete object {}: {}", filename, ex.getMessage());
            throw new StorageException("Failed to delete stored file: " + filename, ex);
        }
    }

    @PreDestroy
    public void close() {
        s3Client.close();
    }

    private void deleteQuietly(String filename) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filename)
                    .build());
            log.info("Compensated/deleted object {} after a storage failure", filename);
        } catch (RuntimeException ex) {
            log.error("Failed to compensate object {}: {}", filename, ex.getMessage());
        }
    }

    private static S3Client buildClient(StorageProperties properties) {
        StorageProperties.R2 r2 = properties.getR2();
        requireConfigured(r2.getEndpoint(), "R2_ENDPOINT / app.storage.r2.endpoint");
        requireConfigured(r2.getBucketName(), "R2_BUCKET_NAME / app.storage.r2.bucket-name");
        requireConfigured(r2.getAccessKeyId(), "R2_ACCESS_KEY_ID / app.storage.r2.access-key-id");
        requireConfigured(r2.getSecretAccessKey(), "R2_SECRET_ACCESS_KEY / app.storage.r2.secret-access-key");

        URI endpoint;
        try {
            endpoint = URI.create(r2.getEndpoint());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("R2 endpoint is malformed. Configure a valid HTTPS endpoint.", ex);
        }
        if (!endpoint.isAbsolute() || endpoint.getScheme() == null
                || !"https".equalsIgnoreCase(endpoint.getScheme())
                || endpoint.getHost() == null || endpoint.getHost().isBlank()) {
            throw new IllegalStateException("R2 endpoint must be an absolute HTTPS URL.");
        }

        return S3Client.builder()
                .endpointOverride(endpoint)
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(r2.getAccessKeyId(), r2.getSecretAccessKey())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .build();
    }

    private static void requireConfigured(String value, String settingName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "Cloudflare R2 storage requires a non-blank " + settingName + " when app.storage.provider=r2.");
        }
    }

    private static final class ManagedObjectResource extends InputStreamResource {

        private final String filename;
        private final long contentLength;

        private ManagedObjectResource(InputStream inputStream, String filename, long contentLength) {
            super(inputStream);
            this.filename = filename;
            this.contentLength = contentLength;
        }

        @Override
        public String getFilename() {
            return filename;
        }

        @Override
        public long contentLength() {
            return contentLength;
        }
    }
}
