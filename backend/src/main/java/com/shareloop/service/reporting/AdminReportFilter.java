package com.shareloop.service.reporting;

import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ListingType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.entity.enums.UserStatus;

import java.util.Objects;
import java.util.UUID;

/**
 * Validated filters shared by reporting queries. Domain-specific filters stay
 * null when the report does not use them.
 */
public record AdminReportFilter(
        ReportDateRange dateRange,
        UserRole userRole,
        UserStatus userStatus,
        ListingStatus listingStatus,
        ListingType listingType,
        UUID categoryId
) {

    public AdminReportFilter {
        Objects.requireNonNull(dateRange, "dateRange is required");
    }

    public static AdminReportFilter forUsers(
            ReportDateRange dateRange,
            UserRole userRole,
            UserStatus userStatus
    ) {
        return new AdminReportFilter(dateRange, userRole, userStatus, null, null, null);
    }

    public static AdminReportFilter forListings(
            ReportDateRange dateRange,
            ListingStatus listingStatus,
            ListingType listingType,
            UUID categoryId
    ) {
        return new AdminReportFilter(dateRange, null, null, listingStatus, listingType, categoryId);
    }

    public static AdminReportFilter forOverview(ReportDateRange dateRange) {
        return new AdminReportFilter(dateRange, null, null, null, null, null);
    }
}
