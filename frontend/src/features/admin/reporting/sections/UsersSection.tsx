import { useState } from 'react';
import type { UserRole, UserStatus } from '@/types/auth';
import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';
import { useUsersReportSummary, useUsersReportTimeseries } from '../hooks/use-reporting';
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
import {
  buildDistributionDonut,
  getDistributionValue,
} from '../utils/reporting-chart-data';
import { formatPeriodLabel, formatReportingNumber } from '../utils/reporting-format';
import {
  getTimeseriesMetricLabel,
  SEMANTICS_NOTES,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
} from '../utils/reporting-labels';

export interface UsersSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

export function UsersSection({ range, granularity }: UsersSectionProps) {
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const [status, setStatus] = useState<UserStatus | 'ALL'>('ALL');

  const summaryQuery = useUsersReportSummary({
    ...range,
    role: role === 'ALL' ? undefined : role,
    status: status === 'ALL' ? undefined : status,
  });
  const timeseriesQuery = useUsersReportTimeseries({ ...range, granularity });

  const hasActiveFilters = role !== 'ALL' || status !== 'ALL';
  const isFiltered = hasActiveFilters;

  return (
    <div className="space-y-5">
      <DomainFilterBar
        onReset={() => {
          setRole('ALL');
          setStatus('ALL');
        }}
        hasActiveFilters={hasActiveFilters}
        isFetching={summaryQuery.isFetching}
      >
        <DomainFilterField label="Vai trò hiện tại" htmlFor="users-role-filter">
          <select
            id="users-role-filter"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả vai trò</option>
            {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((value) => (
              <option key={value} value={value}>
                {USER_ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        <DomainFilterField label="Trạng thái hiện tại" htmlFor="users-status-filter">
          <select
            id="users-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as UserStatus | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(USER_STATUS_LABELS) as UserStatus[]).map((value) => (
              <option key={value} value={value}>
                {USER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        {isFiltered && (
          <span className="text-[11px] text-slate-500 pb-1.5">
            Số liệu tổng hợp đang áp dụng bộ lọc vai trò và trạng thái hiện tại.
          </span>
        )}
      </DomainFilterBar>

      {summaryQuery.isLoading ? (
        <ReportingSectionSkeleton label="Đang tải số liệu người dùng..." />
      ) : summaryQuery.isError || !summaryQuery.data ? (
        <ReportingQueryError
          title="Không thể tải số liệu người dùng"
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          isRetrying={summaryQuery.isFetching}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-slate-500">
              {formatPeriodLabel(summaryQuery.data.period)}
              {isFiltered ? ' · Có áp dụng bộ lọc' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <ReportingKpiCard
              label="Người dùng mới"
              value={formatReportingNumber(summaryQuery.data.metrics.totalUsers)}
            />
            <ReportingKpiCard
              label="Người dùng thường"
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byRole, 'USER')
              )}
            />
            <ReportingKpiCard
              label="Quản trị viên"
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byRole, 'ADMIN')
              )}
            />
            <ReportingKpiCard
              label="Đang hoạt động"
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'ACTIVE')
              )}
              tone="success"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportingChartCard
              title="Phân bố theo vai trò"
              description="Vai trò hiện tại của tài khoản được tạo trong kỳ."
            >
              <DonutChart
                items={buildDistributionDonut(summaryQuery.data.metrics.byRole, 'USER_ROLE')}
                centerLabel="người dùng mới"
                centerValue={formatReportingNumber(summaryQuery.data.metrics.totalUsers)}
                ariaLabel="Phân bố người dùng theo vai trò"
              />
            </ReportingChartCard>

            <ReportingChartCard
              title="Phân bố theo trạng thái hiện tại"
              description="Trạng thái tại thời điểm truy vấn, không phải trạng thái lúc đăng ký."
            >
              <DonutChart
                items={buildDistributionDonut(
                  summaryQuery.data.metrics.byStatus,
                  'USER_STATUS'
                )}
                centerLabel="người dùng mới"
                centerValue={formatReportingNumber(summaryQuery.data.metrics.totalUsers)}
                ariaLabel="Phân bố người dùng theo trạng thái hiện tại"
              />
            </ReportingChartCard>
          </div>

          <ReportingInlineNote>{SEMANTICS_NOTES.users}</ReportingInlineNote>
        </>
      )}

      <ReportingChartCard
        title="Xu hướng đăng ký người dùng"
        description="Số tài khoản được tạo theo từng mốc thời gian, đã lấp đầy các mốc không có phát sinh."
      >
        {timeseriesQuery.isLoading ? (
          <ReportingSectionSkeleton label="Đang tải xu hướng đăng ký..." compact />
        ) : timeseriesQuery.isError || !timeseriesQuery.data ? (
          <ReportingQueryError
            title="Không thể tải xu hướng đăng ký người dùng"
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
            />
            {isFiltered && (
              <p className="text-[11px] text-slate-500">
                Biểu đồ xu hướng không hỗ trợ lọc theo vai trò hoặc trạng thái; bộ lọc phía trên chỉ áp dụng cho
                phần tổng hợp.
              </p>
            )}
          </div>
        )}
      </ReportingChartCard>
    </div>
  );
}

export default UsersSection;
