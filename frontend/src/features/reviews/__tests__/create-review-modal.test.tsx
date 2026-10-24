import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { CreateReviewModal } from '../components/CreateReviewModal';
import { reviewApi } from '../api/review-api';
import { ApiError } from '@/lib/api-error';
import type { TransactionResponse } from '@/types/transaction';
import type { ReviewResponse } from '@/types/review';

vi.mock('../api/review-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/review-api')>();
  return {
    ...actual,
    reviewApi: {
      ...actual.reviewApi,
      createReview: vi.fn(),
      getTransactionReviews: vi.fn(),
    },
  };
});

const mockCompletedTx: TransactionResponse = {
  id: 'tx-11111111-2222-3333-4444-555555555555',
  listing: {
    id: 'listing-1',
    title: 'Bàn phím cơ AKKO',
    listingType: 'GIVEAWAY',
    status: 'COMPLETED',
    price: null,
    currency: 'VND',
    city: 'TP. Hồ Chí Minh',
    owner: {
      id: 'owner-user-1',
      displayName: 'Nguyễn Văn Chủ',
    },
  },
  listingRequestId: 'req-1',
  owner: {
    id: 'owner-user-1',
    displayName: 'Nguyễn Văn Chủ',
  },
  requester: {
    id: 'requester-user-2',
    displayName: 'Trần Thị Nhận',
  },
  status: 'COMPLETED',
  ownerCompleted: true,
  requesterCompleted: true,
  ownerCompletedAt: '2026-10-24T12:00:00Z',
  requesterCompletedAt: '2026-10-24T12:30:00Z',
  myRole: 'OWNER',
  myCompleted: true,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T12:30:00Z',
};

const mockReviewResponse: ReviewResponse = {
  id: 'rev-uuid-1',
  transactionId: mockCompletedTx.id,
  listing: {
    id: mockCompletedTx.listing.id,
    title: mockCompletedTx.listing.title,
    listingType: mockCompletedTx.listing.listingType,
    status: 'COMPLETED',
    price: null,
    currency: null,
    city: mockCompletedTx.listing.city,
    owner: {
      id: mockCompletedTx.owner.id,
      displayName: mockCompletedTx.owner.displayName,
    },
  },
  reviewer: {
    id: 'owner-user-1',
    displayName: 'Nguyễn Văn Chủ',
  },
  reviewee: {
    id: 'requester-user-2',
    displayName: 'Trần Thị Nhận',
  },
  rating: 5,
  comment: 'Người nhận rất lịch sự và đúng giờ!',
  createdAt: '2026-10-24T14:00:00Z',
};

