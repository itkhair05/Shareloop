import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { CreateListingPage } from '../pages/CreateListingPage';
import { EditListingPage } from '../pages/EditListingPage';
import { listingApi } from '../api/listing-api';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type { ListingResponse } from '@/types/listing';
import type { CategoryResponse } from '@/types/category';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('../api/listing-api', () => ({
  listingApi: {
    getListings: vi.fn(),
    getListingById: vi.fn(),
    getMyListings: vi.fn(),
    createListing: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    uploadImage: vi.fn(),
  },
  listingKeys: {
    all: ['listings'] as const,
    lists: () => ['listings', 'list'] as const,
    list: (params: unknown) => ['listings', 'list', params] as const,
    details: () => ['listings', 'detail'] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
    mines: () => ['listings', 'mine'] as const,
    mine: (params: unknown) => ['listings', 'mine', params] as const,
  },
}));

vi.mock('@/features/categories/hooks/use-categories', () => ({
  useCategories: vi.fn(),
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockCategories: CategoryResponse[] = [
  {
    id: 'cat-1',
    name: 'Đồ gia dụng',
    slug: 'home-appliances',
    description: 'Đồ dùng trong nhà',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    name: 'Dụng cụ sửa chữa',
    slug: 'tools',
    description: 'Dụng cụ cơ khí, điện',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockExistingListing: ListingResponse = {
  id: 'a0000000-0000-0000-0000-000000000001',
  owner: { id: 'user-1', displayName: 'Nguyễn Văn A' },
  category: { id: 'cat-1', name: 'Đồ gia dụng', slug: 'home-appliances' },
  listingType: 'SALE',
  title: 'Nồi cơm điện Cuckoo 1.8L',
  description: 'Nồi cơm điện dùng tốt, lòng nồi chống dính không trầy xước.',
  price: 500000,
  currency: 'VND',
  size: '1.8L',
  condition: 'USED',
  quantity: 2,
  status: 'ACTIVE',
  neighborhood: 'Phường 25',
  city: 'Bình Thạnh',
  stateProvince: 'TP. Hồ Chí Minh',
  postalCode: '70000',
  country: 'VN',
  images: [
    { id: 'img-1', imageUrl: '/api/v1/files/cuckoo-1.jpg', sortOrder: 0 },
  ],
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  expiresAt: null,
};

describe('CreateListingPage & ListingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        displayName: 'Nguyễn Văn A',
        email: 'vana@shareloop.org',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(useCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<CategoryResponse[], Error>);
  });

  it('renders form fields with loaded categories', () => {
    renderWithProviders(<CreateListingPage />);

    expect(screen.getByRole('heading', { name: /^đăng bài mới$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tiêu đề bài đăng/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mô tả chi tiết/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/danh mục/i)).toBeInTheDocument();

    // Check categories populated
    expect(screen.getByRole('option', { name: /đồ gia dụng/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /dụng cụ sửa chữa/i })).toBeInTheDocument();
  });

  it('validates required fields on submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateListingPage />);

    const submitBtn = screen.getByRole('button', { name: /^đăng bài ngay$/i });
    await user.click(submitBtn);

    expect(screen.getByText(/vui lòng nhập tiêu đề bài đăng/i)).toBeInTheDocument();
    expect(screen.getByText(/vui lòng chọn danh mục cho món đồ/i)).toBeInTheDocument();
    expect(listingApi.createListing).not.toHaveBeenCalled();
  });

  it('validates price for SALE listing type and resets for GIVEAWAY', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateListingPage />);

    // By default GIVEAWAY has no price input
    expect(screen.queryByLabelText(/giá bán/i)).not.toBeInTheDocument();

    // Select SALE type
    const saleBtn = screen.getByRole('button', { name: /thanh lý/i });
    await user.click(saleBtn);

    // Price input appears
    const priceInput = screen.getByLabelText(/giá bán \(vnd\)/i);
    expect(priceInput).toBeInTheDocument();

    // Fill title & category but leave price empty
    await user.type(screen.getByLabelText(/tiêu đề bài đăng/i), 'Bộ bàn ghế gỗ');
    await user.selectOptions(screen.getByLabelText(/danh mục/i), 'cat-1');

    await user.click(screen.getByRole('button', { name: /^đăng bài ngay$/i }));
    expect(screen.getByText(/yêu cầu giá bán lớn hơn 0/i)).toBeInTheDocument();
    expect(listingApi.createListing).not.toHaveBeenCalled();

    // Switch back to GIVEAWAY -> price input disappears
    const giveawayBtn = screen.getByRole('button', { name: /cho tặng/i });
    await user.click(giveawayBtn);
    expect(screen.queryByLabelText(/giá bán/i)).not.toBeInTheDocument();
  });

  it('validates image file types and size before upload', async () => {
    renderWithProviders(<CreateListingPage />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // 1. Invalid mime type (PDF)
    const invalidFile = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(
      screen.getByText(/định dạng hình ảnh không hợp lệ\. chỉ chấp nhận tệp jpeg hoặc png\./i)
    ).toBeInTheDocument();
    expect(listingApi.uploadImage).not.toHaveBeenCalled();

    // 2. Oversized file (> 5MB)
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'large-photo.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(screen.getByText(/dung lượng tệp "large-photo\.jpg" vượt quá 5 mb\./i)).toBeInTheDocument();
    expect(listingApi.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads valid image, displays preview, and submits listing successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.uploadImage).mockResolvedValue({
      id: 'img-new-1',
      filename: 'sample.jpg',
      contentType: 'image/jpeg',
      size: 10240,
      url: '/api/v1/files/sample.jpg',
    });

    vi.mocked(listingApi.createListing).mockResolvedValue({
      ...mockExistingListing,
      id: 'b0000000-0000-0000-0000-000000000002',
      title: 'Ấm siêu tốc Philips',
    });

    renderWithProviders(<CreateListingPage />);

    // Fill form
    await user.type(screen.getByLabelText(/tiêu đề bài đăng/i), 'Ấm siêu tốc Philips');
    await user.type(screen.getByLabelText(/mô tả chi tiết/i), 'Ấm siêu tốc dùng tốt 1.5L');
    await user.selectOptions(screen.getByLabelText(/danh mục/i), 'cat-1');
    await user.type(screen.getByLabelText(/thành phố \/ tỉnh/i), 'Hà Nội');
    await user.type(screen.getByLabelText(/khu vực \/ quận huyện/i), 'Cầu Giấy');

    // Upload image
    const validFile = new File(['valid image bytes'], 'sample.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(listingApi.uploadImage).toHaveBeenCalledWith(validFile);
    });

    // Preview should appear
    expect(screen.getByAltText(/ảnh tải lên 1/i)).toBeInTheDocument();

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /^đăng bài ngay$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(listingApi.createListing).toHaveBeenCalledWith({
        listingType: 'GIVEAWAY',
        title: 'Ấm siêu tốc Philips',
        description: 'Ấm siêu tốc dùng tốt 1.5L',
        categoryId: 'cat-1',
        price: null,
        currency: null,
        size: null,
        condition: null,
        quantity: null,
        city: 'Hà Nội',
        neighborhood: 'Cầu Giấy',
        stateProvince: null,
        postalCode: null,
        country: 'VN',
        images: [{ imageUrl: '/api/v1/files/sample.jpg', sortOrder: 0 }],
      });
    });
  });

  it('submits optional size, condition, and quantity specifications', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.createListing).mockResolvedValue({
      ...mockExistingListing,
      id: 'b0000000-0000-0000-0000-000000000003',
    });

    renderWithProviders(<CreateListingPage />);

    await user.type(screen.getByLabelText(/tiêu đề bài đăng/i), 'Bàn phím cơ');
    await user.type(screen.getByLabelText(/mô tả chi tiết/i), 'Bàn phím còn tốt');
    await user.selectOptions(screen.getByLabelText(/danh mục/i), 'cat-2');
    await user.type(screen.getByLabelText(/thành phố \/ tỉnh/i), 'Đà Nẵng');
    await user.type(screen.getByLabelText(/kích thước \/ size/i), '40 x 15 cm');
    await user.selectOptions(screen.getByLabelText(/tình trạng/i), 'USED');
    await user.type(screen.getByLabelText(/số lượng/i), '3');

    await user.click(screen.getByRole('button', { name: /^đăng bài ngay$/i }));

    await waitFor(() => {
      expect(listingApi.createListing).toHaveBeenCalledWith(
        expect.objectContaining({
          size: '40 x 15 cm',
          condition: 'USED',
          quantity: 3,
        })
      );
    });
  });

  it('validates non-positive quantity before submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateListingPage />);

    await user.type(screen.getByLabelText(/tiêu đề bài đăng/i), 'Bàn phím cơ');
    await user.type(screen.getByLabelText(/mô tả chi tiết/i), 'Bàn phím còn tốt');
    await user.selectOptions(screen.getByLabelText(/danh mục/i), 'cat-2');
    await user.type(screen.getByLabelText(/thành phố \/ tỉnh/i), 'Đà Nẵng');
    await user.type(screen.getByLabelText(/số lượng/i), '0');

    await user.click(screen.getByRole('button', { name: /^đăng bài ngay$/i }));

    expect(screen.getByText(/số lượng phải là số nguyên lớn hơn 0/i)).toBeInTheDocument();
    expect(listingApi.createListing).not.toHaveBeenCalled();
  });

  it('navigates back to /my-listings when clicking Quay lại button', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/listings/new" element={<CreateListingPage />} />
        <Route path="/my-listings" element={<div>Trang bài đăng của tôi</div>} />
      </Routes>,
      { initialEntries: ['/listings/new'] }
    );

    const backBtn = screen.getByRole('button', { name: /^quay lại$/i });
    expect(backBtn).toHaveClass('flex-row');
    await user.click(backBtn);

    expect(screen.getByText('Trang bài đăng của tôi')).toBeInTheDocument();
  });
});

