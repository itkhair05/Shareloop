import { useState } from 'react';
import { useAdminCategories } from '@/features/categories';
import type { ListingStatus, ListingType } from '@/types/listing';
import type { ReportGranularity, ReportingRangeQuery } from '@/types/reporting';
import {
  useListingsReportSummary,
  useListingsReportTimeseries,
  useTopRequestedListings,
} from '../hooks/use-reporting';
import { DomainFilterBar, DomainFilterField, domainSelectClassName } from '../components/ReportingFilterBar';
import { ReportingChartCard } from '../components/ReportingChartCard';
import { ReportingExportControl } from '../components/ReportingExportControl';
import { ReportingKpiCard } from '../components/ReportingKpiCard';
import { DonutChart } from '../components/DonutChart';
import { DistributionBars } from '../components/DistributionBars';
import { TimeseriesChart } from '../components/TimeseriesChart';
import {
  ReportingEmptyState,
  ReportingInlineNote,
  ReportingQueryError,
  ReportingSectionSkeleton,
} from '../components/ReportingStates';
import {
  buildCategoryBars,
  buildDistributionBars,
  buildDistributionDonut,
  getDistributionValue,
} from '../utils/reporting-chart-data';
import {
  formatPeriodLabel,
  formatReportingNumber,
} from '../utils/reporting-format';
import {
  getTimeseriesMetricLabel,
  LISTING_STATUS_LABELS,
  LISTING_TYPE_LABELS,
  SEMANTICS_NOTES,
} from '../utils/reporting-labels';

export interface ListingsSectionProps {
  range: ReportingRangeQuery;
  granularity: ReportGranularity;
}

const TOP_REQUESTED_LIMIT = 10;

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'chờ xử lý',
  ACCEPTED: 'đã chấp nhận',
  REJECTED: 'đã từ chối',
  WITHDRAWN: 'đã rút',
  CANCELLED: 'đã hủy',
};

