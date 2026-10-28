package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.listing.CreateListingRequest;
import com.shareloop.dto.listing.ListingImageDto;
import com.shareloop.dto.listing.UpdateListingRequest;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import com.shareloop.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class ListingControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private ListingRequestRepository listingRequestRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User userAlice;
    private User userBob;
    private User adminUser;
    private String aliceToken;
    private String bobToken;
    private String adminToken;
    private Category electronicsCategory;
    private Category booksCategory;
    private Category inactiveCategory;

    @BeforeEach
    void setUp() {
        userAlice = userRepository.saveAndFlush(new User(
                "Alice Nguyen",
                "alice." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        userBob = userRepository.saveAndFlush(new User(
                "Bob Tran",
                "bob." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminUser = userRepository.saveAndFlush(new User(
                "Admin System",
                "admin." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(userAlice.getId(), userAlice.getEmail(), userAlice.getRole(), userAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(userBob.getId(), userBob.getEmail(), userBob.getRole(), userBob.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminUser.getId(), adminUser.getEmail(), adminUser.getRole(), adminUser.getStatus());

        electronicsCategory = categoryRepository.saveAndFlush(new Category(
                "Electronics-" + UUID.randomUUID().toString().substring(0, 8),
                "electronics-" + UUID.randomUUID().toString().substring(0, 8),
                "Gadgets and electronic equipment",
                true
        ));

        booksCategory = categoryRepository.saveAndFlush(new Category(
                "Books-" + UUID.randomUUID().toString().substring(0, 8),
                "books-" + UUID.randomUUID().toString().substring(0, 8),
                "Printed books and novels",
                true
        ));

        inactiveCategory = categoryRepository.saveAndFlush(new Category(
                "Inactive-" + UUID.randomUUID().toString().substring(0, 8),
                "inactive-" + UUID.randomUUID().toString().substring(0, 8),
                "Inactive category for testing",
                false
        ));
    }

    private Listing createListing(User owner, Category category, ListingType type, String title, String city, ListingStatus status) {
        Listing listing = new Listing(owner, category, type, title, "Sample description for " + title, city);
        listing.setStatus(status);
        if (type == ListingType.SALE) {
            listing.setPrice(new BigDecimal("150000.00"));
            listing.setCurrency("VND");
        } else if (type == ListingType.WANTED) {
            listing.setPrice(new BigDecimal("50000.00"));
            listing.setCurrency("VND");
        }
        return listingRepository.saveAndFlush(listing);
    }

    @Nested
    @DisplayName("Public Listings Browsing & Filtering")
    class PublicBrowsingTests {

        @Test
        @DisplayName("Browse active listings with pagination and deterministic sorting (newest first)")
        void browseActiveListingsWithPaginationAndSorting() throws Exception {
            Listing l1 = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Old Keyboard", "Da Nang", ListingStatus.ACTIVE);
            Listing l2 = createListing(userBob, booksCategory, ListingType.SALE, "Java Concurrency Book", "Ho Chi Minh City", ListingStatus.ACTIVE);
            Listing l3 = createListing(userAlice, electronicsCategory, ListingType.WANTED, "Monitor 24 inch", "Ha Noi", ListingStatus.ACTIVE);
            // Non-active listings should not appear
            createListing(userBob, booksCategory, ListingType.SALE, "Hidden Draft Book", "Ha Noi", ListingStatus.DRAFT);
            createListing(userBob, booksCategory, ListingType.SALE, "Removed Book", "Ha Noi", ListingStatus.REMOVED);

            mockMvc.perform(get("/api/v1/listings")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(3))))
                    .andExpect(jsonPath("$.content[0].id").value(l3.getId().toString()))
                    .andExpect(jsonPath("$.content[1].id").value(l2.getId().toString()))
                    .andExpect(jsonPath("$.content[2].id").value(l1.getId().toString()))
                    .andExpect(jsonPath("$.content[*].status", everyItem(is("ACTIVE"))));
        }

        @Test
        @DisplayName("Filter listings by type, categoryId, and city")
        void filterListingsByTypeCategoryAndCity() throws Exception {
            createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Wireless Mouse", "Ha Noi", ListingStatus.ACTIVE);
            Listing target = createListing(userBob, electronicsCategory, ListingType.SALE, "Mechanical Keyboard", "Ho Chi Minh City", ListingStatus.ACTIVE);
            createListing(userAlice, booksCategory, ListingType.SALE, "Clean Code Book", "Ho Chi Minh City", ListingStatus.ACTIVE);

            mockMvc.perform(get("/api/v1/listings")
                            .param("type", "SALE")
                            .param("categoryId", electronicsCategory.getId().toString())
                            .param("city", "Ho Chi Minh City"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].id").value(target.getId().toString()))
                    .andExpect(jsonPath("$.content[0].title").value("Mechanical Keyboard"));
        }

        @Test
        @DisplayName("Search listings by keyword in title or description")
        void searchListingsByKeyword() throws Exception {
            createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Vintage Radio Receiver", "Ha Noi", ListingStatus.ACTIVE);
            Listing target = createListing(userBob, booksCategory, ListingType.GIVEAWAY, "Sci-Fi Novel", "Ha Noi", ListingStatus.ACTIVE);
            target.setDescription("A thrilling futuristic sci-fi adventure story");
            listingRepository.saveAndFlush(target);

            mockMvc.perform(get("/api/v1/listings")
                            .param("keyword", "futuristic"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].id").value(target.getId().toString()));
        }

        @Test
        @DisplayName("Search listings with special wildcard characters (% and _) in keyword")
        void searchListingsWithWildcardsInKeyword() throws Exception {
            createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "100% Wool Sweater", "Ha Noi", ListingStatus.ACTIVE);
            createListing(userBob, electronicsCategory, ListingType.GIVEAWAY, "Regular Sweater", "Ha Noi", ListingStatus.ACTIVE);

            mockMvc.perform(get("/api/v1/listings")
                            .param("keyword", "100%"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].title").value("100% Wool Sweater"));
        }

        @Test
        @DisplayName("Reject non-ACTIVE status filter in public browsing")
        void rejectNonActiveStatusFilter() throws Exception {
            mockMvc.perform(get("/api/v1/listings")
                            .param("status", "DRAFT"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Only ACTIVE listings are publicly visible")));
        }

        @Test
        @DisplayName("Reject invalid pagination parameters")
        void rejectInvalidPagination() throws Exception {
            mockMvc.perform(get("/api/v1/listings")
                            .param("page", "-1")
                            .param("size", "20"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Page index must not be less than zero")));

            mockMvc.perform(get("/api/v1/listings")
                            .param("page", "0")
                            .param("size", "0"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Page size must be between 1 and 100")));
        }
    }

    @Nested
    @DisplayName("Public Listing Detail Retrieval")
    class PublicDetailTests {

        @Test
        @DisplayName("Retrieve active public listing detail with safe owner info and sorted images")
        void retrieveActivePublicListingDetail() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Used Smartphone", "Ha Noi", ListingStatus.ACTIVE);
            listing.addImage(new ListingImage(listing, "https://example.com/img2.jpg", 2));
            listing.addImage(new ListingImage(listing, "https://example.com/img1.jpg", 1));
            listingRepository.saveAndFlush(listing);

            mockMvc.perform(get("/api/v1/listings/{id}", listing.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(listing.getId().toString()))
                    .andExpect(jsonPath("$.title").value("Used Smartphone"))
                    .andExpect(jsonPath("$.category.id").value(electronicsCategory.getId().toString()))
                    .andExpect(jsonPath("$.category.name").value(electronicsCategory.getName()))
                    .andExpect(jsonPath("$.owner.id").value(userAlice.getId().toString()))
                    .andExpect(jsonPath("$.owner.displayName").value("Alice Nguyen"))
                    .andExpect(jsonPath("$.owner.passwordHash").doesNotExist())
                    .andExpect(jsonPath("$.owner.password").doesNotExist())
                    .andExpect(jsonPath("$.owner.email").doesNotExist())
                    .andExpect(jsonPath("$.images", hasSize(2)))
                    .andExpect(jsonPath("$.images[0].imageUrl").value("https://example.com/img1.jpg"))
                    .andExpect(jsonPath("$.images[1].imageUrl").value("https://example.com/img2.jpg"));
        }

        @Test
        @DisplayName("Return 404 for non-existent listing ID")
        void return404ForNonExistentListing() throws Exception {
            mockMvc.perform(get("/api/v1/listings/{id}", UUID.randomUUID()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.message").value(containsString("Listing not found")));
        }

        @Test
        @DisplayName("Return 404 for non-active listing when accessed anonymously or by other users")
        void return404ForNonActiveListingToOthers() throws Exception {
            Listing draftListing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Draft Laptop", "Ha Noi", ListingStatus.DRAFT);

            // Anonymous request -> 404
            mockMvc.perform(get("/api/v1/listings/{id}", draftListing.getId()))
                    .andExpect(status().isNotFound());

            // Bob (other user) request -> 404
            mockMvc.perform(get("/api/v1/listings/{id}", draftListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isNotFound());

            // Alice (owner) request -> 200 OK
            mockMvc.perform(get("/api/v1/listings/{id}", draftListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(draftListing.getId().toString()));

            // Admin request -> 200 OK
            mockMvc.perform(get("/api/v1/listings/{id}", draftListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("Authorized requester can retrieve RESERVED listing associated with qualifying transaction")
        void authorizedRequesterCanViewReservedListingWithQualifyingTransaction() throws Exception {
            Listing reservedListing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Reserved Laptop", "Ha Noi", ListingStatus.RESERVED);

            ListingRequest req = new ListingRequest(reservedListing, userBob, "I want this item!", ListingRequestStatus.ACCEPTED);
            req = listingRequestRepository.saveAndFlush(req);

            Transaction tx = new Transaction(req, reservedListing, userAlice, userBob, TransactionStatus.PENDING);
            transactionRepository.saveAndFlush(tx);

            // Bob (qualifying requester) -> 200 OK
            mockMvc.perform(get("/api/v1/listings/{id}", reservedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(reservedListing.getId().toString()))
                    .andExpect(jsonPath("$.status").value("RESERVED"));
        }

        @Test
        @DisplayName("Authorized requester can retrieve COMPLETED listing associated with qualifying completed transaction")
        void authorizedRequesterCanViewCompletedListingWithCompletedTransaction() throws Exception {
            Listing completedListing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Completed Book", "Ha Noi", ListingStatus.COMPLETED);

            ListingRequest req = new ListingRequest(completedListing, userBob, "I want this book!", ListingRequestStatus.ACCEPTED);
            req = listingRequestRepository.saveAndFlush(req);

            Transaction tx = new Transaction(req, completedListing, userAlice, userBob, TransactionStatus.COMPLETED);
            tx.setOwnerCompleted(true);
            tx.setOwnerCompletedAt(Instant.now());
            tx.setRequesterCompleted(true);
            tx.setRequesterCompletedAt(Instant.now());
            transactionRepository.saveAndFlush(tx);

            // Bob (qualifying requester) -> 200 OK
            mockMvc.perform(get("/api/v1/listings/{id}", completedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(completedListing.getId().toString()))
                    .andExpect(jsonPath("$.status").value("COMPLETED"));
        }

        @Test
        @DisplayName("Unrelated authenticated user receives 404 for non-ACTIVE listing")
        void unrelatedAuthenticatedUserReceives404ForNonActiveListing() throws Exception {
            Listing reservedListing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Reserved Laptop", "Ha Noi", ListingStatus.RESERVED);

            ListingRequest req = new ListingRequest(reservedListing, userBob, "I want this item!", ListingRequestStatus.ACCEPTED);
            req = listingRequestRepository.saveAndFlush(req);

            Transaction tx = new Transaction(req, reservedListing, userAlice, userBob, TransactionStatus.PENDING);
            transactionRepository.saveAndFlush(tx);

            // Charlie (unrelated 3rd user)
            User userCharlie = userRepository.saveAndFlush(new User(
                    "Charlie Pham",
                    "charlie." + UUID.randomUUID() + "@example.com",
                    passwordEncoder.encode("Password123!"),
                    UserRole.USER,
                    UserStatus.ACTIVE
            ));
            String charlieToken = "Bearer " + jwtService.generateToken(userCharlie.getId(), userCharlie.getEmail(), userCharlie.getRole(), userCharlie.getStatus());

            // Charlie request -> 404
            mockMvc.perform(get("/api/v1/listings/{id}", reservedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, charlieToken))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.message").value(containsString("Listing not found")));
        }

        @Test
        @DisplayName("Requester whose only transaction is CANCELLED receives 404 for non-ACTIVE listing")
        void requesterWithCancelledTransactionReceives404ForNonActiveListing() throws Exception {
            Listing reservedListing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Cancelled Item", "Ha Noi", ListingStatus.RESERVED);

            ListingRequest req = new ListingRequest(reservedListing, userBob, "I want this item!", ListingRequestStatus.ACCEPTED);
            req = listingRequestRepository.saveAndFlush(req);

            Transaction tx = new Transaction(req, reservedListing, userAlice, userBob, TransactionStatus.CANCELLED);
            tx.setCancelledAt(Instant.now());
            tx.setCancelledBy(userBob);
            tx.setCancellationReason("No longer needed");
            transactionRepository.saveAndFlush(tx);

            // Bob request -> 404
            mockMvc.perform(get("/api/v1/listings/{id}", reservedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.message").value(containsString("Listing not found")));
        }

        @Test
        @DisplayName("Owner and ADMIN maintain existing access to non-ACTIVE listings")
        void ownerAndAdminMaintainExistingAccessToNonActiveListings() throws Exception {
            Listing reservedListing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Reserved Item", "Ha Noi", ListingStatus.RESERVED);

            // Alice (owner) -> 200 OK
            mockMvc.perform(get("/api/v1/listings/{id}", reservedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(reservedListing.getId().toString()));

            // Admin -> 200 OK
            mockMvc.perform(get("/api/v1/listings/{id}", reservedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(reservedListing.getId().toString()));
        }
    }

    @Nested
    @DisplayName("Create Listing Endpoint")
    class CreateListingTests {

        @Test
        @DisplayName("Successfully create GIVEAWAY listing by authenticated user")
        void createGiveawayListingSuccess() throws Exception {
            CreateListingRequest request = new CreateListingRequest(
                    ListingType.GIVEAWAY,
                    electronicsCategory.getId(),
                    "Free Desk Lamp",
                    "A working IKEA desk lamp, warm white bulb included",
                    "Ha Noi"
            );
            request.setNeighborhood("Dong Da");
            request.setImages(List.of(
                    new ListingImageDto(null, "https://example.com/lamp1.jpg", 1)
            ));

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.listingType").value("GIVEAWAY"))
                    .andExpect(jsonPath("$.title").value("Free Desk Lamp"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.price").doesNotExist())
                    .andExpect(jsonPath("$.currency").doesNotExist())
                    .andExpect(jsonPath("$.owner.id").value(userAlice.getId().toString()))
                    .andExpect(jsonPath("$.images", hasSize(1)));
        }

        @Test
        @DisplayName("Successfully create SALE listing with valid price and VND currency")
        void createSaleListingSuccess() throws Exception {
            CreateListingRequest request = new CreateListingRequest(
                    ListingType.SALE,
                    electronicsCategory.getId(),
                    "Bluetooth Speaker",
                    "JBL Go 3, waterproof, excellent condition",
                    "Da Nang"
            );
            request.setPrice(new BigDecimal("450000.00"));
            request.setCurrency("VND");

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.listingType").value("SALE"))
                    .andExpect(jsonPath("$.price").value(450000.00))
                    .andExpect(jsonPath("$.currency").value("VND"));
        }

        @Test
        @DisplayName("Successfully create WANTED listing with or without budget")
        void createWantedListingSuccess() throws Exception {
            // Without price
            CreateListingRequest request1 = new CreateListingRequest(
                    ListingType.WANTED,
                    booksCategory.getId(),
                    "Looking for Calculus textbook",
                    "Need Stewart Calculus 8th edition for university study",
                    "Ha Noi"
            );

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request1)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.listingType").value("WANTED"))
                    .andExpect(jsonPath("$.price").doesNotExist());

            // With price
            CreateListingRequest request2 = new CreateListingRequest(
                    ListingType.WANTED,
                    booksCategory.getId(),
                    "Looking for Clean Architecture book",
                    "Willing to pay up to 200k VND",
                    "Ha Noi"
            );
            request2.setPrice(new BigDecimal("200000.00"));
            request2.setCurrency("VND");

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request2)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.listingType").value("WANTED"))
                    .andExpect(jsonPath("$.price").value(200000.00))
                    .andExpect(jsonPath("$.currency").value("VND"));
        }

        @Test
        @DisplayName("Reject unauthenticated listing creation with 401")
        void rejectUnauthenticatedCreation() throws Exception {
            CreateListingRequest request = new CreateListingRequest(
                    ListingType.GIVEAWAY,
                    electronicsCategory.getId(),
                    "Free Mouse",
                    "Working optical mouse",
                    "Ha Noi"
            );

            mockMvc.perform(post("/api/v1/listings")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Reject validation failures: blank title, blank description, blank city, null categoryId")
        void rejectValidationFailures() throws Exception {
            CreateListingRequest invalidRequest = new CreateListingRequest(
                    ListingType.GIVEAWAY,
                    null,
                    "",
                    "",
                    ""
            );

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(invalidRequest)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.title").exists())
                    .andExpect(jsonPath("$.errors.description").exists())
                    .andExpect(jsonPath("$.errors.city").exists())
                    .andExpect(jsonPath("$.errors.categoryId").exists());
        }

        @Test
        @DisplayName("Reject price on GIVEAWAY listing")
        void rejectPriceOnGiveaway() throws Exception {
            CreateListingRequest request = new CreateListingRequest(
                    ListingType.GIVEAWAY,
                    electronicsCategory.getId(),
                    "Free Monitor",
                    "Free monitor with good screen",
                    "Ha Noi"
            );
            request.setPrice(new BigDecimal("100000.00"));

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Price must not be provided for GIVEAWAY listings")));
        }

        @Test
        @DisplayName("Reject SALE listing without price or with non-positive price")
        void rejectInvalidPriceOnSale() throws Exception {
            CreateListingRequest requestNoPrice = new CreateListingRequest(
                    ListingType.SALE,
                    electronicsCategory.getId(),
                    "Gaming Mouse",
                    "RGB Gaming Mouse",
                    "Ha Noi"
            );

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(requestNoPrice)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("SALE listings require a positive price")));

            CreateListingRequest requestZeroPrice = new CreateListingRequest(
                    ListingType.SALE,
                    electronicsCategory.getId(),
                    "Gaming Mouse",
                    "RGB Gaming Mouse",
                    "Ha Noi"
            );
            requestZeroPrice.setPrice(BigDecimal.ZERO);

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(requestZeroPrice)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("SALE listings require a positive price")));
        }

        @Test
        @DisplayName("Reject inactive or non-existent category")
        void rejectInactiveOrNonExistentCategory() throws Exception {
            // Non-existent category
            CreateListingRequest requestNonExistent = new CreateListingRequest(
                    ListingType.GIVEAWAY,
                    UUID.randomUUID(),
                    "Desk Lamp",
                    "Desk lamp for free",
                    "Ha Noi"
            );

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(requestNonExistent)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.message").value(containsString("Category not found")));

            // Inactive category
            CreateListingRequest requestInactive = new CreateListingRequest(
                    ListingType.GIVEAWAY,
                    inactiveCategory.getId(),
                    "Desk Lamp",
                    "Desk lamp for free",
                    "Ha Noi"
            );

            mockMvc.perform(post("/api/v1/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(requestInactive)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("currently inactive")));
        }
    }

    @Nested
    @DisplayName("Update Listing Endpoint")
    class UpdateListingTests {

        @Test
        @DisplayName("Owner successfully updates listing fields without resetting omitted fields")
        void ownerSuccessfullyUpdatesListing() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Original Title", "Ha Noi", ListingStatus.ACTIVE);
            listing.setNeighborhood("Ba Dinh");
            listingRepository.saveAndFlush(listing);

            UpdateListingRequest request = new UpdateListingRequest();
            request.setTitle("Updated Title with New Price");
            request.setPrice(new BigDecimal("299000.00"));

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Updated Title with New Price"))
                    .andExpect(jsonPath("$.price").value(299000.00))
                    // Omitted fields are preserved
                    .andExpect(jsonPath("$.city").value("Ha Noi"))
                    .andExpect(jsonPath("$.neighborhood").value("Ba Dinh"))
                    .andExpect(jsonPath("$.owner.id").value(userAlice.getId().toString()));
        }

        @Test
        @DisplayName("Reject update from non-owner user with 403 Forbidden")
        void rejectUpdateFromNonOwner() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Alice's Item", "Ha Noi", ListingStatus.ACTIVE);

            UpdateListingRequest request = new UpdateListingRequest();
            request.setTitle("Hacked Title");

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Admin can update any listing")
        void adminCanUpdateAnyListing() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Alice's Item", "Ha Noi", ListingStatus.ACTIVE);

            UpdateListingRequest request = new UpdateListingRequest();
            request.setTitle("Admin Moderated Title");

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Admin Moderated Title"));
        }

        @Test
        @DisplayName("Owner can explicitly clear optional neighborhood by sending null")
        void ownerClearsOptionalFieldWithNull() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Item with Locality", "Ha Noi", ListingStatus.ACTIVE);
            listing.setNeighborhood("Cau Giay");
            listingRepository.saveAndFlush(listing);

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"neighborhood\": null}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.neighborhood").doesNotExist());
        }

        @Test
        @DisplayName("Reject update when listing is already REMOVED or COMPLETED")
        void rejectUpdateOnClosedListing() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Removed Item", "Ha Noi", ListingStatus.REMOVED);

            UpdateListingRequest request = new UpdateListingRequest();
            request.setTitle("Revived Item");

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Cannot update a listing that has been removed")));
        }

        @Test
        @DisplayName("Reject client attempting to transition listing to protected status (RESERVED, COMPLETED, REMOVED)")
        void rejectTransitionToProtectedStatus() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.SALE, "Item", "Ha Noi", ListingStatus.ACTIVE);

            UpdateListingRequest request = new UpdateListingRequest();
            request.setStatus(ListingStatus.COMPLETED);

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Cannot manually transition listing to protected status")));
        }

        @Test
        @DisplayName("Owner of WANTED listing can clear budget by providing null price")
        void ownerCanClearWantedBudget() throws Exception {
            Listing listing = createListing(userAlice, booksCategory, ListingType.WANTED, "Wanted Novel", "Ha Noi", ListingStatus.ACTIVE);
            assertThat(listing.getPrice()).isNotNull();

            mockMvc.perform(put("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"price\": null}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.price").doesNotExist());
        }
    }

    @Nested
    @DisplayName("Delete Listing Endpoint")
    class DeleteListingTests {

        @Test
        @DisplayName("Owner successfully hard deletes listing when no transactions exist")
        void ownerHardDeletesListingWithoutTransactions() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Item to Delete", "Ha Noi", ListingStatus.ACTIVE);

            mockMvc.perform(delete("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isNoContent());

            assertThat(listingRepository.findById(listing.getId())).isEmpty();
        }

        @Test
        @DisplayName("Owner deletion transitions status to REMOVED when transactions exist")
        void safeRemovalWhenTransactionsExist() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Transacted Item", "Ha Noi", ListingStatus.ACTIVE);

            ListingRequest req = new ListingRequest(listing, userBob, "I want this item!", ListingRequestStatus.ACCEPTED);
            req = listingRequestRepository.saveAndFlush(req);

            Transaction tx = new Transaction(req, listing, userAlice, userBob, TransactionStatus.PENDING);
            transactionRepository.saveAndFlush(tx);

            mockMvc.perform(delete("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isNoContent());

            Listing preserved = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(preserved.getStatus()).isEqualTo(ListingStatus.REMOVED);
        }

        @Test
        @DisplayName("Owner deletion transitions status to REMOVED when listing requests exist (even without transactions)")
        void safeRemovalWhenListingRequestsExist() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Requested Item", "Ha Noi", ListingStatus.ACTIVE);

            ListingRequest req = new ListingRequest(listing, userBob, "I would love to have this!", ListingRequestStatus.PENDING);
            listingRequestRepository.saveAndFlush(req);

            mockMvc.perform(delete("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isNoContent());

            Listing preserved = listingRepository.findById(listing.getId()).orElseThrow();
            assertThat(preserved.getStatus()).isEqualTo(ListingStatus.REMOVED);
        }

        @Test
        @DisplayName("Reject delete from non-owner user with 403 Forbidden")
        void rejectDeleteFromNonOwner() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Alice's Item", "Ha Noi", ListingStatus.ACTIVE);

            mockMvc.perform(delete("/api/v1/listings/{id}", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isForbidden());

            assertThat(listingRepository.findById(listing.getId())).isPresent();
        }

        @Test
        @DisplayName("Reject unauthenticated delete with 401 Unauthorized")
        void rejectUnauthenticatedDelete() throws Exception {
            Listing listing = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Alice's Item", "Ha Noi", ListingStatus.ACTIVE);

            mockMvc.perform(delete("/api/v1/listings/{id}", listing.getId()))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("My Listings (/mine) Endpoint")
    class MyListingsTests {

        @Test
        @DisplayName("Return only current user's listings with pagination and status filter")
        void returnOnlyCurrentUserListings() throws Exception {
            Listing a1 = createListing(userAlice, electronicsCategory, ListingType.GIVEAWAY, "Alice Item 1", "Ha Noi", ListingStatus.ACTIVE);
            Listing a2 = createListing(userAlice, booksCategory, ListingType.SALE, "Alice Item 2 Draft", "Ha Noi", ListingStatus.DRAFT);
            createListing(userBob, electronicsCategory, ListingType.GIVEAWAY, "Bob Item 1", "Ha Noi", ListingStatus.ACTIVE);

            // Alice retrieves all her listings
            mockMvc.perform(get("/api/v1/listings/mine")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.content[*].id", containsInAnyOrder(a1.getId().toString(), a2.getId().toString())));

            // Alice filters by DRAFT
            mockMvc.perform(get("/api/v1/listings/mine")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .param("status", "DRAFT"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].id").value(a2.getId().toString()));
        }

        @Test
        @DisplayName("Reject unauthenticated access to /mine with 401")
        void rejectUnauthenticatedMine() throws Exception {
            mockMvc.perform(get("/api/v1/listings/mine"))
                    .andExpect(status().isUnauthorized());
        }
    }
}
