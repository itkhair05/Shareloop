package com.shareloop.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Consolidated administrative platform metrics and operational statistics")
public record AdminDashboardStatsResponse(
        @Schema(description = "Total registered user accounts across all statuses", example = "150")
        long totalUsers,

        @Schema(description = "Total user accounts in ACTIVE status", example = "142")
        long activeUsers,

        @Schema(description = "Total user accounts in SUSPENDED status", example = "5")
        long suspendedUsers,

        @Schema(description = "Total item listings created in the marketplace", example = "320")
        long totalListings,

        @Schema(description = "Total listings currently in ACTIVE status", example = "280")
        long activeListings,

        @Schema(description = "Total exchange and donation transactions initiated", example = "95")
        long totalTransactions,

        @Schema(description = "Total transactions successfully COMPLETED", example = "82")
        long completedTransactions,

        @Schema(description = "Total item categories configured in the platform", example = "12")
        long totalCategories,

        @Schema(description = "Total support requests awaiting administrative review (PENDING)", example = "3")
        long pendingSupportRequests,

        @Schema(description = "Total support requests currently being handled (IN_PROGRESS)", example = "2")
        long inProgressSupportRequests,

        @Schema(description = "Total violation reports awaiting investigation (PENDING)", example = "4")
        long pendingReports,

        @Schema(description = "Total violation reports currently under investigation (INVESTIGATING)", example = "1")
        long investigatingReports
) {}
