import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { notificationApi } from '@/features/notifications/api/notification-api';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { NotificationDropdown } from '@/features/notifications/components/NotificationDropdown';
import { NotificationItem } from '@/features/notifications/components/NotificationItem';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type { NotificationResponse } from '@/types/notification';
import type { PageResponse } from '@/types/api';
import type { UserProfile } from '@/types/auth';

vi.mock('@/features/notifications/api/notification-api', () => ({
  notificationApi: {
    getUserNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
  notificationKeys: {
    all: ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    list: (params: unknown) => ['notifications', 'list', params] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockUser: UserProfile = {
  id: 'user-uuid-1',
  displayName: 'Nguyễn Văn Test',
  email: 'test@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const mockTxNotification: NotificationResponse = {
  id: 'notif-1',
  type: 'TRANSACTION_COMPLETED',
  title: 'Giao dịch hoàn tất',
  message: 'Giao dịch cho Bàn làm việc đã hoàn tất thành công.',
  isRead: false,
  referenceType: 'TRANSACTION',
  referenceId: 'tx-123',
  readAt: null,
  createdAt: '2026-10-26T10:00:00Z',
};

const mockRequestNotification: NotificationResponse = {
  id: 'notif-2',
  type: 'REQUEST_RECEIVED',
  title: 'Yêu cầu nhận đồ mới',
  message: 'Bob muốn nhận bài đăng Ghế xoay của bạn.',
  isRead: false,
  referenceType: 'LISTING_REQUEST',
  referenceId: 'req-456',
  readAt: null,
  createdAt: '2026-10-26T09:30:00Z',
};

const mockChatNotification: NotificationResponse = {
  id: 'notif-3',
  type: 'CHAT_MESSAGE',
  title: 'Tin nhắn mới',
  message: 'Alice đã gửi tin nhắn cho bạn.',
  isRead: false,
  referenceType: 'CONVERSATION',
  referenceId: 'conv-789',
  readAt: null,
  createdAt: '2026-10-26T09:00:00Z',
};

const mockReadNotification: NotificationResponse = {
  id: 'notif-4',
  type: 'REQUEST_ACCEPTED',
  title: 'Yêu cầu được chấp nhận',
  message: 'Chủ sở hữu đã chấp nhận yêu cầu của bạn.',
  isRead: true,
  referenceType: 'TRANSACTION',
  referenceId: 'tx-999',
  readAt: '2026-10-26T08:30:00Z',
  createdAt: '2026-10-26T08:00:00Z',
};

const mockPageResponse: PageResponse<NotificationResponse> = {
  content: [mockTxNotification, mockRequestNotification, mockChatNotification, mockReadNotification],
  totalElements: 4,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const emptyPageResponse: PageResponse<NotificationResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('NotificationBell UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationApi.getUserNotifications).mockReset();
    vi.mocked(notificationApi.getUnreadCount).mockReset();
    vi.mocked(notificationApi.markAsRead).mockReset();
    vi.mocked(notificationApi.markAllAsRead).mockReset();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 3 });
    vi.mocked(notificationApi.getUserNotifications).mockResolvedValue(mockPageResponse);
  });

  it('renders bell button with unread count badge when count > 0', async () => {
    renderWithProviders(<NotificationBell />);

    expect(
      await screen.findByRole('button', { name: /thông báo: 3 chưa đọc/i })
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('formats badge as 99+ when unread count exceeds 99', async () => {
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 150 });

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  it('does not render badge when unread count is 0', async () => {
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 0 });

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /không có thông báo mới/i })).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  it('does not render anything when user is unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    const { container } = renderWithProviders(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(notificationApi.getUnreadCount).not.toHaveBeenCalled();
  });

  it('toggles dropdown when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    const bellButton = await screen.findByRole('button', { name: /thông báo/i });
    expect(bellButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: /hộp thông báo/i })).not.toBeInTheDocument();

    await user.click(bellButton);
    expect(bellButton).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('dialog', { name: /hộp thông báo/i })).toBeInTheDocument();

    await user.click(bellButton);
    expect(bellButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: /hộp thông báo/i })).not.toBeInTheDocument();
  });
});

