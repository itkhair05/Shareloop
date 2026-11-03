import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';
import { ReportingPage } from '../ReportingPage';
import { reportingApi } from '../api/reporting-api';
import { exportReportingCsv } from '../api/reporting-export-api';
import {
  addDays,
  getDefaultReportingRange,
  getTodayInTimezone,
} from '../utils/reporting-format';
import {
  listingsSummaryFixture,
  listingsTimeseriesFixture,
  moderationSummaryFixture,
  moderationTimeseriesFixture,
  overviewFixture,
  reviewsSummaryFixture,
  reviewsTimeseriesFixture,
  supportSummaryFixture,
  supportTimeseriesFixture,
  topRequestedFixture,
  transactionsSummaryFixture,
  transactionsTimeseriesFixture,
  usersSummaryFixture,
  usersTimeseriesFixture,
} from './reporting-fixtures';
import type { ReportingCsvDownload } from '@/types/reporting';

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

vi.mock('../api/reporting-export-api', () => ({
  exportReportingCsv: vi.fn(),
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

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let anchorClick: ReturnType<typeof vi.spyOn>;
let downloadedName = '';

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

beforeEach(() => {
  vi.clearAllMocks();
  setDefaultMocks();
  vi.mocked(exportReportingCsv).mockResolvedValue({
    blob: new Blob(['section,metric_key\n'], { type: 'text/csv' }),
    filename: 'shareloop-report.csv',
  });

  downloadedName = '';
  createObjectURL = vi.fn(() => 'blob:report-download');
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download;
    });
});

afterEach(() => {
  anchorClick.mockRestore();
});

async function clickExportAndWait(
  user: ReturnType<typeof userEvent.setup>,
  expectedCalls: number
) {
  await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
  await waitFor(() => expect(exportReportingCsv).toHaveBeenCalledTimes(expectedCalls));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled()
  );
}

describe('Reporting CSV export UI', () => {
  it('hiển thị hành động Xuất CSV trên cả bảy lĩnh vực với đúng dataset', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Xuất CSV' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Dữ liệu xuất')).not.toBeInTheDocument();

    const tabs: Array<[string, string[]]> = [
      ['Người dùng', ['Tổng hợp', 'Theo thời gian']],
      ['Tin đăng', ['Tổng hợp', 'Theo thời gian', 'Bài đăng được yêu cầu nhiều']],
      ['Giao dịch', ['Tổng hợp', 'Theo thời gian']],
      ['Báo cáo vi phạm', ['Tổng hợp', 'Theo thời gian']],
      ['Đánh giá', ['Tổng hợp', 'Theo thời gian']],
      ['Yêu cầu hỗ trợ', ['Tổng hợp', 'Theo thời gian']],
    ];

    for (const [tab, labels] of tabs) {
      await user.click(screen.getByRole('tab', { name: tab }));
      const select = screen.getByLabelText('Dữ liệu xuất');
      const options = Array.from(select.querySelectorAll('option')).map(
        (option) => option.textContent
      );
      expect(options).toEqual(labels);
      expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeInTheDocument();
    }
  });

  it('dùng khoảng ngày đã áp dụng thay vì giá trị nháp', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Tổng quan theo kỳ báo cáo');
    const defaults = getDefaultReportingRange();
    const today = getTodayInTimezone();

    await user.click(screen.getByRole('button', { name: '7 ngày' }));
    await clickExportAndWait(user, 1);

    expect(vi.mocked(exportReportingCsv).mock.calls[0][0]).toBe('overview');
    expect(vi.mocked(exportReportingCsv).mock.calls[0][1]).toBe('summary');
    expect(vi.mocked(exportReportingCsv).mock.calls[0][2]).toMatchObject({
      from: defaults.from,
      to: defaults.to,
      timezone: 'Asia/Ho_Chi_Minh',
    });

    await user.click(screen.getByRole('button', { name: 'Áp dụng' }));
    await clickExportAndWait(user, 2);

    expect(vi.mocked(exportReportingCsv).mock.calls[1][2]).toMatchObject({
      from: addDays(today, -7),
      to: today,
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('hiển thị trạng thái đang xuất, chặn gửi trùng và kích hoạt tải tệp', async () => {
    let resolveExport!: (value: ReportingCsvDownload) => void;
    vi.mocked(exportReportingCsv).mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      })
    );

    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    fireEvent.click(screen.getByRole('button', { name: 'Xuất CSV' }));

    const loadingButton = await screen.findByRole('button', { name: /đang xuất/i });
    expect(loadingButton).toBeDisabled();

    fireEvent.click(loadingButton);
    expect(exportReportingCsv).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExport({
        blob: new Blob(['section,metric_key\n'], { type: 'text/csv' }),
        filename: 'shareloop-report-overview.csv',
      });
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled()
    );
    expect(exportReportingCsv).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(downloadedName).toBe('shareloop-report-overview.csv');
    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:report-download')
    );
  });

  it('hiển thị lỗi tiếng Việt và không tải tệp khi xuất thất bại', async () => {
    vi.mocked(exportReportingCsv).mockRejectedValue(
      new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' })
    );

    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    fireEvent.click(screen.getByRole('button', { name: 'Xuất CSV' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /quyền xuất báo cáo/i
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled();
  });

  it('gửi đúng section, dataset và bộ lọc lĩnh vực đang áp dụng', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tổng quan theo kỳ báo cáo');

    await user.click(screen.getByRole('tab', { name: 'Người dùng' }));
    await screen.findByText('Phân bố theo vai trò');

    await user.selectOptions(screen.getByLabelText('Vai trò hiện tại'), 'ADMIN');
    await clickExportAndWait(user, 1);

    expect(vi.mocked(exportReportingCsv).mock.calls[0][0]).toBe('users');
    expect(vi.mocked(exportReportingCsv).mock.calls[0][1]).toBe('summary');
    expect(vi.mocked(exportReportingCsv).mock.calls[0][2]).toMatchObject({
      role: 'ADMIN',
    });

    await user.selectOptions(screen.getByLabelText('Dữ liệu xuất'), 'timeseries');
    await clickExportAndWait(user, 2);

    expect(vi.mocked(exportReportingCsv).mock.calls[1][0]).toBe('users');
    expect(vi.mocked(exportReportingCsv).mock.calls[1][1]).toBe('timeseries');
    expect(vi.mocked(exportReportingCsv).mock.calls[1][2]).toMatchObject({
      granularity: 'DAY',
    });

    await user.click(screen.getByRole('tab', { name: 'Tin đăng' }));
    await screen.findByText('Tin đăng được yêu cầu nhiều nhất');

    await user.selectOptions(
      screen.getByLabelText('Dữ liệu xuất'),
      'top-requested'
    );
    await clickExportAndWait(user, 3);

    expect(vi.mocked(exportReportingCsv).mock.calls[2][0]).toBe('listings');
    expect(vi.mocked(exportReportingCsv).mock.calls[2][1]).toBe('top-requested');
    expect(vi.mocked(exportReportingCsv).mock.calls[2][2]).toMatchObject({
      limit: 10,
    });
  });
});
