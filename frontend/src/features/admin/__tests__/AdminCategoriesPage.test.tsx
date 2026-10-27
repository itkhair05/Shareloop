import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminCategoriesPage } from '../AdminCategoriesPage';
import { categoryApi } from '@/features/categories/api/category-api';
import { renderWithProviders } from '@/test/test-utils';
import type { CategoryDetailResponse } from '@/types/category';
import { ApiError } from '@/lib/api-error';

vi.mock('@/features/categories/api/category-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/categories/api/category-api')>();
  return {
    ...actual,
    categoryApi: {
      ...actual.categoryApi,
      getAdminCategories: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      updateCategoryStatus: vi.fn(),
    },
  };
});

const mockCategories: CategoryDetailResponse[] = [
  {
    id: 'cat-1',
    name: 'Dụng cụ & Đồ sửa chữa',
    slug: 'tools-diy',
    description: 'Dụng cụ cơ khí, thang, máy khoan',
    isActive: true,
    activeListingCount: 15,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-22T14:30:00Z',
  },
  {
    id: 'cat-2',
    name: 'Đồ điện tử & Gia dụng',
    slug: 'electronics-appliances',
    description: 'Thiết bị điện tử, đồ gia dụng nhỏ',
    isActive: true,
    activeListingCount: 8,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-22T14:30:00Z',
  },
  {
    id: 'cat-3',
    name: 'Đồ cổ & Sưu tầm',
    slug: 'vintage-relics',
    description: 'Các món đồ cổ kính, hiện vật',
    isActive: false,
    activeListingCount: 0,
    createdAt: '2026-10-21T10:00:00Z',
    updatedAt: '2026-10-25T09:00:00Z',
  },
];

