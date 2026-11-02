package com.shareloop.controller;

import com.shareloop.dto.reporting.ListingsSummaryResponse;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.ReportingOverviewResponse;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.dto.reporting.UsersSummaryResponse;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.service.reporting.AdminReportAggregationService;
import com.shareloop.service.reporting.AdminReportFilter;
import com.shareloop.service.reporting.ReportDateRange;
import com.shareloop.service.reporting.ReportGranularity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@Tag(
        name = "Admin Reporting",
        description = "Read-only aggregated reporting for users and listings (Phase 2)"
)
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/admin/reporting")
public class AdminReportingController {

    private static final String FROM_DESCRIPTION =
            "Inclusive local start date in ISO-8601 (yyyy-MM-dd), interpreted in the requested timezone. "
                    + "Defaults to 30 days before the effective 'to' date. The maximum supported range is 3660 days.";
    private static final String TO_DESCRIPTION =
            "Exclusive local end date in ISO-8601 (yyyy-MM-dd), interpreted in the requested timezone. "
                    + "Defaults to today's date in the requested timezone.";
    private static final String TIMEZONE_DESCRIPTION =
            "IANA timezone identifier used to convert local date boundaries to instants. Defaults to Asia/Ho_Chi_Minh. "
                    + "Unsupported identifiers return 400 Bad Request.";
    private static final String GRANULARITY_DESCRIPTION =
            "Bucket granularity: DAY, WEEK (ISO weeks starting Monday) or MONTH. Missing buckets are zero-filled and "
                    + "returned in chronological order. A series is limited to 1000 buckets; unsupported values return 400 Bad Request.";

    private final AdminReportAggregationService adminReportAggregationService;

    public AdminReportingController(AdminReportAggregationService adminReportAggregationService) {
        this.adminReportAggregationService = adminReportAggregationService;
    }

    @Operation(
            summary = "Get aggregated user reporting metrics (Admin only)",
            description = "Counts users created within the requested [from, to) period and returns distributions by the "
                    + "actual UserRole and UserStatus values. Status distribution reflects each user's current status at "
                    + "query time, not the status at registration time."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/users/summary")
    public ResponseEntity<UsersSummaryResponse> getUsersSummary(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Optional filter by current role (USER or ADMIN).")
            @RequestParam(required = false) UserRole role,

            @Parameter(description = "Optional filter by current status (ACTIVE, SUSPENDED or DEACTIVATED).")
            @RequestParam(required = false) UserStatus status
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getUsersSummary(
                AdminReportFilter.forUsers(range, role, status)
        ));
    }

    @Operation(
            summary = "Get user registration time series (Admin only)",
            description = "Returns user registration counts for the requested [from, to) period, aggregated in the "
                    + "database and zero-filled for every bucket in the period."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/users/timeseries")
    public ResponseEntity<ReportTimeseriesResponse> getUsersTimeseries(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = GRANULARITY_DESCRIPTION) @RequestParam(defaultValue = "DAY")
            ReportGranularity granularity
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getUsersTimeseries(range, granularity));
    }

    @Operation(
            summary = "Get aggregated listing reporting metrics (Admin only)",
            description = "Counts listings created within the requested [from, to) period and returns distributions by the "
                    + "actual ListingStatus, ListingType and category values. Status distribution reflects each listing's "
                    + "current status at query time; status history is not recorded, and no synthetic 'Other' bucket is added."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/listings/summary")
    public ResponseEntity<ListingsSummaryResponse> getListingsSummary(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Optional filter by current status (DRAFT, ACTIVE, RESERVED, COMPLETED, CANCELLED or REMOVED).")
            @RequestParam(required = false) ListingStatus status,

            @Parameter(description = "Optional filter by listing type (GIVEAWAY, SALE or WANTED).")
            @RequestParam(required = false) ListingType listingType,

            @Parameter(description = "Optional filter by category identifier.")
            @RequestParam(required = false) UUID categoryId
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getListingsSummary(
                AdminReportFilter.forListings(range, status, listingType, categoryId)
        ));
    }

    @Operation(
            summary = "Get listing creation time series (Admin only)",
            description = "Returns listing creation counts for the requested [from, to) period, aggregated in the "
                    + "database and zero-filled for every bucket in the period."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/listings/timeseries")
    public ResponseEntity<ReportTimeseriesResponse> getListingsTimeseries(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = GRANULARITY_DESCRIPTION) @RequestParam(defaultValue = "DAY")
            ReportGranularity granularity,

            @Parameter(description = "Optional filter by listing type (GIVEAWAY, SALE or WANTED).")
            @RequestParam(required = false) ListingType listingType,

            @Parameter(description = "Optional filter by category identifier.")
            @RequestParam(required = false) UUID categoryId
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getListingsTimeseries(
                range, granularity, listingType, categoryId
        ));
    }

    @Operation(
            summary = "Get top requested listings (Admin only)",
            description = "Ranks listings by the number of requests created within the requested [from, to) period. "
                    + "Only PENDING, ACCEPTED and REJECTED requests are counted; WITHDRAWN and CANCELLED requests are "
                    + "excluded. Ordering is request count descending, then listing ID ascending for stable ties."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/listings/top-requested")
    public ResponseEntity<TopRequestedListingsResponse> getTopRequestedListings(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Maximum number of listings to return. Must be between 1 and 50; defaults to 10.")
            @RequestParam(defaultValue = "10") int limit,

            @Parameter(description = "Optional filter by category identifier.")
            @RequestParam(required = false) UUID categoryId
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getTopRequestedListings(
                range, limit, categoryId
        ));
    }

    @Operation(
            summary = "Get Phase 2 reporting overview (Admin only)",
            description = "Returns users and listings metrics for the requested [from, to) period. Response metadata "
                    + "explicitly lists the included domains and metrics; transactions, moderation, reviews and revenue "
                    + "are excluded from this phase."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/overview")
    public ResponseEntity<ReportingOverviewResponse> getOverview(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getOverview(range));
    }
}
