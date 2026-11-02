import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { reportingApi } from '../api/reporting-api';
import type { ReportingRangeQuery, ReportingTimeseriesQuery } from '@/types/reporting';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const range: ReportingRangeQuery = {
  from: '2026-10-03',
  to: '2026-11-02',
  timezone: 'Asia/Ho_Chi_Minh',
};

const timeseries: ReportingTimeseriesQuery = {
  ...range,
  granularity: 'WEEK',
};

describe('reportingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({} as never);
  });

  it('calls the overview endpoint with the exact range query', async () => {
    await reportingApi.getOverview(range);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/overview', {
      params: range,
    });
  });

  it('calls the users summary endpoint with domain filters', async () => {
    const query = { ...range, role: 'ADMIN' as const, status: 'ACTIVE' as const };
    await reportingApi.getUsersSummary(query);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/users/summary', {
      params: query,
    });
  });

  it('calls the users timeseries endpoint with granularity', async () => {
    await reportingApi.getUsersTimeseries(timeseries);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/users/timeseries', {
      params: timeseries,
    });
  });

  it('calls the listings summary, timeseries and top-requested endpoints', async () => {
    const summaryQuery = {
      ...range,
      status: 'ACTIVE' as const,
      listingType: 'GIVEAWAY' as const,
      categoryId: 'cat-1',
    };
    await reportingApi.getListingsSummary(summaryQuery);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/listings/summary', {
      params: summaryQuery,
    });

    await reportingApi.getListingsTimeseries({
      ...timeseries,
      listingType: 'SALE',
      categoryId: 'cat-2',
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/listings/timeseries', {
      params: { ...timeseries, listingType: 'SALE', categoryId: 'cat-2' },
    });

    const topRequested = { ...range, limit: 10, categoryId: 'cat-1' };
    await reportingApi.getTopRequestedListings(topRequested);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/listings/top-requested',
      { params: topRequested }
    );
  });

  it('calls the transactions summary and timeseries endpoints', async () => {
    const query = { ...range, status: 'COMPLETED' as const };
    await reportingApi.getTransactionsSummary(query);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/transactions/summary',
      { params: query }
    );

    await reportingApi.getTransactionsTimeseries(timeseries);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/transactions/timeseries',
      { params: timeseries }
    );
  });

  it('calls the moderation summary and timeseries endpoints', async () => {
    const summaryQuery = {
      ...range,
      status: 'PENDING' as const,
      category: 'FRAUD_OR_SCAM' as const,
      targetType: 'LISTING' as const,
    };
    await reportingApi.getModerationSummary(summaryQuery);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/moderation/summary',
      { params: summaryQuery }
    );

    const seriesQuery = {
      ...timeseries,
      category: 'HARASSMENT' as const,
      targetType: 'USER' as const,
    };
    await reportingApi.getModerationTimeseries(seriesQuery);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/moderation/timeseries',
      { params: seriesQuery }
    );
  });

  it('calls the reviews summary and timeseries endpoints', async () => {
    await reportingApi.getReviewsSummary(range);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/reviews/summary', {
      params: range,
    });

    await reportingApi.getReviewsTimeseries(timeseries);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/reviews/timeseries', {
      params: timeseries,
    });
  });

  it('calls the support summary and timeseries endpoints with filters', async () => {
    const summaryQuery = {
      ...range,
      status: 'IN_PROGRESS' as const,
      category: 'SAFETY_CONCERN' as const,
    };
    await reportingApi.getSupportSummary(summaryQuery);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/support/summary', {
      params: summaryQuery,
    });

    const seriesQuery = { ...timeseries, status: 'PENDING' as const, category: 'OTHER' as const };
    await reportingApi.getSupportTimeseries(seriesQuery);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/reporting/support/timeseries', {
      params: seriesQuery,
    });
  });
});
