import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';
import { useReviewsReportSummary, useReviewsReportTimeseries } from '../hooks/use-reporting';
import { ReportingChartCard } from '../components/ReportingChartCard';
import { ReportingKpiCard } from '../components/ReportingKpiCard';
import { DistributionBars } from '../components/DistributionBars';
import { TimeseriesChart } from '../components/TimeseriesChart';
import {
  ReportingInlineNote,
  ReportingQueryError,
  ReportingSectionSkeleton,
} from '../components/ReportingStates';
import { buildRatingBars } from '../utils/reporting-chart-data';
import {
  formatPeriodLabel,
  formatRating,
  formatReportingNumber,
} from '../utils/reporting-format';
import { getTimeseriesMetricLabel, SEMANTICS_NOTES } from '../utils/reporting-labels';

export interface ReviewsSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

export function ReviewsSection({ range, granularity }: ReviewsSectionProps) {
  const summaryQuery = useReviewsReportSummary(range);
  const timeseriesQuery = useReviewsReportTimeseries({ ...range, granularity });

  return (
    <div className="space-y-5">
      {summaryQuery.isLoading ? (
        <ReportingSectionSkeleton label="Đang tải số liệu đánh giá..." />
      ) : summaryQuery.isError || !summaryQuery.data ? (
        <ReportingQueryError
          title="Không thể tải số liệu đánh giá"
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          isRetrying={summaryQuery.isFetching}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500">{formatPeriodLabel(summaryQuery.data.period)}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
            <ReportingKpiCard
              label="Tổng đánh giá mới"
              value={formatReportingNumber(summaryQuery.data.metrics.totalReviews)}
              detail="Bao gồm cả đánh giá đang bị ẩn"
            />
            <ReportingKpiCard
              label="Đang hiển thị"
              value={formatReportingNumber(summaryQuery.data.metrics.visibleReviews)}
              tone="success"
            />
            <ReportingKpiCard
              label="Đang bị ẩn"
              value={formatReportingNumber(summaryQuery.data.metrics.hiddenReviews)}
              tone="warning"
            />
            <ReportingKpiCard
              label="Điểm TB đang hiển thị"
              value={formatRating(summaryQuery.data.metrics.averageRatingVisible)}
              unit={summaryQuery.data.metrics.averageRatingVisible !== null ? 'sao' : undefined}
              detail="Chỉ tính đánh giá công khai"
            />
            <ReportingKpiCard
              label="Điểm TB tất cả"
              value={formatRating(summaryQuery.data.metrics.averageRatingAll)}
              unit={summaryQuery.data.metrics.averageRatingAll !== null ? 'sao' : undefined}
              detail="Chỉ số dành cho quản trị viên"
            />
          </div>

          {summaryQuery.data.metrics.totalReviews === 0 && (
            <ReportingInlineNote>
              Không có đánh giá nào được tạo trong kỳ. Điểm trung bình hiển thị “Chưa có dữ liệu” thay vì 0 sao để
              tránh gây hiểu nhầm.
            </ReportingInlineNote>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportingChartCard
              title="Phân bố số sao — tất cả đánh giá"
              description="Bao gồm cả đánh giá đang bị ẩn. Chỉ hiển thị số lượng tổng hợp, không có nội dung đánh giá."
            >
              <DistributionBars
                items={buildRatingBars(summaryQuery.data.metrics.ratingDistributionAll, 'ALL')}
                valueSuffix="đánh giá"
                ariaLabel="Phân bố số sao của tất cả đánh giá"
              />
            </ReportingChartCard>

            <ReportingChartCard
              title="Phân bố số sao — đang hiển thị"
              description="Chỉ tính các đánh giá công khai với người dùng."
            >
              <DistributionBars
                items={buildRatingBars(
                  summaryQuery.data.metrics.ratingDistributionVisible,
                  'VISIBLE'
                )}
                valueSuffix="đánh giá"
                ariaLabel="Phân bố số sao của đánh giá đang hiển thị"
              />
            </ReportingChartCard>
          </div>

          <ReportingInlineNote>{SEMANTICS_NOTES.reviews}</ReportingInlineNote>
        </>
      )}

      <ReportingChartCard
        title="Xu hướng tạo đánh giá"
        description="Số đánh giá được tạo theo từng mốc thời gian, bao gồm cả đánh giá đang bị ẩn."
      >
        {timeseriesQuery.isLoading ? (
          <ReportingSectionSkeleton label="Đang tải xu hướng đánh giá..." compact />
        ) : timeseriesQuery.isError || !timeseriesQuery.data ? (
          <ReportingQueryError
            title="Không thể tải xu hướng đánh giá"
            error={timeseriesQuery.error}
            onRetry={() => timeseriesQuery.refetch()}
            isRetrying={timeseriesQuery.isFetching}
          />
        ) : (
          <TimeseriesChart
            points={timeseriesQuery.data.points}
            granularity={granularity}
            metricLabel={getTimeseriesMetricLabel(timeseriesQuery.data.metric)}
            color="#7c3aed"
          />
        )}
      </ReportingChartCard>
    </div>
  );
}

export default ReviewsSection;
