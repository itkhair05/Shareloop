package com.shareloop.service;

import com.shareloop.entity.Report;
import com.shareloop.entity.ReportAttachment;
import com.shareloop.entity.ReviewImage;
import com.shareloop.entity.SupportRequest;
import com.shareloop.entity.SupportRequestAttachment;
import com.shareloop.entity.UploadedFile;
import com.shareloop.entity.enums.UserRole;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.ReportAttachmentRepository;
import com.shareloop.repository.ReviewImageRepository;
import com.shareloop.repository.SupportRequestAttachmentRepository;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.filestorage.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Retrieval of domain image attachments.
 *
 * Authorization:
 * <ul>
 *   <li>Review images of visible reviews are public. Images of a hidden review are
 *       invisible (404) to everyone except an administrator, matching the existing
 *       moderation policy.</li>
 *   <li>Report evidence is visible only to the reporter and administrators.</li>
 *   <li>Support attachments are visible only to the requester and administrators.</li>
 * </ul>
 * Unauthorized access returns 404 rather than 403 so the existence of private
 * evidence is never disclosed. Attachments are retained regardless of report or
 * support request status.
 */
@Service
public class DomainAttachmentService {

    private final ReviewImageRepository reviewImageRepository;
    private final ReportAttachmentRepository reportAttachmentRepository;
    private final SupportRequestAttachmentRepository supportRequestAttachmentRepository;
    private final FileStorageService fileStorageService;

    public DomainAttachmentService(
            ReviewImageRepository reviewImageRepository,
            ReportAttachmentRepository reportAttachmentRepository,
            SupportRequestAttachmentRepository supportRequestAttachmentRepository,
            FileStorageService fileStorageService
    ) {
        this.reviewImageRepository = reviewImageRepository;
        this.reportAttachmentRepository = reportAttachmentRepository;
        this.supportRequestAttachmentRepository = supportRequestAttachmentRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public AttachmentResource loadReviewImage(UUID fileId, UserPrincipal principal) {
        ReviewImage image = reviewImageRepository.findByFileId(fileId)
                .orElseThrow(() -> notFound("Review image", fileId));

        boolean isAdmin = principal != null && principal.getRole() == UserRole.ADMIN;
        if (Boolean.TRUE.equals(image.getReview().getIsHidden()) && !isAdmin) {
            throw notFound("Review image", fileId);
        }

        return toResource(image.getUploadedFile(), "Review image", fileId);
    }

    @Transactional(readOnly = true)
    public AttachmentResource loadReportAttachment(UUID fileId, UserPrincipal principal) {
        ReportAttachment attachment = reportAttachmentRepository.findByFileId(fileId)
                .orElseThrow(() -> notFound("Report attachment", fileId));

        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view report attachments");
        }

        Report report = attachment.getReport();
        boolean isReporter = report.getReporter() != null
                && report.getReporter().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;

        if (!isReporter && !isAdmin) {
            throw notFound("Report attachment", fileId);
        }

        return toResource(attachment.getUploadedFile(), "Report attachment", fileId);
    }

    @Transactional(readOnly = true)
    public AttachmentResource loadSupportRequestAttachment(UUID fileId, UserPrincipal principal) {
        SupportRequestAttachment attachment = supportRequestAttachmentRepository.findByFileId(fileId)
                .orElseThrow(() -> notFound("Support request attachment", fileId));

        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view support request attachments");
        }

        SupportRequest supportRequest = attachment.getSupportRequest();
        boolean isRequester = supportRequest.getRequester() != null
                && supportRequest.getRequester().getId().equals(principal.getId());
        boolean isAdmin = principal.getRole() == UserRole.ADMIN;

        if (!isRequester && !isAdmin) {
            throw notFound("Support request attachment", fileId);
        }

        return toResource(attachment.getUploadedFile(), "Support request attachment", fileId);
    }

    private AttachmentResource toResource(UploadedFile file, String label, UUID fileId) {
        if (file == null) {
            throw notFound(label, fileId);
        }
        Resource resource = fileStorageService.loadAsResource(file.getFilename());
        return new AttachmentResource(resource, file.getContentType(), file.getFilename());
    }

    private ResourceNotFoundException notFound(String label, UUID fileId) {
        return new ResourceNotFoundException(label + " not found with id: " + fileId);
    }

    public record AttachmentResource(Resource resource, String contentType, String filename) {
    }
}
