package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Review metrics for reviews created within the requested period")
public record ReviewsReportMetrics(
        @Schema(description = "Total reviews created within the period, including currently hidden reviews", example = "64")
        long totalReviews,

        @Schema(description = "Reviews currently visible at query time", example = "60")
        long visibleReviews,

        @Schema(description = "Reviews currently hidden at query time", example = "4")
        long hiddenReviews,

        @Schema(description = "Public-facing average rating over currently visible reviews; null when there are none", example = "4.72", nullable = true)
        Double averageRatingVisible,

        @Schema(description = "Admin-only average rating over all reviews in the period; null when there are none", example = "4.61", nullable = true)
        Double averageRatingAll,

        @Schema(description = "Rating distribution over all reviews in the period; keys are 1 through 5 and include zero counts")
        List<ReportDistributionItem> ratingDistributionAll,

        @Schema(description = "Rating distribution over currently visible reviews; keys are 1 through 5 and include zero counts")
        List<ReportDistributionItem> ratingDistributionVisible
) {
}
