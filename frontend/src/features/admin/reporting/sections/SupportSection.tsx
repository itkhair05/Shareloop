import { useState } from 'react';
import { Activity } from 'lucide-react';
import type { SupportCategory, SupportRequestStatus } from '@/types/support';
import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';
import { useSupportReportSummary, useSupportReportTimeseries } from '../hooks/use-reporting';
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
import {
  formatInstantVN,
  formatPeriodLabel,
  formatReportingNumber,
  REPORTING_TIMEZONE,
} from '../utils/reporting-format';
import {
  getTimeseriesMetricLabel,
  SEMANTICS_NOTES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
} from '../utils/reporting-labels';

export interface SupportSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

export function SupportSection({ range, granularity }: SupportSectionProps) {
  const [status, setStatus] = useState<SupportRequestStatus | 'ALL'>('ALL');
  const [category, setCategory] = useState<SupportCategory | 'ALL'>('ALL');

  const summaryQuery = useSupportReportSummary({
    ...range,
    status: status === 'ALL' ? undefined : status,
    category: category === 'ALL' ? undefined : category,
  });

  const timeseriesQuery = useSupportReportTimeseries({
    ...range,
    granularity,
    status: status === 'ALL' ? undefined : status,
    category: category === 'ALL' ? undefined : category,
  });

  const hasActiveFilters = status !== 'ALL' || category !== 'ALL';

  return (
    <div className="space-y-5">
      <DomainFilterBar
        onReset={() => {
          setStatus('ALL');
          setCategory('ALL');
        }}
        hasActiveFilters={hasActiveFilters}
        isFetching={summaryQuery.isFetching}
      >
        <DomainFilterField label="Trạng thái hiện tại" htmlFor="support-status-filter">
          <select
            id="support-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as SupportRequestStatus | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(SUPPORT_STATUS_LABELS) as SupportRequestStatus[]).map((value) => (
              <option key={value} value={value}>
                {SUPPORT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        <DomainFilterField label="Danh mục hỗ trợ" htmlFor="support-category-filter">
          <select
            id="support-category-filter"
            value={category}
            onChange={(event) => setCategory(event.target.value as SupportCategory | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả danh mục</option>
            {(Object.keys(SUPPORT_CATEGORY_LABELS) as SupportCategory[]).map((value) => (
              <option key={value} value={value}>
                {SUPPORT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>
      </DomainFilterBar>

      {summaryQuery.isLoading ? (
        <ReportingSectionSkeleton label="Đang tải số liệu yêu cầu hỗ trợ..." />
      ) : summaryQuery.isError || !summaryQuery.data ? (
        <ReportingQueryError
          title="Không thể tải số liệu yêu cầu hỗ trợ"
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
              label="Yêu cầu hỗ trợ mới"
              value={formatReportingNumber(summaryQuery.data.metrics.totalSupportRequests)}
            />
            <ReportingKpiCard
              label={SUPPORT_STATUS_LABELS.PENDING}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byCurrentStatus, 'PENDING')
              )}
              tone="warning"
            />
            <ReportingKpiCard
              label={SUPPORT_STATUS_LABELS.IN_PROGRESS}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byCurrentStatus, 'IN_PROGRESS')
              )}
            />
            <ReportingKpiCard
              label={SUPPORT_STATUS_LABELS.RESOLVED}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byCurrentStatus, 'RESOLVED')
              )}
              tone="success"
            />
            <ReportingKpiCard
              label={SUPPORT_STATUS_LABELS.CLOSED}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byCurrentStatus, 'CLOSED')
              )}
            />
          </div>

          <section
            aria-label="Khối lượng hỗ trợ đang mở toàn hệ thống"
            className="bg-white border border-slate-300 rounded-xl overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Khối lượng hỗ trợ đang mở
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-600">
                Số liệu toàn hệ thống, không giới hạn thời gian báo cáo.
              </span>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Đang chờ xử lý
                </span>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-950">
                  {formatReportingNumber(summaryQuery.data.currentOpenWorkload.pending)}
                </p>
              </div>
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">
                  Đang xử lý
                </span>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-sky-950">
                  {formatReportingNumber(summaryQuery.data.currentOpenWorkload.inProgress)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-300 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Tổng đang mở
                </span>
                <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-950">
                  {formatReportingNumber(summaryQuery.data.currentOpenWorkload.totalOpen)}
                </p>
              </div>
            </div>
            <p className="px-4 sm:px-5 pb-4 text-[11px] text-slate-500">
              Ảnh chụp lúc{' '}
              {formatInstantVN(
                summaryQuery.data.currentOpenWorkload.asOf,
                REPORTING_TIMEZONE
              )}{' '}
              (múi giờ {REPORTING_TIMEZONE}). Bộ lọc ngày, trạng thái và danh mục không ảnh hưởng đến khối lượng
              này.
            </p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportingChartCard
              title="Trạng thái hiện tại trong kỳ"
              description="Chỉ tính yêu cầu được tạo trong khoảng thời gian đã chọn."
            >
              <DonutChart
                items={buildDistributionDonut(
                  summaryQuery.data.metrics.byCurrentStatus,
                  'SUPPORT_STATUS'
                )}
                centerLabel="yêu cầu mới"
                centerValue={formatReportingNumber(
                  summaryQuery.data.metrics.totalSupportRequests
                )}
                ariaLabel="Phân bố yêu cầu hỗ trợ theo trạng thái hiện tại"
              />
            </ReportingChartCard>

            <ReportingChartCard
              title="Phân bố theo danh mục hỗ trợ"
              description="Danh mục của yêu cầu được tạo trong kỳ."
            >
              <DistributionBars
                items={buildDistributionBars(
                  summaryQuery.data.metrics.byCategory,
                  'SUPPORT_CATEGORY'
                )}
                ariaLabel="Phân bố yêu cầu hỗ trợ theo danh mục"
              />
            </ReportingChartCard>
          </div>

          <ReportingInlineNote>{SEMANTICS_NOTES.support}</ReportingInlineNote>
        </>
      )}

      <ReportingChartCard
        title="Xu hướng tạo yêu cầu hỗ trợ"
        description="Số yêu cầu được tạo theo từng mốc thời gian, đã lấp đầy các mốc không có phát sinh."
      >
        {timeseriesQuery.isLoading ? (
          <ReportingSectionSkeleton label="Đang tải xu hướng yêu cầu hỗ trợ..." compact />
        ) : timeseriesQuery.isError || !timeseriesQuery.data ? (
          <ReportingQueryError
            title="Không thể tải xu hướng yêu cầu hỗ trợ"
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
              color="#0d9488"
            />
            {hasActiveFilters && (
              <p className="text-[11px] text-slate-500">
                Bộ lọc trạng thái và danh mục áp dụng cho cả phần tổng hợp và biểu đồ xu hướng, theo trạng thái hiện
                tại của các yêu cầu được tạo trong kỳ.
              </p>
            )}
          </div>
        )}
      </ReportingChartCard>
    </div>
  );
}

export default SupportSection;
