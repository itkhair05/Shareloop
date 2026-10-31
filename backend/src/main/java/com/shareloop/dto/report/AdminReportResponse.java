package com.shareloop.dto.report;

import com.shareloop.entity.Report;
import com.shareloop.entity.User;

import java.util.UUID;

public class AdminReportResponse extends ReportResponse {

    private String reporterEmail;
    private String resolutionNotes;
    private UUID resolvedById;
    private String resolvedByDisplayName;
    private String targetUserDisplayName;
    private String targetUserAvatarUrl;

    public AdminReportResponse() {
    }

    public static AdminReportResponse fromEntity(Report entity) {
        return fromEntity(entity, null);
    }

    public static AdminReportResponse fromEntity(Report entity, User targetUser) {
        AdminReportResponse response = new AdminReportResponse();
        response.setId(entity.getId());
        if (entity.getReporter() != null) {
            response.setReporterId(entity.getReporter().getId());
            response.setReporterDisplayName(entity.getReporter().getDisplayName());
            response.setReporterAvatarUrl(entity.getReporter().getEffectiveAvatarUrl());
            response.setReporterEmail(entity.getReporter().getEmail());
        }
        response.setTargetType(entity.getTargetType());
        response.setTargetId(entity.getTargetId());
        if (targetUser != null) {
            response.setTargetUserDisplayName(targetUser.getDisplayName());
            response.setTargetUserAvatarUrl(targetUser.getEffectiveAvatarUrl());
        }
        response.setCategory(entity.getCategory());
        response.setDescription(entity.getDescription());
        response.setStatus(entity.getStatus());
        response.setResolutionNotes(entity.getResolutionNotes());
        if (entity.getResolvedBy() != null) {
            response.setResolvedById(entity.getResolvedBy().getId());
            response.setResolvedByDisplayName(entity.getResolvedBy().getDisplayName());
        }
        response.setResolvedAt(entity.getResolvedAt());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    public String getReporterEmail() {
        return reporterEmail;
    }

    public void setReporterEmail(String reporterEmail) {
        this.reporterEmail = reporterEmail;
    }

    public String getResolutionNotes() {
        return resolutionNotes;
    }

    public void setResolutionNotes(String resolutionNotes) {
        this.resolutionNotes = resolutionNotes;
    }

    public UUID getResolvedById() {
        return resolvedById;
    }

    public void setResolvedById(UUID resolvedById) {
        this.resolvedById = resolvedById;
    }

    public String getResolvedByDisplayName() {
        return resolvedByDisplayName;
    }

    public void setResolvedByDisplayName(String resolvedByDisplayName) {
        this.resolvedByDisplayName = resolvedByDisplayName;
    }

    public String getTargetUserDisplayName() {
        return targetUserDisplayName;
    }

    public void setTargetUserDisplayName(String targetUserDisplayName) {
        this.targetUserDisplayName = targetUserDisplayName;
    }

    public String getTargetUserAvatarUrl() {
        return targetUserAvatarUrl;
    }

    public void setTargetUserAvatarUrl(String targetUserAvatarUrl) {
        this.targetUserAvatarUrl = targetUserAvatarUrl;
    }
}
