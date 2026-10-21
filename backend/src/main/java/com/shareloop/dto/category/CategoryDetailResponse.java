package com.shareloop.dto.category;

import com.shareloop.entity.Category;

import java.time.Instant;
import java.util.UUID;

public class CategoryDetailResponse {

    private UUID id;
    private String name;
    private String slug;
    private String description;
    private Boolean isActive;
    private long activeListingCount;
    private Instant createdAt;
    private Instant updatedAt;

    public CategoryDetailResponse() {
    }

    public CategoryDetailResponse(
            UUID id,
            String name,
            String slug,
            String description,
            Boolean isActive,
            long activeListingCount,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.description = description;
        this.isActive = isActive;
        this.activeListingCount = activeListingCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static CategoryDetailResponse fromEntity(Category category, long activeListingCount) {
        if (category == null) {
            return null;
        }
        return new CategoryDetailResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                category.getIsActive(),
                activeListingCount,
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public long getActiveListingCount() {
        return activeListingCount;
    }

    public void setActiveListingCount(long activeListingCount) {
        this.activeListingCount = activeListingCount;
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
}
