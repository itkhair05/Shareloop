package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Users reporting summary")
public record UsersSummaryResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Aggregated user metrics")
        UsersReportMetrics metrics,

        @Schema(
                description = "Explains that statuses are a current snapshot of users created in the period",
                example = "Current status at query time for users created within the requested period; not status at registration time."
        )
        String statusSemantics
) {
}
