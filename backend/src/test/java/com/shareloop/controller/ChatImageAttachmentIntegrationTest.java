package com.shareloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.entity.Category;
import com.shareloop.entity.ChatMessage;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.Listing;
import com.shareloop.entity.Notification;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ChatMessageRepository;
import com.shareloop.repository.ConversationRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.NotificationRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.JwtService;
import com.shareloop.service.filestorage.LocalStorageService;
import com.shareloop.testsupport.TestStorageSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatImageAttachmentIntegrationTest {

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
    private NotificationRepository notificationRepository;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private LocalStorageService localStorageService;

    private User ownerAlice;
    private User requesterBob;
    private User otherCharlie;
    private User adminUser;
    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private String adminToken;
    private Category generalCategory;

    private final Set<String> uploadedFilenames = new HashSet<>();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        TestStorageSupport.registerIsolatedRoot(registry);
    }

    @BeforeEach
    void setUp() {
        TestStorageSupport.assertEffectiveRootIsIsolated(localStorageService.getRootPath());

        ownerAlice = userRepository.saveAndFlush(new User(
                "Alice Owner",
                "alice.chat.img." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        requesterBob = userRepository.saveAndFlush(new User(
                "Bob Requester",
                "bob.chat.img." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        otherCharlie = userRepository.saveAndFlush(new User(
                "Charlie Other",
                "charlie.chat.img." + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("Password123!"),
                UserRole.USER,
                UserStatus.ACTIVE
        ));
        adminUser = userRepository.saveAndFlush(new User(
                "Admin Moderation",
                "admin.chat.img." + UUID.randomUUID() + "@example.com",
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

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        chatMessageRepository.deleteAll();
        uploadedFileRepository.deleteAll();
        conversationRepository.deleteAll();
        if (ownerAlice != null) {
            listingRepository.findByOwnerId(ownerAlice.getId()).forEach(listingRepository::delete);
        }
        if (generalCategory != null) {
            categoryRepository.deleteById(generalCategory.getId());
        }
        for (User user : List.of(ownerAlice, requesterBob, otherCharlie, adminUser)) {
            if (user != null && user.getId() != null) {
                userRepository.deleteById(user.getId());
            }
        }

        TestStorageSupport.deleteOwnedFiles(localStorageService.getRootPath(), uploadedFilenames);
        uploadedFilenames.clear();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private byte[] createValidImage(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, format, baos);
        return baos.toByteArray();
    }

    private JsonNode uploadImage(String token, String purpose) throws Exception {
        byte[] png = createValidImage("png", 24, 24);
        MockMultipartFile file = new MockMultipartFile("file", "chat-photo.png", "image/png", png);

        var builder = multipart("/api/v1/files/upload")
                .file(file)
                .header(HttpHeaders.AUTHORIZATION, token);
        if (purpose != null) {
            builder = builder.param("purpose", purpose);
        }

        String body = mockMvc.perform(builder)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode node = objectMapper.readTree(body);
        uploadedFilenames.add(node.get("filename").asText());
        return node;
    }

    private Conversation createConversation() {
        Listing listing = new Listing(
                ownerAlice, generalCategory, ListingType.GIVEAWAY,
                "Chat Image Item", "Description for chat image item", "Hanoi"
        );
        listing.setStatus(ListingStatus.ACTIVE);
        listing = listingRepository.saveAndFlush(listing);
        return conversationRepository.saveAndFlush(new Conversation(listing, ownerAlice, requesterBob, null));
    }

    private ResultActions sendMessage(UUID conversationId, String token, SendMessageRequest request) throws Exception {
        return mockMvc.perform(post("/api/v1/conversations/{id}/messages", conversationId)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
    }

    private UploadedFile registryEntry(JsonNode upload) {
        return uploadedFileRepository.findById(UUID.fromString(upload.get("id").asText())).orElseThrow();
    }

    // -------------------------------------------------------------------------
    // 1. Upload registry
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Upload with purpose=CHAT records ownership metadata and keeps the response contract")
    void uploadChatImageRecordsOwnership() throws Exception {
        JsonNode upload = uploadImage(bobToken, "CHAT");

        UploadedFile entry = registryEntry(upload);
        assertThat(entry.getOwner().getId()).isEqualTo(requesterBob.getId());
        assertThat(entry.getFilename()).isEqualTo(upload.get("filename").asText());
        assertThat(entry.getContentType()).isEqualTo("image/png");
        assertThat(entry.getSizeBytes()).isEqualTo(upload.get("size").asLong());
        assertThat(entry.getPurpose()).isEqualTo(UploadPurpose.CHAT);
        assertThat(entry.isBound()).isFalse();
        assertThat(entry.getCreatedAt()).isNotNull();

        assertThat(upload.get("id").asText()).isNotBlank();
        assertThat(upload.get("url").asText()).isEqualTo("/api/v1/files/" + entry.getFilename());
        assertThat(uploadedFileRepository.countByOwnerId(requesterBob.getId())).isEqualTo(1);
    }

    @Test
    @DisplayName("Upload without purpose defaults to GENERAL and is not chat-eligible")
    void uploadDefaultsToGeneralPurpose() throws Exception {
        JsonNode upload = uploadImage(bobToken, null);

        UploadedFile entry = registryEntry(upload);
        assertThat(entry.getPurpose()).isEqualTo(UploadPurpose.GENERAL);
    }

    // -------------------------------------------------------------------------
    // 2. Message validation
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Text-only message keeps existing behavior and reports type TEXT")
    void textOnlyMessageStillWorks() throws Exception {
        Conversation conversation = createConversation();

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest("Sản phẩm này còn hàng không?"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("TEXT"))
                .andExpect(jsonPath("$.content").value("Sản phẩm này còn hàng không?"))
                .andExpect(jsonPath("$.imageUrl").value(nullValue()));
    }

    @Test
    @DisplayName("Image-only message is accepted and returns a protected image URL")
    void imageOnlyMessageWorks() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("IMAGE"))
                .andExpect(jsonPath("$.content").value(nullValue()))
                .andExpect(jsonPath("$.imageUrl").value("/api/v1/chat-images/" + imageId))
                .andExpect(jsonPath("$.sender.id").value(requesterBob.getId().toString()));

        UploadedFile entry = registryEntry(upload);
        assertThat(entry.isBound()).isTrue();
        assertThat(entry.getBoundMessageId()).isNotNull();

        ChatMessage message = chatMessageRepository.findById(entry.getBoundMessageId()).orElseThrow();
        assertThat(message.getImageFileId()).isEqualTo(imageId);
        assertThat(message.getContent()).isNull();
        assertThat(message.getConversation().getId()).isEqualTo(conversation.getId());
    }

    @Test
    @DisplayName("Image with caption is accepted and keeps the caption")
    void imageWithCaptionMessageWorks() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest("Mình muốn hỏi về màu sắc này.", imageId))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("IMAGE"))
                .andExpect(jsonPath("$.content").value("Mình muốn hỏi về màu sắc này."))
                .andExpect(jsonPath("$.imageUrl").value("/api/v1/chat-images/" + imageId));
    }

    @Test
    @DisplayName("Empty request without image is rejected")
    void emptyMessageWithoutImageRejected() throws Exception {
        Conversation conversation = createConversation();

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("text or an image")));
    }

    @Test
    @DisplayName("Whitespace-only content without image is rejected")
    void whitespaceOnlyMessageWithoutImageRejected() throws Exception {
        Conversation conversation = createConversation();

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest("     "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("text or an image")));
    }

    @Test
    @DisplayName("Caption longer than 2000 characters is rejected")
    void captionTooLongRejected() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest("a".repeat(2001), imageId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Unknown image id is rejected with 404")
    void unknownImageIdRejected() throws Exception {
        Conversation conversation = createConversation();

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Image owned by another user cannot be attached")
    void otherUsersImageRejected() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());

        // Alice (conversation owner) attempts to attach Bob's upload.
        sendMessage(conversation.getId(), aliceToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isForbidden());

        assertThat(registryEntry(upload).isBound()).isFalse();
    }

    @Test
    @DisplayName("Already-bound image cannot be reused")
    void alreadyBoundImageRejected() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isCreated());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("already been attached")));

        assertThat(chatMessageRepository.findByConversationId(conversation.getId(), org.springframework.data.domain.Pageable.unpaged()))
                .hasSize(1);
    }

    @Test
    @DisplayName("GENERAL upload cannot be attached as a chat image")
    void generalPurposeUploadCannotBeAttached() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, null);
        UUID imageId = UUID.fromString(upload.get("id").asText());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("not a chat attachment")));
    }

    // -------------------------------------------------------------------------
    // 3. Protected retrieval
    // -------------------------------------------------------------------------

    private JsonNode createBoundImageMessage(Conversation conversation) throws Exception {
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());
        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isCreated());
        return upload;
    }

    @Test
    @DisplayName("Conversation owner and requester can retrieve the chat image")
    void participantsCanRetrieveChatImage() throws Exception {
        Conversation conversation = createConversation();
        byte[] png = createValidImage("png", 32, 32);
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", png);

        String body = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .param("purpose", "CHAT")
                        .header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode upload = objectMapper.readTree(body);
        uploadedFilenames.add(upload.get("filename").asText());
        UUID imageId = UUID.fromString(upload.get("id").asText());

        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/chat-images/{id}", imageId).header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"))
                .andExpect(content().bytes(png));

        mockMvc.perform(get("/api/v1/chat-images/{id}", imageId).header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(content().bytes(png));
    }

    @Test
    @DisplayName("Non-participant, admin and anonymous callers are denied")
    void nonParticipantsDeniedChatImage() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = createBoundImageMessage(conversation);
        UUID imageId = UUID.fromString(upload.get("id").asText());

        mockMvc.perform(get("/api/v1/chat-images/{id}", imageId).header(HttpHeaders.AUTHORIZATION, charlieToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/chat-images/{id}", imageId).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/chat-images/{id}", imageId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Unknown and unbound images return 404")
    void unknownAndUnboundImagesReturn404() throws Exception {
        mockMvc.perform(get("/api/v1/chat-images/{id}", UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isNotFound());

        JsonNode unbound = uploadImage(bobToken, "CHAT");
        UUID unboundId = UUID.fromString(unbound.get("id").asText());

        mockMvc.perform(get("/api/v1/chat-images/{id}", unboundId).header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Missing physical chat image returns 404")
    void missingPhysicalFileReturns404() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = createBoundImageMessage(conversation);
        UUID imageId = UUID.fromString(upload.get("id").asText());

        Files.deleteIfExists(localStorageService.getRootPath().resolve(upload.get("filename").asText()));

        mockMvc.perform(get("/api/v1/chat-images/{id}", imageId).header(HttpHeaders.AUTHORIZATION, bobToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Bound chat files are not exposed through the public raw file endpoint")
    void boundChatFileNotPublic() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = createBoundImageMessage(conversation);
        String filename = upload.get("filename").asText();

        mockMvc.perform(get("/api/v1/files/{filename}", filename))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Unbound and GENERAL uploads remain publicly retrievable")
    void unboundAndGeneralUploadsRemainPublic() throws Exception {
        JsonNode unboundChat = uploadImage(bobToken, "CHAT");
        mockMvc.perform(get("/api/v1/files/{filename}", unboundChat.get("filename").asText()))
                .andExpect(status().isOk());

        JsonNode general = uploadImage(bobToken, null);
        mockMvc.perform(get("/api/v1/files/{filename}", general.get("filename").asText()))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------------------
    // 4. Preview and notification compatibility
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("Image-only message produces the [Hình ảnh] preview in details and list")
    void imageOnlyPreview() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());
        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/conversations/{id}", conversation.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastMessagePreview").value("[Hình ảnh]"));

        mockMvc.perform(get("/api/v1/conversations").header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].lastMessagePreview").value("[Hình ảnh]"));
    }

    @Test
    @DisplayName("Image with caption keeps the caption as conversation preview")
    void imageWithCaptionPreview() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());
        sendMessage(conversation.getId(), bobToken, new SendMessageRequest("Màu này còn không?", imageId))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/conversations/{id}", conversation.getId())
                        .header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastMessagePreview").value("Màu này còn không?"));

        mockMvc.perform(get("/api/v1/conversations").header(HttpHeaders.AUTHORIZATION, aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].lastMessagePreview").value("Màu này còn không?"));
    }

    @Test
    @DisplayName("Image-only message still notifies the partner without leaking the image URL or content")
    void imageOnlyMessageCreatesSafeNotification() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());
        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(null, imageId))
                .andExpect(status().isCreated());

        List<Notification> aliceNotifications = notificationRepository
                .findByRecipientId(ownerAlice.getId(), null).getContent();
        assertThat(aliceNotifications).hasSize(1);

        Notification notification = aliceNotifications.get(0);
        assertThat(notification.getType()).isEqualTo(NotificationType.CHAT_MESSAGE);
        assertThat(notification.getReferenceType()).isEqualTo("CONVERSATION");
        assertThat(notification.getReferenceId()).isEqualTo(conversation.getId());
        assertThat(notification.getMessage()).contains("Bob Requester");
        assertThat(notification.getMessage()).doesNotContain("chat-images");
        assertThat(notification.getMessage()).doesNotContain(imageId.toString());
        assertThat(notification.getMessage()).doesNotContain(upload.get("filename").asText());

        assertThat(notificationRepository.findByRecipientId(requesterBob.getId(), null).getContent()).isEmpty();
    }

    @Test
    @DisplayName("Image with caption notification does not leak the caption")
    void imageWithCaptionNotificationDoesNotLeakCaption() throws Exception {
        Conversation conversation = createConversation();
        JsonNode upload = uploadImage(bobToken, "CHAT");
        UUID imageId = UUID.fromString(upload.get("id").asText());
        String caption = "Nội dung riêng tư không được lộ";
        sendMessage(conversation.getId(), bobToken, new SendMessageRequest(caption, imageId))
                .andExpect(status().isCreated());

        List<Notification> aliceNotifications = notificationRepository
                .findByRecipientId(ownerAlice.getId(), null).getContent();
        assertThat(aliceNotifications).hasSize(1);
        assertThat(aliceNotifications.get(0).getMessage()).doesNotContain(caption);
        assertThat(aliceNotifications.get(0).getMessage()).doesNotContain("chat-images");
    }
}
