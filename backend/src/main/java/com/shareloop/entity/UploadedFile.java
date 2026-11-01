package com.shareloop.entity;

import com.shareloop.entity.enums.UploadPurpose;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "uploaded_files")
public class UploadedFile {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "filename", nullable = false, unique = true, length = 255)
    private String filename;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "content_type", nullable = false, length = 64)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, length = 16)
    private UploadPurpose purpose = UploadPurpose.GENERAL;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "bound_message_id", unique = true)
    private UUID boundMessageId;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (purpose == null) {
            purpose = UploadPurpose.GENERAL;
        }
    }

    public UploadedFile() {
    }

    public UploadedFile(UUID id, String filename, User owner, String contentType, long sizeBytes, UploadPurpose purpose) {
        this.id = id;
        this.filename = filename;
        this.owner = owner;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.purpose = purpose != null ? purpose : UploadPurpose.GENERAL;
    }

    public boolean isBound() {
        return boundMessageId != null;
    }

    /**
     * Binds this upload to a persisted message. Callers must validate ownership,
     * chat purpose and unbound state under a pessimistic lock beforehand.
     */
    public void bindTo(ChatMessage message) {
        if (message == null || message.getId() == null) {
            throw new IllegalArgumentException("Message must be persisted before binding an upload");
        }
        if (isBound()) {
            throw new IllegalStateException("Upload is already bound to a message");
        }
        this.boundMessageId = message.getId();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public UploadPurpose getPurpose() {
        return purpose;
    }

    public void setPurpose(UploadPurpose purpose) {
        this.purpose = purpose;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public UUID getBoundMessageId() {
        return boundMessageId;
    }

    public void setBoundMessageId(UUID boundMessageId) {
        this.boundMessageId = boundMessageId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UploadedFile that = (UploadedFile) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }

    @Override
    public String toString() {
        return "UploadedFile{" +
                "id=" + id +
                ", filename='" + filename + '\'' +
                ", purpose=" + purpose +
                ", boundMessageId=" + boundMessageId +
                '}';
    }
}
