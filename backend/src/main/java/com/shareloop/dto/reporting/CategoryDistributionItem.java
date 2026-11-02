package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(description = "Listing distribution entry grouped by category")
public record CategoryDistributionItem(
        @Schema(description = "Category identifier")
        UUID categoryId,

        @Schema(description = "Category display name", example = "Điện tử & Đồ gia dụng")
        String categoryName,

        @Schema(description = "Number of listings in this category", example = "37")
        long value
) {
}
