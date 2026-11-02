import { describe, expect, it } from 'vitest';
import {
  getAnyMetricLabel,
  getDistributionColor,
  getDistributionLabel,
  getListingStatusLabel,
  getOverviewMetricLabel,
  getReportCategoryLabel,
  getSupportStatusLabel,
  getTimeseriesMetricLabel,
  getTransactionStatusLabel,
  getUserRoleLabel,
  getDomainLabel,
  OVERVIEW_METRIC_LABELS,
  SEMANTICS_NOTES,
  TIMESERIES_METRIC_LABELS,
} from '../utils/reporting-labels';

describe('reporting-labels', () => {
  it('keeps Overview and Timeseries metric id namespaces separate', () => {
    expect(Object.keys(OVERVIEW_METRIC_LABELS)).toHaveLength(22);
    expect(Object.keys(TIMESERIES_METRIC_LABELS)).toHaveLength(6);

    expect(getOverviewMetricLabel('USERS_CREATED')).toBe('Người dùng mới');
    expect(getTimeseriesMetricLabel('USER_REGISTRATIONS')).toBe('Người dùng đăng ký');

    // A Timeseries id must not silently resolve in the Overview namespace and vice versa.
    expect(getOverviewMetricLabel('USER_REGISTRATIONS')).toContain('USER_REGISTRATIONS');
    expect(getTimeseriesMetricLabel('USERS_CREATED')).toContain('USERS_CREATED');
  });

  it('resolves metric ids across both namespaces only through the explicit helper', () => {
    expect(getAnyMetricLabel('MODERATION_BY_TARGET_TYPE')).toBe(
      'Báo cáo theo đối tượng bị báo cáo'
    );
    expect(getAnyMetricLabel('SUPPORT_REQUEST_CREATIONS')).toBe(
      'Yêu cầu hỗ trợ được tạo'
    );
  });

  it('handles unknown metric ids without presenting them as known labels', () => {
    expect(getOverviewMetricLabel('SOMETHING_NEW')).toBe('Chỉ số chưa xác định (SOMETHING_NEW)');
    expect(getTimeseriesMetricLabel('SOMETHING_NEW')).toBe(
      'Chỉ số chưa xác định (SOMETHING_NEW)'
    );
  });

  it('translates every backend enum used by the dashboard', () => {
    expect(getUserRoleLabel('ADMIN')).toBe('Quản trị viên');
    expect(getListingStatusLabel('RESERVED')).toBe('Đã đặt trước');
    expect(getTransactionStatusLabel('IN_PROGRESS')).toBe('Đang thực hiện');
    expect(getReportCategoryLabel('FRAUD_OR_SCAM')).toBe('Lừa đảo / Gian lận');
    expect(getSupportStatusLabel('CLOSED')).toBe('Đã đóng');
    expect(getDistributionLabel('LISTING_TYPE', 'GIVEAWAY')).toBe('Cho tặng');
    expect(getDomainLabel('MODERATION')).toBe('Báo cáo vi phạm');
  });

  it('marks unknown enum values explicitly', () => {
    expect(getUserRoleLabel('SUPERADMIN')).toBe('Không xác định (SUPERADMIN)');
    expect(getDistributionLabel('UNKNOWN_DOMAIN', 'ACTIVE')).toBe('ACTIVE');
  });

  it('assigns stable semantic chart colors with fallback for unknown keys', () => {
    expect(getDistributionColor('ACTIVE')).toBe('#059669');
    expect(getDistributionColor('PENDING')).toBe('#d97706');
    expect(getDistributionColor('UNKNOWN_KEY', 0)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('states the system-wide workload scope verbatim', () => {
    expect(SEMANTICS_NOTES.supportWorkload).toBe(
      'Số liệu toàn hệ thống, không giới hạn thời gian báo cáo.'
    );
  });
});
