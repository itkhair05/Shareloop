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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
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
}
