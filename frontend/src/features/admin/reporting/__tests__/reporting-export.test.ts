import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import {
  buildReportingExportParams,
  getReportingExportErrorMessage,
  parseContentDispositionFilename,
  resolveReportingExportFilename,
} from '../utils/reporting-export';
import type { ReportingExportFilters } from '@/types/reporting';

const range = {
  from: '2026-10-03',
  to: '2026-11-02',
  timezone: 'Asia/Ho_Chi_Minh',
};

function filters(overrides: Partial<ReportingExportFilters> = {}): ReportingExportFilters {
  return { ...range, ...overrides };
}

describe('buildReportingExportParams', () => {
  it('gửi đúng khoảng ngày, múi giờ và dataset cho tổng quan', () => {
    const params = buildReportingExportParams(
      'overview',
      'summary',
      filters({ granularity: 'MONTH', role: 'ADMIN', status: 'ACTIVE', limit: 10 })
    );

    expect(params).toEqual({ ...range, dataset: 'summary' });
  });

  it('gửi bộ lọc vai trò và trạng thái cho người dùng/tổng hợp', () => {
    const params = buildReportingExportParams(
      'users',
      'summary',
      filters({ role: 'ADMIN', status: 'ACTIVE' })
    );

    expect(params).toEqual({
      ...range,
      dataset: 'summary',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  });

  it('chỉ gửi granularity cho người dùng/theo thời gian', () => {
    const params = buildReportingExportParams(
      'users',
      'timeseries',
      filters({ granularity: 'WEEK', role: 'ADMIN', status: 'ACTIVE' })
    );

    expect(params).toEqual({ ...range, dataset: 'timeseries', granularity: 'WEEK' });
    expect(params).not.toHaveProperty('role');
    expect(params).not.toHaveProperty('status');
  });

  it('chỉ gửi limit và categoryId cho bài đăng được yêu cầu nhiều', () => {
    const params = buildReportingExportParams(
      'listings',
      'top-requested',
      filters({
        granularity: 'MONTH',
        status: 'ACTIVE',
        listingType: 'SALE',
        categoryId: 'cat-1',
        limit: 10,
      })
    );

    expect(params).toEqual({
      ...range,
      dataset: 'top-requested',
      categoryId: 'cat-1',
      limit: 10,
    });
    expect(params).not.toHaveProperty('granularity');
    expect(params).not.toHaveProperty('status');
    expect(params).not.toHaveProperty('listingType');
  });

  it('gửi granularity, loại vi phạm và đối tượng cho moderation/theo thời gian', () => {
    const params = buildReportingExportParams(
      'moderation',
      'timeseries',
      filters({
        granularity: 'DAY',
        status: 'PENDING',
        category: 'FRAUD_OR_SCAM',
        targetType: 'LISTING',
      })
    );

    expect(params).toEqual({
      ...range,
      dataset: 'timeseries',
      granularity: 'DAY',
      category: 'FRAUD_OR_SCAM',
      targetType: 'LISTING',
    });
    expect(params).not.toHaveProperty('status');
  });

  it('gửi trạng thái và danh mục cho hỗ trợ/tổng hợp', () => {
    const params = buildReportingExportParams(
      'support',
      'summary',
      filters({ status: 'IN_PROGRESS', category: 'SAFETY_CONCERN', granularity: 'MONTH' })
    );

    expect(params).toEqual({
      ...range,
      dataset: 'summary',
      status: 'IN_PROGRESS',
      category: 'SAFETY_CONCERN',
    });
  });

  it('bỏ qua tham số rỗng thay vì gửi chuỗi rỗng', () => {
    const params = buildReportingExportParams(
      'listings',
      'summary',
      filters({ categoryId: '', status: undefined, listingType: undefined })
    );

    expect(params).toEqual({ ...range, dataset: 'summary' });
  });

  it('từ chối tổ hợp section/dataset không được backend hỗ trợ', () => {
    expect(() => buildReportingExportParams('overview', 'timeseries', filters())).toThrow(
      /không hợp lệ/i
    );
    expect(() =>
      buildReportingExportParams('users', 'top-requested', filters())
    ).toThrow(/không hợp lệ/i);
    expect(() =>
      buildReportingExportParams('reviews', 'top-requested', filters())
    ).toThrow(/không hợp lệ/i);
  });

  it('giữ nguyên chuỗi ngày được dashboard áp dụng, không chuyển qua UTC', () => {
    const params = buildReportingExportParams('reviews', 'summary', filters());

    expect(params.from).toBe('2026-10-03');
    expect(params.to).toBe('2026-11-02');
    expect(params.timezone).toBe('Asia/Ho_Chi_Minh');
  });
});

describe('parseContentDispositionFilename', () => {
  it('đọc filename chuẩn trong Content-Disposition', () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="shareloop-report-users-2026-10-03-2026-11-02.csv"'
      )
    ).toBe('shareloop-report-users-2026-10-03-2026-11-02.csv');
  });

  it('ưu tiên filename* UTF-8 và giải mã đúng tiếng Việt', () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.csv\"; filename*=UTF-8''b%C3%A1o%20c%C3%A1o.csv"
      )
    ).toBe('báo cáo.csv');
  });

  it('trả về null khi thiếu header', () => {
    expect(parseContentDispositionFilename(undefined)).toBeNull();
    expect(parseContentDispositionFilename(null)).toBeNull();
    expect(parseContentDispositionFilename('attachment')).toBeNull();
  });

  it('trả về null với filename rỗng hoặc percent-encoding hỏng', () => {
    expect(parseContentDispositionFilename('attachment; filename=""')).toBeNull();
    expect(
      parseContentDispositionFilename("attachment; filename*=UTF-8''%E0%A4%A")
    ).toBeNull();
  });

  it('loại bỏ đường dẫn và ký tự điều khiển khỏi header không tin cậy', () => {
    expect(parseContentDispositionFilename('attachment; filename="..\\\\evil.csv"')).toBe(
      'evil.csv'
    );
    expect(
      parseContentDispositionFilename('attachment; filename="report\u0000\u001f.csv"')
    ).toBe('report.csv');
  });
});

