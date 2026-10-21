package com.shareloop.dto.chat;

import com.shareloop.entity.ChatMessage;

import java.time.Instant;
import java.util.UUID;

public class ChatMessageResponse {

    private UUID id;
    private UUID conversationId;
    private UserSummaryDto sender;
    private String content;
    private Instant createdAt;

    public ChatMessageResponse() {
    }

    public ChatMessageResponse(UUID id, UUID conversationId, UserSummaryDto sender, String content, Instant createdAt) {
        this.id = id;
        this.conversationId = conversationId;
        this.sender = sender;
        this.content = content;
        this.createdAt = createdAt;
    }

    public static ChatMessageResponse fromEntity(ChatMessage message) {
        if (message == null) {
            return null;
        }
        return new ChatMessageResponse(
                message.getId(),
                message.getConversation().getId(),
                UserSummaryDto.fromEntity(message.getSender()),
                message.getContent(),
                message.getCreatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public void setConversationId(UUID conversationId) {
        this.conversationId = conversationId;
    }

    public UserSummaryDto getSender() {
        return sender;
    }

    public void setSender(UserSummaryDto sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
