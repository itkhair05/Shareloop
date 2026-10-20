package com.shareloop.dto.listing;

import com.shareloop.entity.Category;

import java.util.UUID;

public class CategorySummaryDto {

    private UUID id;
    private String name;
    private String slug;

    public CategorySummaryDto() {
    }

    public CategorySummaryDto(UUID id, String name, String slug) {
        this.id = id;
        this.name = name;
        this.slug = slug;
    }

    public static CategorySummaryDto fromEntity(Category category) {
        if (category == null) {
            return null;
        }
        return new CategorySummaryDto(
                category.getId(),
                category.getName(),
                category.getSlug()
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
}