describe('resolveReportingExportFilename', () => {
  it('dùng filename từ backend khi hợp lệ', () => {
    expect(
      resolveReportingExportFilename(
        'attachment; filename="shareloop-report-users-2026-10-03-2026-11-02.csv"',
        'users',
        '2026-10-03',
        '2026-11-02'
      )
    ).toBe('shareloop-report-users-2026-10-03-2026-11-02.csv');
  });

  it('dùng tên dự phòng an toàn khi header thiếu hoặc hỏng', () => {
    expect(
      resolveReportingExportFilename(null, 'listings', '2026-10-03', '2026-11-02')
    ).toBe('shareloop-report-listings-2026-10-03-2026-11-02.csv');
    expect(
      resolveReportingExportFilename(
        'attachment; filename=""',
        'support',
        '2026-10-03',
        '2026-11-02'
      )
    ).toBe('shareloop-report-support-2026-10-03-2026-11-02.csv');
  });
});

describe('getReportingExportErrorMessage', () => {
  it('trả về thông báo tiếng Việt theo mã lỗi', () => {
    expect(
      getReportingExportErrorMessage(
        new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' })
      )
    ).toMatch(/quyền xuất báo cáo/i);

    expect(
      getReportingExportErrorMessage(
        new ApiError({ message: 'Unauthorized', status: 401, error: 'Unauthorized' })
      )
    ).toMatch(/phiên đăng nhập/i);

    expect(
      getReportingExportErrorMessage(
        new ApiError({ message: 'Bad request', status: 400, error: 'Bad Request' })
      )
    ).toMatch(/không thể xuất csv với bộ lọc hiện tại/i);

    expect(
      getReportingExportErrorMessage(
        new ApiError({
          message: 'Network',
          status: 0,
          error: 'Network Error',
          isNetworkError: true,
        })
      )
    ).toMatch(/không thể kết nối/i);

    expect(
      getReportingExportErrorMessage(
        new ApiError({ message: 'Server', status: 500, error: 'Server Error' })
      )
    ).toMatch(/máy chủ gặp sự cố/i);

    expect(getReportingExportErrorMessage(new Error('unexpected'))).toBe(
      'Không thể xuất CSV. Vui lòng thử lại.'
    );
  });
});
