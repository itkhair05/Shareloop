import type { ReportGranularity } from '@/types/reporting';
import type { UserRole, UserStatus } from '@/types/auth';
import type { ListingStatus, ListingType } from '@/types/listing';
import type { TransactionStatus } from '@/types/transaction';
import type { ReportCategory, ReportStatus, ReportTargetType } from '@/types/report';
import type { SupportCategory, SupportRequestStatus } from '@/types/support';

export const GRANULARITY_LABELS: Record<ReportGranularity, string> = {
  DAY: 'Theo ngày',
  WEEK: 'Theo tuần',
  MONTH: 'Theo tháng',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  USER: 'Người dùng',
  ADMIN: 'Quản trị viên',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  SUSPENDED: 'Bị tạm khóa',
  DEACTIVATED: 'Đã vô hiệu hóa',
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang hiển thị',
  RESERVED: 'Đã đặt trước',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  REMOVED: 'Đã gỡ',
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  GIVEAWAY: 'Cho tặng',
  SALE: 'Thanh lý',
  WANTED: 'Cần tìm',
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Chờ bàn giao',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Chờ xử lý',
  INVESTIGATING: 'Đang điều tra',
  RESOLVED: 'Đã giải quyết',
  DISMISSED: 'Đã bác bỏ',
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  FRAUD_OR_SCAM: 'Lừa đảo / Gian lận',
  HARASSMENT: 'Quấy rối / Công kích',
  ITEM_MISREPRESENTED: 'Hàng sai lệch mô tả',
  NO_SHOW_OR_UNRESPONSIVE: 'Không đến / Không phản hồi',
  PROHIBITED_ITEM: 'Hàng cấm / Vi phạm quy định',
  OTHER: 'Khác',
};

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  USER: 'Người dùng',
  LISTING: 'Tin đăng',
  TRANSACTION: 'Giao dịch',
  REVIEW: 'Đánh giá',
};

export const SUPPORT_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  PENDING: 'Chờ xử lý',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
};

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  TRANSACTION_ISSUE: 'Sự cố giao dịch',
  ACCOUNT_ISSUE: 'Vấn đề tài khoản',
  SAFETY_CONCERN: 'Mối ngại an toàn / Gian lận',
  OTHER: 'Yêu cầu khác',
};

export const REVIEW_VISIBILITY_LABELS = {
  ALL: 'Tất cả đánh giá',
  VISIBLE: 'Đang hiển thị',
  HIDDEN: 'Đang bị ẩn',
} as const;

export const DOMAIN_LABELS: Record<string, string> = {
  USERS: 'Người dùng',
  LISTINGS: 'Tin đăng',
  TRANSACTIONS: 'Giao dịch',
  MODERATION: 'Báo cáo vi phạm',
  REVIEWS: 'Đánh giá',
  SUPPORT: 'Yêu cầu hỗ trợ',
};

export const OVERVIEW_METRIC_LABELS: Record<string, string> = {
  USERS_CREATED: 'Người dùng mới',
  USERS_BY_ROLE: 'Người dùng theo vai trò',
  USERS_BY_CURRENT_STATUS: 'Người dùng theo trạng thái hiện tại',
  LISTINGS_CREATED: 'Tin đăng mới',
  LISTINGS_BY_CURRENT_STATUS: 'Tin đăng theo trạng thái hiện tại',
  LISTINGS_BY_TYPE: 'Tin đăng theo hình thức',
  LISTINGS_BY_CATEGORY: 'Tin đăng theo danh mục',
  TRANSACTIONS_CREATED: 'Giao dịch mới',
  TRANSACTIONS_BY_CURRENT_STATUS: 'Giao dịch theo trạng thái hiện tại',
  MODERATION_REPORTS_CREATED: 'Báo cáo vi phạm mới',
  MODERATION_BY_CURRENT_STATUS: 'Báo cáo theo trạng thái hiện tại',
  MODERATION_BY_CATEGORY: 'Báo cáo theo loại vi phạm',
  MODERATION_BY_TARGET_TYPE: 'Báo cáo theo đối tượng bị báo cáo',
  REVIEWS_CREATED: 'Đánh giá mới',
  REVIEWS_BY_VISIBILITY: 'Đánh giá theo hiển thị',
  REVIEWS_BY_RATING_ALL: 'Phân bố số sao (tất cả)',
  REVIEWS_BY_RATING_VISIBLE: 'Phân bố số sao (đang hiển thị)',
  REVIEWS_AVERAGE_RATING_VISIBLE: 'Điểm trung bình (đang hiển thị)',
  REVIEWS_AVERAGE_RATING_ALL: 'Điểm trung bình (tất cả)',
  SUPPORT_REQUESTS_CREATED: 'Yêu cầu hỗ trợ mới',
  SUPPORT_BY_CURRENT_STATUS: 'Yêu cầu hỗ trợ theo trạng thái hiện tại',
  SUPPORT_BY_CATEGORY: 'Yêu cầu hỗ trợ theo danh mục',
};

