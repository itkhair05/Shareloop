package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Period-scoped system overview covering all six reporting domains")
public record ReportingOverviewResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(
                description = "Domains included in this response",
                example = "[\"USERS\", \"LISTINGS\", \"TRANSACTIONS\", \"MODERATION\", \"REVIEWS\", \"SUPPORT\"]"
        )
        List<String> includedDomains,

        @Schema(description = "Metrics included in this response")
        List<String> includedMetrics,

        @Schema(description = "Aggregated user metrics")
        UsersReportMetrics users,

        @Schema(description = "Aggregated listing metrics")
        ListingsReportMetrics listings,

        @Schema(description = "Aggregated transaction metrics")
        TransactionsReportMetrics transactions,

        @Schema(description = "Aggregated moderation report metrics")
        ModerationReportMetrics moderation,

        @Schema(description = "Aggregated review metrics")
        ReviewsReportMetrics reviews,

        @Schema(description = "Aggregated period-scoped support request metrics")
        SupportReportMetrics support,

        @Schema(description = "Explicit scope disclaimer")
        String disclaimer
) {
}