export function ListingsSection({ range, granularity }: ListingsSectionProps) {
  const [status, setStatus] = useState<ListingStatus | 'ALL'>('ALL');
  const [listingType, setListingType] = useState<ListingType | 'ALL'>('ALL');
  const [categoryId, setCategoryId] = useState<string>('ALL');

  const { data: categories } = useAdminCategories();

  const summaryQuery = useListingsReportSummary({
    ...range,
    status: status === 'ALL' ? undefined : status,
    listingType: listingType === 'ALL' ? undefined : listingType,
    categoryId: categoryId === 'ALL' ? undefined : categoryId,
  });

  const timeseriesQuery = useListingsReportTimeseries({
    ...range,
    granularity,
    listingType: listingType === 'ALL' ? undefined : listingType,
    categoryId: categoryId === 'ALL' ? undefined : categoryId,
  });

  const topRequestedQuery = useTopRequestedListings({
    ...range,
    limit: TOP_REQUESTED_LIMIT,
    categoryId: categoryId === 'ALL' ? undefined : categoryId,
  });

  const hasActiveFilters = status !== 'ALL' || listingType !== 'ALL' || categoryId !== 'ALL';
  const timeseriesFiltered = listingType !== 'ALL' || categoryId !== 'ALL';

  return (
    <div className="space-y-5">
      <ReportingExportControl
        section="listings"
        range={range}
        granularity={granularity}
        filters={{
          status: status === 'ALL' ? undefined : status,
          listingType: listingType === 'ALL' ? undefined : listingType,
          categoryId: categoryId === 'ALL' ? undefined : categoryId,
          limit: TOP_REQUESTED_LIMIT,
        }}
      />

      <DomainFilterBar
        onReset={() => {
          setStatus('ALL');
          setListingType('ALL');
          setCategoryId('ALL');
        }}
        hasActiveFilters={hasActiveFilters}
        isFetching={summaryQuery.isFetching}
      >
        <DomainFilterField label="Trạng thái hiện tại" htmlFor="listings-status-filter">
          <select
            id="listings-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as ListingStatus | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(LISTING_STATUS_LABELS) as ListingStatus[]).map((value) => (
              <option key={value} value={value}>
                {LISTING_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        <DomainFilterField label="Hình thức" htmlFor="listings-type-filter">
          <select
            id="listings-type-filter"
            value={listingType}
            onChange={(event) => setListingType(event.target.value as ListingType | 'ALL')}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả hình thức</option>
            {(Object.keys(LISTING_TYPE_LABELS) as ListingType[]).map((value) => (
              <option key={value} value={value}>
                {LISTING_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </DomainFilterField>

        <DomainFilterField label="Danh mục" htmlFor="listings-category-filter">
          <select
            id="listings-category-filter"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={domainSelectClassName}
          >
            <option value="ALL">Tất cả danh mục</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </DomainFilterField>
      </DomainFilterBar>

      {summaryQuery.isLoading ? (
        <ReportingSectionSkeleton label="Đang tải số liệu tin đăng..." />
      ) : summaryQuery.isError || !summaryQuery.data ? (
        <ReportingQueryError
          title="Không thể tải số liệu tin đăng"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <ReportingKpiCard
              label="Tin đăng mới"
              value={formatReportingNumber(summaryQuery.data.metrics.totalListings)}
            />
            <ReportingKpiCard
              label="Đang hiển thị"
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'ACTIVE')
              )}
              color="emerald"
            />
            <ReportingKpiCard
              label="Đã đặt trước"
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'RESERVED')
              )}
            />
            <ReportingKpiCard
              label="Đã gỡ"
              value={formatReportingNumber(
                getDistributionValue(summaryQuery.data.metrics.byStatus, 'REMOVED')
              )}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReportingChartCard
              title="Trạng thái hiện tại"
              description="Không thêm nhóm “khác”; mọi trạng thái do hệ thống trả về đều được hiển thị."
            >
              <DonutChart
                items={buildDistributionDonut(
                  summaryQuery.data.metrics.byStatus,
                  'LISTING_STATUS'
                )}
                centerLabel="tin đăng mới"
                centerValue={formatReportingNumber(summaryQuery.data.metrics.totalListings)}
                ariaLabel="Phân bố tin đăng theo trạng thái hiện tại"
              />
            </ReportingChartCard>

            <ReportingChartCard
              title="Phân bố theo hình thức"
              description="Hình thức đăng tin của các tin được tạo trong kỳ."
            >
              <DistributionBars
                items={buildDistributionBars(
                  summaryQuery.data.metrics.byType,
                  'LISTING_TYPE'
                )}
                ariaLabel="Phân bố tin đăng theo hình thức"
              />
            </ReportingChartCard>

            <ReportingChartCard
              className="lg:col-span-2"
              title="Phân bố theo danh mục"
              description="Danh mục của các tin được tạo trong kỳ, theo dữ liệu thực tế từ hệ thống."
            >
              <DistributionBars
                items={buildCategoryBars(summaryQuery.data.metrics.byCategory)}
                ariaLabel="Phân bố tin đăng theo danh mục"
              />
            </ReportingChartCard>
          </div>

          <ReportingInlineNote>{SEMANTICS_NOTES.listings}</ReportingInlineNote>
        </>
      )}

      <ReportingChartCard
        title="Xu hướng tạo tin đăng"
        description="Số tin đăng được tạo theo từng mốc thời gian, đã lấp đầy các mốc không có phát sinh."
      >
        {timeseriesQuery.isLoading ? (
          <ReportingSectionSkeleton label="Đang tải xu hướng tin đăng..." compact />
        ) : timeseriesQuery.isError || !timeseriesQuery.data ? (
          <ReportingQueryError
            title="Không thể tải xu hướng tin đăng"
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
              color="#0ea5e9"
            />
            {status !== 'ALL' && (
              <p className="text-[11px] text-slate-500">
                Bộ lọc trạng thái hiện tại chỉ áp dụng cho phần tổng hợp. Biểu đồ xu hướng và bảng xếp hạng không
                hỗ trợ lọc theo trạng thái.
              </p>
            )}
            {timeseriesFiltered && (
              <p className="text-[11px] text-slate-500">
                Biểu đồ xu hướng đang áp dụng bộ lọc hình thức và/hoặc danh mục.
              </p>
            )}
          </div>
        )}
      </ReportingChartCard>

      <ReportingChartCard
        title="Tin đăng được yêu cầu nhiều nhất"
        description="Xếp hạng theo số yêu cầu được tạo trong kỳ báo cáo."
        meta={
          <span className="text-[11px] text-slate-500">
            Tối đa {TOP_REQUESTED_LIMIT} tin
          </span>
        }
      >
        {topRequestedQuery.isLoading ? (
          <ReportingSectionSkeleton label="Đang tải bảng xếp hạng tin đăng..." compact />
        ) : topRequestedQuery.isError || !topRequestedQuery.data ? (
          <ReportingQueryError
            title="Không thể tải bảng xếp hạng tin đăng"
            error={topRequestedQuery.error}
            onRetry={() => topRequestedQuery.refetch()}
            isRetrying={topRequestedQuery.isFetching}
          />
        ) : topRequestedQuery.data.listings.length === 0 ? (
          <ReportingEmptyState
            title="Chưa có tin đăng nào được yêu cầu trong kỳ"
            description="Không có yêu cầu hợp lệ nào được tạo cho các tin đăng trong khoảng thời gian đã chọn. Hãy mở rộng khoảng thời gian hoặc bỏ bộ lọc danh mục."
          />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="min-w-full text-xs">
                <caption className="sr-only">
                  Bảng xếp hạng tin đăng được yêu cầu nhiều nhất trong kỳ báo cáo
                </caption>
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th scope="col" className="py-2 pr-3 font-semibold w-8">#</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Tin đăng</th>
                    <th scope="col" className="py-2 pr-3 font-semibold whitespace-nowrap">Danh mục</th>
                    <th scope="col" className="py-2 pr-3 font-semibold whitespace-nowrap">Hình thức</th>
                    <th scope="col" className="py-2 pl-2 font-semibold text-right whitespace-nowrap">Yêu cầu</th>
                  </tr>
                </thead>
                <tbody>
                  {topRequestedQuery.data.listings.map((listing, index) => (
                    <tr key={listing.listingId} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-mono text-slate-400">{index + 1}</td>
                      <td className="py-2.5 pr-3 min-w-[12rem]">
                        <p className="font-medium text-slate-900 line-clamp-2">{listing.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {listing.ownerDisplayName}
                          {listing.categoryName ? ` · ${listing.categoryName}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                        {listing.categoryName || '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                        {LISTING_TYPE_LABELS[listing.listingType] ?? listing.listingType}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatReportingNumber(listing.requestCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>Kỳ xét: {formatPeriodLabel(topRequestedQuery.data.period)}</span>
              <span>
                Trạng thái yêu cầu được tính:{' '}
                {topRequestedQuery.data.countedRequestStatuses
                  .map((value) => REQUEST_STATUS_LABELS[value] ?? value)
                  .join(', ')}
              </span>
            </div>

            <ReportingInlineNote>{SEMANTICS_NOTES.topRequested}</ReportingInlineNote>
          </div>
        )}
      </ReportingChartCard>
    </div>
  );
}

export default ListingsSection;
