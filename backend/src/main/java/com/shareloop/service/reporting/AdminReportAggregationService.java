package com.shareloop.service.reporting;

import com.shareloop.dto.reporting.CategoryDistributionItem;
import com.shareloop.dto.reporting.ListingsReportMetrics;
import com.shareloop.dto.reporting.ListingsSummaryResponse;
import com.shareloop.dto.reporting.ModerationReportMetrics;
import com.shareloop.dto.reporting.ModerationSummaryResponse;
import com.shareloop.dto.reporting.ReportDistributionItem;
import com.shareloop.dto.reporting.ReportPeriodResponse;
import com.shareloop.dto.reporting.ReportTimeseriesPoint;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.ReportingOverviewResponse;
import com.shareloop.dto.reporting.ReviewsReportMetrics;
import com.shareloop.dto.reporting.ReviewsSummaryResponse;
import com.shareloop.dto.reporting.SupportOpenWorkloadResponse;
import com.shareloop.dto.reporting.SupportReportMetrics;
import com.shareloop.dto.reporting.SupportSummaryResponse;
import com.shareloop.dto.reporting.TopRequestedListingItem;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.dto.reporting.TransactionsReportMetrics;
import com.shareloop.dto.reporting.TransactionsSummaryResponse;
import com.shareloop.dto.reporting.UsersReportMetrics;
import com.shareloop.dto.reporting.UsersSummaryResponse;
import com.shareloop.dto.reporting.projection.ReportBucketCountProjection;
import com.shareloop.dto.reporting.projection.ReportCategoryCountProjection;
import com.shareloop.dto.reporting.projection.ReportStatusCountProjection;
import com.shareloop.dto.reporting.projection.ReportTargetTypeCountProjection;
import com.shareloop.dto.reporting.projection.SupportCategoryCountProjection;
import com.shareloop.dto.reporting.projection.SupportStatusCountProjection;
import com.shareloop.dto.reporting.projection.TransactionStatusCountProjection;
import com.shareloop.dto.review.RatingCountProjection;
import com.shareloop.entity.enums.ListingRequestStatus;
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
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.ReportRepository;
import com.shareloop.repository.ReviewRepository;
import com.shareloop.repository.SupportRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AdminReportAggregationService {

    public static final List<ListingRequestStatus> COUNTED_REQUEST_STATUSES = List.of(
            ListingRequestStatus.PENDING,
            ListingRequestStatus.ACCEPTED,
            ListingRequestStatus.REJECTED
    );

    public static final String USER_STATUS_SEMANTICS =
            "Current status at query time for users created within the requested period; not status at registration time.";

    public static final String LISTING_STATUS_SEMANTICS =
            "Current status at query time for listings created within the requested period; status history is not recorded.";

    private static final String USER_REGISTRATIONS_METRIC = "USER_REGISTRATIONS";
    private static final String LISTING_CREATIONS_METRIC = "LISTING_CREATIONS";
    private static final String TRANSACTION_CREATIONS_METRIC = "TRANSACTION_CREATIONS";
    private static final String MODERATION_REPORT_CREATIONS_METRIC = "MODERATION_REPORT_CREATIONS";
    private static final String REVIEW_CREATIONS_METRIC = "REVIEW_CREATIONS";
    private static final String SUPPORT_REQUEST_CREATIONS_METRIC = "SUPPORT_REQUEST_CREATIONS";
    private static final int DEFAULT_TOP_LIMIT = 10;
    private static final int MAX_TOP_LIMIT = 50;

    public static final String TRANSACTION_STATUS_SEMANTICS =
            "Current status at query time for transactions created within the requested period; status history and completion timestamps are not recorded.";

    public static final String MODERATION_STATUS_SEMANTICS =
            "Current status at query time for moderation reports created within the requested period; status history and resolution timestamps are not recorded.";

    public static final String REVIEW_VISIBILITY_SEMANTICS =
            "Counts all reviews created within the requested period. Visibility is the current state at query time; "
                    + "historical visibility is not recorded. averageRatingVisible is the public-facing average and "
                    + "averageRatingAll is an admin-only supplemental metric.";

    public static final String SUPPORT_STATUS_SEMANTICS =
            "Current status at query time for support requests created within the requested period; status history and resolution timestamps are not recorded.";

    public static final String SUPPORT_OPEN_WORKLOAD_SCOPE = "CURRENT_SYSTEM_WIDE_ALL_DATES";

    private static final List<String> OVERVIEW_DOMAINS = List.of(
            "USERS", "LISTINGS", "TRANSACTIONS", "MODERATION", "REVIEWS", "SUPPORT"
    );
    private static final List<String> OVERVIEW_METRICS = List.of(
            "USERS_CREATED",
            "USERS_BY_ROLE",
            "USERS_BY_CURRENT_STATUS",
            "LISTINGS_CREATED",
            "LISTINGS_BY_CURRENT_STATUS",
            "LISTINGS_BY_TYPE",
            "LISTINGS_BY_CATEGORY",
            "TRANSACTIONS_CREATED",
            "TRANSACTIONS_BY_CURRENT_STATUS",
            "MODERATION_REPORTS_CREATED",
            "MODERATION_BY_CURRENT_STATUS",
            "MODERATION_BY_CATEGORY",
            "MODERATION_BY_TARGET_TYPE",
            "REVIEWS_CREATED",
            "REVIEWS_BY_VISIBILITY",
            "REVIEWS_BY_RATING_ALL",
            "REVIEWS_BY_RATING_VISIBLE",
            "REVIEWS_AVERAGE_RATING_VISIBLE",
            "REVIEWS_AVERAGE_RATING_ALL",
            "SUPPORT_REQUESTS_CREATED",
            "SUPPORT_BY_CURRENT_STATUS",
            "SUPPORT_BY_CATEGORY"
    );
    private static final String OVERVIEW_DISCLAIMER =
            "Summarizes users, listings, transactions, moderation reports, reviews and support requests created within "
                    + "the requested period. Status, visibility and rating distributions reflect current state at query time; "
                    + "status history is not recorded. Support current open workload is system-wide and intentionally excluded "
                    + "from this period-scoped overview. Financial, resolution-time, response-time and SLA metrics are not included.";

    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final ListingRequestRepository listingRequestRepository;
    private final TransactionRepository transactionRepository;
    private final ReportRepository reportRepository;
    private final ReviewRepository reviewRepository;
    private final SupportRequestRepository supportRequestRepository;

    public AdminReportAggregationService(
            UserRepository userRepository,
            ListingRepository listingRepository,
            ListingRequestRepository listingRequestRepository,
            TransactionRepository transactionRepository,
            ReportRepository reportRepository,
            ReviewRepository reviewRepository,
            SupportRequestRepository supportRequestRepository
    ) {
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
        this.listingRequestRepository = listingRequestRepository;
        this.transactionRepository = transactionRepository;
        this.reportRepository = reportRepository;
        this.reviewRepository = reviewRepository;
        this.supportRequestRepository = supportRequestRepository;
    }

    public UsersSummaryResponse getUsersSummary(AdminReportFilter filter) {
        return new UsersSummaryResponse(
                ReportPeriodResponse.from(filter.dateRange()),
                buildUsersMetrics(filter),
                USER_STATUS_SEMANTICS
        );
    }

    public ReportTimeseriesResponse getUsersTimeseries(ReportDateRange range, ReportGranularity granularity) {
        List<ReportTimeseriesPoint> points = buildTimeseries(
                range.bucketStarts(granularity),
                userRepository.countCreatedInRangeByBucket(
                        range.fromInclusive(),
                        range.toExclusive(),
                        granularity.toDateTruncUnit(),
                        range.timezoneId()
                )
        );
        return new ReportTimeseriesResponse(
                USER_REGISTRATIONS_METRIC,
                ReportPeriodResponse.from(range),
                granularity.name(),
                points
        );
    }

    public ListingsSummaryResponse getListingsSummary(AdminReportFilter filter) {
        return new ListingsSummaryResponse(
                ReportPeriodResponse.from(filter.dateRange()),
                buildListingsMetrics(filter),
                LISTING_STATUS_SEMANTICS
        );
    }

    public ReportTimeseriesResponse getListingsTimeseries(
            ReportDateRange range,
            ReportGranularity granularity,
            ListingType listingType,
            UUID categoryId
    ) {
        List<ReportTimeseriesPoint> points = buildTimeseries(
                range.bucketStarts(granularity),
                listingRepository.countCreatedInRangeByBucket(
                        range.fromInclusive(),
                        range.toExclusive(),
                        granularity.toDateTruncUnit(),
                        range.timezoneId(),
                        listingType == null ? null : listingType.name(),
                        categoryId
                )
        );
        return new ReportTimeseriesResponse(
                LISTING_CREATIONS_METRIC,
                ReportPeriodResponse.from(range),
                granularity.name(),
                points
        );
    }

    public TopRequestedListingsResponse getTopRequestedListings(
            ReportDateRange range,
            Integer limit,
            UUID categoryId
    ) {
        int effectiveLimit = limit == null ? DEFAULT_TOP_LIMIT : limit;
        if (effectiveLimit < 1 || effectiveLimit > MAX_TOP_LIMIT) {
            throw new IllegalArgumentException("'limit' must be between 1 and " + MAX_TOP_LIMIT);
        }

        List<TopRequestedListingItem> listings = listingRequestRepository.findTopRequestedListings(
                        range.fromInclusive(),
                        range.toExclusive(),
                        COUNTED_REQUEST_STATUSES,
                        categoryId,
                        PageRequest.of(0, effectiveLimit)
                ).stream()
                .map(row -> new TopRequestedListingItem(
                        row.getListingId(),
                        row.getTitle(),
                        row.getOwnerId(),
                        row.getOwnerDisplayName(),
                        row.getCategoryId(),
                        row.getCategoryName(),
                        row.getListingType(),
                        row.getRequestCount()
                ))
                .toList();

        List<String> countedStatuses = COUNTED_REQUEST_STATUSES.stream()
                .map(ListingRequestStatus::name)
                .toList();

        return new TopRequestedListingsResponse(
                ReportPeriodResponse.from(range),
                effectiveLimit,
                countedStatuses,
                listings
        );
    }

    public ReportingOverviewResponse getOverview(ReportDateRange range) {
        AdminReportFilter filter = AdminReportFilter.forOverview(range);
        return new ReportingOverviewResponse(
                ReportPeriodResponse.from(range),
                OVERVIEW_DOMAINS,
                OVERVIEW_METRICS,
                buildUsersMetrics(filter),
                buildListingsMetrics(filter),
                buildTransactionsMetrics(filter),
                buildModerationMetrics(filter),
                buildReviewsMetrics(range),
                buildSupportMetrics(filter),
                OVERVIEW_DISCLAIMER
        );
    }

    public TransactionsSummaryResponse getTransactionsSummary(AdminReportFilter filter) {
        return new TransactionsSummaryResponse(
                ReportPeriodResponse.from(filter.dateRange()),
                buildTransactionsMetrics(filter),
                TRANSACTION_STATUS_SEMANTICS
        );
    }

    public ReportTimeseriesResponse getTransactionsTimeseries(ReportDateRange range, ReportGranularity granularity) {
        List<ReportTimeseriesPoint> points = buildTimeseries(
                range.bucketStarts(granularity),
                transactionRepository.countCreatedInRangeByBucket(
                        range.fromInclusive(),
                        range.toExclusive(),
                        granularity.toDateTruncUnit(),
                        range.timezoneId()
                )
        );
        return new ReportTimeseriesResponse(
                TRANSACTION_CREATIONS_METRIC,
                ReportPeriodResponse.from(range),
                granularity.name(),
                points
        );
    }

    public ModerationSummaryResponse getModerationSummary(AdminReportFilter filter) {
        return new ModerationSummaryResponse(
                ReportPeriodResponse.from(filter.dateRange()),
                buildModerationMetrics(filter),
                MODERATION_STATUS_SEMANTICS
        );
    }

    public ReportTimeseriesResponse getModerationTimeseries(
            ReportDateRange range,
            ReportGranularity granularity,
            ReportCategory category,
            ReportTargetType targetType
    ) {
        List<ReportTimeseriesPoint> points = buildTimeseries(
                range.bucketStarts(granularity),
                reportRepository.countCreatedInRangeByBucket(
                        range.fromInclusive(),
                        range.toExclusive(),
                        granularity.toDateTruncUnit(),
                        range.timezoneId(),
                        category == null ? null : category.name(),
                        targetType == null ? null : targetType.name()
                )
        );
        return new ReportTimeseriesResponse(
                MODERATION_REPORT_CREATIONS_METRIC,
                ReportPeriodResponse.from(range),
                granularity.name(),
                points
        );
    }

    public ReviewsSummaryResponse getReviewsSummary(ReportDateRange range) {
        return new ReviewsSummaryResponse(
                ReportPeriodResponse.from(range),
                buildReviewsMetrics(range),
                REVIEW_VISIBILITY_SEMANTICS
        );
    }

    public ReportTimeseriesResponse getReviewsTimeseries(ReportDateRange range, ReportGranularity granularity) {
        List<ReportTimeseriesPoint> points = buildTimeseries(
                range.bucketStarts(granularity),
                reviewRepository.countCreatedInRangeByBucket(
                        range.fromInclusive(),
                        range.toExclusive(),
                        granularity.toDateTruncUnit(),
                        range.timezoneId()
                )
        );
        return new ReportTimeseriesResponse(
                REVIEW_CREATIONS_METRIC,
                ReportPeriodResponse.from(range),
                granularity.name(),
                points
        );
    }

    public SupportSummaryResponse getSupportSummary(AdminReportFilter filter) {
        return new SupportSummaryResponse(
                ReportPeriodResponse.from(filter.dateRange()),
                buildSupportMetrics(filter),
                SUPPORT_STATUS_SEMANTICS,
                buildSupportOpenWorkload()
        );
    }

    public ReportTimeseriesResponse getSupportTimeseries(
            ReportDateRange range,
            ReportGranularity granularity,
            SupportRequestStatus status,
            SupportCategory category
    ) {
        List<ReportTimeseriesPoint> points = buildTimeseries(
                range.bucketStarts(granularity),
                supportRequestRepository.countCreatedInRangeByBucket(
                        range.fromInclusive(),
                        range.toExclusive(),
                        granularity.toDateTruncUnit(),
                        range.timezoneId(),
                        status == null ? null : status.name(),
                        category == null ? null : category.name()
                )
        );
        return new ReportTimeseriesResponse(
                SUPPORT_REQUEST_CREATIONS_METRIC,
                ReportPeriodResponse.from(range),
                granularity.name(),
                points
        );
    }

    private TransactionsReportMetrics buildTransactionsMetrics(AdminReportFilter filter) {
        ReportDateRange range = filter.dateRange();

        long total = transactionRepository.countCreatedInRange(
                range.fromInclusive(),
                range.toExclusive(),
                filter.transactionStatus()
        );

        Map<TransactionStatus, Long> statusCounts = new EnumMap<>(TransactionStatus.class);
        for (TransactionStatusCountProjection row : transactionRepository.countCreatedInRangeByStatus(
                range.fromInclusive(),
                range.toExclusive(),
                filter.transactionStatus()
        )) {
            statusCounts.put(row.getStatus(), row.getCount());
        }

        List<ReportDistributionItem> byStatus = new ArrayList<>();
        for (TransactionStatus status : TransactionStatus.values()) {
            byStatus.add(new ReportDistributionItem(status.name(), statusCounts.getOrDefault(status, 0L)));
        }

        return new TransactionsReportMetrics(total, byStatus);
    }

    private ModerationReportMetrics buildModerationMetrics(AdminReportFilter filter) {
        ReportDateRange range = filter.dateRange();

        long total = reportRepository.countCreatedInRange(
                range.fromInclusive(),
                range.toExclusive(),
                filter.reportStatus(),
                filter.reportCategory(),
                filter.reportTargetType()
        );

        Map<ReportStatus, Long> statusCounts = new EnumMap<>(ReportStatus.class);
        for (ReportStatusCountProjection row : reportRepository.countCreatedInRangeByStatus(
                range.fromInclusive(),
                range.toExclusive(),
                filter.reportStatus(),
                filter.reportCategory(),
                filter.reportTargetType()
        )) {
            statusCounts.put(row.getStatus(), row.getCount());
        }

        Map<ReportCategory, Long> categoryCounts = new EnumMap<>(ReportCategory.class);
        for (ReportCategoryCountProjection row : reportRepository.countCreatedInRangeByCategory(
                range.fromInclusive(),
                range.toExclusive(),
                filter.reportStatus(),
                filter.reportCategory(),
                filter.reportTargetType()
        )) {
            categoryCounts.put(row.getCategory(), row.getCount());
        }

        Map<ReportTargetType, Long> targetTypeCounts = new EnumMap<>(ReportTargetType.class);
        for (ReportTargetTypeCountProjection row : reportRepository.countCreatedInRangeByTargetType(
                range.fromInclusive(),
                range.toExclusive(),
                filter.reportStatus(),
                filter.reportCategory(),
                filter.reportTargetType()
        )) {
            targetTypeCounts.put(row.getTargetType(), row.getCount());
        }

        List<ReportDistributionItem> byStatus = new ArrayList<>();
        for (ReportStatus status : ReportStatus.values()) {
            byStatus.add(new ReportDistributionItem(status.name(), statusCounts.getOrDefault(status, 0L)));
        }

        List<ReportDistributionItem> byCategory = new ArrayList<>();
        for (ReportCategory category : ReportCategory.values()) {
            byCategory.add(new ReportDistributionItem(category.name(), categoryCounts.getOrDefault(category, 0L)));
        }

        List<ReportDistributionItem> byTargetType = new ArrayList<>();
        for (ReportTargetType targetType : ReportTargetType.values()) {
            byTargetType.add(new ReportDistributionItem(targetType.name(), targetTypeCounts.getOrDefault(targetType, 0L)));
        }

        return new ModerationReportMetrics(total, byStatus, byCategory, byTargetType);
    }

    private ReviewsReportMetrics buildReviewsMetrics(ReportDateRange range) {
        List<ReportDistributionItem> ratingDistributionAll = buildRatingDistribution(
                reviewRepository.countCreatedInRangeByRating(
                        range.fromInclusive(),
                        range.toExclusive(),
                        false
                )
        );
        List<ReportDistributionItem> ratingDistributionVisible = buildRatingDistribution(
                reviewRepository.countCreatedInRangeByRating(
                        range.fromInclusive(),
                        range.toExclusive(),
                        true
                )
        );

        long totalReviews = sumValues(ratingDistributionAll);
        long visibleReviews = sumValues(ratingDistributionVisible);

        return new ReviewsReportMetrics(
                totalReviews,
                visibleReviews,
                totalReviews - visibleReviews,
                averageRating(ratingDistributionVisible, visibleReviews),
                averageRating(ratingDistributionAll, totalReviews),
                ratingDistributionAll,
                ratingDistributionVisible
        );
    }

    private SupportReportMetrics buildSupportMetrics(AdminReportFilter filter) {
        ReportDateRange range = filter.dateRange();

        long total = supportRequestRepository.countCreatedInRange(
                range.fromInclusive(),
                range.toExclusive(),
                filter.supportStatus(),
                filter.supportCategory()
        );

        Map<SupportRequestStatus, Long> statusCounts = new EnumMap<>(SupportRequestStatus.class);
        for (SupportStatusCountProjection row : supportRequestRepository.countCreatedInRangeByStatus(
                range.fromInclusive(),
                range.toExclusive(),
                filter.supportStatus(),
                filter.supportCategory()
        )) {
            statusCounts.put(row.getStatus(), row.getCount());
        }

        Map<SupportCategory, Long> categoryCounts = new EnumMap<>(SupportCategory.class);
        for (SupportCategoryCountProjection row : supportRequestRepository.countCreatedInRangeByCategory(
                range.fromInclusive(),
                range.toExclusive(),
                filter.supportStatus(),
                filter.supportCategory()
        )) {
            categoryCounts.put(row.getCategory(), row.getCount());
        }

        List<ReportDistributionItem> byCurrentStatus = new ArrayList<>();
        for (SupportRequestStatus status : SupportRequestStatus.values()) {
            byCurrentStatus.add(new ReportDistributionItem(status.name(), statusCounts.getOrDefault(status, 0L)));
        }

        List<ReportDistributionItem> byCategory = new ArrayList<>();
        for (SupportCategory category : SupportCategory.values()) {
            byCategory.add(new ReportDistributionItem(category.name(), categoryCounts.getOrDefault(category, 0L)));
        }

        return new SupportReportMetrics(total, byCurrentStatus, byCategory);
    }

    private SupportOpenWorkloadResponse buildSupportOpenWorkload() {
        long pending = supportRequestRepository.countByStatus(SupportRequestStatus.PENDING);
        long inProgress = supportRequestRepository.countByStatus(SupportRequestStatus.IN_PROGRESS);
        return new SupportOpenWorkloadResponse(
                Instant.now(),
                SUPPORT_OPEN_WORKLOAD_SCOPE,
                pending,
                inProgress,
                pending + inProgress
        );
    }

    private List<ReportDistributionItem> buildRatingDistribution(List<RatingCountProjection> rows) {
        Map<Integer, Long> counts = new HashMap<>();
        for (RatingCountProjection row : rows) {
            counts.put(row.getRating(), row.getCount());
        }

        List<ReportDistributionItem> distribution = new ArrayList<>(5);
        for (int rating = 1; rating <= 5; rating++) {
            distribution.add(new ReportDistributionItem(String.valueOf(rating), counts.getOrDefault(rating, 0L)));
        }
        return distribution;
    }

    private long sumValues(List<ReportDistributionItem> distribution) {
        long total = 0;
        for (ReportDistributionItem item : distribution) {
            total += item.value();
        }
        return total;
    }

    private Double averageRating(List<ReportDistributionItem> distribution, long total) {
        if (total == 0) {
            return null;
        }
        double weightedTotal = 0;
        for (ReportDistributionItem item : distribution) {
            weightedTotal += Integer.parseInt(item.key()) * item.value();
        }
        return BigDecimal.valueOf(weightedTotal / total)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private UsersReportMetrics buildUsersMetrics(AdminReportFilter filter) {
        ReportDateRange range = filter.dateRange();

        long total = userRepository.countCreatedInRange(
                range.fromInclusive(),
                range.toExclusive(),
                filter.userRole(),
                filter.userStatus()
        );

        Map<UserRole, Long> roleCounts = new EnumMap<>(UserRole.class);
        for (var row : userRepository.countCreatedInRangeByRole(
                range.fromInclusive(),
                range.toExclusive(),
                filter.userRole(),
                filter.userStatus()
        )) {
            roleCounts.put(row.getRole(), row.getCount());
        }

        Map<UserStatus, Long> statusCounts = new EnumMap<>(UserStatus.class);
        for (var row : userRepository.countCreatedInRangeByStatus(
                range.fromInclusive(),
                range.toExclusive(),
                filter.userRole(),
                filter.userStatus()
        )) {
            statusCounts.put(row.getStatus(), row.getCount());
        }

        List<ReportDistributionItem> byRole = new ArrayList<>();
        for (UserRole role : UserRole.values()) {
            byRole.add(new ReportDistributionItem(role.name(), roleCounts.getOrDefault(role, 0L)));
        }

        List<ReportDistributionItem> byStatus = new ArrayList<>();
        for (UserStatus status : UserStatus.values()) {
            byStatus.add(new ReportDistributionItem(status.name(), statusCounts.getOrDefault(status, 0L)));
        }

        return new UsersReportMetrics(total, byRole, byStatus);
    }

    private ListingsReportMetrics buildListingsMetrics(AdminReportFilter filter) {
        ReportDateRange range = filter.dateRange();

        long total = listingRepository.countCreatedInRange(
                range.fromInclusive(),
                range.toExclusive(),
                filter.listingStatus(),
                filter.listingType(),
                filter.categoryId()
        );

        Map<ListingStatus, Long> statusCounts = new EnumMap<>(ListingStatus.class);
        for (var row : listingRepository.countCreatedInRangeByStatus(
                range.fromInclusive(),
                range.toExclusive(),
                filter.listingStatus(),
                filter.listingType(),
                filter.categoryId()
        )) {
            statusCounts.put(row.getStatus(), row.getCount());
        }

        Map<ListingType, Long> typeCounts = new EnumMap<>(ListingType.class);
        for (var row : listingRepository.countCreatedInRangeByListingType(
                range.fromInclusive(),
                range.toExclusive(),
                filter.listingStatus(),
                filter.listingType(),
                filter.categoryId()
        )) {
            typeCounts.put(row.getListingType(), row.getCount());
        }

        List<CategoryDistributionItem> byCategory = listingRepository.countCreatedInRangeByCategory(
                        range.fromInclusive(),
                        range.toExclusive(),
                        filter.listingStatus(),
                        filter.listingType(),
                        filter.categoryId()
                ).stream()
                .map(row -> new CategoryDistributionItem(
                        row.getCategoryId(),
                        row.getCategoryName(),
                        row.getCount()
                ))
                .toList();

        List<ReportDistributionItem> byStatus = new ArrayList<>();
        for (ListingStatus status : ListingStatus.values()) {
            byStatus.add(new ReportDistributionItem(status.name(), statusCounts.getOrDefault(status, 0L)));
        }

        List<ReportDistributionItem> byType = new ArrayList<>();
        for (ListingType type : ListingType.values()) {
            byType.add(new ReportDistributionItem(type.name(), typeCounts.getOrDefault(type, 0L)));
        }

        return new ListingsReportMetrics(total, byStatus, byType, byCategory);
    }

    private List<ReportTimeseriesPoint> buildTimeseries(
            List<LocalDate> bucketStarts,
            List<ReportBucketCountProjection> rows
    ) {
        Map<LocalDate, Long> counts = new HashMap<>();
        for (ReportBucketCountProjection row : rows) {
            counts.put(row.getBucket().toLocalDate(), row.getCount());
        }

        List<ReportTimeseriesPoint> points = new ArrayList<>(bucketStarts.size());
        for (LocalDate bucketStart : bucketStarts) {
            points.add(new ReportTimeseriesPoint(bucketStart, counts.getOrDefault(bucketStart, 0L)));
        }
        return points;
    }
}
