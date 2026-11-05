package com.shareloop.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Ordered private evidence image attached to a moderation report.
 *
 * The file_id is both the primary key and the global binding key: a file can
 * belong to at most one attachment record. Evidence is retained across report
 * status changes; foreign keys use RESTRICT so rows cannot be removed implicitly.
 */
@Entity
@Table(name = "report_attachments")
public class ReportAttachment implements Persistable<UUID> {

    @Id
    @Column(name = "file_id", nullable = false, updatable = false)
    private UUID fileId;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "file_id", nullable = false, insertable = false, updatable = false)
    private UploadedFile uploadedFile;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private Report report;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

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

    public ReportAttachment() {
    }

    public ReportAttachment(Report report, UploadedFile uploadedFile, int displayOrder) {
        this.report = report;
        this.uploadedFile = uploadedFile;
        this.fileId = uploadedFile != null ? uploadedFile.getId() : null;
        this.displayOrder = displayOrder;
        this.createdAt = Instant.now();
        this.isNew = true;
    }

    @Override
    public UUID getId() {
        return fileId;
    }

    @Override
    public boolean isNew() {
        return isNew;
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

    public Report getReport() {
        return report;
    }

    public void setReport(Report report) {
        this.report = report;
    }

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
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
        if (!(o instanceof ReportAttachment that)) return false;
        return Objects.equals(fileId, that.fileId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fileId);
    }

    @Override
    public String toString() {
        return "ReportAttachment{" +
                "fileId=" + fileId +
                ", reportId=" + (report != null ? report.getId() : null) +
                ", displayOrder=" + displayOrder +
                '}';
    }
}
