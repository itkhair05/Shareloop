package com.shareloop.service;

import com.shareloop.dto.admin.AdminDashboardStatsResponse;
import com.shareloop.entity.enums.ListingStatus;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.TransactionStatus;
import com.shareloop.entity.enums.UserStatus;
import com.shareloop.repository.CategoryRepository;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ReportRepository;
import com.shareloop.repository.SupportRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service providing consolidated administrative dashboard statistics.
 *
 * Uses dedicated count queries to avoid loading entire entity tables into memory,
 * ensuring fast aggregation and bounded memory usage.
 */
@Service
@Transactional(readOnly = true)
public class AdminDashboardService {

    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryRepository categoryRepository;
    private final SupportRequestRepository supportRequestRepository;
    private final ReportRepository reportRepository;

    public AdminDashboardService(
            UserRepository userRepository,
            ListingRepository listingRepository,
            TransactionRepository transactionRepository,
            CategoryRepository categoryRepository,
            SupportRequestRepository supportRequestRepository,
            ReportRepository reportRepository
    ) {
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.supportRequestRepository = supportRequestRepository;
        this.reportRepository = reportRepository;
    }

    public AdminDashboardStatsResponse getDashboardStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByStatus(UserStatus.ACTIVE);
        long suspendedUsers = userRepository.countByStatus(UserStatus.SUSPENDED);

        long totalListings = listingRepository.count();
        long activeListings = listingRepository.countByStatus(ListingStatus.ACTIVE);

        long totalTransactions = transactionRepository.count();
        long completedTransactions = transactionRepository.countByStatus(TransactionStatus.COMPLETED);

        long totalCategories = categoryRepository.count();

        long pendingSupportRequests = supportRequestRepository.countByStatus(SupportRequestStatus.PENDING);
        long inProgressSupportRequests = supportRequestRepository.countByStatus(SupportRequestStatus.IN_PROGRESS);

        long pendingReports = reportRepository.countByStatus(ReportStatus.PENDING);
        long investigatingReports = reportRepository.countByStatus(ReportStatus.INVESTIGATING);

        return new AdminDashboardStatsResponse(
                totalUsers,
                activeUsers,
                suspendedUsers,
                totalListings,
                activeListings,
                totalTransactions,
                completedTransactions,
                totalCategories,
                pendingSupportRequests,
                inProgressSupportRequests,
                pendingReports,
                investigatingReports
        );
    }
}
