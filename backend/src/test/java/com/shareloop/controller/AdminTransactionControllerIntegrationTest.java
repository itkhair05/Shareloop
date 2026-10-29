package com.shareloop.controller;

import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminTransactionControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

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
    private ReviewRepository reviewRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User ownerAlice;
    private User requesterBob;
    private User secondOwnerCharlie;
    private User secondRequesterDiana;
    private User adminDave;

    private String aliceToken;
    private String adminToken;

    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Wonder",
                "alice.adm.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Builder",
                "bob.adm.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        secondOwnerCharlie = userRepository.saveAndFlush(new User(
                "Charlie Brown",
                "charlie.adm.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        secondRequesterDiana = userRepository.saveAndFlush(new User(
                "Diana Prince",
                "diana.adm.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.adm.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        generalCategory = categoryRepository.saveAndFlush(new Category(
                "Cat-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        if (ownerAlice != null && ownerAlice.getId() != null) {
            listingRepository.findByOwnerId(ownerAlice.getId()).forEach(listingRepository::delete);
        }
        if (secondOwnerCharlie != null && secondOwnerCharlie.getId() != null) {
            listingRepository.findByOwnerId(secondOwnerCharlie.getId()).forEach(listingRepository::delete);
        }
        if (generalCategory != null && generalCategory.getId() != null) {
            categoryRepository.deleteById(generalCategory.getId());
        }
        if (ownerAlice != null && ownerAlice.getId() != null) {
            userRepository.deleteById(ownerAlice.getId());
        }
        if (requesterBob != null && requesterBob.getId() != null) {
            userRepository.deleteById(requesterBob.getId());
        }
        if (secondOwnerCharlie != null && secondOwnerCharlie.getId() != null) {
            userRepository.deleteById(secondOwnerCharlie.getId());
        }
        if (secondRequesterDiana != null && secondRequesterDiana.getId() != null) {
            userRepository.deleteById(secondRequesterDiana.getId());
        }
        if (adminDave != null && adminDave.getId() != null) {
            userRepository.deleteById(adminDave.getId());
        }
    }

    private Transaction createTransaction(
            User owner,
            User requester,
            String title,
            TransactionStatus status
    ) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                owner,
                generalCategory,
                ListingType.GIVEAWAY,
                title,
                "Description for " + title,
                "Da Nang"
        ));
        listing.setStatus(status == TransactionStatus.COMPLETED ? ListingStatus.COMPLETED : ListingStatus.RESERVED);
        listing = listingRepository.saveAndFlush(listing);

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requester,
                "Request for " + title,
                ListingRequestStatus.ACCEPTED
        ));

        Transaction tx = new Transaction(request, listing, owner, requester, status);
        if (status == TransactionStatus.IN_PROGRESS) {
            tx.setOwnerCompleted(true);
            tx.setOwnerCompletedAt(Instant.now());
        } else if (status == TransactionStatus.COMPLETED) {
            tx.setOwnerCompleted(true);
            tx.setOwnerCompletedAt(Instant.now());
            tx.setRequesterCompleted(true);
            tx.setRequesterCompletedAt(Instant.now());
        } else if (status == TransactionStatus.CANCELLED) {
            tx.setCancelledBy(adminDave);
            tx.setCancelledAt(Instant.now());
            tx.setCancellationReason("Admin intervention reason");
        }
        tx = transactionRepository.saveAndFlush(tx);

        if (status == TransactionStatus.CANCELLED) {
            request.setStatus(ListingRequestStatus.CANCELLED);
            listingRequestRepository.saveAndFlush(request);
        }
        return tx;
    }

    @Test
    @DisplayName("1. ADMIN can retrieve a paginated list containing transactions involving different users across the platform")
    void adminCanListAllTransactionsAcrossPlatform() throws Exception {
        Transaction tx1 = createTransaction(ownerAlice, requesterBob, "Wooden Dining Table", TransactionStatus.PENDING);
        Transaction tx2 = createTransaction(secondOwnerCharlie, secondRequesterDiana, "Microwave Oven", TransactionStatus.COMPLETED);

        mockMvc.perform(get("/api/v1/admin/transactions")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].id", containsInAnyOrder(tx1.getId().toString(), tx2.getId().toString())))
                .andExpect(jsonPath("$.content[0].listingTitle").isNotEmpty())
                .andExpect(jsonPath("$.content[0].ownerDisplayName").isNotEmpty())
                .andExpect(jsonPath("$.content[0].requesterDisplayName").isNotEmpty());
    }

    @Test
    @DisplayName("2. Regular USER cannot access the admin listing endpoint (403 Forbidden)")
    void regularUserIsForbidden() throws Exception {
        createTransaction(ownerAlice, requesterBob, "Sample Item", TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/admin/transactions")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("3. Unauthenticated access is rejected according to existing security behavior (401 Unauthorized)")
    void unauthenticatedIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/transactions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("4. Filtering by each valid transaction status works")
    void filterByStatusWorks() throws Exception {
        Transaction txPending = createTransaction(ownerAlice, requesterBob, "Pending Item", TransactionStatus.PENDING);
        Transaction txInProgress = createTransaction(ownerAlice, requesterBob, "In Progress Item", TransactionStatus.IN_PROGRESS);
        Transaction txCompleted = createTransaction(secondOwnerCharlie, secondRequesterDiana, "Completed Item", TransactionStatus.COMPLETED);
        Transaction txCancelled = createTransaction(secondOwnerCharlie, secondRequesterDiana, "Cancelled Item", TransactionStatus.CANCELLED);

        // Filter PENDING
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("status", "PENDING")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(txPending.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("PENDING"));

        // Filter IN_PROGRESS
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("status", "IN_PROGRESS")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(txInProgress.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("IN_PROGRESS"));

        // Filter COMPLETED
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("status", "COMPLETED")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(txCompleted.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("COMPLETED"));

        // Filter CANCELLED
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("status", "CANCELLED")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(txCancelled.getId().toString()))
                .andExpect(jsonPath("$.content[0].status").value("CANCELLED"))
                .andExpect(jsonPath("$.content[0].cancelledByDisplayName").value("Dave Admin"))
                .andExpect(jsonPath("$.content[0].cancellationReason").value("Admin intervention reason"));
    }

    @Test
    @DisplayName("5. Search by valid transaction UUID works")
    void searchByValidUuid() throws Exception {
        Transaction tx1 = createTransaction(ownerAlice, requesterBob, "Item One", TransactionStatus.PENDING);
        createTransaction(secondOwnerCharlie, secondRequesterDiana, "Item Two", TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("search", tx1.getId().toString())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(tx1.getId().toString()));
    }

    @Test
    @DisplayName("6. Search by listing title works (case-insensitive substring)")
    void searchByListingTitle() throws Exception {
        Transaction txMatch = createTransaction(ownerAlice, requesterBob, "Vintage Mechanical Keyboard", TransactionStatus.PENDING);
        createTransaction(secondOwnerCharlie, secondRequesterDiana, "Ceramic Tea Set", TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("search", "mechanical")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(txMatch.getId().toString()))
                .andExpect(jsonPath("$.content[0].listingTitle").value("Vintage Mechanical Keyboard"));
    }

    @Test
    @DisplayName("7. Search by owner and requester display names works")
    void searchByOwnerAndRequesterDisplayName() throws Exception {
        Transaction tx1 = createTransaction(ownerAlice, requesterBob, "Book A", TransactionStatus.PENDING); // Owner: Alice Wonder, Requester: Bob Builder
        Transaction tx2 = createTransaction(secondOwnerCharlie, secondRequesterDiana, "Book B", TransactionStatus.PENDING); // Owner: Charlie Brown, Requester: Diana Prince

        // Search owner display name
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("search", "wonder")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(tx1.getId().toString()));

        // Search requester display name
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("search", "prince")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(tx2.getId().toString()));
    }

    @Test
    @DisplayName("8. Malformed UUID search terms do not cause server errors")
    void searchByMalformedUuidDoesNotThrow() throws Exception {
        createTransaction(ownerAlice, requesterBob, "Standard Coffee Maker", TransactionStatus.PENDING);

        // String that looks like a partial UUID or invalid format
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("search", "1234-invalid-uuid-format-5678")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    @DisplayName("9. Combining status and search produces correct results")
    void combiningStatusAndSearch() throws Exception {
        createTransaction(ownerAlice, requesterBob, "Coffee Table", TransactionStatus.PENDING);
        Transaction txCompletedCoffee = createTransaction(secondOwnerCharlie, secondRequesterDiana, "Coffee Grinder", TransactionStatus.COMPLETED);
        createTransaction(secondOwnerCharlie, secondRequesterDiana, "Tea Kettle", TransactionStatus.COMPLETED);

        // Filter status=COMPLETED and search="coffee"
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("status", "COMPLETED")
                        .param("search", "coffee")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(txCompletedCoffee.getId().toString()))
                .andExpect(jsonPath("$.content[0].listingTitle").value("Coffee Grinder"))
                .andExpect(jsonPath("$.content[0].status").value("COMPLETED"));
    }

    @Test
    @DisplayName("10. Blank search behaves like no search filter")
    void blankSearchBehavesLikeNoFilter() throws Exception {
        createTransaction(ownerAlice, requesterBob, "Item One", TransactionStatus.PENDING);
        createTransaction(secondOwnerCharlie, secondRequesterDiana, "Item Two", TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("search", "   ")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    @DisplayName("11. Pagination metadata, page boundaries, and size limits behave correctly")
    void paginationMetadataAndValidation() throws Exception {
        createTransaction(ownerAlice, requesterBob, "Alpha", TransactionStatus.PENDING);
        createTransaction(ownerAlice, requesterBob, "Beta", TransactionStatus.PENDING);
        createTransaction(ownerAlice, requesterBob, "Gamma", TransactionStatus.PENDING);

        // Valid page size 2
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("page", "0")
                        .param("size", "2")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(2));

        // Invalid page negative -> 400
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("page", "-1")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        // Invalid size > 100 -> 400
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("size", "101")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        // Invalid size 0 -> 400
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .param("size", "0")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("12. Empty result sets return a valid empty page")
    void emptyResultSetReturnsValidEmptyPage() throws Exception {
        mockMvc.perform(get("/api/v1/admin/transactions")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    @DisplayName("13. Deterministic ordering is maintained across repeated requests (createdAt DESC, id DESC)")
    void deterministicOrderingMaintained() throws Exception {
        Transaction tx1 = createTransaction(ownerAlice, requesterBob, "Older Tx", TransactionStatus.PENDING);
        Transaction tx2 = createTransaction(secondOwnerCharlie, secondRequesterDiana, "Newer Tx", TransactionStatus.PENDING);

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(get("/api/v1/admin/transactions")
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.content[0].id").value(tx2.getId().toString()))
                    .andExpect(jsonPath("$.content[1].id").value(tx1.getId().toString()));
        }
    }
}
