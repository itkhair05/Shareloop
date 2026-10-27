import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminOverviewPage } from '../AdminOverviewPage';
import { adminDashboardApi } from '../api/admin-dashboard-api';
import { renderWithProviders } from '@/test/test-utils';
import type { AdminDashboardStats } from '@/types/admin';

vi.mock('../api/admin-dashboard-api', () => ({
  adminDashboardApi: {
    getDashboardStats: vi.fn(),
  },
}));

const mockStats: AdminDashboardStats = {
  totalUsers: 150,
  activeUsers: 142,
  suspendedUsers: 5,
  totalListings: 320,
  activeListings: 280,
  totalTransactions: 95,
  completedTransactions: 82,
  totalCategories: 12,
  pendingSupportRequests: 3,
  inProgressSupportRequests: 2,
  pendingReports: 4,
  investigatingReports: 1,
};

describe('AdminOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially while fetching dashboard data', () => {
    // Hang promise to keep in loading state
    vi.mocked(adminDashboardApi.getDashboardStats).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    expect(screen.getByRole('status', { name: /đang tải dữ liệu tổng quan quản trị/i })).toBeInTheDocument();
  });

  it('renders all core KPI cards with real formatted Vietnamese numbers', async () => {
    vi.mocked(adminDashboardApi.getDashboardStats).mockResolvedValueOnce(mockStats);

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    // Await query completion
    expect(await screen.findByText('Tổng người dùng')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tổng quan quản trị hệ thống/i })).toBeInTheDocument();

    // Check KPI titles
    expect(screen.getByText('Tổng bài đăng')).toBeInTheDocument();
    expect(screen.getByText('Giao dịch cộng đồng')).toBeInTheDocument();
    expect(screen.getByText('Danh mục ngành hàng')).toBeInTheDocument();

    // Check KPI values (150 appears in both KPI card and donut chart center)
    expect(screen.getAllByText('150')[0]).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getAllByText('12')[0]).toBeInTheDocument();

    // Check sub-breakdowns
    expect(screen.getByText(/hoạt động:/i)).toBeInTheDocument();
    expect(screen.getByText(/tạm khóa:/i)).toBeInTheDocument();
    expect(screen.getByText(/đang hiển thị:/i)).toBeInTheDocument();
    expect(screen.getByText(/hoàn tất:/i)).toBeInTheDocument();
  });

  it('renders urgent operational alert when pending items require administrative attention', async () => {
    vi.mocked(adminDashboardApi.getDashboardStats).mockResolvedValueOnce(mockStats);

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    const alertRegion = await screen.findByRole('region', { name: /cảnh báo hàng đợi tồn đọng/i });
    expect(alertRegion).toBeInTheDocument();
    expect(alertRegion).toHaveTextContent(/có 7 mục trong hàng đợi vận hành đang chờ xử lý/i);
    expect(alertRegion).toHaveTextContent(/3 yêu cầu trợ giúp và 4 báo cáo vi phạm/i);
  });

  it('renders all 4 visual analytics charts with correct labels and percentages', async () => {
    vi.mocked(adminDashboardApi.getDashboardStats).mockResolvedValueOnce(mockStats);

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    // Chart 1: User Status Donut Chart
    expect(await screen.findByText(/tình hình tài khoản người dùng/i)).toBeInTheDocument();
    expect(screen.getAllByText(/đang hoạt động/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/tài khoản tạm khóa/i)).toBeInTheDocument();

    // Chart 2: Listing Status Bar Chart
    expect(screen.getByText(/tình trạng bài đăng trên hệ thống/i)).toBeInTheDocument();
    expect(screen.getAllByText('88%')[0]).toBeInTheDocument(); // 280 / 320 ≈ 88%

    // Chart 3: Transaction Fulfillment Chart
    expect(screen.getByText(/hiệu quả giao dịch cộng đồng/i)).toBeInTheDocument();
    expect(screen.getAllByText('86%')[0]).toBeInTheDocument(); // 82 / 95 ≈ 86%

    // Chart 4: Operational Queue Chart
    expect(screen.getByText(/hàng đợi hỗ trợ & kiểm duyệt vi phạm/i)).toBeInTheDocument();
    expect(screen.getByText(/yêu cầu hỗ trợ \(support requests\)/i)).toBeInTheDocument();
    expect(screen.getByText(/báo cáo vi phạm \(violation reports\)/i)).toBeInTheDocument();
  });

  it('renders error state with retry action when API call fails', async () => {
    const user = userEvent.setup();
    vi.mocked(adminDashboardApi.getDashboardStats).mockRejectedValueOnce(
      new Error('Máy chủ quản trị tạm thời không phản hồi')
    );

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/không thể tải dữ liệu thống kê quản trị/i)).toBeInTheDocument();
    expect(screen.getByText(/máy chủ quản trị tạm thời không phản hồi/i)).toBeInTheDocument();

    // Retry flow
    vi.mocked(adminDashboardApi.getDashboardStats).mockResolvedValueOnce(mockStats);
    const retryBtn = screen.getByRole('button', { name: /thử tải lại/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText('150')[0]).toBeInTheDocument();
    });
  });

  it('renders empty data state without crashing when all metrics are zero', async () => {
    const emptyStats: AdminDashboardStats = {
      totalUsers: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      totalListings: 0,
      activeListings: 0,
      totalTransactions: 0,
      completedTransactions: 0,
      totalCategories: 0,
      pendingSupportRequests: 0,
      inProgressSupportRequests: 0,
      pendingReports: 0,
      investigatingReports: 0,
    };

    vi.mocked(adminDashboardApi.getDashboardStats).mockResolvedValueOnce(emptyStats);

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    expect(await screen.findByText(/chưa có tài khoản người dùng nào/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tổng quan quản trị hệ thống/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /cảnh báo hàng đợi tồn đọng/i })).not.toBeInTheDocument();
    expect(screen.getByText(/chưa có bài đăng nào được khởi tạo/i)).toBeInTheDocument();
    expect(screen.getByText(/chưa có giao dịch trao đổi nào/i)).toBeInTheDocument();
  });

  it('navigates to categories and reviews via quick shortcuts', async () => {
    vi.mocked(adminDashboardApi.getDashboardStats).mockResolvedValueOnce(mockStats);

    renderWithProviders(<AdminOverviewPage />, { initialEntries: ['/admin'] });

    expect(await screen.findByRole('heading', { name: /tổng quan quản trị hệ thống/i })).toBeInTheDocument();

    const categoryLink = screen.getByRole('link', { name: /mở giao diện quản trị danh mục/i });
    expect(categoryLink).toHaveAttribute('href', '/admin/categories');

    const reviewsLink = screen.getByRole('link', { name: /mở hàng đợi kiểm duyệt/i });
    expect(reviewsLink).toHaveAttribute('href', '/admin/reviews');
  });
});
