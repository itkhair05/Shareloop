import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';
import { ReportingPage } from '../ReportingPage';
import { reportingApi } from '../api/reporting-api';
import {
  addDays,
  getDefaultReportingRange,
  getTodayInTimezone,
} from '../utils/reporting-format';
import {
  emptyOverviewFixture,
  emptyUsersSummaryFixture,
  emptyUsersTimeseriesFixture,
  listingsSummaryFixture,
  listingsTimeseriesFixture,
  moderationSummaryFixture,
  moderationTimeseriesFixture,
  overviewFixture,
  reviewsSummaryFixture,
  reviewsSummaryNullAveragesFixture,
  reviewsTimeseriesFixture,
  supportSummaryFixture,
  supportTimeseriesFixture,
  topRequestedFixture,
  transactionsSummaryFixture,
  transactionsTimeseriesFixture,
  usersSummaryFixture,
  usersTimeseriesFixture,
} from './reporting-fixtures';

vi.mock('../api/reporting-api', () => ({
  reportingApi: {
    getOverview: vi.fn(),
    getUsersSummary: vi.fn(),
    getUsersTimeseries: vi.fn(),
    getListingsSummary: vi.fn(),
    getListingsTimeseries: vi.fn(),
    getTopRequestedListings: vi.fn(),
    getTransactionsSummary: vi.fn(),
    getTransactionsTimeseries: vi.fn(),
    getModerationSummary: vi.fn(),
    getModerationTimeseries: vi.fn(),
    getReviewsSummary: vi.fn(),
    getReviewsTimeseries: vi.fn(),
    getSupportSummary: vi.fn(),
    getSupportTimeseries: vi.fn(),
  },
}));

