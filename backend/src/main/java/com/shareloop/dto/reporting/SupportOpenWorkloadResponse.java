package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Current system-wide open support workload; not scoped to the reporting period")
public record SupportOpenWorkloadResponse(
        @Schema(description = "Timestamp at which the workload snapshot was taken")
        Instant asOf,

        @Schema(
                description = "Explicit workload scope; always CURRENT_SYSTEM_WIDE_ALL_DATES",
                example = "CURRENT_SYSTEM_WIDE_ALL_DATES"
        )
        String scope,

        @Schema(description = "All support requests currently in PENDING status across all dates", example = "7")
        long pending,

        @Schema(description = "All support requests currently in IN_PROGRESS status across all dates", example = "3")
        long inProgress,

        @Schema(description = "Total open requests; always pending + inProgress", example = "10")
        long totalOpen
) {
}
