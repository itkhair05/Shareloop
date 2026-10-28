package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
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
class AdminReviewControllerIntegrationTest {

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
    private User regularCharlie;
    private User adminDave;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;

    private Category testCategory;
    private Transaction completedTx;

    private final java.util.List<UUID> createdListingIds = new java.util.ArrayList<>();
    private final java.util.List<UUID> createdUserIds = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.adminrev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.adminrev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        regularCharlie = userRepository.saveAndFlush(new User(
                "Charlie User",
                "charlie.adminrev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminDave = userRepository.saveAndFlush(new User(
                "Dave Admin",
                "dave.adminrev." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        createdUserIds.add(ownerAlice.getId());
        createdUserIds.add(requesterBob.getId());
        createdUserIds.add(regularCharlie.getId());
        createdUserIds.add(adminDave.getId());

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(regularCharlie.getId(), regularCharlie.getEmail(), regularCharlie.getRole(), regularCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminDave.getId(), adminDave.getEmail(), adminDave.getRole(), adminDave.getStatus());

        testCategory = categoryRepository.saveAndFlush(new Category(
                "AdminReviewCategory-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));

        completedTx = createCompletedTransaction(ownerAlice, requesterBob);
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        reviewRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();

        for (UUID listingId : createdListingIds) {
            listingRepository.findById(listingId).ifPresent(listingRepository::delete);
        }
        createdListingIds.clear();

        if (testCategory != null && testCategory.getId() != null) {
            categoryRepository.deleteById(testCategory.getId());
        }

        for (UUID userId : createdUserIds) {
            userRepository.findById(userId).ifPresent(userRepository::delete);
        }
        createdUserIds.clear();
    }

    private Transaction createCompletedTransaction(User owner, User requester) {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                owner,
                testCategory,
                ListingType.GIVEAWAY,
                "Admin Review Test Item " + UUID.randomUUID().toString().substring(0, 8),
                "Description for admin review test",
                "Da Nang"
        ));
        listing.setStatus(ListingStatus.COMPLETED);
        listing = listingRepository.saveAndFlush(listing);
        createdListingIds.add(listing.getId());

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requester,
                "Request for admin review test",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction tx = new Transaction(
                request,
                listing,
                owner,
                requester,
                TransactionStatus.PENDING
        );
        tx.setStatus(TransactionStatus.COMPLETED);
        tx.setOwnerCompleted(true);
        tx.setRequesterCompleted(true);
        tx.setOwnerCompletedAt(Instant.now());
        tx.setRequesterCompletedAt(Instant.now());
        return transactionRepository.saveAndFlush(tx);
    }

    private Review createReview(Transaction tx, User reviewer, User reviewee, int rating, String comment, boolean isHidden) {
        Review review = new Review(tx, reviewer, reviewee, rating, comment);
        if (isHidden) {
            review.setIsHidden(true);
            review.setModeratedBy(adminDave);
            review.setModeratedAt(Instant.now());
            review.setModerationReason("Initial moderation test reason");
        }
        return reviewRepository.saveAndFlush(review);
    }

    // ==========================================
    // 1. ADMIN LISTING TESTS
    // ==========================================

    @Test
    @DisplayName("Admin listing requires ADMIN role; unauthenticated returns 401, non-admin returns 403")
    void getAdminReviews_Authorization() throws Exception {
        // Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/admin/reviews"))
                .andExpect(status().isUnauthorized());

        // Regular user -> 403
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        // Admin -> 200
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.pageable").exists());
    }

    @Test
    @DisplayName("Admin listing returns both visible and hidden reviews with correct pagination metadata")
    void getAdminReviews_PaginationAndVisibility() throws Exception {
        // Create 1 visible review and 1 hidden review
        Review rev1 = createReview(completedTx, ownerAlice, requesterBob, 5, "Alice to Bob visible review", false);

        Transaction tx2 = createCompletedTransaction(ownerAlice, requesterBob);
        Review rev2 = createReview(tx2, requesterBob, ownerAlice, 2, "Bob to Alice hidden review", true);

        // List all (no filter) -> totalElements = 2
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content", hasSize(2)));

        // Filter isHidden = false -> 1
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("isHidden", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(rev1.getId().toString()))
                .andExpect(jsonPath("$.content[0].isHidden").value(false));

        // Filter isHidden = true -> 1
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("isHidden", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(rev2.getId().toString()))
                .andExpect(jsonPath("$.content[0].isHidden").value(true))
                .andExpect(jsonPath("$.content[0].moderationReason").value("Initial moderation test reason"));
    }

    @Test
    @DisplayName("Admin listing filter by rating and search keyword")
    void getAdminReviews_FiltersAndSearch() throws Exception {
        createReview(completedTx, ownerAlice, requesterBob, 5, "Super friendly communication", false);

        Transaction tx2 = createCompletedTransaction(ownerAlice, requesterBob);
        createReview(tx2, requesterBob, ownerAlice, 1, "Unacceptable item condition broken", false);

        // Filter rating = 5
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("rating", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].rating").value(5))
                .andExpect(jsonPath("$.content[0].comment").value("Super friendly communication"));

        // Search by comment keyword
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("search", "broken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].rating").value(1));

        // Search by displayName ("Alice Owner" appears as reviewer in rev1 and reviewee in rev2)
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("search", "Alice Owner"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        // Search by reviewee email substring
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("search", "adminrev"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        // Search with no matches -> empty page
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("search", "nonexistentkeywordXYZ"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    @DisplayName("Admin listing handles invalid parameters with 400 Bad Request")
    void getAdminReviews_InvalidParameters() throws Exception {
        // Invalid page (< 0)
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("page", "-1"))
                .andExpect(status().isBadRequest());

        // Invalid size (> 100)
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("size", "101"))
                .andExpect(status().isBadRequest());

        // Invalid rating (< 1 or > 5)
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("rating", "6"))
                .andExpect(status().isBadRequest());

        // Invalid sortBy
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .param("sortBy", "malicious_column"))
                .andExpect(status().isBadRequest());
    }

