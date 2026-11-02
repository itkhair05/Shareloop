import type {
  ListingsSummaryResponse,
  ModerationSummaryResponse,
  ReportPeriod,
  ReportTimeseriesResponse,
  ReportingOverviewResponse,
  ReviewsSummaryResponse,
  SupportSummaryResponse,
  TopRequestedListingsResponse,
  TransactionsSummaryResponse,
  UsersSummaryResponse,
} from '@/types/reporting';

export const reportingPeriod: ReportPeriod = {
  from: '2026-10-03',
  to: '2026-11-02',
  timezone: 'Asia/Ho_Chi_Minh',
  fromInclusive: '2026-10-02T17:00:00Z',
  toExclusive: '2026-11-01T17:00:00Z',
};

export const usersSummaryFixture: UsersSummaryResponse = {
  period: reportingPeriod,
  statusSemantics: 'Current status of users created in the period',
  metrics: {
    totalUsers: 25,
    byRole: [
      { key: 'USER', value: 20 },
      { key: 'ADMIN', value: 5 },
    ],
    byStatus: [
      { key: 'ACTIVE', value: 22 },
      { key: 'SUSPENDED', value: 2 },
      { key: 'DEACTIVATED', value: 1 },
    ],
  },
};

export const listingsSummaryFixture: ListingsSummaryResponse = {
  period: reportingPeriod,
  statusSemantics: 'Current status of listings created in the period',
  metrics: {
    totalListings: 10,
    byStatus: [
      { key: 'DRAFT', value: 1 },
      { key: 'ACTIVE', value: 5 },
      { key: 'RESERVED', value: 2 },
      { key: 'COMPLETED', value: 1 },
      { key: 'CANCELLED', value: 0 },
      { key: 'REMOVED', value: 1 },
    ],
    byType: [
      { key: 'GIVEAWAY', value: 6 },
      { key: 'SALE', value: 3 },
      { key: 'WANTED', value: 1 },
    ],
    byCategory: [{ categoryId: 'cat-1', categoryName: 'Đồ gia dụng', value: 10 }],
  },
};

export const transactionsSummaryFixture: TransactionsSummaryResponse = {
  period: reportingPeriod,
  statusSemantics: 'Current status of transactions created in the period',
  metrics: {
    totalTransactions: 12,
    byStatus: [
      { key: 'PENDING', value: 2 },
      { key: 'IN_PROGRESS', value: 4 },
      { key: 'COMPLETED', value: 5 },
      { key: 'CANCELLED', value: 1 },
    ],
  },
};

export const moderationSummaryFixture: ModerationSummaryResponse = {
  period: reportingPeriod,
  statusSemantics: 'Current status of reports created in the period',
  metrics: {
    totalReports: 9,
    byStatus: [
      { key: 'PENDING', value: 3 },
      { key: 'INVESTIGATING', value: 2 },
      { key: 'RESOLVED', value: 3 },
      { key: 'DISMISSED', value: 1 },
    ],
    byCategory: [
      { key: 'FRAUD_OR_SCAM', value: 3 },
      { key: 'HARASSMENT', value: 1 },
      { key: 'ITEM_MISREPRESENTED', value: 2 },
      { key: 'NO_SHOW_OR_UNRESPONSIVE', value: 1 },
      { key: 'PROHIBITED_ITEM', value: 1 },
      { key: 'OTHER', value: 1 },
    ],
    byTargetType: [
      { key: 'USER', value: 2 },
      { key: 'LISTING', value: 3 },
      { key: 'TRANSACTION', value: 2 },
      { key: 'REVIEW', value: 2 },
    ],
  },
};

const ratingDistributionAll = [
  { key: '1', value: 1 },
  { key: '2', value: 0 },
  { key: '3', value: 1 },
  { key: '4', value: 2 },
  { key: '5', value: 4 },
];

const ratingDistributionVisible = [
  { key: '1', value: 0 },
  { key: '2', value: 0 },
  { key: '3', value: 1 },
  { key: '4', value: 2 },
  { key: '5', value: 3 },
];

export const reviewsSummaryFixture: ReviewsSummaryResponse = {
  period: reportingPeriod,
  visibilitySemantics: 'Hidden reviews are included in totals',
  metrics: {
    totalReviews: 8,
    visibleReviews: 6,
    hiddenReviews: 2,
    averageRatingVisible: 4.5,
    averageRatingAll: 4.25,
    ratingDistributionAll,
    ratingDistributionVisible,
  },
};

export const reviewsSummaryNullAveragesFixture: ReviewsSummaryResponse = {
  ...reviewsSummaryFixture,
  metrics: {
    ...reviewsSummaryFixture.metrics,
    totalReviews: 0,
    visibleReviews: 0,
    hiddenReviews: 0,
    averageRatingVisible: null,
    averageRatingAll: null,
    ratingDistributionAll: ratingDistributionAll.map((item) => ({ ...item, value: 0 })),
    ratingDistributionVisible: ratingDistributionVisible.map((item) => ({
      ...item,
      value: 0,
    })),
  },
};

