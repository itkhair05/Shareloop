package com.shareloop.controller;

import com.shareloop.dto.chat.ChatMessageResponse;
import com.shareloop.dto.chat.ConversationResponse;
import com.shareloop.dto.chat.CreateConversationRequest;
import com.shareloop.dto.chat.SendMessageRequest;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    /**
     * Create or retrieve a canonical conversation between the authenticated requester and listing owner.
     */
    @PostMapping("/api/v1/listings/{listingId}/conversations")
    public ResponseEntity<ConversationResponse> getOrCreateConversation(
            @PathVariable UUID listingId,
            @Valid @RequestBody(required = false) CreateConversationRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ConversationResponse response = chatService.getOrCreateConversation(listingId, request, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * List all conversations for the authenticated user (as owner or requester).
     */
    @GetMapping("/api/v1/conversations")
    public ResponseEntity<Page<ConversationResponse>> getUserConversations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ConversationResponse> response = chatService.getUserConversations(page, size, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Get conversation header and details.
     */
    @GetMapping("/api/v1/conversations/{conversationId}")
    public ResponseEntity<ConversationResponse> getConversationDetails(
            @PathVariable UUID conversationId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ConversationResponse response = chatService.getConversationDetails(conversationId, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Send a message in a conversation.
     */
    @PostMapping("/api/v1/conversations/{conversationId}/messages")
    public ResponseEntity<ChatMessageResponse> sendMessage(
            @PathVariable UUID conversationId,
            @Valid @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ChatMessageResponse response = chatService.sendMessage(conversationId, request, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Retrieve paginated message history for a conversation.
     */
    @GetMapping("/api/v1/conversations/{conversationId}/messages")
    public ResponseEntity<Page<ChatMessageResponse>> getMessageHistory(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<ChatMessageResponse> response = chatService.getMessageHistory(conversationId, page, size, principal);
        return ResponseEntity.ok(response);
    }
}
