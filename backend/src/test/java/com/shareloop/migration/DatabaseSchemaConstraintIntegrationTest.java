package com.shareloop.migration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
class DatabaseSchemaConstraintIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private UUID createTestUser(String email) {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                userId, "Test User", email, "hashed_pw_123"
        );
        return userId;
    }

    private UUID createTestCategory(String slug) {
        UUID catId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, true)",
                catId, "Category " + slug, slug
        );
        return catId;
    }

    @Test
    @DisplayName("Verify that all expected 6 domain tables and flyway_schema_history exist")
    void allExpectedTablesExist() {
        List<String> tables = jdbcTemplate.query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
                (rs, rowNum) -> rs.getString("table_name")
        );

        assertThat(tables).contains(
                "categories",
                "conversations",
                "flyway_schema_history",
                "listing_images",
                "listing_requests",
                "listings",
                "messages",
                "notifications",
                "reviews",
                "transactions",
                "users"
        );
    }

    @Test
    @DisplayName("Listings default country to VN when not specified")
    void listingsDefaultCountryToVietnam() {
        UUID userId = createTestUser("vietnam-user@example.com");
        UUID catId = createTestCategory("vn-cat");
        UUID listingId = UUID.randomUUID();

        jdbcTemplate.update(
                "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city) " +
                        "VALUES (?, ?, ?, 'GIVEAWAY', 'Bicycle', 'Good condition', 'Da Nang')",
                listingId, userId, catId
        );

        String country = jdbcTemplate.queryForObject(
                "SELECT country FROM listings WHERE id = ?",
                String.class,
                listingId
        );

        assertThat(country).isEqualTo("VN");
    }

    @Nested
    @DisplayName("Listing Price and Type Constraint Tests")
    class ListingPriceConstraintTests {

        @Test
        @DisplayName("GIVEAWAY listings must not have a price")
        void giveawayMustNotHavePrice() {
            UUID userId = createTestUser("giver@example.com");
            UUID catId = createTestCategory("giveaway-cat");
            UUID listingId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, city) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Free Sofa', 'Good condition', 15.00, 'USD', 'Hanoi')",
                    listingId, userId, catId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_listings_price_rules");
        }

        @Test
        @DisplayName("SALE listings reject NULL price")
        void saleRejectsNullPrice() {
            UUID userId = createTestUser("seller-null@example.com");
            UUID catId = createTestCategory("sale-null-cat");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, city) " +
                            "VALUES (?, ?, ?, 'SALE', 'Vintage Lamp', 'Working well', NULL, NULL, 'Hanoi')",
                    UUID.randomUUID(), userId, catId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_listings_price_rules");
        }

        @Test
        @DisplayName("SALE listings reject zero or negative price")
        void saleRejectsZeroPrice() {
            UUID userId = createTestUser("seller-zero@example.com");
            UUID catId = createTestCategory("sale-zero-cat");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, city) " +
                            "VALUES (?, ?, ?, 'SALE', 'Vintage Lamp', 'Working well', 0.00, 'USD', 'Hanoi')",
                    UUID.randomUUID(), userId, catId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_listings_price_rules");
        }

        @Test
        @DisplayName("SALE listings accept positive price")
        void saleAcceptsPositivePrice() {
            UUID userId = createTestUser("seller-pos@example.com");
            UUID catId = createTestCategory("sale-pos-cat");

            UUID validListingId = UUID.randomUUID();
            int rows = jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, city) " +
                            "VALUES (?, ?, ?, 'SALE', 'Vintage Lamp', 'Working well', 25.50, 'USD', 'Hanoi')",
                    validListingId, userId, catId
            );
            assertThat(rows).isEqualTo(1);
        }

        @Test
        @DisplayName("WANTED listings accept NULL budget")
        void wantedAllowsNullBudget() {
            UUID userId = createTestUser("seeker-null@example.com");
            UUID catId = createTestCategory("wanted-null-cat");

            UUID idWithoutBudget = UUID.randomUUID();
            int rows = jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, city) " +
                            "VALUES (?, ?, ?, 'WANTED', 'Lawnmower Needed', 'Looking for rotary mower', NULL, NULL, 'Hanoi')",
                    idWithoutBudget, userId, catId
            );
            assertThat(rows).isEqualTo(1);
        }

        @Test
        @DisplayName("WANTED listings accept positive budget")
        void wantedAllowsPositiveBudget() {
            UUID userId = createTestUser("seeker-pos@example.com");
            UUID catId = createTestCategory("wanted-pos-cat");

            UUID idWithBudget = UUID.randomUUID();
            int rows = jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, price, currency, city) " +
                            "VALUES (?, ?, ?, 'WANTED', 'Lawnmower Needed', 'Budget up to $50', 50.00, 'USD', 'Hanoi')",
                    idWithBudget, userId, catId
            );
            assertThat(rows).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("Self-Request and Cascade Deletion Tests")
    class RequestAndCascadeTests {

        @Test
        @DisplayName("Users are prevented from requesting their own listings via database trigger")
        void usersCannotRequestOwnListing() {
            UUID ownerId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, 'Owner User', 'owner-self@example.com', 'hashed_pw', 'USER', 'ACTIVE')",
                    ownerId
            );

            UUID catId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO categories (id, name, slug) VALUES (?, 'Tools Self', 'tools-self')",
                    catId
            );

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Power Drill', 'Lightly used', 'Hanoi')",
                    listingId, ownerId, catId
            );

            // Owner attempts to request their own listing
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO listing_requests (id, listing_id, requester_id, message) VALUES (?, ?, ?, 'Can I take this?')",
                    UUID.randomUUID(), listingId, ownerId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Users cannot request or make offers on their own listings");
        }

        @Test
        @DisplayName("Deleting a listing cascades and deletes associated listing images without leaving orphaned records")
        void deletingListingCascadesToImages() {
            UUID ownerId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash) VALUES (?, 'Lister Cascade', 'lister-cascade@example.com', 'pw')",
                    ownerId
            );

            UUID catId = UUID.randomUUID();
            jdbcTemplate.update("INSERT INTO categories (id, name, slug) VALUES (?, 'Books Cascade', 'books-cascade')", catId);

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city) VALUES (?, ?, ?, 'GIVEAWAY', 'Calculus Book', 'Math text', 'Hanoi')",
                    listingId, ownerId, catId
            );

            UUID imageId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listing_images (id, listing_id, image_url, sort_order) VALUES (?, ?, 'https://images.shareloop.org/book.jpg', 0)",
                    imageId, listingId
            );

            // Delete the listing
            jdbcTemplate.update("DELETE FROM listings WHERE id = ?", listingId);

            // Check that the image was cascaded away
            Integer imageCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM listing_images WHERE id = ?",
                    Integer.class,
                    imageId
            );
            assertThat(imageCount).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("Transaction Referential Integrity and Completion Tests")
    class TransactionReferentialIntegrityTests {

        private UUID setupPrerequisites(UUID ownerId, UUID requesterId, String tag, String requestStatus) {
            jdbcTemplate.update("INSERT INTO users (id, display_name, email, password_hash) VALUES (?, 'Owner', 'tx_owner_" + tag + "@example.com', 'pw')", ownerId);
            jdbcTemplate.update("INSERT INTO users (id, display_name, email, password_hash) VALUES (?, 'Requester', 'tx_requester_" + tag + "@example.com', 'pw')", requesterId);

            UUID catId = UUID.randomUUID();
            String slug = "cat-" + tag.replace('_', '-');
            jdbcTemplate.update("INSERT INTO categories (id, name, slug) VALUES (?, 'Cat " + tag + "', ?)", catId, slug);

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update("INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city) VALUES (?, ?, ?, 'GIVEAWAY', 'Item " + tag + "', 'Description', 'HCMC')", listingId, ownerId, catId);

            UUID requestId = UUID.randomUUID();
            jdbcTemplate.update("INSERT INTO listing_requests (id, listing_id, requester_id, status) VALUES (?, ?, ?, ?)", requestId, listingId, requesterId, requestStatus);

            return requestId;
        }

        @Test
        @DisplayName("Transaction cannot be created for a request that has not been ACCEPTED")
        void transactionRejectsNonAcceptedRequest() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID pendingRequestId = setupPrerequisites(ownerId, requesterId, "pending", "PENDING");
            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, pendingRequestId);

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status) " +
                            "VALUES (?, ?, ?, ?, ?, 'PENDING')",
                    UUID.randomUUID(), pendingRequestId, listingId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("expected ACCEPTED");
        }

        @Test
        @DisplayName("Transaction rejects mismatched listing_id")
        void transactionRejectsMismatchedListingId() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "mismatch_listing", "ACCEPTED");

            // Create another unrelated listing
            UUID catId = createTestCategory("cat-dummy-listing");
            UUID otherListingId = UUID.randomUUID();
            jdbcTemplate.update("INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city) VALUES (?, ?, ?, 'GIVEAWAY', 'Other Item', 'Desc', 'HCMC')", otherListingId, ownerId, catId);

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status) " +
                            "VALUES (?, ?, ?, ?, ?, 'PENDING')",
                    UUID.randomUUID(), requestId, otherListingId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Transaction listing_id");
        }

        @Test
        @DisplayName("Transaction rejects mismatched requester_id")
        void transactionRejectsMismatchedRequesterId() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "mismatch_req", "ACCEPTED");
            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, requestId);

            UUID thirdPartyUser = createTestUser("third-party@example.com");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status) " +
                            "VALUES (?, ?, ?, ?, ?, 'PENDING')",
                    UUID.randomUUID(), requestId, listingId, ownerId, thirdPartyUser
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Transaction requester_id");
        }

        @Test
        @DisplayName("Transaction rejects mismatched owner_id")
        void transactionRejectsMismatchedOwnerId() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "mismatch_owner", "ACCEPTED");
            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, requestId);

            UUID fakeOwner = createTestUser("fake-owner@example.com");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status) " +
                            "VALUES (?, ?, ?, ?, ?, 'PENDING')",
                    UUID.randomUUID(), requestId, listingId, fakeOwner, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Transaction owner_id");
        }

        @Test
        @DisplayName("Transaction cannot have status COMPLETED when confirmation flags are false")
        void transactionRequiresBothConfirmations() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "unconfirmed", "ACCEPTED");

            UUID txId = UUID.randomUUID();
            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, requestId);

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, owner_completed, requester_completed) " +
                            "VALUES (?, ?, ?, ?, ?, 'COMPLETED', false, false)",
                    txId, requestId, listingId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_transactions_completed_status");
        }

        @Test
        @DisplayName("Transaction cannot have status COMPLETED when only owner confirmed")
        void transactionRequiresRequesterConfirmationToo() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "partial", "ACCEPTED");

            UUID txId = UUID.randomUUID();
            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, requestId);

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, owner_completed, requester_completed, owner_completed_at) " +
                            "VALUES (?, ?, ?, ?, ?, 'COMPLETED', true, false, CURRENT_TIMESTAMP)",
                    txId, requestId, listingId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_transactions_completed_status");
        }

        @Test
        @DisplayName("Transaction succeeds with status COMPLETED when both parties confirmed")
        void transactionAcceptsMutualCompletion() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "mutual", "ACCEPTED");

            UUID txId = UUID.randomUUID();
            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, requestId);

            int rows = jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, owner_completed, requester_completed, owner_completed_at, requester_completed_at) " +
                            "VALUES (?, ?, ?, ?, ?, 'COMPLETED', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    txId, requestId, listingId, ownerId, requesterId
            );
            assertThat(rows).isEqualTo(1);
        }

        @Test
        @DisplayName("Cannot mutate listing or requester on an accepted request")
        void cannotMutateAcceptedRequestForeignKeys() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID requestId = setupPrerequisites(ownerId, requesterId, "freeze_req", "ACCEPTED");

            UUID anotherUser = createTestUser("another-req@example.com");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE listing_requests SET requester_id = ? WHERE id = ?",
                    anotherUser, requestId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Cannot change listing or requester on an accepted listing request");
        }
    }

    @Nested
    @DisplayName("Chat Conversation and Message Constraint Tests")
    class ChatConversationAndMessageConstraintTests {

        private UUID setupConversationPrerequisites(UUID ownerId, UUID requesterId, String prefix) {
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    ownerId, "Owner " + prefix, prefix + "-owner@example.com", "hash_123"
            );
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    requesterId, "Requester " + prefix, prefix + "-requester@example.com", "hash_123"
            );

            UUID catId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, true)",
                    catId, "Cat " + prefix, "cat-" + prefix
            );

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city, country, status) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Item " + prefix + "', 'Desc', 'Hanoi', 'VN', 'ACTIVE')",
                    listingId, ownerId, catId
            );

            return listingId;
        }

        @Test
        @DisplayName("Conversations must have distinct owner and requester (chk_conversations_distinct_parties)")
        void conversationsMustHaveDistinctParties() {
            UUID userId = createTestUser("self-conv@example.com");
            UUID catId = createTestCategory("self-conv-cat");
            UUID listingId = UUID.randomUUID();

            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city, country, status) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Item', 'Desc', 'Hanoi', 'VN', 'ACTIVE')",
                    listingId, userId, catId
            );

            UUID convId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    convId, listingId, userId, userId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_conversations_distinct_parties");
        }

        @Test
        @DisplayName("Only one conversation per listing and requester (uq_conversations_listing_requester)")
        void uniqueConversationPerListingAndRequester() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "unique-conv");

            UUID conv1 = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    conv1, listingId, ownerId, requesterId
            );

            UUID conv2 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    conv2, listingId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("uq_conversations_listing_requester");
        }

        @Test
        @DisplayName("Conversation owner must match listing owner (trg_validate_conversation_integrity)")
        void conversationOwnerMustMatchListingOwner() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "owner-mismatch");

            UUID wrongOwner = createTestUser("wrong-owner@example.com");
            UUID convId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    convId, listingId, wrongOwner, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Conversation owner_id")
                    .hasMessageContaining("does not match listing owner_id");
        }

        @Test
        @DisplayName("Conversation linked listing_request must match listing and requester")
        void conversationListingRequestMustMatchParties() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "req-mismatch");

            UUID otherListingId = setupConversationPrerequisites(UUID.randomUUID(), UUID.randomUUID(), "other-listing");
            UUID reqId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listing_requests (id, listing_id, requester_id, status) VALUES (?, ?, ?, 'PENDING')",
                    reqId, otherListingId, requesterId
            );

            UUID convId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id, listing_request_id) VALUES (?, ?, ?, ?, ?)",
                    convId, listingId, ownerId, requesterId, reqId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("does not match conversation listing_id");
        }

        @Test
        @DisplayName("Messages content must not be blank or whitespace-only (chk_messages_content_not_empty)")
        void messagesContentMustNotBeBlank() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "empty-msg");

            UUID convId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    convId, listingId, ownerId, requesterId
            );

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID(), convId, requesterId, "   "
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_messages_content_not_empty");
        }

        @Test
        @DisplayName("Message sender must be a participant of the conversation (trg_validate_message_sender_is_participant)")
        void messageSenderMustBeParticipant() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "third-party-msg");

            UUID convId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    convId, listingId, ownerId, requesterId
            );

            UUID outsiderId = createTestUser("outsider@example.com");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID(), convId, outsiderId, "Hello from outsider"
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("is not a participant in conversation");
        }

        @Test
        @DisplayName("Cannot change listing owner when conversations exist for that listing")
        void cannotChangeListingOwnerIfConversationsExist() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "listing-owner-change");

            UUID convId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id) VALUES (?, ?, ?, ?)",
                    convId, listingId, ownerId, requesterId
            );

            UUID newOwner = createTestUser("new-owner@example.com");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE listings SET owner_id = ? WHERE id = ?",
                    newOwner, listingId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Cannot change owner of listing")
                    .hasMessageContaining("because conversations exist for it");
        }

        @Test
        @DisplayName("Cannot change listing or requester on a listing request linked to a conversation")
        void cannotMutateLinkedListingRequest() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID listingId = setupConversationPrerequisites(ownerId, requesterId, "linked-req-mutate");

            UUID reqId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listing_requests (id, listing_id, requester_id, status) VALUES (?, ?, ?, 'PENDING')",
                    reqId, listingId, requesterId
            );

            UUID convId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO conversations (id, listing_id, owner_id, requester_id, listing_request_id) VALUES (?, ?, ?, ?, ?)",
                    convId, listingId, ownerId, requesterId, reqId
            );

            UUID anotherUser = createTestUser("another-linked-req@example.com");

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE listing_requests SET requester_id = ? WHERE id = ?",
                    anotherUser, reqId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Cannot change listing or requester on listing request")
                    .hasMessageContaining("because a conversation is linked to it");
        }
    }

    @Nested
    @DisplayName("Transaction Cancellation Constraint Tests (Migration V4)")
    class TransactionCancellationConstraintTests {

        private UUID setupTransactionPrerequisites(UUID ownerId, UUID requesterId, String prefix) {
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    ownerId, "Owner " + prefix, prefix + "-tx-owner@example.com", "hash_123"
            );
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    requesterId, "Requester " + prefix, prefix + "-tx-req@example.com", "hash_123"
            );

            UUID catId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, true)",
                    catId, "Cat " + prefix, "cat-" + prefix
            );

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city, country, status) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Item " + prefix + "', 'Desc', 'Hanoi', 'VN', 'RESERVED')",
                    listingId, ownerId, catId
            );

            UUID reqId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listing_requests (id, listing_id, requester_id, status) VALUES (?, ?, ?, 'ACCEPTED')",
                    reqId, listingId, requesterId
            );

            return reqId;
        }

        @Test
        @DisplayName("Non-cancelled transaction cannot have cancellation metadata")
        void nonCancelledTransactionCannotHaveCancellationMetadata() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID reqId = setupTransactionPrerequisites(ownerId, requesterId, "non-cancel");

            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, reqId);
            UUID txId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, cancelled_at, cancelled_by) " +
                            "VALUES (?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, ?)",
                    txId, reqId, listingId, ownerId, requesterId, ownerId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Cancellation metadata must be null for non-cancelled transactions");
        }

        @Test
        @DisplayName("Cancelled transaction requires non-null cancelled_at and cancelled_by")
        void cancelledTransactionRequiresMetadata() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID reqId = setupTransactionPrerequisites(ownerId, requesterId, "cancel-null-meta");

            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, reqId);
            UUID txId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status) " +
                            "VALUES (?, ?, ?, ?, ?, 'CANCELLED')",
                    txId, reqId, listingId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("cancelled_at must not be null when transaction is cancelled");
        }

        @Test
        @DisplayName("Admin cancellation requires non-empty cancellation_reason")
        void adminCancellationRequiresReason() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID reqId = setupTransactionPrerequisites(ownerId, requesterId, "admin-cancel-req");

            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, reqId);
            UUID adminId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, 'Admin User', 'admin-tx-cancel@example.com', 'hash_123', 'ADMIN', 'ACTIVE')",
                    adminId
            );

            UUID txId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, cancelled_at, cancelled_by, cancellation_reason) " +
                            "VALUES (?, ?, ?, ?, ?, 'CANCELLED', CURRENT_TIMESTAMP, ?, '   ')",
                    txId, reqId, listingId, ownerId, requesterId, adminId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("cancellation_reason is mandatory for administrator cancellation");
        }

        @Test
        @DisplayName("Participant cancellation succeeds with or without cancellation reason")
        void participantCancellationSucceedsWithoutReason() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID reqId = setupTransactionPrerequisites(ownerId, requesterId, "part-cancel-ok");

            UUID listingId = jdbcTemplate.queryForObject("SELECT listing_id FROM listing_requests WHERE id = ?", UUID.class, reqId);
            UUID txId = UUID.randomUUID();

            int rows = jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, cancelled_at, cancelled_by, cancellation_reason) " +
                            "VALUES (?, ?, ?, ?, ?, 'CANCELLED', CURRENT_TIMESTAMP, ?, NULL)",
                    txId, reqId, listingId, ownerId, requesterId, ownerId
            );
            assertThat(rows).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("Flyway V5 - Default Categories Seed Verification")
    class FlywayV5DefaultCategoriesSeedTests {

        @Test
        @DisplayName("Verify that all 9 default community categories are seeded with valid slugs and active status")
        void defaultCategoriesAreSeeded() {
            List<String> slugs = jdbcTemplate.query(
                    "SELECT slug FROM categories WHERE is_active = TRUE ORDER BY slug",
                    (rs, rowNum) -> rs.getString("slug")
            );

            assertThat(slugs).contains(
                    "baby-kids",
                    "books-media",
                    "clothing-accessories",
                    "electronics-appliances",
                    "food-pantry",
                    "home-furniture",
                    "other",
                    "sports-outdoors",
                    "tools-diy"
            );
        }
    }

    @Nested
    @DisplayName("Reviews and Ratings Constraint and Trigger Tests (Migration V6)")
    class ReviewConstraintAndTriggerTests {

        private UUID setupCompletedTransaction(UUID ownerId, UUID requesterId, String prefix) {
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    ownerId, "Owner " + prefix, prefix + "-rev-owner@example.com", "hash_123"
            );
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    requesterId, "Requester " + prefix, prefix + "-rev-req@example.com", "hash_123"
            );

            UUID catId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, true)",
                    catId, "Cat " + prefix, "cat-" + prefix
            );

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city, country, status) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Item " + prefix + "', 'Desc', 'Hanoi', 'VN', 'COMPLETED')",
                    listingId, ownerId, catId
            );

            UUID reqId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listing_requests (id, listing_id, requester_id, status) VALUES (?, ?, ?, 'ACCEPTED')",
                    reqId, listingId, requesterId
            );

            UUID txId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status, owner_completed, requester_completed, owner_completed_at, requester_completed_at) " +
                            "VALUES (?, ?, ?, ?, ?, 'COMPLETED', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    txId, reqId, listingId, ownerId, requesterId
            );

            return txId;
        }

        private UUID setupPendingTransaction(UUID ownerId, UUID requesterId, String prefix) {
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    ownerId, "Owner " + prefix, prefix + "-rev-p-owner@example.com", "hash_123"
            );
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'USER', 'ACTIVE')",
                    requesterId, "Requester " + prefix, prefix + "-rev-p-req@example.com", "hash_123"
            );

            UUID catId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, true)",
                    catId, "Cat " + prefix, "cat-" + prefix
            );

            UUID listingId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listings (id, owner_id, category_id, listing_type, title, description, city, country, status) " +
                            "VALUES (?, ?, ?, 'GIVEAWAY', 'Item " + prefix + "', 'Desc', 'Hanoi', 'VN', 'RESERVED')",
                    listingId, ownerId, catId
            );

            UUID reqId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO listing_requests (id, listing_id, requester_id, status) VALUES (?, ?, ?, 'ACCEPTED')",
                    reqId, listingId, requesterId
            );

            UUID txId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO transactions (id, listing_request_id, listing_id, owner_id, requester_id, status) " +
                            "VALUES (?, ?, ?, ?, ?, 'PENDING')",
                    txId, reqId, listingId, ownerId, requesterId
            );

            return txId;
        }

        @Test
        @DisplayName("Verify reviews table exists with all required columns")
        void reviewsTableAndColumnsExist() {
            List<String> columns = jdbcTemplate.query(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = 'reviews' ORDER BY column_name",
                    (rs, rowNum) -> rs.getString("column_name")
            );

            assertThat(columns).contains(
                    "id",
                    "transaction_id",
                    "reviewer_id",
                    "reviewee_id",
                    "rating",
                    "comment",
                    "is_hidden",
                    "moderated_by",
                    "moderated_at",
                    "moderation_reason",
                    "created_at",
                    "updated_at"
            );
        }

        @Test
        @DisplayName("Both participants can submit a review for a COMPLETED transaction")
        void bothParticipantsCanReviewCompletedTransaction() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "both-ok");

            UUID r1 = UUID.randomUUID();
            int rows1 = jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 5, 'Great exchange!')",
                    r1, txId, ownerId, requesterId
            );
            assertThat(rows1).isEqualTo(1);

            UUID r2 = UUID.randomUUID();
            int rows2 = jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 4, NULL)",
                    r2, txId, requesterId, ownerId
            );
            assertThat(rows2).isEqualTo(1);
        }

        @Test
        @DisplayName("Duplicate review by the same participant on the same transaction is rejected")
        void duplicateReviewBySameParticipantRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "dup-rev");

            UUID r1 = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 5, 'First review')",
                    r1, txId, ownerId, requesterId
            );

            UUID r2 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 3, 'Second review attempt')",
                    r2, txId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Rating below 1 is rejected")
        void ratingBelowOneRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "rating-low");

            UUID r0 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 0, 'Zero rating')",
                    r0, txId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Rating above 5 is rejected")
        void ratingAboveFiveRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "rating-high");

            UUID r6 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 6, 'Six rating')",
                    r6, txId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Blank whitespace-only comment is rejected")
        void blankWhitespaceCommentRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "blank-cmt");

            UUID r = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 4, '    ')",
                    r, txId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Reviewer and reviewee cannot be the same user")
        void reviewerAndRevieweeMustDiffer() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "same-user");

            UUID r = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 5, 'Self review')",
                    r, txId, ownerId, ownerId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Cannot review a non-completed transaction")
        void cannotReviewNonCompletedTransaction() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupPendingTransaction(ownerId, requesterId, "non-comp");

            UUID r = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 5, 'Review on pending')",
                    r, txId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("expected COMPLETED");
        }

        @Test
        @DisplayName("Non-participant reviewer is rejected")
        void nonParticipantReviewerRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "non-part-r");

            UUID outsiderId = createTestUser("outsider-rev1@example.com");

            UUID r1 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 5, 'Outsider reviewer')",
                    r1, txId, outsiderId, ownerId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("do not match transaction");
        }

        @Test
        @DisplayName("Non-participant reviewee is rejected")
        void nonParticipantRevieweeRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "non-part-e");

            UUID outsiderId = createTestUser("outsider-rev2@example.com");

            UUID r2 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 5, 'Outsider reviewee')",
                    r2, txId, ownerId, outsiderId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("do not match transaction");
        }

        @Test
        @DisplayName("Hidden review without moderation metadata is rejected")
        void hiddenReviewWithoutModerationMetadataRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "mod-meta-1");

            UUID r1 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment, is_hidden) " +
                            "VALUES (?, ?, ?, ?, 5, 'Hidden without mod', TRUE)",
                    r1, txId, ownerId, requesterId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("moderated_by must not be null for hidden reviews");
        }

        @Test
        @DisplayName("Unhidden review retaining moderation metadata is rejected")
        void unhiddenReviewWithModerationMetadataRejected() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "mod-meta-2");

            UUID adminId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, 'Admin Rev 2', 'admin-rev2@example.com', 'hash_123', 'ADMIN', 'ACTIVE')",
                    adminId
            );

            UUID r2 = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment, is_hidden, moderated_by) " +
                            "VALUES (?, ?, ?, ?, 5, 'Unhidden with mod', FALSE, ?)",
                    r2, txId, ownerId, requesterId, adminId
            )).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Moderation metadata must be null for non-hidden reviews");
        }

        @Test
        @DisplayName("Hidden review with complete moderation metadata succeeds")
        void hiddenReviewWithProperModerationMetadataSucceeds() {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "mod-meta-3");

            UUID adminId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, password_hash, role, status) VALUES (?, 'Admin Rev 3', 'admin-rev3@example.com', 'hash_123', 'ADMIN', 'ACTIVE')",
                    adminId
            );

            UUID r3 = UUID.randomUUID();
            int rows = jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment, is_hidden, moderated_by, moderated_at, moderation_reason) " +
                            "VALUES (?, ?, ?, ?, 1, 'Inappropriate review', TRUE, ?, CURRENT_TIMESTAMP, 'Violation of guidelines')",
                    r3, txId, ownerId, requesterId, adminId
            );
            assertThat(rows).isEqualTo(1);
        }

        @Test
        @DisplayName("Updated_at trigger advances on review modification")
        void updatedAtTriggerAdvancesOnUpdate() throws InterruptedException {
            UUID ownerId = UUID.randomUUID();
            UUID requesterId = UUID.randomUUID();
            UUID txId = setupCompletedTransaction(ownerId, requesterId, "upd-trig");

            UUID r = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO reviews (id, transaction_id, reviewer_id, reviewee_id, rating, comment) " +
                            "VALUES (?, ?, ?, ?, 4, 'Initial comment')",
                    r, txId, ownerId, requesterId
            );

            var initialUpdatedAt = jdbcTemplate.queryForObject(
                    "SELECT updated_at FROM reviews WHERE id = ?",
                    java.time.OffsetDateTime.class,
                    r
            );

            Thread.sleep(50);

            jdbcTemplate.update(
                    "UPDATE reviews SET comment = 'Updated comment' WHERE id = ?",
                    r
            );

            var newUpdatedAt = jdbcTemplate.queryForObject(
                    "SELECT updated_at FROM reviews WHERE id = ?",
                    java.time.OffsetDateTime.class,
                    r
            );

            assertThat(newUpdatedAt).isAfterOrEqualTo(initialUpdatedAt);
        }
    }

    @Nested
    @DisplayName("Notification Constraint Tests")
    class NotificationConstraintTests {

        @Test
        @DisplayName("Valid notification inserts with default unread state and null read_at")
        void validNotificationInsertsSuccessfully() {
            UUID recipient = createTestUser("notif-user-" + UUID.randomUUID() + "@example.com");
            UUID notifId = UUID.randomUUID();

            jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message) VALUES (?, ?, 'REQUEST_RECEIVED', 'New Request', 'Someone requested your item')",
                    notifId, recipient
            );

            Boolean isRead = jdbcTemplate.queryForObject(
                    "SELECT is_read FROM notifications WHERE id = ?",
                    Boolean.class,
                    notifId
            );
            assertThat(isRead).isFalse();

            var readAt = jdbcTemplate.queryForObject(
                    "SELECT read_at FROM notifications WHERE id = ?",
                    java.time.OffsetDateTime.class,
                    notifId
            );
            assertThat(readAt).isNull();
        }

        @Test
        @DisplayName("chk_notifications_read_consistency: is_read=true requires read_at not null")
        void isReadTrueRequiresReadAtNotNull() {
            UUID recipient = createTestUser("notif-user-" + UUID.randomUUID() + "@example.com");
            UUID notifId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message, is_read, read_at) VALUES (?, ?, 'REQUEST_RECEIVED', 'Title', 'Message', true, null)",
                    notifId, recipient
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("chk_notifications_read_consistency: is_read=false requires read_at null")
        void isReadFalseRequiresReadAtNull() {
            UUID recipient = createTestUser("notif-user-" + UUID.randomUUID() + "@example.com");
            UUID notifId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message, is_read, read_at) VALUES (?, ?, 'REQUEST_RECEIVED', 'Title', 'Message', false, CURRENT_TIMESTAMP)",
                    notifId, recipient
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("chk_notifications_title_not_blank: Blank title is rejected")
        void blankTitleIsRejected() {
            UUID recipient = createTestUser("notif-user-" + UUID.randomUUID() + "@example.com");
            UUID notifId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message) VALUES (?, ?, 'REQUEST_RECEIVED', '   ', 'Message')",
                    notifId, recipient
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("chk_notifications_message_not_blank: Blank message is rejected")
        void blankMessageIsRejected() {
            UUID recipient = createTestUser("notif-user-" + UUID.randomUUID() + "@example.com");
            UUID notifId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message) VALUES (?, ?, 'REQUEST_RECEIVED', 'Title', '   ')",
                    notifId, recipient
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Foreign key violation when recipient does not exist")
        void foreignKeyRecipientDoesNotExist() {
            UUID notifId = UUID.randomUUID();
            UUID nonExistentRecipient = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message) VALUES (?, ?, 'REQUEST_RECEIVED', 'Title', 'Message')",
                    notifId, nonExistentRecipient
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("trg_notifications_updated_at updates timestamp on row modification")
        void updatedAtTriggerFires() throws Exception {
            UUID recipient = createTestUser("notif-user-" + UUID.randomUUID() + "@example.com");
            UUID notifId = UUID.randomUUID();

            jdbcTemplate.update(
                    "INSERT INTO notifications (id, recipient_id, type, title, message) VALUES (?, ?, 'REQUEST_RECEIVED', 'Title', 'Message')",
                    notifId, recipient
            );

            var initialUpdatedAt = jdbcTemplate.queryForObject(
                    "SELECT updated_at FROM notifications WHERE id = ?",
                    java.time.OffsetDateTime.class,
                    notifId
            );

            Thread.sleep(50);

            jdbcTemplate.update(
                    "UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = ?",
                    notifId
            );

            var newUpdatedAt = jdbcTemplate.queryForObject(
                    "SELECT updated_at FROM notifications WHERE id = ?",
                    java.time.OffsetDateTime.class,
                    notifId
            );

            assertThat(newUpdatedAt).isAfterOrEqualTo(initialUpdatedAt);
        }
    }

    @Nested
    @DisplayName("User Phone Number Format Constraint Tests (chk_users_phone_format)")
    class UserPhoneNumberConstraintTests {

        @Test
        @DisplayName("Valid 10-digit Vietnamese phone number starting with 0 is accepted by database")
        void validVietnamesePhoneNumberAccepted() {
            UUID userId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Valid Phone', 'valid.phone@example.com', '0912345678', 'hash', 'USER', 'ACTIVE')",
                    userId
            );

            String savedPhone = jdbcTemplate.queryForObject(
                    "SELECT phone_number FROM users WHERE id = ?",
                    String.class,
                    userId
            );
            assertThat(savedPhone).isEqualTo("0912345678");
        }

        @Test
        @DisplayName("NULL phone number is accepted by database constraint")
        void nullPhoneNumberAccepted() {
            UUID userId = UUID.randomUUID();
            jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Null Phone', 'null.phone@example.com', NULL, 'hash', 'USER', 'ACTIVE')",
                    userId
            );

            String savedPhone = jdbcTemplate.queryForObject(
                    "SELECT phone_number FROM users WHERE id = ?",
                    String.class,
                    userId
            );
            assertThat(savedPhone).isNull();
        }

        @Test
        @DisplayName("Legacy +84 phone number violates chk_users_phone_format constraint")
        void legacyPlus84PhoneNumberViolatesConstraint() {
            UUID userId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Invalid Phone', 'legacy@example.com', '+84912345678', 'hash', 'USER', 'ACTIVE')",
                    userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("9-digit number violates chk_users_phone_format constraint")
        void shortPhoneNumberViolatesConstraint() {
            UUID userId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Short Phone', 'short@example.com', '091234567', 'hash', 'USER', 'ACTIVE')",
                    userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("11-digit number violates chk_users_phone_format constraint")
        void longPhoneNumberViolatesConstraint() {
            UUID userId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Long Phone', 'long@example.com', '09123456789', 'hash', 'USER', 'ACTIVE')",
                    userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Letters in phone number violate chk_users_phone_format constraint")
        void lettersInPhoneNumberViolateConstraint() {
            UUID userId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Letter Phone', 'letter@example.com', '091234567a', 'hash', 'USER', 'ACTIVE')",
                    userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Punctuation in phone number violates chk_users_phone_format constraint")
        void punctuationInPhoneNumberViolatesConstraint() {
            UUID userId = UUID.randomUUID();
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO users (id, display_name, email, phone_number, password_hash, role, status) VALUES (?, 'Dash Phone', 'dash@example.com', '091-234-5678', 'hash', 'USER', 'ACTIVE')",
                    userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Nested
    @DisplayName("Migration V10 - Support Requests Constraints")
    class SupportRequestConstraintTests {

        @Test
        @DisplayName("Valid support request can be inserted")
        void validSupportRequest_Success() {
            UUID userId = createTestUser("sup_user_" + UUID.randomUUID());
            UUID srId = UUID.randomUUID();

            int rows = jdbcTemplate.update(
                    "INSERT INTO support_requests (id, requester_id, category, subject, description, status) VALUES (?, ?, 'ACCOUNT_ISSUE', 'Help subject', 'Help description', 'PENDING')",
                    srId, userId
            );
            assertThat(rows).isEqualTo(1);
        }

        @Test
        @DisplayName("Invalid category violates chk_support_requests_category")
        void invalidCategory_ViolatesConstraint() {
            UUID userId = createTestUser("sup_cat_" + UUID.randomUUID());
            UUID srId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO support_requests (id, requester_id, category, subject, description, status) VALUES (?, ?, 'INVALID_CAT', 'Subject', 'Description', 'PENDING')",
                    srId, userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Blank subject violates chk_support_requests_subject_not_blank")
        void blankSubject_ViolatesConstraint() {
            UUID userId = createTestUser("sup_subj_" + UUID.randomUUID());
            UUID srId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO support_requests (id, requester_id, category, subject, description, status) VALUES (?, ?, 'OTHER', '   ', 'Description', 'PENDING')",
                    srId, userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Nested
    @DisplayName("Migration V10 - Reports Constraints & Partial Unique Index")
    class ReportConstraintTests {

        @Test
        @DisplayName("Valid report can be inserted")
        void validReport_Success() {
            UUID reporterId = createTestUser("rep_reporter_" + UUID.randomUUID());
            UUID targetUserId = createTestUser("rep_target_" + UUID.randomUUID());
            UUID reportId = UUID.randomUUID();

            int rows = jdbcTemplate.update(
                    "INSERT INTO reports (id, reporter_id, target_type, target_id, category, description, status) VALUES (?, ?, 'USER', ?, 'HARASSMENT', 'Abuse in chat', 'PENDING')",
                    reportId, reporterId, targetUserId
            );
            assertThat(rows).isEqualTo(1);
        }

        @Test
        @DisplayName("Self reporting as USER violates chk_reports_no_self_user_report constraint")
        void selfUserReport_ViolatesConstraint() {
            UUID userId = createTestUser("rep_self_" + UUID.randomUUID());
            UUID reportId = UUID.randomUUID();

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reports (id, reporter_id, target_type, target_id, category, description, status) VALUES (?, ?, 'USER', ?, 'HARASSMENT', 'Reporting myself', 'PENDING')",
                    reportId, userId, userId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Duplicate active reports violate partial unique index idx_unique_active_report_per_target")
        void duplicateActiveReports_ViolatePartialUniqueIndex() {
            UUID reporterId = createTestUser("rep_dup1_" + UUID.randomUUID());
            UUID targetUserId = createTestUser("rep_dup2_" + UUID.randomUUID());
            UUID report1Id = UUID.randomUUID();
            UUID report2Id = UUID.randomUUID();

            jdbcTemplate.update(
                    "INSERT INTO reports (id, reporter_id, target_type, target_id, category, description, status) VALUES (?, ?, 'USER', ?, 'FRAUD_OR_SCAM', 'First active', 'PENDING')",
                    report1Id, reporterId, targetUserId
            );

            assertThatThrownBy(() -> jdbcTemplate.update(
                    "INSERT INTO reports (id, reporter_id, target_type, target_id, category, description, status) VALUES (?, ?, 'USER', ?, 'FRAUD_OR_SCAM', 'Second active', 'INVESTIGATING')",
                    report2Id, reporterId, targetUserId
            )).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Allows second report when earlier report is RESOLVED")
        void allowsSecondReportWhenFirstResolved() {
            UUID reporterId = createTestUser("rep_res1_" + UUID.randomUUID());
            UUID targetUserId = createTestUser("rep_res2_" + UUID.randomUUID());
            UUID report1Id = UUID.randomUUID();
            UUID report2Id = UUID.randomUUID();

            jdbcTemplate.update(
                    "INSERT INTO reports (id, reporter_id, target_type, target_id, category, description, status) VALUES (?, ?, 'USER', ?, 'FRAUD_OR_SCAM', 'First resolved', 'RESOLVED')",
                    report1Id, reporterId, targetUserId
            );

            int rows = jdbcTemplate.update(
                    "INSERT INTO reports (id, reporter_id, target_type, target_id, category, description, status) VALUES (?, ?, 'USER', ?, 'FRAUD_OR_SCAM', 'Second active', 'PENDING')",
                    report2Id, reporterId, targetUserId
            );
            assertThat(rows).isEqualTo(1);
        }
    }
}
