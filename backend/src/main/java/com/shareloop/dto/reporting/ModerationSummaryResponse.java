package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Moderation reports reporting summary")
public record ModerationSummaryResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Aggregated moderation report metrics")
        ModerationReportMetrics metrics,

        @Schema(
                description = "Explains that statuses are a current snapshot of reports created in the period",
                example = "Current status at query time for moderation reports created within the requested period; status history and resolution timestamps are not recorded."
        )
        String statusSemantics
) {
}
