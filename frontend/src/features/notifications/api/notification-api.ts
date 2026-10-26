import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  MarkAllReadResponse,
  NotificationQueryParams,
  NotificationResponse,
  UnreadCountResponse,
} from '@/types/notification';

/**
 * Service for Notification operations.
 * Encapsulates network operations for all verified backend endpoints in NotificationController.
 */
export const notificationApi = {
  /**
   * Retrieve paginated notifications belonging to the authenticated user.
   * GET /api/v1/notifications
   * Enforces backend limit: size must not exceed 50. Default: 20.
   */
  async getUserNotifications(
    params?: NotificationQueryParams
  ): Promise<PageResponse<NotificationResponse>> {
    const validatedParams: NotificationQueryParams = {
      page: params?.page ?? 0,
      size: Math.min(Math.max(params?.size ?? 20, 1), 50),
    };

    return apiClient.get<PageResponse<NotificationResponse>>('/api/v1/notifications', {
      params: validatedParams,
    });
  },

  /**
   * Retrieve unread notification count for the authenticated user.
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
  },

  /**
   * Mark a specific notification as read.
   * PATCH /api/v1/notifications/{notificationId}/read
   */
  async markAsRead(notificationId: string): Promise<NotificationResponse> {
    return apiClient.patch<NotificationResponse>(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`
    );
  },

  /**
   * Mark all notifications for the authenticated user as read.
   * PATCH /api/v1/notifications/read-all
   */
  async markAllAsRead(): Promise<MarkAllReadResponse> {
    return apiClient.patch<MarkAllReadResponse>('/api/v1/notifications/read-all');
  },
};

/**
 * Centralized React Query Keys for Notifications
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params?: NotificationQueryParams) => [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export default notificationApi;