export const TIMESERIES_METRIC_LABELS: Record<string, string> = {
  USER_REGISTRATIONS: 'Người dùng đăng ký',
  LISTING_CREATIONS: 'Tin đăng được tạo',
  TRANSACTION_CREATIONS: 'Giao dịch được tạo',
  MODERATION_REPORT_CREATIONS: 'Báo cáo vi phạm được tạo',
  REVIEW_CREATIONS: 'Đánh giá được tạo',
  SUPPORT_REQUEST_CREATIONS: 'Yêu cầu hỗ trợ được tạo',
};

export const UNKNOWN_METRIC_LABEL = 'Chỉ số chưa xác định';
export const UNKNOWN_VALUE_LABEL = 'Không xác định';

export function getOverviewMetricLabel(metricId: string): string {
  return OVERVIEW_METRIC_LABELS[metricId] ?? `${UNKNOWN_METRIC_LABEL} (${metricId})`;
}

export function getTimeseriesMetricLabel(metricId: string): string {
  return TIMESERIES_METRIC_LABELS[metricId] ?? `${UNKNOWN_METRIC_LABEL} (${metricId})`;
}

/** Resolves a metric id from either namespace without guessing which one it belongs to. */
export function getAnyMetricLabel(metricId: string): string {
  return (
    OVERVIEW_METRIC_LABELS[metricId] ??
    TIMESERIES_METRIC_LABELS[metricId] ??
    `${UNKNOWN_METRIC_LABEL} (${metricId})`
  );
}

export function getDomainLabel(domainId: string): string {
  return DOMAIN_LABELS[domainId] ?? `${UNKNOWN_VALUE_LABEL} (${domainId})`;
}

function lookup(map: Record<string, string>, value: string): string {
  return map[value] ?? `${UNKNOWN_VALUE_LABEL} (${value})`;
}

export function getUserRoleLabel(value: string): string {
  return lookup(USER_ROLE_LABELS, value);
}

export function getUserStatusLabel(value: string): string {
  return lookup(USER_STATUS_LABELS, value);
}

export function getListingStatusLabel(value: string): string {
  return lookup(LISTING_STATUS_LABELS, value);
}

export function getListingTypeLabel(value: string): string {
  return lookup(LISTING_TYPE_LABELS, value);
}

export function getTransactionStatusLabel(value: string): string {
  return lookup(TRANSACTION_STATUS_LABELS, value);
}

export function getReportStatusLabel(value: string): string {
  return lookup(REPORT_STATUS_LABELS, value);
}

export function getReportCategoryLabel(value: string): string {
  return lookup(REPORT_CATEGORY_LABELS, value);
}

export function getReportTargetTypeLabel(value: string): string {
  return lookup(REPORT_TARGET_TYPE_LABELS, value);
}

export function getSupportStatusLabel(value: string): string {
  return lookup(SUPPORT_STATUS_LABELS, value);
}

export function getSupportCategoryLabel(value: string): string {
  return lookup(SUPPORT_CATEGORY_LABELS, value);
}

export function getDistributionLabel(domain: string, key: string): string {
  switch (domain) {
    case 'USER_ROLE':
      return getUserRoleLabel(key);
    case 'USER_STATUS':
      return getUserStatusLabel(key);
    case 'LISTING_STATUS':
      return getListingStatusLabel(key);
    case 'LISTING_TYPE':
      return getListingTypeLabel(key);
    case 'TRANSACTION_STATUS':
      return getTransactionStatusLabel(key);
    case 'REPORT_STATUS':
      return getReportStatusLabel(key);
    case 'REPORT_CATEGORY':
      return getReportCategoryLabel(key);
    case 'REPORT_TARGET_TYPE':
      return getReportTargetTypeLabel(key);
    case 'SUPPORT_STATUS':
      return getSupportStatusLabel(key);
    case 'SUPPORT_CATEGORY':
      return getSupportCategoryLabel(key);
    default:
      return key;
  }
}