vi.mock('@/features/categories', () => ({
  useAdminCategories: () => ({
    data: [
      {
        id: 'cat-1',
        name: 'Đồ gia dụng',
        slug: 'do-gia-dung',
        description: null,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        activeListingCount: 4,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

function renderPage() {
  return renderWithProviders(<ReportingPage />, {
    initialEntries: ['/admin/reporting'],
  });
}

function setDefaultMocks() {
  vi.mocked(reportingApi.getOverview).mockResolvedValue(overviewFixture);
  vi.mocked(reportingApi.getUsersSummary).mockResolvedValue(usersSummaryFixture);
  vi.mocked(reportingApi.getUsersTimeseries).mockResolvedValue(usersTimeseriesFixture);
  vi.mocked(reportingApi.getListingsSummary).mockResolvedValue(listingsSummaryFixture);
  vi.mocked(reportingApi.getListingsTimeseries).mockResolvedValue(
    listingsTimeseriesFixture
  );
  vi.mocked(reportingApi.getTopRequestedListings).mockResolvedValue(topRequestedFixture);
  vi.mocked(reportingApi.getTransactionsSummary).mockResolvedValue(
    transactionsSummaryFixture
  );
  vi.mocked(reportingApi.getTransactionsTimeseries).mockResolvedValue(
    transactionsTimeseriesFixture
  );
  vi.mocked(reportingApi.getModerationSummary).mockResolvedValue(
    moderationSummaryFixture
  );
  vi.mocked(reportingApi.getModerationTimeseries).mockResolvedValue(
    moderationTimeseriesFixture
  );
  vi.mocked(reportingApi.getReviewsSummary).mockResolvedValue(reviewsSummaryFixture);
  vi.mocked(reportingApi.getReviewsTimeseries).mockResolvedValue(
    reviewsTimeseriesFixture
  );
  vi.mocked(reportingApi.getSupportSummary).mockResolvedValue(supportSummaryFixture);
  vi.mocked(reportingApi.getSupportTimeseries).mockResolvedValue(
    supportTimeseriesFixture
  );
}

describe('ReportingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('renders the reporting header and the six overview KPI groups', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: /báo cáo & thống kê/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('Tổng quan theo kỳ báo cáo')).toBeInTheDocument();

    for (const label of [
      'Người dùng mới',
      'Tin đăng mới',
      'Giao dịch mới',
      'Báo cáo vi phạm mới',
      'Đánh giá mới',
      'Yêu cầu hỗ trợ mới',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText('Điểm TB đang hiển thị: 4,5')).toBeInTheDocument();
    expect(reportingApi.getOverview).toHaveBeenCalledTimes(1);
  });

  it('shows the overview loading skeleton before the summary resolves', () => {
    vi.mocked(reportingApi.getOverview).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(
      screen.getByRole('status', { name: /đang tải tổng quan báo cáo/i })
    ).toBeInTheDocument();
  });

  it('renders honest empty overview values without the system-wide workload', async () => {
    vi.mocked(reportingApi.getOverview).mockResolvedValue(emptyOverviewFixture);

    renderPage();

    expect(
      await screen.findByText(/không có dữ liệu phát sinh trong khoảng thời gian đã chọn/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /khối lượng hỗ trợ đang mở toàn hệ thống không nằm trong tổng quan này/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Số liệu toàn hệ thống, không giới hạn thời gian báo cáo.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('99')).not.toBeInTheDocument();
  });

  it('handles empty domain distributions and timeseries without fabricating data', async () => {
    const user = userEvent.setup();
    vi.mocked(reportingApi.getUsersSummary).mockResolvedValue(emptyUsersSummaryFixture);
    vi.mocked(reportingApi.getUsersTimeseries).mockResolvedValue(
      emptyUsersTimeseriesFixture
    );

    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Người dùng' }));

    expect(await screen.findByText('Phân bố theo vai trò')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có dữ liệu trong kỳ.').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Chưa có dữ liệu trong khoảng thời gian đã chọn.')
    ).toBeInTheDocument();
  });

  it('lazily loads a domain tab and calls the exact summary and timeseries contracts', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Tổng quan theo kỳ báo cáo');
    expect(reportingApi.getUsersSummary).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Người dùng' }));

    expect(await screen.findByText('Phân bố theo vai trò')).toBeInTheDocument();
    expect(reportingApi.getUsersSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
        timezone: 'Asia/Ho_Chi_Minh',
      })
    );
    expect(reportingApi.getUsersTimeseries).toHaveBeenCalledWith(
      expect.objectContaining({ granularity: 'DAY', timezone: 'Asia/Ho_Chi_Minh' })
    );
    expect(
      screen.getByRole('group', { name: /biểu đồ người dùng đăng ký theo ngày/i })
    ).toBeInTheDocument();
  });

  it('applies a new granularity only after the user presses Áp dụng', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Người dùng' }));
    await screen.findByText('Phân bố theo vai trò');

    await user.click(screen.getByRole('button', { name: 'Theo tháng' }));
    expect(reportingApi.getUsersTimeseries).not.toHaveBeenCalledWith(
      expect.objectContaining({ granularity: 'MONTH' })
    );

    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(reportingApi.getUsersTimeseries).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'MONTH' })
      );
    });
  });

  it('blocks invalid ranges and keeps the previously applied data', async () => {
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    fireEvent.change(screen.getByLabelText('Từ ngày (bao gồm)'), {
      target: { value: '2026-12-31' },
    });
    fireEvent.change(screen.getByLabelText('Đến ngày (không bao gồm)'), {
      target: { value: '2026-12-30' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ngày bắt đầu phải trước ngày kết thúc.'
    );
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
    expect(reportingApi.getOverview).toHaveBeenCalledTimes(1);
  });

  it('re-applies the default 30-day range when Đặt lại is pressed', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    const today = getTodayInTimezone();
    await user.click(screen.getByRole('button', { name: '7 ngày' }));
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(reportingApi.getOverview).toHaveBeenCalledWith(
        expect.objectContaining({ from: addDays(today, -7), to: today })
      );
    });

    const defaults = getDefaultReportingRange();
    await user.click(screen.getByRole('button', { name: 'Đặt lại' }));

    await waitFor(() => {
      expect(reportingApi.getOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          from: defaults.from,
          to: defaults.to,
          timezone: defaults.timezone,
        })
      );
    });
  });

  it('shows a permission-specific error state for forbidden responses', async () => {
    vi.mocked(reportingApi.getOverview).mockRejectedValue(
      new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' })
    );

    renderPage();

    expect(
      await screen.findByText(/không có quyền truy cập dữ liệu báo cáo quản trị/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Không thể tải tổng quan báo cáo')).toBeInTheDocument();
  });

  it('keeps a successful summary visible when only the timeseries request fails', async () => {
    const user = userEvent.setup();
    vi.mocked(reportingApi.getUsersTimeseries).mockRejectedValue(
      new ApiError({ message: 'Server error', status: 500, error: 'Server Error' })
    );

    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Người dùng' }));

    expect(await screen.findByText('Phân bố theo vai trò')).toBeInTheDocument();
    expect(
      await screen.findByText('Không thể tải xu hướng đăng ký người dùng')
    ).toBeInTheDocument();
    expect(screen.getByText('Máy chủ gặp sự cố khi tổng hợp dữ liệu báo cáo. Vui lòng thử lại sau.')).toBeInTheDocument();
  });

  it('never renders a null review average as zero stars', async () => {
    const user = userEvent.setup();
    vi.mocked(reportingApi.getReviewsSummary).mockResolvedValue(
      reviewsSummaryNullAveragesFixture
    );

    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Đánh giá' }));

    expect(await screen.findByText('Điểm TB đang hiển thị')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có dữ liệu')).toHaveLength(2);
    expect(screen.queryByText('0 sao')).not.toBeInTheDocument();
    expect(screen.queryByText('0,00')).not.toBeInTheDocument();
  });

  it('separates the support period totals from the system-wide workload', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Yêu cầu hỗ trợ' }));

    const workload = await screen.findByRole('region', {
      name: /khối lượng hỗ trợ đang mở toàn hệ thống/i,
    });

    expect(
      within(workload).getByText('Số liệu toàn hệ thống, không giới hạn thời gian báo cáo.')
    ).toBeInTheDocument();
    expect(within(workload).getByText('60')).toBeInTheDocument();
    expect(within(workload).getByText('39')).toBeInTheDocument();
    expect(within(workload).getByText('99')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu hỗ trợ mới')).toBeInTheDocument();
    expect(screen.queryByText('104')).not.toBeInTheDocument();
  });

  it('explains top-requested ranking and does not filter listing statuses silently', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Tin đăng' }));

    expect(
      await screen.findByText('Tin đăng được yêu cầu nhiều nhất')
    ).toBeInTheDocument();
    const firstRow = screen.getByText('Bàn học gỗ').closest('tr');
    expect(firstRow).not.toBeNull();
    expect(within(firstRow as HTMLElement).getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/không lọc theo trạng thái tin đăng/i)).toBeInTheDocument();
    expect(screen.getByText(/đang chờ, đã chấp nhận và đã từ chối/i)).toBeInTheDocument();
    expect(
      screen.getByText('Kỳ xét: Từ 03/10/2026 đến hết 01/11/2026')
    ).toBeInTheDocument();
  });

  it('supports arrow, Home and End keyboard navigation across report tabs', async () => {
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    const overviewTab = screen.getByRole('tab', { name: 'Tổng quan' });
    const usersTab = screen.getByRole('tab', { name: 'Người dùng' });
    const supportTab = screen.getByRole('tab', { name: 'Yêu cầu hỗ trợ' });

    overviewTab.focus();
    fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });
    await waitFor(() => expect(usersTab).toHaveAttribute('aria-selected', 'true'));
    expect(usersTab).toHaveFocus();

    fireEvent.keyDown(usersTab, { key: 'End' });
    await waitFor(() => expect(supportTab).toHaveAttribute('aria-selected', 'true'));
    expect(supportTab).toHaveFocus();

    fireEvent.keyDown(supportTab, { key: 'ArrowRight' });
    await waitFor(() => expect(overviewTab).toHaveAttribute('aria-selected', 'true'));
    expect(overviewTab).toHaveFocus();

    fireEvent.keyDown(overviewTab, { key: 'ArrowLeft' });
    await waitFor(() => expect(supportTab).toHaveAttribute('aria-selected', 'true'));
    expect(supportTab).toHaveFocus();

    fireEvent.keyDown(supportTab, { key: 'Home' });
    await waitFor(() => expect(overviewTab).toHaveAttribute('aria-selected', 'true'));
    expect(overviewTab).toHaveFocus();
  });

  it('keeps tabs and the ranking table horizontally scrollable on narrow screens', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    expect(screen.getByRole('tablist')).toHaveClass('overflow-x-auto');

    await user.click(screen.getByRole('tab', { name: 'Tin đăng' }));
    await screen.findByText('Tin đăng được yêu cầu nhiều nhất');
    const scrollableTable = screen
      .getAllByRole('table')
      .find((table) => table.parentElement?.classList.contains('overflow-x-auto'));
    expect(scrollableTable).toBeDefined();
  });

  it('does not render financial transaction metrics', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');
    await user.click(screen.getByRole('tab', { name: 'Giao dịch' }));

    expect(
      await screen.findByText('Trạng thái hiện tại của giao dịch trong kỳ')
    ).toBeInTheDocument();
    expect(screen.queryByText('Doanh thu')).not.toBeInTheDocument();
    expect(screen.queryByText('GMV')).not.toBeInTheDocument();
    expect(screen.getByText(/không cung cấp số liệu doanh thu, gmv/i)).toBeInTheDocument();
  });
});
