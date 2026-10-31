package com.shareloop.repository;

import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.shareloop.dto.review.RatingCountProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
class JpaRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ListingImageRepository listingImageRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    private User createAndPersistUser(String email, String displayName) {
        User user = new User(displayName, email, "$2a$10$dummyHashValueForTestingPurposesOnly", UserRole.USER, UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    private Category createAndPersistCategory(String slug, String name) {
        Category category = new Category(name, slug, "Description for " + name, true);
        return categoryRepository.save(category);
    }

    @Nested
    @DisplayName("User Entity and Repository Tests")
    class UserPersistenceTests {

        @Test
        @DisplayName("Persist and find user by email and UUID")
        void persistAndFindUser() {
            User user = createAndPersistUser("linh.nguyen@example.com", "Linh Nguyen");

            assertThat(user.getId()).isNotNull();
            assertThat(user.getCreatedAt()).isNotNull();
            assertThat(user.getUpdatedAt()).isNotNull();

            Optional<User> found = userRepository.findByEmail("linh.nguyen@example.com");
            assertThat(found).isPresent();
            assertThat(found.get().getDisplayName()).isEqualTo("Linh Nguyen");
            assertThat(found.get().getRole()).isEqualTo(UserRole.USER);
            assertThat(found.get().getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(userRepository.existsByEmail("linh.nguyen@example.com")).isTrue();
            assertThat(userRepository.existsByEmail("nonexistent@example.com")).isFalse();
        }

        @Test
        @DisplayName("User email uniqueness is enforced")
        void emailUniquenessEnforced() {
            createAndPersistUser("unique@example.com", "First User");

            User duplicate = new User("Second User", "unique@example.com", "hash2", UserRole.USER, UserStatus.ACTIVE);
            assertThatThrownBy(() -> {
                userRepository.save(duplicate);
                userRepository.flush();
            }).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Case-insensitive email query retrieves normalized user")
        void caseInsensitiveEmailQueriesWork() {
            createAndPersistUser("hoang.tran@example.com", "Hoang Tran");

            Optional<User> found = userRepository.findByEmailIgnoreCase("HOANG.TRAN@EXAMPLE.COM");
            assertThat(found).isPresent();
            assertThat(found.get().getEmail()).isEqualTo("hoang.tran@example.com");

            assertThat(userRepository.existsByEmailIgnoreCase("Hoang.Tran@Example.Com")).isTrue();
        }

        @Test
        @DisplayName("findByIdForUpdate retrieves user inside active transaction")
        void findByIdForUpdateRetrievesUser() {
            User user = createAndPersistUser("lock.test@example.com", "Lock User");

            Optional<User> lockedUser = userRepository.findByIdForUpdate(user.getId());
            assertThat(lockedUser).isPresent();
            assertThat(lockedUser.get().getId()).isEqualTo(user.getId());
            assertThat(lockedUser.get().getDisplayName()).isEqualTo("Lock User");
        }

        @Test
        @DisplayName("Persist and query user with avatar fields and verify effective resolution")
        void persistAndQueryUserWithAvatarFields() {
            User user = new User("Avatar User", "avatar.test@example.com", "dummyHash", UserRole.USER, UserStatus.ACTIVE);
            user.setAvatarUrl("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");
            user.setGoogleAvatarUrl("https://lh3.googleusercontent.com/a/google-photo-456");
            Instant now = Instant.now();
            user.setAvatarUpdatedAt(now);

            User saved = userRepository.saveAndFlush(user);
            assertThat(saved.getId()).isNotNull();

            Optional<User> found = userRepository.findById(saved.getId());
            assertThat(found).isPresent();
            assertThat(found.get().getAvatarUrl()).isEqualTo("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");
            assertThat(found.get().getGoogleAvatarUrl()).isEqualTo("https://lh3.googleusercontent.com/a/google-photo-456");
            assertThat(found.get().getAvatarUpdatedAt()).isNotNull();
            assertThat(found.get().getEffectiveAvatarUrl()).isEqualTo("/api/v1/files/550e8400-e29b-41d4-a716-446655440000.jpg");
        }
    }

    @Nested
    @DisplayName("Category Entity and Repository Tests")
    class CategoryPersistenceTests {

        @Test
        @DisplayName("Persist and query active categories by slug")
        void persistAndQueryCategories() {
            Category cat = createAndPersistCategory("electronics-hcmc", "Electronics HCMC");

            assertThat(cat.getId()).isNotNull();
            assertThat(categoryRepository.existsBySlug("electronics-hcmc")).isTrue();

            Optional<Category> found = categoryRepository.findBySlug("electronics-hcmc");
            assertThat(found).isPresent();
            assertThat(found.get().getName()).isEqualTo("Electronics HCMC");

            List<Category> activeCategories = categoryRepository.findByIsActiveTrueOrderByNameAsc();
            assertThat(activeCategories).extracting(Category::getSlug).contains("electronics-hcmc");
        }
    }

    @Nested
    @DisplayName("Listing and ListingImage Entity Tests")
    class ListingPersistenceTests {

        @Test
        @DisplayName("Persist GIVEAWAY listing with default country VN and no price")
        void persistGiveawayListing() {
            User owner = createAndPersistUser("owner.giveaway@example.com", "Giver");
            Category category = createAndPersistCategory("home-appliances", "Home Appliances");

            Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Rice Cooker", "Gently used rice cooker", "Da Nang");
            listing = listingRepository.save(listing);

            assertThat(listing.getId()).isNotNull();
            assertThat(listing.getCountry()).isEqualTo("VN");
            assertThat(listing.getPrice()).isNull();
            assertThat(listing.getStatus()).isEqualTo(ListingStatus.ACTIVE);
            assertThat(listing.getCreatedAt()).isNotNull();

            List<Listing> byOwner = listingRepository.findByOwnerId(owner.getId());
            assertThat(byOwner).hasSize(1);
            assertThat(byOwner.get(0).getTitle()).isEqualTo("Rice Cooker");

            List<Listing> byCity = listingRepository.findByCityIgnoreCaseAndStatus("da nang", ListingStatus.ACTIVE);
            assertThat(byCity).isNotEmpty();
        }

        @Test
        @DisplayName("Persist SALE listing with price, currency, and images")
        void persistSaleListingWithImages() {
            User owner = createAndPersistUser("seller.phone@example.com", "Seller");
            Category category = createAndPersistCategory("smartphones", "Smartphones");

            Listing listing = new Listing(owner, category, ListingType.SALE, "Used Phone", "Good battery health", "Hanoi");
            listing.setPrice(new BigDecimal("1500000.00"));
            listing.setCurrency("VND");

            ListingImage image1 = new ListingImage(listing, "https://shareloop.vn/images/phone1.jpg", 0);
            ListingImage image2 = new ListingImage(listing, "https://shareloop.vn/images/phone2.jpg", 1);
            listing.addImage(image1);
            listing.addImage(image2);

            listing = listingRepository.save(listing);
            listingRepository.flush();

            List<ListingImage> images = listingImageRepository.findByListingIdOrderBySortOrderAsc(listing.getId());
            assertThat(images).hasSize(2);
            assertThat(images.get(0).getImageUrl()).isEqualTo("https://shareloop.vn/images/phone1.jpg");
            assertThat(images.get(1).getImageUrl()).isEqualTo("https://shareloop.vn/images/phone2.jpg");
        }

        @Test
        @DisplayName("Database constraint: SALE listing requires positive price through JPA")
        void saleListingRejectsNullPriceThroughJpa() {
            User owner = createAndPersistUser("seller.invalid@example.com", "Seller");
            Category category = createAndPersistCategory("furniture-cat", "Furniture");

            Listing invalidSale = new Listing(owner, category, ListingType.SALE, "Dining Table", "Wooden", "Hue");
            invalidSale.setPrice(null);

            assertThatThrownBy(() -> {
                listingRepository.save(invalidSale);
                listingRepository.flush();
            }).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Database constraint: GIVEAWAY listing forbids price through JPA")
        void giveawayListingForbidsPriceThroughJpa() {
            User owner = createAndPersistUser("giver.invalid@example.com", "Giver");
            Category category = createAndPersistCategory("kitchen-cat", "Kitchen");

            Listing invalidGiveaway = new Listing(owner, category, ListingType.GIVEAWAY, "Blender", "Working", "Hue");
            invalidGiveaway.setPrice(new BigDecimal("200000.00"));
            invalidGiveaway.setCurrency("VND");

            assertThatThrownBy(() -> {
                listingRepository.save(invalidGiveaway);
                listingRepository.flush();
            }).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Listing country defaults to VN when omitted or null, but allows explicit override")
        void listingCountryBehaviors() {
            User owner = createAndPersistUser("country.tester@example.com", "CountryTester");
            Category category = createAndPersistCategory("country-test-cat", "Country Test Cat");

            // 1. Newly constructed entity defaults to VN
            Listing defaultListing = new Listing(owner, category, ListingType.GIVEAWAY, "Free Book", "Fiction book", "Hanoi");
            assertThat(defaultListing.getCountry()).isEqualTo("VN");
            defaultListing = listingRepository.saveAndFlush(defaultListing);
            assertThat(defaultListing.getCountry()).isEqualTo("VN");

            // 2. Setting country to null triggers @PrePersist fallback to "VN"
            Listing nullCountryListing = new Listing(owner, category, ListingType.GIVEAWAY, "Old Chair", "Wooden chair", "HCMC");
            nullCountryListing.setCountry(null);
            nullCountryListing = listingRepository.saveAndFlush(nullCountryListing);
            assertThat(nullCountryListing.getCountry()).isEqualTo("VN");

            // 3. Explicitly setting another valid country is preserved
            Listing foreignListing = new Listing(owner, category, ListingType.GIVEAWAY, "Souvenir", "From Singapore", "Singapore");
            foreignListing.setCountry("SG");
            foreignListing = listingRepository.saveAndFlush(foreignListing);
            assertThat(foreignListing.getCountry()).isEqualTo("SG");
        }

        @Test
        @DisplayName("Listing images cascade persist, orphan removal, and cascade delete")
        void listingImagesCascadeAndOrphanRemoval() {
            User owner = createAndPersistUser("images.owner@example.com", "Image Owner");
            Category category = createAndPersistCategory("camera-gear", "Camera Gear");

            Listing listing = new Listing(owner, category, ListingType.GIVEAWAY, "Tripod", "Lightweight tripod", "Da Nang");
            ListingImage img1 = new ListingImage(listing, "https://shareloop.vn/img1.jpg", 0);
            ListingImage img2 = new ListingImage(listing, "https://shareloop.vn/img2.jpg", 1);
            listing.addImage(img1);
            listing.addImage(img2);

            listing = listingRepository.saveAndFlush(listing);
            UUID img1Id = img1.getId();
            UUID img2Id = img2.getId();
            assertThat(img1Id).isNotNull();
            assertThat(img2Id).isNotNull();
            assertThat(listingImageRepository.findByListingIdOrderBySortOrderAsc(listing.getId())).hasSize(2);

            // Orphan removal: remove img1 from listing collection
            listing.removeImage(img1);
            listing = listingRepository.saveAndFlush(listing);

            assertThat(listingImageRepository.findByListingIdOrderBySortOrderAsc(listing.getId())).hasSize(1);
            assertThat(listingImageRepository.findById(img1Id)).isEmpty();
            assertThat(listingImageRepository.findById(img2Id)).isPresent();

            // Cascade delete: deleting the listing deletes remaining images
            listingRepository.delete(listing);
            listingRepository.flush();

            assertThat(listingImageRepository.findById(img2Id)).isEmpty();
        }
    }

    @Nested
    @DisplayName("ListingRequest and Transaction Tests")
    class ListingRequestAndTransactionTests {

        @Test
        @DisplayName("Self-request is rejected by database trigger when saving through JPA")
        void selfRequestRejectedThroughJpa() {
            User owner = createAndPersistUser("self.requester@example.com", "Owner");
            Category category = createAndPersistCategory("tools-cat", "Tools");
            Listing listing = listingRepository.save(new Listing(owner, category, ListingType.GIVEAWAY, "Hammer", "Steel hammer", "HCMC"));

            // Owner attempts to request their own item
            ListingRequest selfRequest = new ListingRequest(listing, owner, "Can I take this?", ListingRequestStatus.PENDING);

            assertThatThrownBy(() -> {
                listingRequestRepository.save(selfRequest);
                listingRequestRepository.flush();
            }).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("Users cannot request or make offers on their own listings");
        }

        @Test
        @DisplayName("Persist valid listing request and query by listing/requester")
        void persistAndQueryListingRequest() {
            User owner = createAndPersistUser("owner.req@example.com", "Owner");
            User requester = createAndPersistUser("requester.req@example.com", "Requester");
            Category category = createAndPersistCategory("books-cat", "Books");
            Listing listing = listingRepository.save(new Listing(owner, category, ListingType.GIVEAWAY, "Novel", "Good read", "Hanoi"));

            ListingRequest request = new ListingRequest(listing, requester, "Interested!", ListingRequestStatus.PENDING);
            request = listingRequestRepository.save(request);

            assertThat(request.getId()).isNotNull();
            assertThat(request.getStatus()).isEqualTo(ListingRequestStatus.PENDING);

            List<ListingRequest> byListing = listingRequestRepository.findByListingId(listing.getId());
            assertThat(byListing).hasSize(1);

            List<ListingRequest> byRequester = listingRequestRepository.findByRequesterId(requester.getId());
            assertThat(byRequester).hasSize(1);
        }

        @Test
        @DisplayName("Transaction rejected if request is not ACCEPTED through JPA")
        void transactionRejectsUnacceptedRequestThroughJpa() {
            User owner = createAndPersistUser("tx.owner.unaccepted@example.com", "Owner");
            User requester = createAndPersistUser("tx.req.unaccepted@example.com", "Requester");
            Category category = createAndPersistCategory("cat-unacc", "Unaccepted Cat");
            Listing listing = listingRepository.save(new Listing(owner, category, ListingType.GIVEAWAY, "Monitor", "24 inch", "HCMC"));

            ListingRequest pendingRequest = listingRequestRepository.save(
                    new ListingRequest(listing, requester, "Want this", ListingRequestStatus.PENDING)
            );

            Transaction transaction = new Transaction(pendingRequest, listing, owner, requester, TransactionStatus.PENDING);

            assertThatThrownBy(() -> {
                transactionRepository.save(transaction);
                transactionRepository.flush();
            }).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("expected ACCEPTED");
        }

        @Test
        @DisplayName("Transaction cannot have COMPLETED status without mutual confirmation through JPA")
        void transactionRejectsUnconfirmedCompletionThroughJpa() {
            User owner = createAndPersistUser("tx.owner.unconf@example.com", "Owner");
            User requester = createAndPersistUser("tx.req.unconf@example.com", "Requester");
            Category category = createAndPersistCategory("cat-unconf", "Unconf Cat");
            Listing listing = listingRepository.save(new Listing(owner, category, ListingType.GIVEAWAY, "Desk", "Study desk", "HCMC"));

            ListingRequest acceptedRequest = listingRequestRepository.save(
                    new ListingRequest(listing, requester, "Please accept", ListingRequestStatus.ACCEPTED)
            );

            Transaction transaction = transactionRepository.save(
                    new Transaction(acceptedRequest, listing, owner, requester, TransactionStatus.PENDING)
            );
            transactionRepository.flush();

            // Attempting to set COMPLETED without both confirmations must fail
            transaction.setStatus(TransactionStatus.COMPLETED);
            assertThatThrownBy(() -> {
                transactionRepository.save(transaction);
                transactionRepository.flush();
            }).isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining("chk_transactions_completed_status");
        }

        @Test
        @DisplayName("Transaction succeeds with COMPLETED status when both parties have confirmed")
        void transactionAcceptsMutualCompletionThroughJpa() {
            User owner = createAndPersistUser("tx.owner.mutual@example.com", "Owner");
            User requester = createAndPersistUser("tx.req.mutual@example.com", "Requester");
            Category category = createAndPersistCategory("cat-mutual", "Mutual Cat");
            Listing listing = listingRepository.save(new Listing(owner, category, ListingType.GIVEAWAY, "Desk", "Study desk", "HCMC"));

            ListingRequest acceptedRequest = listingRequestRepository.save(
                    new ListingRequest(listing, requester, "Please accept", ListingRequestStatus.ACCEPTED)
            );

            Transaction transaction = transactionRepository.save(
                    new Transaction(acceptedRequest, listing, owner, requester, TransactionStatus.PENDING)
            );
            transactionRepository.flush();

            // Mutual confirmation enables COMPLETED status
            transaction.setOwnerCompleted(true);
            transaction.setOwnerCompletedAt(Instant.now());
            transaction.setRequesterCompleted(true);
            transaction.setRequesterCompletedAt(Instant.now());
            transaction.setStatus(TransactionStatus.COMPLETED);

            Transaction completedTx = transactionRepository.save(transaction);
            transactionRepository.flush();

            assertThat(completedTx.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            assertThat(completedTx.getOwnerCompleted()).isTrue();
            assertThat(completedTx.getRequesterCompleted()).isTrue();
        }
    }

    @Nested
    @DisplayName("Review Entity and Repository Tests (Phase 10A)")
    class ReviewPersistenceTests {

        private Transaction setupCompletedTransaction(String prefix) {
            User owner = createAndPersistUser(prefix + "-rev-owner@example.com", "Owner " + prefix);
            User requester = createAndPersistUser(prefix + "-rev-req@example.com", "Requester " + prefix);
            Category category = createAndPersistCategory("cat-" + prefix, "Cat " + prefix);
            Listing listing = listingRepository.save(new Listing(owner, category, ListingType.GIVEAWAY, "Item " + prefix, "Description", "Hanoi"));

            ListingRequest req = listingRequestRepository.save(
                    new ListingRequest(listing, requester, "Interested", ListingRequestStatus.ACCEPTED)
            );

            Transaction tx = new Transaction(req, listing, owner, requester, TransactionStatus.PENDING);
            tx.setOwnerCompleted(true);
            tx.setOwnerCompletedAt(Instant.now());
            tx.setRequesterCompleted(true);
            tx.setRequesterCompletedAt(Instant.now());
            tx.setStatus(TransactionStatus.COMPLETED);

            return transactionRepository.saveAndFlush(tx);
        }

        @Test
        @DisplayName("Persist and find review with eager details")
        void persistAndFindReviewWithDetails() {
            Transaction tx = setupCompletedTransaction("jpa-rev-det");
            User owner = tx.getOwner();
            User requester = tx.getRequester();

            Review review = new Review(tx, owner, requester, 5, "Smooth handoff and friendly member!");
            Review saved = reviewRepository.saveAndFlush(review);

            assertThat(saved.getId()).isNotNull();
            assertThat(saved.getCreatedAt()).isNotNull();
            assertThat(saved.getUpdatedAt()).isNotNull();
            assertThat(saved.getIsHidden()).isFalse();

            Optional<Review> foundWithDetails = reviewRepository.findWithDetailsById(saved.getId());
            assertThat(foundWithDetails).isPresent();
            assertThat(foundWithDetails.get().getReviewer().getId()).isEqualTo(owner.getId());
            assertThat(foundWithDetails.get().getReviewee().getId()).isEqualTo(requester.getId());
            assertThat(foundWithDetails.get().getTransaction().getId()).isEqualTo(tx.getId());
            assertThat(foundWithDetails.get().getRating()).isEqualTo(5);
            assertThat(foundWithDetails.get().getComment()).isEqualTo("Smooth handoff and friendly member!");
        }

        @Test
        @DisplayName("Check existence by transaction and reviewer and find all reviews for transaction")
        void checkExistenceAndFindByTransaction() {
            Transaction tx = setupCompletedTransaction("jpa-rev-exist");
            User owner = tx.getOwner();
            User requester = tx.getRequester();

            assertThat(reviewRepository.existsByTransactionIdAndReviewerId(tx.getId(), owner.getId())).isFalse();

            Review r1 = new Review(tx, owner, requester, 5, "Great experience");
            reviewRepository.saveAndFlush(r1);

            assertThat(reviewRepository.existsByTransactionIdAndReviewerId(tx.getId(), owner.getId())).isTrue();
            assertThat(reviewRepository.existsByTransactionIdAndReviewerId(tx.getId(), requester.getId())).isFalse();

            Review r2 = new Review(tx, requester, owner, 4);
            reviewRepository.saveAndFlush(r2);

            List<Review> txReviews = reviewRepository.findByTransactionId(tx.getId());
            assertThat(txReviews).hasSize(2);
        }

        @Test
        @DisplayName("Paginated reviews exclude hidden reviews for public queries")
        void paginatedReviewsExcludeHidden() {
            Transaction tx1 = setupCompletedTransaction("jpa-pg-1");
            Transaction tx2 = setupCompletedTransaction("jpa-pg-2");
            User targetUser = tx1.getRequester();

            // Setup tx2 so that targetUser is also the reviewee
            Transaction tx2Custom = setupCompletedTransaction("jpa-pg-3");
            User reviewer2 = tx2Custom.getOwner();
            // To test reviewee queries, create review on tx1 for targetUser
            Review activeReview = new Review(tx1, tx1.getOwner(), targetUser, 5, "Publicly visible review");
            reviewRepository.saveAndFlush(activeReview);

            // Now create a hidden review for targetUser on another transaction where targetUser is requester
            User owner2 = createAndPersistUser("pg-owner2@example.com", "Owner 2");
            Category cat2 = createAndPersistCategory("pg-cat2", "Cat 2");
            Listing listing2 = listingRepository.save(new Listing(owner2, cat2, ListingType.GIVEAWAY, "Item 2", "Desc", "Hanoi"));
            ListingRequest req2 = listingRequestRepository.save(new ListingRequest(listing2, targetUser, "Request 2", ListingRequestStatus.ACCEPTED));
            Transaction txForHidden = new Transaction(req2, listing2, owner2, targetUser, TransactionStatus.PENDING);
            txForHidden.setOwnerCompleted(true);
            txForHidden.setOwnerCompletedAt(Instant.now());
            txForHidden.setRequesterCompleted(true);
            txForHidden.setRequesterCompletedAt(Instant.now());
            txForHidden.setStatus(TransactionStatus.COMPLETED);
            transactionRepository.saveAndFlush(txForHidden);

            User admin = new User("Admin", "admin-rev-jpa@example.com", "hash", UserRole.ADMIN, UserStatus.ACTIVE);
            userRepository.saveAndFlush(admin);

            Review hiddenReview = new Review(txForHidden, owner2, targetUser, 1, "Offensive content");
            hiddenReview.setIsHidden(true);
            hiddenReview.setModeratedBy(admin);
            hiddenReview.setModeratedAt(Instant.now());
            hiddenReview.setModerationReason("Inappropriate language");
            reviewRepository.saveAndFlush(hiddenReview);

            Page<Review> publicPage = reviewRepository.findActiveByRevieweeId(targetUser.getId(), PageRequest.of(0, 10));
            assertThat(publicPage.getTotalElements()).isEqualTo(1);
            assertThat(publicPage.getContent().get(0).getId()).isEqualTo(activeReview.getId());
            assertThat(publicPage.getContent().get(0).getRating()).isEqualTo(5);
        }

        @Test
        @DisplayName("Aggregation queries compute correct active rating summary and distribution")
        void aggregationQueriesComputeActiveRatingsSummary() {
            User targetUser = createAndPersistUser("target-summary@example.com", "Target User");

            // Transaction 1: rating 5
            User reviewer1 = createAndPersistUser("rev1-sum@example.com", "Rev 1");
            Category cat1 = createAndPersistCategory("cat-sum1", "Cat Sum 1");
            Listing l1 = listingRepository.save(new Listing(reviewer1, cat1, ListingType.GIVEAWAY, "Item 1", "Desc", "Hanoi"));
            ListingRequest req1 = listingRequestRepository.save(new ListingRequest(l1, targetUser, "Req 1", ListingRequestStatus.ACCEPTED));
            Transaction tx1 = new Transaction(req1, l1, reviewer1, targetUser, TransactionStatus.PENDING);
            tx1.setOwnerCompleted(true);
            tx1.setOwnerCompletedAt(Instant.now());
            tx1.setRequesterCompleted(true);
            tx1.setRequesterCompletedAt(Instant.now());
            tx1.setStatus(TransactionStatus.COMPLETED);
            transactionRepository.saveAndFlush(tx1);

            reviewRepository.saveAndFlush(new Review(tx1, reviewer1, targetUser, 5, "Loved it"));

            // Transaction 2: rating 4
            User reviewer2 = createAndPersistUser("rev2-sum@example.com", "Rev 2");
            Category cat2 = createAndPersistCategory("cat-sum2", "Cat Sum 2");
            Listing l2 = listingRepository.save(new Listing(reviewer2, cat2, ListingType.GIVEAWAY, "Item 2", "Desc", "Hanoi"));
            ListingRequest req2 = listingRequestRepository.save(new ListingRequest(l2, targetUser, "Req 2", ListingRequestStatus.ACCEPTED));
            Transaction tx2 = new Transaction(req2, l2, reviewer2, targetUser, TransactionStatus.PENDING);
            tx2.setOwnerCompleted(true);
            tx2.setOwnerCompletedAt(Instant.now());
            tx2.setRequesterCompleted(true);
            tx2.setRequesterCompletedAt(Instant.now());
            tx2.setStatus(TransactionStatus.COMPLETED);
            transactionRepository.saveAndFlush(tx2);

            reviewRepository.saveAndFlush(new Review(tx2, reviewer2, targetUser, 4, "Good"));

            // Transaction 3: rating 5
            User reviewer3 = createAndPersistUser("rev3-sum@example.com", "Rev 3");
            Category cat3 = createAndPersistCategory("cat-sum3", "Cat Sum 3");
            Listing l3 = listingRepository.save(new Listing(reviewer3, cat3, ListingType.GIVEAWAY, "Item 3", "Desc", "Hanoi"));
            ListingRequest req3 = listingRequestRepository.save(new ListingRequest(l3, targetUser, "Req 3", ListingRequestStatus.ACCEPTED));
            Transaction tx3 = new Transaction(req3, l3, reviewer3, targetUser, TransactionStatus.PENDING);
            tx3.setOwnerCompleted(true);
            tx3.setOwnerCompletedAt(Instant.now());
            tx3.setRequesterCompleted(true);
            tx3.setRequesterCompletedAt(Instant.now());
            tx3.setStatus(TransactionStatus.COMPLETED);
            transactionRepository.saveAndFlush(tx3);

            reviewRepository.saveAndFlush(new Review(tx3, reviewer3, targetUser, 5, "Awesome again"));

            // Transaction 4: rating 1, but HIDDEN by admin
            User reviewer4 = createAndPersistUser("rev4-sum@example.com", "Rev 4");
            Category cat4 = createAndPersistCategory("cat-sum4", "Cat Sum 4");
            Listing l4 = listingRepository.save(new Listing(reviewer4, cat4, ListingType.GIVEAWAY, "Item 4", "Desc", "Hanoi"));
            ListingRequest req4 = listingRequestRepository.save(new ListingRequest(l4, targetUser, "Req 4", ListingRequestStatus.ACCEPTED));
            Transaction tx4 = new Transaction(req4, l4, reviewer4, targetUser, TransactionStatus.PENDING);
            tx4.setOwnerCompleted(true);
            tx4.setOwnerCompletedAt(Instant.now());
            tx4.setRequesterCompleted(true);
            tx4.setRequesterCompletedAt(Instant.now());
            tx4.setStatus(TransactionStatus.COMPLETED);
            transactionRepository.saveAndFlush(tx4);

            User admin = userRepository.saveAndFlush(new User("Admin Sum", "admin-sum@example.com", "hash", UserRole.ADMIN, UserStatus.ACTIVE));
            Review hiddenRev = new Review(tx4, reviewer4, targetUser, 1, "Troll review");
            hiddenRev.setIsHidden(true);
            hiddenRev.setModeratedBy(admin);
            hiddenRev.setModeratedAt(Instant.now());
            hiddenRev.setModerationReason("Spam");
            reviewRepository.saveAndFlush(hiddenRev);

            // Verify active count excludes hidden review
            long count = reviewRepository.countActiveByRevieweeId(targetUser.getId());
            assertThat(count).isEqualTo(3);

            // Verify average rating: (5 + 4 + 5) / 3 = 14 / 3 ~ 4.6666...
            Double avg = reviewRepository.getAverageRatingByRevieweeId(targetUser.getId());
            assertThat(avg).isNotNull();
            assertThat(avg).isCloseTo(4.666, org.assertj.core.data.Offset.offset(0.01));

            // Verify grouped rating distribution
            List<RatingCountProjection> distribution = reviewRepository.countRatingsByRevieweeIdGrouped(targetUser.getId());
            assertThat(distribution).hasSize(2);
            // Expected: rating 5 -> count 2; rating 4 -> count 1
            long countRating5 = distribution.stream()
                    .filter(d -> d.getRating() == 5)
                    .mapToLong(RatingCountProjection::getCount)
                    .findFirst()
                    .orElse(0L);
            long countRating4 = distribution.stream()
                    .filter(d -> d.getRating() == 4)
                    .mapToLong(RatingCountProjection::getCount)
                    .findFirst()
                    .orElse(0L);
            assertThat(countRating5).isEqualTo(2);
            assertThat(countRating4).isEqualTo(1);
        }
    }
}
