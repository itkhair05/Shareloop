package com.shareloop.service.reporting;

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
        UUID categoryId,
        TransactionStatus transactionStatus,
        ReportStatus reportStatus,
        ReportCategory reportCategory,
        ReportTargetType reportTargetType,
        SupportRequestStatus supportStatus,
        SupportCategory supportCategory
) {

    public AdminReportFilter {
        Objects.requireNonNull(dateRange, "dateRange is required");
    }

    public static AdminReportFilter forUsers(
            ReportDateRange dateRange,
            UserRole userRole,
            UserStatus userStatus
    ) {
        return new AdminReportFilter(
                dateRange, userRole, userStatus,
                null, null, null,
                null, null, null, null,
                null, null
        );
    }

    public static AdminReportFilter forListings(
            ReportDateRange dateRange,
            ListingStatus listingStatus,
            ListingType listingType,
            UUID categoryId
    ) {
        return new AdminReportFilter(
                dateRange, null, null,
                listingStatus, listingType, categoryId,
                null, null, null, null,
                null, null
        );
    }

    public static AdminReportFilter forTransactions(
            ReportDateRange dateRange,
            TransactionStatus transactionStatus
    ) {
        return new AdminReportFilter(
                dateRange, null, null,
                null, null, null,
                transactionStatus, null, null, null,
                null, null
        );
    }

    public static AdminReportFilter forModeration(
            ReportDateRange dateRange,
            ReportStatus reportStatus,
            ReportCategory reportCategory,
            ReportTargetType reportTargetType
    ) {
        return new AdminReportFilter(
                dateRange, null, null,
                null, null, null,
                null, reportStatus, reportCategory, reportTargetType,
                null, null
        );
    }

    public static AdminReportFilter forReviews(ReportDateRange dateRange) {
        return new AdminReportFilter(
                dateRange, null, null,
                null, null, null,
                null, null, null, null,
                null, null
        );
    }

    public static AdminReportFilter forSupport(
            ReportDateRange dateRange,
            SupportRequestStatus supportStatus,
            SupportCategory supportCategory
    ) {
        return new AdminReportFilter(
                dateRange, null, null,
                null, null, null,
                null, null, null, null,
                supportStatus, supportCategory
        );
    }

    public static AdminReportFilter forOverview(ReportDateRange dateRange) {
        return new AdminReportFilter(
                dateRange, null, null,
                null, null, null,
                null, null, null, null,
                null, null
        );
    }
}
