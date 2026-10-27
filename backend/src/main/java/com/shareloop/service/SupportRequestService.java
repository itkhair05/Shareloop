package com.shareloop.service;

import com.shareloop.dto.support.AdminSupportRequestResponse;
import com.shareloop.dto.support.CreateSupportRequest;
import com.shareloop.dto.support.SupportRequestResponse;
import com.shareloop.dto.support.UpdateSupportRequestAdminRequest;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.SupportRequestRepository;
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
import java.util.UUID;

@Service
public class SupportRequestService {

    private final SupportRequestRepository supportRequestRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationService notificationService;

    public SupportRequestService(
            SupportRequestRepository supportRequestRepository,
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            NotificationService notificationService
    ) {
        this.supportRequestRepository = supportRequestRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public SupportRequestResponse createSupportRequest(CreateSupportRequest request, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to create a support request");
        }

        User requester = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + principal.getId()));

        Transaction transaction = null;
        if (request.getTransactionId() != null) {
            transaction = transactionRepository.findById(request.getTransactionId())
                    .orElseThrow(() -> new ResourceNotFoundException("Transaction not found with id: " + request.getTransactionId()));

            if (!transaction.isParticipant(principal.getId())) {
                throw new AccessDeniedException("You are not authorized to create a support request for this transaction");
            }
        }

        SupportRequest supportRequest = new SupportRequest(
                requester,
                transaction,
                request.getCategory(),
                request.getSubject().trim(),
                request.getDescription().trim()
        );

        supportRequest = supportRequestRepository.save(supportRequest);
        return SupportRequestResponse.fromEntity(supportRequest);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestResponse> getMySupportRequests(
            SupportRequestStatus status,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view support requests");
        }
        validatePagination(page, size);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Page<SupportRequest> result;
        if (status != null) {
            result = supportRequestRepository.findByRequesterIdAndStatus(principal.getId(), status, pageable);
        } else {
            result = supportRequestRepository.findByRequesterId(principal.getId(), pageable);
        }

        return result.map(SupportRequestResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public SupportRequestResponse getSupportRequestDetails(UUID id, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view support request details");
        }

        SupportRequest sr = supportRequestRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Support request not found with id: " + id));

        boolean isRequester = sr.getRequester().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;
        if (!isRequester && !isAdmin) {
            throw new AccessDeniedException("You are not authorized to view this support request");
        }

        return SupportRequestResponse.fromEntity(sr);
    }

    @Transactional(readOnly = true)
    public Page<AdminSupportRequestResponse> getAdminSupportRequests(
            SupportRequestStatus status,
            SupportCategory category,
            int page,
            int size,
            UserPrincipal principal
    ) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to list all support requests");
        }
        validatePagination(page, size);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<SupportRequest> result = supportRequestRepository.findForAdmin(status, category, pageable);
        return result.map(AdminSupportRequestResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public AdminSupportRequestResponse getAdminSupportRequestDetails(UUID id, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to inspect support request details");
        }

        SupportRequest sr = supportRequestRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Support request not found with id: " + id));

        return AdminSupportRequestResponse.fromEntity(sr);
    }

    @Transactional
    public AdminSupportRequestResponse updateSupportRequestAdmin(
            UUID id,
            UpdateSupportRequestAdminRequest request,
            UserPrincipal principal
    ) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to update support requests");
        }

        SupportRequest sr = supportRequestRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Support request not found with id: " + id));

        User adminUser = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found with id: " + principal.getId()));

        boolean statusChanged = false;
        if (request.getStatus() != null && request.getStatus() != sr.getStatus()) {
            statusChanged = true;
            sr.setStatus(request.getStatus());

            if (request.getStatus() == SupportRequestStatus.RESOLVED || request.getStatus() == SupportRequestStatus.CLOSED) {
                sr.setResolvedBy(adminUser);
                sr.setResolvedAt(Instant.now());
            } else {
                sr.setResolvedBy(null);
                sr.setResolvedAt(null);
            }
        }

        boolean responseChanged = false;
        if (request.getAdminResponse() != null) {
            String trimmedResponse = request.getAdminResponse().trim();
            if (!trimmedResponse.equals(sr.getAdminResponse())) {
                responseChanged = true;
            }
            sr.setAdminResponse(trimmedResponse);
        }

        if (request.getAdminNotes() != null) {
            sr.setAdminNotes(request.getAdminNotes().trim());
        }

        sr = supportRequestRepository.save(sr);

        if (statusChanged || responseChanged) {
            String statusText = switch (sr.getStatus()) {
                case PENDING -> "Chờ xử lý";
                case IN_PROGRESS -> "Đang xử lý";
                case RESOLVED -> "Đã giải quyết";
                case CLOSED -> "Đã đóng";
            };

            String message = "Yêu cầu hỗ trợ \"" + sr.getSubject() + "\" của bạn đã được cập nhật trạng thái: " + statusText + ".";
            if (sr.getAdminResponse() != null && !sr.getAdminResponse().isBlank()) {
                String snippet = sr.getAdminResponse().length() > 100
                        ? sr.getAdminResponse().substring(0, 97) + "..."
                        : sr.getAdminResponse();
                message += " Phản hồi từ quản trị viên: " + snippet;
            }

            notificationService.createNotification(
                    sr.getRequester(),
                    NotificationType.SUPPORT_REQUEST_UPDATED,
                    "Yêu cầu hỗ trợ đã được cập nhật",
                    message,
                    "SUPPORT_REQUEST",
                    sr.getId()
            );
        }

        return AdminSupportRequestResponse.fromEntity(sr);
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
