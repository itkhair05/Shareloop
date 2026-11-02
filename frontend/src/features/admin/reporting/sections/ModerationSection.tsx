import { useState } from 'react';
import type { ReportCategory, ReportStatus, ReportTargetType } from '@/types/report';
import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';
import {
  useModerationReportSummary,
  useModerationReportTimeseries,
} from '../hooks/use-reporting';
import { DomainFilterBar, DomainFilterField, domainSelectClassName } from '../components/ReportingFilterBar';
import { ReportingChartCard } from '../components/ReportingChartCard';
import { ReportingKpiCard } from '../components/ReportingKpiCard';
import { DonutChart } from '../components/DonutChart';
import { DistributionBars } from '../components/DistributionBars';
import { TimeseriesChart } from '../components/TimeseriesChart';
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
import { formatPeriodLabel, formatReportingNumber } from '../utils/reporting-format';
import {
  getTimeseriesMetricLabel,
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  SEMANTICS_NOTES,
} from '../utils/reporting-labels';

export interface ModerationSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

export function ModerationSection({ range, granularity }: ModerationSectionProps) {
  const [status, setStatus] = useState<ReportStatus | 'ALL'>('ALL');
  const [category, setCategory] = useState<ReportCategory | 'ALL'>('ALL');
  const [targetType, setTargetType] = useState<ReportTargetType | 'ALL'>('ALL');

  const summaryQuery = useModerationReportSummary({
    ...range,
    status: status === 'ALL' ? undefined : status,
    category: category === 'ALL' ? undefined : category,
    targetType: targetType === 'ALL' ? undefined : targetType,
  });

  const timeseriesQuery = useModerationReportTimeseries({
    ...range,
    granularity,
    category: category === 'ALL' ? undefined : category,
    targetType: targetType === 'ALL' ? undefined : targetType,
  });

  const hasActiveFilters = status !== 'ALL' || category !== 'ALL' || targetType !== 'ALL';

  return (
    <div className="space-y-5">
      <DomainFilterBar
        onReset={() => {
          setStatus('ALL');
          setCategory('ALL');
          setTargetType('ALL');
        }}
        hasActiveFilters={hasActiveFilters}
        isFetching={summaryQuery.isFetching}
      >
        <DomainFilterField label="Trạng thái hiện tại" htmlFor="moderation-status-filter">
          <select
            id="moderation-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as ReportStatus | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((value) => (
              <option key={value} value={value}>
                {REPORT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        <DomainFilterField label="Loại vi phạm" htmlFor="moderation-category-filter">
          <select
            id="moderation-category-filter"
            value={category}
            onChange={(event) => setCategory(event.target.value as ReportCategory | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả loại vi phạm</option>
            {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((value) => (
              <option key={value} value={value}>
                {REPORT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        <DomainFilterField label="Đối tượng bị báo cáo" htmlFor="moderation-target-filter">
          <select
            id="moderation-target-filter"
            value={targetType}
            onChange={(event) => setTargetType(event.target.value as ReportTargetType | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả đối tượng</option>
            {(Object.keys(REPORT_TARGET_TYPE_LABELS) as ReportTargetType[]).map((value) => (
              <option key={value} value={value}>
                {REPORT_TARGET_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>
      </DomainFilterBar>

      {summaryQuery.isLoading ? (
        <ReportingSectionSkeleton label="Đang tải số liệu báo cáo vi phạm..." />
      ) : summaryQuery.isError || !summaryQuery.data ? (
        <ReportingQueryError
          title="Không thể tải số liệu báo cáo vi phạm"
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          isRetrying={summaryQuery.isFetching}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {formatPeriodLabel(summaryQuery.data.period)}
            {hasActiveFilters ? ' · Có áp dụng bộ lọc' : ''}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
            <ReportingKpiCard
              label="Báo cáo mới"
              value={formatReportingNumber(summaryQuery.data.metrics.totalReports)}
            />
            <ReportingKpiCard
              label={REPORT_STATUS_LABELS.PENDING}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'PENDING')
              )}
              tone="warning"
            />
            <ReportingKpiCard
              label={REPORT_STATUS_LABELS.INVESTIGATING}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'INVESTIGATING')
              )}
            />
            <ReportingKpiCard
              label={REPORT_STATUS_LABELS.RESOLVED}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'RESOLVED')
              )}
              tone="success"
            />
            <ReportingKpiCard
              label={REPORT_STATUS_LABELS.DISMISSED}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'DISMISSED')
              )}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportingChartCard
              title="Trạng thái hiện tại"
              description="Trạng thái tại thời điểm truy vấn của báo cáo được tạo trong kỳ."
            >
              <DonutChart
                items={buildDistributionDonut(
                  summaryQuery.data.metrics.byStatus,
                  'REPORT_STATUS'
                )}
                centerLabel="báo cáo mới"
                centerValue={formatReportingNumber(summaryQuery.data.metrics.totalReports)}
                ariaLabel="Phân bố báo cáo vi phạm theo trạng thái hiện tại"
              />
            </ReportingChartCard>

            <ReportingChartCard
              title="Phân bố theo loại vi phạm"
              description="Chỉ hiển thị số lượng tổng hợp, không có nội dung mô tả báo cáo."
            >
              <DistributionBars
                items={buildDistributionBars(
                  summaryQuery.data.metrics.byCategory,
                  'REPORT_CATEGORY'
                )}
                ariaLabel="Phân bố báo cáo vi phạm theo loại"
              />
            </ReportingChartCard>

            <ReportingChartCard
              className="lg:col-span-2"
              title="Phân bố theo đối tượng bị báo cáo"
              description="Loại đối tượng của báo cáo được tạo trong kỳ."
            >
              <DistributionBars
                items={buildDistributionBars(
                  summaryQuery.data.metrics.byTargetType,
                  'REPORT_TARGET_TYPE'
                )}
                ariaLabel="Phân bố báo cáo vi phạm theo đối tượng"
              />
            </ReportingChartCard>
          </div>

          <ReportingInlineNote>{SEMANTICS_NOTES.moderation}</ReportingInlineNote>
        </>
      )}

      <ReportingChartCard
        title="Xu hướng tạo báo cáo vi phạm"
        description="Số báo cáo được tạo theo từng mốc thời gian, đã lấp đầy các mốc không có phát sinh."
      >
        {timeseriesQuery.isLoading ? (
          <ReportingSectionSkeleton label="Đang tải xu hướng báo cáo vi phạm..." compact />
        ) : timeseriesQuery.isError || !timeseriesQuery.data ? (
          <ReportingQueryError
            title="Không thể tải xu hướng báo cáo vi phạm"
            error={timeseriesQuery.error}
            onRetry={() => timeseriesQuery.refetch()}
            isRetrying={timeseriesQuery.isFetching}
          />
        ) : (
          <div className="space-y-2">
            <TimeseriesChart
              points={timeseriesQuery.data.points}
              granularity={granularity}
              metricLabel={getTimeseriesMetricLabel(timeseriesQuery.data.metric)}
              color="#d97706"
            />
            {status !== 'ALL' && (
              <p className="text-[11px] text-slate-500">
                Bộ lọc trạng thái hiện tại chỉ áp dụng cho phần tổng hợp; biểu đồ xu hướng không hỗ trợ lọc theo
                trạng thái.
              </p>
            )}
            {(category !== 'ALL' || targetType !== 'ALL') && (
              <p className="text-[11px] text-slate-500">
                Biểu đồ xu hướng đang áp dụng bộ lọc loại vi phạm và/hoặc đối tượng bị báo cáo.
              </p>
            )}
          </div>
        )}
      </ReportingChartCard>
    </div>
  );
}

export default ModerationSection;
