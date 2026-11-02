package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "Single time-series bucket")
public record ReportTimeseriesPoint(
        @Schema(description = "Bucket start date in the requested timezone", example = "2026-10-03")
        LocalDate bucketStart,

        @Schema(description = "Metric value for the bucket", example = "12")
        long value
) {
}
