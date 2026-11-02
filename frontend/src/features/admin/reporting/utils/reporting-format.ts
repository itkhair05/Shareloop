import { ApiError } from '@/lib/api-error';
import type {
  ReportGranularity,
  ReportPeriod,
  ReportingRangeQuery,
} from '@/types/reporting';

export const REPORTING_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const REPORTING_TIMEZONE_LABEL = 'Asia/Ho_Chi_Minh (GMT+7)';
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 3660;
export const MAX_BUCKETS = 1000;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = parseIsoDate(value);
  if (!parsed) return false;
  return toIsoDate(parsed) === value;
}

export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function diffInDays(from: string, to: string): number | null {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

export function getTodayInTimezone(
  timeZone: string = REPORTING_TIMEZONE,
  now: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }

  return `${year}-${month}-${day}`;
}

/**
 * Default period mirrors the backend default: the last 30 days ending today
 * in Asia/Ho_Chi_Minh, expressed with [from, to) semantics.
 */
export function getDefaultReportingRange(
  now: Date = new Date(),
  timeZone: string = REPORTING_TIMEZONE
): ReportingRangeQuery {
  const to = getTodayInTimezone(timeZone, now);
  return {
    from: addDays(to, -DEFAULT_RANGE_DAYS),
    to,
    timezone: timeZone,
  };
}

export function isValidTimezone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function estimateBucketCount(
  from: string,
  to: string,
  granularity: ReportGranularity
): number | null {
  const days = diffInDays(from, to);
  if (days === null || days <= 0) return null;

  if (granularity === 'DAY') return days;

  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (!fromDate || !toDate) return null;

  if (granularity === 'WEEK') {
    // The backend aligns the first bucket to the Monday on or before `from`.
    const mondayOffset = (fromDate.getUTCDay() + 6) % 7;
    const daysFromMonday = days + mondayOffset;
    return Math.ceil(daysFromMonday / 7);
  }

  // MONTH buckets start on the first day of each month; a `to` on the first
  // day of a month does not create a bucket for that month.
  const monthSpan =
    (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - fromDate.getUTCMonth());
  return monthSpan + (toDate.getUTCDate() === 1 ? 0 : 1);
}

export interface RangeValidationResult {
  valid: boolean;
  message?: string;
}

export function validateReportingRange(
  from: string,
  to: string,
  granularity: ReportGranularity = 'DAY'
): RangeValidationResult {
  if (!from || !to) {
    return { valid: false, message: 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.' };
  }

  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return { valid: false, message: 'Ngày không hợp lệ. Vui lòng chọn lại theo định dạng ngày/tháng/năm.' };
  }

  const days = diffInDays(from, to);
  if (days === null || days <= 0) {
    return { valid: false, message: 'Ngày bắt đầu phải trước ngày kết thúc.' };
  }

  if (days > MAX_RANGE_DAYS) {
    return {
      valid: false,
      message: `Khoảng thời gian tối đa là ${MAX_RANGE_DAYS} ngày (khoảng 10 năm).`,
    };
  }

  const buckets = estimateBucketCount(from, to, granularity);
  if (buckets !== null && buckets > MAX_BUCKETS) {
    return {
      valid: false,
      message: `Với mức tổng hợp hiện tại, khoảng thời gian tạo ra ${buckets.toLocaleString(
        'vi-VN'
      )} điểm dữ liệu, vượt giới hạn ${MAX_BUCKETS} điểm. Vui lòng chọn mức tổng hợp thô hơn hoặc rút ngắn khoảng thời gian.`,
    };
  }

  return { valid: true };
}

export function formatReportingNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Chưa có dữ liệu';
  }
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Chưa có dữ liệu';
  }
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatShare(value: number, total: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return '0%';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / total);
}

export function formatDateVN(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseIsoDate(value.slice(0, 10));
  if (!date) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatShortDateVN(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseIsoDate(value.slice(0, 10));
  if (!date) return '—';
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

export function formatBucketLabel(
  bucketStart: string,
  granularity: ReportGranularity
): string {
  const date = parseIsoDate(bucketStart.slice(0, 10));
  if (!date) return bucketStart;

  if (granularity === 'MONTH') {
    return `Tháng ${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  }

  if (granularity === 'WEEK') {
    return `Tuần ${formatShortDateVN(bucketStart)}`;
  }

  return formatShortDateVN(bucketStart);
}

export function formatPeriodLabel(period: ReportPeriod | null | undefined): string {
  if (!period) return 'Chưa có kỳ báo cáo';
  const lastIncluded = addDays(period.to, -1);
  return `Từ ${formatDateVN(period.from)} đến hết ${formatDateVN(lastIncluded)}`;
}

export function formatPeriodDateRange(from: string, to: string): string {
  return `Từ ${formatDateVN(from)} đến hết ${formatDateVN(addDays(to, -1))}`;
}

export function formatInstantVN(
  value: string | null | undefined,
  timeZone: string = REPORTING_TIMEZONE
): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  }
}

export function getReportingErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return 'Bạn không có quyền truy cập dữ liệu báo cáo quản trị. Vui lòng đăng nhập bằng tài khoản quản trị viên.';
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
      return 'Khoảng thời gian hoặc bộ lọc không hợp lệ. Vui lòng kiểm tra lại ngày bắt đầu, ngày kết thúc và mức tổng hợp.';
    }
    if (error.isServerError) {
      return 'Máy chủ gặp sự cố khi tổng hợp dữ liệu báo cáo. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể tải dữ liệu báo cáo. Vui lòng thử lại.';
}
