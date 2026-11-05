package com.shareloop.dto.support;

import com.shareloop.dto.attachment.AttachmentResponse;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class SupportRequestResponse {

    private UUID id;
    private UUID requesterId;
    private String requesterDisplayName;
    private UUID transactionId;
    private SupportCategory category;
    private String subject;
    private String description;
    private SupportRequestStatus status;
    private String adminResponse;
    private Instant resolvedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private List<AttachmentResponse> images = new ArrayList<>();

    public SupportRequestResponse() {
    }

    public static SupportRequestResponse fromEntity(SupportRequest entity) {
        return fromEntity(entity, List.of());
    }

    public static SupportRequestResponse fromEntity(SupportRequest entity, List<AttachmentResponse> images) {
        SupportRequestResponse response = new SupportRequestResponse();
        response.setId(entity.getId());
        if (entity.getRequester() != null) {
            response.setRequesterId(entity.getRequester().getId());
            response.setRequesterDisplayName(entity.getRequester().getDisplayName());
        }
        if (entity.getTransaction() != null) {
            response.setTransactionId(entity.getTransaction().getId());
        }
        response.setCategory(entity.getCategory());
        response.setSubject(entity.getSubject());
        response.setDescription(entity.getDescription());
        response.setStatus(entity.getStatus());
        response.setAdminResponse(entity.getAdminResponse());
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

    public UUID getRequesterId() {
        return requesterId;
    }

    public void setRequesterId(UUID requesterId) {
        this.requesterId = requesterId;
    }

    public String getRequesterDisplayName() {
        return requesterDisplayName;
    }

    public void setRequesterDisplayName(String requesterDisplayName) {
        this.requesterDisplayName = requesterDisplayName;
    }

    public UUID getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(UUID transactionId) {
        this.transactionId = transactionId;
    }

    public SupportCategory getCategory() {
        return category;
    }

    public void setCategory(SupportCategory category) {
        this.category = category;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public SupportRequestStatus getStatus() {
        return status;
    }

    public void setStatus(SupportRequestStatus status) {
        this.status = status;
    }

    public String getAdminResponse() {
        return adminResponse;
    }

    public void setAdminResponse(String adminResponse) {
        this.adminResponse = adminResponse;
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
