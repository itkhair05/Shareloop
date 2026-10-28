import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminReviewsPage } from '../AdminReviewsPage';
import { adminReviewsApi } from '../api/admin-reviews-api';
import { renderWithProviders } from '@/test/test-utils';
import type { AdminReviewResponse } from '@/types/admin-review';
import type { PageResponse } from '@/types/api';

vi.mock('../api/admin-reviews-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-reviews-api')>();
  return {
    ...actual,
    adminReviewsApi: {
      ...actual.adminReviewsApi,
      getAdminReviews: vi.fn(),
      getAdminReviewById: vi.fn(),
      moderateReview: vi.fn(),
      restoreReview: vi.fn(),
    },
  };
});

const mockReview1: AdminReviewResponse = {
  id: 'rev-1',
  rating: 5,
  comment: 'Người trao đổi rất nhiệt tình, đúng giờ!',
  createdAt: '2026-10-15T10:00:00Z',
  updatedAt: '2026-10-15T10:00:00Z',
  isHidden: false,
  reviewerId: 'user-alice',
  reviewerDisplayName: 'Alice Nguyễn',
  reviewerEmail: 'alice@example.com',
  revieweeId: 'user-bob',
  revieweeDisplayName: 'Bob Trần',
  revieweeEmail: 'bob@example.com',
  transactionId: 'tx-100',
  transactionStatus: 'COMPLETED',
  moderatedById: null,
  moderatedByDisplayName: null,
  moderatedAt: null,
  moderationReason: null,
};

const mockHiddenReview: AdminReviewResponse = {
  id: 'rev-2',
  rating: 1,
  comment: 'Nội dung chứa từ ngữ xúc phạm thô tục.',
  createdAt: '2026-10-16T12:00:00Z',
  updatedAt: '2026-10-16T13:00:00Z',
  isHidden: true,
  reviewerId: 'user-charlie',
  reviewerDisplayName: 'Charlie Lê',
  reviewerEmail: 'charlie@example.com',
  revieweeId: 'user-diana',
  revieweeDisplayName: 'Diana Phạm',
  revieweeEmail: 'diana@example.com',
  transactionId: 'tx-101',
  transactionStatus: 'COMPLETED',
  moderatedById: 'admin-dave',
  moderatedByDisplayName: 'Dave Quản Trị',
  moderatedAt: '2026-10-16T13:00:00Z',
  moderationReason: 'Sử dụng từ ngữ xúc phạm quy chuẩn cộng đồng',
};

const mockPageResponse: PageResponse<AdminReviewResponse> = {
  content: [mockReview1, mockHiddenReview],
  totalElements: 2,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

describe('AdminReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminReviewsApi.getAdminReviews).mockResolvedValue(mockPageResponse);
    vi.mocked(adminReviewsApi.getAdminReviewById).mockImplementation((id) => {
      if (id === 'rev-1') return Promise.resolve(mockReview1);
      if (id === 'rev-2') return Promise.resolve(mockHiddenReview);
      return Promise.reject(new Error('Review not found'));
    });
  });

  it('renders page header and reviews table with loaded data', async () => {
    renderWithProviders(<AdminReviewsPage />);

    expect(screen.getByText('Kiểm duyệt đánh giá')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
      expect(screen.getByText('Bob Trần')).toBeInTheDocument();
      expect(screen.getByText('Công khai')).toBeInTheDocument();
      expect(screen.getByText('Đã ẩn')).toBeInTheDocument();
    });

    expect(adminReviewsApi.getAdminReviews).toHaveBeenCalled();
  });

  it('filters reviews by visibility and triggers api with isHidden param', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });

    const visibilitySelect = screen.getByLabelText('Lọc theo trạng thái hiển thị');
    await user.selectOptions(visibilitySelect, 'HIDDEN');

    await waitFor(() => {
      expect(adminReviewsApi.getAdminReviews).toHaveBeenCalledWith(
        expect.objectContaining({
          isHidden: true,
        })
      );
    });
  });

  it('opens review detail modal and displays full information including moderation audit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });

    // Click "Chi tiết" on the hidden review (rev-2)
    const detailButtons = screen.getAllByRole('button', { name: /Chi tiết/i });
    await user.click(detailButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết đánh giá giao dịch')).toBeInTheDocument();
      expect(screen.getByText('Nhật ký kiểm duyệt của ban quản trị')).toBeInTheDocument();
      expect(screen.getByText(/Sử dụng từ ngữ xúc phạm quy chuẩn cộng đồng/i)).toBeInTheDocument();
      expect(screen.getByText(/Dave Quản Trị/i)).toBeInTheDocument();
    });
  });

  it('opens hide dialog, validates reason requirement, and submits moderateReview payload', async () => {
    const user = userEvent.setup();
    vi.mocked(adminReviewsApi.moderateReview).mockResolvedValue(undefined);

    renderWithProviders(<AdminReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });

    // Click "Ẩn" for rev-1
    const hideButton = screen.getByRole('button', { name: /^Ẩn$/i });
    await user.click(hideButton);

    await waitFor(() => {
      expect(screen.getByText('Ẩn kiểm duyệt đánh giá')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận ẩn đánh giá/i });
    expect(submitBtn).toBeDisabled();

    // Type valid reason
    const reasonInput = screen.getByLabelText(/Lý do kiểm duyệt/i);
    await user.type(reasonInput, 'Vi phạm quy tắc cộng đồng do công kích cá nhân');

    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(adminReviewsApi.moderateReview).toHaveBeenCalledWith('rev-1', {
        reason: 'Vi phạm quy tắc cộng đồng do công kích cá nhân',
      });
    });
  });

  it('opens restore confirmation and submits restoreReview action', async () => {
    const user = userEvent.setup();
    vi.mocked(adminReviewsApi.restoreReview).mockResolvedValue({
      ...mockHiddenReview,
      isHidden: false,
      moderatedByDisplayName: null,
      moderationReason: null,
    });

    renderWithProviders(<AdminReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Khôi phục')).toBeInTheDocument();
    });

    const restoreButton = screen.getByRole('button', { name: /Khôi phục/i });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(screen.getByText('Khôi phục hiển thị đánh giá')).toBeInTheDocument();
    });

    const confirmRestoreBtn = screen.getByRole('button', { name: 'Xác nhận khôi phục' });
    await user.click(confirmRestoreBtn);

    await waitFor(() => {
      expect(adminReviewsApi.restoreReview).toHaveBeenCalledWith('rev-2');
    });
  });

  it('renders empty state when no reviews match filters', async () => {
    vi.mocked(adminReviewsApi.getAdminReviews).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: true,
    });

    renderWithProviders(<AdminReviewsPage />);

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy đánh giá nào')).toBeInTheDocument();
    });
  });
});
