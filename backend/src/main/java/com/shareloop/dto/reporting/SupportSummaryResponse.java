package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Support requests reporting summary")
public record SupportSummaryResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Period-scoped support request metrics for the creation cohort")
        SupportReportMetrics metrics,

        @Schema(
                description = "Explains that statuses are a current snapshot of requests created in the period",
                example = "Current status at query time for support requests created within the requested period; status history and resolution timestamps are not recorded."
        )
        String statusSemantics,

        @Schema(description = "System-wide current open workload; unaffected by period, status or category filters")
        SupportOpenWorkloadResponse currentOpenWorkload
) {
}
