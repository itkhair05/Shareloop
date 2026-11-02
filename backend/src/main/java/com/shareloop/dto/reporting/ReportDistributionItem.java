package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Distribution entry identified by the actual enum value")
public record ReportDistributionItem(
        @Schema(description = "Actual enum value, never an artificial bucket", example = "ACTIVE")
        String key,

        @Schema(description = "Number of records in this bucket", example = "142")
        long value
) {
}
