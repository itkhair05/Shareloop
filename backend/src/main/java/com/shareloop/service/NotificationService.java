package com.shareloop.service;

import com.shareloop.dto.notification.MarkAllReadResponse;
import com.shareloop.dto.notification.NotificationResponse;
import com.shareloop.dto.notification.UnreadCountResponse;
import com.shareloop.entity.Notification;
import com.shareloop.entity.User;
import com.shareloop.entity.enums.NotificationType;
import com.shareloop.exception.ResourceNotFoundException;
import com.shareloop.repository.NotificationRepository;
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
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    /**
     * Internal domain method to create and persist a notification.
     * Persisted in the same database transaction as the caller.
     */
    @Transactional
    public Notification createNotification(
            User recipient,
            NotificationType type,
            String title,
            String message,
            String referenceType,
            UUID referenceId
    ) {
        if (recipient == null) {
            throw new IllegalArgumentException("Notification recipient must not be null");
        }
        if (type == null) {
            throw new IllegalArgumentException("Notification type must not be null");
        }
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Notification title must not be blank");
        }
        if (message == null || message.trim().isEmpty()) {
            throw new IllegalArgumentException("Notification message must not be blank");
        }

        Notification notification = new Notification(
                recipient,
                type,
                title,
                message,
                referenceType,
                referenceId
        );

        return notificationRepository.save(notification);
    }

    /**
     * Retrieve paginated notifications belonging exclusively to the authenticated user.
     * Deterministically sorted by createdAt DESC, id DESC.
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getUserNotifications(int page, int size, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view notifications");
        }

        validatePagination(page, size);

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<Notification> notifications = notificationRepository.findByRecipientId(principal.getId(), pageable);
        return notifications.map(NotificationResponse::fromEntity);
    }

    /**
     * Count unread notifications for the authenticated user directly from the database index.
     */
    @Transactional(readOnly = true)
    public UnreadCountResponse getUnreadCount(UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to view unread count");
        }

        long count = notificationRepository.countByRecipientIdAndIsReadFalse(principal.getId());
        return new UnreadCountResponse(count);
    }

    /**
     * Mark a single notification as read.
     * Rules:
     * - Only the notification recipient may mark it as read.
     * - Returns 404 if notification does not exist.
     * - Returns 403 if notification belongs to another user.
     * - Repeated calls are safe and idempotent (does not overwrite original read timestamp).
     */
    @Transactional
    public NotificationResponse markAsRead(UUID notificationId, UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to mark notification as read");
        }

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with id: " + notificationId));

        if (!notification.getRecipient().getId().equals(principal.getId())) {
            throw new AccessDeniedException("You are not authorized to access this notification");
        }

        if (Boolean.TRUE.equals(notification.getIsRead())) {
            return NotificationResponse.fromEntity(notification);
        }

        notification.setIsRead(true);
        notification.setReadAt(Instant.now());
        Notification saved = notificationRepository.saveAndFlush(notification);
        return NotificationResponse.fromEntity(saved);
    }

    /**
     * Mark all unread notifications for the authenticated user as read in a single batch update.
     */
    @Transactional
    public MarkAllReadResponse markAllAsRead(UserPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required to mark notifications as read");
        }

        int updatedCount = notificationRepository.markAllAsReadByRecipientId(principal.getId(), Instant.now());
        return new MarkAllReadResponse(updatedCount);
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 50) {
            throw new IllegalArgumentException("Page size must be between 1 and 50");
        }
    }
}
