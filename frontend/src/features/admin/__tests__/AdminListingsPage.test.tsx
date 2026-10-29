import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminListingsPage } from '../AdminListingsPage';
import { adminListingsApi } from '../api/admin-listings-api';
import { categoryApi } from '@/features/categories/api/category-api';
import { renderWithProviders } from '@/test/test-utils';
import type { AdminListingsPageResponse, ListingResponse } from '@/types/admin-listing';
import type { CategoryResponse } from '@/types/category';

vi.mock('../api/admin-listings-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-listings-api')>();
  return {
    ...actual,
    adminListingsApi: {
      ...actual.adminListingsApi,
      getAdminListings: vi.fn(),
      getAdminListingDetail: vi.fn(),
      deleteListing: vi.fn(),
    },
  };
});

vi.mock('@/features/categories/api/category-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/categories/api/category-api')>();
  return {
    ...actual,
    categoryApi: {
      ...actual.categoryApi,
      getCategories: vi.fn(),
    },
  };
});

const mockCategories: CategoryResponse[] = [
  { id: 'cat-1', name: 'Đồ điện tử', slug: 'do-dien-tu', description: 'Thiết bị điện tử', isActive: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'cat-2', name: 'Sách & Truyện', slug: 'sach-truyen', description: 'Sách giáo khoa, truyện', isActive: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
];

const mockActiveListing: ListingResponse = {
  id: 'listing-active-1',
  title: 'Bàn phím cơ DareU EK87',
  description: 'Bàn phím cơ quang học mới 99%',
  price: 350000,
  currency: 'VND',
  status: 'ACTIVE',
  listingType: 'SALE',
  category: { id: 'cat-1', name: 'Đồ điện tử', slug: 'do-dien-tu' },
  owner: { id: 'owner-1', displayName: 'Nguyễn Văn A' },
  neighborhood: 'Hải Châu',
  city: 'Đà Nẵng',
  stateProvince: 'Đà Nẵng',
  postalCode: '550000',
  country: 'VN',
  images: [{ id: 'img-1', imageUrl: 'https://example.com/keyboard.jpg', sortOrder: 0 }],
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  expiresAt: null,
};

const mockDraftListing: ListingResponse = {
  id: 'listing-draft-2',
  title: 'Sách giải tích đại học',
  description: 'Sách toán tặng miễn phí cho tân sinh viên',
  price: null,
  currency: null,
  status: 'DRAFT',
  listingType: 'GIVEAWAY',
  category: { id: 'cat-2', name: 'Sách & Truyện', slug: 'sach-truyen' },
  owner: { id: 'owner-2', displayName: 'Trần Thị B' },
  neighborhood: 'Thanh Khê',
  city: 'Đà Nẵng',
  stateProvince: 'Đà Nẵng',
  postalCode: '550000',
  country: 'VN',
  images: [],
  createdAt: '2026-10-21T11:00:00Z',
  updatedAt: '2026-10-21T11:00:00Z',
  expiresAt: null,
};

const mockReservedListing: ListingResponse = {
  id: 'listing-reserved-3',
  title: 'Tai nghe Bluetooth Sony',
  description: 'Đang giao dịch với người mua',
  price: 1500000,
  currency: 'VND',
  status: 'RESERVED',
  listingType: 'SALE',
  category: { id: 'cat-1', name: 'Đồ điện tử', slug: 'do-dien-tu' },
  owner: { id: 'owner-1', displayName: 'Nguyễn Văn A' },
  neighborhood: 'Hải Châu',
  city: 'Đà Nẵng',
  stateProvince: 'Đà Nẵng',
  postalCode: '550000',
  country: 'VN',
  images: [],
  createdAt: '2026-10-22T12:00:00Z',
  updatedAt: '2026-10-22T12:00:00Z',
  expiresAt: null,
};

const mockCompletedListing: ListingResponse = {
  id: 'listing-completed-4',
  title: 'Màn hình máy tính 24 inch',
  description: 'Đã hoàn tất trao đổi thành công',
  price: 2000000,
  currency: 'VND',
  status: 'COMPLETED',
  listingType: 'SALE',
  category: { id: 'cat-1', name: 'Đồ điện tử', slug: 'do-dien-tu' },
  owner: { id: 'owner-3', displayName: 'Lê Văn C' },
  neighborhood: 'Cẩm Lệ',
  city: 'Đà Nẵng',
  stateProvince: 'Đà Nẵng',
  postalCode: '550000',
  country: 'VN',
  images: [],
  createdAt: '2026-10-18T08:00:00Z',
  updatedAt: '2026-10-19T09:00:00Z',
  expiresAt: null,
};

const mockRemovedListing: ListingResponse = {
  id: 'listing-removed-5',
  title: 'Điện thoại hỏng bán xác',
  description: 'Đã bị gỡ bỏ do vi phạm quy chuẩn',
  price: 100000,
  currency: 'VND',
  status: 'REMOVED',
  listingType: 'SALE',
  category: { id: 'cat-1', name: 'Đồ điện tử', slug: 'do-dien-tu' },
  owner: { id: 'owner-2', displayName: 'Trần Thị B' },
  neighborhood: 'Sơn Trà',
  city: 'Đà Nẵng',
  stateProvince: 'Đà Nẵng',
  postalCode: '550000',
  country: 'VN',
  images: [],
  createdAt: '2026-10-15T08:00:00Z',
  updatedAt: '2026-10-16T09:00:00Z',
  expiresAt: null,
};

const mockPageResponse: AdminListingsPageResponse = {
  content: [mockActiveListing, mockDraftListing, mockReservedListing, mockCompletedListing, mockRemovedListing],
  totalElements: 5,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

describe('AdminListingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoryApi.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(adminListingsApi.getAdminListings).mockResolvedValue(mockPageResponse);
    vi.mocked(adminListingsApi.getAdminListingDetail).mockResolvedValue(mockActiveListing);
    vi.mocked(adminListingsApi.deleteListing).mockResolvedValue();
  });

  it('renders page header, count badge, and listing items correctly', async () => {
    renderWithProviders(<AdminListingsPage />);

    expect(screen.getByRole('heading', { name: /Quản lý tin đăng/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('5 tin đăng')).toBeInTheDocument();
      expect(screen.getByText('Bàn phím cơ DareU EK87')).toBeInTheDocument();
      expect(screen.getByText('Sách giải tích đại học')).toBeInTheDocument();
      expect(screen.getByText('Tai nghe Bluetooth Sony')).toBeInTheDocument();
      expect(screen.getByText('Màn hình máy tính 24 inch')).toBeInTheDocument();
      expect(screen.getByText('Điện thoại hỏng bán xác')).toBeInTheDocument();
    });

    // Check owner display names
    expect(screen.getAllByText('Nguyễn Văn A')).toHaveLength(2);
    expect(screen.getAllByText('Trần Thị B')).toHaveLength(2);
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument();
  });

  it('handles debounced keyword search input and clear action', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminListingsPage />);

    const searchInput = screen.getByPlaceholderText(/Tìm theo tiêu đề tin đăng, mô tả\.\.\./i);
    await user.type(searchInput, 'bàn phím');

    await waitFor(
      () => {
        expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
          expect.objectContaining({
            keyword: 'bàn phím',
            page: 0,
          })
        );
      },
      { timeout: 1000 }
    );

    // Click clear button
    const clearBtn = screen.getByLabelText(/Xóa từ khóa tìm kiếm/i);
    await user.click(clearBtn);

    expect(searchInput).toHaveValue('');
    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: undefined,
          page: 0,
        })
      );
    });
  });

  it('filters by status when clicking status chips', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ DareU EK87')).toBeInTheDocument();
    });

    // Click "Đang hiển thị" chip
    const activeChip = screen.getByRole('button', { name: 'Đang hiển thị' });
    await user.click(activeChip);

    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ACTIVE',
          page: 0,
        })
      );
    });

    // Click "Đã gỡ" chip
    const removedChip = screen.getByRole('button', { name: 'Đã gỡ' });
    await user.click(removedChip);

    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REMOVED',
          page: 0,
        })
      );
    });

    // Click "Tất cả trạng thái" chip (should omit status parameter)
    const allChip = screen.getByRole('button', { name: 'Tất cả trạng thái' });
    await user.click(allChip);

    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          status: undefined,
          page: 0,
        })
      );
    });
  });

  it('filters by type and category dropdowns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ DareU EK87')).toBeInTheDocument();
    });

    // Change type filter
    const typeSelect = screen.getByRole('combobox', { name: /Lọc theo hình thức/i });
    await user.selectOptions(typeSelect, 'GIVEAWAY');

    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GIVEAWAY',
          page: 0,
        })
      );
    });

    // Change category filter
    const categorySelect = screen.getByRole('combobox', { name: /Lọc theo danh mục/i });
    await user.selectOptions(categorySelect, 'cat-1');

    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'cat-1',
          page: 0,
        })
      );
    });
  });

  it('handles empty results state', async () => {
    vi.mocked(adminListingsApi.getAdminListings).mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: true,
    });

    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy tin đăng nào/i)).toBeInTheDocument();
    });
  });

  it('handles error state and retries on button click', async () => {
    const user = userEvent.setup();
    vi.mocked(adminListingsApi.getAdminListings).mockRejectedValueOnce(new Error('Lỗi máy chủ 500'));

    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải danh sách tin đăng/i)).toBeInTheDocument();
      expect(screen.getByText('Lỗi máy chủ 500')).toBeInTheDocument();
    });

    // Retry
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    vi.mocked(adminListingsApi.getAdminListings).mockResolvedValueOnce(mockPageResponse);
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ DareU EK87')).toBeInTheDocument();
    });
  });

  it('opens and closes listing detail modal with full metadata', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ DareU EK87')).toBeInTheDocument();
    });

    const viewButton = screen.getByRole('button', { name: /Xem chi tiết tin đăng Bàn phím cơ DareU EK87/i });
    fireEvent.click(viewButton);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByRole('heading', { name: 'Chi tiết tin đăng' })).toBeInTheDocument();
      expect(within(dialog).getByText('Mô tả chi tiết:')).toBeInTheDocument();
      expect(within(dialog).getByText('Bàn phím cơ quang học mới 99%')).toBeInTheDocument();
      expect(within(dialog).getByText('Đồ điện tử')).toBeInTheDocument();
      expect(within(dialog).getByText(/Hải Châu, Đà Nẵng/i)).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Đóng cửa sổ chi tiết/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Chi tiết tin đăng/i })).not.toBeInTheDocument();
    });
  });

  it('enforces deletion invariant: allows deletion of ACTIVE listing with confirmation dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ DareU EK87')).toBeInTheDocument();
    });

    // Click delete on active listing
    const deleteButton = screen.getByLabelText(/Gỡ bỏ tin đăng Bàn phím cơ DareU EK87/i);
    expect(deleteButton).not.toBeDisabled();
    await user.click(deleteButton);

    // Confirm dialog appears
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Gỡ bỏ tin đăng/i })).toBeInTheDocument();
      expect(screen.getByText(/Bạn có chắc chắn muốn gỡ bỏ tin đăng/i)).toBeInTheDocument();
    });

    // Confirm action
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận gỡ tin/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminListingsApi.deleteListing).toHaveBeenCalledWith('listing-active-1');
      expect(screen.getByText(/Đã xử lý gỡ bỏ tin đăng "Bàn phím cơ DareU EK87" thành công\./i)).toBeInTheDocument();
    });
  });

  it('enforces deletion invariant: disables deletion for RESERVED, COMPLETED, and REMOVED listings', async () => {
    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Tai nghe Bluetooth Sony')).toBeInTheDocument();
      expect(screen.getByText('Màn hình máy tính 24 inch')).toBeInTheDocument();
      expect(screen.getByText('Điện thoại hỏng bán xác')).toBeInTheDocument();
    });

    // RESERVED listing
    const reservedDeleteBtn = screen.getByLabelText(/Gỡ bỏ tin đăng Tai nghe Bluetooth Sony/i);
    expect(reservedDeleteBtn).toBeDisabled();
    expect(reservedDeleteBtn).toHaveAttribute(
      'title',
      expect.stringContaining('RESERVED')
    );

    // COMPLETED listing
    const completedDeleteBtn = screen.getByLabelText(/Gỡ bỏ tin đăng Màn hình máy tính 24 inch/i);
    expect(completedDeleteBtn).toBeDisabled();
    expect(completedDeleteBtn).toHaveAttribute(
      'title',
      expect.stringContaining('COMPLETED')
    );

    // REMOVED listing
    const removedDeleteBtn = screen.getByLabelText(/Gỡ bỏ tin đăng Điện thoại hỏng bán xác/i);
    expect(removedDeleteBtn).toBeDisabled();
    expect(removedDeleteBtn).toHaveAttribute(
      'title',
      expect.stringContaining('đã được gỡ bỏ trước đó')
    );
  });

  it('supports pagination navigation when totalPages > 1', async () => {
    const user = userEvent.setup();
    vi.mocked(adminListingsApi.getAdminListings).mockResolvedValue({
      ...mockPageResponse,
      totalElements: 40,
      totalPages: 2,
    });

    renderWithProviders(<AdminListingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Hiển thị trang/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sau/i })).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /Sau/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(adminListingsApi.getAdminListings).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });
});
