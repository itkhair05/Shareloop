package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.review.CreateReviewRequest;
import com.shareloop.dto.review.ModerateReviewRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReviewControllerIntegrationTest {

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
    private NotificationRepository notificationRepository;

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

    private final java.util.List<UUID> createdListingIds = new java.util.ArrayList<>();
    private final java.util.List<UUID> createdUserIds = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.rev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.rev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        outsiderCharlie = userRepository.saveAndFlush(new User(
                "Charlie Outsider",
                "charlie.rev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.rev." + UUID.randomUUID() + "@example.com",
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
        notificationRepository.deleteAll();
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        for (UUID listingId : createdListingIds) {
            listingRepository.deleteById(listingId);
        }
        createdListingIds.clear();
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
        for (UUID userId : createdUserIds) {
            userRepository.deleteById(userId);
        }
        createdUserIds.clear();
    }

    private Transaction createCompletedTransaction(User owner, User requester) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                owner,
                generalCategory,
                ListingType.GIVEAWAY,
                "Handmade Wooden Chair",
                "Very sturdy chair",
                "Da Nang"
        ));
        listing.setStatus(ListingStatus.COMPLETED);
        listing = listingRepository.saveAndFlush(listing);
        createdListingIds.add(listing.getId());

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requester,
                "Request for chair",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                owner,
                requester,
                TransactionStatus.PENDING
        );
        transaction.setOwnerCompleted(true);
        transaction.setOwnerCompletedAt(Instant.now());
        transaction.setRequesterCompleted(true);
        transaction.setRequesterCompletedAt(Instant.now());
        transaction.setStatus(TransactionStatus.COMPLETED);
        return transactionRepository.saveAndFlush(transaction);
    }

    private Transaction createPendingTransaction(User owner, User requester) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                owner,
                generalCategory,
                ListingType.GIVEAWAY,
                "Pending Lamp",
                "Desk lamp",
                "Da Nang"
        ));
        listing.setStatus(ListingStatus.RESERVED);
        listing = listingRepository.saveAndFlush(listing);
        createdListingIds.add(listing.getId());

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requester,
                "Request for lamp",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                owner,
                requester,
                TransactionStatus.PENDING
        );
        return transactionRepository.saveAndFlush(transaction);
    }

    private Transaction createCancelledTransaction(User owner, User requester) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                owner,
                generalCategory,
                ListingType.GIVEAWAY,
                "Cancelled Book",
                "Novel",
                "Da Nang"
        ));
        listing.setStatus(ListingStatus.RESERVED);
        listing = listingRepository.saveAndFlush(listing);
        createdListingIds.add(listing.getId());

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requester,
                "Request for book",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                owner,
                requester,
                TransactionStatus.PENDING
        );
        transaction = transactionRepository.saveAndFlush(transaction);

        transaction.setStatus(TransactionStatus.CANCELLED);
        transaction.setCancelledBy(owner);
        transaction.setCancelledAt(Instant.now());
        transaction.setCancellationReason("Cancelled by participant");
        return transactionRepository.saveAndFlush(transaction);
    }

    @Test
    @DisplayName("Successful review creation in both participant directions")
    void bothParticipantsCanReviewCompletedTransaction() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);

        CreateReviewRequest reqAlice = new CreateReviewRequest(5, "Great exchange with Bob!");
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqAlice)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.transactionId").value(tx.getId().toString()))
                .andExpect(jsonPath("$.rating").value(5))
                .andExpect(jsonPath("$.comment").value("Great exchange with Bob!"))
                .andExpect(jsonPath("$.reviewer.id").value(ownerAlice.getId().toString()))
                .andExpect(jsonPath("$.reviewer.displayName").value(ownerAlice.getDisplayName()))
                .andExpect(jsonPath("$.reviewee.id").value(requesterBob.getId().toString()))
                .andExpect(jsonPath("$.reviewee.displayName").value(requesterBob.getDisplayName()))
                .andExpect(jsonPath("$.listing.id").value(tx.getListing().getId().toString()))
                .andExpect(jsonPath("$.listing.title").value("Handmade Wooden Chair"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        CreateReviewRequest reqBob = new CreateReviewRequest(4, null);
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqBob)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.transactionId").value(tx.getId().toString()))
                .andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.comment").isEmpty())
                .andExpect(jsonPath("$.reviewer.id").value(requesterBob.getId().toString()))
                .andExpect(jsonPath("$.reviewee.id").value(ownerAlice.getId().toString()));
    }

    @Test
    @DisplayName("Ratings 1 and 5 accepted; ratings 0 and 6 rejected")
    void ratingRangeValidation() throws Exception {
        Transaction tx1 = createCompletedTransaction(ownerAlice, requesterBob);

        // Rating 0 rejected
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx1.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(0, "Invalid 0"))))
                .andExpect(status().isBadRequest());

        // Rating 6 rejected
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx1.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(6, "Invalid 6"))))
                .andExpect(status().isBadRequest());

        // Rating 1 accepted
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx1.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(1, "Poor"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rating").value(1));

        // Rating 5 accepted by Bob
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx1.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Perfect"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rating").value(5));
    }

    @Test
    @DisplayName("Null comment accepted; blank whitespace and overlong comments rejected")
    void commentValidation() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);

        // Blank whitespace comment rejected
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "     "))))
                .andExpect(status().isBadRequest());

        // Overlong comment (>1000 chars) rejected
        String overlong = "a".repeat(1001);
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, overlong))))
                .andExpect(status().isBadRequest());

        // Null comment accepted
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment").isEmpty());
    }

    @Test
    @DisplayName("Non-completed transactions (PENDING, CANCELLED) cannot be reviewed")
    void nonCompletedTransactionsCannotBeReviewed() throws Exception {
        Transaction pendingTx = createPendingTransaction(ownerAlice, requesterBob);
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", pendingTx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Great"))))
                .andExpect(status().isBadRequest());

        Transaction cancelledTx = createCancelledTransaction(ownerAlice, requesterBob);
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", cancelledTx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Great"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Unauthenticated review creation rejected with 401")
    void unauthenticatedReviewCreationRejected() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Unauthenticated"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Non-participant rejected with 403; Admin non-participant rejected with 403")
    void nonParticipantCannotReview() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);

        // Charlie is an unrelated USER
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Outsider attempt"))))
                .andExpect(status().isForbidden());

        // Dave is an ADMIN, but not a participant in this transaction
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Admin proxy attempt"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Missing transaction returns 404")
    void missingTransactionReturns404() throws Exception {
        UUID randomId = UUID.randomUUID();
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", randomId)
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Missing tx"))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Duplicate review by the same participant returns 409 Conflict")
    void duplicateReviewReturns409() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "First review"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(4, "Second review attempt"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("already submitted a review")));
    }

    @Test
    @DisplayName("Transaction review retrieval permits participants and ADMIN, but rejects unrelated users")
    void transactionReviewsRetrievalPermissions() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);

        // Alice posts a review
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Alice to Bob"))))
                .andExpect(status().isCreated());

        // Alice (participant) can retrieve reviews
        mockMvc.perform(get("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].comment").value("Alice to Bob"));

        // Bob (participant) can retrieve reviews
        mockMvc.perform(get("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        // Charlie (outsider) is rejected with 403
        mockMvc.perform(get("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        // Dave (admin) can retrieve reviews
        mockMvc.perform(get("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        // Unauthenticated access rejected with 401
        mockMvc.perform(get("/api/v1/transactions/{id}/reviews", tx.getId()))
                .andExpect(status().isUnauthorized());

        // Nonexistent transaction returns 404
        mockMvc.perform(get("/api/v1/transactions/{id}/reviews", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Public user reviews feed filters out hidden reviews and adheres to pagination")
    void publicUserReviewsFeedFilteringAndPagination() throws Exception {
        Transaction tx1 = createCompletedTransaction(ownerAlice, requesterBob);
        Transaction tx2 = createCompletedTransaction(outsiderCharlie, requesterBob);

        // Review 1 for Bob
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx1.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Review 1"))))
                .andExpect(status().isCreated());

        // Review 2 for Bob
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx2.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(4, "Review 2 to be hidden"))))
                .andExpect(status().isCreated());

        // Verify Bob has 2 visible reviews initially
        mockMvc.perform(get("/api/v1/users/{userId}/reviews", requesterBob.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(2));

        // Find review 2 and moderate (hide) it
        Review review2 = reviewRepository.findAll().stream()
                .filter(r -> "Review 2 to be hidden".equals(r.getComment()))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review2.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("Inappropriate comment"))))
                .andExpect(status().isNoContent());

        // Now Bob's public feed must only contain Review 1
        mockMvc.perform(get("/api/v1/users/{userId}/reviews", requesterBob.getId())
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].comment").value("Review 1"))
                .andExpect(jsonPath("$.totalElements").value(1));

        // Pagination validation: page < 0 or size <= 0 or size > 50 rejected
        mockMvc.perform(get("/api/v1/users/{userId}/reviews", requesterBob.getId())
                        .param("page", "-1"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/users/{userId}/reviews", requesterBob.getId())
                        .param("size", "0"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/users/{userId}/reviews", requesterBob.getId())
                        .param("size", "51"))
                .andExpect(status().isBadRequest());

        // Nonexistent user returns 404
        mockMvc.perform(get("/api/v1/users/{userId}/reviews", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Public user rating summary returns complete star breakdown, rounded average, and handles zero reviews")
    void publicUserRatingSummaryCalculations() throws Exception {
        // Initially Charlie has zero reviews
        mockMvc.perform(get("/api/v1/users/{userId}/rating-summary", outsiderCharlie.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(outsiderCharlie.getId().toString()))
                .andExpect(jsonPath("$.averageRating").value(0.0))
                .andExpect(jsonPath("$.totalReviews").value(0))
                .andExpect(jsonPath("$.starBreakdown.1").value(0))
                .andExpect(jsonPath("$.starBreakdown.2").value(0))
                .andExpect(jsonPath("$.starBreakdown.3").value(0))
                .andExpect(jsonPath("$.starBreakdown.4").value(0))
                .andExpect(jsonPath("$.starBreakdown.5").value(0));

        // Give Charlie 3 visible reviews (5, 4, 5) and 1 hidden review (1)
        Transaction tx1 = createCompletedTransaction(ownerAlice, outsiderCharlie);
        Transaction tx2 = createCompletedTransaction(requesterBob, outsiderCharlie);

        User user3 = userRepository.saveAndFlush(new User("User 3", "u3." + UUID.randomUUID() + "@example.com", "hash", UserRole.USER, UserStatus.ACTIVE));
        createdUserIds.add(user3.getId());
        Transaction tx3 = createCompletedTransaction(user3, outsiderCharlie);

        User user4 = userRepository.saveAndFlush(new User("User 4", "u4." + UUID.randomUUID() + "@example.com", "hash", UserRole.USER, UserStatus.ACTIVE));
        createdUserIds.add(user4.getId());
        Transaction tx4 = createCompletedTransaction(user4, outsiderCharlie);

        // Submit reviews: 5, 4, 5, 1
        String u3Token = "Bearer " + jwtService.generateToken(user3.getId(), user3.getEmail(), user3.getRole(), user3.getStatus());
        String u4Token = "Bearer " + jwtService.generateToken(user4.getId(), user4.getEmail(), user4.getRole(), user4.getStatus());

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx1.getId())
                .header(HttpHeaders.AUTHORIZATION, aliceToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Star 5"))));

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx2.getId())
                .header(HttpHeaders.AUTHORIZATION, bobToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateReviewRequest(4, "Star 4"))));

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx3.getId())
                .header(HttpHeaders.AUTHORIZATION, u3Token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Star 5 second"))));

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx4.getId())
                .header(HttpHeaders.AUTHORIZATION, u4Token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateReviewRequest(1, "Star 1 to hide"))));

        // Hide review 4
        Review rev4 = reviewRepository.findAll().stream()
                .filter(r -> "Star 1 to hide".equals(r.getComment()))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", rev4.getId())
                .header(HttpHeaders.AUTHORIZATION, adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ModerateReviewRequest("Spam troll review"))))
                .andExpect(status().isNoContent());

        // Check summary: total = 3, avg = (5 + 4 + 5) / 3 = 14 / 3 = 4.67
        mockMvc.perform(get("/api/v1/users/{userId}/rating-summary", outsiderCharlie.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(outsiderCharlie.getId().toString()))
                .andExpect(jsonPath("$.averageRating").value(4.67))
                .andExpect(jsonPath("$.totalReviews").value(3))
                .andExpect(jsonPath("$.starBreakdown.5").value(2))
                .andExpect(jsonPath("$.starBreakdown.4").value(1))
                .andExpect(jsonPath("$.starBreakdown.3").value(0))
                .andExpect(jsonPath("$.starBreakdown.2").value(0))
                .andExpect(jsonPath("$.starBreakdown.1").value(0));

        // Nonexistent user returns 404
        mockMvc.perform(get("/api/v1/users/{userId}/rating-summary", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Admin moderation validation and permissions")
    void adminModerationValidation() throws Exception {
        Transaction tx = createCompletedTransaction(ownerAlice, requesterBob);

        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(1, "Offensive content"))))
                .andExpect(status().isCreated());

        Review review = reviewRepository.findAll().get(0);

        // Non-admin (Bob) cannot moderate -> 403
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("Valid reason"))))
                .andExpect(status().isForbidden());

        // Admin with blank reason -> 400
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("   "))))
                .andExpect(status().isBadRequest());

        // Admin with overlong reason (>500 chars) -> 400
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("a".repeat(501)))))
                .andExpect(status().isBadRequest());

        // Admin with valid reason -> 204 No Content
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("Violates community standards"))))
                .andExpect(status().isNoContent());

        // Check review is hidden in DB
        Review moderated = reviewRepository.findById(review.getId()).orElseThrow();
        assertThat(moderated.getIsHidden()).isTrue();
        assertThat(moderated.getModeratedBy().getId()).isEqualTo(adminDave.getId());
        assertThat(moderated.getModeratedAt()).isNotNull();
        assertThat(moderated.getModerationReason()).isEqualTo("Violates community standards");

        // Repeated moderation is idempotent and returns 204
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("Repeated reason"))))
                .andExpect(status().isNoContent());

        // Hidden review cannot be resubmitted by the same reviewer -> 409 Conflict
        mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateReviewRequest(5, "Replacement review attempt"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("already submitted a review")));
    }
}