describe('AdminCategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while loading categories', () => {
    vi.mocked(categoryApi.getAdminCategories).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    expect(screen.getByRole('status', { name: /đang tải danh sách danh mục/i })).toBeInTheDocument();
  });

  it('renders error state with retry button on network failure', async () => {
    vi.mocked(categoryApi.getAdminCategories).mockRejectedValue(
      new ApiError({
        message: 'Không thể kết nối máy chủ',
        status: 500,
        error: 'Internal Server Error',
      })
    );

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    expect(await screen.findByRole('heading', { name: /không thể tải danh sách danh mục/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
  });

  it('renders categories table with active and inactive items and statistics', async () => {
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValueOnce(mockCategories);

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    // Await data loaded
    expect(await screen.findByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /quản trị danh mục ngành hàng/i })).toBeInTheDocument();

    // Verify statistics chips
    expect(screen.getByRole('button', { name: /tất cả \(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đang hoạt động \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạm ngưng \(1\)/i })).toBeInTheDocument();

    // Verify category names in table
    expect(screen.getByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();
    expect(screen.getByText('Đồ điện tử & Gia dụng')).toBeInTheDocument();
    expect(screen.getByText('Đồ cổ & Sưu tầm')).toBeInTheDocument();

    // Verify slugs
    expect(screen.getByText('tools-diy')).toBeInTheDocument();
    expect(screen.getByText('vintage-relics')).toBeInTheDocument();

    // Verify listing counts
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders action buttons with single-line horizontal alignment, whitespace-nowrap, and no wrapping', async () => {
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValueOnce(mockCategories);

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    expect(await screen.findByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /chỉnh sửa danh mục dụng cụ & đồ sửa chữa/i });
    const toggleBtn = screen.getByRole('button', { name: /tạm ngưng danh mục dụng cụ & đồ sửa chữa/i });

    expect(editBtn).toHaveClass('whitespace-nowrap', 'shrink-0');
    expect(toggleBtn).toHaveClass('whitespace-nowrap', 'shrink-0');

    // Both buttons should be siblings inside an inline-flex flex-nowrap container
    const parentContainer = editBtn.parentElement;
    expect(parentContainer).toHaveClass('flex-nowrap');
  });

  it('filters categories by search input (name or slug)', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    expect(await screen.findByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/tìm kiếm danh mục/i);

    // Search by name substring
    await user.type(searchInput, 'sửa chữa');

    expect(screen.getByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();
    expect(screen.queryByText('Đồ điện tử & Gia dụng')).not.toBeInTheDocument();
    expect(screen.queryByText('Đồ cổ & Sưu tầm')).not.toBeInTheDocument();

    // Clear search using clear button
    await user.click(screen.getByLabelText(/xóa từ khóa tìm kiếm/i));

    expect(screen.getByText('Đồ điện tử & Gia dụng')).toBeInTheDocument();
    expect(screen.getByText('Đồ cổ & Sưu tầm')).toBeInTheDocument();

    // Search by slug substring
    await user.type(searchInput, 'vintage');

    expect(screen.getByText('Đồ cổ & Sưu tầm')).toBeInTheDocument();
    expect(screen.queryByText('Dụng cụ & Đồ sửa chữa')).not.toBeInTheDocument();
  });

  it('filters categories by status chips', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    expect(await screen.findByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();

    // Filter by Active
    await user.click(screen.getByRole('button', { name: /đang hoạt động \(2\)/i }));

    expect(screen.getByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();
    expect(screen.getByText('Đồ điện tử & Gia dụng')).toBeInTheDocument();
    expect(screen.queryByText('Đồ cổ & Sưu tầm')).not.toBeInTheDocument();

    // Filter by Inactive
    await user.click(screen.getByRole('button', { name: /tạm ngưng \(1\)/i }));

    expect(screen.getByText('Đồ cổ & Sưu tầm')).toBeInTheDocument();
    expect(screen.queryByText('Dụng cụ & Đồ sửa chữa')).not.toBeInTheDocument();
    expect(screen.queryByText('Đồ điện tử & Gia dụng')).not.toBeInTheDocument();

    // Reset to All
    await user.click(screen.getByRole('button', { name: /tất cả \(3\)/i }));

    expect(screen.getByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();
    expect(screen.getByText('Đồ cổ & Sưu tầm')).toBeInTheDocument();
  });

  it('opens create modal, generates slug automatically, and submits new category', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);
    vi.mocked(categoryApi.createCategory).mockResolvedValue({
      id: 'cat-new',
      name: 'Thời trang & Phụ kiện',
      slug: 'thoi-trang-phu-kien',
      description: 'Quần áo, túi xách, giày dép',
      isActive: true,
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
    });

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    expect(await screen.findByText('Dụng cụ & Đồ sửa chữa')).toBeInTheDocument();

    // Click Add button
    await user.click(screen.getByRole('button', { name: /thêm danh mục mới/i }));

    // Verify modal is displayed
    expect(screen.getByRole('heading', { name: /thêm danh mục mới/i })).toBeInTheDocument();

    // Fill in name
    const nameInput = screen.getByLabelText(/tên danh mục/i);
    await user.type(nameInput, 'Thời trang & Phụ kiện');

    // Verify slug is auto-generated in kebab-case
    const slugInput = screen.getByLabelText(/đường dẫn định danh/i);
    expect(slugInput).toHaveValue('thoi-trang-phu-kien');

    // Fill in description
    const descInput = screen.getByLabelText(/mô tả danh mục/i);
    await user.type(descInput, 'Quần áo, túi xách, giày dép');

    // Submit form
    await user.click(screen.getByRole('button', { name: /tạo danh mục/i }));

    await waitFor(() => {
      expect(categoryApi.createCategory).toHaveBeenCalledWith({
        name: 'Thời trang & Phụ kiện',
        slug: 'thoi-trang-phu-kien',
        description: 'Quần áo, túi xách, giày dép',
        isActive: true,
      });
    });

    // Verify success banner appears
    expect(await screen.findByText(/đã thêm danh mục mới "Thời trang & Phụ kiện" thành công/i)).toBeInTheDocument();
  });

  it('handles duplicate slug 409 conflict error cleanly in form modal', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);
    vi.mocked(categoryApi.createCategory).mockRejectedValue(
      new ApiError({
        message: "Category slug 'tools-diy' already exists",
        status: 409,
        error: 'Conflict',
      })
    );

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    await screen.findByText('Dụng cụ & Đồ sửa chữa');

    await user.click(screen.getByRole('button', { name: /thêm danh mục mới/i }));

    await user.type(screen.getByLabelText(/tên danh mục/i), 'Trùng lặp công cụ');
    const slugInput = screen.getByLabelText(/đường dẫn định danh/i);
    await user.clear(slugInput);
    await user.type(slugInput, 'tools-diy');

    await user.click(screen.getByRole('button', { name: /tạo danh mục/i }));

    // Verify Vietnamese 409 error message
    expect(
      await screen.findByText(/đường dẫn định danh \(slug\) này đã tồn tại trong hệ thống/i)
    ).toBeInTheDocument();
  });

  it('opens edit modal and updates existing category', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);
    vi.mocked(categoryApi.updateCategory).mockResolvedValue({
      id: 'cat-1',
      name: 'Dụng cụ & Thiết bị sửa chữa',
      slug: 'tools-diy',
      description: 'Mô tả đã cập nhật',
      isActive: true,
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
    });

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    await screen.findByText('Dụng cụ & Đồ sửa chữa');

    // Click edit on first category
    await user.click(screen.getByLabelText(/chỉnh sửa danh mục Dụng cụ & Đồ sửa chữa/i));

    // Verify modal prefilled
    expect(screen.getByRole('heading', { name: /chỉnh sửa danh mục/i })).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/tên danh mục/i);
    expect(nameInput).toHaveValue('Dụng cụ & Đồ sửa chữa');

    // Update name
    await user.clear(nameInput);
    await user.type(nameInput, 'Dụng cụ & Thiết bị sửa chữa');

    // Submit
    await user.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => {
      expect(categoryApi.updateCategory).toHaveBeenCalledWith('cat-1', {
        name: 'Dụng cụ & Thiết bị sửa chữa',
        slug: 'tools-diy',
        description: 'Dụng cụ cơ khí, thang, máy khoan',
        isActive: true,
      });
    });

    expect(await screen.findByText(/đã cập nhật thông tin danh mục "Dụng cụ & Thiết bị sửa chữa" thành công/i)).toBeInTheDocument();
  });

  it('opens confirmation dialog and deactivates category with active listings warning', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);
    vi.mocked(categoryApi.updateCategoryStatus).mockResolvedValue({
      id: 'cat-1',
      name: 'Dụng cụ & Đồ sửa chữa',
      slug: 'tools-diy',
      description: 'Desc',
      isActive: false,
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
    });

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    await screen.findByText('Dụng cụ & Đồ sửa chữa');

    // Click "Tạm ngưng" button
    await user.click(screen.getByLabelText(/tạm ngưng danh mục Dụng cụ & Đồ sửa chữa/i));

    // Verify ConfirmDialog opens with warning about 15 active listings
    expect(screen.getByRole('dialog', { name: /tạm ngưng hoạt động danh mục/i })).toBeInTheDocument();
    expect(screen.getByText(/15 bài đăng/i)).toBeInTheDocument();

    // Confirm deactivation
    const confirmButtons = screen.getAllByRole('button', { name: /^tạm ngưng$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(categoryApi.updateCategoryStatus).toHaveBeenCalledWith('cat-1', {
        isActive: false,
      });
    });

    expect(await screen.findByText(/đã tạm ngưng danh mục "Dụng cụ & Đồ sửa chữa"/i)).toBeInTheDocument();
  });

  it('opens confirmation dialog and activates inactive category', async () => {
    const user = userEvent.setup();
    vi.mocked(categoryApi.getAdminCategories).mockResolvedValue(mockCategories);
    vi.mocked(categoryApi.updateCategoryStatus).mockResolvedValue({
      id: 'cat-3',
      name: 'Đồ cổ & Sưu tầm',
      slug: 'vintage-relics',
      description: 'Desc',
      isActive: true,
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
    });

    renderWithProviders(<AdminCategoriesPage />, { initialEntries: ['/admin/categories'] });

    await screen.findByText('Đồ cổ & Sưu tầm');

    // Click "Kích hoạt" button
    await user.click(screen.getByLabelText(/kích hoạt danh mục Đồ cổ & Sưu tầm/i));

    // Verify ConfirmDialog opens
    expect(screen.getByRole('dialog', { name: /kích hoạt lại danh mục/i })).toBeInTheDocument();

    // Confirm activation
    const confirmButtons = screen.getAllByRole('button', { name: /^kích hoạt$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(categoryApi.updateCategoryStatus).toHaveBeenCalledWith('cat-3', {
        isActive: true,
      });
    });

    expect(await screen.findByText(/đã kích hoạt danh mục "Đồ cổ & Sưu tầm" thành công/i)).toBeInTheDocument();
  });
});
