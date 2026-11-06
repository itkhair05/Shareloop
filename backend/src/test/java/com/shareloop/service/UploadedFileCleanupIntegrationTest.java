package com.shareloop.service;

import com.shareloop.entity.*;
import com.shareloop.entity.enums.DeletionState;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.*;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class UploadedFileCleanupIntegrationTest {

    private static final byte[] FILE_BYTES = "stored-image-bytes".getBytes();

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private UploadedFileBindingRepository uploadedFileBindingRepository;

    @Autowired
    private UploadedFileCleanupService cleanupService;

    @Autowired
    private LocalStorageService localStorageService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ListingImageRepository listingImageRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private TransactionTemplate transactionTemplate;

    private User owner;
    private User requester;
    private Category category;
    private Listing listing;
    private Conversation conversation;

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
                "Cleanup Owner",
                "cleanup.owner." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        requester = userRepository.saveAndFlush(new User(
                "Cleanup Requester",
                "cleanup.requester." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        category = categoryRepository.saveAndFlush(new Category(
                "Category-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
        listing = new Listing(owner, category, ListingType.GIVEAWAY, "Cleanup Item", "Description", "Hanoi");
        listing.setStatus(ListingStatus.ACTIVE);
        listing = listingRepository.saveAndFlush(listing);
        conversation = conversationRepository.saveAndFlush(new Conversation(listing, owner, requester, null));
    }

    @AfterEach
    void tearDown() {
        chatMessageRepository.deleteAll();
        uploadedFileBindingRepository.deleteAll();
        uploadedFileRepository.deleteAll();
        listingImageRepository.deleteAll();
        conversationRepository.deleteAll();
        listingRepository.delete(listing);
        categoryRepository.delete(category);
        userRepository.delete(owner);
        userRepository.delete(requester);

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

    private UploadedFile createUpload(User uploader, UploadPurpose purpose, Instant createdAt, boolean createPhysicalFile) {
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

        UploadedFile file = new UploadedFile(id, filename, uploader, "image/png", FILE_BYTES.length, purpose);
        file.setCreatedAt(createdAt);
        return uploadedFileRepository.saveAndFlush(file);
    }

    private UploadedFile createBoundChatUpload(Instant createdAt) {
        UploadedFile file = createUpload(requester, UploadPurpose.CHAT, createdAt, true);

        UUID fileId = file.getId();
        transactionTemplate.executeWithoutResult(status -> {
            ChatMessage message = chatMessageRepository.saveAndFlush(
                    new ChatMessage(conversation, requester, "Hình đây", fileId)
            );
            UploadedFile managed = uploadedFileRepository.findById(fileId).orElseThrow();
            managed.bindTo(message);
            uploadedFileRepository.saveAndFlush(managed);
        });

        return uploadedFileRepository.findById(fileId).orElseThrow();
    }

    private UploadedFile createBoundDomainUpload(UploadPurpose purpose, String domain, Instant createdAt) {
        UploadedFile file = createUpload(requester, purpose, createdAt, true);
        UUID fileId = file.getId();
        transactionTemplate.executeWithoutResult(status -> {
            UploadedFile managed = uploadedFileRepository.findById(fileId).orElseThrow();
            UploadedFileBinding binding = new UploadedFileBinding(managed, domain, UUID.randomUUID(), requester);
            uploadedFileBindingRepository.saveAndFlush(binding);
            managed.setBinding(binding);
            uploadedFileRepository.saveAndFlush(managed);
        });
        return uploadedFileRepository.findById(fileId).orElseThrow();
    }

    private Instant expired() {
        return Instant.now().minus(25, ChronoUnit.HOURS);
    }

    private Instant recent() {
        return Instant.now().minus(1, ChronoUnit.HOURS);
    }

    private Instant olderThanListingImageTtl() {
        return Instant.now().minus(8, ChronoUnit.DAYS);
    }

    private void attachListingImage(String imageUrl) {
        UUID listingId = listing.getId();
        transactionTemplate.executeWithoutResult(status -> {
            Listing managed = listingRepository.findById(listingId).orElseThrow();
            managed.addImage(new ListingImage(managed, imageUrl, 0));
            listingRepository.saveAndFlush(managed);
        });
    }

    private void clearListingImages() {
        UUID listingId = listing.getId();
        transactionTemplate.executeWithoutResult(status -> {
            Listing managed = listingRepository.findById(listingId).orElseThrow();
            managed.getImages().clear();
            listingRepository.saveAndFlush(managed);
        });
    }

    @Test
    @DisplayName("Expired unbound CHAT upload is deleted with its physical file")
    void expiredUnboundChatUploadDeleted() {
        UploadedFile file = createUpload(requester, UploadPurpose.CHAT, expired(), true);

        int deleted = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("Expired unbound REVIEW upload is deleted with its physical file")
    void expiredUnboundReviewUploadDeleted() {
        UploadedFile file = createUpload(requester, UploadPurpose.REVIEW, expired(), true);

        int deleted = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("Expired unbound REPORT upload is deleted with its physical file")
    void expiredUnboundReportUploadDeleted() {
        UploadedFile file = createUpload(requester, UploadPurpose.REPORT, expired(), true);

        int deleted = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("Expired unbound SUPPORT upload is deleted with its physical file")
    void expiredUnboundSupportUploadDeleted() {
        UploadedFile file = createUpload(requester, UploadPurpose.SUPPORT, expired(), true);

        int deleted = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("Recent unbound CHAT, REVIEW, REPORT, SUPPORT uploads are retained")
    void recentUnboundUploadsRetained() {
        UploadedFile chat = createUpload(requester, UploadPurpose.CHAT, recent(), true);
        UploadedFile review = createUpload(requester, UploadPurpose.REVIEW, recent(), true);
        UploadedFile report = createUpload(requester, UploadPurpose.REPORT, recent(), true);
        UploadedFile support = createUpload(requester, UploadPurpose.SUPPORT, recent(), true);

        cleanupService.cleanupExpiredUnboundUploads();

        assertThat(uploadedFileRepository.findById(chat.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(review.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(report.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(support.getId())).isPresent();
    }

    @Test
    @DisplayName("Bound CHAT upload is never deleted")
    void boundChatUploadRetained() {
        UploadedFile file = createBoundChatUpload(expired());

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.isBound()).isTrue();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Bound REVIEW upload is never deleted")
    void boundReviewUploadRetained() {
        UploadedFile file = createBoundDomainUpload(UploadPurpose.REVIEW, "REVIEW", expired());

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.isBound()).isTrue();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Bound REPORT upload is never deleted")
    void boundReportUploadRetained() {
        UploadedFile file = createBoundDomainUpload(UploadPurpose.REPORT, "REPORT", expired());

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.isBound()).isTrue();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Bound SUPPORT upload is never deleted")
    void boundSupportUploadRetained() {
        UploadedFile file = createBoundDomainUpload(UploadPurpose.SUPPORT, "SUPPORT", expired());

        cleanupService.cleanupExpiredUnboundUploads();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.isBound()).isTrue();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Expired GENERAL uploads (listing images) are never deleted")
    void generalUploadsRetained() {
        UploadedFile file = createUpload(requester, UploadPurpose.GENERAL, expired(), true);

        cleanupService.cleanupExpiredUnboundUploads();

        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("Missing physical file does not block registry cleanup")
    void missingPhysicalFileDoesNotBlockCleanup() {
        UploadedFile file = createUpload(requester, UploadPurpose.CHAT, expired(), false);

        cleanupService.cleanupExpiredUnboundUploads();

        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
    }

    @Test
    @DisplayName("A single deletion failure does not stop the batch and is retried on the next pass")
    void deletionFailureDoesNotStopBatch() throws IOException {
        UploadedFile failing = createUpload(requester, UploadPurpose.CHAT, expired(), true);
        Path failingPath = localStorageService.getRootPath().resolve(failing.getFilename());
        Files.delete(failingPath);
        Files.createDirectory(failingPath);
        Files.write(failingPath.resolve("blocker.txt"), new byte[]{1});

        UploadedFile healthy = createUpload(requester, UploadPurpose.CHAT, expired(), true);

        int firstPass = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(firstPass).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(healthy.getId())).isEmpty();
        assertThat(uploadedFileRepository.findById(failing.getId())).isPresent();

        // Running again while the failure persists is safe and keeps the row for a later retry.
        cleanupService.cleanupExpiredUnboundUploads();
        assertThat(uploadedFileRepository.findById(failing.getId())).isPresent();

        // Once the obstruction is gone, the next pass removes the row.
        Files.delete(failingPath.resolve("blocker.txt"));
        Files.delete(failingPath);
        cleanupService.cleanupExpiredUnboundUploads();
        assertThat(uploadedFileRepository.findById(failing.getId())).isEmpty();
    }

    @Test
    @DisplayName("Repeated cleanup runs are safe and idempotent")
    void repeatedCleanupIsSafe() {
        UploadedFile file = createUpload(requester, UploadPurpose.CHAT, expired(), true);

        cleanupService.cleanupExpiredUnboundUploads();
        int secondPass = cleanupService.cleanupExpiredUnboundUploads();

        assertThat(secondPass).isZero();
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(uploadedFileRepository.countByOwnerId(requester.getId())).isZero();
    }

    @Test
    @DisplayName("Cleanup leaves a mix of recent, bound and GENERAL uploads untouched")
    void mixedScenario() {
        UploadedFile expiredChat = createUpload(requester, UploadPurpose.CHAT, expired(), true);
        UploadedFile recentChat = createUpload(requester, UploadPurpose.CHAT, recent(), true);
        UploadedFile boundChat = createBoundChatUpload(expired());
        UploadedFile boundReview = createBoundDomainUpload(UploadPurpose.REVIEW, "REVIEW", expired());
        UploadedFile general = createUpload(requester, UploadPurpose.GENERAL, expired(), true);

        cleanupService.cleanupExpiredUnboundUploads();

        assertThat(uploadedFileRepository.findById(expiredChat.getId())).isEmpty();
        assertThat(uploadedFileRepository.findById(recentChat.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(boundChat.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(boundReview.getId())).isPresent();
        assertThat(uploadedFileRepository.findById(general.getId())).isPresent();
        assertThat(uploadedFileRepository.countByOwnerId(requester.getId())).isEqualTo(4);
    }

    @Test
    @DisplayName("Unreferenced GENERAL upload older than the listing TTL is swept")
    void orphanedListingImageDeleted() {
        UploadedFile file = createUpload(requester, UploadPurpose.GENERAL, olderThanListingImageTtl(), true);

        int deleted = cleanupService.cleanupOrphanedListingImages();

        assertThat(deleted).isGreaterThanOrEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("GENERAL upload referenced by a relative listing image is retained")
    void referencedListingImageRetained() {
        UploadedFile file = createUpload(requester, UploadPurpose.GENERAL, olderThanListingImageTtl(), true);
        attachListingImage("/api/v1/files/" + file.getFilename());

        cleanupService.cleanupOrphanedListingImages();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.ACTIVE);
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("GENERAL upload referenced by an absolute URL is retained")
    void absoluteUrlListingReferenceRetained() {
        UploadedFile file = createUpload(requester, UploadPurpose.GENERAL, olderThanListingImageTtl(), true);
        attachListingImage("https://cdn.shareloop.example/api/v1/files/" + file.getFilename());

        cleanupService.cleanupOrphanedListingImages();

        UploadedFile reloaded = uploadedFileRepository.findById(file.getId()).orElseThrow();
        assertThat(reloaded.getDeletionState()).isEqualTo(DeletionState.ACTIVE);
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }

    @Test
    @DisplayName("A GENERAL upload becomes eligible once its last listing reference is removed")
    void removedListingReferenceBecomesEligible() {
        UploadedFile file = createUpload(requester, UploadPurpose.GENERAL, olderThanListingImageTtl(), true);
        attachListingImage("/api/v1/files/" + file.getFilename());

        cleanupService.cleanupOrphanedListingImages();
        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();

        clearListingImages();
        cleanupService.cleanupOrphanedListingImages();

        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isFalse();
    }

    @Test
    @DisplayName("Recent GENERAL uploads are retained by the listing sweep")
    void recentGeneralUploadRetainedByListingSweep() {
        UploadedFile file = createUpload(requester, UploadPurpose.GENERAL, recent(), true);

        cleanupService.cleanupOrphanedListingImages();

        assertThat(uploadedFileRepository.findById(file.getId())).isPresent();
        assertThat(Files.exists(localStorageService.getRootPath().resolve(file.getFilename()))).isTrue();
    }
}
