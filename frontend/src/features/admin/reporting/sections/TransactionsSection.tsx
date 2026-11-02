import { useState } from 'react';
import type { TransactionStatus } from '@/types/transaction';
import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';
import {
  useTransactionsReportSummary,
  useTransactionsReportTimeseries,
} from '../hooks/use-reporting';
import { DomainFilterBar, DomainFilterField, domainSelectClassName } from '../components/ReportingFilterBar';
import { ReportingChartCard } from '../components/ReportingChartCard';
import { ReportingKpiCard } from '../components/ReportingKpiCard';
import { DonutChart } from '../components/DonutChart';
import { TimeseriesChart } from '../components/TimeseriesChart';
import {
  ReportingInlineNote,
  ReportingQueryError,
  ReportingSectionSkeleton,
} from '../components/ReportingStates';
import { buildDistributionDonut, getDistributionValue } from '../utils/reporting-chart-data';
import { formatPeriodLabel, formatReportingNumber } from '../utils/reporting-format';
import {
  getTimeseriesMetricLabel,
  SEMANTICS_NOTES,
  TRANSACTION_STATUS_LABELS,
} from '../utils/reporting-labels';

export interface TransactionsSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

export function TransactionsSection({ range, granularity }: TransactionsSectionProps) {
  const [status, setStatus] = useState<TransactionStatus | 'ALL'>('ALL');

  const summaryQuery = useTransactionsReportSummary({
    ...range,
    status: status === 'ALL' ? undefined : status,
  });
  const timeseriesQuery = useTransactionsReportTimeseries({ ...range, granularity });

  return (
    <div className="space-y-5">
      <DomainFilterBar
        onReset={() => setStatus('ALL')}
        hasActiveFilters={status !== 'ALL'}
        isFetching={summaryQuery.isFetching}
      >
        <DomainFilterField label="Trạng thái hiện tại" htmlFor="transactions-status-filter">
          <select
            id="transactions-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as TransactionStatus | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(TRANSACTION_STATUS_LABELS) as TransactionStatus[]).map((value) => (
              <option key={value} value={value}>
                {TRANSACTION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>
      </DomainFilterBar>

      {summaryQuery.isLoading ? (
        <ReportingSectionSkeleton label="Đang tải số liệu giao dịch..." />
      ) : summaryQuery.isError || !summaryQuery.data ? (
        <ReportingQueryError
          title="Không thể tải số liệu giao dịch"
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          isRetrying={summaryQuery.isFetching}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {formatPeriodLabel(summaryQuery.data.period)}
            {status !== 'ALL' ? ' · Có áp dụng bộ lọc trạng thái' : ''}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
            <ReportingKpiCard
              label="Giao dịch mới"
              value={formatReportingNumber(summaryQuery.data.metrics.totalTransactions)}
            />
            <ReportingKpiCard
              label={TRANSACTION_STATUS_LABELS.PENDING}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'PENDING')
              )}
              tone="warning"
            />
            <ReportingKpiCard
              label={TRANSACTION_STATUS_LABELS.IN_PROGRESS}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'IN_PROGRESS')
              )}
            />
            <ReportingKpiCard
              label={TRANSACTION_STATUS_LABELS.COMPLETED}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'COMPLETED')
              )}
              tone="success"
            />
            <ReportingKpiCard
              label={TRANSACTION_STATUS_LABELS.CANCELLED}
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'CANCELLED')
              )}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportingChartCard
              title="Trạng thái hiện tại của giao dịch trong kỳ"
              description="Không phải phân bố theo thời điểm tạo giao dịch."
            >
              <DonutChart
                items={buildDistributionDonut(
                  summaryQuery.data.metrics.byStatus,
                  'TRANSACTION_STATUS'
                )}
                centerLabel="giao dịch mới"
                centerValue={formatReportingNumber(summaryQuery.data.metrics.totalTransactions)}
                ariaLabel="Phân bố giao dịch theo trạng thái hiện tại"
              />
            </ReportingChartCard>

            <ReportingChartCard
              title="Xu hướng tạo giao dịch"
              description="Số giao dịch được tạo theo từng mốc thời gian."
            >
              {timeseriesQuery.isLoading ? (
                <ReportingSectionSkeleton label="Đang tải xu hướng giao dịch..." compact />
              ) : timeseriesQuery.isError || !timeseriesQuery.data ? (
                <ReportingQueryError
                  title="Không thể tải xu hướng giao dịch"
                  error={timeseriesQuery.error}
                  onRetry={() => timeseriesQuery.refetch()}
                  isRetrying={timeseriesQuery.isFetching}
                />
              ) : (
                <TimeseriesChart
                  points={timeseriesQuery.data.points}
                  granularity={granularity}
                  metricLabel={getTimeseriesMetricLabel(timeseriesQuery.data.metric)}
                  color="#0d9488"
                />
              )}
            </ReportingChartCard>
          </div>

          {status !== 'ALL' && (
            <p className="text-[11px] text-slate-500">
              Bộ lọc trạng thái chỉ áp dụng cho phần tổng hợp; biểu đồ xu hướng phản ánh toàn bộ giao dịch được tạo
              trong kỳ.
            </p>
          )}

          <ReportingInlineNote>{SEMANTICS_NOTES.transactions}</ReportingInlineNote>
        </>
      )}
    </div>
  );
}

export default TransactionsSection;
