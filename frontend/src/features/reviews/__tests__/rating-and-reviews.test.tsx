import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { reviewApi } from '../api/review-api';
import { StarRating } from '../components/StarRating';
import { RatingSummaryCard } from '../components/RatingSummaryCard';
import { UserReviewsList } from '../components/UserReviewsList';
import { OwnerRatingBadge } from '../components/OwnerRatingBadge';
import { OwnerReputationSection } from '../components/OwnerReputationSection';
import type { UserRatingSummaryResponse, ReviewResponse } from '@/types/review';
import type { PageResponse } from '@/types/api';

vi.mock('../api/review-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/review-api')>();
  return {
    ...actual,
    reviewApi: {
      getUserRatingSummary: vi.fn(),
      getUserReviews: vi.fn(),
    },
  };
});

const mockSummary: UserRatingSummaryResponse = {
  userId: '11111111-1111-1111-1111-111111111111',
  averageRating: 4.67,
  totalReviews: 12,
  starBreakdown: {
    1: 0,
    2: 1,
    3: 0,
    4: 2,
    5: 9,
  },
};

const mockZeroSummary: UserRatingSummaryResponse = {
  userId: '22222222-2222-2222-2222-222222222222',
  averageRating: 0.0,
  totalReviews: 0,
  starBreakdown: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  },
};

const mockReviews: ReviewResponse[] = [
  {
    id: 'r1111111-1111-1111-1111-111111111111',
    transactionId: 't1111111-1111-1111-1111-111111111111',
    listing: {
      id: 'l1111111-1111-1111-1111-111111111111',
      title: 'Bộ tuốc nơ vít đa năng',
      listingType: 'GIVEAWAY',
      status: 'COMPLETED',
      price: null,
      currency: null,
      city: 'TP. Hồ Chí Minh',
      owner: {
        id: '11111111-1111-1111-1111-111111111111',
        displayName: 'Chủ bài đăng',
      },
    },
    reviewer: {
      id: 'u2222222-2222-2222-2222-222222222222',
      displayName: 'Nguyễn Văn Test',
    },
    reviewee: {
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Chủ bài đăng',
    },
    rating: 5,
    comment: 'Giao dịch rất nhanh chóng, chủ món đồ nhiệt tình và đúng giờ!',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'r2222222-2222-2222-2222-222222222222',
    transactionId: 't2222222-2222-2222-2222-222222222222',
    listing: null,
    reviewer: {
      id: 'u3333333-3333-3333-3333-333333333333',
      displayName: 'Lê Thị Bình',
    },
    reviewee: {
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Chủ bài đăng',
    },
    rating: 4,
    comment: null,
    createdAt: '2026-02-20T14:30:00Z',
  },
];

