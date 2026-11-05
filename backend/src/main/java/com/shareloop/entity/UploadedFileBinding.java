package com.shareloop.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Entity representing a globally exclusive binding between an uploaded file and a domain entity
 * (Chat message, Review, Moderation Report, Support Request, etc.).
 *
 * Exclusivity guarantee:
 * file_id is the primary key, strictly preventing a file from being bound to more than one
 * domain entity globally across the entire platform.
 */
@Entity
@Table(name = "uploaded_file_bindings")
public class UploadedFileBinding implements Persistable<UUID> {

    @Id
    @Column(name = "file_id", nullable = false, updatable = false)
    private UUID fileId;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "file_id", nullable = false)
    private UploadedFile uploadedFile;

    @NotNull
    @Size(max = 32)
    @Column(name = "bound_domain", nullable = false, length = 32)
    private String boundDomain;

    @NotNull
    @Column(name = "bound_entity_id", nullable = false)
    private UUID boundEntityId;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bound_by_id", nullable = false)
    private User boundBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Transient
    private boolean isNew = true;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    @Override
    public UUID getId() {
        return fileId;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    public UploadedFileBinding() {
    }

    public UploadedFileBinding(UploadedFile uploadedFile, String boundDomain, UUID boundEntityId, User boundBy) {
        this.uploadedFile = uploadedFile;
        this.fileId = uploadedFile != null ? uploadedFile.getId() : null;
        this.boundDomain = boundDomain;
        this.boundEntityId = boundEntityId;
        this.boundBy = boundBy;
        this.createdAt = Instant.now();
        this.isNew = true;
    }

    public UUID getFileId() {
        return fileId;
    }

    public void setFileId(UUID fileId) {
        this.fileId = fileId;
    }

    public UploadedFile getUploadedFile() {
        return uploadedFile;
    }

    public void setUploadedFile(UploadedFile uploadedFile) {
        this.uploadedFile = uploadedFile;
        this.fileId = uploadedFile != null ? uploadedFile.getId() : null;
    }

    public String getBoundDomain() {
        return boundDomain;
    }

    public void setBoundDomain(String boundDomain) {
        this.boundDomain = boundDomain;
    }

    public UUID getBoundEntityId() {
        return boundEntityId;
    }

    public void setBoundEntityId(UUID boundEntityId) {
        this.boundEntityId = boundEntityId;
    }

    public User getBoundBy() {
        return boundBy;
    }

    public void setBoundBy(User boundBy) {
        this.boundBy = boundBy;
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
        if (!(o instanceof UploadedFileBinding that)) return false;
        return Objects.equals(fileId, that.fileId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fileId);
    }

    @Override
    public String toString() {
        return "UploadedFileBinding{" +
                "fileId=" + fileId +
                ", boundDomain='" + boundDomain + '\'' +
                ", boundEntityId=" + boundEntityId +
                ", boundBy=" + (boundBy != null ? boundBy.getId() : null) +
                ", createdAt=" + createdAt +
                '}';
    }
}