    // ==========================================
    // 2. ADMIN DETAILS TESTS
    // ==========================================

    @Test
    @DisplayName("Admin review details endpoint returns all required fields and moderation metadata")
    void getAdminReviewDetails_Success() throws Exception {
        Review review = createReview(completedTx, ownerAlice, requesterBob, 4, "Detailed test review", true);

        mockMvc.perform(get("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(review.getId().toString()))
                .andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.comment").value("Detailed test review"))
                .andExpect(jsonPath("$.isHidden").value(true))
                .andExpect(jsonPath("$.reviewerId").value(ownerAlice.getId().toString()))
                .andExpect(jsonPath("$.reviewerDisplayName").value("Alice Owner"))
                .andExpect(jsonPath("$.reviewerEmail").value(ownerAlice.getEmail()))
                .andExpect(jsonPath("$.revieweeId").value(requesterBob.getId().toString()))
                .andExpect(jsonPath("$.revieweeDisplayName").value("Bob Requester"))
                .andExpect(jsonPath("$.revieweeEmail").value(requesterBob.getEmail()))
                .andExpect(jsonPath("$.transactionId").value(completedTx.getId().toString()))
                .andExpect(jsonPath("$.transactionStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.moderatedById").value(adminDave.getId().toString()))
                .andExpect(jsonPath("$.moderatedByDisplayName").value("Dave Admin"))
                .andExpect(jsonPath("$.moderatedAt").isNotEmpty())
                .andExpect(jsonPath("$.moderationReason").value("Initial moderation test reason"))
                // Ensure no password hashes or sensitive fields exposed
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    @DisplayName("Admin review details authorization and 404 handling")
    void getAdminReviewDetails_AuthAndNotFound() throws Exception {
        Review review = createReview(completedTx, ownerAlice, requesterBob, 5, "Sample review", false);

        // Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/admin/reviews/{id}", review.getId()))
                .andExpect(status().isUnauthorized());

        // Regular user -> 403
        mockMvc.perform(get("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        // Missing ID -> 404
        mockMvc.perform(get("/api/v1/admin/reviews/{id}", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isNotFound());
    }

    // ==========================================
    // 3. ADMIN HIDE TESTS
    // ==========================================

    @Test
    @DisplayName("Admin can hide review; repeated requests are idempotent")
    void moderateReview_HideSuccessAndIdempotency() throws Exception {
        Review review = createReview(completedTx, ownerAlice, requesterBob, 3, "Moderation target review", false);

        ModerateReviewRequest req = new ModerateReviewRequest("Inappropriate language used");

        // Hide review via DELETE -> 204
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNoContent());

        Review hiddenReview = reviewRepository.findById(review.getId()).orElseThrow();
        assertThat(hiddenReview.getIsHidden()).isTrue();
        assertThat(hiddenReview.getModeratedBy().getId()).isEqualTo(adminDave.getId());
        assertThat(hiddenReview.getModeratedAt()).isNotNull();
        assertThat(hiddenReview.getModerationReason()).isEqualTo("Inappropriate language used");

        Instant initialModeratedAt = hiddenReview.getModeratedAt();

        // Repeated hide request is idempotent (returns 204, does not overwrite audit fields)
        mockMvc.perform(delete("/api/v1/admin/reviews/{id}", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ModerateReviewRequest("Second reason"))))
                .andExpect(status().isNoContent());

        Review stillHidden = reviewRepository.findById(review.getId()).orElseThrow();
        assertThat(stillHidden.getIsHidden()).isTrue();
        assertThat(stillHidden.getModerationReason()).isEqualTo("Inappropriate language used");
        assertThat(stillHidden.getModeratedAt()).isEqualTo(initialModeratedAt);
    }

    // ==========================================
    // 4. ADMIN RESTORE TESTS
    // ==========================================

    @Test
    @DisplayName("Admin can restore hidden review; clears DB trigger fields and restores public visibility")
    void restoreReview_SuccessAndTriggerValidation() throws Exception {
        Review review = createReview(completedTx, ownerAlice, requesterBob, 5, "Review to be restored", true);

        // Verify initially hidden from public rating summary
        mockMvc.perform(get("/api/v1/users/{id}/rating-summary", requesterBob.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalReviews").value(0))
                .andExpect(jsonPath("$.averageRating").value(0.0));

        // Restore review via POST /api/v1/admin/reviews/{id}/restore
        mockMvc.perform(post("/api/v1/admin/reviews/{id}/restore", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(review.getId().toString()))
                .andExpect(jsonPath("$.isHidden").value(false))
                .andExpect(jsonPath("$.moderatedById").doesNotExist())
                .andExpect(jsonPath("$.moderatedByDisplayName").doesNotExist())
                .andExpect(jsonPath("$.moderatedAt").doesNotExist())
                .andExpect(jsonPath("$.moderationReason").doesNotExist());

        // Verify in DB that DB trigger validate_review_moderation accepted the change
        Review restored = reviewRepository.findById(review.getId()).orElseThrow();
        assertThat(restored.getIsHidden()).isFalse();
        assertThat(restored.getModeratedBy()).isNull();
        assertThat(restored.getModeratedAt()).isNull();
        assertThat(restored.getModerationReason()).isNull();

        // Verify review reappears in public rating summary
        mockMvc.perform(get("/api/v1/users/{id}/rating-summary", requesterBob.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalReviews").value(1))
                .andExpect(jsonPath("$.averageRating").value(5.0));

        // Verify review reappears in public paginated reviews
        mockMvc.perform(get("/api/v1/users/{id}/reviews", requesterBob.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(review.getId().toString()));

        // Repeated restore is idempotent and succeeds with 200
        mockMvc.perform(post("/api/v1/admin/reviews/{id}/restore", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isHidden").value(false));
    }

    @Test
    @DisplayName("Restore review authorization and 404 handling")
    void restoreReview_AuthAndNotFound() throws Exception {
        Review review = createReview(completedTx, ownerAlice, requesterBob, 5, "Restoration auth review", true);

        // Unauthenticated -> 401
        mockMvc.perform(post("/api/v1/admin/reviews/{id}/restore", review.getId()))
                .andExpect(status().isUnauthorized());

        // Regular user -> 403
        mockMvc.perform(post("/api/v1/admin/reviews/{id}/restore", review.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        // Missing ID -> 404
        mockMvc.perform(post("/api/v1/admin/reviews/{id}/restore", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isNotFound());
    }
}
