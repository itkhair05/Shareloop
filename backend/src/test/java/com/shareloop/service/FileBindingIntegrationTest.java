package com.shareloop.service;

import com.shareloop.entity.*;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.*;
import com.shareloop.service.filestorage.LocalStorageService;
import com.shareloop.testsupport.TestStorageSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class FileBindingIntegrationTest {

    @Autowired
    private FileBindingService fileBindingService;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private UploadedFileBindingRepository uploadedFileBindingRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private LocalStorageService localStorageService;

    private TransactionTemplate transactionTemplate;

    private User userA;
    private User userB;
    private Category category;
    private Listing listing;
    private Conversation conversation;

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        TestStorageSupport.registerIsolatedRoot(registry);
    }

    @BeforeEach
    void setUp() {
        TestStorageSupport.assertEffectiveRootIsIsolated(localStorageService.getRootPath());
        transactionTemplate = new TransactionTemplate(transactionManager);

        userA = userRepository.saveAndFlush(new User(
                "Binding User A",
                "binding.a." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        userB = userRepository.saveAndFlush(new User(
                "Binding User B",
                "binding.b." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        category = categoryRepository.saveAndFlush(new Category(
                "BindingCategory-" + UUID.randomUUID().toString().substring(0, 8),
                "binding-cat-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));

        listing = new Listing(userA, category, ListingType.GIVEAWAY, "Binding Item", "Description", "Hanoi");
        listing.setStatus(ListingStatus.ACTIVE);
        listing = listingRepository.saveAndFlush(listing);

        conversation = conversationRepository.saveAndFlush(new Conversation(listing, userA, userB, null));
    }

    @AfterEach
    void tearDown() {
        chatMessageRepository.deleteAll();
        uploadedFileBindingRepository.deleteAll();
        uploadedFileRepository.deleteAll();
        conversationRepository.deleteAll();
        listingRepository.delete(listing);
        categoryRepository.delete(category);
        userRepository.delete(userA);
        userRepository.delete(userB);
    }

    private UploadedFile createTestFile(User owner, UploadPurpose purpose) {
        UUID id = UUID.randomUUID();
        UploadedFile file = new UploadedFile(
                id,
                "file-" + id + ".jpg",
                owner,
                "image/jpeg",
                1024L,
                purpose
        );
        return uploadedFileRepository.saveAndFlush(file);
    }

    @Test
    @DisplayName("bindFile successfully binds an unbound file with matching purpose and owner")
    void testBindFileSuccess() {
        UploadedFile file = createTestFile(userA, UploadPurpose.REVIEW);
        UUID reviewId = UUID.randomUUID();

        UploadedFileBinding binding = fileBindingService.bindFile(
                file.getId(),
                UploadPurpose.REVIEW,
                "REVIEW",
                reviewId,
                userA
        );

        assertThat(binding).isNotNull();
        assertThat(binding.getFileId()).isEqualTo(file.getId());
        assertThat(binding.getBoundDomain()).isEqualTo("REVIEW");
        assertThat(binding.getBoundEntityId()).isEqualTo(reviewId);
        assertThat(binding.getBoundBy().getId()).isEqualTo(userA.getId());

        Optional<UploadedFileBinding> found = uploadedFileBindingRepository.findById(file.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getBoundEntityId()).isEqualTo(reviewId);
    }

    @Test
    @DisplayName("bindFile rejects second binding attempt for the same file")
    void testBindFileAlreadyBoundFails() {
        UploadedFile file = createTestFile(userA, UploadPurpose.REVIEW);
        UUID reviewId1 = UUID.randomUUID();
        UUID reviewId2 = UUID.randomUUID();

        fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", reviewId1, userA);

        assertThatThrownBy(() ->
                fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", reviewId2, userA)
        )
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already bound");
    }

    @Test
    @DisplayName("bindFile rejects cross-user binding attempt")
    void testBindFileCrossUserFails() {
        UploadedFile file = createTestFile(userA, UploadPurpose.REPORT);
        UUID reportId = UUID.randomUUID();

        assertThatThrownBy(() ->
                fileBindingService.bindFile(file.getId(), UploadPurpose.REPORT, "REPORT", reportId, userB)
        )
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("not owner");
    }

    @Test
    @DisplayName("bindFile rejects wrong expected purpose")
    void testBindFileWrongPurposeFails() {
        UploadedFile file = createTestFile(userA, UploadPurpose.REPORT);
        UUID reviewId = UUID.randomUUID();

        assertThatThrownBy(() ->
                fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", reviewId, userA)
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match required purpose");
    }

    @Test
    @DisplayName("bindFile rejects non-existent file")
    void testBindFileNotFoundFails() {
        UUID nonExistentId = UUID.randomUUID();

        assertThatThrownBy(() ->
                fileBindingService.bindFile(nonExistentId, UploadPurpose.REVIEW, "REVIEW", UUID.randomUUID(), userA)
        )
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("bindFiles successfully binds multiple files in order")
    void testBindFilesSuccess() {
        UploadedFile file1 = createTestFile(userA, UploadPurpose.SUPPORT);
        UploadedFile file2 = createTestFile(userA, UploadPurpose.SUPPORT);
        UploadedFile file3 = createTestFile(userA, UploadPurpose.SUPPORT);
        UUID supportRequestId = UUID.randomUUID();

        List<UploadedFileBinding> bindings = fileBindingService.bindFiles(
                List.of(file1.getId(), file2.getId(), file3.getId()),
                UploadPurpose.SUPPORT,
                "SUPPORT",
                supportRequestId,
                userA
        );

        assertThat(bindings).hasSize(3);
        assertThat(bindings.get(0).getFileId()).isEqualTo(file1.getId());
        assertThat(bindings.get(1).getFileId()).isEqualTo(file2.getId());
        assertThat(bindings.get(2).getFileId()).isEqualTo(file3.getId());

        assertThat(uploadedFileBindingRepository.existsById(file1.getId())).isTrue();
        assertThat(uploadedFileBindingRepository.existsById(file2.getId())).isTrue();
        assertThat(uploadedFileBindingRepository.existsById(file3.getId())).isTrue();
    }

    @Test
    @DisplayName("bindFiles rejects duplicate file IDs in single attachment list")
    void testBindFilesDuplicateIdsFails() {
        UploadedFile file1 = createTestFile(userA, UploadPurpose.SUPPORT);
        UUID supportRequestId = UUID.randomUUID();

        assertThatThrownBy(() ->
                fileBindingService.bindFiles(
                        List.of(file1.getId(), file1.getId()),
                        UploadPurpose.SUPPORT,
                        "SUPPORT",
                        supportRequestId,
                        userA
                )
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Duplicate file ID");
    }

    @Test
    @DisplayName("bindFile rolls back completely if transaction fails")
    void testBindFileTransactionRollback() {
        UploadedFile file = createTestFile(userA, UploadPurpose.REVIEW);
        UUID reviewId = UUID.randomUUID();

        try {
            transactionTemplate.execute(status -> {
                fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", reviewId, userA);
                throw new RuntimeException("Simulated business error during review creation");
            });
        } catch (RuntimeException expected) {
            assertThat(expected.getMessage()).isEqualTo("Simulated business error during review creation");
        }

        // Verify that after rollback, binding does not exist
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isFalse();

        // Verify that the file can subsequently be bound successfully
        UploadedFileBinding newBinding = fileBindingService.bindFile(
                file.getId(),
                UploadPurpose.REVIEW,
                "REVIEW",
                reviewId,
                userA
        );
        assertThat(newBinding).isNotNull();
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
    }

    @Test
    @DisplayName("bindFile rejects file that is already bound to a Chat message")
    void testBindFileExistingChatBindingFails() {
        UploadedFile file = createTestFile(userA, UploadPurpose.CHAT);
        UUID fileId = file.getId();

        transactionTemplate.executeWithoutResult(status -> {
            ChatMessage message = chatMessageRepository.saveAndFlush(
                    new ChatMessage(conversation, userA, "Here is image", fileId)
            );
            UploadedFile managed = uploadedFileRepository.findById(fileId).orElseThrow();
            managed.bindTo(message);
            uploadedFileRepository.saveAndFlush(managed);
        });

        // Trigger should have populated uploaded_file_bindings as well
        assertThat(uploadedFileBindingRepository.existsById(fileId)).isTrue();

        // Attempting to bind this file via fileBindingService must fail
        assertThatThrownBy(() ->
                fileBindingService.bindFile(fileId, UploadPurpose.CHAT, "CHAT", UUID.randomUUID(), userA)
        )
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already bound");
    }

    @Test
    @DisplayName("Concurrent bindFile calls result in exactly 1 success and 1 failure")
    void testConcurrentBindFileCalls() throws Exception {
        UploadedFile file = createTestFile(userA, UploadPurpose.REVIEW);
        UUID review1 = UUID.randomUUID();
        UUID review2 = UUID.randomUUID();

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        executor.submit(() -> {
            try {
                startLatch.await();
                fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", review1, userA);
                successCount.incrementAndGet();
            } catch (Exception e) {
                failureCount.incrementAndGet();
            } finally {
                doneLatch.countDown();
            }
        });

        executor.submit(() -> {
            try {
                startLatch.await();
                fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", review2, userA);
                successCount.incrementAndGet();
            } catch (Exception e) {
                failureCount.incrementAndGet();
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        boolean completed = doneLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        assertThat(successCount.get()).isEqualTo(1);
        assertThat(failureCount.get()).isEqualTo(1);

        // In DB, exactly 1 binding must exist
        List<UploadedFileBinding> allBindings = uploadedFileBindingRepository.findAll();
        assertThat(allBindings).hasSize(1);
        assertThat(allBindings.get(0).getFileId()).isEqualTo(file.getId());
    }

    @Test
    @DisplayName("bindFiles preserves the caller's order while locking in deterministic UUID order")
    void testBindFilesPreservesCallerOrder() {
        UploadedFile file1 = createTestFile(userA, UploadPurpose.SUPPORT);
        UploadedFile file2 = createTestFile(userA, UploadPurpose.SUPPORT);

        List<UploadedFileBinding> bindings = fileBindingService.bindFiles(
                List.of(file2.getId(), file1.getId()),
                UploadPurpose.SUPPORT,
                "SUPPORT",
                UUID.randomUUID(),
                userA
        );

        assertThat(bindings).extracting(UploadedFileBinding::getFileId)
                .containsExactly(file2.getId(), file1.getId());
    }

    @Test
    @DisplayName("Concurrent bindFiles requests with reversed order bind exactly one entity without deadlock")
    void testConcurrentBindFilesReversedOrder() throws Exception {
        UploadedFile file1 = createTestFile(userA, UploadPurpose.SUPPORT);
        UploadedFile file2 = createTestFile(userA, UploadPurpose.SUPPORT);
        UUID entity1 = UUID.randomUUID();
        UUID entity2 = UUID.randomUUID();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        AtomicInteger successCount = new AtomicInteger(0);
        List<Throwable> failures = Collections.synchronizedList(new ArrayList<>());

        Runnable first = () -> {
            try {
                startLatch.await();
                fileBindingService.bindFiles(
                        List.of(file1.getId(), file2.getId()),
                        UploadPurpose.SUPPORT, "SUPPORT", entity1, userA);
                successCount.incrementAndGet();
            } catch (Throwable t) {
                failures.add(t);
            } finally {
                doneLatch.countDown();
            }
        };
        Runnable second = () -> {
            try {
                startLatch.await();
                fileBindingService.bindFiles(
                        List.of(file2.getId(), file1.getId()),
                        UploadPurpose.SUPPORT, "SUPPORT", entity2, userA);
                successCount.incrementAndGet();
            } catch (Throwable t) {
                failures.add(t);
            } finally {
                doneLatch.countDown();
            }
        };

        executor.submit(first);
        executor.submit(second);
        startLatch.countDown();
        boolean completed = doneLatch.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        assertThat(successCount.get()).isEqualTo(1);
        assertThat(failures).hasSize(1);
        assertThat(failures).noneMatch(t -> t instanceof com.shareloop.exception.ConcurrentBindingException);

        long entity1Count = uploadedFileBindingRepository.countByBoundDomainAndBoundEntityId("SUPPORT", entity1);
        long entity2Count = uploadedFileBindingRepository.countByBoundDomainAndBoundEntityId("SUPPORT", entity2);
        assertThat(entity1Count + entity2Count).isEqualTo(2);
        assertThat(Math.max(entity1Count, entity2Count)).isEqualTo(2);
    }

    @Test
    @DisplayName("findBindingsByDomainAndEntity returns all evidence for a domain record")
    void testFindBindingsByDomainAndEntity() {
        UploadedFile file1 = createTestFile(userA, UploadPurpose.REVIEW);
        UploadedFile file2 = createTestFile(userA, UploadPurpose.REVIEW);
        UUID reviewId = UUID.randomUUID();

        fileBindingService.bindFiles(
                List.of(file1.getId(), file2.getId()),
                UploadPurpose.REVIEW, "REVIEW", reviewId, userA);

        List<UploadedFileBinding> bindings = fileBindingService.findBindingsByDomainAndEntity("REVIEW", reviewId);

        assertThat(bindings).extracting(UploadedFileBinding::getFileId)
                .containsExactlyInAnyOrder(file1.getId(), file2.getId());
        assertThat(fileBindingService.findBindingsByDomainAndEntity("REPORT", reviewId)).isEmpty();
    }

    @Test
    @DisplayName("requireBinding validates the expected domain and entity without removing evidence")
    void testRequireBinding() {
        UploadedFile file = createTestFile(userA, UploadPurpose.REPORT);
        UUID reportId = UUID.randomUUID();
        fileBindingService.bindFile(file.getId(), UploadPurpose.REPORT, "REPORT", reportId, userA);

        assertThat(fileBindingService.requireBinding(file.getId(), "REPORT", reportId).getFileId())
                .isEqualTo(file.getId());
        assertThatThrownBy(() -> fileBindingService.requireBinding(file.getId(), "REPORT", UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThat(uploadedFileBindingRepository.existsById(file.getId())).isTrue();
    }
}
