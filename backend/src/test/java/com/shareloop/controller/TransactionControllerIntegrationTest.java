package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.transaction.CancelTransactionRequest;
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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TransactionControllerIntegrationTest {

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
    private ReviewRepository reviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User ownerAlice;
    private User requesterBob;
    private User outsiderCharlie;
    private User adminDave;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;

    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        outsiderCharlie = userRepository.saveAndFlush(new User(
                "Charlie Outsider",
                "charlie.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.tx." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(outsiderCharlie.getId(), outsiderCharlie.getEmail(), outsiderCharlie.getRole(), outsiderCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        generalCategory = categoryRepository.saveAndFlush(new Category(
                "Category-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
    }

    @AfterEach
    void tearDown() {
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        if (ownerAlice != null && ownerAlice.getId() != null) {
            listingRepository.findByOwnerId(ownerAlice.getId()).forEach(listingRepository::delete);
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
        if (outsiderCharlie != null && outsiderCharlie.getId() != null) {
            userRepository.deleteById(outsiderCharlie.getId());
        }
        if (adminDave != null && adminDave.getId() != null) {
            userRepository.deleteById(adminDave.getId());
        }
    }

    private Transaction createTestTransaction(ListingStatus listingStatus, TransactionStatus txStatus) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Exchange Desk",
                "Solid oak desk",
                "Hanoi"
        ));
        listing.setStatus(listingStatus);
        listing = listingRepository.saveAndFlush(listing);

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requesterBob,
                "I would love this desk",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                ownerAlice,
                requesterBob,
                txStatus
        );
        return transactionRepository.saveAndFlush(transaction);
    }

    @Test
    @DisplayName("Two-party completion: Owner confirms first (IN_PROGRESS), then requester confirms (COMPLETED)")
    void ownerConfirmsFirstThenRequesterConfirms() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // 1. Owner confirms completion
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.ownerCompleted").value(true))
                .andExpect(jsonPath("$.ownerCompletedAt").isNotEmpty())
                .andExpect(jsonPath("$.requesterCompleted").value(false))
                .andExpect(jsonPath("$.requesterCompletedAt").doesNotExist())
                .andExpect(jsonPath("$.myRole").value("OWNER"))
                .andExpect(jsonPath("$.myCompleted").value(true));

        // Verify DB state: listing remains RESERVED
        Listing listingAfterFirst = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(listingAfterFirst.getStatus()).isEqualTo(ListingStatus.RESERVED);

        // 2. Requester confirms completion
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.ownerCompleted").value(true))
                .andExpect(jsonPath("$.requesterCompleted").value(true))
                .andExpect(jsonPath("$.requesterCompletedAt").isNotEmpty())
                .andExpect(jsonPath("$.myRole").value("REQUESTER"))
                .andExpect(jsonPath("$.myCompleted").value(true));

        // Verify DB state: listing transitions to COMPLETED, request remains ACCEPTED
        Listing listingAfterSecond = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(listingAfterSecond.getStatus()).isEqualTo(ListingStatus.COMPLETED);

        ListingRequest request = listingRequestRepository.findById(tx.getListingRequest().getId()).orElseThrow();
        assertThat(request.getStatus()).isEqualTo(ListingRequestStatus.ACCEPTED);
    }

    @Test
    @DisplayName("Two-party completion: Requester confirms first (IN_PROGRESS), then owner confirms (COMPLETED)")
    void requesterConfirmsFirstThenOwnerConfirms() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // 1. Requester confirms
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.ownerCompleted").value(false))
                .andExpect(jsonPath("$.requesterCompleted").value(true))
                .andExpect(jsonPath("$.myRole").value("REQUESTER"));

        // 2. Owner confirms
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.ownerCompleted").value(true))
                .andExpect(jsonPath("$.requesterCompleted").value(true))
                .andExpect(jsonPath("$.myRole").value("OWNER"));

        Listing listing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(listing.getStatus()).isEqualTo(ListingStatus.COMPLETED);
    }

    @Test
    @DisplayName("Idempotency: Repeated confirmation by the same participant returns 200 OK without altering timestamps")
    void repeatedConfirmationIsIdempotent() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // First confirmation by owner
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.ownerCompleted").value(true));

        Transaction afterFirst = transactionRepository.findById(tx.getId()).orElseThrow();
        var originalTimestamp = afterFirst.getOwnerCompletedAt();
        assertThat(originalTimestamp).isNotNull();

        // Second confirmation by owner
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.ownerCompleted").value(true));

        Transaction afterSecond = transactionRepository.findById(tx.getId()).orElseThrow();
        assertThat(afterSecond.getOwnerCompletedAt()).isEqualTo(originalTimestamp);
    }

    @Test
    @DisplayName("Cancellation from PENDING by requester releases reservation and sets request to CANCELLED")
    void requesterCancelsPendingTransaction() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        CancelTransactionRequest cancelDto = new CancelTransactionRequest("Cannot pick up item anymore");

        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cancelDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledBy.id").value(requesterBob.getId().toString()))
                .andExpect(jsonPath("$.cancelledAt").isNotEmpty())
                .andExpect(jsonPath("$.cancellationReason").value("Cannot pick up item anymore"));

        // Verify DB updates
        Listing listing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(listing.getStatus()).isEqualTo(ListingStatus.ACTIVE);

        ListingRequest request = listingRequestRepository.findById(tx.getListingRequest().getId()).orElseThrow();
        assertThat(request.getStatus()).isEqualTo(ListingRequestStatus.CANCELLED);
    }

    @Test
    @DisplayName("Cancellation from IN_PROGRESS by owner releases reservation to ACTIVE")
    void ownerCancelsInProgressTransaction() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // Requester confirms first
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        // Owner cancels
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledBy.id").value(ownerAlice.getId().toString()));

        Listing listing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(listing.getStatus()).isEqualTo(ListingStatus.ACTIVE);

        ListingRequest request = listingRequestRepository.findById(tx.getListingRequest().getId()).orElseThrow();
        assertThat(request.getStatus()).isEqualTo(ListingRequestStatus.CANCELLED);
    }

    @Test
    @DisplayName("Admin cancellation requires mandatory non-empty cancellation reason")
    void adminCancellationRequiresReason() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // 1. Admin attempts cancellation without reason -> rejected with 400
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CancelTransactionRequest("   "))))
                .andExpect(status().isBadRequest());

        // 2. Admin cancels with valid reason -> succeeds
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CancelTransactionRequest("Prohibited item reported"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledBy.id").value(adminDave.getId().toString()))
                .andExpect(jsonPath("$.cancellationReason").value("Prohibited item reported"));
    }

    @Test
    @DisplayName("Preserve REMOVED listing status when transaction is cancelled")
    void cancelledTransactionPreservesRemovedListingStatus() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // Listing was marked REMOVED by admin moderation
        Listing listing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        listing.setStatus(ListingStatus.REMOVED);
        listingRepository.saveAndFlush(listing);

        // Cancel transaction
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        // Listing must remain REMOVED, NOT reverted to ACTIVE
        Listing freshListing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(freshListing.getStatus()).isEqualTo(ListingStatus.REMOVED);
    }

    @Test
    @DisplayName("Terminal states cannot be mutated: completed or cancelled transactions reject complete/cancel")
    void terminalStatesRejectMutations() throws Exception {
        Transaction completedTx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // Complete the transaction
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", completedTx.getId())
                .header(HttpHeaders.AUTHORIZATION, aliceToken));
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", completedTx.getId())
                .header(HttpHeaders.AUTHORIZATION, bobToken));

        // Attempt to cancel COMPLETED transaction -> 400
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", completedTx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest());

        // Create cancelled transaction
        Transaction cancelledTx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", cancelledTx.getId())
                .header(HttpHeaders.AUTHORIZATION, aliceToken));

        // Attempt to complete CANCELLED transaction -> 400
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", cancelledTx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest());

        // Attempt to cancel an already CANCELLED transaction -> 400
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", cancelledTx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Admin cannot force-complete a transaction (403 Forbidden)")
    void adminCannotForceCompleteTransaction() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Non-participant cannot view, complete, or cancel a transaction (403 Forbidden)")
    void nonParticipantIsDeniedAccess() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // Non-participant tries GET
        mockMvc.perform(get("/api/v1/transactions/{id}", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        // Non-participant tries COMPLETE
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        // Non-participant tries CANCEL
        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated requests return 401 Unauthorized")
    void unauthenticatedRequestsAreRejected() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/transactions"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/transactions/{id}", tx.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Admin can view transaction details (200 OK)")
    void adminCanViewTransactionDetails() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        mockMvc.perform(get("/api/v1/transactions/{id}", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()))
                .andExpect(jsonPath("$.myRole").value("ADMIN"));
    }

    @Test
    @DisplayName("GET /api/v1/transactions returns only the user's transactions with status/role filters")
    void getUserTransactionsFiltersAndPaginates() throws Exception {
        Transaction tx1 = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);

        // Create second transaction between Alice and Charlie
        Listing listing2 = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Second Item",
                "Description",
                "Hanoi"
        ));
        ListingRequest req2 = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing2,
                outsiderCharlie,
                "Request 2",
                ListingRequestStatus.ACCEPTED
        ));
        Transaction tx2 = transactionRepository.saveAndFlush(new Transaction(
                req2,
                listing2,
                ownerAlice,
                outsiderCharlie,
                TransactionStatus.PENDING
        ));

        // Alice views transactions (should see both tx1 and tx2)
        mockMvc.perform(get("/api/v1/transactions")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));

        // Bob views transactions (should only see tx1 where he is requester)
        mockMvc.perform(get("/api/v1/transactions")
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(tx1.getId().toString()));

        // Filter by role=requester for Bob
        mockMvc.perform(get("/api/v1/transactions")
                        .param("role", "requester")
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));

        // Filter by role=owner for Bob (should be empty)
        mockMvc.perform(get("/api/v1/transactions")
                        .param("role", "owner")
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/v1/listings/{listingId}/transaction returns transaction for listing participants")
    void getListingTransaction() throws Exception {
        Transaction tx = createTestTransaction(ListingStatus.RESERVED, TransactionStatus.PENDING);
        UUID listingId = tx.getListing().getId();

        // Owner can access
        mockMvc.perform(get("/api/v1/listings/{listingId}/transaction", listingId)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()));

        // Requester can access
        mockMvc.perform(get("/api/v1/listings/{listingId}/transaction", listingId)
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tx.getId().toString()));

        // Outsider receives 403
        mockMvc.perform(get("/api/v1/listings/{listingId}/transaction", listingId)
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());
    }
}
