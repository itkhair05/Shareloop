import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplorePlaceholderPage } from '../ExplorePlaceholderPage';
import { categoryApi } from '@/features/categories/api/category-api';
import { listingApi } from '@/features/listings/api/listing-api';
import { renderWithProviders } from '@/test/test-utils';
import type { CategoryResponse } from '@/types/category';
import type { PageResponse } from '@/types/api';
import type { ListingSummaryResponse } from '@/types/listing';

vi.mock('@/features/categories/api/category-api', () => ({
  categoryApi: {
    getCategories: vi.fn(),
    getCategoryBySlug: vi.fn(),
  },
  categoryKeys: {
    all: ['categories'] as const,
    lists: () => ['categories', 'list'] as const,
    detail: (slug: string) => ['categories', 'detail', slug] as const,
  },
}));

vi.mock('@/features/listings/api/listing-api', () => ({
  listingApi: {
    getListings: vi.fn(),
  },
  listingKeys: {
    all: ['listings'] as const,
    lists: () => ['listings', 'list'] as const,
    list: (params: unknown) => ['listings', 'list', params] as const,
    details: () => ['listings', 'detail'] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
  },
}));

const mockCategories: CategoryResponse[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Dụng cụ & Đồ sửa chữa',
    slug: 'tools-diy',
    description: 'Dụng cụ sửa chữa và làm vườn gia đình',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Điện tử & Đồ gia dụng',
    slug: 'electronics-appliances',
    description: 'Đồ điện tử và thiết bị gia dụng',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockListingsPage: PageResponse<ListingSummaryResponse> = {
  content: [
    {
      id: 'l0000000-0000-0000-0000-000000000001',
      owner: { id: 'u1', displayName: 'Nguyễn Văn A' },
      category: { id: 'a0000000-0000-0000-0000-000000000001', name: 'Dụng cụ & Đồ sửa chữa', slug: 'tools-diy' },
      listingType: 'GIVEAWAY',
      title: 'Máy khoan pin cầm tay Bosch',
      price: null,
      currency: 'VND',
      status: 'ACTIVE',
      city: 'Hà Nội',
      country: 'Vietnam',
      primaryImageUrl: '/api/v1/files/drill.jpg',
      createdAt: '2026-02-10T10:00:00Z',
    },
    {
      id: 'l0000000-0000-0000-0000-000000000002',
      owner: { id: 'u2', displayName: 'Trần Thị B' },
      category: { id: 'a0000000-0000-0000-0000-000000000002', name: 'Electronics & Appliances', slug: 'electronics-appliances' },
      listingType: 'SALE',
      title: 'Nồi chiên không dầu Philips',
      price: 450000,
      currency: 'VND',
      status: 'ACTIVE',
      city: 'TP. Hồ Chí Minh',
      country: 'Vietnam',
      primaryImageUrl: null,
      createdAt: '2026-02-11T14:30:00Z',
    },
  ],
  totalElements: 2,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockMultiPageListings: PageResponse<ListingSummaryResponse> = {
  content: mockListingsPage.content,
  totalElements: 45,
  totalPages: 3,
  size: 20,
  number: 0,
  first: true,
  last: false,
  empty: false,
};

const emptyListingsPage: PageResponse<ListingSummaryResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('ExplorePlaceholderPage - Search, Filter & Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoryApi.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(listingApi.getListings).mockResolvedValue(mockListingsPage);
  });

  it('renders search input, city input, type selectors, category options, and cleaned page heading', async () => {
    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore'] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /khám phá đồ dùng cộng đồng/i })).toBeInTheDocument();
    });

    // Verify internal progress label has been removed
    expect(screen.queryByText(/kế hoạch giai đoạn/i)).not.toBeInTheDocument();

    expect(screen.getByPlaceholderText(/tìm kiếm theo tên món đồ/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/lọc theo thành phố/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tất cả hình thức/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cho tặng$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^thanh lý$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cần tìm$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tất cả danh mục/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Dụng cụ & Đồ sửa chữa' })).toBeInTheDocument();

    // Verify initial query sends default page 0 and size 20
    expect(listingApi.getListings).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 20 })
    );
  });

  it('applies keyword search with debouncing and queries listings with keyword parameter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore'] });

    const searchInput = screen.getByPlaceholderText(/tìm kiếm theo tên món đồ/i);
    await user.type(searchInput, 'máy khoan');

    // Wait for debounced sync (300ms)
    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'máy khoan', page: 0, size: 20 })
      );
    });

    // Verify active filter chip displays
    expect(screen.getByText(/từ khóa:/i)).toBeInTheDocument();
    expect(screen.getByText('máy khoan')).toBeInTheDocument();

    // Clear search using clear button
    const clearBtn = screen.getByRole('button', { name: /xóa từ khóa tìm kiếm/i });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, size: 20 })
      );
    });
  });

  it('filters listings by listing type when clicking type selectors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore'] });

    // Click "Cho tặng"
    const giveawayBtn = screen.getByRole('button', { name: /^cho tặng$/i });
    await user.click(giveawayBtn);

    expect(listingApi.getListings).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GIVEAWAY', page: 0, size: 20 })
    );
    expect(screen.getByText('Hình thức:')).toBeInTheDocument();

    // Click "Thanh lý"
    const saleBtn = screen.getByRole('button', { name: /^thanh lý$/i });
    await user.click(saleBtn);

    expect(listingApi.getListings).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SALE', page: 0, size: 20 })
    );

    // Click "Tất cả hình thức" to reset type filter
    const allTypesBtn = screen.getByRole('button', { name: /tất cả hình thức/i });
    await user.click(allTypesBtn);

    expect(listingApi.getListings).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 20 })
    );
  });

  it('filters listings by city input with debouncing and supports clearing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore'] });

    const cityInput = screen.getByPlaceholderText(/lọc theo thành phố/i);
    await user.type(cityInput, 'Hà Nội');

    // Wait for debounced sync
    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Hà Nội', page: 0, size: 20 })
      );
    });

    expect(screen.getByText(/khu vực:/i)).toBeInTheDocument();
    expect(screen.getByText('Hà Nội')).toBeInTheDocument();

    // Clear city
    const clearCityBtn = screen.getByRole('button', { name: /xóa lọc thành phố/i });
    await user.click(clearCityBtn);

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, size: 20 })
      );
    });
  });

  it('combines multiple filters and resets pagination to page 0 on filter change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore?page=2'] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dụng cụ & Đồ sửa chữa' })).toBeInTheDocument();
    });

    // 1. Select Category -> should reset page to 0
    await user.click(screen.getByRole('button', { name: 'Dụng cụ & Đồ sửa chữa' }));

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'a0000000-0000-0000-0000-000000000001',
          page: 0,
        })
      );
    });

    // 2. Select Type "Cho tặng"
    await user.click(screen.getByRole('button', { name: /^cho tặng$/i }));

    // 3. Type City "Hà Nội"
    const cityInput = screen.getByPlaceholderText(/lọc theo thành phố/i);
    await user.type(cityInput, 'Hà Nội');

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith({
        categoryId: 'a0000000-0000-0000-0000-000000000001',
        type: 'GIVEAWAY',
        city: 'Hà Nội',
        page: 0,
        size: 20,
      });
    });

    // Verify all active chips are visible
    expect(screen.getByText(/danh mục:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Dụng cụ & Đồ sửa chữa').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Hình thức:')).toBeInTheDocument();
    expect(screen.getByText(/khu vực:/i)).toBeInTheDocument();

    // Reset all filters via "Xóa tất cả bộ lọc"
    const resetAllBtn = screen.getByRole('button', { name: /xóa tất cả bộ lọc/i });
    await user.click(resetAllBtn);

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith({
        page: 0,
        size: 20,
      });
    });
  });

  it('safely handles invalid categoryId, invalid type, and invalid page in URL', async () => {
    renderWithProviders(<ExplorePlaceholderPage />, {
      initialEntries: ['/explore?categoryId=not-a-uuid&type=INVALID_TYPE_ENUM&page=invalid-page'],
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /khám phá đồ dùng cộng đồng/i })).toBeInTheDocument();
    });

    // Should call getListings with default page 0 and without invalid categoryId or type
    expect(listingApi.getListings).toHaveBeenCalledWith({
      page: 0,
      size: 20,
    });
  });

  it('renders helpful empty state when filters match no listings and offers action to reset filters', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getListings).mockResolvedValue(emptyListingsPage);

    renderWithProviders(<ExplorePlaceholderPage />, {
      initialEntries: ['/explore?keyword=khongcotronthegioi&type=SALE'],
    });

    await waitFor(() => {
      expect(screen.getByText(/không tìm thấy bài đăng phù hợp/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/không có kết quả nào khớp với các tiêu chí tìm kiếm/i)
    ).toBeInTheDocument();

    // Click "Xóa tất cả bộ lọc"
    const resetBtns = screen.getAllByRole('button', { name: /xóa tất cả bộ lọc/i });
    expect(resetBtns.length).toBeGreaterThanOrEqual(1);
    await user.click(resetBtns[0]);

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith({
        page: 0,
        size: 20,
      });
    });
  });

  it('renders backend-driven pagination controls when totalPages > 1 and navigates between pages', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getListings).mockResolvedValue(mockMultiPageListings);

    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore'] });

    await waitFor(() => {
      expect(screen.getByText(/trang 1 trên tổng số 3 trang/i)).toBeInTheDocument();
    });

    // Summary displays correct items range
    expect(screen.getByText(/hiển thị 1 - 20 trên 45 bài đăng/i)).toBeInTheDocument();

    // First page: Previous button is disabled, Next is enabled
    const prevBtn = screen.getByRole('button', { name: /trang trước/i });
    const nextBtn = screen.getByRole('button', { name: /trang sau/i });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Page number buttons are visible
    const page2Btn = screen.getByRole('button', { name: /đến trang 2/i });
    expect(page2Btn).toBeInTheDocument();

    // Click "Sau" to navigate to page 1 (0-indexed)
    await user.click(nextBtn);

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, size: 20 })
      );
    });
  });

  it('preserves active filters when navigating between pages and disables next button on last page', async () => {
    const user = userEvent.setup();
    const lastPageResponse: PageResponse<ListingSummaryResponse> = {
      ...mockMultiPageListings,
      number: 2,
      first: false,
      last: true,
    };
    vi.mocked(listingApi.getListings).mockResolvedValue(lastPageResponse);

    renderWithProviders(<ExplorePlaceholderPage />, {
      initialEntries: ['/explore?city=H%C3%A0%20N%E1%BB%99i&type=SALE&page=2'],
    });

    await waitFor(() => {
      expect(screen.getByText(/trang 3 trên tổng số 3 trang/i)).toBeInTheDocument();
    });

    // Next button should be disabled on last page
    const nextBtn = screen.getByRole('button', { name: /trang sau/i });
    expect(nextBtn).toBeDisabled();

    // Previous button should be enabled
    const prevBtn = screen.getByRole('button', { name: /trang trước/i });
    expect(prevBtn).toBeEnabled();

    // Click Previous -> navigates to page 1, preserving filters
    await user.click(prevBtn);

    await waitFor(() => {
      expect(listingApi.getListings).toHaveBeenCalledWith({
        city: 'Hà Nội',
        type: 'SALE',
        page: 1,
        size: 20,
      });
    });
  });

  it('hides pagination controls when totalPages is 1', async () => {
    vi.mocked(listingApi.getListings).mockResolvedValue(mockListingsPage); // totalPages: 1

    renderWithProviders(<ExplorePlaceholderPage />, { initialEntries: ['/explore'] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /khám phá đồ dùng cộng đồng/i })).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/phân trang bài đăng/i)).not.toBeInTheDocument();
  });
});
