import { Users, Package, ArrowLeftRight, ShieldAlert, MessageSquare, LifeBuoy } from 'lucide-react';
import { useReportingOverview } from '../hooks/use-reporting';
import { ReportingChartCard } from '../components/ReportingChartCard';
import { ReportingKpiCard } from '../components/ReportingKpiCard';
import { DonutChart } from '../components/DonutChart';
import { DistributionBars } from '../components/DistributionBars';
import {
  ReportingInlineNote,
  ReportingQueryError,
  ReportingSectionSkeleton,
} from '../components/ReportingStates';
import {
  buildDistributionBars,
  buildDistributionDonut,
  getDistributionValue,
} from '../utils/reporting-chart-data';
import {
  formatPeriodLabel,
  formatRating,
  formatReportingNumber,
} from '../utils/reporting-format';
import { getDistributionColor, SEMANTICS_NOTES } from '../utils/reporting-labels';
import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';

export interface OverviewSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

export function OverviewSection({ range }: OverviewSectionProps) {
  const { data, isLoading, isFetching, isError, error, refetch } = useReportingOverview(range);

  if (isLoading) {
    return <ReportingSectionSkeleton label="Đang tải tổng quan báo cáo..." />;
  }

  if (isError || !data) {
    return (
      <ReportingQueryError
        title="Không thể tải tổng quan báo cáo"
        error={error}
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }

  const { users, listings, transactions, moderation, reviews, support } = data;
  const allTotals =
    users.totalUsers +
    listings.totalListings +
    transactions.totalTransactions +
    moderation.totalReports +
    reviews.totalReviews +
    support.totalSupportRequests;

  const userStatusItems = buildDistributionDonut(users.byStatus, 'USER_STATUS');
  const transactionStatusItems = buildDistributionDonut(
    transactions.byStatus,
    'TRANSACTION_STATUS'
  );
  const listingTypeItems = buildDistributionBars(listings.byType, 'LISTING_TYPE');
  const moderationCategoryItems = buildDistributionBars(
    moderation.byCategory,
    'REPORT_CATEGORY'
  );
  const supportStatusItems = buildDistributionBars(support.byCurrentStatus, 'SUPPORT_STATUS');

  const reviewVisibilityItems = [
    {
      key: 'VISIBLE',
      label: 'Đang hiển thị',
      value: reviews.visibleReviews,
      color: getDistributionColor('VISIBLE'),
    },
    {
      key: 'HIDDEN',
      label: 'Đang bị ẩn',
      value: reviews.hiddenReviews,
      color: getDistributionColor('HIDDEN'),
    },
  ];

  const suspendedUsers = getDistributionValue(users.byStatus, 'SUSPENDED');
  const activeListings = getDistributionValue(listings.byStatus, 'ACTIVE');
  const activeTransactions = getDistributionValue(transactions.byStatus, 'IN_PROGRESS');
  const pendingReports = getDistributionValue(moderation.byStatus, 'PENDING');
  const pendingSupport = getDistributionValue(support.byCurrentStatus, 'PENDING');

  return (
    <div className="space-y-5" aria-busy={isFetching}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Tổng quan theo kỳ báo cáo</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatPeriodLabel(data.period)} · Múi giờ {data.period.timezone}
          </p>
        </div>
        <span className="text-[11px] text-slate-500">
          {data.includedDomains.length} lĩnh vực · {data.includedMetrics.length} chỉ số
        </span>
      </div>

      {/* CẬP NHẬT KPI CARDS VỚI ICON VÀ MÀU SẮC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <ReportingKpiCard
          label="Người dùng mới"
          value={formatReportingNumber(users.totalUsers)}
          detail={`${formatReportingNumber(suspendedUsers)} tài khoản đang bị tạm khóa`}
          icon={Users}
          color="blue"
        />
        <ReportingKpiCard
          label="Tin đăng mới"
          value={formatReportingNumber(listings.totalListings)}
          detail={`${formatReportingNumber(activeListings)} tin đang hiển thị`}
          icon={Package}
          color="emerald"
        />
        <ReportingKpiCard
          label="Giao dịch mới"
          value={formatReportingNumber(transactions.totalTransactions)}
          detail={`${formatReportingNumber(activeTransactions)} giao dịch đang thực hiện`}
          icon={ArrowLeftRight}
          color="amber"
        />
        <ReportingKpiCard
          label="Báo cáo vi phạm mới"
          value={formatReportingNumber(moderation.totalReports)}
          detail={`${formatReportingNumber(pendingReports)} báo cáo chờ xử lý`}
          icon={ShieldAlert}
          color={pendingReports > 0 ? 'rose' : 'slate'}
        />
        <ReportingKpiCard
          label="Đánh giá mới"
          value={formatReportingNumber(reviews.totalReviews)}
          detail={`Điểm TB đang hiển thị: ${formatRating(reviews.averageRatingVisible)}`}
          icon={MessageSquare}
          color="purple"
        />
        <ReportingKpiCard
          label="Yêu cầu hỗ trợ mới"
          value={formatReportingNumber(support.totalSupportRequests)}
          detail={`${formatReportingNumber(pendingSupport)} yêu cầu chờ xử lý`}
          icon={LifeBuoy}
          color={pendingSupport > 0 ? 'rose' : 'cyan'}
        />
      </div>

      {allTotals === 0 && (
        <ReportingInlineNote>
          Không có dữ liệu phát sinh trong khoảng thời gian đã chọn. Các chỉ số hiển thị giá trị 0 đúng theo phản hồi
          từ hệ thống, không phải dữ liệu mẫu.
        </ReportingInlineNote>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        <ReportingChartCard
          title="Người dùng theo trạng thái hiện tại"
          description="Trạng thái tại thời điểm truy vấn của tài khoản tạo trong kỳ."
          meta={
            <span className="text-[11px] font-mono text-slate-500">
              Tổng {formatReportingNumber(users.totalUsers)}
            </span>
          }
        >
          <DonutChart
            items={userStatusItems}
            centerLabel="người dùng mới"
            ariaLabel="Phân bố người dùng mới theo trạng thái hiện tại"
          />
        </ReportingChartCard>

        <ReportingChartCard
          title="Tin đăng theo hình thức"
          description="Hình thức đăng tin của các tin được tạo trong kỳ."
          meta={
            <span className="text-[11px] font-mono text-slate-500">
              Tổng {formatReportingNumber(listings.totalListings)}
            </span>
          }
        >
          <DistributionBars
            items={listingTypeItems}
            ariaLabel="Phân bố tin đăng theo hình thức"
          />
        </ReportingChartCard>

        <ReportingChartCard
          title="Giao dịch theo trạng thái hiện tại"
          description="Trạng thái hiện tại của giao dịch được tạo trong kỳ."
          meta={
            <span className="text-[11px] font-mono text-slate-500">
              Tổng {formatReportingNumber(transactions.totalTransactions)}
            </span>
          }
        >
          <DonutChart
            items={transactionStatusItems}
            centerLabel="giao dịch mới"
            ariaLabel="Phân bố giao dịch mới theo trạng thái hiện tại"
          />
        </ReportingChartCard>

        <ReportingChartCard
          title="Báo cáo vi phạm theo loại"
          description="Loại vi phạm của báo cáo được tạo trong kỳ."
          meta={
            <span className="text-[11px] font-mono text-slate-500">
              Tổng {formatReportingNumber(moderation.totalReports)}
            </span>
          }
        >
          <DistributionBars
            items={moderationCategoryItems}
            ariaLabel="Phân bố báo cáo vi phạm theo loại"
          />
        </ReportingChartCard>

        <ReportingChartCard
          title="Đánh giá theo hiển thị"
          description="Bao gồm cả đánh giá đang bị ẩn."
          meta={
            <span className="text-[11px] font-mono text-slate-500">
              Tổng {formatReportingNumber(reviews.totalReviews)}
            </span>
          }
        >
          <div className="space-y-3">
            <DistributionBars
              items={reviewVisibilityItems}
              ariaLabel="Phân bố đánh giá theo trạng thái hiển thị"
            />
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-500 block">Điểm TB đang hiển thị</span>
                <strong className="font-mono text-slate-900">
                  {formatRating(reviews.averageRatingVisible)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Điểm TB tất cả (quản trị)</span>
                <strong className="font-mono text-slate-900">
                  {formatRating(reviews.averageRatingAll)}
                </strong>
              </div>
            </div>
          </div>
        </ReportingChartCard>

        <ReportingChartCard
          title="Yêu cầu hỗ trợ theo trạng thái"
          description="Trạng thái hiện tại của yêu cầu được tạo trong kỳ."
          meta={
            <span className="text-[11px] font-mono text-slate-500">
              Tổng {formatReportingNumber(support.totalSupportRequests)}
            </span>
          }
        >
          <DistributionBars
            items={supportStatusItems}
            ariaLabel="Phân bố yêu cầu hỗ trợ theo trạng thái hiện tại"
          />
        </ReportingChartCard>
      </div>

      <ReportingInlineNote>{SEMANTICS_NOTES.overview}</ReportingInlineNote>
    </div>
  );
}

export default OverviewSection;