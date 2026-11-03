import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { rawAxiosClient } from '@/lib/api-client';
import { exportReportingCsv } from '../api/reporting-export-api';
import type { ReportingExportFilters } from '@/types/reporting';

vi.mock('@/lib/api-client', () => ({
  rawAxiosClient: {
    get: vi.fn(),
  },
}));

const range = {
  from: '2026-10-03',
  to: '2026-11-02',
  timezone: 'Asia/Ho_Chi_Minh',
};

function filters(overrides: Partial<ReportingExportFilters> = {}): ReportingExportFilters {
  return { ...range, ...overrides };
}

function mockCsvResponse(contentDisposition?: string): Blob {
  const blob = new Blob(['section,metric_key\n'], { type: 'text/csv' });
  vi.mocked(rawAxiosClient.get).mockResolvedValue({
    data: blob,
    headers: contentDisposition ? { 'content-disposition': contentDisposition } : {},
  } as never);
  return blob;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('exportReportingCsv', () => {
  it('gọi endpoint export với range và dataset, nhận blob thay vì JSON', async () => {
    const blob = mockCsvResponse(
      'attachment; filename="shareloop-report-overview-2026-10-03-2026-11-02.csv"'
    );

    const result = await exportReportingCsv('overview', 'summary', filters());

    expect(rawAxiosClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/export/overview',
      {
        params: { ...range, dataset: 'summary' },
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      }
    );
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe(
      'shareloop-report-overview-2026-10-03-2026-11-02.csv'
    );
  });

  it('chỉ gửi granularity cho timeseries của người dùng', async () => {
    mockCsvResponse();

    await exportReportingCsv(
      'users',
      'timeseries',
      filters({ granularity: 'WEEK', role: 'ADMIN', status: 'ACTIVE' })
    );

    expect(rawAxiosClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/export/users',
      {
        params: {
          ...range,
          dataset: 'timeseries',
          granularity: 'WEEK',
        },
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      }
    );
  });

  it('không gửi trạng thái hoặc hình thức cho bài đăng được yêu cầu nhiều', async () => {
    mockCsvResponse();

    await exportReportingCsv(
      'listings',
      'top-requested',
      filters({
        status: 'ACTIVE',
        listingType: 'SALE',
        categoryId: 'cat-1',
        limit: 10,
        granularity: 'MONTH',
      })
    );

    const [, config] = vi.mocked(rawAxiosClient.get).mock.calls[0];
    expect(config?.params).toEqual({
      ...range,
      dataset: 'top-requested',
      categoryId: 'cat-1',
      limit: 10,
    });
  });

  it('gửi trạng thái và danh mục cho hỗ trợ/tổng hợp', async () => {
    mockCsvResponse();

    await exportReportingCsv(
      'support',
      'summary',
      filters({ status: 'IN_PROGRESS', category: 'SAFETY_CONCERN' })
    );

    expect(rawAxiosClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/export/support',
      {
        params: {
          ...range,
          dataset: 'summary',
          status: 'IN_PROGRESS',
          category: 'SAFETY_CONCERN',
        },
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      }
    );
  });

  it('dùng tên dự phòng khi backend không trả Content-Disposition', async () => {
    mockCsvResponse();

    const result = await exportReportingCsv('reviews', 'timeseries', filters({
      granularity: 'DAY',
    }));

    expect(result.filename).toBe(
      'shareloop-report-reviews-2026-10-03-2026-11-02.csv'
    );
  });

  it('chuyển tiếp lỗi ApiError từ API client', async () => {
    const error = new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' });
    vi.mocked(rawAxiosClient.get).mockRejectedValue(error);

    await expect(exportReportingCsv('overview', 'summary', filters())).rejects.toBe(error);
  });

  it('từ chối tổ hợp không hợp lệ trước khi gọi mạng', async () => {
    await expect(
      exportReportingCsv('overview', 'timeseries', filters())
    ).rejects.toThrow(/không hợp lệ/i);

    expect(rawAxiosClient.get).not.toHaveBeenCalled();
  });
});
