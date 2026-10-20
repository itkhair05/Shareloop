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

@SpringBootTest
@Transactional
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
                "flyway_schema_history",
                "listing_images",
                "listing_requests",
                "listings",
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
}
