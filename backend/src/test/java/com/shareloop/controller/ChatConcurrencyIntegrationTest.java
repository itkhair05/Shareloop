package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.chat.CreateConversationRequest;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
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

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
class ChatConcurrencyIntegrationTest {

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

    private User ownerAlice;
    private User requesterBob;
    private String aliceToken;
    private String bobToken;
    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.chat.conc." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.chat.conc." + UUID.randomUUID() + "@example.com",
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
        chatMessageRepository.deleteAll();
        conversationRepository.deleteAll();
        listingRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Deterministic concurrency: two simultaneous conversation creation requests yield exactly one canonical conversation")
    void concurrentConversationCreationYieldsSingleCanonicalConversation() throws Exception {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Concurrent Chat Bicycle",
                "Description",
                "Hanoi"
        ));

        CreateConversationRequest dto = new CreateConversationRequest("Concurrent initial inquiry");
        String requestBody = objectMapper.writeValueAsString(dto);

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        CompletableFuture<MvcResult> future1 = CompletableFuture.supplyAsync(() -> {
            try {
                readyLatch.countDown();
                startLatch.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                                .header(HttpHeaders.AUTHORIZATION, bobToken)
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
                return mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                                .header(HttpHeaders.AUTHORIZATION, bobToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(requestBody))
                        .andReturn();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        boolean ready = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(ready).isTrue();
        startLatch.countDown();

        CompletableFuture.allOf(future1, future2).get(15, TimeUnit.SECONDS);

        MvcResult r1 = future1.get();
        MvcResult r2 = future2.get();

        assertThat(r1.getResponse().getStatus()).isEqualTo(200);
        assertThat(r2.getResponse().getStatus()).isEqualTo(200);

        UUID id1 = UUID.fromString(objectMapper.readTree(r1.getResponse().getContentAsString()).get("id").asText());
        UUID id2 = UUID.fromString(objectMapper.readTree(r2.getResponse().getContentAsString()).get("id").asText());

        // Both callers must resolve the exact same conversation ID
        assertThat(id1).isEqualTo(id2);

        // Database must contain exactly one conversation for this listing and requester
        List<Conversation> convs = conversationRepository.findAll();
        assertThat(convs).hasSize(1);
    }

    @Test
    @DisplayName("Deterministic concurrency: simultaneous message sends maintain accurate lastMessageAt without deadlocks")
    void concurrentMessageSendsMaintainAccurateLastMessageAtWithoutDeadlock() throws Exception {
        Listing listing = listingRepository.saveAndFlush(new Listing(
                ownerAlice,
                generalCategory,
                ListingType.GIVEAWAY,
                "Concurrent Message Desk",
                "Description",
                "Hanoi"
        ));

        Conversation conversation = conversationRepository.saveAndFlush(
                new Conversation(listing, ownerAlice, requesterBob, null)
        );

        int threadCount = 8;
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        List<CompletableFuture<MvcResult>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            final int index = i;
            final String token = (i % 2 == 0) ? bobToken : aliceToken;
            final String body = objectMapper.writeValueAsString(new SendMessageRequest("Concurrent message " + index));

            futures.add(CompletableFuture.supplyAsync(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await(5, TimeUnit.SECONDS);
                    return mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conversation.getId())
                                    .header(HttpHeaders.AUTHORIZATION, token)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                            .andReturn();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }));
        }

        boolean ready = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(ready).isTrue();
        startLatch.countDown();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(20, TimeUnit.SECONDS);

        for (CompletableFuture<MvcResult> f : futures) {
            assertThat(f.get().getResponse().getStatus()).isEqualTo(201);
        }

        // Verify all 8 messages exist
        List<ChatMessage> messages = chatMessageRepository.findAll();
        assertThat(messages).hasSize(threadCount);

        // Verify conversation lastMessageAt was updated and equals the latest message's createdAt
        Conversation freshConv = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(freshConv.getLastMessageAt()).isNotNull();

        ChatMessage latestMessage = chatMessageRepository.findFirstByConversationIdOrderByCreatedAtDescIdDesc(conversation.getId()).orElseThrow();
        assertThat(freshConv.getLastMessageAt()).isEqualTo(latestMessage.getCreatedAt());

        // Robust invariant check: every persisted message has createdAt <= conversation.lastMessageAt
        for (ChatMessage m : messages) {
            assertThat(m.getCreatedAt()).isNotNull();
            assertThat(m.getCreatedAt().isAfter(freshConv.getLastMessageAt())).isFalse();
        }
    }
}
