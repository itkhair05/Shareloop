package com.shareloop.controller;

import com.shareloop.dto.notification.MarkAllReadResponse;
import com.shareloop.dto.notification.NotificationResponse;
import com.shareloop.dto.notification.UnreadCountResponse;
import com.shareloop.security.UserPrincipal;
import com.shareloop.service.NotificationService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Notifications", description = "In-app notifications and read status updates")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /**
     * Retrieve paginated notifications belonging to the authenticated user.
     */
    @GetMapping
    public ResponseEntity<Page<NotificationResponse>> getUserNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<NotificationResponse> response = notificationService.getUserNotifications(page, size, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve unread notification count for the authenticated user.
     */
    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountResponse> getUnreadCount(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        UnreadCountResponse response = notificationService.getUnreadCount(principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Mark a specific notification as read.
     */
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @PathVariable UUID notificationId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        NotificationResponse response = notificationService.markAsRead(notificationId, principal);
        return ResponseEntity.ok(response);
    }

    /**
     * Mark all notifications for the authenticated user as read.
     */
    @PatchMapping("/read-all")
    public ResponseEntity<MarkAllReadResponse> markAllAsRead(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        MarkAllReadResponse response = notificationService.markAllAsRead(principal);
        return ResponseEntity.ok(response);
    }
}
