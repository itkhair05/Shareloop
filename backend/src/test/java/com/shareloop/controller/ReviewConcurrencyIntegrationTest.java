package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.review.CreateReviewRequest;
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
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
class ReviewConcurrencyIntegrationTest {

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
    private String aliceToken;
    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Concurrency",
                "alice.rev.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Concurrency",
                "bob.rev.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());

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
    }

    private Transaction createCompletedTransaction() {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Concurrent Item",
                "Item for concurrent review testing",
                "Hanoi"
        ));
        listing.setStatus(ListingStatus.COMPLETED);
        listing = listingRepository.saveAndFlush(listing);

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requesterBob,
                "Request for item",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                ownerAlice,
                requesterBob,
                TransactionStatus.PENDING
        );
        transaction.setOwnerCompleted(true);
        transaction.setOwnerCompletedAt(Instant.now());
        transaction.setRequesterCompleted(true);
        transaction.setRequesterCompletedAt(Instant.now());
        transaction.setStatus(TransactionStatus.COMPLETED);
        return transactionRepository.saveAndFlush(transaction);
    }

    @Test
    @DisplayName("Deterministic concurrency: Simultaneous review submission by the same reviewer permits exactly one success and rejects the other with 409")
    void concurrentReviewSubmissionBySameReviewerPermitsOnlyOneSuccess() throws Exception {
        Transaction tx = createCompletedTransaction();

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        CreateReviewRequest request1 = new CreateReviewRequest(5, "Thread 1 review submission");
        CreateReviewRequest request2 = new CreateReviewRequest(4, "Thread 2 review submission");

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request1)))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> future2 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/transactions/{id}/reviews", tx.getId())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request2)))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        boolean readyInTime = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(readyInTime).as("Both threads should be ready within 5 seconds").isTrue();

        // Release both threads simultaneously
        startLatch.countDown();

        MvcResult result1 = future1.get(10, TimeUnit.SECONDS);
        MvcResult result2 = future2.get(10, TimeUnit.SECONDS);

        int status1 = result1.getResponse().getStatus();
        int status2 = result2.getResponse().getStatus();

        // Exactly one submission must succeed with 201 Created and the other must fail with 409 Conflict
        assertThat(List.of(status1, status2))
                .as("One thread must return 201 Created and the other 409 Conflict")
                .containsExactlyInAnyOrder(201, 409);

        // Database must contain exactly one review for this transaction
        List<Review> reviewsInDb = reviewRepository.findByTransactionId(tx.getId());
        assertThat(reviewsInDb).hasSize(1);
        assertThat(reviewsInDb.get(0).getReviewer().getId()).isEqualTo(ownerAlice.getId());
        assertThat(reviewsInDb.get(0).getReviewee().getId()).isEqualTo(requesterBob.getId());
    }
}
