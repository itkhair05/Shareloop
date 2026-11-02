package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Zero-filled time-series reporting response")
public record ReportTimeseriesResponse(
        @Schema(description = "Metric identifier", example = "USER_REGISTRATIONS")
        String metric,

        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Bucket granularity", example = "DAY")
        String granularity,

        @Schema(description = "Chronologically ordered buckets, including zero-value buckets")
        List<ReportTimeseriesPoint> points
) {
}
