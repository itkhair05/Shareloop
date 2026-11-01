package com.shareloop.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Size(max = 2000)
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_file_id")
    private UUID imageFileId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public ChatMessage() {
    }

    public ChatMessage(Conversation conversation, User sender, String content) {
        this(conversation, sender, content, null);
    }

    public ChatMessage(Conversation conversation, User sender, String content, UUID imageFileId) {
        this.conversation = conversation;
        this.sender = sender;
        this.content = normalizeContent(content);
        this.imageFileId = imageFileId;
        if (this.content == null && this.imageFileId == null) {
            throw new IllegalArgumentException("Message must contain text or an image");
        }
    }

    private static String normalizeContent(String content) {
        if (content == null) {
            return null;
        }
        String trimmed = content.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @AssertTrue(message = "Message must contain text or an image")
    public boolean isContentOrImagePresent() {
        return content != null || imageFileId != null;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Conversation getConversation() {
        return conversation;
    }

    public void setConversation(Conversation conversation) {
        this.conversation = conversation;
    }

    public User getSender() {
        return sender;
    }

    public void setSender(User sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = normalizeContent(content);
    }

    public UUID getImageFileId() {
        return imageFileId;
    }

    public void setImageFileId(UUID imageFileId) {
        this.imageFileId = imageFileId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChatMessage that = (ChatMessage) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "ChatMessage{" +
                "id=" + id +
                ", content='" + content + '\'' +
                ", imageFileId=" + imageFileId +
                ", createdAt=" + createdAt +
                '}';
    }
}
