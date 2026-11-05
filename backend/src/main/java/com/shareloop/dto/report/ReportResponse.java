package com.shareloop.dto.report;

import com.shareloop.dto.attachment.AttachmentResponse;
import com.shareloop.entity.Report;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class ReportResponse {

    private UUID id;
    private UUID reporterId;
    private String reporterDisplayName;
    private String reporterAvatarUrl;
    private ReportTargetType targetType;
    private UUID targetId;
    private ReportCategory category;
    private String description;
    private ReportStatus status;
    private Instant resolvedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private List<AttachmentResponse> images = new ArrayList<>();

    public ReportResponse() {
    }

    public static ReportResponse fromEntity(Report entity) {
        return fromEntity(entity, List.of());
    }

    public static ReportResponse fromEntity(Report entity, List<AttachmentResponse> images) {
        ReportResponse response = new ReportResponse();
        response.setId(entity.getId());
        if (entity.getReporter() != null) {
            response.setReporterId(entity.getReporter().getId());
            response.setReporterDisplayName(entity.getReporter().getDisplayName());
            response.setReporterAvatarUrl(entity.getReporter().getEffectiveAvatarUrl());
        }
        response.setTargetType(entity.getTargetType());
        response.setTargetId(entity.getTargetId());
        response.setCategory(entity.getCategory());
        response.setDescription(entity.getDescription());
        response.setStatus(entity.getStatus());
        response.setResolvedAt(entity.getResolvedAt());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        response.setImages(images);
        return response;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getReporterId() {
        return reporterId;
    }

    public void setReporterId(UUID reporterId) {
        this.reporterId = reporterId;
    }

    public String getReporterDisplayName() {
        return reporterDisplayName;
    }

    public void setReporterDisplayName(String reporterDisplayName) {
        this.reporterDisplayName = reporterDisplayName;
    }

    public String getReporterAvatarUrl() {
        return reporterAvatarUrl;
    }

    public void setReporterAvatarUrl(String reporterAvatarUrl) {
        this.reporterAvatarUrl = reporterAvatarUrl;
    }

    public ReportTargetType getTargetType() {
        return targetType;
    }

    public void setTargetType(ReportTargetType targetType) {
        this.targetType = targetType;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public void setTargetId(UUID targetId) {
        this.targetId = targetId;
    }

    public ReportCategory getCategory() {
        return category;
    }

    public void setCategory(ReportCategory category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ReportStatus getStatus() {
        return status;
    }

    public void setStatus(ReportStatus status) {
        this.status = status;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<AttachmentResponse> getImages() {
        return images;
    }

    public void setImages(List<AttachmentResponse> images) {
        this.images = images != null ? new ArrayList<>(images) : new ArrayList<>();
    }
}
