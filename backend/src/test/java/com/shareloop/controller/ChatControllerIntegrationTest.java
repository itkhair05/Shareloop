package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.chat.CreateConversationRequest;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.entity.*;
import com.shareloop.entity.enums.*;
import com.shareloop.repository.*;
import com.shareloop.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ChatControllerIntegrationTest {

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
    private ConversationRepository conversationRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User ownerAlice;
    private User requesterBob;
    private User otherCharlie;
    private User adminUser;
    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;
    private Category generalCategory;

    @BeforeEach
    void setUp() {
        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.chat." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.chat." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        otherCharlie = userRepository.saveAndFlush(new User(
                "Charlie Other",
                "charlie.chat." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        adminUser = userRepository.saveAndFlush(new User(
                "Admin Moderation",
                "admin.chat." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.ADMIN,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(ownerAlice.getId(), ownerAlice.getEmail(), ownerAlice.getRole(), ownerAlice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(requesterBob.getId(), requesterBob.getEmail(), requesterBob.getRole(), requesterBob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(otherCharlie.getId(), otherCharlie.getEmail(), otherCharlie.getRole(), otherCharlie.getStatus());
        adminToken = "Bearer " + jwtService.generateToken(adminUser.getId(), adminUser.getEmail(), adminUser.getRole(), adminUser.getStatus());

        generalCategory = categoryRepository.saveAndFlush(new Category(
                "Category-" + UUID.randomUUID().toString().substring(0, 8),
                "slug-" + UUID.randomUUID().toString().substring(0, 8),
                "Category description",
                true
        ));
    }

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        chatMessageRepository.deleteAll();
        conversationRepository.deleteAll();
        listingRequestRepository.deleteAll();
        listingRepository.deleteAll();
        if (generalCategory != null && generalCategory.getId() != null) {
            categoryRepository.deleteById(generalCategory.getId());
        }
        userRepository.deleteAll();
    }

    private Listing createListing(User owner, ListingType type, ListingStatus status, String title) {
        Listing listing = new Listing(owner, generalCategory, type, title, "Description for " + title, "Hanoi");
        listing.setStatus(status);
        if (type == ListingType.SALE) {
            listing.setPrice(new java.math.BigDecimal("200000.00"));
            listing.setCurrency("VND");
        } else if (type == ListingType.WANTED) {
            listing.setPrice(new java.math.BigDecimal("100000.00"));
            listing.setCurrency("VND");
        }
        return listingRepository.saveAndFlush(listing);
    }

    @Nested
    @DisplayName("Create or Retrieve Conversation Tests")
    class CreateOrRetrieveConversationTests {

        @Test
        @DisplayName("Requester successfully creates empty conversation for active listing")
        void createConversationWithoutMessageSuccess() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Free Desk");

            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.listing.id").value(listing.getId().toString()))
                    .andExpect(jsonPath("$.listing.title").value("Free Desk"))
                    .andExpect(jsonPath("$.otherParticipant.id").value(ownerAlice.getId().toString()))
                    .andExpect(jsonPath("$.otherParticipant.displayName").value("Alice Owner"))
                    .andExpect(jsonPath("$.lastMessagePreview").doesNotExist())
                    .andExpect(jsonPath("$.lastMessageAt").doesNotExist())
                    .andExpect(jsonPath("$.createdAt").exists());

            assertThat(conversationRepository.findByListingIdAndRequesterId(listing.getId(), requesterBob.getId())).isPresent();
        }

        @Test
        @DisplayName("Requester creates conversation with initial message atomically")
        void createConversationWithInitialMessageSuccess() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.SALE, ListingStatus.ACTIVE, "Guitar");
            CreateConversationRequest dto = new CreateConversationRequest("Is this guitar still available?");

            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(dto)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.lastMessagePreview").value("Is this guitar still available?"))
                    .andExpect(jsonPath("$.lastMessageAt").exists());

            Conversation conv = conversationRepository.findByListingIdAndRequesterId(listing.getId(), requesterBob.getId()).orElseThrow();
            assertThat(chatMessageRepository.findByConversationId(conv.getId(), org.springframework.data.domain.Pageable.unpaged())).hasSize(1);
        }

        @Test
        @DisplayName("Repeated request returns existing canonical conversation and does not re-insert initial message")
        void repeatedRequestReturnsCanonicalConversation() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Coffee Table");
            CreateConversationRequest firstDto = new CreateConversationRequest("Initial message");

            String response1 = mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(firstDto)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();

            UUID conversationId = UUID.fromString(objectMapper.readTree(response1).get("id").asText());

            // Second request with different initial message
            CreateConversationRequest secondDto = new CreateConversationRequest("Different message should be ignored");
            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(secondDto)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(conversationId.toString()))
                    .andExpect(jsonPath("$.lastMessagePreview").value("Initial message"));

            // Still exactly 1 message in conversation
            assertThat(chatMessageRepository.findByConversationId(conversationId, org.springframework.data.domain.Pageable.unpaged())).hasSize(1);
        }

        @Test
        @DisplayName("Listing owner cannot start conversation with themselves")
        void rejectSelfConversation() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Self Item");

            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("Users cannot start conversations on their own listings")));
        }

        @Test
        @DisplayName("Reject new conversation creation for non-active listing (RESERVED, COMPLETED, REMOVED)")
        void rejectNewConversationOnNonActiveListing() throws Exception {
            Listing reservedListing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.RESERVED, "Reserved Couch");

            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", reservedListing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("listing is not active")));
        }

        @Test
        @DisplayName("Return existing conversation even after listing becomes unavailable (RESERVED or COMPLETED)")
        void returnExistingConversationWhenListingBecomesUnavailable() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Available Item");

            // 1. Create conversation while ACTIVE
            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk());

            // 2. Listing transitions to RESERVED
            listing.setStatus(ListingStatus.RESERVED);
            listingRepository.saveAndFlush(listing);

            // 3. Retrieval still succeeds for existing conversation
            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.listing.status").value("RESERVED"));
        }

        @Test
        @DisplayName("Reject conversation creation with mismatched or invalid listingRequestId")
        void rejectMismatchedListingRequestId() throws Exception {
            Listing listing1 = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item 1");
            Listing listing2 = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item 2");

            ListingRequest reqForListing2 = listingRequestRepository.saveAndFlush(
                    new ListingRequest(listing2, requesterBob, "Want item 2", ListingRequestStatus.PENDING)
            );

            CreateConversationRequest dto = new CreateConversationRequest("Inquiring", reqForListing2.getId());

            // Attempting to use reqForListing2 on listing1
            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing1.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(dto)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("does not belong to the specified listing")));
        }

        @Test
        @DisplayName("Return 404 for non-existent listing ID")
        void return404ForMissingListing() throws Exception {
            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", UUID.randomUUID())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("Return 401 for unauthenticated conversation creation")
        void rejectUnauthenticatedConversationCreation() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item");

            mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId()))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("Conversation Details and Listing Tests")
    class ConversationDetailsAndListingTests {

        @Test
        @DisplayName("Participant can retrieve conversation details")
        void participantCanRetrieveConversationDetails() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Desk");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            // Requester viewing
            mockMvc.perform(get("/api/v1/conversations/{conversationId}", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(conv.getId().toString()))
                    .andExpect(jsonPath("$.otherParticipant.id").value(ownerAlice.getId().toString()));

            // Owner viewing
            mockMvc.perform(get("/api/v1/conversations/{conversationId}", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.otherParticipant.id").value(requesterBob.getId().toString()));
        }

        @Test
        @DisplayName("Reject non-participant user viewing conversation with 403 Forbidden")
        void rejectNonParticipantViewingConversation() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Private Conv Item");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            mockMvc.perform(get("/api/v1/conversations/{conversationId}", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, charlieToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("You are not authorized to access this conversation")));
        }

        @Test
        @DisplayName("Admin who is not a participant CANNOT access private conversation details")
        void rejectNonParticipantAdminViewingConversation() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Admin Access Test");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            mockMvc.perform(get("/api/v1/conversations/{conversationId}", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("You are not authorized to access this conversation")));
        }

        @Test
        @DisplayName("List user conversations returns only caller's conversations with deterministic order")
        void listUserConversationsOrderingAndIsolation() throws Exception {
            Listing l1 = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Item 1");
            Listing l2 = createListing(ownerAlice, ListingType.SALE, ListingStatus.ACTIVE, "Item 2");
            Listing l3 = createListing(otherCharlie, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Charlie Item");

            // Bob chats with Alice on l1
            Conversation c1 = conversationRepository.saveAndFlush(new Conversation(l1, ownerAlice, requesterBob, null));
            ChatMessage m1 = chatMessageRepository.saveAndFlush(new ChatMessage(c1, requesterBob, "Bob on l1"));
            c1.setLastMessageAt(m1.getCreatedAt());
            conversationRepository.saveAndFlush(c1);

            // Bob chats with Alice on l2 (empty conversation)
            Conversation c2 = conversationRepository.saveAndFlush(new Conversation(l2, ownerAlice, requesterBob, null));

            // Charlie chats with Alice on l1 (Bob should NOT see this)
            Conversation c3 = conversationRepository.saveAndFlush(new Conversation(l1, ownerAlice, otherCharlie, null));
            ChatMessage m3 = chatMessageRepository.saveAndFlush(new ChatMessage(c3, otherCharlie, "Charlie message"));
            c3.setLastMessageAt(m3.getCreatedAt());
            conversationRepository.saveAndFlush(c3);

            mockMvc.perform(get("/api/v1/conversations")
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    // Most recently messaged conversation first; empty conversation second
                    .andExpect(jsonPath("$.content[0].id").value(c1.getId().toString()))
                    .andExpect(jsonPath("$.content[0].lastMessagePreview").value("Bob on l1"))
                    .andExpect(jsonPath("$.content[1].id").value(c2.getId().toString()))
                    .andExpect(jsonPath("$.content[1].lastMessagePreview").doesNotExist());
        }
    }

    @Nested
    @DisplayName("Send Message and Message History Tests")
    class SendMessageAndHistoryTests {

        @Test
        @DisplayName("Owner and requester can exchange messages in conversation")
        void participantsCanExchangeMessages() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Bicycle");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            // 1. Bob sends message
            SendMessageRequest bobMsg = new SendMessageRequest("Hello Alice, is this still free?");
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(bobMsg)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.sender.id").value(requesterBob.getId().toString()))
                    .andExpect(jsonPath("$.content").value("Hello Alice, is this still free?"))
                    .andExpect(jsonPath("$.createdAt").exists());

            // 2. Alice replies
            SendMessageRequest aliceReply = new SendMessageRequest("Yes Bob, you can pick it up tomorrow!");
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, aliceToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(aliceReply)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.sender.id").value(ownerAlice.getId().toString()))
                    .andExpect(jsonPath("$.content").value("Yes Bob, you can pick it up tomorrow!"));

            // 3. Verify conversation lastMessageAt was updated
            Conversation updated = conversationRepository.findById(conv.getId()).orElseThrow();
            assertThat(updated.getLastMessageAt()).isNotNull();

            // 4. Retrieve message history (ordered createdAt DESC, id DESC)
            mockMvc.perform(get("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(2)))
                    .andExpect(jsonPath("$.content[0].content").value("Yes Bob, you can pick it up tomorrow!"))
                    .andExpect(jsonPath("$.content[1].content").value("Hello Alice, is this still free?"));
        }

        @Test
        @DisplayName("Reject non-participant sending message with 403 Forbidden")
        void rejectNonParticipantSendingMessage() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Piano");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            SendMessageRequest msg = new SendMessageRequest("Intruder message");
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, charlieToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(msg)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("You are not authorized to send messages")));
        }

        @Test
        @DisplayName("Admin who is not a participant cannot send or view messages")
        void rejectAdminSendingOrViewingMessages() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Admin Test Listing");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            SendMessageRequest msg = new SendMessageRequest("Admin unauthorized message");
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(msg)))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Reject blank or whitespace-only message content with 400 Bad Request")
        void rejectBlankMessageContent() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Book");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            SendMessageRequest msg = new SendMessageRequest("     ");
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(msg)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Reject sending message when listing has been REMOVED")
        void rejectSendingMessageOnRemovedListing() throws Exception {
            Listing listing = createListing(ownerAlice, ListingType.GIVEAWAY, ListingStatus.ACTIVE, "Removed Item Test");
            Conversation conv = conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));

            // Listing becomes REMOVED
            listing.setStatus(ListingStatus.REMOVED);
            listingRepository.saveAndFlush(listing);

            SendMessageRequest msg = new SendMessageRequest("Are you still there?");
            mockMvc.perform(post("/api/v1/conversations/{conversationId}/messages", conv.getId())
                            .header(HttpHeaders.AUTHORIZATION, bobToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(msg)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("listing has been removed")));
        }
    }
}
