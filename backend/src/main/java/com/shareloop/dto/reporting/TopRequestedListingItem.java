package com.shareloop.dto.reporting;

import com.shareloop.entity.enums.ListingType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(description = "Listing ranked by counted requests")
public record TopRequestedListingItem(
        @Schema(description = "Listing identifier")
        UUID listingId,

        @Schema(description = "Listing title", example = "Bàn phím cơ cũ")
        String title,

        @Schema(description = "Owner identifier")
        UUID ownerId,

        @Schema(description = "Owner display name", example = "Nguyễn Văn A")
        String ownerDisplayName,

        @Schema(description = "Category identifier")
        UUID categoryId,

        @Schema(description = "Category display name", example = "Điện tử & Đồ gia dụng")
        String categoryName,

        @Schema(description = "Actual listing type", example = "SALE")
        ListingType listingType,

        @Schema(description = "Number of requests in PENDING, ACCEPTED or REJECTED status", example = "8")
        long requestCount
) {
}
