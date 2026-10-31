package com.shareloop.service;

import com.shareloop.dto.report.AdminReportResponse;
import com.shareloop.dto.report.CreateReportRequest;
import com.shareloop.dto.report.ReportResponse;
import com.shareloop.dto.report.UpdateReportAdminRequest;
import com.shareloop.entity.Listing;
import com.shareloop.entity.Report;
import com.shareloop.entity.Review;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.entity.enums.ReportCategory;
import com.shareloop.entity.enums.ReportStatus;
import com.shareloop.entity.enums.ReportTargetType;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.DuplicateReportException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ListingRepository;
import com.shareloop.repository.ReportRepository;
import com.shareloop.repository.ReviewRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UserRepository;
import com.shareloop.security.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final ListingRepository listingRepository;
    private final TransactionRepository transactionRepository;
    private final ReviewRepository reviewRepository;
    private final NotificationService notificationService;

    public ReportService(
            ReportRepository reportRepository,
            UserRepository userRepository,
            ListingRepository listingRepository,
            TransactionRepository transactionRepository,
            ReviewRepository reviewRepository,
            NotificationService notificationService
    ) {
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
        this.listingRepository = listingRepository;
        this.transactionRepository = transactionRepository;
        this.reviewRepository = reviewRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public ReportResponse createReport(CreateReportRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to submit a violation report");
        }

        User reporter = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + principal.getId()));

        validateTargetEntity(request.getTargetType(), request.getTargetId(), principal.getId());

        boolean hasActiveReport = reportRepository.existsByReporterIdAndTargetTypeAndTargetIdAndStatusIn(
                principal.getId(),
                request.getTargetType(),
                request.getTargetId(),
                List.of(ReportStatus.PENDING, ReportStatus.INVESTIGATING)
        );

        if (hasActiveReport) {
            throw new DuplicateReportException("You already have an active report for this " + request.getTargetType().name().toLowerCase() + " being reviewed");
        }

        Report report = new Report(
                reporter,
                request.getTargetType(),
                request.getTargetId(),
                request.getCategory(),
                request.getDescription().trim()
        );

        report = reportRepository.save(report);
        return ReportResponse.fromEntity(report);
    }

    @Transactional(readOnly = true)
    public Page<ReportResponse> getMyReports(
            ReportStatus status,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view submitted reports");
        }
        validatePagination(page, size);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Page<Report> result;
        if (status != null) {
            result = reportRepository.findByReporterIdAndStatus(principal.getId(), status, pageable);
        } else {
            result = reportRepository.findByReporterId(principal.getId(), pageable);
        }

        return result.map(ReportResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public ReportResponse getReportDetails(UUID id, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view report details");
        }

        Report report = reportRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found with id: " + id));

        boolean isReporter = report.getReporter().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isReporter && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to view this report");
        }

        return ReportResponse.fromEntity(report);
    }

    @Transactional(readOnly = true)
    public Page<AdminReportResponse> getAdminReports(
            ReportStatus status,
            ReportTargetType targetType,
            ReportCategory category,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to list all reports");
        }
        validatePagination(page, size);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Report> result = reportRepository.findForAdmin(status, targetType, category, pageable);
        Map<UUID, User> reportedUsers = loadReportedUsers(result.getContent());
        return result.map(report -> AdminReportResponse.fromEntity(
                report,
                report.getTargetType() == ReportTargetType.USER
                        ? reportedUsers.get(report.getTargetId())
                        : null
        ));
    }

    @Transactional(readOnly = true)
    public AdminReportResponse getAdminReportDetails(UUID id, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to inspect report details");
        }

        Report report = reportRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found with id: " + id));

        return AdminReportResponse.fromEntity(report, resolveReportedUser(report));
    }

    @Transactional
    public AdminReportResponse updateReportAdmin(
            UUID id,
            UpdateReportAdminRequest request,
            UserPrincipal principal
    ) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to update reports");
        }

        Report report = reportRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found with id: " + id));

        User adminUser = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found with id: " + principal.getId()));

        boolean statusChanged = false;
        if (request.getStatus() != null && request.getStatus() != report.getStatus()) {
            statusChanged = true;
            report.setStatus(request.getStatus());

            if (request.getStatus() == ReportStatus.RESOLVED || request.getStatus() == ReportStatus.DISMISSED) {
                report.setResolvedBy(adminUser);
                report.setResolvedAt(Instant.now());
            } else {
                report.setResolvedBy(null);
                report.setResolvedAt(null);
            }
        }

        if (request.getResolutionNotes() != null) {
            report.setResolutionNotes(request.getResolutionNotes().trim());
        }

        report = reportRepository.save(report);

        if (statusChanged) {
            String statusText = switch (report.getStatus()) {
                case PENDING -> "Chờ xử lý";
                case INVESTIGATING -> "Đang điều tra";
                case RESOLVED -> "Đã giải quyết";
                case DISMISSED -> "Đã bác bỏ";
            };

            String targetText = switch (report.getTargetType()) {
                case USER -> "người dùng";
                case LISTING -> "tin đăng";
                case TRANSACTION -> "giao dịch";
                case REVIEW -> "đánh giá";
            };

            String snippetId = report.getId().toString().length() >= 8
                    ? report.getId().toString().substring(0, 8)
                    : report.getId().toString();

            String message = "Báo cáo vi phạm " + targetText + " của bạn (#" + snippetId + ") đã được cập nhật trạng thái: " + statusText + ".";

            notificationService.createNotification(
                    report.getReporter(),
                    NotificationType.REPORT_UPDATED,
                    "Báo cáo vi phạm đã được cập nhật",
                    message,
                    "REPORT",
                    report.getId()
            );
        }

        return AdminReportResponse.fromEntity(report, resolveReportedUser(report));
    }

    /**
     * Batch-loads reported users for USER-target reports to avoid N+1 lookups.
     * Other target types reference listings, transactions, or reviews, not users.
     */
    private Map<UUID, User> loadReportedUsers(List<Report> reports) {
        List<UUID> userIds = reports.stream()
                .filter(report -> report.getTargetType() == ReportTargetType.USER)
                .map(Report::getTargetId)
                .distinct()
                .toList();

        if (userIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(userIds).forEach(user -> users.put(user.getId(), user));
        return users;
    }

    private User resolveReportedUser(Report report) {
        if (report.getTargetType() != ReportTargetType.USER) {
            return null;
        }
        return userRepository.findById(report.getTargetId()).orElse(null);
    }

    private void validateTargetEntity(ReportTargetType targetType, UUID targetId, UUID reporterId) {
        switch (targetType) {
            case USER -> {
                userRepository.findById(targetId)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + targetId));
                if (targetId.equals(reporterId)) {
                    throw new IllegalArgumentException("You cannot report yourself");
                }
            }
            case LISTING -> {
                Listing listing = listingRepository.findById(targetId)
                        .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + targetId));
                if (listing.getOwner().getId().equals(reporterId)) {
                    throw new IllegalArgumentException("You cannot report your own listing");
                }
            }
            case TRANSACTION -> {
                Transaction transaction = transactionRepository.findById(targetId)
                        .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + targetId));
                if (!transaction.isParticipant(reporterId)) {
                    throw new AccessDeniedException("You are not authorized to report this transaction");
                }
            }
            case REVIEW -> {
                Review review = reviewRepository.findById(targetId)
                        .orElseThrow(() -> new ResourceNotFoundException("Review not found with id: " + targetId));
                if (review.getReviewer().getId().equals(reporterId)) {
                    throw new IllegalArgumentException("You cannot report your own review");
                }
            }
        }
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("Page size must be between 1 and 100");
        }
    }
}
