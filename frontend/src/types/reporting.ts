import type { UserRole, UserStatus } from './auth';
import type { ListingStatus, ListingType } from './listing';
import type { TransactionStatus } from './transaction';
import type {
  ReportCategory,
  ReportStatus,
  ReportTargetType,
} from './report';
import type { SupportCategory, SupportRequestStatus } from './support';

/**
 * Admin reporting contracts matching:
 * com.shareloop.dto.reporting.* and AdminReportingController.
 */

export type ReportGranularity = 'DAY' | 'WEEK' | 'MONTH';

export interface ReportPeriod {
  from: string;
  to: string;
  timezone: string;
  fromInclusive: string;
  toExclusive: string;
}

export interface ReportDistributionItem {
  key: string;
  value: number;
}

export interface CategoryDistributionItem {
  categoryId: string;
  categoryName: string;
  value: number;
}

export interface ReportTimeseriesPoint {
  bucketStart: string;
  value: number;
}

export interface ReportTimeseriesResponse {
  metric: string;
  period: ReportPeriod;
  granularity: string;
  points: ReportTimeseriesPoint[];
}

export interface UsersReportMetrics {
  totalUsers: number;
  byRole: ReportDistributionItem[];
  byStatus: ReportDistributionItem[];
}

export interface UsersSummaryResponse {
  period: ReportPeriod;
  metrics: UsersReportMetrics;
  statusSemantics: string;
}

export interface ListingsReportMetrics {
  totalListings: number;
  byStatus: ReportDistributionItem[];
  byType: ReportDistributionItem[];
  byCategory: CategoryDistributionItem[];
}

export interface ListingsSummaryResponse {
  period: ReportPeriod;
  metrics: ListingsReportMetrics;
  statusSemantics: string;
}

export interface TopRequestedListingItem {
  listingId: string;
  title: string;
  ownerId: string;
  ownerDisplayName: string;
  categoryId: string;
  categoryName: string;
  listingType: ListingType;
  requestCount: number;
}

export interface TopRequestedListingsResponse {
  period: ReportPeriod;
  limit: number;
  countedRequestStatuses: string[];
  listings: TopRequestedListingItem[];
}

export interface TransactionsReportMetrics {
  totalTransactions: number;
  byStatus: ReportDistributionItem[];
}

export interface TransactionsSummaryResponse {
  period: ReportPeriod;
  metrics: TransactionsReportMetrics;
  statusSemantics: string;
}

export interface ModerationReportMetrics {
  totalReports: number;
  byStatus: ReportDistributionItem[];
  byCategory: ReportDistributionItem[];
  byTargetType: ReportDistributionItem[];
}

export interface ModerationSummaryResponse {
  period: ReportPeriod;
  metrics: ModerationReportMetrics;
  statusSemantics: string;
}

export interface ReviewsReportMetrics {
  totalReviews: number;
  visibleReviews: number;
  hiddenReviews: number;
  averageRatingVisible: number | null;
  averageRatingAll: number | null;
  ratingDistributionAll: ReportDistributionItem[];
  ratingDistributionVisible: ReportDistributionItem[];
}

export interface ReviewsSummaryResponse {
  period: ReportPeriod;
  metrics: ReviewsReportMetrics;
  visibilitySemantics: string;
}

export interface SupportReportMetrics {
  totalSupportRequests: number;
  byCurrentStatus: ReportDistributionItem[];
  byCategory: ReportDistributionItem[];
}

export interface SupportOpenWorkloadResponse {
  asOf: string;
  scope: string;
  pending: number;
  inProgress: number;
  totalOpen: number;
}

export interface SupportSummaryResponse {
  period: ReportPeriod;
  metrics: SupportReportMetrics;
  statusSemantics: string;
  currentOpenWorkload: SupportOpenWorkloadResponse;
}

export interface ReportingOverviewResponse {
  period: ReportPeriod;
  includedDomains: string[];
  includedMetrics: string[];
  users: UsersReportMetrics;
  listings: ListingsReportMetrics;
  transactions: TransactionsReportMetrics;
  moderation: ModerationReportMetrics;
  reviews: ReviewsReportMetrics;
  support: SupportReportMetrics;
  disclaimer: string;
}

export interface ReportingRangeQuery {
  from: string;
  to: string;
  timezone: string;
}

export interface ReportingTimeseriesQuery extends ReportingRangeQuery {
  granularity: ReportGranularity;
}

export interface UsersReportQuery extends ReportingRangeQuery {
  role?: UserRole;
  status?: UserStatus;
}

export interface ListingsReportQuery extends ReportingRangeQuery {
  status?: ListingStatus;
  listingType?: ListingType;
  categoryId?: string;
}

export interface ListingsTimeseriesQuery extends ReportingTimeseriesQuery {
  listingType?: ListingType;
  categoryId?: string;
}

export interface TransactionsReportQuery extends ReportingRangeQuery {
  status?: TransactionStatus;
}

export interface ModerationReportQuery extends ReportingRangeQuery {
  status?: ReportStatus;
  category?: ReportCategory;
  targetType?: ReportTargetType;
}

export interface ModerationTimeseriesQuery extends ReportingTimeseriesQuery {
  category?: ReportCategory;
  targetType?: ReportTargetType;
}

export interface SupportReportQuery extends ReportingRangeQuery {
  status?: SupportRequestStatus;
  category?: SupportCategory;
}

export interface SupportTimeseriesQuery extends ReportingTimeseriesQuery {
  status?: SupportRequestStatus;
  category?: SupportCategory;
}

export interface TopRequestedQuery extends ReportingRangeQuery {
  limit: number;
  categoryId?: string;
}

export type ReportingExportSection =
  | 'overview'
  | 'users'
  | 'listings'
  | 'transactions'
  | 'moderation'
  | 'reviews'
  | 'support';

export type ReportingExportDataset = 'summary' | 'timeseries' | 'top-requested';

/**
 * Applied dashboard state sent to the CSV export endpoint. The export layer
 * includes only the parameters each section/dataset actually supports.
 */
export interface ReportingExportFilters extends ReportingRangeQuery {
  granularity?: ReportGranularity;
  role?: UserRole;
  status?: UserStatus | ListingStatus | TransactionStatus | ReportStatus | SupportRequestStatus;
  listingType?: ListingType;
  categoryId?: string;
  category?: ReportCategory | SupportCategory;
  targetType?: ReportTargetType;
  limit?: number;
}

export interface ReportingCsvDownload {
  blob: Blob;
  filename: string;
}
