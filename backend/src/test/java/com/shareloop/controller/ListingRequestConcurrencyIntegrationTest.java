package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.request.UpdateListingRequestStatusRequest;
import com.shareloop.entity.Category;
import com.shareloop.entity.Listing;
import com.shareloop.entity.ListingRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.NotificationRepository;
import com.shareloop.repository.ReviewRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
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
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ListingRequestConcurrencyIntegrationTest {

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
    private User requesterCharlie;
    private String aliceToken;
    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterCharlie = userRepository.saveAndFlush(new User(
                "Charlie Requester",
                "charlie.conc." + UUID.randomUUID() + "@example.com",
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
        notificationRepository.deleteAll();
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
        if (requesterCharlie != null && requesterCharlie.getId() != null) {
            userRepository.deleteById(requesterCharlie.getId());
        }
    }

    @Test
    @DisplayName("Deterministic concurrency test: two concurrent acceptance requests for the same listing result in exactly one accepted and one rejected")
    void concurrentAcceptanceForSameListing() throws Exception {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Concurrent Test Bicycle",
                "Description for Bicycle",
                "Ha Noi"
        ));

        ListingRequest req1 = listingRequestRepository.saveAndFlush(
                new ListingRequest(listing, requesterBob, "Bob wants bicycle", ListingRequestStatus.PENDING)
        );
        ListingRequest req2 = listingRequestRepository.saveAndFlush(
                new ListingRequest(listing, requesterCharlie, "Charlie wants bicycle", ListingRequestStatus.PENDING)
        );

        UpdateListingRequestStatusRequest acceptDto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);
        String requestBody = objectMapper.writeValueAsString(acceptDto);

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", req1.getId())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(requestBody))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> future2 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/listing-requests/{requestId}/status", req2.getId())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(requestBody))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        // Ensure both threads are ready, then fire simultaneously
        boolean ready = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(ready).isTrue();
        startLatch.countDown();

        CompletableFuture.allOf(future1, future2).get(15, TimeUnit.SECONDS);

        int status1 = future1.get().getResponse().getStatus();
        int status2 = future2.get().getResponse().getStatus();

        // One must succeed with 200 OK
        boolean oneIsOk = (status1 == 200 && status2 != 200) || (status2 == 200 && status1 != 200);
        assertThat(oneIsOk).as("Exactly one acceptance must return 200 OK. Got status1=%d, status2=%d", status1, status2).isTrue();

        // The losing thread must receive a safe error: 400 (listing already reserved) or 409 (conflict), never 500
        int failedStatus = (status1 == 200) ? status2 : status1;
        assertThat(failedStatus).as("Losing acceptance request should be rejected with 400 or 409").isIn(400, 409);

        // Verify Database Integrity:
        // 1. Listing must be RESERVED
        Listing freshListing = listingRepository.findById(listing.getId()).orElseThrow();
        assertThat(freshListing.getStatus()).isEqualTo(ListingStatus.RESERVED);

        // 2. Exactly one transaction created for this listing
        List<Transaction> transactions = transactionRepository.findByListingId(listing.getId());
        assertThat(transactions).hasSize(1);
        Transaction tx = transactions.get(0);
        assertThat(tx.getStatus()).isEqualTo(TransactionStatus.PENDING);

        // 3. Exactly one request is ACCEPTED; the other remains PENDING
        ListingRequest freshReq1 = listingRequestRepository.findById(req1.getId()).orElseThrow();
        ListingRequest freshReq2 = listingRequestRepository.findById(req2.getId()).orElseThrow();

        if (freshReq1.getStatus() == ListingRequestStatus.ACCEPTED) {
            assertThat(freshReq2.getStatus()).isEqualTo(ListingRequestStatus.PENDING);
            assertThat(tx.getListingRequest().getId()).isEqualTo(req1.getId());
            assertThat(tx.getRequester().getId()).isEqualTo(requesterBob.getId());
        } else {
            assertThat(freshReq1.getStatus()).isEqualTo(ListingRequestStatus.PENDING);
            assertThat(freshReq2.getStatus()).isEqualTo(ListingRequestStatus.ACCEPTED);
            assertThat(tx.getListingRequest().getId()).isEqualTo(req2.getId());
            assertThat(tx.getRequester().getId()).isEqualTo(requesterCharlie.getId());
        }
    }
}
