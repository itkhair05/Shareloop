package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "User metrics for users created within the requested period")
public record UsersReportMetrics(
        @Schema(description = "Total users created within the period and matching filters", example = "120")
        long totalUsers,

        @Schema(description = "Distribution by actual UserRole value")
        List<ReportDistributionItem> byRole,

        @Schema(description = "Current status distribution of the same users")
        List<ReportDistributionItem> byStatus
) {
}
