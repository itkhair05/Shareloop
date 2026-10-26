import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi, notificationKeys } from '../api/notification-api';
import type { PageResponse } from '@/types/api';
import type {
  MarkAllReadResponse,
  NotificationQueryParams,
  NotificationResponse,
  UnreadCountResponse,
} from '@/types/notification';
import { appConfig } from '@/lib/config';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve paginated notifications for the authenticated user.
 */
export function useNotifications(
  params?: NotificationQueryParams,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery<PageResponse<NotificationResponse>, ApiError>({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationApi.getUserNotifications(params),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 1000 * 30, // 30 seconds
    retry: (failureCount, error) => {
      if (appConfig.isTest) return false;
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve the unread notification count for the authenticated user.
 */
export function useUnreadNotificationCount(
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery<UnreadCountResponse, ApiError>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 1000 * 15, // 15 seconds
    retry: (failureCount, error) => {
      if (appConfig.isTest) return false;
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Mutation hook to mark a single notification as read.
 * On success, invalidates notification lists and unread count to keep UI in sync.
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation<NotificationResponse, ApiError, string>({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      // Invalidate notification lists so read state is refreshed
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });

      // Invalidate unread count to decrement badge
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Mutation hook to mark all notifications as read.
 * On success, invalidates notification lists and sets unreadCount to 0 immediately.
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation<MarkAllReadResponse, ApiError, void>({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      // Invalidate notification lists
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });

      // Immediately set cached unread count to 0 for instant UI feedback
      queryClient.setQueryData(notificationKeys.unreadCount(), { unreadCount: 0 });

      // Invalidate unreadCount to ensure background consistency
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}
