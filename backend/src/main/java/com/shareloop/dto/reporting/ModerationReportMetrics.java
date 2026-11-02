package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Moderation report metrics for reports created within the requested period")
public record ModerationReportMetrics(
        @Schema(description = "Total moderation reports created within the period and matching filters", example = "48")
        long totalReports,

        @Schema(description = "Current status distribution of the same reports")
        List<ReportDistributionItem> byStatus,

        @Schema(description = "Distribution by actual ReportCategory value")
        List<ReportDistributionItem> byCategory,

        @Schema(description = "Distribution by actual ReportTargetType value")
        List<ReportDistributionItem> byTargetType
) {
}