describe('NotificationDropdown UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationApi.getUserNotifications).mockReset();
    vi.mocked(notificationApi.getUnreadCount).mockReset();
    vi.mocked(notificationApi.markAsRead).mockReset();
    vi.mocked(notificationApi.markAllAsRead).mockReset();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 3 });
    vi.mocked(notificationApi.getUserNotifications).mockResolvedValue(mockPageResponse);
  });

  it('renders loading state while fetching', async () => {
    vi.mocked(notificationApi.getUserNotifications).mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Đang tải thông báo...')).toBeInTheDocument();
  });

  it('renders error state and handles retry button', async () => {
    vi.mocked(notificationApi.getUserNotifications).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />);

    expect(await screen.findByText(/không thể tải thông báo/i)).toBeInTheDocument();

    vi.mocked(notificationApi.getUserNotifications).mockResolvedValueOnce(mockPageResponse);
    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Giao dịch hoàn tất')).toBeInTheDocument();
  });

  it('renders empty state when no notifications exist', async () => {
    vi.mocked(notificationApi.getUserNotifications).mockResolvedValueOnce(emptyPageResponse);
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValueOnce({ unreadCount: 0 });

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Bạn chưa có thông báo nào')).toBeInTheDocument();
  });

  it('renders notification items and "Đã đọc tất cả" action', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationApi.markAllAsRead).mockResolvedValueOnce({ updatedCount: 3 });

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />);

    expect(await screen.findByText('Giao dịch hoàn tất')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu nhận đồ mới')).toBeInTheDocument();

    const markAllBtn = screen.getByRole('button', { name: /đánh dấu tất cả thông báo là đã đọc/i });
    expect(markAllBtn.className).toContain('[&>span]:flex');
    expect(markAllBtn.className).toContain('[&>span]:flex-row');
    await user.click(markAllBtn);

    expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown when Escape key is pressed', () => {
    const handleClose = vi.fn();
    renderWithProviders(<NotificationDropdown isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('has a link to the full notifications page', async () => {
    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />);

    const fullPageLink = await screen.findByRole('link', { name: /xem tất cả thông báo/i });
    expect(fullPageLink).toHaveAttribute('href', '/notifications');
  });
});

describe('NotificationItem & Safe Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationApi.getUserNotifications).mockReset();
    vi.mocked(notificationApi.getUnreadCount).mockReset();
    vi.mocked(notificationApi.markAsRead).mockReset();
    vi.mocked(notificationApi.markAllAsRead).mockReset();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  it('renders notification details and visually distinguishes unread from read', () => {
    const { rerender } = renderWithProviders(
      <NotificationItem notification={mockTxNotification} />
    );

    const unreadItem = screen.getByRole('button', { name: /thông báo chưa đọc/i });
    expect(unreadItem).toHaveClass('border-l-4');
    expect(screen.getByText('Giao dịch hoàn tất')).toBeInTheDocument();
    expect(screen.getByText(mockTxNotification.message)).toBeInTheDocument();

    rerender(<NotificationItem notification={mockReadNotification} />);
    const readItem = screen.getByRole('button', { name: /thông báo đã đọc/i });
    expect(readItem).toHaveClass('bg-white');
  });

  it('marks unread notification as read on click and navigates to /transactions/:id for TRANSACTION reference', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationApi.markAsRead).mockResolvedValueOnce({
      ...mockTxNotification,
      isRead: true,
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationItem notification={mockTxNotification} />} />
        <Route path="/transactions/:id" element={<div>Trang Chi Tiết Giao Dịch tx-123</div>} />
      </Routes>,
      { initialEntries: ['/'] }
    );

    const item = screen.getByRole('button', { name: /thông báo chưa đọc: giao dịch hoàn tất/i });
    await user.click(item);

    expect(notificationApi.markAsRead).toHaveBeenCalledWith('notif-1');
    expect(await screen.findByText('Trang Chi Tiết Giao Dịch tx-123')).toBeInTheDocument();
  });

  it('navigates to /my-listings for LISTING_REQUEST reference after marking as read', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationApi.markAsRead).mockResolvedValueOnce({
      ...mockRequestNotification,
      isRead: true,
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationItem notification={mockRequestNotification} />} />
        <Route path="/my-listings" element={<div>Trang Bài Đăng Của Tôi</div>} />
      </Routes>,
      { initialEntries: ['/'] }
    );

    const item = screen.getByRole('button', { name: /thông báo chưa đọc: yêu cầu nhận đồ mới/i });
    await user.click(item);

    expect(notificationApi.markAsRead).toHaveBeenCalledWith('notif-2');
    expect(await screen.findByText('Trang Bài Đăng Của Tôi')).toBeInTheDocument();
  });

  it('navigates to /messages/:conversationId for CONVERSATION reference after marking as read', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationApi.markAsRead).mockResolvedValueOnce({
      ...mockChatNotification,
      isRead: true,
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationItem notification={mockChatNotification} />} />
        <Route path="/messages/:conversationId" element={<div>Trang Cuộc Trò Chuyện conv-789</div>} />
      </Routes>,
      { initialEntries: ['/'] }
    );

    const item = screen.getByRole('button', { name: /thông báo chưa đọc: tin nhắn mới/i });
    await user.click(item);

    expect(notificationApi.markAsRead).toHaveBeenCalledWith('notif-3');
    expect(await screen.findByText('Trang Cuộc Trò Chuyện conv-789')).toBeInTheDocument();
  });

  it('navigates to fallback /messages for CONVERSATION notification when referenceId is missing or empty', async () => {
    const user = userEvent.setup();
    const notificationWithoutId: NotificationResponse = {
      ...mockChatNotification,
      id: 'notif-missing-id',
      referenceId: null,
    };
    vi.mocked(notificationApi.markAsRead).mockResolvedValueOnce({
      ...notificationWithoutId,
      isRead: true,
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationItem notification={notificationWithoutId} />} />
        <Route path="/messages" element={<div>Trang Danh Sách Tin Nhắn Chung</div>} />
      </Routes>,
      { initialEntries: ['/'] }
    );

    const item = screen.getByRole('button', { name: /thông báo chưa đọc: tin nhắn mới/i });
    await user.click(item);

    expect(notificationApi.markAsRead).toHaveBeenCalledWith('notif-missing-id');
    expect(await screen.findByText('Trang Danh Sách Tin Nhắn Chung')).toBeInTheDocument();
  });

  it('shows error feedback and does not navigate if markAsRead fails', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationApi.markAsRead).mockRejectedValueOnce(new Error('Update failed'));

    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationItem notification={mockTxNotification} />} />
        <Route path="/transactions/:id" element={<div>Trang Chi Tiết Giao Dịch</div>} />
      </Routes>,
      { initialEntries: ['/'] }
    );

    const item = screen.getByRole('button', { name: /thông báo chưa đọc: giao dịch hoàn tất/i });
    await user.click(item);

    expect(notificationApi.markAsRead).toHaveBeenCalledWith('notif-1');
    expect(
      await screen.findByText('Không thể cập nhật trạng thái đã đọc.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Trang Chi Tiết Giao Dịch')).not.toBeInTheDocument();
  });
});

