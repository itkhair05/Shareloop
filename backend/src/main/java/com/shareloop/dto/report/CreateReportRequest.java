package com.shareloop.dto.report;

import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportTargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public class CreateReportRequest {

    @NotNull(message = "Target type is required")
    private ReportTargetType targetType;

    @NotNull(message = "Target ID is required")
    private UUID targetId;

    @NotNull(message = "Category is required")
    private ReportCategory category;

    @NotBlank(message = "Description is required")
    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    @Size(max = 5, message = "A report can have at most 5 attachments")
    private List<UUID> imageIds;

    public CreateReportRequest() {
    }

    public CreateReportRequest(ReportTargetType targetType, UUID targetId, ReportCategory category, String description) {
        this.targetType = targetType;
        this.targetId = targetId;
        this.category = category;
        this.description = description;
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

    public List<UUID> getImageIds() {
        return imageIds;
    }

    public void setImageIds(List<UUID> imageIds) {
        this.imageIds = imageIds;
    }
}
