package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Listings reporting summary")
public record ListingsSummaryResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Aggregated listing metrics")
        ListingsReportMetrics metrics,

        @Schema(
                description = "Explains that statuses are a current snapshot of listings created in the period",
                example = "Current status at query time for listings created within the requested period; status history is not recorded."
        )
        String statusSemantics
) {
}
