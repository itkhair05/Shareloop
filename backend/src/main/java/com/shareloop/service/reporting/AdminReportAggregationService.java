package com.shareloop.service.reporting;

import com.shareloop.dto.reporting.CategoryDistributionItem;
import com.shareloop.dto.reporting.ListingsReportMetrics;
import com.shareloop.dto.reporting.ListingsSummaryResponse;
import com.shareloop.dto.reporting.ReportDistributionItem;
import com.shareloop.dto.reporting.ReportPeriodResponse;
import com.shareloop.dto.reporting.ReportTimeseriesPoint;
import com.shareloop.dto.reporting.ReportTimeseriesResponse;
import com.shareloop.dto.reporting.ReportingOverviewResponse;
import com.shareloop.dto.reporting.TopRequestedListingItem;
import com.shareloop.dto.reporting.TopRequestedListingsResponse;
import com.shareloop.dto.reporting.UsersReportMetrics;
import com.shareloop.dto.reporting.UsersSummaryResponse;
import com.shareloop.dto.reporting.projection.ReportBucketCountProjection;
import com.shareloop.entity.enums.ListingRequestStatus;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ListingRequestRepository;
import com.shareloop.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private static final int DEFAULT_TOP_LIMIT = 10;
    private static final int MAX_TOP_LIMIT = 50;

    private static final List<String> OVERVIEW_DOMAINS = List.of("USERS", "LISTINGS");
    private static final List<String> OVERVIEW_METRICS = List.of(
            "USERS_CREATED",
            "USERS_BY_ROLE",
            "USERS_BY_CURRENT_STATUS",
            "LISTINGS_CREATED",
            "LISTINGS_BY_CURRENT_STATUS",
            "LISTINGS_BY_TYPE",
            "LISTINGS_BY_CATEGORY"
    );
    private static final String OVERVIEW_DISCLAIMER =
            "Covers users and listings created within the requested period only. Transactions, moderation, reviews and "
                    + "revenue are not included in this phase; time-series trends are available from the dedicated users "
                    + "and listings time-series endpoints.";

    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final ListingRequestRepository listingRequestRepository;

    public AdminReportAggregationService(
            UserRepository userRepository,
            ListingRepository listingRepository,
            ListingRequestRepository listingRequestRepository
    ) {
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
        this.listingRequestRepository = listingRequestRepository;
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
                OVERVIEW_DISCLAIMER
        );
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
