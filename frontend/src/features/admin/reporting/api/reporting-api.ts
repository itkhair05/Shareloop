import { apiClient } from '@/lib/api-client';
import type {
  ListingsReportQuery,
  ListingsSummaryResponse,
  ListingsTimeseriesQuery,
  ModerationReportQuery,
  ModerationSummaryResponse,
  ModerationTimeseriesQuery,
  ReportTimeseriesResponse,
  ReportingOverviewResponse,
  ReportingRangeQuery,
  ReviewsSummaryResponse,
  ReportingTimeseriesQuery,
  SupportReportQuery,
  SupportSummaryResponse,
  SupportTimeseriesQuery,
  TopRequestedListingsResponse,
  TopRequestedQuery,
  TransactionsReportQuery,
  TransactionsSummaryResponse,
  UsersReportQuery,
  UsersSummaryResponse,
} from '@/types/reporting';

const BASE_PATH = '/api/v1/admin/reporting';

export interface ReportingApi {
  getOverview(query: ReportingRangeQuery): Promise<ReportingOverviewResponse>;
  getUsersSummary(query: UsersReportQuery): Promise<UsersSummaryResponse>;
  getUsersTimeseries(query: ReportingTimeseriesQuery): Promise<ReportTimeseriesResponse>;
  getListingsSummary(query: ListingsReportQuery): Promise<ListingsSummaryResponse>;
  getListingsTimeseries(query: ListingsTimeseriesQuery): Promise<ReportTimeseriesResponse>;
  getTopRequestedListings(query: TopRequestedQuery): Promise<TopRequestedListingsResponse>;
  getTransactionsSummary(query: TransactionsReportQuery): Promise<TransactionsSummaryResponse>;
  getTransactionsTimeseries(query: ReportingTimeseriesQuery): Promise<ReportTimeseriesResponse>;
  getModerationSummary(query: ModerationReportQuery): Promise<ModerationSummaryResponse>;
  getModerationTimeseries(query: ModerationTimeseriesQuery): Promise<ReportTimeseriesResponse>;
  getReviewsSummary(query: ReportingRangeQuery): Promise<ReviewsSummaryResponse>;
  getReviewsTimeseries(query: ReportingTimeseriesQuery): Promise<ReportTimeseriesResponse>;
  getSupportSummary(query: SupportReportQuery): Promise<SupportSummaryResponse>;
  getSupportTimeseries(query: SupportTimeseriesQuery): Promise<ReportTimeseriesResponse>;
}

export const reportingApi: ReportingApi = {
  getOverview(query) {
    return apiClient.get<ReportingOverviewResponse>(`${BASE_PATH}/overview`, { params: query });
  },

  getUsersSummary(query) {
    return apiClient.get<UsersSummaryResponse>(`${BASE_PATH}/users/summary`, { params: query });
  },

  getUsersTimeseries(query) {
    return apiClient.get<ReportTimeseriesResponse>(`${BASE_PATH}/users/timeseries`, {
      params: query,
    });
  },

  getListingsSummary(query) {
    return apiClient.get<ListingsSummaryResponse>(`${BASE_PATH}/listings/summary`, {
      params: query,
    });
  },

  getListingsTimeseries(query) {
    return apiClient.get<ReportTimeseriesResponse>(`${BASE_PATH}/listings/timeseries`, {
      params: query,
    });
  },

  getTopRequestedListings(query) {
    return apiClient.get<TopRequestedListingsResponse>(`${BASE_PATH}/listings/top-requested`, {
      params: query,
    });
  },

  getTransactionsSummary(query) {
    return apiClient.get<TransactionsSummaryResponse>(`${BASE_PATH}/transactions/summary`, {
      params: query,
    });
  },

  getTransactionsTimeseries(query) {
    return apiClient.get<ReportTimeseriesResponse>(`${BASE_PATH}/transactions/timeseries`, {
      params: query,
    });
  },

  getModerationSummary(query) {
    return apiClient.get<ModerationSummaryResponse>(`${BASE_PATH}/moderation/summary`, {
      params: query,
    });
  },

  getModerationTimeseries(query) {
    return apiClient.get<ReportTimeseriesResponse>(`${BASE_PATH}/moderation/timeseries`, {
      params: query,
    });
  },

  getReviewsSummary(query) {
    return apiClient.get<ReviewsSummaryResponse>(`${BASE_PATH}/reviews/summary`, {
      params: query,
    });
  },

  getReviewsTimeseries(query) {
    return apiClient.get<ReportTimeseriesResponse>(`${BASE_PATH}/reviews/timeseries`, {
      params: query,
    });
  },

  getSupportSummary(query) {
    return apiClient.get<SupportSummaryResponse>(`${BASE_PATH}/support/summary`, {
      params: query,
    });
  },

  getSupportTimeseries(query) {
    return apiClient.get<ReportTimeseriesResponse>(`${BASE_PATH}/support/timeseries`, {
      params: query,
    });
  },
};

export default reportingApi;
