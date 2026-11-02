package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Phase 2 system overview limited to users and listings")
public record ReportingOverviewResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Domains included in this response", example = "[\"USERS\", \"LISTINGS\"]")
        List<String> includedDomains,

        @Schema(description = "Metrics included in this response")
        List<String> includedMetrics,

        @Schema(description = "Aggregated user metrics")
        UsersReportMetrics users,

        @Schema(description = "Aggregated listing metrics")
        ListingsReportMetrics listings,

        @Schema(description = "Explicit scope disclaimer")
        String disclaimer
) {
}
