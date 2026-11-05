package com.shareloop.dto.support;

import com.shareloop.dto.attachment.AttachmentResponse;
import com.shareloop.entity.SupportRequest;

import java.util.List;
import java.util.UUID;

public class AdminSupportRequestResponse extends SupportRequestResponse {

    private String requesterEmail;
    private String adminNotes;
    private UUID resolvedById;
    private String resolvedByDisplayName;

    public AdminSupportRequestResponse() {
    }

    public static AdminSupportRequestResponse fromEntity(SupportRequest entity) {
        return fromEntity(entity, List.of());
    }

    public static AdminSupportRequestResponse fromEntity(SupportRequest entity, List<AttachmentResponse> images) {
        AdminSupportRequestResponse response = new AdminSupportRequestResponse();
        response.setId(entity.getId());
        if (entity.getRequester() != null) {
            response.setRequesterId(entity.getRequester().getId());
            response.setRequesterDisplayName(entity.getRequester().getDisplayName());
            response.setRequesterEmail(entity.getRequester().getEmail());
        }
        if (entity.getTransaction() != null) {
            response.setTransactionId(entity.getTransaction().getId());
        }
        response.setCategory(entity.getCategory());
        response.setSubject(entity.getSubject());
        response.setDescription(entity.getDescription());
        response.setStatus(entity.getStatus());
        response.setAdminResponse(entity.getAdminResponse());
        response.setAdminNotes(entity.getAdminNotes());
        if (entity.getResolvedBy() != null) {
            response.setResolvedById(entity.getResolvedBy().getId());
            response.setResolvedByDisplayName(entity.getResolvedBy().getDisplayName());
        }
        response.setResolvedAt(entity.getResolvedAt());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        response.setImages(images);
        return response;
    }

    public String getRequesterEmail() {
        return requesterEmail;
    }

    public void setRequesterEmail(String requesterEmail) {
        this.requesterEmail = requesterEmail;
    }

    public String getAdminNotes() {
        return adminNotes;
    }

    public void setAdminNotes(String adminNotes) {
        this.adminNotes = adminNotes;
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
}
