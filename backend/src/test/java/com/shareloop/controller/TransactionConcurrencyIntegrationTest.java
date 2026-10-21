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
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
class TransactionConcurrencyIntegrationTest {

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

    private User ownerAlice;
    private User requesterBob;
    private String aliceToken;
    private String bobToken;
    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.tx.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.tx.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());

        generalCategory = categoryRepository.saveAndFlush(new Category(
                "Category-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
    }

    @AfterEach
    void tearDown() {
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Transaction createTestTransaction() {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Concurrent Coffee Maker",
                "Description",
                "Hanoi"
        ));
        listing.setStatus(ListingStatus.RESERVED);
        listing = listingRepository.saveAndFlush(listing);

        ListingRequest request = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                requesterBob,
                "Need coffee maker",
                ListingRequestStatus.ACCEPTED
        ));

        Transaction transaction = new Transaction(
                request,
                listing,
                ownerAlice,
                requesterBob,
                TransactionStatus.PENDING
        );
        return transactionRepository.saveAndFlush(transaction);
    }

    @Test
    @DisplayName("Deterministic concurrency: Simultaneous confirmation by owner and requester completes transaction and listing atomically")
    void concurrentCompletionByBothPartiesTransitionsToCompletedAtomically() throws Exception {
        Transaction tx = createTestTransaction();

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        CompletableFuture<MvcResult> futureOwner = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<MvcResult> futureRequester = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                                .header(HttpHeaders.AUTHORIZATION, bobToken))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        boolean ready = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(ready).isTrue();
        startLatch.countDown();

        CompletableFuture.allOf(futureOwner, futureRequester).get(15, TimeUnit.SECONDS);

        assertThat(futureOwner.get().getResponse().getStatus()).isEqualTo(200);
        assertThat(futureRequester.get().getResponse().getStatus()).isEqualTo(200);

        // Verify final DB state
        Transaction freshTx = transactionRepository.findById(tx.getId()).orElseThrow();
        assertThat(freshTx.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
        assertThat(freshTx.getOwnerCompleted()).isTrue();
        assertThat(freshTx.getRequesterCompleted()).isTrue();
        assertThat(freshTx.getOwnerCompletedAt()).isNotNull();
        assertThat(freshTx.getRequesterCompletedAt()).isNotNull();

        Listing freshListing = listingRepository.findById(tx.getListing().getId()).orElseThrow();
        assertThat(freshListing.getStatus()).isEqualTo(ListingStatus.COMPLETED);
    }

    @Test
    @DisplayName("Deterministic concurrency: Complete vs Cancel race resolves to a valid terminal state without deadlocks")
    void concurrentCompleteVsCancelRace() throws Exception {
        Transaction tx = createTestTransaction();

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        String cancelBody = objectMapper.writeValueAsString(new CancelTransactionRequest("Cannot proceed"));

        // Thread 1: Owner confirms complete
        CompletableFuture<MvcResult> futureComplete = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                                .header(HttpHeaders.AUTHORIZATION, aliceToken))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        // Thread 2: Requester cancels
        CompletableFuture<MvcResult> futureCancel = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                                .header(HttpHeaders.AUTHORIZATION, bobToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(cancelBody))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        boolean ready = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(ready).isTrue();
        startLatch.countDown();

        CompletableFuture.allOf(futureComplete, futureCancel).get(15, TimeUnit.SECONDS);

        int statusComplete = futureComplete.get().getResponse().getStatus();
        int statusCancel = futureCancel.get().getResponse().getStatus();

        // One of the operations must succeed with 200 OK
        assertThat(statusComplete == 200 || statusCancel == 200).isTrue();

        Transaction freshTx = transactionRepository.findById(tx.getId()).orElseThrow();
        Listing freshListing = listingRepository.findById(tx.getListing().getId()).orElseThrow();

        if (freshTx.getStatus() == TransactionStatus.CANCELLED) {
            assertThat(statusCancel).isEqualTo(200);
            assertThat(freshListing.getStatus()).isEqualTo(ListingStatus.ACTIVE);
            assertThat(freshTx.getCancelledBy()).isNotNull();
        } else {
            // Complete won (or completed partially to IN_PROGRESS)
            assertThat(statusComplete).isEqualTo(200);
            assertThat(freshTx.getStatus()).isIn(TransactionStatus.IN_PROGRESS, TransactionStatus.COMPLETED);
        }
    }
}