describe('EditListingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        displayName: 'Nguyễn Văn A',
        email: 'vana@shareloop.org',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(useCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<CategoryResponse[], Error>);
  });

  it('prepopulates form with existing listing data and saves changes', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockExistingListing);
    vi.mocked(listingApi.updateListing).mockResolvedValue({
      ...mockExistingListing,
      title: 'Nồi cơm điện Cuckoo 1.8L (Đã cập nhật)',
    });

    renderWithProviders(
      <Routes>
        <Route path="/listings/:id/edit" element={<EditListingPage />} />
      </Routes>,
      { initialEntries: ['/listings/a0000000-0000-0000-0000-000000000001/edit'] }
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /chỉnh sửa bài đăng/i })).toBeInTheDocument();
    });

    // Check prepopulated inputs
    const titleInput = screen.getByLabelText(/tiêu đề bài đăng/i);
    expect(titleInput).toHaveValue('Nồi cơm điện Cuckoo 1.8L');
    expect(screen.getByLabelText(/mô tả chi tiết/i)).toHaveValue(
      'Nồi cơm điện dùng tốt, lòng nồi chống dính không trầy xước.'
    );
    expect(screen.getByLabelText(/danh mục/i)).toHaveValue('cat-1');
    expect(screen.getByLabelText(/giá bán/i)).toHaveValue(500000);
    expect(screen.getByLabelText(/kích thước \/ size/i)).toHaveValue('1.8L');
    expect(screen.getByLabelText(/tình trạng/i)).toHaveValue('USED');
    expect(screen.getByLabelText(/số lượng/i)).toHaveValue(2);

    // Modify title
    await user.clear(titleInput);
    await user.type(titleInput, 'Nồi cơm điện Cuckoo 1.8L (Đã cập nhật)');

    // Submit update
    const saveBtn = screen.getByRole('button', { name: /^lưu thay đổi$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(listingApi.updateListing).toHaveBeenCalledWith(
        'a0000000-0000-0000-0000-000000000001',
        expect.objectContaining({
          title: 'Nồi cơm điện Cuckoo 1.8L (Đã cập nhật)',
          price: 500000,
          currency: 'VND',
          size: '1.8L',
          condition: 'USED',
          quantity: 2,
        })
      );
    });
  });

  it('blocks non-owner user from editing with 403 Forbidden alert', async () => {
    // Current user is user-99, owner is user-1
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-99',
        displayName: 'Người Dùng Khác',
        email: 'other@shareloop.org',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(listingApi.getListingById).mockResolvedValue(mockExistingListing);

    renderWithProviders(
      <Routes>
        <Route path="/listings/:id/edit" element={<EditListingPage />} />
      </Routes>,
      { initialEntries: ['/listings/a0000000-0000-0000-0000-000000000001/edit'] }
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /không có quyền chỉnh sửa/i })).toBeInTheDocument();
      expect(screen.getByText(/bạn chỉ có thể chỉnh sửa các bài đăng do chính mình tạo ra/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/tiêu đề bài đăng/i)).not.toBeInTheDocument();
  });

  it('blocks editing when listing status is COMPLETED or REMOVED', async () => {
    vi.mocked(listingApi.getListingById).mockResolvedValue({
      ...mockExistingListing,
      status: 'COMPLETED',
    });

    renderWithProviders(
      <Routes>
        <Route path="/listings/:id/edit" element={<EditListingPage />} />
      </Routes>,
      { initialEntries: ['/listings/a0000000-0000-0000-0000-000000000001/edit'] }
    );

    await waitFor(() => {
      expect(
        screen.getByText(/bài đăng này hiện ở trạng thái "đã hoàn thành" và không thể tiếp tục chỉnh sửa/i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/tiêu đề bài đăng/i)).not.toBeInTheDocument();
  });

  it('navigates back to /my-listings when clicking Quay lại button', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getListingById).mockResolvedValue(mockExistingListing);

    renderWithProviders(
      <Routes>
        <Route path="/listings/:id/edit" element={<EditListingPage />} />
        <Route path="/my-listings" element={<div>Trang bài đăng của tôi</div>} />
      </Routes>,
      { initialEntries: ['/listings/a0000000-0000-0000-0000-000000000001/edit'] }
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /chỉnh sửa bài đăng/i })).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /^quay lại$/i });
    expect(backBtn).toHaveClass('flex-row');
    await user.click(backBtn);

    expect(screen.getByText('Trang bài đăng của tôi')).toBeInTheDocument();
  });
});
