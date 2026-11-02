package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Transactions reporting summary")
public record TransactionsSummaryResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Aggregated transaction metrics")
        TransactionsReportMetrics metrics,

        @Schema(
                description = "Explains that statuses are a current snapshot of transactions created in the period",
                example = "Current status at query time for transactions created within the requested period; status history and completion timestamps are not recorded."
        )
        String statusSemantics
) {
}
