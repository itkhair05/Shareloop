package com.shareloop.dto.chat;

import com.shareloop.entity.ChatMessage;

import java.time.Instant;
import java.util.UUID;

public class ChatMessageResponse {

    public static final String TYPE_TEXT = "TEXT";
    public static final String TYPE_IMAGE = "IMAGE";
    public static final String CHAT_IMAGE_URL_PREFIX = "/api/v1/chat-images/";

    private UUID id;
    private UUID conversationId;
    private UserSummaryDto sender;
    private String type;
    private String content;
    private String imageUrl;
    private Instant createdAt;

    public ChatMessageResponse() {
    }

    public ChatMessageResponse(
            UUID id,
            UUID conversationId,
            UserSummaryDto sender,
            String type,
            String content,
            String imageUrl,
            Instant createdAt
    ) {
        this.id = id;
        this.conversationId = conversationId;
        this.sender = sender;
        this.type = type;
        this.content = content;
        this.imageUrl = imageUrl;
        this.createdAt = createdAt;
    }

    public static ChatMessageResponse fromEntity(ChatMessage message) {
        if (message == null) {
            return null;
        }
        UUID imageFileId = message.getImageFileId();
        boolean hasImage = imageFileId != null;
        return new ChatMessageResponse(
                message.getId(),
                message.getConversation().getId(),
                UserSummaryDto.fromEntity(message.getSender()),
                hasImage ? TYPE_IMAGE : TYPE_TEXT,
                message.getContent(),
                hasImage ? CHAT_IMAGE_URL_PREFIX + imageFileId : null,
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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