function createPageResponse<T>(
  content: T[],
  page = 0,
  size = 5,
  totalElements = content.length
): PageResponse<T> {
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

describe('StarRating Component', () => {
  it('renders accessible label and correct number of stars', () => {
    renderWithProviders(<StarRating rating={4.5} size="md" />);
    const starElement = screen.getByRole('img', { name: /4\.5 trên 5 sao/i });
    expect(starElement).toBeInTheDocument();
  });

  it('renders correctly for 0 rating', () => {
    renderWithProviders(<StarRating rating={0} />);
    const starElement = screen.getByRole('img', { name: /0 trên 5 sao/i });
    expect(starElement).toBeInTheDocument();
  });
});

describe('RatingSummaryCard Component', () => {
  it('renders verified rating summary and distribution breakdown', () => {
    renderWithProviders(
      <RatingSummaryCard summary={mockSummary} userName="Chủ bài đăng" />
    );

    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText(/12 đánh giá/i)).toBeInTheDocument();
    expect(screen.getByText('Điểm uy tín người dùng')).toBeInTheDocument();
    // 5 star count is 9
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders zero-reviews empty state when totalReviews is 0', () => {
    renderWithProviders(
      <RatingSummaryCard summary={mockZeroSummary} userName="Người mới" />
    );

    expect(screen.getByText('Chưa có đánh giá nào')).toBeInTheDocument();
    expect(
      screen.getByText(/Người mới chưa nhận được đánh giá từ giao dịch nào/i)
    ).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = renderWithProviders(<RatingSummaryCard isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('handles error state with retry callback', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <RatingSummaryCard isError={true} onRetry={onRetry} userName="Chủ bài đăng" />
    );

    expect(
      screen.getByText(/Không thể tải điểm đánh giá người dùng/i)
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('UserReviewsList Component', () => {
  it('renders verified reviews list with comment, rating, author and listing reference', () => {
    renderWithProviders(
      <UserReviewsList
        reviews={mockReviews}
        totalElements={2}
        totalPages={1}
        currentPage={0}
        onPageChange={vi.fn()}
        userName="Chủ bài đăng"
      />
    );

    expect(screen.getByText('Nguyễn Văn Test')).toBeInTheDocument();
    expect(
      screen.getByText('Giao dịch rất nhanh chóng, chủ món đồ nhiệt tình và đúng giờ!')
    ).toBeInTheDocument();
    expect(screen.getByText('Bộ tuốc nơ vít đa năng')).toBeInTheDocument();

    // Fallback comment for review with null comment
    expect(screen.getByText('Lê Thị Bình')).toBeInTheDocument();
    expect(screen.getByText('Người dùng không để lại lời bình.')).toBeInTheDocument();
  });

  it('renders empty state when there are no reviews', () => {
    renderWithProviders(
      <UserReviewsList
        reviews={[]}
        totalElements={0}
        totalPages={0}
        currentPage={0}
        onPageChange={vi.fn()}
        userName="Người mới"
      />
    );

    expect(screen.getByText('Chưa có nhận xét nào')).toBeInTheDocument();
    expect(
      screen.getByText(/Người mới chưa có phản hồi nào từ các giao dịch hoàn thành/i)
    ).toBeInTheDocument();
  });

  it('supports pagination controls when multiple pages exist', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    renderWithProviders(
      <UserReviewsList
        reviews={[mockReviews[0]]}
        totalElements={2}
        totalPages={2}
        currentPage={0}
        onPageChange={onPageChange}
        userName="Chủ bài đăng"
      />
    );

    expect(
      screen.getByText((_content, element) => element?.textContent === 'Trang 1 / 2')
    ).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /Trang sau/i });
    expect(nextButton).not.toBeDisabled();

    await user.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('renders loading skeleton and error states', () => {
    const onRetry = vi.fn();
    const { container, rerender } = renderWithProviders(
      <UserReviewsList
        reviews={[]}
        totalElements={0}
        totalPages={0}
        currentPage={0}
        onPageChange={vi.fn()}
        isLoading={true}
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

    rerender(
      <UserReviewsList
        reviews={[]}
        totalElements={0}
        totalPages={0}
        currentPage={0}
        onPageChange={vi.fn()}
        isError={true}
        onRetry={onRetry}
      />
    );

    expect(
      screen.getByText(/Không thể tải danh sách nhận xét/i)
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('OwnerRatingBadge Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rating badge linking to reviews section', async () => {
    vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValue(mockSummary);

    renderWithProviders(<OwnerRatingBadge userId={mockSummary.userId} />);

    await waitFor(() => {
      expect(screen.getByText('4.7')).toBeInTheDocument();
    });

    expect(screen.getByText(/\(12 đánh giá\)/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Xem chi tiết đánh giá/i });
    expect(link).toHaveAttribute('href', '#owner-reviews');
  });

  it('renders friendly zero-review badge when user has no reviews', async () => {
    vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValue(mockZeroSummary);

    renderWithProviders(<OwnerRatingBadge userId={mockZeroSummary.userId} />);

    await waitFor(() => {
      expect(screen.getByText('Chưa có đánh giá')).toBeInTheDocument();
    });
  });
});

describe('OwnerReputationSection Integration & Failure Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reputation section with both summary card and review list', async () => {
    vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValue(mockSummary);
    vi.mocked(reviewApi.getUserReviews).mockResolvedValue(
      createPageResponse(mockReviews, 0, 5, 2)
    );

    renderWithProviders(
      <OwnerReputationSection
        userId={mockSummary.userId}
        ownerName="Nguyễn Văn A"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('4.7')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { level: 2, name: /Đánh giá & Uy tín cộng đồng/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Thông tin uy tín được ghi nhận từ thành viên Nguyễn Văn A/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Test')).toBeInTheDocument();
  });

  it('safely handles missing owner ID without throwing or crashing', () => {
    renderWithProviders(
      <OwnerReputationSection userId="" ownerName="Người lạ" />
    );

    expect(
      screen.getByText(/Không có thông tin định danh người dùng để tải đánh giá/i)
    ).toBeInTheDocument();
  });

  it('isolates review list failure so summary still displays and section does not crash', async () => {
    vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValue(mockSummary);
    vi.mocked(reviewApi.getUserReviews).mockRejectedValue(new Error('Lỗi máy chủ'));

    renderWithProviders(
      <OwnerReputationSection
        userId={mockSummary.userId}
        ownerName="Nguyễn Văn A"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('4.7')).toBeInTheDocument();
    });

    // Summary card loaded fine
    expect(screen.getByText(/12 đánh giá/i)).toBeInTheDocument();

    // Reviews list shows error banner with retry, but section didn't crash
    await waitFor(() => {
      expect(
        screen.getByText(/Không thể tải danh sách nhận xét/i)
      ).toBeInTheDocument();
    });
  });

  it('isolates summary failure so reviews still display and section does not crash', async () => {
    vi.mocked(reviewApi.getUserRatingSummary).mockRejectedValue(new Error('Lỗi'));
    vi.mocked(reviewApi.getUserReviews).mockResolvedValue(
      createPageResponse(mockReviews, 0, 5, 2)
    );

    renderWithProviders(
      <OwnerReputationSection
        userId={mockSummary.userId}
        ownerName="Nguyễn Văn A"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Test')).toBeInTheDocument();
    });

    // Error banner for summary
    await waitFor(() => {
      expect(
        screen.getByText(/Không thể tải điểm đánh giá người dùng/i)
      ).toBeInTheDocument();
    });

    // Reviews list loaded successfully
    expect(screen.getByText('Bộ tuốc nơ vít đa năng')).toBeInTheDocument();
  });
});
