package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Support request metrics for requests created within the requested period")
public record SupportReportMetrics(
        @Schema(description = "Total support requests created within the period and matching filters", example = "42")
        long totalSupportRequests,

        @Schema(description = "Current status distribution of the same requests")
        List<ReportDistributionItem> byCurrentStatus,

        @Schema(description = "Distribution by actual SupportCategory value")
        List<ReportDistributionItem> byCategory
) {
}
