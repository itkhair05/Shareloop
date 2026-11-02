import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportingApi } from '../api/reporting-api';
import type { ApiError } from '@/lib/api-error';
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
  ReportingTimeseriesQuery,
  ReviewsSummaryResponse,
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

export const reportingKeys = {
  all: ['admin', 'reporting'] as const,
  overview: (query: ReportingRangeQuery) =>
    [...reportingKeys.all, 'overview', query] as const,
  users: {
    summary: (query: UsersReportQuery) =>
      [...reportingKeys.all, 'users', 'summary', query] as const,
    timeseries: (query: ReportingTimeseriesQuery) =>
      [...reportingKeys.all, 'users', 'timeseries', query] as const,
  },
  listings: {
    summary: (query: ListingsReportQuery) =>
      [...reportingKeys.all, 'listings', 'summary', query] as const,
    timeseries: (query: ListingsTimeseriesQuery) =>
      [...reportingKeys.all, 'listings', 'timeseries', query] as const,
    topRequested: (query: TopRequestedQuery) =>
      [...reportingKeys.all, 'listings', 'top-requested', query] as const,
  },
  transactions: {
    summary: (query: TransactionsReportQuery) =>
      [...reportingKeys.all, 'transactions', 'summary', query] as const,
    timeseries: (query: ReportingTimeseriesQuery) =>
      [...reportingKeys.all, 'transactions', 'timeseries', query] as const,
  },
  moderation: {
    summary: (query: ModerationReportQuery) =>
      [...reportingKeys.all, 'moderation', 'summary', query] as const,
    timeseries: (query: ModerationTimeseriesQuery) =>
      [...reportingKeys.all, 'moderation', 'timeseries', query] as const,
  },
  reviews: {
    summary: (query: ReportingRangeQuery) =>
      [...reportingKeys.all, 'reviews', 'summary', query] as const,
    timeseries: (query: ReportingTimeseriesQuery) =>
      [...reportingKeys.all, 'reviews', 'timeseries', query] as const,
  },
  support: {
    summary: (query: SupportReportQuery) =>
      [...reportingKeys.all, 'support', 'summary', query] as const,
    timeseries: (query: SupportTimeseriesQuery) =>
      [...reportingKeys.all, 'support', 'timeseries', query] as const,
  },
};

interface QueryOptions {
  enabled?: boolean;
}

const STALE_TIME = 60_000;

export function useReportingOverview(query: ReportingRangeQuery, options?: QueryOptions) {
  return useQuery<ReportingOverviewResponse, ApiError>({
    queryKey: reportingKeys.overview(query),
    queryFn: () => reportingApi.getOverview(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useUsersReportSummary(query: UsersReportQuery, options?: QueryOptions) {
  return useQuery<UsersSummaryResponse, ApiError>({
    queryKey: reportingKeys.users.summary(query),
    queryFn: () => reportingApi.getUsersSummary(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useUsersReportTimeseries(
  query: ReportingTimeseriesQuery,
  options?: QueryOptions
) {
  return useQuery<ReportTimeseriesResponse, ApiError>({
    queryKey: reportingKeys.users.timeseries(query),
    queryFn: () => reportingApi.getUsersTimeseries(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useListingsReportSummary(
  query: ListingsReportQuery,
  options?: QueryOptions
) {
  return useQuery<ListingsSummaryResponse, ApiError>({
    queryKey: reportingKeys.listings.summary(query),
    queryFn: () => reportingApi.getListingsSummary(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useListingsReportTimeseries(
  query: ListingsTimeseriesQuery,
  options?: QueryOptions
) {
  return useQuery<ReportTimeseriesResponse, ApiError>({
    queryKey: reportingKeys.listings.timeseries(query),
    queryFn: () => reportingApi.getListingsTimeseries(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useTopRequestedListings(query: TopRequestedQuery, options?: QueryOptions) {
  return useQuery<TopRequestedListingsResponse, ApiError>({
    queryKey: reportingKeys.listings.topRequested(query),
    queryFn: () => reportingApi.getTopRequestedListings(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useTransactionsReportSummary(
  query: TransactionsReportQuery,
  options?: QueryOptions
) {
  return useQuery<TransactionsSummaryResponse, ApiError>({
    queryKey: reportingKeys.transactions.summary(query),
    queryFn: () => reportingApi.getTransactionsSummary(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useTransactionsReportTimeseries(
  query: ReportingTimeseriesQuery,
  options?: QueryOptions
) {
  return useQuery<ReportTimeseriesResponse, ApiError>({
    queryKey: reportingKeys.transactions.timeseries(query),
    queryFn: () => reportingApi.getTransactionsTimeseries(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useModerationReportSummary(
  query: ModerationReportQuery,
  options?: QueryOptions
) {
  return useQuery<ModerationSummaryResponse, ApiError>({
    queryKey: reportingKeys.moderation.summary(query),
    queryFn: () => reportingApi.getModerationSummary(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useModerationReportTimeseries(
  query: ModerationTimeseriesQuery,
  options?: QueryOptions
) {
  return useQuery<ReportTimeseriesResponse, ApiError>({
    queryKey: reportingKeys.moderation.timeseries(query),
    queryFn: () => reportingApi.getModerationTimeseries(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useReviewsReportSummary(
  query: ReportingRangeQuery,
  options?: QueryOptions
) {
  return useQuery<ReviewsSummaryResponse, ApiError>({
    queryKey: reportingKeys.reviews.summary(query),
    queryFn: () => reportingApi.getReviewsSummary(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useReviewsReportTimeseries(
  query: ReportingTimeseriesQuery,
  options?: QueryOptions
) {
  return useQuery<ReportTimeseriesResponse, ApiError>({
    queryKey: reportingKeys.reviews.timeseries(query),
    queryFn: () => reportingApi.getReviewsTimeseries(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useSupportReportSummary(
  query: SupportReportQuery,
  options?: QueryOptions
) {
  return useQuery<SupportSummaryResponse, ApiError>({
    queryKey: reportingKeys.support.summary(query),
    queryFn: () => reportingApi.getSupportSummary(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useSupportReportTimeseries(
  query: SupportTimeseriesQuery,
  options?: QueryOptions
) {
  return useQuery<ReportTimeseriesResponse, ApiError>({
    queryKey: reportingKeys.support.timeseries(query),
    queryFn: () => reportingApi.getSupportTimeseries(query),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