/** Semantic colors reused by donuts, bars and rating charts. */
const SEMANTIC_COLORS: Record<string, string> = {
  ACTIVE: '#059669',
  PENDING: '#d97706',
  SUSPENDED: '#f59e0b',
  DEACTIVATED: '#dc2626',
  IN_PROGRESS: '#0d9488',
  RESOLVED: '#047857',
  CLOSED: '#64748b',
  INVESTIGATING: '#0284c7',
  DISMISSED: '#94a3b8',
  COMPLETED: '#16a34a',
  CANCELLED: '#ef4444',
  DRAFT: '#94a3b8',
  RESERVED: '#f59e0b',
  REMOVED: '#b91c1c',
  GIVEAWAY: '#10b981',
  SALE: '#0ea5e9',
  WANTED: '#8b5cf6',
  USER: '#0ea5e9',
  ADMIN: '#7c3aed',
  FRAUD_OR_SCAM: '#dc2626',
  HARASSMENT: '#db2777',
  ITEM_MISREPRESENTED: '#d97706',
  NO_SHOW_OR_UNRESPONSIVE: '#0284c7',
  PROHIBITED_ITEM: '#991b1b',
  OTHER: '#64748b',
  TRANSACTION_ISSUE: '#d97706',
  ACCOUNT_ISSUE: '#0284c7',
  SAFETY_CONCERN: '#dc2626',
  LISTING: '#10b981',
  TRANSACTION: '#0ea5e9',
  REVIEW: '#8b5cf6',
  VISIBLE: '#059669',
  HIDDEN: '#94a3b8',
  ALL: '#0ea5e9',
  '1': '#dc2626',
  '2': '#ea580c',
  '3': '#d97706',
  '4': '#65a30d',
  '5': '#059669',
};

const FALLBACK_PALETTE = [
  '#059669',
  '#0ea5e9',
  '#7c3aed',
  '#d97706',
  '#db2777',
  '#0d9488',
  '#64748b',
  '#b91c1c',
];

export function getDistributionColor(key: string, index = 0): string {
  return SEMANTIC_COLORS[key] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

export const SEMANTICS_NOTES = {
  users:
    'Chỉ tính các tài khoản được tạo trong khoảng thời gian đã chọn. Phân bố trạng thái phản ánh trạng thái hiện tại tại thời điểm truy vấn, không phải trạng thái lúc đăng ký.',
  listings:
    'Chỉ tính các tin đăng được tạo trong khoảng thời gian đã chọn. Phân bố trạng thái phản ánh trạng thái hiện tại của các tin đăng đó; lịch sử trạng thái không được ghi nhận.',
  topRequested:
    'Xếp hạng theo số yêu cầu được tạo trong kỳ, không phải tổng số yêu cầu trong toàn bộ vòng đời tin đăng. Chỉ tính yêu cầu đang chờ, đã chấp nhận và đã từ chối; không lọc theo trạng thái tin đăng.',
  transactions:
    'Chỉ tính các giao dịch được tạo trong khoảng thời gian đã chọn. Phân bố trạng thái là trạng thái hiện tại của các giao dịch đó. Hệ thống không cung cấp số liệu doanh thu, GMV, thanh toán hoặc phí.',
  moderation:
    'Chỉ tính các báo cáo vi phạm được tạo trong khoảng thời gian đã chọn. Phân bố trạng thái là trạng thái hiện tại của các báo cáo đó. Không hiển thị nội dung mô tả báo cáo hay dữ liệu cá nhân của người báo cáo.',
  reviews:
    'Tổng số đánh giá bao gồm cả đánh giá đang bị ẩn. Điểm trung bình “tất cả” và phân bố số sao “tất cả” chỉ dành cho quản trị viên; điểm trung bình “đang hiển thị” chỉ tính các đánh giá công khai.',
  support:
    'Chỉ tính các yêu cầu hỗ trợ được tạo trong khoảng thời gian đã chọn. Phân bố trạng thái là trạng thái hiện tại của các yêu cầu đó tại thời điểm truy vấn.',
  supportWorkload:
    'Số liệu toàn hệ thống, không giới hạn thời gian báo cáo.',
  overview:
    'Tất cả chỉ số đều được tính trong khoảng thời gian đã chọn. Khối lượng hỗ trợ đang mở toàn hệ thống không nằm trong tổng quan này.',
} as const;
