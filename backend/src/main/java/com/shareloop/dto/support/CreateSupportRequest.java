package com.shareloop.dto.support;

import com.shareloop.entity.enums.SupportCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public class CreateSupportRequest {

    private UUID transactionId;

    @NotNull(message = "Category is required")
    private SupportCategory category;

    @NotBlank(message = "Subject is required")
    @Size(max = 200, message = "Subject must not exceed 200 characters")
    private String subject;

    @NotBlank(message = "Description is required")
    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    @Size(max = 5, message = "A support request can have at most 5 attachments")
    private List<UUID> imageIds;

    public CreateSupportRequest() {
    }

    public CreateSupportRequest(UUID transactionId, SupportCategory category, String subject, String description) {
        this.transactionId = transactionId;
        this.category = category;
        this.subject = subject;
        this.description = description;
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

    public List<UUID> getImageIds() {
        return imageIds;
    }

    public void setImageIds(List<UUID> imageIds) {
        this.imageIds = imageIds;
    }
}
