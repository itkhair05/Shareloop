/**
 * Notification Type matching com.shareloop.entity.enums.NotificationType
 */
export type NotificationType =
  | 'REQUEST_RECEIVED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_REJECTED'
  | 'CHAT_MESSAGE'
  | 'TRANSACTION_COMPLETED';

/**
 * Entity reference types attached to notifications for deep linking.
 */
export type NotificationReferenceType =
  | 'LISTING_REQUEST'
  | 'TRANSACTION'
  | 'CONVERSATION'
  | (string & {});

/**
 * Response DTO returned by notification endpoints.
 * Backend DTO: com.shareloop.dto.notification.NotificationResponse
 */
export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  referenceType: NotificationReferenceType | null;
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Unread notification count response.
 * Backend DTO: com.shareloop.dto.notification.UnreadCountResponse
 */
export interface UnreadCountResponse {
  unreadCount: number;
}

/**
 * Mark-all-read response.
 * Backend DTO: com.shareloop.dto.notification.MarkAllReadResponse
 */
export interface MarkAllReadResponse {
  updatedCount: number;
}

/**
 * Query parameters for fetching notifications.
 * GET /api/v1/notifications
 * Note: backend enforces size <= 50.
 */
export interface NotificationQueryParams {
  page?: number;
  size?: number;
}
