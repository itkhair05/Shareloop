package com.shareloop.service;

import com.shareloop.dto.attachment.AttachmentResponse;
import com.shareloop.dto.support.AdminSupportRequestResponse;
import com.shareloop.dto.support.CreateSupportRequest;
import com.shareloop.dto.support.SupportRequestResponse;
import com.shareloop.dto.support.UpdateSupportRequestAdminRequest;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.SupportRequestAttachment;
import com.shareloop.entity.Transaction;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.entity.enums.SupportCategory;
import com.shareloop.entity.enums.SupportRequestStatus;
import com.shareloop.entity.enums.UploadPurpose;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.AttachmentConflictException;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.SupportRequestAttachmentRepository;
import com.shareloop.repository.SupportRequestRepository;
import com.shareloop.repository.TransactionRepository;
import com.shareloop.repository.UploadedFileRepository;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SupportRequestService {

    private static final int MAX_SUPPORT_ATTACHMENTS = 5;
    private static final String SUPPORT_DOMAIN = "SUPPORT";

    private final SupportRequestRepository supportRequestRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationService notificationService;
    private final SupportRequestAttachmentRepository supportRequestAttachmentRepository;
    private final UploadedFileRepository uploadedFileRepository;
    private final FileBindingService fileBindingService;

    public SupportRequestService(
            SupportRequestRepository supportRequestRepository,
            UserRepository userRepository,
            TransactionRepository transactionRepository,
            NotificationService notificationService,
            SupportRequestAttachmentRepository supportRequestAttachmentRepository,
            UploadedFileRepository uploadedFileRepository,
            FileBindingService fileBindingService
    ) {
        this.supportRequestRepository = supportRequestRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.notificationService = notificationService;
        this.supportRequestAttachmentRepository = supportRequestAttachmentRepository;
        this.uploadedFileRepository = uploadedFileRepository;
        this.fileBindingService = fileBindingService;
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

        supportRequest = supportRequestRepository.saveAndFlush(supportRequest);
        List<SupportRequestAttachment> attachments =
                attachImages(supportRequest, request.getImageIds(), requester);
        return SupportRequestResponse.fromEntity(supportRequest, toAttachmentResponses(attachments));
    }

    /**
     * Binds support-purpose uploads and persists ordered attachment rows in the same
     * transaction as the support request. Evidence survives every status transition.
     */
    private List<SupportRequestAttachment> attachImages(SupportRequest supportRequest, List<UUID> imageIds, User owner) {
        if (imageIds == null || imageIds.isEmpty()) {
            return List.of();
        }
        if (imageIds.size() > MAX_SUPPORT_ATTACHMENTS) {
            throw new IllegalArgumentException(
                    "A support request can have at most " + MAX_SUPPORT_ATTACHMENTS + " attachments");
        }

        try {
            fileBindingService.bindFiles(
                    imageIds, UploadPurpose.SUPPORT, SUPPORT_DOMAIN, supportRequest.getId(), owner);
        } catch (IllegalStateException ex) {
            throw new AttachmentConflictException(
                    "Tệp đính kèm đã được sử dụng hoặc không còn khả dụng.", ex);
        }

        List<SupportRequestAttachment> attachments = new ArrayList<>(imageIds.size());
        for (int i = 0; i < imageIds.size(); i++) {
            UploadedFile file = uploadedFileRepository.getReferenceById(imageIds.get(i));
            attachments.add(new SupportRequestAttachment(supportRequest, file, i));
        }
        return supportRequestAttachmentRepository.saveAllAndFlush(attachments);
    }

    private List<AttachmentResponse> toAttachmentResponses(List<SupportRequestAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return List.of();
        }
        return attachments.stream()
                .map(attachment -> AttachmentResponse.supportRequestAttachment(attachment.getFileId()))
                .toList();
    }

    private List<AttachmentResponse> loadAttachmentsForSupportRequest(UUID supportRequestId) {
        return toAttachmentResponses(
                supportRequestAttachmentRepository.findBySupportRequestIdOrderByDisplayOrderAsc(supportRequestId));
    }

    private Map<UUID, List<AttachmentResponse>> loadAttachmentsBySupportRequestId(List<UUID> supportRequestIds) {
        if (supportRequestIds == null || supportRequestIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<AttachmentResponse>> attachmentsByRequest = new LinkedHashMap<>();
        for (SupportRequestAttachment attachment : supportRequestAttachmentRepository
                .findBySupportRequestIdsOrderByDisplayOrderAsc(supportRequestIds)) {
            attachmentsByRequest
                    .computeIfAbsent(attachment.getSupportRequest().getId(), key -> new ArrayList<>())
                    .add(AttachmentResponse.supportRequestAttachment(attachment.getFileId()));
        }
        return attachmentsByRequest;
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

        Map<UUID, List<AttachmentResponse>> attachmentsByRequest = loadAttachmentsBySupportRequestId(
                result.getContent().stream().map(SupportRequest::getId).toList());
        return result.map(request -> SupportRequestResponse.fromEntity(
                request, attachmentsByRequest.getOrDefault(request.getId(), List.of())));
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

        return SupportRequestResponse.fromEntity(sr, loadAttachmentsForSupportRequest(id));
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
        Map<UUID, List<AttachmentResponse>> attachmentsByRequest = loadAttachmentsBySupportRequestId(
                result.getContent().stream().map(SupportRequest::getId).toList());
        return result.map(request -> AdminSupportRequestResponse.fromEntity(
                request, attachmentsByRequest.getOrDefault(request.getId(), List.of())));
    }

    @Transactional(readOnly = true)
    public AdminSupportRequestResponse getAdminSupportRequestDetails(UUID id, UserPrincipal principal) {
        if (principal == null || principal.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Administrator role is required to inspect support request details");
        }

        SupportRequest sr = supportRequestRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Support request not found with id: " + id));

        return AdminSupportRequestResponse.fromEntity(sr, loadAttachmentsForSupportRequest(id));
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

        return AdminSupportRequestResponse.fromEntity(sr, loadAttachmentsForSupportRequest(id));
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
