package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.chat.CreateConversationRequest;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.entity.Category;
import com.shareloop.entity.ChatMessage;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.Listing;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ChatMessageRepository;
import com.shareloop.repository.ConversationRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.security.ratelimit.RateLimitProperties;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatRateLimitIntegrationTest {

    private static final String RATE_LIMIT_MESSAGE = "Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ trong giây lát.";

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
    private ConversationRepository conversationRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitProperties rateLimitProperties;

    private User ownerAlice;
    private User requesterBob;
    private User otherCharlie;
    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private Category category;
    private Listing activeListing;
    private Conversation convAliceBob;
    private Conversation convAliceCharlie;
    private final List<Listing> createdListings = new ArrayList<>();

    @BeforeEach
    void setUp() {
        rateLimitProperties.setChatMessageLimit(20);
        rateLimitProperties.setChatWindowSeconds(60);

        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.chatrl." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.chatrl." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        otherCharlie = userRepository.saveAndFlush(new User(
                "Charlie Other",
                "charlie.chatrl." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(otherCharlie.getId(), otherCharlie.getEmail(), otherCharlie.getRole(), otherCharlie.getStatus());

        category = categoryRepository.saveAndFlush(new Category(
                "Chat Category-" + UUID.randomUUID().toString().substring(0, 8),
                "cat-chat-" + UUID.randomUUID().toString().substring(0, 8),
                "Category for chat rate limit tests",
                true
        ));

        activeListing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                category,
                ListingType.GIVEAWAY,
                "Chat Test Listing",
                "Description for listing",
                "Ha Noi"
        ));

        convAliceBob = conversationRepository.saveAndFlush(new Conversation(activeListing, ownerAlice, requesterBob, null));
        convAliceCharlie = conversationRepository.saveAndFlush(new Conversation(activeListing, ownerAlice, otherCharlie, null));
    }

    @AfterEach
    void tearDown() {
        // Only remove records owned by this test. The shared test database keeps
        // Flyway-seeded categories and other tests' fixtures intact, so the suite
        // stays hermetic regardless of execution order.
        for (Listing listing : createdListings) {
            chatMessageRepository.deleteByConversationIds(
                    conversationRepository.findAllByListingId(listing.getId())
                            .stream().map(Conversation::getId).toList());
            conversationRepository.deleteAll(conversationRepository.findAllByListingId(listing.getId()));
            if (listingRepository.existsById(listing.getId())) {
                listingRepository.delete(listing);
            }
        }
        createdListings.clear();

        List<UUID> conversationIds = new ArrayList<>();
        if (convAliceBob != null) {
            conversationIds.add(convAliceBob.getId());
        }
        if (convAliceCharlie != null) {
            conversationIds.add(convAliceCharlie.getId());
        }
        if (!conversationIds.isEmpty()) {
            chatMessageRepository.deleteByConversationIds(conversationIds);
        }
        if (convAliceBob != null) {
            conversationRepository.delete(convAliceBob);
        }
        if (convAliceCharlie != null) {
            conversationRepository.delete(convAliceCharlie);
        }
        conversationRepository.flush();

        if (activeListing != null && listingRepository.existsById(activeListing.getId())) {
            listingRepository.delete(activeListing);
        }
        listingRepository.flush();

        if (category != null) {
            categoryRepository.delete(category);
        }
        categoryRepository.flush();

        if (ownerAlice != null) {
            userRepository.deleteById(ownerAlice.getId());
        }
        if (requesterBob != null) {
            userRepository.deleteById(requesterBob.getId());
        }
        if (otherCharlie != null) {
            userRepository.deleteById(otherCharlie.getId());
        }
        userRepository.flush();

        rateLimitProperties.setChatMessageLimit(20);
        rateLimitProperties.setChatWindowSeconds(60);
    }

    private SendMessageRequest buildMessage(String content) {
        return new SendMessageRequest(content);
    }

    @Test
    @DisplayName("TC 1: The first chat message attempt is permitted")
    void firstMessageAttemptPermitted() throws Exception {
        SendMessageRequest request = buildMessage("Hello Alice!");

        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Hello Alice!"));

        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 2: Exactly 20 messages within the rolling 60-second window are permitted")
    void twentyMessagesWithinWindowPermitted() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 19; i++) {
            chatMessageRepository.save(new ChatMessage(convAliceBob, requesterBob, "Pre-existing msg " + i));
        }
        chatMessageRepository.flush();

        // 20th message
        SendMessageRequest request = buildMessage("Message 20");
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Message 20"));

        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), now.minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(20);
    }

    @Test
    @DisplayName("TC 3: The 21st attempt within the window receives HTTP 429 with exact Vietnamese message")
    void twentyFirstAttemptReceives429WithVietnameseMessage() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 20; i++) {
            chatMessageRepository.save(new ChatMessage(convAliceBob, requesterBob, "Pre-existing msg " + i));
        }
        chatMessageRepository.flush();

        // 21st message
        SendMessageRequest request = buildMessage("Message 21 - should be blocked");
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE))
                .andExpect(jsonPath("$.path").value("/api/v1/conversations/" + convAliceBob.getId() + "/messages"));

        // Confirm database still contains exactly 20 messages
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), now.minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(20);
    }

    @Test
    @DisplayName("TC 4: Messages outside the rolling 60-second window do not consume quota")
    void messagesOutsideRollingWindowDoNotConsumeQuota() throws Exception {
        Instant oldTime = Instant.now().minus(65, ChronoUnit.SECONDS);
        for (int i = 0; i < 20; i++) {
            ChatMessage msg = new ChatMessage(convAliceBob, requesterBob, "Old msg " + i);
            msg.setCreatedAt(oldTime);
            chatMessageRepository.save(msg);
        }
        chatMessageRepository.flush();

        // Bob should be able to send
        SendMessageRequest request = buildMessage("Message after window expired");
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 5: Quotas are independent across different authenticated users")
    void quotasAreIndependentAcrossUsers() throws Exception {
        Instant now = Instant.now();
        // Bob has 20 messages (quota exhausted)
        for (int i = 0; i < 20; i++) {
            chatMessageRepository.save(new ChatMessage(convAliceBob, requesterBob, "Bob msg " + i));
        }
        chatMessageRepository.flush();

        // Bob is throttled
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("Bob 21st"))))
                .andExpect(status().isTooManyRequests());

        // Alice (0 messages) can send a message in the same conversation
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("Alice reply"))))
                .andExpect(status().isCreated());

        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(ownerAlice.getId(), now.minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 6: A user cannot bypass the limit by sending across multiple conversations")
    void userCannotBypassLimitAcrossMultipleConversations() throws Exception {
        // Alice participates in convAliceBob and convAliceCharlie
        // Alice sends 10 messages in convAliceBob
        for (int i = 1; i <= 10; i++) {
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildMessage("Alice to Bob " + i))))
                    .andExpect(status().isCreated());
        }

        // Alice sends 10 messages in convAliceCharlie (total 20 messages)
        for (int i = 1; i <= 10; i++) {
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceCharlie.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildMessage("Alice to Charlie " + i))))
                    .andExpect(status().isCreated());
        }

        // Alice attempts 21st message in convAliceBob -> must be rejected with 429
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("Alice 21st to Bob"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));

        // Alice attempts 22nd message in convAliceCharlie -> must also be rejected with 429
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceCharlie.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("Alice 22nd to Charlie"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE));
    }

    @Test
    @DisplayName("TC 7: Concurrency test - 25 simultaneous requests from the same user result in exactly 20 created and 5 throttled (429)")
    void concurrentRequestsFromSameUserCannotExceedLimit() throws Exception {
        int totalRequests = 25;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger throttledCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final int index = i;
            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    SendMessageRequest req = buildMessage("Concurrent message " + index);
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                                    .header(HttpHeaders.AUTHORIZATION, bobToken)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    int statusCode = result.getResponse().getStatus();
                    if (statusCode == 201) {
                        successCount.incrementAndGet();
                    } else if (statusCode == 429) {
                        throttledCount.incrementAndGet();
                    } else {
                        otherCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    otherCount.incrementAndGet();
                }
            }));
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        assertThat(otherCount.get()).as("Unexpected HTTP status codes").isZero();
        assertThat(successCount.get()).as("Exactly 20 messages must succeed").isEqualTo(20);
        assertThat(throttledCount.get()).as("Exactly 5 messages must receive 429").isEqualTo(5);

        // Verify database contains exactly 20 messages
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(20);
    }

    @Test
    @DisplayName("TC 8: Concurrent requests from different users do not share quota")
    void concurrentRequestsFromDifferentUsersDoNotShareQuota() throws Exception {
        int requestsPerUser = 10;
        int totalRequests = requestsPerUser * 2;
        CountDownLatch readyLatch = new CountDownLatch(totalRequests);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger otherCount = new AtomicInteger(0);

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (int i = 0; i < totalRequests; i++) {
            final boolean isBob = (i % 2 == 0);
            final String token = isBob ? bobToken : aliceToken;

            futures.add(CompletableFuture.runAsync(() -> {
                try {
                    SendMessageRequest req = buildMessage("Concurrent inter-user message");
                    String body = objectMapper.writeValueAsString(req);

                    readyLatch.countDown();
                    startLatch.await(10, TimeUnit.SECONDS);

                    MvcResult result = mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                                    .header(HttpHeaders.AUTHORIZATION, token)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();

                    if (result.getResponse().getStatus() == 201) {
                        successCount.incrementAndGet();
                    } else {
                        otherCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    otherCount.incrementAndGet();
                }
            }));
        }

        readyLatch.await(10, TimeUnit.SECONDS);
        startLatch.countDown();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        assertThat(otherCount.get()).isZero();
        assertThat(successCount.get()).as("All 20 requests (10 by Bob, 10 by Alice) must succeed").isEqualTo(20);

        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(10);
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(ownerAlice.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(10);
    }

    @Test
    @DisplayName("TC 9: A rejected request does not persist a message in the database")
    void rejectedRequestDoesNotPersistMessage() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 20; i++) {
            chatMessageRepository.save(new ChatMessage(convAliceBob, requesterBob, "Pre-existing msg " + i));
        }
        chatMessageRepository.flush();

        long totalCountBefore = chatMessageRepository.countByConversationId(convAliceBob.getId());

        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("Rejected message"))))
                .andExpect(status().isTooManyRequests());

        long totalCountAfter = chatMessageRepository.countByConversationId(convAliceBob.getId());
        assertThat(totalCountAfter).isEqualTo(totalCountBefore);
    }

    @Test
    @DisplayName("TC 10: Non-participant user is rejected with 403 and does not consume quota")
    void nonParticipantRejectedWith403AndDoesNotConsumeQuota() throws Exception {
        // Charlie is NOT a participant in convAliceBob
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, charlieToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("Charlie intrusion"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(containsString("You are not authorized to send messages in this conversation")));

        // Charlie's quota must be 0
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(otherCharlie.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isZero();
    }

    @Test
    @DisplayName("TC 11: Invalid message content (blank) is rejected with 400 and does not consume quota")
    void invalidContentRejectedWith400AndDoesNotConsumeQuota() throws Exception {
        mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", convAliceBob.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(buildMessage("   "))))
                .andExpect(status().isBadRequest());

        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isZero();
    }

    @Test
    @DisplayName("TC 12: Creating a conversation with an initial message succeeds when quota remains")
    void initialMessageSucceedsWhenQuotaRemains() throws Exception {
        Listing newListing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                category,
                ListingType.GIVEAWAY,
                "Listing for Initial Message Test 1",
                "Description",
                "Ha Noi"
        ));
        createdListings.add(newListing);

        CreateConversationRequest request = new CreateConversationRequest("Initial message from Bob");
        mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", newListing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastMessagePreview").value("Initial message from Bob"));

        assertThat(conversationRepository.findByListingIdAndRequesterId(newListing.getId(), requesterBob.getId()))
                .isPresent();
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("TC 13: Creating a conversation with an initial message receives 429 and atomically rolls back when quota exhausted")
    void initialMessageReceives429AndRollsBackWhenQuotaExhausted() throws Exception {
        Instant now = Instant.now();
        // Exhaust Bob's quota (20 messages)
        for (int i = 0; i < 20; i++) {
            chatMessageRepository.save(new ChatMessage(convAliceBob, requesterBob, "Pre-existing msg " + i));
        }
        chatMessageRepository.flush();

        Listing targetListing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                category,
                ListingType.GIVEAWAY,
                "Listing for Blocked Initial Message Test",
                "Description",
                "Ha Noi"
        ));
        createdListings.add(targetListing);

        long initialConvCount = conversationRepository.findAllByListingId(targetListing.getId()).size();
        long initialMsgCount = chatMessageRepository.countByConversationId(convAliceBob.getId());

        CreateConversationRequest request = new CreateConversationRequest("Blocked initial message 21");
        mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", targetListing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value(RATE_LIMIT_MESSAGE))
                .andExpect(jsonPath("$.path").value("/api/v1/listings/" + targetListing.getId() + "/conversations"));

        // Verify atomicity & complete rollback: no conversation and no message was persisted
        assertThat(conversationRepository.findByListingIdAndRequesterId(targetListing.getId(), requesterBob.getId()))
                .as("Conversation creation must be rolled back atomically")
                .isEmpty();
        assertThat(conversationRepository.findAllByListingId(targetListing.getId()).size())
                .as("Total conversation count must not increase")
                .isEqualTo(initialConvCount);
        assertThat(chatMessageRepository.countByConversationId(convAliceBob.getId()))
                .as("Total message count must not increase")
                .isEqualTo(initialMsgCount);
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), now.minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(20);
    }

    @Test
    @DisplayName("TC 14: Creating a conversation without initial message succeeds even when message quota is exhausted")
    void conversationWithoutInitialMessageSucceedsWhenMessageQuotaExhausted() throws Exception {
        // Exhaust Bob's message quota (20 messages)
        for (int i = 0; i < 20; i++) {
            chatMessageRepository.save(new ChatMessage(convAliceBob, requesterBob, "Pre-existing msg " + i));
        }
        chatMessageRepository.flush();

        Listing targetListing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                category,
                ListingType.GIVEAWAY,
                "Listing for Empty Initial Message Test",
                "Description",
                "Ha Noi"
        ));
        createdListings.add(targetListing);

        // Bob creates conversation with empty initialMessage
        CreateConversationRequest request = new CreateConversationRequest(null);
        mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", targetListing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        assertThat(conversationRepository.findByListingIdAndRequesterId(targetListing.getId(), requesterBob.getId()))
                .isPresent();
        assertThat(chatMessageRepository.countBySenderIdAndCreatedAtAfter(requesterBob.getId(), Instant.now().minus(60, ChronoUnit.SECONDS)))
                .isEqualTo(20);
    }
}
