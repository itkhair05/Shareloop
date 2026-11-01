package com.shareloop.service;

import com.shareloop.entity.ChatMessage;
import com.shareloop.entity.Conversation;
import com.shareloop.entity.UploadedFile;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ChatMessageRepository;
import com.shareloop.repository.ConversationRepository;
import com.shareloop.repository.UploadedFileRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.filestorage.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Private retrieval of chat image attachments.
 * Authorization is strictly conversation membership: admins and other
 * authenticated users are denied unless they are the owner or requester.
 */
@Service
public class ChatImageService {

    private final UploadedFileRepository uploadedFileRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ConversationRepository conversationRepository;
    private final FileStorageService fileStorageService;

    public ChatImageService(
            UploadedFileRepository uploadedFileRepository,
            ChatMessageRepository chatMessageRepository,
            ConversationRepository conversationRepository,
            FileStorageService fileStorageService
    ) {
        this.uploadedFileRepository = uploadedFileRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.conversationRepository = conversationRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public ChatImageResource loadImage(UUID imageId, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view chat images");
        }

        UploadedFile upload = uploadedFileRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat image not found with id: " + imageId));

        // Unbound uploads are not chat images and must not be served here.
        if (!upload.isBound()) {
            throw new ResourceNotFoundException("Chat image not found with id: " + imageId);
        }

        ChatMessage message = chatMessageRepository.findById(upload.getBoundMessageId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat image not found with id: " + imageId));

        Conversation conversation = conversationRepository.findById(message.getConversation().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat image not found with id: " + imageId));

        if (!conversation.isParticipant(principal.getId())) {
            throw new AccessDeniedException("You are not authorized to view this image");
        }

        Resource resource = fileStorageService.loadAsResource(upload.getFilename());
        return new ChatImageResource(resource, upload.getContentType(), upload.getFilename());
    }

    public record ChatImageResource(Resource resource, String contentType, String filename) {
    }
}
