package com.shareloop.dto.reporting;

import com.shareloop.service.reporting.ReportDateRange;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;

@Schema(description = "Normalized reporting period using [from, to) semantics")
public record ReportPeriodResponse(
        @Schema(description = "Inclusive local start date", example = "2026-10-03")
        LocalDate from,

        @Schema(description = "Exclusive local end date", example = "2026-11-02")
        LocalDate to,

        @Schema(description = "IANA timezone used to convert local boundaries", example = "Asia/Ho_Chi_Minh")
        String timezone,

        @Schema(description = "Inclusive start instant after timezone conversion", example = "2026-10-02T17:00:00Z")
        Instant fromInclusive,

        @Schema(description = "Exclusive end instant after timezone conversion", example = "2026-11-01T17:00:00Z")
        Instant toExclusive
) {

    public static ReportPeriodResponse from(ReportDateRange range) {
        return new ReportPeriodResponse(
                range.from(),
                range.to(),
                range.timezoneId(),
                range.fromInclusive(),
                range.toExclusive()
        );
    }
}
