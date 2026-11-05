package com.shareloop.service;

import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.DeletionState;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.UploadedFileBindingRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.service.filestorage.LocalStorageService;
import com.shareloop.testsupport.TestStorageSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the safe cleanup lifecycle:
 * ACTIVE -> PENDING_DELETION (committed) -> physical deletion -> row deletion.
 */
@SpringBootTest
@ActiveProfiles("test")
class UploadedFileCleanupLifecycleIntegrationTest {

    private static final byte[] FILE_BYTES = "lifecycle-image-bytes".getBytes();

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private UploadedFileBindingRepository uploadedFileBindingRepository;

    @Autowired
    private UploadedFileCleanupService cleanupService;

    @Autowired
    private FileBindingService fileBindingService;

    @Autowired
    private LocalStorageService localStorageService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private TransactionTemplate transactionTemplate;
    private User owner;
    private final Set<String> trackedFilenames = new HashSet<>();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        TestStorageSupport.registerIsolatedRoot(registry);
    }

    @BeforeEach
    void setUp() {
        TestStorageSupport.assertEffectiveRootIsIsolated(localStorageService.getRootPath());
        transactionTemplate = new TransactionTemplate(transactionManager);

        owner = userRepository.saveAndFlush(new User(
                "Lifecycle Owner",
                "lifecycle.owner." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
    }

    @AfterEach
    void tearDown() {
        uploadedFileBindingRepository.deleteAll();
        uploadedFileRepository.deleteAll();
        userRepository.delete(owner);

        Path root = localStorageService.getRootPath();
        for (String filename : trackedFilenames) {
            deletePhysicalQuietly(root.resolve(filename));
        }
    }

    private void deletePhysicalQuietly(Path path) {
        try {
            if (Files.isDirectory(path)) {
                try (var children = Files.list(path)) {
                    for (Path child : children.toList()) {
                        Files.deleteIfExists(child);
                    }
                }
            }
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    private UploadedFile createUpload(UploadPurpose purpose, Instant createdAt, boolean createPhysicalFile) {
        UUID id = UUID.randomUUID();
        String filename = id + ".png";
        trackedFilenames.add(filename);

        if (createPhysicalFile) {
            try {
                Files.write(localStorageService.getRootPath().resolve(filename), FILE_BYTES);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to create test file", e);
            }
        }

        UploadedFile file = new UploadedFile(id, filename, owner, "image/png", FILE_BYTES.length, purpose);
        file.setCreatedAt(createdAt);
        return uploadedFileRepository.saveAndFlush(file);
    }

    private Instant expired() {
        return Instant.now().minus(25, ChronoUnit.HOURS);
    }

    private Instant recent() {
        return Instant.now().minus(1, ChronoUnit.HOURS);
    }

    /**
     * Creates an expired upload whose physical delete always fails, then runs the
     * cleanup once so the row is committed as PENDING_DELETION.
     */
    private UploadedFile createPendingUpload(UploadPurpose purpose) throws IOException {
        UploadedFile file = createUpload(purpose, expired(), true);
        Path path = localStorageService.getRootPath().resolve(file.getFilename());
        Files.delete(path);
        Files.createDirectory(path);
        Files.write(path.resolve("blocker.txt"), new byte[]{1});

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.PENDING_DELETION);
        return reloaded;
    }

    private void removeObstruction(UploadedFile file) throws IOException {
        Path path = localStorageService.getRootPath().resolve(file.getFilename());
        if (Files.isDirectory(path)) {
            try (var children = Files.list(path)) {
                for (Path child : children.toList()) {
                    Files.deleteIfExists(child);
                }
            }
            Files.deleteIfExists(path);
        }
    }

    @Test
    @DisplayName("Physical deletion failure leaves the row committed as PENDING_DELETION for retry")
    void physicalDeletionFailureLeavesPendingState() throws IOException {
        UploadedFile file = createUpload(UploadPurpose.REVIEW, expired(), true);
        Path path = localStorageService.getRootPath().resolve(file.getFilename());
        Files.delete(path);
        Files.createDirectory(path);
        Files.write(path.resolve("blocker.txt"), new byte[]{1});

        int firstPass = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(firstPass).isZero();
        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        // The PENDING_DELETION transition is visible from a new transaction, proving
        // it committed before the physical deletion was attempted.
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.PENDING_DELETION);
        assertThat(reloaded.getPendingDeletionAt()).isNotNull();
        assertThat(reloaded.getDeletionAttempts()).isEqualTo(1);

        cleanupService.cleanupExpiredUnboundUploads();
        UploadedFile retried = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(retried.getDeletionAttempts()).isEqualTo(2);

        Files.delete(path.resolve("blocker.txt"));
        Files.delete(path);

        cleanupService.cleanupExpiredUnboundUploads();

        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(path)).isFalse();
    }

    @Test
    @DisplayName("A pending-deletion file is rejected by the binding service")
    void pendingDeletionFileCannotBeBound() throws IOException {
        UploadedFile file = createPendingUpload(UploadPurpose.REVIEW);

        assertThatThrownBy(() -> fileBindingService.bindFile(
                file.getId(), UploadPurpose.REVIEW, "REVIEW", UUID.randomUUID(), owner))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("pending deletion");

        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isFalse();
    }

    @Test
    @DisplayName("Scenario A: a committed binding wins and cleanup preserves the file")
    void bindingWinsOverCleanup() {
        UploadedFile file = createUpload(UploadPurpose.REVIEW, expired(), true);
        UUID reviewId = UUID.randomUUID();
        fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", reviewId, owner);

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.ACTIVE);
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Scenario B: cleanup wins, the binding is rejected and the row is finalized")
    void cleanupWinsOverBinding() throws IOException {
        UploadedFile file = createPendingUpload(UploadPurpose.REVIEW);

        assertThatThrownBy(() -> fileBindingService.bindFile(
                file.getId(), UploadPurpose.REVIEW, "REVIEW", UUID.randomUUID(), owner))
                .isInstanceOf(IllegalStateException.class);

        removeObstruction(file);
        cleanupService.cleanupExpiredUnboundUploads();

        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("One failing file does not stop other eligible files from being finalized")
    void oneFailureDoesNotStopBatch() throws IOException {
        UploadedFile failing = createUpload(UploadPurpose.CHAT, expired(), true);
        Path failingPath = localStorageService.getRootPath().resolve(failing.getFilename());
        Files.delete(failingPath);
        Files.createDirectory(failingPath);
        Files.write(failingPath.resolve("blocker.txt"), new byte[]{1});

        UploadedFile healthy = createUpload(UploadPurpose.REPORT, expired(), true);

        int deleted = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(healthy.getId())).isEmpty();
        assertThat(uploadedFileRepository.findById(failing.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(failing.getId()).orElseThrow().getDeletionState())
                .isEqualTo(DeletionState.PENDING_DELETION);
    }

    @Test
    @DisplayName("Repeated cleanup passes are idempotent")
    void repeatedCleanupIsIdempotent() {
        UploadedFile file = createUpload(UploadPurpose.SUPPORT, expired(), true);

        cleanupService.cleanupExpiredUnboundUploads();
        int secondPass = cleanupService.cleanupExpiredUnboundUploads();
        int thirdPass = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(secondPass).isZero();
        assertThat(thirdPass).isZero();
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
    }

    @Test
    @DisplayName("A canceled deletion state is never finalized by cleanup")
    void canceledDeletionIsNotFinalized() {
        UploadedFile file = createUpload(UploadPurpose.SUPPORT, recent(), true);

        transactionTemplate.executeWithoutResult(status -> {
            UploadedFile managed = uploadedFileRepository.findById(file.getId()).orElseThrow();
            managed.markPendingDeletion(Instant.now());
            uploadedFileRepository.saveAndFlush(managed);
        });
        transactionTemplate.executeWithoutResult(status -> {
            UploadedFile managed = uploadedFileRepository.findById(file.getId()).orElseThrow();
            managed.setDeletionState(DeletionState.ACTIVE);
            managed.setPendingDeletionAt(null);
            uploadedFileRepository.saveAndFlush(managed);
        });

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.ACTIVE);
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("GENERAL uploads are never marked for deletion")
    void generalUploadsNeverMarkedPending() {
        UploadedFile general = createUpload(UploadPurpose.GENERAL, expired(), true);

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(general.getId()).orElseThrow();
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.ACTIVE);
        assertThat(Files.exists(localStorageService.getRootPath().resolve(general.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Concurrent binding and cleanup never leave an inconsistent file")
    void concurrentBindingAndCleanupAreConsistent() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            for (int i = 0; i < 15; i++) {
                UploadedFile file = createUpload(UploadPurpose.REVIEW, expired(), true);
                UUID fileId = file.getId();
                UUID reviewId = UUID.randomUUID();
                Path physical = localStorageService.getRootPath().resolve(file.getFilename());

                CountDownLatch start = new CountDownLatch(1);
                Future<?> cleanupFuture = executor.submit(() -> {
                    start.await();
                    cleanupService.cleanupExpiredUnboundUploads();
                    return null;
                });
                Future<?> bindingFuture = executor.submit(() -> {
                    start.await();
                    try {
                        fileBindingService.bindFile(fileId, UploadPurpose.REVIEW, "REVIEW", reviewId, owner);
                    } catch (RuntimeException expected) {
                        // Losing the race is allowed; the invariant is asserted below.
                    }
                    return null;
                });

                start.countDown();
                cleanupFuture.get(15, TimeUnit.SECONDS);
                bindingFuture.get(15, TimeUnit.SECONDS);

                Optional<UploadedFile> row = uploadedFileRepository.findById(fileId);
                boolean bindingExists = uploadedFileBindingRepository.existsById(fileId);
                boolean physicalExists = Files.exists(physical);

                if (row.isPresent()) {
                    assertThat(bindingExists).isTrue();
                    assertThat(physicalExists).isTrue();
                    assertThat(row.get().isBound()).isTrue();
                } else {
                    assertThat(bindingExists).isFalse();
                    assertThat(physicalExists).isFalse();
                }
            }
        } finally {
            executor.shutdownNow();
        }
    }
}
