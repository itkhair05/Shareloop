package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Listing metrics for listings created within the requested period")
public record ListingsReportMetrics(
        @Schema(description = "Total listings created within the period and matching filters", example = "320")
        long totalListings,

        @Schema(description = "Current status distribution of the same listings")
        List<ReportDistributionItem> byStatus,

        @Schema(description = "Distribution by actual ListingType value")
        List<ReportDistributionItem> byType,

        @Schema(description = "Distribution by category; only categories with listings in the period are returned")
        List<CategoryDistributionItem> byCategory
) {
}
