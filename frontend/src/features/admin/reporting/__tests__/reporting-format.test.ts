import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error';
import {
  addDays,
  estimateBucketCount,
  formatBucketLabel,
  formatInstantVN,
  formatPeriodLabel,
  formatRating,
  formatReportingNumber,
  formatShare,
  getDefaultReportingRange,
  getReportingErrorMessage,
  getTodayInTimezone,
  validateReportingRange,
} from '../utils/reporting-format';
import { reportingPeriod } from './reporting-fixtures';

describe('reporting-format', () => {
  it('derives the default 30-day range in Asia/Ho_Chi_Minh', () => {
    const range = getDefaultReportingRange(new Date('2026-11-02T05:00:00Z'));

    expect(range).toEqual({
      from: '2026-10-03',
      to: '2026-11-02',
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('uses the Ho Chi Minh date at the UTC day boundary', () => {
    const midUtcDay = new Date('2026-11-02T16:59:00Z');
    const afterIctMidnight = new Date('2026-11-02T17:01:00Z');

    expect(getTodayInTimezone('Asia/Ho_Chi_Minh', midUtcDay)).toBe('2026-11-02');
    expect(getTodayInTimezone('Asia/Ho_Chi_Minh', afterIctMidnight)).toBe('2026-11-03');
    expect(getDefaultReportingRange(afterIctMidnight).from).toBe('2026-10-04');
  });

  it('adds days without shifting the local date', () => {
    expect(addDays('2026-11-02', -30)).toBe('2026-10-03');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('rejects missing, malformed, reversed and empty ranges', () => {
    expect(validateReportingRange('', '2026-11-02').valid).toBe(false);
    expect(validateReportingRange('2026-02-30', '2026-03-01').valid).toBe(false);
    expect(validateReportingRange('2026-11-02', '2026-11-02').valid).toBe(false);
    expect(validateReportingRange('2026-11-03', '2026-11-02').valid).toBe(false);
    expect(validateReportingRange('2026-11-01', '2026-11-02').valid).toBe(true);
  });

  it('enforces the maximum range and bucket limits per granularity', () => {
    expect(validateReportingRange('2016-01-01', '2026-11-02', 'DAY').valid).toBe(false);

    const start = '2023-12-01';
    const end = addDays(start, 1001);

    expect(validateReportingRange(start, end, 'DAY').valid).toBe(false);
    expect(validateReportingRange(start, end, 'WEEK').valid).toBe(true);
    expect(estimateBucketCount(start, end, 'DAY')).toBe(1001);
    // The backend starts WEEK buckets on the Monday before `from`,
    // so this range spans 144 aligned weeks.
    expect(estimateBucketCount(start, end, 'WEEK')).toBe(144);
  });

  it('matches the backend bucket alignment for WEEK and MONTH ranges', () => {
    // Tuesday 06/10/2026 -> Tuesday 13/10/2026 spans two Mondays: 05/10 and 12/10.
    expect(estimateBucketCount('2026-10-06', '2026-10-13', 'WEEK')).toBe(2);

    // A `to` on the first day of a month does not create a bucket for that month.
    expect(estimateBucketCount('2026-10-05', '2026-11-01', 'MONTH')).toBe(1);
    expect(estimateBucketCount('2026-10-05', '2026-11-02', 'MONTH')).toBe(2);
  });

  it('formats counts and averages with Vietnamese locale and never turns null into zero', () => {
    expect(formatReportingNumber(1234)).toBe('1.234');
    expect(formatReportingNumber(0)).toBe('0');
    expect(formatReportingNumber(null)).toBe('Chưa có dữ liệu');

    expect(formatRating(4)).toBe('4');
    expect(formatRating(4.25)).toBe('4,25');
    expect(formatRating(null)).toBe('Chưa có dữ liệu');
    expect(formatRating(undefined)).toBe('Chưa có dữ liệu');

    expect(formatShare(1, 4)).toBe('25%');
    expect(formatShare(0, 0)).toBe('0%');
  });

  it('labels buckets from the backend bucketStart date', () => {
    expect(formatBucketLabel('2026-10-05', 'DAY')).toBe('05/10');
    expect(formatBucketLabel('2026-10-05', 'WEEK')).toBe('Tuần 05/10');
    expect(formatBucketLabel('2026-10-01', 'MONTH')).toBe('Tháng 10/2026');
  });

  it('renders the exclusive end date as the last included calendar day', () => {
    expect(formatPeriodLabel(reportingPeriod)).toBe(
      'Từ 03/10/2026 đến hết 01/11/2026'
    );
  });

  it('formats workload snapshot instants in the reporting timezone', () => {
    const formatted = formatInstantVN('2026-11-02T03:15:00Z', 'Asia/Ho_Chi_Minh');
    expect(formatted).toMatch(/02\/11\/2026/);
  });

  it('maps API failures to Vietnamese guidance instead of raw backend messages', () => {
    const forbidden = new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' });
    const badRequest = new ApiError({ message: 'Bad request', status: 400, error: 'Bad Request' });
    const network = new ApiError({
      message: 'Network Error',
      status: 0,
      error: 'Network Error',
      isNetworkError: true,
    });

    expect(getReportingErrorMessage(forbidden)).toMatch(/không có quyền truy cập/i);
    expect(getReportingErrorMessage(badRequest)).toMatch(/khoảng thời gian hoặc bộ lọc không hợp lệ/i);
    expect(getReportingErrorMessage(network)).toMatch(/không thể kết nối/i);
    expect(getReportingErrorMessage(new Error('boom'))).toMatch(/không thể tải dữ liệu báo cáo/i);
  });
});
