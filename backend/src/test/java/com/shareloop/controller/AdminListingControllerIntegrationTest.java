package com.shareloop.controller;

import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class AdminListingControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ListingRepository listingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User adminDave;
    private User regularAlice;
    private User regularBob;

    private String adminToken;
    private String aliceToken;

    private Category categoryElectronics;
    private Category categoryBooks;

    private Listing listingActiveAlice;
    private Listing listingDraftAlice;
    private Listing listingReservedBob;
    private Listing listingRemovedBob;

    @BeforeEach
    void setUp() {
        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.admin." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        regularAlice = userRepository.saveAndFlush(new User(
                "Alice Nguyen",
                "alice.user." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        regularBob = userRepository.saveAndFlush(new User(
                "Bob Tran",
                "bob.user." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());
        aliceToken = "Bearer " + jwtService.generateToken(regularAlice.getId(), regularAlice.getEmail(), regularAlice.getRole(), regularAlice.getStatus());

        categoryElectronics = categoryRepository.saveAndFlush(new Category(
                "Electronics-" + UUID.randomUUID().toString().substring(0, 8),
                "electronics-" + UUID.randomUUID().toString().substring(0, 8),
                "Gadgets and electronic equipment",
                true
        ));

        categoryBooks = categoryRepository.saveAndFlush(new Category(
                "Books-" + UUID.randomUUID().toString().substring(0, 8),
                "books-" + UUID.randomUUID().toString().substring(0, 8),
                "Literature, text books, and comics",
                true
        ));

        // Alice's active sale listing
        listingActiveAlice = new Listing(regularAlice, categoryElectronics, ListingType.SALE, "Vintage Mechanical Keyboard", "Cherry MX Blue switches in great condition", "Da Nang");
        listingActiveAlice.setPrice(new BigDecimal("500000.00"));
        listingActiveAlice.setCurrency("VND");
        listingActiveAlice.setStatus(ListingStatus.ACTIVE);
        listingActiveAlice = listingRepository.saveAndFlush(listingActiveAlice);

        // Alice's draft giveaway listing
        listingDraftAlice = new Listing(regularAlice, categoryBooks, ListingType.GIVEAWAY, "Old Math Textbook", "Free high school calculus book", "Da Nang");
        listingDraftAlice.setStatus(ListingStatus.DRAFT);
        listingDraftAlice = listingRepository.saveAndFlush(listingDraftAlice);

        // Bob's reserved wanted listing
        listingReservedBob = new Listing(regularBob, categoryElectronics, ListingType.WANTED, "Looking for Noise Cancelling Headphones", "Seeking Sony WH-1000XM4 or equivalent", "Ho Chi Minh City");
        listingReservedBob.setPrice(new BigDecimal("2000000.00"));
        listingReservedBob.setCurrency("VND");
        listingReservedBob.setStatus(ListingStatus.RESERVED);
        listingReservedBob = listingRepository.saveAndFlush(listingReservedBob);

        // Bob's removed sale listing
        listingRemovedBob = new Listing(regularBob, categoryElectronics, ListingType.SALE, "Old Broken Smartphone", "Selling for parts only", "Hanoi");
        listingRemovedBob.setPrice(new BigDecimal("150000.00"));
        listingRemovedBob.setCurrency("VND");
        listingRemovedBob.setStatus(ListingStatus.REMOVED);
        listingRemovedBob = listingRepository.saveAndFlush(listingRemovedBob);
    }

    @Nested
    @DisplayName("Authorization Tests")
    class AuthorizationTests {

        @Test
        @DisplayName("ADMIN role should receive 200 OK")
        void adminCanAccessEndpoint() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", notNullValue()))
                    .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(4)));
        }

        @Test
        @DisplayName("Authenticated regular user should receive 403 Forbidden")
        void regularUserReceives403() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Unauthenticated request should receive 401 Unauthorized")
        void unauthenticatedReceives401() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings"))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("Data Visibility & Filter Tests")
    class DataVisibilityAndFilterTests {

        @Test
        @DisplayName("Returns listings owned by different users across the platform")
        void returnsListingsAcrossAllOwners() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].owner.id", hasItems(
                            regularAlice.getId().toString(),
                            regularBob.getId().toString()
                    )));
        }

        @Test
        @DisplayName("Omitting status returns listings from multiple statuses (DRAFT, ACTIVE, RESERVED, REMOVED)")
        void omittingStatusReturnsAllStatuses() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].status", hasItems("ACTIVE", "DRAFT", "RESERVED", "REMOVED")));
        }

        @Test
        @DisplayName("Filtering by status returns only listings with that exact status")
        void filteringByStatusWorks() throws Exception {
            // Status = REMOVED
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("status", "REMOVED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].status", everyItem(is("REMOVED"))))
                    .andExpect(jsonPath("$.content[*].id", hasItem(listingRemovedBob.getId().toString())))
                    .andExpect(jsonPath("$.content[*].id", not(hasItem(listingActiveAlice.getId().toString()))));

            // Status = DRAFT
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("status", "DRAFT"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].status", everyItem(is("DRAFT"))))
                    .andExpect(jsonPath("$.content[*].id", hasItem(listingDraftAlice.getId().toString())));

            // Status = RESERVED
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("status", "RESERVED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].status", everyItem(is("RESERVED"))))
                    .andExpect(jsonPath("$.content[*].id", hasItem(listingReservedBob.getId().toString())));
        }

        @Test
        @DisplayName("Keyword search matches title and description with case insensitivity")
        void keywordSearchMatchesTitleAndDescription() throws Exception {
            // Match title "Mechanical"
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("keyword", "mechanical"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].id", hasItem(listingActiveAlice.getId().toString())))
                    .andExpect(jsonPath("$.content[*].id", not(hasItem(listingDraftAlice.getId().toString()))));

            // Match description "calculus"
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("keyword", "CALCULUS"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].id", hasItem(listingDraftAlice.getId().toString())));
        }

        @Test
        @DisplayName("Filtering by listingType, categoryId, and ownerId")
        void filtersByTypeCategoryAndOwner() throws Exception {
            // Filter by type = GIVEAWAY
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("type", "GIVEAWAY"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].listingType", everyItem(is("GIVEAWAY"))))
                    .andExpect(jsonPath("$.content[*].id", hasItem(listingDraftAlice.getId().toString())));

            // Filter by category = categoryBooks
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("categoryId", categoryBooks.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].category.id", everyItem(is(categoryBooks.getId().toString()))));

            // Filter by ownerId = regularAlice
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("ownerId", regularAlice.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].owner.id", everyItem(is(regularAlice.getId().toString()))));
        }

        @Test
        @DisplayName("Combined filters combine predictably")
        void combinedFiltersWork() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("status", "ACTIVE")
                            .param("type", "SALE")
                            .param("categoryId", categoryElectronics.getId().toString())
                            .param("keyword", "keyboard"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].id", is(listingActiveAlice.getId().toString())));
        }

        @Test
        @DisplayName("Returns empty page when filters match no listings")
        void returnsEmptyPageWhenNoMatch() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("keyword", "nonexistent-query-string-9999"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements", is(0)))
                    .andExpect(jsonPath("$.empty", is(true)));
        }
    }

    @Nested
    @DisplayName("Pagination & Sorting Tests")
    class PaginationAndSortingTests {

        @Test
        @DisplayName("Paginates results and includes complete page metadata")
        void paginatesCorrectly() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("page", "0")
                            .param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.number", is(0)))
                    .andExpect(jsonPath("$.size", is(2)))
                    .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(4)))
                    .andExpect(jsonPath("$.totalPages", greaterThanOrEqualTo(2)));
        }

        @Test
        @DisplayName("Sorting by title asc works deterministically")
        void sortsByTitleAsc() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("sort", "title,asc"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", not(empty())));
        }

        @Test
        @DisplayName("Sorting via sortBy and sortDirection works")
        void sortsViaSortByAndSortDirection() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("sortBy", "price")
                            .param("sortDirection", "desc"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", not(empty())));
        }

        @Test
        @DisplayName("Invalid sort field returns 400 Bad Request")
        void invalidSortFieldReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("sort", "malicious_sql_column,desc"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Invalid sort direction returns 400 Bad Request")
        void invalidSortDirectionReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("sort", "title,invalid_direction"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Negative page returns 400 Bad Request")
        void negativePageReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("page", "-1"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Page size greater than 100 returns 400 Bad Request")
        void oversizedPageReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("size", "101"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Page size less than or equal to 0 returns 400 Bad Request")
        void zeroPageSizeReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("size", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Invalid enum status returns 400 Bad Request")
        void invalidEnumStatusReturns400() throws Exception {
            mockMvc.perform(get("/api/v1/admin/listings")
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .param("status", "NON_EXISTENT_STATUS"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("Regression Protection Tests")
    class RegressionProtectionTests {

        @Test
        @DisplayName("Public listings endpoint still exposes only ACTIVE listings")
        void publicListingsExposesOnlyActive() throws Exception {
            mockMvc.perform(get("/api/v1/listings"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].status", everyItem(is("ACTIVE"))))
                    .andExpect(jsonPath("$.content[*].id", not(hasItem(listingDraftAlice.getId().toString()))))
                    .andExpect(jsonPath("$.content[*].id", not(hasItem(listingRemovedBob.getId().toString()))));
        }

        @Test
        @DisplayName("Public listings endpoint still rejects non-ACTIVE status parameter")
        void publicListingsRejectsNonActiveStatus() throws Exception {
            mockMvc.perform(get("/api/v1/listings")
                            .param("status", "DRAFT"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("My listings endpoint (/mine) remains strictly scoped to the authenticated owner")
        void myListingsRemainsOwnerScoped() throws Exception {
            mockMvc.perform(get("/api/v1/listings/mine")
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[*].owner.id", everyItem(is(regularAlice.getId().toString()))))
                    .andExpect(jsonPath("$.content[*].id", not(hasItem(listingReservedBob.getId().toString()))))
                    .andExpect(jsonPath("$.content[*].id", not(hasItem(listingRemovedBob.getId().toString()))));
        }
    }
}
