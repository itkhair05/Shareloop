package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Reviews reporting summary")
public record ReviewsSummaryResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Aggregated review metrics")
        ReviewsReportMetrics metrics,

        @Schema(
                description = "Explains that visibility is a current snapshot of reviews created in the period",
                example = "Counts all reviews created within the requested period. Visibility is the current state at query time; historical visibility is not recorded. averageRatingVisible is the public-facing average and averageRatingAll is an admin-only supplemental metric."
        )
        String visibilitySemantics
) {
}
