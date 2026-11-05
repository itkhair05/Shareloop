package com.shareloop.service;

import com.shareloop.entity.Category;
import com.shareloop.entity.ChatMessage;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.Listing;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ChatMessageRepository;
import com.shareloop.repository.ConversationRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PostgreSQL-specific direct SQL tests for the V23 triggers. These tests
 * deliberately bypass the Java services to prove the database rejects invalid
 * states on its own.
 */
@SpringBootTest
@ActiveProfiles("test")
class FileBindingTriggerIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private FileBindingService fileBindingService;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

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

    private TransactionTemplate transactionTemplate;
    private User ownerA;
    private User ownerB;
    private Category category;
    private Listing listing;
    private Conversation conversation;

    @BeforeEach
    void setUp() {
        transactionTemplate = new TransactionTemplate(transactionManager);

        ownerA = userRepository.saveAndFlush(new User(
                "Trigger Owner A",
                "trigger.a." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        ownerB = userRepository.saveAndFlush(new User(
                "Trigger Owner B",
                "trigger.b." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        category = categoryRepository.saveAndFlush(new Category(
                "TriggerCategory-" + UUID.randomUUID().toString().substring(0, 8),
                "trigger-cat-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
        listing = new Listing(ownerA, category, ListingType.GIVEAWAY, "Trigger Item", "Description", "Hanoi");
        listing.setStatus(ListingStatus.ACTIVE);
        listing = listingRepository.saveAndFlush(listing);
        conversation = conversationRepository.saveAndFlush(new Conversation(listing, ownerA, ownerB, null));
    }

    @AfterEach
    void tearDown() {
        // Messages first: the FK clears bound_message_id, which lets the Chat sync
        // trigger remove its binding before bindings and files are removed.
        jdbcTemplate.update("DELETE FROM messages");
        jdbcTemplate.update("DELETE FROM uploaded_file_bindings");
        jdbcTemplate.update("DELETE FROM uploaded_files");
        conversationRepository.deleteAll();
        listingRepository.delete(listing);
        categoryRepository.delete(category);
        userRepository.delete(ownerA);
        userRepository.delete(ownerB);
    }

    private UploadedFile createFile(UploadPurpose purpose) {
        UUID id = UUID.randomUUID();
        UploadedFile file = new UploadedFile(id, id + ".png", ownerA, "image/png", 128L, purpose);
        return uploadedFileRepository.saveAndFlush(file);
    }

    private UUID createBoundChatFile() {
        UploadedFile file = createFile(UploadPurpose.CHAT);
        UUID fileId = file.getId();
        transactionTemplate.executeWithoutResult(status -> {
            ChatMessage message = chatMessageRepository.saveAndFlush(
                    new ChatMessage(conversation, ownerA, "Hình đây", fileId));
            UploadedFile managed = uploadedFileRepository.findById(fileId).orElseThrow();
            managed.bindTo(message);
            uploadedFileRepository.saveAndFlush(managed);
        });
        return fileId;
    }

    @Test
    @DisplayName("Updating purpose on a bound file is rejected")
    void purposeMutationOnBoundFileRejected() {
        UploadedFile file = createFile(UploadPurpose.REVIEW);
        fileBindingService.bindFile(file.getId(), UploadPurpose.REVIEW, "REVIEW", UUID.randomUUID(), ownerA);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE uploaded_files SET purpose = 'REPORT' WHERE id = ?", file.getId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("purpose cannot change");
    }

    @Test
    @DisplayName("Updating owner on a bound file is rejected")
    void ownerMutationOnBoundFileRejected() {
        UploadedFile file = createFile(UploadPurpose.REPORT);
        fileBindingService.bindFile(file.getId(), UploadPurpose.REPORT, "REPORT", UUID.randomUUID(), ownerA);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE uploaded_files SET owner_id = ? WHERE id = ?", ownerB.getId(), file.getId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("owner cannot change");
    }

    @Test
    @DisplayName("Mutating purpose of an unbound file is still allowed")
    void purposeMutationOnUnboundFileAllowed() {
        UploadedFile file = createFile(UploadPurpose.REVIEW);

        int updated = jdbcTemplate.update(
                "UPDATE uploaded_files SET purpose = 'REPORT' WHERE id = ?", file.getId());

        assertThat(updated).isEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId()).orElseThrow().getPurpose())
                .isEqualTo(UploadPurpose.REPORT);
    }

    @Test
    @DisplayName("A Chat binding without a matching legacy reference is rejected")
    void chatBindingWithoutLegacyReferenceRejected() {
        UploadedFile file = createFile(UploadPurpose.CHAT);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO uploaded_file_bindings (file_id, bound_domain, bound_entity_id, bound_by_id) "
                        + "VALUES (?, 'CHAT', ?, ?)",
                file.getId(), UUID.randomUUID(), ownerA.getId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("must match bound_message_id");
    }

    @Test
    @DisplayName("Deleting a Chat binding while the legacy reference exists is rejected")
    void chatBindingDeleteWhileLegacyReferenceExistsRejected() {
        UUID fileId = createBoundChatFile();

        Long bindingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM uploaded_file_bindings WHERE file_id = ?", Long.class, fileId);
        assertThat(bindingCount).isEqualTo(1L);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM uploaded_file_bindings WHERE file_id = ?", fileId))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("cannot be deleted while message");
    }

    @Test
    @DisplayName("Valid Chat synchronization keeps exactly one binding and clears it on unbind")
    void validChatSynchronizationIsSingleAndClearsOnUnbind() {
        UUID fileId = createBoundChatFile();

        UUID messageId = jdbcTemplate.queryForObject(
                "SELECT bound_message_id FROM uploaded_files WHERE id = ?", UUID.class, fileId);
        assertThat(messageId).isNotNull();

        jdbcTemplate.update("UPDATE uploaded_files SET bound_message_id = ? WHERE id = ?", messageId, fileId);
        Long afterResync = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM uploaded_file_bindings WHERE file_id = ?", Long.class, fileId);
        assertThat(afterResync).isEqualTo(1L);

        jdbcTemplate.update("UPDATE uploaded_files SET bound_message_id = NULL WHERE id = ?", fileId);
        Long afterUnbind = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM uploaded_file_bindings WHERE file_id = ?", Long.class, fileId);
        assertThat(afterUnbind).isZero();
    }

    @Test
    @DisplayName("Deleting a bound uploaded file row is rejected")
    void boundUploadedFileDeleteRejected() {
        UploadedFile file = createFile(UploadPurpose.SUPPORT);
        fileBindingService.bindFile(file.getId(), UploadPurpose.SUPPORT, "SUPPORT", UUID.randomUUID(), ownerA);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM uploaded_files WHERE id = ?", file.getId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("still bound to a domain record");
    }

    @Test
    @DisplayName("Deleting an unbound uploaded file row is allowed")
    void unboundUploadedFileDeleteAllowed() {
        UploadedFile file = createFile(UploadPurpose.SUPPORT);

        int deleted = jdbcTemplate.update("DELETE FROM uploaded_files WHERE id = ?", file.getId());

        assertThat(deleted).isEqualTo(1);
        assertThat(uploadedFileRepository.findById(file.getId())).isEmpty();
    }

    @Test
    @DisplayName("A pending-deletion file rejects a directly inserted binding")
    void pendingDeletionFileRejectsBinding() {
        UploadedFile file = createFile(UploadPurpose.REVIEW);
        jdbcTemplate.update(
                "UPDATE uploaded_files SET deletion_state = 'PENDING_DELETION', pending_deletion_at = NOW() "
                        + "WHERE id = ?", file.getId());

        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO uploaded_file_bindings (file_id, bound_domain, bound_entity_id, bound_by_id) "
                        + "VALUES (?, 'REVIEW', ?, ?)",
                file.getId(), UUID.randomUUID(), ownerA.getId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("pending deletion");
    }

    @Test
    @DisplayName("A non-Chat file cannot receive a legacy Chat reference")
    void nonChatFileCannotReceiveChatReference() {
        UploadedFile file = createFile(UploadPurpose.REVIEW);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE uploaded_files SET bound_message_id = ? WHERE id = ?",
                UUID.randomUUID(), file.getId()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("cannot reference a chat message");
    }
}
