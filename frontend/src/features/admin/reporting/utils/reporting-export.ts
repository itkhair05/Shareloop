import { ApiError } from '@/lib/api-error';
import {
  downloadBlobFile,
  parseContentDispositionFilename,
} from '@/lib/file-download';
import type {
  ReportingExportDataset,
  ReportingExportFilters,
  ReportingExportSection,
} from '@/types/reporting';

export { parseContentDispositionFilename };

export const REPORTING_EXPORT_DATASETS: Record<
  ReportingExportSection,
  readonly ReportingExportDataset[]
> = {
  overview: ['summary'],
  users: ['summary', 'timeseries'],
  listings: ['summary', 'timeseries', 'top-requested'],
  transactions: ['summary', 'timeseries'],
  moderation: ['summary', 'timeseries'],
  reviews: ['summary', 'timeseries'],
  support: ['summary', 'timeseries'],
};

export const REPORTING_EXPORT_DATASET_LABELS: Record<ReportingExportDataset, string> = {
  summary: 'Tổng hợp',
  timeseries: 'Theo thời gian',
  'top-requested': 'Bài đăng được yêu cầu nhiều',
};

type ExportFilterKey =
  | 'granularity'
  | 'role'
  | 'status'
  | 'listingType'
  | 'categoryId'
  | 'category'
  | 'targetType'
  | 'limit';

type ExportParameterMatrix = Record<
  ReportingExportSection,
  Partial<Record<ReportingExportDataset, readonly ExportFilterKey[]>>
>;

/**
 * Mirrors the backend export contract in Phase 5.1A. Parameters listed here
 * are the only ones the backend accepts for a section/dataset combination.
 */
const EXPORT_PARAMETERS: ExportParameterMatrix = {
  overview: {
    summary: [],
  },
  users: {
    summary: ['role', 'status'],
    timeseries: ['granularity'],
  },
  listings: {
    summary: ['status', 'listingType', 'categoryId'],
    timeseries: ['granularity', 'listingType', 'categoryId'],
    'top-requested': ['limit', 'categoryId'],
  },
  transactions: {
    summary: ['status'],
    timeseries: ['granularity'],
  },
  moderation: {
    summary: ['status', 'category', 'targetType'],
    timeseries: ['granularity', 'category', 'targetType'],
  },
  reviews: {
    summary: [],
    timeseries: ['granularity'],
  },
  support: {
    summary: ['status', 'category'],
    timeseries: ['granularity', 'status', 'category'],
  },
};

export type ReportingExportParams = {
  from: string;
  to: string;
  timezone: string;
  dataset: ReportingExportDataset;
} & Partial<Record<ExportFilterKey, string | number>>;

export function isReportingExportSupported(
  section: ReportingExportSection,
  dataset: ReportingExportDataset
): boolean {
  return Boolean(EXPORT_PARAMETERS[section]?.[dataset]);
}

export function buildReportingExportParams(
  section: ReportingExportSection,
  dataset: ReportingExportDataset,
  filters: ReportingExportFilters
): ReportingExportParams {
  const allowed = EXPORT_PARAMETERS[section]?.[dataset];
  if (!allowed) {
    throw new Error(`Tổ hợp xuất CSV không hợp lệ: ${section}/${dataset}`);
  }

  const params: ReportingExportParams = {
    from: filters.from,
    to: filters.to,
    timezone: filters.timezone,
    dataset,
  };

  for (const key of allowed) {
    const value = filters[key];
    if (value === undefined || value === null || value === '') continue;
    params[key] = value as string | number;
  }

  return params;
}

export function resolveReportingExportFilename(
  header: string | null | undefined,
  section: ReportingExportSection,
  from: string,
  to: string
): string {
  return (
    parseContentDispositionFilename(header) ??
    `shareloop-report-${section}-${from}-${to}.csv`
  );
}

export function downloadReportingCsv(blob: Blob, filename: string): void {
  downloadBlobFile(blob, filename);
}

export function getReportingExportErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Không thể xuất CSV. Vui lòng thử lại.';
  }

  if (error.isForbidden) {
    return 'Bạn không có quyền xuất báo cáo này. Vui lòng đăng nhập bằng tài khoản quản trị viên.';
  }
  if (error.isUnauthorized) {
    return 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại để tiếp tục.';
  }
  if (error.isNetworkError) {
    return 'Không thể kết nối đến máy chủ ShareLoop. Vui lòng kiểm tra kết nối mạng và thử lại.';
  }
  if (error.isTimeout) {
    return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại sau ít phút.';
  }
  if (error.status === 400) {
    return 'Không thể xuất CSV với bộ lọc hiện tại. Vui lòng kiểm tra lại khoảng thời gian và bộ lọc.';
  }
  if (error.isServerError) {
    return 'Máy chủ gặp sự cố khi xuất báo cáo. Vui lòng thử lại sau.';
  }
  return 'Không thể xuất CSV. Vui lòng thử lại.';
}
