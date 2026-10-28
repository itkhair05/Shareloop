package com.shareloop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.chat.CreateConversationRequest;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.dto.request.CreateListingRequestDto;
import com.shareloop.dto.request.UpdateListingRequestStatusRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationControllerIntegrationTest {

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
    private ConversationRepository conversationRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User alice;
    private User bob;
    private User charlie;

    private String aliceToken;
    private String bobToken;
    private String charlieToken;

    private Category testCategory;

    @BeforeEach
    void setUp() {
        alice = userRepository.saveAndFlush(new User(
                "Alice",
                "alice.notif." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        bob = userRepository.saveAndFlush(new User(
                "Bob",
                "bob.notif." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        charlie = userRepository.saveAndFlush(new User(
                "Charlie",
                "charlie.notif." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));

        aliceToken = "Bearer " + jwtService.generateToken(alice.getId(), alice.getEmail(), alice.getRole(), alice.getStatus());
        bobToken = "Bearer " + jwtService.generateToken(bob.getId(), bob.getEmail(), bob.getRole(), bob.getStatus());
        charlieToken = "Bearer " + jwtService.generateToken(charlie.getId(), charlie.getEmail(), charlie.getRole(), charlie.getStatus());

        testCategory = categoryRepository.saveAndFlush(new Category(
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
        chatMessageRepository.deleteAll();
        conversationRepository.deleteAll();
        transactionRepository.deleteAll();
        listingRequestRepository.deleteAll();
        if (alice != null && alice.getId() != null) {
            listingRepository.findByOwnerId(alice.getId()).forEach(listingRepository::delete);
        }
        if (bob != null && bob.getId() != null) {
            listingRepository.findByOwnerId(bob.getId()).forEach(listingRepository::delete);
        }
        if (charlie != null && charlie.getId() != null) {
            listingRepository.findByOwnerId(charlie.getId()).forEach(listingRepository::delete);
        }
        if (testCategory != null && testCategory.getId() != null) {
            categoryRepository.deleteById(testCategory.getId());
        }
        if (alice != null && alice.getId() != null) {
            userRepository.deleteById(alice.getId());
        }
        if (bob != null && bob.getId() != null) {
            userRepository.deleteById(bob.getId());
        }
        if (charlie != null && charlie.getId() != null) {
            userRepository.deleteById(charlie.getId());
        }
    }

    private Listing createTestListing(User owner, ListingType type) {
        Listing listing = new Listing(
                owner,
                testCategory,
                type,
                "Test Listing Title",
                "Description for test listing",
                "Hanoi"
        );
        listing.setStatus(ListingStatus.ACTIVE);
        return listingRepository.saveAndFlush(listing);
    }

    // =========================================================================
    // 1. GET /api/v1/notifications
    // =========================================================================

    @Test
    @DisplayName("GET /api/v1/notifications returns authenticated user's notifications newest first")
    void getUserNotifications_authenticated_returnsPaginatedNewestFirst() throws Exception {
        Notification n1 = notificationRepository.saveAndFlush(new Notification(
                alice,
                NotificationType.REQUEST_RECEIVED,
                "First Title",
                "First message content",
                "LISTING_REQUEST",
                UUID.randomUUID()
        ));

        Thread.sleep(10);

        Notification n2 = notificationRepository.saveAndFlush(new Notification(
                alice,
                NotificationType.CHAT_MESSAGE,
                "Second Title",
                "Second message content",
                "CONVERSATION",
                UUID.randomUUID()
        ));

        // Notification belonging to Bob should NOT appear
        notificationRepository.saveAndFlush(new Notification(
                bob,
                NotificationType.REQUEST_RECEIVED,
                "Bob's Title",
                "Bob's message content",
                "LISTING_REQUEST",
                UUID.randomUUID()
        ));

        mockMvc.perform(get("/api/v1/notifications")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].id", is(n2.getId().toString())))
                .andExpect(jsonPath("$.content[0].type", is("CHAT_MESSAGE")))
                .andExpect(jsonPath("$.content[0].title", is("Second Title")))
                .andExpect(jsonPath("$.content[0].message", is("Second message content")))
                .andExpect(jsonPath("$.content[0].isRead", is(false)))
                .andExpect(jsonPath("$.content[0].referenceType", is("CONVERSATION")))
                .andExpect(jsonPath("$.content[1].id", is(n1.getId().toString())))
                .andExpect(jsonPath("$.totalElements", is(2)));
    }

    @Test
    @DisplayName("GET /api/v1/notifications anonymous access returns 401")
    void getUserNotifications_anonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/v1/notifications invalid pagination returns 400")
    void getUserNotifications_invalidPagination_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/notifications")
                        .param("page", "-1")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Page index")));

        mockMvc.perform(get("/api/v1/notifications")
                        .param("size", "100")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Page size")));
    }

    // =========================================================================
    // 2. GET /api/v1/notifications/unread-count
    // =========================================================================

    @Test
    @DisplayName("GET /api/v1/notifications/unread-count returns accurate count for user")
    void getUnreadCount_returnsAccurateCount() throws Exception {
        // Zero initially
        mockMvc.perform(get("/api/v1/notifications/unread-count")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount", is(0)));

        // Create 2 unread, 1 read for Alice
        notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.REQUEST_RECEIVED, "T1", "M1", "REF", UUID.randomUUID()
        ));
        notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.CHAT_MESSAGE, "T2", "M2", "REF", UUID.randomUUID()
        ));

        Notification readNotif = new Notification(
                alice, NotificationType.REQUEST_ACCEPTED, "T3", "M3", "REF", UUID.randomUUID()
        );
        readNotif.setIsRead(true);
        readNotif.setReadAt(Instant.now());
        notificationRepository.saveAndFlush(readNotif);

        // 1 unread for Bob (should not affect Alice)
        notificationRepository.saveAndFlush(new Notification(
                bob, NotificationType.REQUEST_RECEIVED, "T4", "M4", "REF", UUID.randomUUID()
        ));

        mockMvc.perform(get("/api/v1/notifications/unread-count")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount", is(2)));
    }

    @Test
    @DisplayName("GET /api/v1/notifications/unread-count anonymous access returns 401")
    void getUnreadCount_anonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/unread-count"))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // 3. PATCH /api/v1/notifications/{id}/read
    // =========================================================================

    @Test
    @DisplayName("PATCH /api/v1/notifications/{id}/read updates read state and timestamp")
    void markAsRead_success_updatesReadStateAndTimestamp() throws Exception {
        Notification notif = notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.REQUEST_RECEIVED, "Title", "Message", "REF", UUID.randomUUID()
        ));

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notif.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(notif.getId().toString())))
                .andExpect(jsonPath("$.isRead", is(true)))
                .andExpect(jsonPath("$.readAt", notNullValue()));

        Notification reloaded = notificationRepository.findById(notif.getId()).orElseThrow();
        assertThat(reloaded.getIsRead()).isTrue();
        assertThat(reloaded.getReadAt()).isNotNull();
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/{id}/read is idempotent on repeated calls")
    void markAsRead_repeatedCall_isIdempotent() throws Exception {
        Notification notif = notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.REQUEST_RECEIVED, "Title", "Message", "REF", UUID.randomUUID()
        ));

        // First call
        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notif.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk());

        Notification firstReload = notificationRepository.findById(notif.getId()).orElseThrow();
        Instant originalReadAt = firstReload.getReadAt();

        Thread.sleep(10);

        // Second call
        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notif.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isRead", is(true)));

        Notification secondReload = notificationRepository.findById(notif.getId()).orElseThrow();
        assertThat(secondReload.getReadAt()).isEqualTo(originalReadAt);
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/{id}/read returns 404 for nonexistent notification")
    void markAsRead_nonexistent_returns404() throws Exception {
        mockMvc.perform(patch("/api/v1/notifications/{id}/read", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/{id}/read returns 403 when modifying another user's notification")
    void markAsRead_anotherUsersNotification_returns403() throws Exception {
        Notification bobsNotif = notificationRepository.saveAndFlush(new Notification(
                bob, NotificationType.REQUEST_RECEIVED, "Bob Title", "Bob Msg", "REF", UUID.randomUUID()
        ));

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", bobsNotif.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isForbidden());

        Notification reloaded = notificationRepository.findById(bobsNotif.getId()).orElseThrow();
        assertThat(reloaded.getIsRead()).isFalse();
        assertThat(reloaded.getReadAt()).isNull();
    }

    // =========================================================================
    // 4. PATCH /api/v1/notifications/read-all
    // =========================================================================

    @Test
    @DisplayName("PATCH /api/v1/notifications/read-all marks all unread for current user only")
    void markAllAsRead_marksAllUnreadForCurrentUserOnly() throws Exception {
        notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.REQUEST_RECEIVED, "A1", "M1", "REF", UUID.randomUUID()
        ));
        notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.CHAT_MESSAGE, "A2", "M2", "REF", UUID.randomUUID()
        ));
        Notification bobsNotif = notificationRepository.saveAndFlush(new Notification(
                bob, NotificationType.REQUEST_RECEIVED, "B1", "M1", "REF", UUID.randomUUID()
        ));

        mockMvc.perform(patch("/api/v1/notifications/read-all")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount", is(2)));

        long aliceUnread = notificationRepository.countByRecipientIdAndIsReadFalse(alice.getId());
        assertThat(aliceUnread).isEqualTo(0);

        long bobUnread = notificationRepository.countByRecipientIdAndIsReadFalse(bob.getId());
        assertThat(bobUnread).isEqualTo(1);

        Notification reloadedBob = notificationRepository.findById(bobsNotif.getId()).orElseThrow();
        assertThat(reloadedBob.getIsRead()).isFalse();
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/read-all repeated call returns 0 updatedCount")
    void markAllAsRead_repeatedCall_returnsZero() throws Exception {
        notificationRepository.saveAndFlush(new Notification(
                alice, NotificationType.REQUEST_RECEIVED, "A1", "M1", "REF", UUID.randomUUID()
        ));

        mockMvc.perform(patch("/api/v1/notifications/read-all")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount", is(1)));

        mockMvc.perform(patch("/api/v1/notifications/read-all")
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount", is(0)));
    }

    // =========================================================================
    // 5. Event Integration Tests
    // =========================================================================

    @Test
    @DisplayName("Event Integration: Creating listing request generates notification for listing owner")
    void eventIntegration_listingRequestCreation_notifiesListingOwner() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);

        CreateListingRequestDto dto = new CreateListingRequestDto("I would love to have this item!");

        mockMvc.perform(post("/api/v1/listings/{id}/requests", listing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated());

        List<Notification> aliceNotifs = notificationRepository.findByRecipientId(alice.getId(), null).getContent();
        assertThat(aliceNotifs).hasSize(1);

        Notification notif = aliceNotifs.get(0);
        assertThat(notif.getType()).isEqualTo(NotificationType.REQUEST_RECEIVED);
        assertThat(notif.getTitle()).isEqualTo("Yêu cầu mới");
        assertThat(notif.getMessage()).contains("Bob").contains("cho bài đăng");
        assertThat(notif.getReferenceType()).isEqualTo("LISTING_REQUEST");
        assertThat(notif.getReferenceId()).isNotNull();

        // Requester Bob should NOT receive a notification
        List<Notification> bobNotifs = notificationRepository.findByRecipientId(bob.getId(), null).getContent();
        assertThat(bobNotifs).isEmpty();
    }

    @Test
    @DisplayName("Event Integration: Accepting listing request generates notification for requester")
    void eventIntegration_listingRequestAccepted_notifiesRequester() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);

        ListingRequest req = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                bob,
                "Request message",
                ListingRequestStatus.PENDING
        ));

        UpdateListingRequestStatusRequest dto = new UpdateListingRequestStatusRequest(ListingRequestStatus.ACCEPTED);

        mockMvc.perform(patch("/api/v1/listing-requests/{id}/status", req.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());

        List<Notification> bobNotifs = notificationRepository.findByRecipientId(bob.getId(), null).getContent();
        assertThat(bobNotifs).hasSize(1);

        Notification notif = bobNotifs.get(0);
        assertThat(notif.getType()).isEqualTo(NotificationType.REQUEST_ACCEPTED);
        assertThat(notif.getTitle()).isEqualTo("Yêu cầu được chấp nhận");
        assertThat(notif.getMessage()).contains("đã được chấp nhận");
        assertThat(notif.getReferenceType()).isEqualTo("TRANSACTION");
    }

    @Test
    @DisplayName("Event Integration: Rejecting listing request generates notification for requester")
    void eventIntegration_listingRequestRejected_notifiesRequester() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);

        ListingRequest req = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing,
                bob,
                "Request message",
                ListingRequestStatus.PENDING
        ));

        UpdateListingRequestStatusRequest dto = new UpdateListingRequestStatusRequest(ListingRequestStatus.REJECTED);

        mockMvc.perform(patch("/api/v1/listing-requests/{id}/status", req.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());

        List<Notification> bobNotifs = notificationRepository.findByRecipientId(bob.getId(), null).getContent();
        assertThat(bobNotifs).hasSize(1);

        Notification notif = bobNotifs.get(0);
        assertThat(notif.getType()).isEqualTo(NotificationType.REQUEST_REJECTED);
        assertThat(notif.getTitle()).isEqualTo("Yêu cầu bị từ chối");
        assertThat(notif.getMessage()).contains("đã bị từ chối");
        assertThat(notif.getReferenceType()).isEqualTo("LISTING_REQUEST");
    }

    @Test
    @DisplayName("Event Integration: Sending chat message generates notification for conversation partner")
    void eventIntegration_chatMessage_notifiesRecipientWithoutLeakingPrivateContent() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);

        Conversation conv = conversationRepository.saveAndFlush(new Conversation(
                listing, alice, bob, null
        ));

        SendMessageRequest msgRequest = new SendMessageRequest("Hello Alice, is this item still available?");

        mockMvc.perform(post("/api/v1/conversations/{id}/messages", conv.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(msgRequest)))
                .andExpect(status().isCreated());

        // Alice (recipient) should receive notification
        List<Notification> aliceNotifs = notificationRepository.findByRecipientId(alice.getId(), null).getContent();
        assertThat(aliceNotifs).hasSize(1);

        Notification notif = aliceNotifs.get(0);
        assertThat(notif.getType()).isEqualTo(NotificationType.CHAT_MESSAGE);
        assertThat(notif.getTitle()).isEqualTo("Tin nhắn mới");
        assertThat(notif.getMessage()).contains("Bạn có tin nhắn mới từ Bob");
        // Verify private chat text is NOT exposed in the notification body
        assertThat(notif.getMessage()).doesNotContain("Hello Alice, is this item still available?");
        assertThat(notif.getReferenceType()).isEqualTo("CONVERSATION");
        assertThat(notif.getReferenceId()).isEqualTo(conv.getId());

        // Sender Bob should NOT receive notification
        List<Notification> bobNotifs = notificationRepository.findByRecipientId(bob.getId(), null).getContent();
        assertThat(bobNotifs).isEmpty();
    }

    @Test
    @DisplayName("Event Integration: Initial message on conversation start notifies listing owner")
    void eventIntegration_chatInitialMessage_notifiesListingOwner() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);

        CreateConversationRequest request = new CreateConversationRequest("Hi! I am interested in this.");

        mockMvc.perform(post("/api/v1/listings/{id}/conversations", listing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        List<Notification> aliceNotifs = notificationRepository.findByRecipientId(alice.getId(), null).getContent();
        assertThat(aliceNotifs).hasSize(1);
        assertThat(aliceNotifs.get(0).getType()).isEqualTo(NotificationType.CHAT_MESSAGE);
    }

    @Test
    @DisplayName("Event Integration: Transaction completion notifies both participants once")
    void eventIntegration_transactionCompletion_notifiesBothParticipants() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);
        listing.setStatus(ListingStatus.RESERVED);
        listingRepository.saveAndFlush(listing);

        ListingRequest req = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing, bob, "Msg", ListingRequestStatus.ACCEPTED
        ));

        Transaction tx = transactionRepository.saveAndFlush(new Transaction(
                req, listing, alice, bob, TransactionStatus.PENDING
        ));

        // Alice completes first (status transitions to IN_PROGRESS) -> NO completion notification yet
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("IN_PROGRESS")));

        assertThat(notificationRepository.findAll()).isEmpty();

        // Bob completes second (status transitions to COMPLETED) -> Both receive completion notifications
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("COMPLETED")));

        List<Notification> aliceNotifs = notificationRepository.findByRecipientId(alice.getId(), null).getContent();
        List<Notification> bobNotifs = notificationRepository.findByRecipientId(bob.getId(), null).getContent();

        assertThat(aliceNotifs).hasSize(1);
        assertThat(aliceNotifs.get(0).getType()).isEqualTo(NotificationType.TRANSACTION_COMPLETED);
        assertThat(aliceNotifs.get(0).getTitle()).isEqualTo("Giao dịch hoàn tất");
        assertThat(aliceNotifs.get(0).getMessage()).contains("đã hoàn tất. Bạn có thể để lại đánh giá.");
        assertThat(aliceNotifs.get(0).getReferenceType()).isEqualTo("TRANSACTION");
        assertThat(aliceNotifs.get(0).getReferenceId()).isEqualTo(tx.getId());

        assertThat(bobNotifs).hasSize(1);
        assertThat(bobNotifs.get(0).getType()).isEqualTo(NotificationType.TRANSACTION_COMPLETED);
        assertThat(bobNotifs.get(0).getTitle()).isEqualTo("Giao dịch hoàn tất");
        assertThat(bobNotifs.get(0).getMessage()).contains("đã hoàn tất. Bạn có thể để lại đánh giá.");
        assertThat(bobNotifs.get(0).getReferenceType()).isEqualTo("TRANSACTION");
        assertThat(bobNotifs.get(0).getReferenceId()).isEqualTo(tx.getId());

        // Repeated call by Bob (idempotent) does NOT create additional notifications
        mockMvc.perform(post("/api/v1/transactions/{id}/complete", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk());

        assertThat(notificationRepository.findByRecipientId(alice.getId(), null).getContent()).hasSize(1);
        assertThat(notificationRepository.findByRecipientId(bob.getId(), null).getContent()).hasSize(1);
    }

    @Test
    @DisplayName("Event Integration: Transaction cancellation does not create completion notifications")
    void eventIntegration_transactionCancellation_doesNotCreateCompletionNotification() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);
        listing.setStatus(ListingStatus.RESERVED);
        listingRepository.saveAndFlush(listing);

        ListingRequest req = listingRequestRepository.saveAndFlush(new ListingRequest(
                listing, bob, "Msg", ListingRequestStatus.ACCEPTED
        ));

        Transaction tx = transactionRepository.saveAndFlush(new Transaction(
                req, listing, alice, bob, TransactionStatus.PENDING
        ));

        CancelTransactionRequest cancelRequest = new CancelTransactionRequest("Could not arrange pickup");

        mockMvc.perform(post("/api/v1/transactions/{id}/cancel", tx.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cancelRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")));

        assertThat(notificationRepository.findAll()).isEmpty();
    }

    @Test
    @DisplayName("Localization: Conversation creation with initial message generates Vietnamese notification")
    void localization_conversationCreationGeneratesVietnameseNotification() throws Exception {
        Listing listing = createTestListing(alice, ListingType.GIVEAWAY);

        CreateConversationRequest request = new CreateConversationRequest("Tôi muốn xin món đồ này!");

        mockMvc.perform(post("/api/v1/listings/{listingId}/conversations", listing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        List<Notification> aliceNotifs = notificationRepository.findByRecipientId(alice.getId(), null).getContent();
        assertThat(aliceNotifs).hasSize(1);
        Notification notif = aliceNotifs.get(0);
        assertThat(notif.getType()).isEqualTo(NotificationType.CHAT_MESSAGE);
        assertThat(notif.getTitle()).isEqualTo("Tin nhắn mới");
        assertThat(notif.getMessage()).isEqualTo("Bạn có tin nhắn mới từ Bob");
        assertThat(notif.getMessage()).doesNotContain("null");
    }
}

