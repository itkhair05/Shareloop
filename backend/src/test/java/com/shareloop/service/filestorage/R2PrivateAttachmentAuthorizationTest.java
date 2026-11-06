package com.shareloop.service.filestorage;

import com.shareloop.config.StorageProperties;
import com.shareloop.entity.ChatMessage;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.Report;
import com.shareloop.entity.ReportAttachment;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ChatMessageRepository;
import com.shareloop.repository.ConversationRepository;
import com.shareloop.repository.ReportAttachmentRepository;
import com.shareloop.repository.ReviewImageRepository;
import com.shareloop.repository.SupportRequestAttachmentRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ChatImageService;
import com.shareloop.service.DomainAttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.io.ByteArrayInputStream;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Verifies that replacing the storage backend with R2 does not change any private
 * attachment authorization decision. Unauthorized callers are rejected before any
 * object read; authorized callers stream the object through the backend.
 */
@ExtendWith(MockitoExtension.class)
class R2PrivateAttachmentAuthorizationTest {

    private static final byte[] CONTENT = "private-image-content".getBytes();

    @Mock
    private S3Client s3Client;

    @Mock
    private UploadedFileRepository uploadedFileRepository;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private ReviewImageRepository reviewImageRepository;

    @Mock
    private ReportAttachmentRepository reportAttachmentRepository;

    @Mock
    private SupportRequestAttachmentRepository supportRequestAttachmentRepository;

    private R2StorageService storageService;
    private ChatImageService chatImageService;
    private DomainAttachmentService domainAttachmentService;

    private final UUID fileId = UUID.randomUUID();
    private final String filename = fileId + ".png";

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties();
        properties.setProvider("r2");
        properties.getR2().setEndpoint("https://account-id.r2.cloudflarestorage.com");
        properties.getR2().setBucketName("shareloop-private");
        properties.getR2().setAccessKeyId("test-access-key-id");
        properties.getR2().setSecretAccessKey("test-secret-access-key");

        storageService = new R2StorageService(properties, s3Client);
        chatImageService = new ChatImageService(
                uploadedFileRepository, chatMessageRepository, conversationRepository, storageService);
        domainAttachmentService = new DomainAttachmentService(
                reviewImageRepository, reportAttachmentRepository, supportRequestAttachmentRepository, storageService);
    }

    private User user(String name, String email) {
        User user = new User(name, email, "hash", UserRole.USER, UserStatus.ACTIVE);
        user.setId(UUID.randomUUID());
        return user;
    }

    private ResponseInputStream<GetObjectResponse> objectStream() {
        GetObjectResponse response = GetObjectResponse.builder()
                .contentLength((long) CONTENT.length)
                .contentType("image/png")
                .build();
        return new ResponseInputStream<>(response, AbortableInputStream.create(new ByteArrayInputStream(CONTENT)));
    }

    private UploadedFile chatUpload() {
        UploadedFile upload = new UploadedFile(
                fileId, filename, user("Owner", "owner@example.com"), "image/png", CONTENT.length, UploadPurpose.CHAT);
        upload.setBoundMessageId(UUID.randomUUID());
        return upload;
    }

    @Test
    @DisplayName("Chat: a non-participant is denied before any R2 object is read")
    void chatImageNonParticipantDenied() {
        UploadedFile upload = chatUpload();
        ChatMessage message = mock(ChatMessage.class);
        Conversation conversation = mock(Conversation.class);
        UUID conversationId = UUID.randomUUID();
        UUID callerId = UUID.randomUUID();

        when(uploadedFileRepository.findById(fileId)).thenReturn(Optional.of(upload));
        when(chatMessageRepository.findById(upload.getBoundMessageId())).thenReturn(Optional.of(message));
        when(message.getConversation()).thenReturn(conversation);
        when(conversation.getId()).thenReturn(conversationId);
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversation.isParticipant(callerId)).thenReturn(false);

        UserPrincipal caller = mock(UserPrincipal.class);
        when(caller.getId()).thenReturn(callerId);

        assertThatThrownBy(() -> chatImageService.loadImage(fileId, caller))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(s3Client);
    }

    @Test
    @DisplayName("Chat: a participant streams the object through the backend")
    void chatImageParticipantStreams() throws Exception {
        UploadedFile upload = chatUpload();
        ChatMessage message = mock(ChatMessage.class);
        Conversation conversation = mock(Conversation.class);
        UUID conversationId = UUID.randomUUID();
        UUID callerId = UUID.randomUUID();

        when(uploadedFileRepository.findById(fileId)).thenReturn(Optional.of(upload));
        when(chatMessageRepository.findById(upload.getBoundMessageId())).thenReturn(Optional.of(message));
        when(message.getConversation()).thenReturn(conversation);
        when(conversation.getId()).thenReturn(conversationId);
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversation.isParticipant(callerId)).thenReturn(true);
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(objectStream());

        UserPrincipal caller = mock(UserPrincipal.class);
        when(caller.getId()).thenReturn(callerId);

        ChatImageService.ChatImageResource image = chatImageService.loadImage(fileId, caller);

        assertThat(image.contentType()).isEqualTo("image/png");
        assertThat(image.filename()).isEqualTo(filename);
        assertThat(image.resource().getInputStream().readAllBytes()).isEqualTo(CONTENT);
        verify(s3Client).getObject(any(GetObjectRequest.class));
    }

    @Test
    @DisplayName("Report evidence: a non-reporter, non-admin caller receives 404 without touching R2")
    void reportAttachmentUnauthorizedHidden() {
        User reporter = user("Reporter", "reporter@example.com");
        Report report = mock(Report.class);
        when(report.getReporter()).thenReturn(reporter);

        ReportAttachment attachment = mock(ReportAttachment.class);
        when(attachment.getReport()).thenReturn(report);
        when(reportAttachmentRepository.findByFileId(fileId)).thenReturn(Optional.of(attachment));

        UserPrincipal caller = mock(UserPrincipal.class);
        when(caller.getId()).thenReturn(UUID.randomUUID());
        when(caller.getRole()).thenReturn(UserRole.USER);

        assertThatThrownBy(() -> domainAttachmentService.loadReportAttachment(fileId, caller))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(s3Client);
    }

    @Test
    @DisplayName("Report evidence: an administrator streams the object through the backend")
    void reportAttachmentAdminStreams() throws Exception {
        Report report = mock(Report.class);
        when(report.getReporter()).thenReturn(user("Reporter", "reporter@example.com"));

        UploadedFile upload = new UploadedFile(
                fileId, filename, user("Reporter", "reporter@example.com"), "image/png", CONTENT.length, UploadPurpose.REPORT);
        ReportAttachment attachment = mock(ReportAttachment.class);
        when(attachment.getReport()).thenReturn(report);
        when(attachment.getUploadedFile()).thenReturn(upload);
        when(reportAttachmentRepository.findByFileId(fileId)).thenReturn(Optional.of(attachment));
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(objectStream());

        UserPrincipal admin = mock(UserPrincipal.class);
        when(admin.getId()).thenReturn(UUID.randomUUID());
        when(admin.getRole()).thenReturn(UserRole.ADMIN);

        DomainAttachmentService.AttachmentResource resource =
                domainAttachmentService.loadReportAttachment(fileId, admin);

        assertThat(resource.contentType()).isEqualTo("image/png");
        assertThat(resource.filename()).isEqualTo(filename);
        assertThat(resource.resource().getInputStream().readAllBytes()).isEqualTo(CONTENT);
        verify(s3Client).getObject(any(GetObjectRequest.class));
    }
}
