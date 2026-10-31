import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { ListingDetailPage } from '../pages/ListingDetailPage';
import { ListingCard } from '../components/ListingCard';
import { listingApi } from '../api/listing-api';
import { renderWithProviders } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { ListingResponse, ListingSummaryResponse } from '@/types/listing';

vi.mock('../api/listing-api', () => ({
  listingApi: {
    getListings: vi.fn(),
    getListingById: vi.fn(),
  },
  listingKeys: {
    all: ['listings'] as const,
    lists: () => ['listings', 'list'] as const,
    list: (params: unknown) => ['listings', 'list', params] as const,
    details: () => ['listings', 'detail'] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
  },
}));

const mockGiveawayListing: ListingResponse = {
  id: 'e0000000-0000-0000-0000-000000000001',
  owner: {
    id: 'u0000000-0000-0000-0000-000000000001',
    displayName: 'Nguyễn Văn A',
  },
  category: {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Dụng cụ sửa chữa',
    slug: 'tools',
  },
  listingType: 'GIVEAWAY',
  title: 'Bộ tuốc nơ vít đa năng tặng miễn phí',
  description: 'Bộ dụng cụ còn mới 95%, đầy đủ các đầu vít phổ thông.\nAi cần dùng liên hệ mình nhé.',
  price: null,
  currency: null,
  status: 'ACTIVE',
  neighborhood: 'Thảo Điền',
  city: 'TP. Hồ Chí Minh',
  stateProvince: null,
  postalCode: null,
  country: 'Việt Nam',
  images: [
    { id: 'img-1', imageUrl: '/api/v1/files/screwdriver-1.jpg', sortOrder: 0 },
    { id: 'img-2', imageUrl: '/api/v1/files/screwdriver-2.jpg', sortOrder: 1 },
  ],
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  expiresAt: null,
};

const mockSaleListing: ListingResponse = {
  id: 'e0000000-0000-0000-0000-000000000002',
  owner: {
    id: 'u0000000-0000-0000-0000-000000000002',
    displayName: 'Trần Thị B',
  },
  category: {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Đồ gia dụng',
    slug: 'home-appliances',
  },
  listingType: 'SALE',
  title: 'Nồi chiên không dầu 5L thanh lý',
  description: 'Ít sử dụng nên thanh lý giá hạt dẻ cho bạn nào cần.',
  price: 450000,
  currency: 'VND',
  status: 'RESERVED',
  neighborhood: 'Cầu Giấy',
  city: 'Hà Nội',
  stateProvince: null,
  postalCode: null,
  country: 'Việt Nam',
  images: [
    { id: 'img-3', imageUrl: 'https://example.com/airfryer.jpg', sortOrder: 0 },
  ],
  createdAt: '2026-03-02T14:30:00Z',
  updatedAt: '2026-03-03T08:00:00Z',
  expiresAt: null,
};

const mockWantedListing: ListingResponse = {
  id: 'e0000000-0000-0000-0000-000000000003',
  owner: {
    id: 'u0000000-0000-0000-0000-000000000003',
    displayName: 'Lê Hoàng C',
  },
  category: {
    id: 'c0000000-0000-0000-0000-000000000003',
    name: 'Sách & Giáo trình',
    slug: 'books',
  },
  listingType: 'WANTED',
  title: 'Cần tìm giáo trình Giải tích 1',
  description: '',
  price: 50000,
  currency: 'VND',
  status: 'ACTIVE',
  neighborhood: null,
  city: 'Đà Nẵng',
  stateProvince: null,
  postalCode: null,
  country: 'Việt Nam',
  images: [],
  createdAt: '2026-03-04T09:00:00Z',
  updatedAt: '2026-03-04T09:00:00Z',
  expiresAt: null,
};

function renderListingDetailPage(initialUrl: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/listings/:id" element={<ListingDetailPage />} />
      <Route path="/explore" element={<div>Trang khám phá</div>} />
      <Route path="/" element={<div>Trang chủ</div>} />
    </Routes>,
    { initialEntries: [initialUrl] }
  );
}

