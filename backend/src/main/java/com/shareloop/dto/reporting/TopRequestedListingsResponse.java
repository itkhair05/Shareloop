package com.shareloop.dto.reporting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Top requested listings for the requested period")
public record TopRequestedListingsResponse(
        @Schema(description = "Requested reporting period")
        ReportPeriodResponse period,

        @Schema(description = "Maximum number of listings returned", example = "10")
        int limit,

        @Schema(description = "Request statuses counted by the documented business rule")
        List<String> countedRequestStatuses,

        @Schema(description = "Listings ordered by request count descending, then listing ID ascending")
        List<TopRequestedListingItem> listings
) {
}