export const supportSummaryFixture: SupportSummaryResponse = {
  period: reportingPeriod,
  statusSemantics: 'Current status of support requests created in the period',
  metrics: {
    totalSupportRequests: 5,
    byCurrentStatus: [
      { key: 'PENDING', value: 2 },
      { key: 'IN_PROGRESS', value: 1 },
      { key: 'RESOLVED', value: 1 },
      { key: 'CLOSED', value: 1 },
    ],
    byCategory: [
      { key: 'TRANSACTION_ISSUE', value: 2 },
      { key: 'ACCOUNT_ISSUE', value: 1 },
      { key: 'SAFETY_CONCERN', value: 1 },
      { key: 'OTHER', value: 1 },
    ],
  },
  currentOpenWorkload: {
    asOf: '2026-11-02T03:15:00Z',
    scope: 'CURRENT_SYSTEM_WIDE_ALL_DATES',
    pending: 60,
    inProgress: 39,
    totalOpen: 99,
  },
};

export const overviewFixture: ReportingOverviewResponse = {
  period: reportingPeriod,
  includedDomains: ['USERS', 'LISTINGS', 'TRANSACTIONS', 'MODERATION', 'REVIEWS', 'SUPPORT'],
  includedMetrics: [
    'USERS_CREATED',
    'USERS_BY_ROLE',
    'USERS_BY_CURRENT_STATUS',
    'LISTINGS_CREATED',
    'LISTINGS_BY_CURRENT_STATUS',
    'LISTINGS_BY_TYPE',
    'LISTINGS_BY_CATEGORY',
    'TRANSACTIONS_CREATED',
    'TRANSACTIONS_BY_CURRENT_STATUS',
    'MODERATION_REPORTS_CREATED',
    'MODERATION_BY_CURRENT_STATUS',
    'MODERATION_BY_CATEGORY',
    'MODERATION_BY_TARGET_TYPE',
    'REVIEWS_CREATED',
    'REVIEWS_BY_VISIBILITY',
    'REVIEWS_BY_RATING_ALL',
    'REVIEWS_BY_RATING_VISIBLE',
    'REVIEWS_AVERAGE_RATING_VISIBLE',
    'REVIEWS_AVERAGE_RATING_ALL',
    'SUPPORT_REQUESTS_CREATED',
    'SUPPORT_BY_CURRENT_STATUS',
    'SUPPORT_BY_CATEGORY',
  ],
  users: usersSummaryFixture.metrics,
  listings: listingsSummaryFixture.metrics,
  transactions: transactionsSummaryFixture.metrics,
  moderation: moderationSummaryFixture.metrics,
  reviews: reviewsSummaryFixture.metrics,
  support: supportSummaryFixture.metrics,
  disclaimer:
    'Period-scoped metrics only. Support current open workload is not included in this overview.',
};

export const emptyOverviewFixture: ReportingOverviewResponse = {
  ...overviewFixture,
  users: { totalUsers: 0, byRole: [], byStatus: [] },
  listings: { totalListings: 0, byStatus: [], byType: [], byCategory: [] },
  transactions: { totalTransactions: 0, byStatus: [] },
  moderation: {
    totalReports: 0,
    byStatus: [],
    byCategory: [],
    byTargetType: [],
  },
  reviews: {
    totalReviews: 0,
    visibleReviews: 0,
    hiddenReviews: 0,
    averageRatingVisible: null,
    averageRatingAll: null,
    ratingDistributionAll: [],
    ratingDistributionVisible: [],
  },
  support: {
    totalSupportRequests: 0,
    byCurrentStatus: [],
    byCategory: [],
  },
};

export const emptyUsersSummaryFixture: UsersSummaryResponse = {
  period: reportingPeriod,
  statusSemantics: 'Current status of users created in the period',
  metrics: {
    totalUsers: 0,
    byRole: [],
    byStatus: [],
  },
};

export const emptyUsersTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'USER_REGISTRATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: [],
};

export const usersTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'USER_REGISTRATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: [
    { bucketStart: '2026-10-03', value: 2 },
    { bucketStart: '2026-10-04', value: 0 },
    { bucketStart: '2026-10-05', value: 5 },
  ],
};

export const listingsTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'LISTING_CREATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: usersTimeseriesFixture.points,
};

export const transactionsTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'TRANSACTION_CREATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: usersTimeseriesFixture.points,
};

export const moderationTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'MODERATION_REPORT_CREATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: usersTimeseriesFixture.points,
};

export const reviewsTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'REVIEW_CREATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: usersTimeseriesFixture.points,
};

export const supportTimeseriesFixture: ReportTimeseriesResponse = {
  metric: 'SUPPORT_REQUEST_CREATIONS',
  period: reportingPeriod,
  granularity: 'DAY',
  points: usersTimeseriesFixture.points,
};

export const topRequestedFixture: TopRequestedListingsResponse = {
  period: reportingPeriod,
  limit: 10,
  countedRequestStatuses: ['PENDING', 'ACCEPTED', 'REJECTED'],
  listings: [
    {
      listingId: 'listing-1',
      title: 'Bàn học gỗ',
      ownerId: 'user-1',
      ownerDisplayName: 'Nguyễn Văn A',
      categoryId: 'cat-1',
      categoryName: 'Đồ gia dụng',
      listingType: 'GIVEAWAY',
      requestCount: 7,
    },
    {
      listingId: 'listing-2',
      title: 'Xe đạp cũ',
      ownerId: 'user-2',
      ownerDisplayName: 'Trần Thị B',
      categoryId: 'cat-2',
      categoryName: 'Xe cộ',
      listingType: 'SALE',
      requestCount: 3,
    },
  ],
};