describe('CreateReviewModal (Phase 4B.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with accessible dialog role, title, and target partner information', () => {
    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /đánh giá giao dịch/i })).toBeInTheDocument();
    expect(screen.getByText('Bàn phím cơ AKKO')).toBeInTheDocument();
    expect(screen.getByText(/Trần Thị Nhận/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /đánh giá số sao/i })).toBeInTheDocument();
    expect(screen.getByText(/0\/1000/)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /gửi đánh giá/i });
    expect(submitBtn).toHaveClass('flex', 'flex-row', 'items-center', 'justify-center', 'gap-2');
    expect(submitBtn.className).toContain('[&>span]:flex');
    expect(submitBtn.className).toContain('[&>span]:flex-row');
    expect(submitBtn.className).toContain('[&>span]:items-center');
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(
      <CreateReviewModal
        isOpen={false}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates that a rating is required before submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /gửi đánh giá/i });
    await user.click(submitBtn);

    expect(
      screen.getByText('Vui lòng chọn số sao đánh giá (từ 1 đến 5 sao).')
    ).toBeInTheDocument();
    expect(reviewApi.createReview).not.toHaveBeenCalled();
  });

  it('allows selecting 1 to 5 stars with live rating label and keyboard accessibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    const star4 = screen.getByRole('button', { name: '4 sao' });
    await user.click(star4);

    expect(star4).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Hài lòng (4 sao)')).toBeInTheDocument();

    const star5 = screen.getByRole('button', { name: '5 sao' });
    await user.click(star5);

    expect(star5).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Rất tuyệt vời (5 sao)')).toBeInTheDocument();
  });

  it('validates that whitespace-only comment is rejected', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    await user.click(screen.getByRole('button', { name: '5 sao' }));

    const textarea = screen.getByPlaceholderText(/chia sẻ cảm nhận của bạn/i);
    await user.type(textarea, '     ');

    const submitBtn = screen.getByRole('button', { name: /gửi đánh giá/i });
    await user.click(submitBtn);

    expect(
      screen.getByText('Nhận xét không được chỉ chứa khoảng trắng.')
    ).toBeInTheDocument();
    expect(reviewApi.createReview).not.toHaveBeenCalled();
  });

  it('updates live character counter as comment is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    const textarea = screen.getByPlaceholderText(/chia sẻ cảm nhận của bạn/i);
    await user.type(textarea, 'Rất tốt!');

    expect(screen.getByText(/8\/1000/)).toBeInTheDocument();
  });

  it('submits successfully with rating and optional comment, calls onSuccess and closes', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.mocked(reviewApi.createReview).mockResolvedValueOnce(mockReviewResponse);

    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockCompletedTx}
        onSuccess={handleSuccess}
      />
    );

    // Select 5 stars
    await user.click(screen.getByRole('button', { name: '5 sao' }));

    // Type comment
    const textarea = screen.getByPlaceholderText(/chia sẻ cảm nhận của bạn/i);
    await user.type(textarea, 'Người nhận rất lịch sự và đúng giờ!');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /gửi đánh giá/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(reviewApi.createReview).toHaveBeenCalledWith(
        mockCompletedTx.id,
        {
          rating: 5,
          comment: 'Người nhận rất lịch sự và đúng giờ!',
        }
      );
    });

    expect(handleSuccess).toHaveBeenCalledWith(mockReviewResponse);
    expect(handleClose).toHaveBeenCalled();
  });

  it('submits successfully without comment (null payload)', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    vi.mocked(reviewApi.createReview).mockResolvedValueOnce({
      ...mockReviewResponse,
      comment: null,
    });

    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
        onSuccess={handleSuccess}
      />
    );

    // Select 4 stars
    await user.click(screen.getByRole('button', { name: '4 sao' }));

    // Submit without comment
    const submitBtn = screen.getByRole('button', { name: /gửi đánh giá/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(reviewApi.createReview).toHaveBeenCalledWith(
        mockCompletedTx.id,
        {
          rating: 4,
          comment: null,
        }
      );
    });

    expect(handleSuccess).toHaveBeenCalled();
  });

  it('handles 409 duplicate review conflict error gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewApi.createReview).mockRejectedValueOnce(
      new ApiError({
        message: 'You have already submitted a review for this transaction',
        status: 409,
        error: 'CONFLICT',
      })
    );

    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    await user.click(screen.getByRole('button', { name: '5 sao' }));
    await user.click(screen.getByRole('button', { name: /gửi đánh giá/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Bạn đã gửi đánh giá cho giao dịch này rồi.')
      ).toBeInTheDocument();
    });
  });

  it('handles 403 forbidden error gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewApi.createReview).mockRejectedValueOnce(
      new ApiError({
        message: 'Only transaction participants can submit a review',
        status: 403,
        error: 'FORBIDDEN',
      })
    );

    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockCompletedTx}
      />
    );

    await user.click(screen.getByRole('button', { name: '5 sao' }));
    await user.click(screen.getByRole('button', { name: /gửi đánh giá/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Chỉ người tham gia giao dịch mới có quyền gửi đánh giá.')
      ).toBeInTheDocument();
    });
  });

  it('handles Escape key to close modal', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <CreateReviewModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockCompletedTx}
      />
    );

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalled();
  });
});