describe('ListingDetailPage & Marketplace Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially while fetching listing data', async () => {
    // Return a pending promise that does not resolve immediately
    vi.mocked(listingApi.getListingById).mockReturnValue(new Promise(() => {}));

    renderListingDetailPage(`/listings/${mockGiveawayListing.id}`);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getAllByText('Đang tải thông tin bài đăng...').length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders giveaway listing details with correct Vietnamese labels and pricing', async () => {
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);

    renderListingDetailPage(`/listings/${mockGiveawayListing.id}`);

    // Wait for title to appear
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: mockGiveawayListing.title })
      ).toBeInTheDocument();
    });

    // Check Vietnamese listing type and giveaway price label
    expect(screen.getByText('Cho tặng')).toBeInTheDocument();
    expect(screen.getByText('Miễn phí')).toBeInTheDocument();

    // Check description with preserved formatting
    expect(screen.getByText(/Bộ dụng cụ còn mới 95%/)).toBeInTheDocument();

    // Check owner display name and reputation section (Phase 3F)
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Đánh giá & Uy tín cộng đồng/i })
    ).toBeInTheDocument();

    // Check location
    expect(screen.getByText(/Thảo Điền, TP. Hồ Chí Minh, Việt Nam/)).toBeInTheDocument();

    // Check category link
    const categoryLinks = screen.getAllByRole('link', { name: 'Dụng cụ sửa chữa' });
    expect(categoryLinks.length).toBeGreaterThanOrEqual(1);
    expect(categoryLinks[0]).toHaveAttribute('href', `/explore?categoryId=${mockGiveawayListing.category.id}`);
  });

  it('renders sale listing with formatted price, currency, and non-active status badge', async () => {
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockSaleListing);

    renderListingDetailPage(`/listings/${mockSaleListing.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: mockSaleListing.title })
      ).toBeInTheDocument();
    });

    // Check Sale type and price
    expect(screen.getByText('Thanh lý')).toBeInTheDocument();
    expect(screen.getByText(/450\.000/)).toBeInTheDocument();

    // Check non-active status badge (RESERVED -> "Đã đặt trước")
    expect(screen.getAllByText('Đã đặt trước').length).toBeGreaterThanOrEqual(1);
  });

  it('renders wanted listing with budget label and empty description fallback', async () => {
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockWantedListing);

    renderListingDetailPage(`/listings/${mockWantedListing.id}`);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: mockWantedListing.title })
      ).toBeInTheDocument();
    });

    // Wanted type and budget
    expect(screen.getByText('Cần tìm')).toBeInTheDocument();
    expect(screen.getByText('Ngân sách mong muốn')).toBeInTheDocument();

    // Fallback for missing/empty description
    expect(
      screen.getByText('Người đăng chưa cung cấp mô tả chi tiết cho bài đăng này.')
    ).toBeInTheDocument();

    // Fallback for no images
    expect(screen.getByText('Bài đăng không có hình ảnh')).toBeInTheDocument();
  });

  it('supports image gallery thumbnail switching and next/prev navigation', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);

    renderListingDetailPage(`/listings/${mockGiveawayListing.id}`);

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    // 2 images in gallery
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Click next image button
    const nextBtn = screen.getByRole('button', { name: 'Ảnh tiếp theo' });
    await user.click(nextBtn);

    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    // Click previous image button
    const prevBtn = screen.getByRole('button', { name: 'Ảnh trước' });
    await user.click(prevBtn);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Click on thumbnail 2 directly
    const thumb2 = screen.getByRole('tab', { name: 'Xem ảnh 2' });
    await user.click(thumb2);

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('renders fallback when an image fails to load', async () => {
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockSaleListing);

    renderListingDetailPage(`/listings/${mockSaleListing.id}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const img = screen.getByAltText(`Hình ảnh 1 của ${mockSaleListing.title}`);
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải hình ảnh này')).toBeInTheDocument();
    });
  });

  it('handles invalid UUID parameter safely without triggering API request', async () => {
    renderListingDetailPage('/listings/not-a-valid-uuid');

    // Should NOT call API
    expect(listingApi.getListingById).not.toHaveBeenCalled();

    // Shows invalid ID error UI
    expect(screen.getByText('Mã bài đăng không hợp lệ')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quay lại trang khám phá' })
    ).toBeInTheDocument();
  });

  it('handles 404 Not Found response gracefully with friendly Vietnamese message', async () => {
    const notFoundError = new ApiError({
      message: 'Listing not found',
      status: 404,
      error: 'Not Found',
    });
    vi.mocked(listingApi.getListingById).mockRejectedValue(notFoundError);

    renderListingDetailPage(`/listings/${mockGiveawayListing.id}`);

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy bài đăng')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Bài đăng này không tồn tại hoặc đã được gỡ bỏ khỏi hệ thống.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quay lại trang khám phá' })
    ).toBeInTheDocument();
  });

  it('handles server or network error with retry button and triggers refetch', async () => {
    const user = userEvent.setup();
    const serverError = new ApiError({
      message: 'Internal server error',
      status: 500,
      error: 'Internal Server Error',
    });
    vi.mocked(listingApi.getListingById).mockRejectedValueOnce(serverError);

    renderListingDetailPage(`/listings/${mockGiveawayListing.id}`);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải thông tin bài đăng')).toBeInTheDocument();
    });

    // Provide mock success on second call
    vi.mocked(listingApi.getListingById).mockResolvedValueOnce(mockGiveawayListing);

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: mockGiveawayListing.title })
      ).toBeInTheDocument();
    });
  });

  it('navigates back to previous page or marketplace when back button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);

    renderWithProviders(
      <Routes>
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/explore" element={<div>Trang khám phá</div>} />
      </Routes>,
      { initialEntries: ['/explore', `/listings/${mockGiveawayListing.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: 'Quay lại' });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Trang khám phá')).toBeInTheDocument();
    });
  });

  it('navigates to detail page when clicking on ListingCard', async () => {
    const sampleSummary: ListingSummaryResponse = {
      id: 'e0000000-0000-0000-0000-000000000001',
      owner: { id: 'u1', displayName: 'Nguyễn Văn A' },
      category: { id: 'c1', name: 'Đồ dùng', slug: 'items' },
      listingType: 'GIVEAWAY',
      title: 'Bài đăng mẫu',
      price: null,
      currency: null,
      status: 'ACTIVE',
      city: 'TP. Hồ Chí Minh',
      country: 'Việt Nam',
      primaryImageUrl: null,
      createdAt: '2026-03-01T10:00:00Z',
    };

    renderWithProviders(
      <ListingCard listing={sampleSummary} />
    );

    const cardLink = screen.getByRole('link', {
      name: /Xem chi tiết bài đăng: Bài đăng mẫu/i,
    });
    expect(cardLink).toHaveAttribute('href', `/listings/${sampleSummary.id}`);
  });
});
