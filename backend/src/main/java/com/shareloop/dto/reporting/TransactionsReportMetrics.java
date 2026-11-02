package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Transaction metrics for transactions created within the requested period")
public record TransactionsReportMetrics(
        @Schema(description = "Total transactions created within the period and matching filters", example = "95")
        long totalTransactions,

        @Schema(description = "Current status distribution of the same transactions")
        List<ReportDistributionItem> byStatus
) {
}
