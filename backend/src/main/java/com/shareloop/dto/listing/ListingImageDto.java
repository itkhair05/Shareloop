package com.shareloop.dto.listing;

import com.shareloop.entity.ListingImage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public class ListingImageDto {

    private UUID id;

    @NotBlank(message = "Image URL is required")
    @Size(max = 1024, message = "Image URL must not exceed 1024 characters")
    private String imageUrl;

    private Integer sortOrder = 0;

    public ListingImageDto() {
    }

    public ListingImageDto(String imageUrl, Integer sortOrder) {
        this.imageUrl = imageUrl;
        this.sortOrder = sortOrder != null ? sortOrder : 0;
    }

    public ListingImageDto(UUID id, String imageUrl, Integer sortOrder) {
        this.id = id;
        this.imageUrl = imageUrl;
        this.sortOrder = sortOrder != null ? sortOrder : 0;
    }

    public static ListingImageDto fromEntity(ListingImage entity) {
        if (entity == null) {
            return null;
        }
        return new ListingImageDto(
                entity.getId(),
                entity.getImageUrl(),
                entity.getSortOrder()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
