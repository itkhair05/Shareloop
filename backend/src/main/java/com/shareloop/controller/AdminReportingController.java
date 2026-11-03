package com.shareloop.controller;

import com.shareloop.dto.reporting.ListingsSummaryResponse;
import com.shareloop.dto.reporting.ModerationSummaryResponse;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.ReportingOverviewResponse;
import com.shareloop.dto.reporting.ReviewsSummaryResponse;
import com.shareloop.dto.reporting.SupportSummaryResponse;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.dto.reporting.TransactionsSummaryResponse;
import com.shareloop.dto.reporting.UsersSummaryResponse;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.service.reporting.AdminReportAggregationService;
import com.shareloop.service.reporting.AdminReportFilter;
import com.shareloop.service.reporting.ReportDateRange;
import com.shareloop.service.reporting.ReportGranularity;
import com.shareloop.service.reporting.export.AdminReportCsvExportRequest;
import com.shareloop.service.reporting.export.AdminReportCsvExportResult;
import com.shareloop.service.reporting.export.AdminReportCsvExportService;
import com.shareloop.service.reporting.export.AdminReportExportDataset;
import com.shareloop.service.reporting.export.AdminReportExportSection;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@Tag(
        name = "Admin Reporting",
        description = "Read-only aggregated reporting for users, listings, transactions, moderation reports, reviews and support requests"
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

    private static final MediaType CSV_MEDIA_TYPE =
            MediaType.parseMediaType("text/csv; charset=UTF-8");

    private final AdminReportAggregationService adminReportAggregationService;
    private final AdminReportCsvExportService adminReportCsvExportService;

    public AdminReportingController(
            AdminReportAggregationService adminReportAggregationService,
            AdminReportCsvExportService adminReportCsvExportService
    ) {
        this.adminReportAggregationService = adminReportAggregationService;
        this.adminReportCsvExportService = adminReportCsvExportService;
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
            summary = "Get aggregated transaction reporting metrics (Admin only)",
            description = "Counts transactions created within the requested [from, to) period and returns the current "
                    + "status distribution. " + AdminReportAggregationService.TRANSACTION_STATUS_SEMANTICS
                    + " Financial, revenue, GMV, payment and fee metrics are not available."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/transactions/summary")
    public ResponseEntity<TransactionsSummaryResponse> getTransactionsSummary(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Optional filter by current status (PENDING, IN_PROGRESS, COMPLETED or CANCELLED).")
            @RequestParam(required = false) TransactionStatus status
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getTransactionsSummary(
                AdminReportFilter.forTransactions(range, status)
        ));
    }

    @Operation(
            summary = "Get transaction creation time series (Admin only)",
            description = "Returns TRANSACTION_CREATIONS counts for the requested [from, to) period, aggregated in the "
                    + "database and zero-filled for every bucket in the period. Status history is not recorded."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/transactions/timeseries")
    public ResponseEntity<ReportTimeseriesResponse> getTransactionsTimeseries(
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
        return ResponseEntity.ok(adminReportAggregationService.getTransactionsTimeseries(range, granularity));
    }

    @Operation(
            summary = "Get aggregated moderation report metrics (Admin only)",
            description = "Counts moderation reports created within the requested [from, to) period and returns current "
                    + "status, category and target-type distributions. " + AdminReportAggregationService.MODERATION_STATUS_SEMANTICS
                    + " Aggregate counts are computed directly from the reports table; polymorphic targets are not joined."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/moderation/summary")
    public ResponseEntity<ModerationSummaryResponse> getModerationSummary(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Optional filter by current status (PENDING, INVESTIGATING, RESOLVED or DISMISSED).")
            @RequestParam(required = false) ReportStatus status,

            @Parameter(description = "Optional filter by report category.")
            @RequestParam(required = false) ReportCategory category,

            @Parameter(description = "Optional filter by target type (USER, LISTING, TRANSACTION or REVIEW).")
            @RequestParam(required = false) ReportTargetType targetType
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getModerationSummary(
                AdminReportFilter.forModeration(range, status, category, targetType)
        ));
    }

    @Operation(
            summary = "Get moderation report creation time series (Admin only)",
            description = "Returns MODERATION_REPORT_CREATIONS counts for the requested [from, to) period, aggregated "
                    + "in the database and zero-filled for every bucket in the period. Current status is not a "
                    + "time-series filter; status history is not recorded."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/moderation/timeseries")
    public ResponseEntity<ReportTimeseriesResponse> getModerationTimeseries(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = GRANULARITY_DESCRIPTION) @RequestParam(defaultValue = "DAY")
            ReportGranularity granularity,

            @Parameter(description = "Optional filter by report category.")
            @RequestParam(required = false) ReportCategory category,

            @Parameter(description = "Optional filter by target type (USER, LISTING, TRANSACTION or REVIEW).")
            @RequestParam(required = false) ReportTargetType targetType
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getModerationTimeseries(
                range, granularity, category, targetType
        ));
    }

    @Operation(
            summary = "Get aggregated review metrics (Admin only)",
            description = "Counts all reviews created within the requested [from, to) period, including currently hidden "
                    + "reviews. Returns current visibility counts, rating distributions for all and visible reviews, and "
                    + "both average ratings. " + AdminReportAggregationService.REVIEW_VISIBILITY_SEMANTICS
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/reviews/summary")
    public ResponseEntity<ReviewsSummaryResponse> getReviewsSummary(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getReviewsSummary(range));
    }

    @Operation(
            summary = "Get review creation time series (Admin only)",
            description = "Returns REVIEW_CREATIONS counts for the requested [from, to) period, aggregated in the "
                    + "database and zero-filled for every bucket in the period. Hidden reviews are included."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/reviews/timeseries")
    public ResponseEntity<ReportTimeseriesResponse> getReviewsTimeseries(
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
        return ResponseEntity.ok(adminReportAggregationService.getReviewsTimeseries(range, granularity));
    }

    @Operation(
            summary = "Get aggregated support request metrics (Admin only)",
            description = "Counts support requests created within the requested [from, to) period and returns current "
                    + "status and category distributions. " + AdminReportAggregationService.SUPPORT_STATUS_SEMANTICS
                    + " The separate currentOpenWorkload field is system-wide across all dates, is not affected by from, "
                    + "to, status or category filters, and must not be interpreted as period-scoped data."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/support/summary")
    public ResponseEntity<SupportSummaryResponse> getSupportSummary(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Optional filter by current status (PENDING, IN_PROGRESS, RESOLVED or CLOSED).")
            @RequestParam(required = false) SupportRequestStatus status,

            @Parameter(description = "Optional filter by support category.")
            @RequestParam(required = false) SupportCategory category
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getSupportSummary(
                AdminReportFilter.forSupport(range, status, category)
        ));
    }

    @Operation(
            summary = "Get support request creation time series (Admin only)",
            description = "Returns SUPPORT_REQUEST_CREATIONS counts for the requested [from, to) period, aggregated in "
                    + "the database and zero-filled for every bucket in the period. Optional status and category filters "
                    + "apply to the current state of the creation cohort. currentOpenWorkload is never included."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/support/timeseries")
    public ResponseEntity<ReportTimeseriesResponse> getSupportTimeseries(
            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = GRANULARITY_DESCRIPTION) @RequestParam(defaultValue = "DAY")
            ReportGranularity granularity,

            @Parameter(description = "Optional filter by current status of the creation cohort.")
            @RequestParam(required = false) SupportRequestStatus status,

            @Parameter(description = "Optional filter by support category.")
            @RequestParam(required = false) SupportCategory category
    ) {
        ReportDateRange range = ReportDateRange.of(from, to, timezone);
        return ResponseEntity.ok(adminReportAggregationService.getSupportTimeseries(
                range, granularity, status, category
        ));
    }

    @Operation(
            summary = "Get reporting overview across all six domains (Admin only)",
            description = "Returns users, listings, transactions, moderation reports, reviews and support metrics for "
                    + "the requested [from, to) period. Response metadata explicitly lists the included domains and metrics. "
                    + "Support currentOpenWorkload is intentionally excluded because this overview is period-scoped. "
                    + "Financial, resolution-time, response-time and SLA metrics are not included."
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

    @Operation(
            summary = "Export an aggregate reporting dataset as CSV (Admin only)",
            description = "Generates a UTF-8 CSV download from the same aggregate metrics exposed by the reporting "
                    + "endpoints. Supported sections are overview, users, listings, transactions, moderation, reviews "
                    + "and support. The summary dataset is the default; timeseries is available for every domain section; "
                    + "top-requested is available for listings only. Unsupported parameter combinations return the standard "
                    + "JSON 400 error response, never a CSV attachment. Exports contain aggregate metrics only and never "
                    + "include email addresses, phone numbers, support subjects or descriptions, admin notes, or raw "
                    + "moderation report content."
    )
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/export/{section}")
    public ResponseEntity<byte[]> exportReport(
            @Parameter(description = "Reporting section: overview, users, listings, transactions, moderation, reviews or support.")
            @PathVariable String section,

            @Parameter(description = "Export dataset: summary (default), timeseries or top-requested.")
            @RequestParam(required = false) String dataset,

            @Parameter(description = FROM_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = TO_DESCRIPTION) @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = TIMEZONE_DESCRIPTION) @RequestParam(defaultValue = ReportDateRange.DEFAULT_TIMEZONE)
            String timezone,

            @Parameter(description = "Optional user role filter; supported only for users/summary.")
            @RequestParam(required = false) UserRole role,

            @Parameter(description = "Optional status filter; supported values depend on the section and dataset.")
            @RequestParam(required = false) String status,

            @Parameter(description = "Optional category filter for moderation or support sections.")
            @RequestParam(required = false) String category,

            @Parameter(description = "Optional listing type filter; supported only for the listings section.")
            @RequestParam(required = false) ListingType listingType,

            @Parameter(description = "Optional moderation target type filter; supported only for the moderation section.")
            @RequestParam(required = false) ReportTargetType targetType,

            @Parameter(description = "Optional category identifier filter for the listings section.")
            @RequestParam(required = false) UUID categoryId,

            @Parameter(description = "Optional bucket granularity; supported only for the timeseries dataset.")
            @RequestParam(required = false) ReportGranularity granularity,

            @Parameter(description = "Optional ranking limit for listings/top-requested; must be between 1 and 50.")
            @RequestParam(required = false) Integer limit
    ) {
        AdminReportCsvExportRequest exportRequest = new AdminReportCsvExportRequest(
                AdminReportExportSection.from(section),
                AdminReportExportDataset.from(dataset),
                ReportDateRange.of(from, to, timezone),
                role,
                listingType,
                targetType,
                status,
                category,
                categoryId,
                granularity,
                limit
        );

        AdminReportCsvExportResult result = adminReportCsvExportService.export(exportRequest);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(CSV_MEDIA_TYPE);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + result.filename() + "\"");
        headers.set(HttpHeaders.CACHE_CONTROL, "private, no-store");
        headers.set("X-Content-Type-Options", "nosniff");

        return ResponseEntity.ok().headers(headers).body(result.content());
    }
}