describe('NotificationsPage UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationApi.getUserNotifications).mockReset();
    vi.mocked(notificationApi.getUnreadCount).mockReset();
    vi.mocked(notificationApi.markAsRead).mockReset();
    vi.mocked(notificationApi.markAllAsRead).mockReset();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 3 });
    vi.mocked(notificationApi.getUserNotifications).mockResolvedValue(mockPageResponse);
  });

  it('renders page header, unread count, and list of notifications', async () => {
    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByRole('heading', { level: 1, name: /thông báo của bạn/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /đánh dấu tất cả thông báo là đã đọc/i })).toBeInTheDocument();
    expect(screen.getByText('Giao dịch hoàn tất')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu nhận đồ mới')).toBeInTheDocument();
    expect(screen.getByText('Tin nhắn mới')).toBeInTheDocument();
  });

  it('triggers mark-all-as-read and displays success feedback banner', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationApi.markAllAsRead).mockResolvedValueOnce({ updatedCount: 3 });

    renderWithProviders(<NotificationsPage />);

    const markAllBtn = await screen.findByRole('button', { name: /đánh dấu tất cả thông báo là đã đọc/i });
    await user.click(markAllBtn);

    expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Đã đánh dấu tất cả thông báo là đã đọc.')
    ).toBeInTheDocument();
  });

  it('renders empty state when there are no notifications', async () => {
    vi.mocked(notificationApi.getUserNotifications).mockResolvedValueOnce(emptyPageResponse);
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValueOnce({ unreadCount: 0 });

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText('Bạn chưa có thông báo nào')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /đánh dấu tất cả thông báo là đã đọc/i })).not.toBeInTheDocument();
  });

  it('renders error state and allows retry on query failure', async () => {
    vi.mocked(notificationApi.getUserNotifications).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText('Không thể tải danh sách thông báo')).toBeInTheDocument();

    vi.mocked(notificationApi.getUserNotifications).mockResolvedValueOnce(mockPageResponse);
    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Giao dịch hoàn tất')).toBeInTheDocument();
  });

  it('handles pagination controls accurately', async () => {
    const multiPageResponse: PageResponse<NotificationResponse> = {
      content: [mockTxNotification],
      totalElements: 25,
      totalPages: 2,
      size: 20,
      number: 0,
      first: true,
      last: false,
      empty: false,
    };
    vi.mocked(notificationApi.getUserNotifications).mockResolvedValue(multiPageResponse);
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText(/hiển thị trang/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /trang trước/i });
    const nextBtn = screen.getByRole('button', { name: /trang sau/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);

    await waitFor(() => {
      expect(notificationApi.getUserNotifications).toHaveBeenCalledWith({ page: 1, size: 20 });
    });
  });
});
