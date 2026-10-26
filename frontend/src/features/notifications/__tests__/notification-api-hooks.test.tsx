import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notificationApi, notificationKeys } from '@/features/notifications/api/notification-api';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '@/features/notifications/hooks/use-notifications';
import { apiClient } from '@/lib/api-client';
import type {
  NotificationResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
} from '@/types/notification';
import type { PageResponse } from '@/types/api';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockNotification: NotificationResponse = {
  id: 'n1111111-1111-1111-1111-111111111111',
  type: 'REQUEST_RECEIVED',
  title: 'Yêu cầu mới',
  message: 'Bob đã yêu cầu bài đăng Bàn gỗ của bạn',
  isRead: false,
  referenceType: 'LISTING_REQUEST',
  referenceId: 'r1111111-1111-1111-1111-111111111111',
  readAt: null,
  createdAt: '2026-10-26T10:00:00Z',
};

const mockReadNotification: NotificationResponse = {
  ...mockNotification,
  isRead: true,
  readAt: '2026-10-26T10:15:00Z',
};

const mockNotificationsPage: PageResponse<NotificationResponse> = {
  content: [mockNotification],
  totalElements: 1,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockUnreadCount: UnreadCountResponse = {
  unreadCount: 3,
};

const mockMarkAllRead: MarkAllReadResponse = {
  updatedCount: 3,
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('Notification API and Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('notificationApi direct calls', () => {
    it('getUserNotifications calls GET /api/v1/notifications with default pagination', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockNotificationsPage);

      const result = await notificationApi.getUserNotifications();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/notifications', {
        params: { page: 0, size: 20 },
      });
      expect(result).toEqual(mockNotificationsPage);
    });

    it('getUserNotifications enforces backend size limit of 50', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockNotificationsPage);

      await notificationApi.getUserNotifications({ page: 1, size: 100 });

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/notifications', {
        params: { page: 1, size: 50 },
      });
    });

    it('getUnreadCount calls GET /api/v1/notifications/unread-count', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUnreadCount);

      const result = await notificationApi.getUnreadCount();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/notifications/unread-count');
      expect(result).toEqual(mockUnreadCount);
    });

    it('markAsRead calls PATCH /api/v1/notifications/{id}/read', async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce(mockReadNotification);

      const result = await notificationApi.markAsRead('n1111111-1111-1111-1111-111111111111');

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/notifications/n1111111-1111-1111-1111-111111111111/read'
      );
      expect(result).toEqual(mockReadNotification);
    });

    it('markAllAsRead calls PATCH /api/v1/notifications/read-all', async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce(mockMarkAllRead);

      const result = await notificationApi.markAllAsRead();

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/notifications/read-all');
      expect(result).toEqual(mockMarkAllRead);
    });
  });

  describe('useNotifications hook', () => {
    it('fetches paginated notifications successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockNotificationsPage);

      const { result } = renderHook(() => useNotifications({ page: 0, size: 20 }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockNotificationsPage);
    });

    it('respects enabled option when false', () => {
      const { result } = renderHook(
        () => useNotifications({ page: 0, size: 20 }, { enabled: false }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useUnreadNotificationCount hook', () => {
    it('fetches unread count successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUnreadCount);

      const { result } = renderHook(() => useUnreadNotificationCount(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockUnreadCount);
    });
  });

  describe('useMarkNotificationAsRead mutation', () => {
    it('marks notification as read and invalidates lists and unread count', async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce(mockReadNotification);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useMarkNotificationAsRead(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate('n1111111-1111-1111-1111-111111111111');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockReadNotification);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.lists(),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.unreadCount(),
      });
    });
  });

  describe('useMarkAllNotificationsAsRead mutation', () => {
    it('marks all as read, resets cached unread count to 0, and invalidates queries', async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce(mockMarkAllRead);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      const { result } = renderHook(() => useMarkAllNotificationsAsRead(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockMarkAllRead);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.lists(),
      });
      expect(setQueryDataSpy).toHaveBeenCalledWith(notificationKeys.unreadCount(), {
        unreadCount: 0,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: notificationKeys.unreadCount(),
      });
    });
  });
});
